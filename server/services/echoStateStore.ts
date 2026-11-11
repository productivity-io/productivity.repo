/**
 * Durable ECHO conversation state.
 *
 * The session token itself is stateless (HMAC-signed sid + sub + expiry), so it survives a restart
 * whenever ECHO_SESSION_SECRET is configured. What used to be process-local was the conversation
 * history, the Lost & Found working memory and the cross-module subject memory - all of it lost on
 * restart or on a different instance. This module moves that state behind a small store interface.
 *
 * Account binding is enforced by the store: every read and write carries the authenticated `sub`
 * and never returns another account's rows, even if a sid leaks.
 */
import type { LostFoundItem } from './echoData.js';
import type { ToolMemory } from './echoTools.js';

export type EchoHistoryTurn = { user: string; assistant: string };
export type DataMemory = { items: LostFoundItem[]; at: number };
export type ToolMemoryEntry = { memory: ToolMemory; at: number };

/** Tool results are usable for 30 minutes, matching the pre-persistence behaviour. */
export const DATA_MEMORY_TTL_MS = 30 * 60_000;
const MAX_MEMORY_SESSIONS = 1000;
const RETENTION_MS = 24 * 60 * 60_000;

export interface EchoStateStore {
  ensureSession(sid: string, sub: string): void;
  getHistory(sid: string, sub: string): EchoHistoryTurn[];
  setHistory(sid: string, sub: string, history: EchoHistoryTurn[]): void;
  getDataMemory(sid: string, sub: string, now: number): DataMemory | null;
  setDataMemory(sid: string, sub: string, items: LostFoundItem[]): void;
  getToolMemory(sid: string, sub: string, now: number): ToolMemoryEntry | null;
  setToolMemory(sid: string, sub: string, memory: ToolMemory): void;
  revoke(sid: string, sub: string): void;
  isRevoked(sid: string): boolean;
}

type StoredSession = {
  sub: string;
  history: EchoHistoryTurn[];
  data: DataMemory | null;
  tools: ToolMemoryEntry | null;
  revoked: boolean;
};

/** Default store: process-local, used by tests and by any host that has not wired a durable one. */
export function createMemoryEchoStateStore(): EchoStateStore {
  const sessions = new Map<string, StoredSession>();

  const ensure = (sid: string, sub: string): StoredSession => {
    const existing = sessions.get(sid);
    if (existing) return existing;
    if (sessions.size >= MAX_MEMORY_SESSIONS) {
      const oldest = sessions.keys().next().value;
      if (oldest !== undefined) sessions.delete(oldest);
    }
    const created: StoredSession = { sub, history: [], data: null, tools: null, revoked: false };
    sessions.set(sid, created);
    return created;
  };

  const owned = (sid: string, sub: string): StoredSession | null => {
    const session = sessions.get(sid);
    if (!session || session.sub !== sub || session.revoked) return null;
    return session;
  };

  return {
    ensureSession(sid, sub) {
      const session = ensure(sid, sub);
      if (session.revoked) {
        sessions.set(sid, { sub, history: [], data: null, tools: null, revoked: false });
      }
    },
    getHistory(sid, sub) {
      return [...(owned(sid, sub)?.history || [])];
    },
    setHistory(sid, sub, history) {
      ensure(sid, sub).history = [...history];
    },
    getDataMemory(sid, sub, now) {
      const data = owned(sid, sub)?.data;
      if (!data) return null;
      if (now - data.at > DATA_MEMORY_TTL_MS) return null;
      return { items: [...data.items], at: data.at };
    },
    setDataMemory(sid, sub, items) {
      ensure(sid, sub).data = { items: [...items], at: Date.now() };
    },
    getToolMemory(sid, sub, now) {
      const entry = owned(sid, sub)?.tools;
      if (!entry) return null;
      if (now - entry.at > DATA_MEMORY_TTL_MS) return null;
      return { memory: { ...entry.memory }, at: entry.at };
    },
    setToolMemory(sid, sub, memory) {
      ensure(sid, sub).tools = { memory: { ...memory }, at: Date.now() };
    },
    revoke(sid, sub) {
      const session = sessions.get(sid);
      if (!session || session.sub !== sub) return;
      session.revoked = true;
      session.history = [];
      session.data = null;
      session.tools = null;
    },
    isRevoked(sid) {
      return sessions.get(sid)?.revoked === true;
    },
  };
}

type SqlClient = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    get(...params: unknown[]): Record<string, unknown> | undefined;
  };
};

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * SQLite-backed store. Works with the app's synchronous `node:sqlite` client, so it needs no async
 * rewrite; a hosted SQLite (libSQL/Turso over an HTTP driver) would require making this asynchronous.
 */
export function createSqliteEchoStateStore(client: SqlClient): EchoStateStore {
  client.exec(`
    CREATE TABLE IF NOT EXISTS echo_state (
      sid TEXT PRIMARY KEY,
      sub TEXT NOT NULL,
      history TEXT NOT NULL DEFAULT '[]',
      data_memory TEXT,
      data_at INTEGER,
      tool_memory TEXT,
      tool_at INTEGER,
      revoked INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS echo_state_sub ON echo_state (sub);
    CREATE INDEX IF NOT EXISTS echo_state_updated ON echo_state (updated_at);
  `);

  const read = (sid: string, sub: string) => client
    .prepare('SELECT sub, history, data_memory, data_at, tool_memory, tool_at, revoked FROM echo_state WHERE sid = ? AND sub = ?')
    .get(sid, sub);

  const touch = (sid: string, sub: string) => {
    client.prepare('UPDATE echo_state SET updated_at = ? WHERE sid = ? AND sub = ?')
      .run(Date.now(), sid, sub);
  };

  const ensure = (sid: string, sub: string) => {
    client.prepare(`INSERT INTO echo_state (sid, sub, history, updated_at) VALUES (?, ?, '[]', ?)
      ON CONFLICT(sid) DO NOTHING`).run(sid, sub, Date.now());
    // Opportunistic retention: drop conversations untouched for a day.
    client.prepare('DELETE FROM echo_state WHERE updated_at < ?').run(Date.now() - RETENTION_MS);
  };

  return {
    ensureSession(sid, sub) {
      ensure(sid, sub);
    },
    getHistory(sid, sub) {
      const row = read(sid, sub);
      if (!row || Number(row.revoked) === 1) return [];
      return parseJson<EchoHistoryTurn[]>(row.history, []);
    },
    setHistory(sid, sub, history) {
      ensure(sid, sub);
      client.prepare('UPDATE echo_state SET history = ?, updated_at = ? WHERE sid = ? AND sub = ?')
        .run(JSON.stringify(history.slice(-10)), Date.now(), sid, sub);
    },
    getDataMemory(sid, sub, now) {
      const row = read(sid, sub);
      if (!row || Number(row.revoked) === 1) return null;
      const at = Number(row.data_at);
      if (!Number.isFinite(at) || now - at > DATA_MEMORY_TTL_MS) return null;
      const items = parseJson<LostFoundItem[]>(row.data_memory, []);
      return items.length ? { items, at } : null;
    },
    setDataMemory(sid, sub, items) {
      ensure(sid, sub);
      client.prepare('UPDATE echo_state SET data_memory = ?, data_at = ?, updated_at = ? WHERE sid = ? AND sub = ?')
        .run(JSON.stringify(items), Date.now(), Date.now(), sid, sub);
    },
    getToolMemory(sid, sub, now) {
      const row = read(sid, sub);
      if (!row || Number(row.revoked) === 1) return null;
      const at = Number(row.tool_at);
      if (!Number.isFinite(at) || now - at > DATA_MEMORY_TTL_MS) return null;
      const memory = parseJson<ToolMemory | null>(row.tool_memory, null);
      return memory ? { memory, at } : null;
    },
    setToolMemory(sid, sub, memory) {
      ensure(sid, sub);
      client.prepare('UPDATE echo_state SET tool_memory = ?, tool_at = ?, updated_at = ? WHERE sid = ? AND sub = ?')
        .run(JSON.stringify(memory), Date.now(), Date.now(), sid, sub);
    },
    revoke(sid, sub) {
      client.prepare(`UPDATE echo_state SET revoked = 1, history = '[]', data_memory = NULL,
        tool_memory = NULL, updated_at = ? WHERE sid = ? AND sub = ?`).run(Date.now(), sid, sub);
    },
    isRevoked(sid) {
      const row = client.prepare('SELECT revoked FROM echo_state WHERE sid = ?').get(sid);
      return Number(row?.revoked) === 1;
    },
  };
}

