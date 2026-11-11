/**
 * Model-assisted, server-validated tool selection.
 *
 * The model is a ROUTER, not a data path. It is shown the user's request, recent turns and a fixed
 * catalogue of read-only tool names. It returns only `{ tool_calls: [{ tool, args }] }`.
 *
 * - Tool names are checked against a hard allowlist; anything else is rejected and reported.
 * - Arguments are limited to an optional `focus` string. No account id, no role, no SQL, no query.
 * - Identity always comes from the authenticated ECHO session, never from the model.
 * - Execution reuses the same authorized snapshot as the deterministic path, and answers are
 *   composed on the server, so **no record text is ever sent to the provider**.
 * - At most three tools, duplicates are dropped, and exactly one provider call is made: no loop.
 */
import type { EchoRecord } from './echoData.js';
import { answerLostFoundRequest, LOST_FOUND_UNAVAILABLE, type LostFoundItem } from './echoData.js';
import {
  answerPortalRequest,
  detectPortalModules,
  type PortalClock,
  type PortalModule,
  type PortalSnapshot,
  type ToolMemory,
} from './echoTools.js';
import { getEchoProviderConfig, type EchoProviderInfo } from './echoConversation.js';

export type ToolCall = { tool: string; args: Record<string, unknown> };

const TOOL_MODULES: Record<string, PortalModule> = {
  get_attendance: 'attendance',
  get_assignments: 'assignments',
  get_contacts: 'contacts',
  get_timetable: 'timetable',
  get_announcements: 'announcements',
};

const LOST_FOUND_TOOL = 'get_lost_found';
const ALLOWED_ARG_KEYS = new Set(['focus']);
const MAX_TOOL_CALLS = 3;
const MAX_FOCUS_LENGTH = 80;

const CATALOG = [
  { name: 'get_attendance', description: 'The signed-in student’s own attendance: overall rate, per-subject rates, weakest subject, absences.' },
  { name: 'get_assignments', description: 'The signed-in student’s own assignments and work owed: open work, due today/tomorrow/this week, overdue, submissions, hand-in, per-subject.' },
  { name: 'get_contacts', description: 'The published staff directory: who to contact, roles, departments, email, phone, office hours.' },
  { name: 'get_timetable', description: 'The signed-in student’s own class timetable: next class, a named weekday, rooms, teachers, substitutions.' },
  { name: 'get_announcements', description: 'Notices visible to this account, including unread state, category, priority and emergency alerts.' },
  { name: 'get_lost_found', description: 'Campus Lost & Found records: what has been found, what is unclaimed, claim status.' },
] as const;

const ROUTER_PROMPT = `You are the tool router for ECHO, the Veritas school portal assistant.
Decide which read-only tools answer the user's request. You cannot see any records and you must not
guess at their contents.

Return ONLY compact JSON in this exact shape:
{"tool_calls":[{"tool":"get_attendance","args":{"focus":"short description"}}]}

Rules:
- At most ${MAX_TOOL_CALLS} calls. Use one call for EVERY module the request needs, including
  ones it only implies. Work that is owed, due, to hand in or to submit is get_assignments; missed,
  skipped or attended classes are get_attendance. Never drop a module just because another module
  was easier to recognise.
- Use only these tool names: ${CATALOG.map(tool => tool.name).join(', ')}.
- args may contain only an optional "focus" string (max ${MAX_FOCUS_LENGTH} characters).
- Never include a user id, name of another person, role, SQL, table name or query in args.
- If no tool applies, return {"tool_calls":[]}.
- Do not answer the question and do not explain; return JSON only.`;

const MODULE_CUES = [
  /\b(?:attendance|attendence|absent|present|late|missing|classes)\b/,
  /\b(?:assignments?|homework|due|overdue|submissions?|hand(?:ed|ing)?\s+in|owe|submit)\b/,
  /\b(?:contacts?|directory|who teaches|who should i contact)\b/,
  /\b(?:timetable|time table|periods?|next class|schedule)\b/,
  /\b(?:announcements?|notices?|circulars?|news)\b/,
  /\b(?:lost\s*(?:and|&)\s*found|found items|unclaimed)\b/,
];

/** A second ask, even without a second module word ("...and also..."), still means multi-part. */
const CONJUNCTION = /\b(?:and|also|plus|then|as well|along with)\b|&/;

/**
 * Only multi-module requests go to the model; single-module ones keep the deterministic path.
 * Activation is two module cues, or one cue plus a conjunction in a real sentence. The second form
 * exists because "I've been missing morning classes and also owe work" is multi-part but names the
 * second module indirectly. A model that then selects nothing falls back to the deterministic path,
 * so the wider rule costs one provider call, never correctness.
 */
export function shouldAttemptToolSelection(message: string): boolean {
  if (typeof message !== 'string' || message.length < 10 || message.length > 4000) return false;
  const value = message.toLowerCase();
  const cues = MODULE_CUES.filter(cue => cue.test(value)).length;
  if (cues >= 2) return true;
  return cues === 1 && value.length >= 25 && CONJUNCTION.test(value);
}

function sanitizeName(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'unknown' : 'unknown';
}

function normalizeCall(entry: unknown): { name: string; args: Record<string, unknown> } | null {
  if (!entry || typeof entry !== 'object') return null;
  const record = entry as Record<string, unknown>;
  const fn = record.function && typeof record.function === 'object'
    ? (record.function as Record<string, unknown>)
    : null;
  const rawName = fn ? fn.name : record.tool ?? record.name;
  if (typeof rawName !== 'string' || !rawName || rawName.length > 64) return null;
  const rawArgs = fn ? fn.arguments : record.args;
  let args: Record<string, unknown> = {};
  if (typeof rawArgs === 'string') {
    try {
      const parsed: unknown = JSON.parse(rawArgs);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      args = parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)) {
    args = rawArgs as Record<string, unknown>;
  } else if (rawArgs !== undefined && rawArgs !== null) {
    return null;
  }
  return { name: rawName, args };
}

function validArgs(args: Record<string, unknown>): boolean {
  return Object.entries(args).every(([key, value]) =>
    ALLOWED_ARG_KEYS.has(key)
    && typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_FOCUS_LENGTH);
}

/** Strict allowlist + argument validation. Unknown tools and any identity-shaped argument fail. */
export function validateToolCalls(raw: unknown): { accepted: ToolCall[]; rejected: string[] } {
  const list = Array.isArray(raw) ? raw : [];
  const accepted: ToolCall[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const entry of list.slice(0, 8)) {
    const call = normalizeCall(entry);
    if (!call) {
      rejected.push('unknown');
      continue;
    }
    if (!(call.name in TOOL_MODULES) && call.name !== LOST_FOUND_TOOL) {
      rejected.push(sanitizeName(call.name));
      continue;
    }
    if (!validArgs(call.args)) {
      rejected.push(`${sanitizeName(call.name)} (invalid arguments)`);
      continue;
    }
    const key = call.name + '|' + JSON.stringify(call.args);
    if (seen.has(key)) continue;
    seen.add(key);
    accepted.push({ tool: call.name, args: call.args });
    if (accepted.length >= MAX_TOOL_CALLS) break;
  }
  return { accepted, rejected };
}

/** Extract the call array from the shapes providers actually emit. */
function callsFrom(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== 'object') return [];
  const record = parsed as Record<string, unknown>;
  for (const key of ['tool_calls', 'tools', 'calls']) {
    const value = record[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

export function parseToolSelection(text: string): unknown | null {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function askProvider(
  message: string,
  history: ReadonlyArray<{ user: string; assistant: string }>,
  signal: AbortSignal
): Promise<{ parsed: unknown; provider: EchoProviderInfo } | null> {
  const config = getEchoProviderConfig();
  if (!config) return null;
  const timeout = Number(process.env.ECHO_TOOL_SELECT_TIMEOUT_MS) || 8_000;
  const deadline = AbortSignal.timeout(timeout);
  const combined = typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, deadline]) : deadline;
  const messages = [
    { role: 'system' as const, content: ROUTER_PROMPT },
    ...history.slice(-4).flatMap(turn => [
      { role: 'user' as const, content: turn.user },
      { role: 'assistant' as const, content: turn.assistant },
    ]),
    { role: 'user' as const, content: message },
  ];
  const basePayload = { model: config.model, messages, max_tokens: 220, temperature: 0 };
  const send = (body: unknown) => fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'ECHO-Web/1.0',
    },
    body: JSON.stringify(body),
    signal: combined,
  });
  try {
    // JSON mode makes a chatty upstream far more likely to return the router object. Gateways that
    // reject it get exactly one retry without it, so a routing turn never exceeds two bounded calls.
    let response = await send({ ...basePayload, response_format: { type: 'json_object' } });
    if (!response.ok) {
      await response.text().catch(() => '');
      response = await send(basePayload);
      if (!response.ok) {
        await response.text().catch(() => '');
        return null;
      }
    }
    const data = (await response.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: string } }>;
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    const parsed = content ? parseToolSelection(content) : null;
    if (!parsed) return null;
    return {
      parsed,
      provider: {
        id: 'freellmapi',
        name: 'FreeLLMAPI',
        model: config.model,
        route: response.headers.get('x-routed-via') || undefined,
        fallback: false,
      },
    };
  } catch {
    return null;
  }
}

export type ToolRunResult = {
  text: string;
  /** The router call happened, so the turn is attributed to the model, not to local guidance. */
  provider: EchoProviderInfo;
  references: Array<{ title: string }>;
  records?: EchoRecord[];
  memory: ToolMemory;
};

export type ToolSelectionOptions = {
  message: string;
  history: ReadonlyArray<{ user: string; assistant: string }>;
  snapshot: PortalSnapshot | null;
  lostFound?: readonly LostFoundItem[] | null;
  memory?: ToolMemory;
  clock: PortalClock;
  signal: AbortSignal;
};

/**
 * Ask the model which tools to use, validate the answer, execute against the authorized snapshot
 * and compose one grounded reply. Returns null when selection does not apply or the provider is
 * unavailable, so the caller keeps the deterministic or normal conversational path.
 */
export async function runSelectedTools(options: ToolSelectionOptions): Promise<ToolRunResult | null> {
  if (!shouldAttemptToolSelection(options.message)) return null;
  const answer = await askProvider(options.message, options.history, options.signal);
  if (!answer) return null;
  const { parsed, provider } = answer;

  const { accepted, rejected } = validateToolCalls(callsFrom(parsed));
  if (!accepted.length) {
    if (!rejected.length) return null;
    return {
      text: `I can only read the portal modules your account can access, and ${rejected.slice(0, 3).join(', ')} isn’t one of them — nothing was retrieved. Try asking about your attendance, assignments, timetable, announcements, contacts or Lost & Found.`,
      references: [{ title: 'ECHO' }],
      memory: options.memory || {},
      provider,
    };
  }

  const parts: string[] = [];
  const records: EchoRecord[] = [];
  const titles: string[] = [];
  let memory: ToolMemory = options.memory ? { ...options.memory } : {};

  for (const call of accepted) {
    if (call.tool === LOST_FOUND_TOOL) {
      titles.push('Lost & Found');
      if (!options.lostFound) {
        parts.push(LOST_FOUND_UNAVAILABLE);
        continue;
      }
      const focus = typeof call.args.focus === 'string' ? call.args.focus : options.message;
      const answer = answerLostFoundRequest(focus, options.lostFound);
      parts.push(answer.text);
      records.push(...answer.records);
      continue;
    }
    const module = TOOL_MODULES[call.tool];
    const answer = answerPortalRequest(options.message, module, options.snapshot, memory, options.clock);
    parts.push(answer.text);
    records.push(...answer.records);
    titles.push(answer.title);
    memory = answer.memory;
  }

  // The model sometimes returns only the module it recognised first. Complete the reply with any
  // module the request itself names, using the same authorized snapshot, so a skipped module never
  // silently disappears from a multi-part answer.
  const covered = new Set<string>(accepted.map(call =>
    call.tool === LOST_FOUND_TOOL ? 'lost-found' : TOOL_MODULES[call.tool]));
  for (const module of detectPortalModules(options.message)) {
    if (covered.has(module) || accepted.length >= MAX_TOOL_CALLS) continue;
    const answer = answerPortalRequest(options.message, module, options.snapshot, memory, options.clock);
    parts.push(answer.text);
    records.push(...answer.records);
    titles.push(answer.title);
    memory = answer.memory;
    covered.add(module);
    accepted.push({ tool: module, args: {} });
  }

  const unique = [...new Set(parts.filter(Boolean))];
  const text = unique.join('\n\n').slice(0, 2400);
  return {
    text,
    references: [...new Set(titles)].map(title => ({ title })),
    records: records.length ? records.slice(0, 8) : undefined,
    memory,
    provider,
  };
}
