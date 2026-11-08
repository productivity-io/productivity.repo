import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isAllowedPortalOrigin,
  normalizeHttpOrigin,
} from '../server/utils/originPolicy.ts';
import {
  createSessionToken,
  sessionSecretIssue,
  verifySessionToken,
} from '../server/utils/auth.ts';

const dev = { NODE_ENV: 'test' } as const;
const prod = { NODE_ENV: 'production' } as const;

test('origin policy: same host and configured origins are allowed', () => {
  assert.equal(isAllowedPortalOrigin('https://portal.example.edu', 'portal.example.edu', prod), true);
  assert.equal(
    isAllowedPortalOrigin('https://portal.example.edu', 'internal:3001', {
      ...prod,
      APP_ORIGIN: 'https://portal.example.edu/',
    }),
    true
  );
  assert.equal(
    isAllowedPortalOrigin('https://preview-abc.vercel.app', 'internal:3001', {
      ...prod,
      VERCEL_URL: 'preview-abc.vercel.app',
    }),
    true
  );
  assert.equal(isAllowedPortalOrigin(undefined, 'portal.example.edu', prod), true);
});

test('origin policy: foreign, null, malformed and path origins are rejected', () => {
  for (const origin of [
    'https://attacker.example',
    'null',
    'file:///tmp/page.html',
    'https://portal.example.edu/path',
    'https://portal.example.edu/?next=evil',
    'https://user:pass@portal.example.edu',
  ]) {
    assert.equal(isAllowedPortalOrigin(origin, 'portal.example.edu', prod), false, origin);
  }
});

test('origin policy: loopback is development-only', () => {
  assert.equal(isAllowedPortalOrigin('http://127.0.0.1:5173', '127.0.0.1:3001', dev), true);
  assert.equal(
    isAllowedPortalOrigin('http://127.0.0.1:5173', '127.0.0.1:3001', prod),
    false
  );
  assert.equal(
    isAllowedPortalOrigin('http://127.0.0.1:5173', '127.0.0.1:3001', { VERCEL: '1' }),
    false
  );
});

test('origin normalization accepts only bare http(s) origins', () => {
  assert.equal(normalizeHttpOrigin('https://Portal.Example.edu/'), 'https://portal.example.edu');
  assert.equal(normalizeHttpOrigin('https://portal.example.edu/login'), null);
  assert.equal(normalizeHttpOrigin('javascript:alert(1)'), null);
});

test('session secret policy refuses public or missing production secrets', () => {
  assert.match(sessionSecretIssue({ ...prod }) || '', /required in production/);
  assert.match(sessionSecretIssue({ ...prod, SESSION_SECRET: 'short' }) || '', /at least 32/);
  assert.equal(sessionSecretIssue({ ...prod, SESSION_SECRET: 'x'.repeat(32) }), null);
  assert.equal(sessionSecretIssue({ NODE_ENV: 'test' }), null);
});

test('signed portal sessions verify and reject tampering', () => {
  const token = createSessionToken({ userId: 7, role: 'teacher', schoolId: 'TCH-7' });
  const payload = verifySessionToken(token);
  assert.equal(payload?.userId, 7);
  assert.equal(payload?.role, 'teacher');
  assert.equal(verifySessionToken(token + '.extra'), null);
  assert.equal(verifySessionToken(token.slice(0, -1)), null);
  assert.equal(verifySessionToken('not-a-token'), null);
});
