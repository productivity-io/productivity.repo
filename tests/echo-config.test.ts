import assert from 'node:assert/strict';
import test from 'node:test';
import { getEchoWidgetConfig, resolvePortalEchoConfig } from '../server/services/echo.ts';

const enabled = {
  ECHO_CHAT_ENABLED: 'true', ECHO_SITE_ID: 'productivity-portal', ECHO_API_URL: 'https://echo.example.com/',
};

test('chat is disabled by default without requiring credentials or configuration', () => {
  assert.deepEqual(getEchoWidgetConfig({}), { enabled: false });
  assert.deepEqual(getEchoWidgetConfig({ ECHO_CHAT_ENABLED: 'false', ECHO_API_URL: 'invalid' }), { enabled: false });
});

test('public configuration contains only the site ID and API origin', () => {
  const config = getEchoWidgetConfig({ ...enabled, ECHO_MODEL_API_KEY: 'private-test-key', STUDENT_DATA: 'private' });
  assert.deepEqual(config, { enabled: true, siteId: 'productivity-portal', apiBaseUrl: 'https://echo.example.com' });
  assert.equal(JSON.stringify(config).includes('private'), false);
});

test('invalid public site identifiers are rejected', () => {
  for (const site of ['', '../school', 'UPPERCASE', 'a', 'school?key=secret']) {
    assert.throws(() => getEchoWidgetConfig({ ...enabled, ECHO_SITE_ID: site }));
  }
});

test('credentials, query strings, fragments, paths and non-HTTP APIs are rejected', () => {
  for (const url of ['javascript:alert(1)', 'https://user:pass@echo.example.com', 'https://echo.example.com?key=secret',
    'https://echo.example.com/#secret', 'https://echo.example.com/path', 'http://public.example.com']) {
    assert.throws(() => getEchoWidgetConfig({ ...enabled, ECHO_API_URL: url }));
  }
});

test('loopback HTTP is accepted only outside production', () => {
  assert.equal(getEchoWidgetConfig({ ...enabled, ECHO_API_URL: 'http://127.0.0.1:8765', NODE_ENV: 'test' }).enabled, true);
  assert.throws(() => getEchoWidgetConfig({ ...enabled, ECHO_API_URL: 'http://127.0.0.1:8765', NODE_ENV: 'production' }));
});

test('portal resolver enables built-in /api/echo service by default and respects explicit disable or external API', () => {
  assert.deepEqual(resolvePortalEchoConfig({}), {
    enabled: true,
    siteId: 'productivity-portal',
    apiBaseUrl: '/api/echo',
  });
  assert.deepEqual(resolvePortalEchoConfig({ ECHO_CHAT_ENABLED: 'false' }), { enabled: false });
  assert.deepEqual(
    resolvePortalEchoConfig({ ECHO_CHAT_ENABLED: 'true', ECHO_SITE_ID: 'productivity-portal', ECHO_API_URL: 'https://echo-api.example.com' }),
    { enabled: true, siteId: 'productivity-portal', apiBaseUrl: '/api/echo' }
  );
  assert.deepEqual(
    resolvePortalEchoConfig({ ECHO_CHAT_ENABLED: 'true', ECHO_SITE_ID: 'productivity-portal', ECHO_API_URL: 'https://live-echo.example.com/' }),
    { enabled: true, siteId: 'productivity-portal', apiBaseUrl: 'https://live-echo.example.com' }
  );
});
