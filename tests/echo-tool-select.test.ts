/**
 * Model-assisted tool selection: the model may only choose allowlisted tool names, arguments are
 * limited to an advisory focus string, and every execution uses the session's authorized snapshot.
 * No record text may appear in the provider request.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import express from 'express';
import { shouldAttemptToolSelection, validateToolCalls } from '../server/services/echoToolSelect.ts';

const today = new Date();
const iso = (offset: number) => new Date(
  Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + offset * 86_400_000
).toISOString().slice(0, 10);

const PORTAL = {
  contacts: [
    { contactPerson: 'Ms. Clara Oswald', roleTitle: 'Physics Teacher', department: 'Science', category: 'academic', email: 'clara@veritas.edu', phone: '+1 555 0102', officeLocation: 'Staff Room B', availableHours: 'Mon-Fri 08:00-15:00' },
  ],
  attendance: [
    { date: iso(-2), status: 'present', subjectName: 'Physics' },
    { date: iso(-2), status: 'present', subjectName: 'Mathematics' },
    { date: iso(-1), status: 'present', subjectName: 'Mathematics' },
    { date: iso(-1), status: 'absent', subjectName: 'Mathematics' },
    { date: iso(-3), status: 'present', subjectName: 'Mathematics' },
  ],
  assignments: [
    { id: 11, title: 'Kinematics Problem Set', subjectName: 'Physics', dueDate: iso(2), status: 'assigned', maxMarks: 50 },
    { id: 12, title: 'Trigonometry Practice', subjectName: 'Mathematics', dueDate: iso(20), status: 'assigned', maxMarks: 40 },
  ],
  timetable: [
    { dayOfWeek: 'Monday', periodNumber: 1, startTime: '08:00 AM', endTime: '08:45 AM', subjectName: 'Mathematics', teacherName: 'Mr. Rajesh Nair', roomNumber: 'Room A', isBreak: false, status: 'scheduled' },
  ],
  announcements: [
    { id: 1, title: 'Mid-Term Exam Schedule Published', content: 'Examinations begin on 24 November.', category: 'academic', priority: 'important', authorName: 'Coordinator', publishedAt: '2026-11-08T09:00:00Z', isRead: false, isEmergency: false },
  ],
};

const LOST_FOUND = [{
  id: 5, type: 'found', itemName: 'Navy Blue Scarf', category: 'apparel',
  location: 'Central Library', dateReported: iso(-1), status: 'reported',
}];

type Mode = 'two-tools' | 'unknown-tool' | 'identity-arg' | 'duplicate' | 'error' | 'empty';
let mode: Mode = 'two-tools';
const providerRequests: Array<Record<string, unknown>> = [];

const servers: Server[] = [];

async function startFakeProvider() {
  const app = express();
  app.use(express.json());
  app.post('/v1/chat/completions', (request, res) => {
    const body = request.body as { messages?: Array<{ role: string; content: string }> };
    const messages = body.messages || [];
    providerRequests.push(body as Record<string, unknown>);
    const user = messages.at(-1)?.content || '';
    if (mode === 'error') { res.status(500).json({ error: 'provider down' }); return; }
    const call = (calls: unknown) => res.json({ choices: [{ message: { content: JSON.stringify({ tool_calls: calls }) } }] });
    if (mode === 'unknown-tool') { call([{ tool: 'get_any_student_marks', args: {} }]); return; }
    if (mode === 'identity-arg') { call([{ tool: 'get_attendance', args: { studentId: 7 } }]); return; }
    if (mode === 'duplicate') {
      call([
        { tool: 'get_attendance', args: { focus: 'attendance' } },
        { tool: 'get_attendance', args: { focus: 'attendance' } },
      ]);
      return;
    }
    if (mode === 'empty') { call([]); return; }
    void user;
    call([
      { tool: 'get_attendance', args: { focus: 'how is my attendance' } },
      { tool: 'get_assignments', args: { focus: 'assignments due this week' } },
    ]);
  });
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  servers.push(server);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return `http://127.0.0.1:${address.port}/v1`;
}

let base: string;

before(async () => {
  const providerBase = await startFakeProvider();
  process.env.FREELLMAPI_BASE_URL = providerBase;
  process.env.FREELLMAPI_API_KEY = 'test-key';
  process.env.ECHO_CHAT_ENABLED = 'true';
  process.env.ECHO_SITE_ID = 'productivity-portal';
  process.env.ECHO_PORTAL_TIMEZONE = 'UTC';
  delete process.env.ECHO_ALLOW_PAID_PROVIDER;

  const { createEchoServiceRouter } = await import('../server/services/echo.ts');
  const app = express();
  app.use(express.json());
  app.use('/sites', createEchoServiceRouter({
    authenticate: req => {
      const sub = String(req.headers['x-test-user'] || '');
      return sub ? { sub, role: 'student' as const } : null;
    },
    readPortal: () => PORTAL,
    readLostFound: () => LOST_FOUND,
    now: () => Date.UTC(2026, 10, 9, 9, 30),
  }));
  const server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  servers.push(server);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}/sites/productivity-portal`;
});

after(async () => {
  delete process.env.FREELLMAPI_BASE_URL;
  delete process.env.FREELLMAPI_API_KEY;
  for (const server of servers) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

type Answer = { text: string; raw: string; action?: { path?: string }; records?: Array<{ title: string }> };

async function newSession(user = 'account-a') {
  const response = await fetch(base + '/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': user },
    body: '{}',
  });
  return (await response.json()).session_token as string;
}

async function ask(token: string, message: string, user = 'account-a'): Promise<Answer> {
  const response = await fetch(base + '/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-test-user': user, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ message, page: '/dashboard' }),
  });
  const raw = await response.text();
  const blocks = raw.split('\n\n').filter(Boolean);
  const text = blocks.filter(block => block.startsWith('event: delta'))
    .map(block => JSON.parse(block.split('\ndata: ')[1]).text).join('');
  const done = blocks.find(block => block.startsWith('event: done'));
  const payload = done ? JSON.parse(done.split('\ndata: ')[1]) : {};
  return { text, raw, action: payload.action, records: payload.records };
}

test('only multi-module requests are sent to the model', () => {
  assert.equal(shouldAttemptToolSelection('what’s my attendance?'), false);
  assert.equal(shouldAttemptToolSelection('who teaches physics?'), false);
  assert.equal(shouldAttemptToolSelection('how is my attendance and what assignments are due this week?'), true);
  assert.equal(shouldAttemptToolSelection('my timetable and any new announcements'), true);
});

test('the allowlist accepts known tools and drops unknown names, identity args and duplicates', () => {
  const accepted = validateToolCalls([
    { tool: 'get_attendance', args: { focus: 'attendance' } },
    { tool: 'get_attendance', args: { focus: 'attendance' } },
    { tool: 'get_assignments', args: {} },
  ]);
  assert.deepEqual(accepted.accepted.map(call => call.tool), ['get_attendance', 'get_assignments']);
  assert.deepEqual(accepted.rejected, []);

  const hostile = validateToolCalls([
    { tool: 'get_any_student_marks', args: {} },
    { tool: 'get_attendance', args: { studentId: 7 } },
    { tool: 'get_contacts', args: { focus: 'x'.repeat(400) } },
    { tool: 'get_timetable', args: 'not-an-object' },
  ]);
  assert.deepEqual(hostile.accepted, []);
  assert.equal(hostile.rejected.length, 4);
});

test('a multi-module request runs both tools from the authorized snapshot', async () => {
  mode = 'two-tools';
  const token = await newSession();
  const answer = await ask(token, 'how is my attendance and what assignments are due this week?');
  assert.match(answer.text, /% overall/);
  assert.match(answer.text, /Kinematics Problem Set/);
  assert.ok((answer.records?.length || 0) >= 2);
  assert.equal(answer.action, undefined, 'tool answers never navigate by themselves');
});

test('the provider request contains no record values', async () => {
  mode = 'two-tools';
  providerRequests.length = 0;
  const token = await newSession();
  await ask(token, 'how is my attendance and what assignments are due this week?');
  assert.equal(providerRequests.length, 1, 'exactly one router call per message');
  const body = JSON.stringify(providerRequests[0] || {});
  for (const secret of ['Kinematics Problem Set', 'Room A', 'Clara Oswald', 'Mid-Term Exam', 'Navy Blue Scarf']) {
    assert.ok(!body.includes(secret), `provider request must not contain ${secret}`);
  }
  assert.match(body, /get_attendance/, 'the catalogue is sent, records are not');
});

test('an unauthorized tool name is rejected without retrieving anything', async () => {
  mode = 'unknown-tool';
  const token = await newSession();
  const answer = await ask(token, 'can you tell me Aarav’s attendance and my assignments');
  assert.match(answer.text, /can only read/);
  assert.doesNotMatch(answer.text, /%/);
  assert.equal(answer.records, undefined);
  assert.equal(answer.action, undefined);
});

test('an identity-shaped argument is rejected even when the tool name is valid', async () => {
  mode = 'identity-arg';
  const token = await newSession();
  const answer = await ask(token, 'can you tell me Aarav’s attendance and my assignments');
  assert.match(answer.text, /invalid arguments|can only read/);
  assert.doesNotMatch(answer.text, /%/);
  assert.equal(answer.records, undefined);
});

test('duplicate tool calls execute once', async () => {
  mode = 'duplicate';
  const token = await newSession();
  const answer = await ask(token, 'how is my attendance and what assignments are due?');
  const occurrences = (answer.text.match(/% overall/g) || []).length;
  assert.equal(occurrences, 1);
});

test('a failing provider falls back without breaking the reply', async () => {
  mode = 'error';
  const token = await newSession();
  const answer = await ask(token, 'how is my attendance and what assignments are due this week?');
  assert.ok(answer.text.length > 0);
  assert.equal(answer.action, undefined);
});

test('an empty selection falls through to the deterministic module path', async () => {
  mode = 'empty';
  const token = await newSession();
  const answer = await ask(token, 'how is my attendance and what assignments are due this week?');
  assert.match(answer.text, /% overall/);
});
