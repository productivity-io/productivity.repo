/**
 * Persistence and storage-boundary tests.
 *
 * These prove the properties the deployment plan depends on: ECHO conversation state survives a
 * fresh store instance on the same database, sessions are account-bound, revocation persists, and
 * uploads are no longer world-readable.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import express from 'express';
import { SqliteClientAdapter } from '../server/db/sqliteAdapter.ts';
import { createSqliteEchoStateStore, DATA_MEMORY_TTL_MS } from '../server/services/echoStateStore.ts';
import { canReadUpload } from '../server/services/uploadAccess.ts';
import { createEchoServiceRouter } from '../server/services/echo.ts';

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-store-'));
  return { dir, file: path.join(dir, 'state.db') };
}

const LOST_ITEM = {
  id: 5, type: 'found', itemName: 'Navy Blue Scarf', category: 'apparel',
  location: 'Central Library', dateReported: '2026-11-01', status: 'reported',
} as unknown as never;

test('history and working memory survive a fresh store instance on the same database', () => {
  const { dir, file } = tempDb();
  try {
    const first = new SqliteClientAdapter(file);
    const storeA = createSqliteEchoStateStore(first);
    storeA.ensureSession('sid-restart', 'user-a');
    storeA.setHistory('sid-restart', 'user-a', [{ user: 'hello', assistant: 'hi' }]);
    storeA.setToolMemory('sid-restart', 'user-a', { lastModule: 'attendance', subject: 'Physics' });
    storeA.setDataMemory('sid-restart', 'user-a', [LOST_ITEM]);
    first.close();

    const second = new SqliteClientAdapter(file);
    const storeB = createSqliteEchoStateStore(second);
    assert.deepEqual(storeB.getHistory('sid-restart', 'user-a'), [{ user: 'hello', assistant: 'hi' }]);
    assert.equal(storeB.getToolMemory('sid-restart', 'user-a', Date.now())?.memory.subject, 'Physics');
    assert.equal(storeB.getDataMemory('sid-restart', 'user-a', Date.now())?.items.length, 1);
    second.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('another account never reads a session it does not own', () => {
  const { dir, file } = tempDb();
  try {
    const client = new SqliteClientAdapter(file);
    const store = createSqliteEchoStateStore(client);
    store.ensureSession('sid-owner', 'user-a');
    store.setHistory('sid-owner', 'user-a', [{ user: 'private', assistant: 'answer' }]);
    assert.deepEqual(store.getHistory('sid-owner', 'user-b'), []);
    assert.equal(store.getToolMemory('sid-owner', 'user-b', Date.now()), null);
    client.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('revocation persists across instances and clears stored state', () => {
  const { dir, file } = tempDb();
  try {
    const first = new SqliteClientAdapter(file);
    const storeA = createSqliteEchoStateStore(first);
    storeA.ensureSession('sid-revoked', 'user-a');
    storeA.setHistory('sid-revoked', 'user-a', [{ user: 'hi', assistant: 'there' }]);
    storeA.revoke('sid-revoked', 'user-a');
    first.close();

    const second = new SqliteClientAdapter(file);
    const storeB = createSqliteEchoStateStore(second);
    assert.equal(storeB.isRevoked('sid-revoked'), true);
    assert.deepEqual(storeB.getHistory('sid-revoked', 'user-a'), []);
    // A different account cannot revoke someone else's session.
    storeB.ensureSession('sid-other', 'user-a');
    storeB.revoke('sid-other', 'user-b');
    assert.equal(storeB.isRevoked('sid-other'), false);
    second.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('expired tool memory is withheld', () => {
  const { dir, file } = tempDb();
  try {
    const client = new SqliteClientAdapter(file);
    const store = createSqliteEchoStateStore(client);
    store.ensureSession('sid-ttl', 'user-a');
    store.setToolMemory('sid-ttl', 'user-a', { lastModule: 'assignments' });
    assert.ok(store.getToolMemory('sid-ttl', 'user-a', Date.now()));
    assert.equal(store.getToolMemory('sid-ttl', 'user-a', Date.now() + DATA_MEMORY_TTL_MS + 1), null);
    client.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the router writes history through the injected store for the owning account only', async () => {
  const { dir, file } = tempDb();
  const adapter = new SqliteClientAdapter(file);
  const reopenedAdapter = new SqliteClientAdapter(file);
  const server = express();
  server.use(express.json());
  server.use('/sites', createEchoServiceRouter({
    authenticate: req => {
      const sub = String(req.headers['x-test-user'] || '');
      return sub ? { sub, role: 'student' as const } : null;
    },
    store: createSqliteEchoStateStore(adapter),
  }));
  const listener = await new Promise<Server>(resolve => {
    const instance = server.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const { port } = listener.address() as { port: number };
    const base = `http://127.0.0.1:${port}/sites/productivity-portal`;
    const created = await fetch(base + '/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user': 'account-a' },
      body: '{}',
    });
    const { session_token: token } = (await created.json()) as { session_token: string };
    const sid = (JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as { sid: string }).sid;
    const reply = await fetch(base + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user': 'account-a', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ message: 'open attendance', page: '/dashboard' }),
    });
    assert.equal(reply.status, 200);
    await reply.text();

    const afterRestart = createSqliteEchoStateStore(reopenedAdapter);
    const history = afterRestart.getHistory(sid, 'account-a');
    assert.equal(history.length, 1, 'history is durable and readable by a new store instance');
    assert.match(history[0].user, /open attendance/);
    assert.deepEqual(afterRestart.getHistory(sid, 'account-b'), [], 'no cross-account read');
  } finally {
    listener.closeAllConnections();
    await new Promise<void>(resolve => listener.close(() => resolve()));
    adapter.close();
    reopenedAdapter.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('upload reads are owner, staff, referenced, or refused', () => {
  const record = {
    url: '/uploads/general/a.pdf', ownerId: 7, originalName: 'a.pdf',
    mimeType: 'application/pdf', size: 10, createdAt: '2026-11-11T00:00:00.000Z',
  };
  assert.equal(canReadUpload({ id: 7, role: 'student' }, record, false), true, 'owner');
  assert.equal(canReadUpload({ id: 8, role: 'student' }, record, false), false, 'other student, unreferenced');
  assert.equal(canReadUpload({ id: 8, role: 'student' }, record, true), true, 'class attachment');
  assert.equal(canReadUpload({ id: 9, role: 'teacher' }, null, false), true, 'staff, legacy file');
  assert.equal(canReadUpload(null, record, true), false, 'anonymous');
});
