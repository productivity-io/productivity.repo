/** Release audit of the actual built-in router. Loopback only, no DB or provider. */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createHmac, randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import express from 'express';

let server: Server;
let base: string;
const fallback = 'veritas-echo-isolated-chat-session-secret-v1';
const USER_A = { 'x-test-user': 'account-a' };
const USER_B = { 'x-test-user': 'account-b' };
before(async () => {
  // Intentionally test the shipped missing-secret behavior; never read operator keys.
  delete process.env.ECHO_SESSION_SECRET;
  delete process.env.SESSION_SECRET;
  process.env.OPENAI_API_KEY = '';
  process.env.ECHO_CHAT_ENABLED = 'true';
  process.env.ECHO_SITE_ID = 'productivity-portal';
  const { createEchoServiceRouter } = await import('../server/services/echo.ts');
  const app = express();
  app.use(express.json());
  app.use('/sites', createEchoServiceRouter({
    authenticate: req => {
      const sub = String(req.headers['x-test-user'] || '');
      return sub ? { sub, role: 'student' } : null;
    },
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
function authHeaders(user: Record<string, string>) {
  return { 'Content-Type': 'application/json', ...user };
}
async function session(user: Record<string, string> | null = USER_A) {
  const response = await fetch(base + '/sessions', {
    method: 'POST',
    headers: authHeaders(user || {}),
    body: '{}',
  });
  const body = await response.json().catch(() => ({}));
  return { response, token: body.session_token as string };
}
async function message(token: string, body: Record<string, unknown> = { message: 'hello' }, user: Record<string, string> = USER_A) {
  const response = await fetch(base + '/messages', {
    method: 'POST',
    headers: { ...authHeaders(user), Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  await response.text();
  return response;
}
function signed(payload: object) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return encoded + '.' + createHmac('sha256', fallback).update(encoded).digest('base64url');
}
test('release gate: session issuance requires portal identity', async () => {
  const { response } = await session(null);
  assert.ok([401, 403].includes(response.status), 'Anonymous session issuance must be denied; observed HTTP ' + response.status);
});
test('release gate: signed-in account can start an ECHO session', async () => {
  const { response, token } = await session();
  assert.equal(response.status, 201);
  assert.ok(token);
  assert.equal((await message(token)).status, 200);
});
test('release gate: an ECHO session cannot be reused by another account', async () => {
  const { token } = await session(USER_A);
  assert.equal((await message(token, { message: 'hello' }, USER_B)).status, 401);
});
test('release gate: unapproved browser origin is denied', async () => {
  const response = await fetch(base + '/config', { headers: { Origin: 'https://unapproved.invalid' } });
  assert.ok([401, 403].includes(response.status), 'Unapproved origin must be denied; observed HTTP ' + response.status);
  assert.notEqual(response.headers.get('access-control-allow-origin'), 'https://unapproved.invalid');
});
test('release gate: public default secret cannot mint usable sessions', async () => {
  const token = signed({ sid: randomBytes(18).toString('hex'), siteId: 'productivity-portal', sub: 'account-a', exp: Date.now() + 60000 });
  assert.equal((await message(token)).status, 401, 'Unissued forged session must be rejected');
});
test('release gate: malformed signed expiry is rejected', async () => {
  const token = signed({ sid: randomBytes(18).toString('hex'), siteId: 'productivity-portal', sub: 'account-a', exp: 'invalid' });
  assert.equal((await message(token)).status, 401, 'Non-numeric expiry must be rejected');
});
test('release gate: session token has no ignored suffix', async () => {
  const { token } = await session();
  assert.equal((await message(token + '.unexpected')).status, 401);
});
test('release gate: unsupported tool/request fields are rejected', async () => {
  const { token } = await session();
  assert.equal((await message(token, { message: 'hello', tools: ['forbidden-test-tool'] })).status, 400);
});
test('release gate: page context cannot carry a foreign URL or script', async () => {
  const { token } = await session();
  for (const page of ['https://evil.invalid', '/dashboard?token=secret', '/dashboard"', '/../../etc']) {
    assert.equal((await message(token, { message: 'hello', page })).status, 400, page);
  }
});
test('existing protection: invalid signatures are rejected', async () => {
  assert.equal((await message('invalid.invalid')).status, 401);
});
test('existing protection: expired tokens are rejected', async () => {
  const token = signed({ sid: 'expired-test', siteId: 'productivity-portal', sub: 'account-a', exp: Date.now() - 1000 });
  assert.equal((await message(token)).status, 401);
});
test('existing protection: reset revokes the token in this process', async () => {
  const { token } = await session();
  const response = await fetch(base + '/sessions/current', {
    method: 'DELETE',
    headers: { ...USER_A, Authorization: 'Bearer ' + token },
  });
  assert.equal(response.status, 200);
  await response.text();
  assert.equal((await message(token)).status, 401);
});
