/**
 * Phase 1: conversational follow-up navigation against the actual ECHO router.
 *
 * The defect being locked down: ECHO offered to open a page, the user accepted, and the service
 * only produced prose. Every acceptance here must return a structured, allowlisted action that
 * the authenticated browser executes; prose alone is a failure.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import express from 'express';
import {
  isNavigationCancellation,
  isNavigationFollowUp,
  navigationOfferFor,
  NAVIGATION_OFFER_TTL_MS,
  type EchoNavigationAction,
} from '../server/services/echoConversation.ts';

let server: Server;
let base: string;
let clock = 1_760_000_000_000;
const USER_A = { 'x-test-user': 'account-a' };
const USER_B = { 'x-test-user': 'account-b' };

before(async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.FREELLMAPI_API_KEY;
  delete process.env.FREELMAPI_API_KEY;
  delete process.env.ECHO_MODEL_API_KEY;
  process.env.ECHO_CHAT_ENABLED = 'true';
  process.env.ECHO_SITE_ID = 'productivity-portal';
  const { createEchoServiceRouter } = await import('../server/services/echo.ts');
  const app = express();
  app.use(express.json());
  app.use('/sites', createEchoServiceRouter({
    authenticate: req => {
      const sub = String(req.headers['x-test-user'] || '');
      if (!sub) return null;
      const role = String(req.headers['x-test-role'] || 'student');
      if (!['student', 'teacher', 'coordinator', 'principal'].includes(role)) return null;
      return { sub, role: role as 'student' | 'teacher' | 'coordinator' | 'principal' };
    },
    now: () => clock,
  }));
  server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}/sites/productivity-portal`;
});

after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>(resolve => server.close(() => resolve()));
});

type Answer = { status: number; text: string; action?: EchoNavigationAction };

async function newSession(user: Record<string, string> = USER_A) {
  const response = await fetch(base + '/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...user },
    body: '{}',
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  return body.session_token as string;
}

async function ask(token: string, message: string, user: Record<string, string> = USER_A): Promise<Answer> {
  const response = await fetch(base + '/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...user, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ message, page: '/dashboard' }),
  });
  const raw = await response.text();
  const blocks = raw.split('\n\n').filter(Boolean);
  const text = blocks.filter(block => block.startsWith('event: delta'))
    .map(block => JSON.parse(block.split('\ndata: ')[1]).text).join('');
  const done = blocks.find(block => block.startsWith('event: done'));
  const action = done ? JSON.parse(done.split('\ndata: ')[1]).action : undefined;
  return { status: response.status, text, action };
}

test('attendance explanation offers navigation, and "okay take me there" returns a real route action', async () => {
  const token = await newSession();
  const offer = await ask(token, 'Where can I see my attendance?');
  assert.match(offer.text, /Attendance/);
  assert.match(offer.text, /take you there/i);
  assert.equal(offer.action, undefined, 'offering a page must not navigate by itself');

  const accepted = await ask(token, 'Okay, take me there.');
  assert.match(accepted.text, /Opening Attendance/);
  assert.equal(accepted.action?.type, 'navigate');
  assert.equal(accepted.action?.path, '/attendance');
  assert.equal(accepted.action?.actionId, 'nav:attendance');
  assert.equal(accepted.action?.label, 'Attendance');
});

test('assignment explanation executes on "open it"', async () => {
  const token = await newSession();
  await ask(token, 'Tell me about assignments');
  const accepted = await ask(token, 'Open it.');
  assert.equal(accepted.action?.path, '/assignments');
});

test('"yes please" and "show me" both accept the offered page', async () => {
  const yesToken = await newSession();
  await ask(yesToken, 'Where are my marks?');
  assert.equal((await ask(yesToken, 'Yes please')).action?.path, '/examinations');

  const showToken = await newSession();
  await ask(showToken, 'What is the library for?');
  assert.equal((await ask(showToken, 'Show me')).action?.path, '/library');
});

test('no pending offer means an ambiguous follow-up never navigates', async () => {
  const token = await newSession();
  const reply = await ask(token, 'Take me there');
  assert.equal(reply.action, undefined);
  assert.match(reply.text, /nothing changed/i);
});

test('cancellation withdraws the offer permanently', async () => {
  const token = await newSession();
  await ask(token, 'Where can I see my attendance?');
  const cancelled = await ask(token, 'No, cancel.');
  assert.equal(cancelled.action, undefined);
  assert.match(cancelled.text, /haven’t changed the page/i);
  const after = await ask(token, 'Take me there');
  assert.equal(after.action, undefined, 'a cancelled offer must not be revived');
  assert.match(after.text, /nothing changed/i);
});

test('the offer expires after its lifetime instead of navigating later', async () => {
  const token = await newSession();
  await ask(token, 'Where can I see my attendance?');
  clock += NAVIGATION_OFFER_TTL_MS + 1;
  try {
    const late = await ask(token, 'Take me there');
    assert.equal(late.action, undefined);
    assert.match(late.text, /expired/i);
  } finally {
    clock = 1_760_000_000_000;
  }
});

test('an explicit different destination replaces the offer', async () => {
  const token = await newSession();
  await ask(token, 'Where can I see my attendance?');
  const replaced = await ask(token, 'Actually, open assignments instead.');
  assert.equal(replaced.action?.path, '/assignments');
  assert.match(replaced.text, /Opening Assignments/);
});

test('a role change invalidates an offer that was made for the previous role', async () => {
  const token = await newSession({ ...USER_A, 'x-test-role': 'student' });
  await ask(token, 'Where can I see my attendance?', { ...USER_A, 'x-test-role': 'student' });
  const elevated = await ask(token, 'Take me there', { ...USER_A, 'x-test-role': 'teacher' });
  assert.equal(elevated.action, undefined, 'a stale role must not inherit the offer');
});

test('one session cannot accept another session’s offer', async () => {
  const first = await newSession(USER_A);
  const second = await newSession(USER_A);
  await ask(first, 'Where can I see my attendance?');
  const other = await ask(second, 'Take me there');
  assert.equal(other.action, undefined);
});

test('logging out revokes the session and its pending offer', async () => {
  const token = await newSession();
  await ask(token, 'Where can I see my attendance?');
  const revoked = await fetch(base + '/sessions/current', {
    method: 'DELETE',
    headers: { ...USER_A, Authorization: 'Bearer ' + token },
  });
  assert.equal(revoked.status, 200);
  assert.equal((await ask(token, 'Take me there')).status, 401);
});

test('acceptance executes before any conversational provider is consulted', async () => {
  const token = await newSession();
  await ask(token, 'Where can I see my attendance?');
  // A configured provider must not be able to intercept the follow-up as fresh conversation.
  process.env.FREELLMAPI_API_KEY = 'test-key-not-used';
  process.env.FREELLMAPI_BASE_URL = 'http://127.0.0.1:31415/v1';
  try {
    const accepted = await ask(token, 'Okay take me there');
    assert.equal(accepted.action?.path, '/attendance');
    assert.match(accepted.text, /Opening Attendance/);
  } finally {
    delete process.env.FREELLMAPI_API_KEY;
    delete process.env.FREELLMAPI_BASE_URL;
  }
});

test('a second account cannot use the first account’s session token', async () => {
  const token = await newSession(USER_A);
  await ask(token, 'Where can I see my attendance?');
  assert.equal((await ask(token, 'Take me there', USER_B)).status, 401);
});

test('follow-up detection is narrow and never treats cancel or prose as acceptance', () => {
  for (const accepted of ['okay take me there', 'yes please', 'open it', 'show me', 'go there', "let's do that", 'alright take me to it', 'yes', 'proceed']) {
    assert.equal(isNavigationFollowUp(accepted), true, accepted);
  }
  for (const rejected of ['no', 'cancel', 'no thanks', 'never mind', 'what time is lunch', 'okay so what is attendance', 'I do not want that']) {
    assert.equal(isNavigationFollowUp(rejected), false, rejected);
  }
  for (const cancelled of ['no', 'cancel', 'no, cancel', 'never mind', 'not now']) {
    assert.equal(isNavigationCancellation(cancelled), true, cancelled);
  }
});

test('an offer naming two destinations is withheld instead of guessed', () => {
  assert.equal(navigationOfferFor('Attendance is in the Attendance module. Assignments is elsewhere. Want me to take you there?'), null);
  assert.equal(navigationOfferFor('Attendance is in the Attendance module. Want me to take you there?')?.topicId, 'attendance');
});
