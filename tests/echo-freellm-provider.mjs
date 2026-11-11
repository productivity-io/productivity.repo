/**
 * Opt-in real-provider test: Veritas portal -> built-in ECHO -> FreeLLMAPI.
 *
 * The credential is read from FreeLLMAPI's own local store inside this process only when
 * ECHO_USE_DESKTOP_SETTINGS=true, and passed to the child server environment. It is never
 * printed, written to disk or sent to a browser. No school records are used; prompts and
 * expected answers are synthetic.
 *
 * Run after `npm run build`:
 *   ECHO_USE_DESKTOP_SETTINGS=true node tests/echo-freellm-provider.mjs
 */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = process.cwd();
const baseUrl = (process.env.FREELLMAPI_BASE_URL || process.env.FREELMAPI_BASE_URL || 'http://127.0.0.1:31415/v1').replace(/\/+$/, '');
const model = process.env.FREELLMAPI_MODEL || process.env.FREELMAPI_MODEL || 'auto:reliable';
const MARKER = 'PLUMAGE';
const CODE = 'QX-7319';

function loadCredential() {
  const fromEnv = process.env.FREELLMAPI_API_KEY || process.env.FREELMAPI_API_KEY;
  if (fromEnv) return fromEnv.trim();
  if (process.env.ECHO_USE_DESKTOP_SETTINGS !== 'true') return '';
  const script = [
    'import sqlite3, os',
    "p=os.path.join(os.environ['APPDATA'],'FreeLLMAPI','freeapi.db')",
    "con=sqlite3.connect('file:'+p+'?mode=ro', uri=True)",
    "row=con.execute(\"select value from settings where key='unified_api_key'\").fetchone()",
    "print((row[0] if row else '').strip())",
  ].join('\n');
  try {
    return execFileSync('python', ['-c', script], { encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return '';
  }
}

const key = loadCredential();
if (!key) {
  console.error('BLOCKED: FreeLLMAPI credential is not available in this process or its local store.');
  process.exit(2);
}

async function freePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
const apiPort = await freePort();
const previewPort = await freePort();
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const portalOrigin = `http://127.0.0.1:${previewPort}`;
const executablePath = process.env.ECHO_BROWSER || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);
if (!executablePath) {
  console.error('BLOCKED: no Chromium browser found; set ECHO_BROWSER.');
  process.exit(2);
}
if (!existsSync(path.join(root, 'dist', 'index.html'))) {
  console.error('BLOCKED: run npm run build before this provider test.');
  process.exit(2);
}

const dataDirectory = mkdtempSync(path.join(tmpdir(), 'productivity-echo-provider-'));
const children = [];
let logs = '';
let browser;
function launch(args, cwd, env) {
  const child = spawn(process.execPath, ['--max-semi-space-size=2', '--max-old-space-size=384', ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  children.push(child);
  return child;
}
async function ready(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    if (children.some(child => child.exitCode !== null)) throw new Error('Service exited during startup.');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Service startup timed out.');
}
async function parseSse(response) {
  const raw = await response.text();
  let text = '';
  let meta = null;
  let done = null;
  for (const block of raw.split('\n\n')) {
    const kind = block.split('\n').find(line => line.startsWith('event: '))?.slice(7);
    const line = block.split('\n').find(item => item.startsWith('data: '));
    if (!line) continue;
    const data = JSON.parse(line.slice(6));
    if (kind === 'delta') text += data.text;
    if (kind === 'meta') meta = data.provider;
    if (kind === 'done') done = data;
  }
  return { text, meta, done, raw };
}

const timings = [];
try {
  const probe = await fetch(`${baseUrl}/models`, { headers: { Authorization: `Bearer ${key}` } });
  assert.equal(probe.status, 200, 'FreeLLMAPI /v1/models must accept the local credential');
  const models = await probe.json();
  console.log(`FreeLLMAPI reachable: ${Array.isArray(models.data) ? models.data.length : 'unknown'} models visible`);

  launch(['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server/index.ts')], dataDirectory, {
    NODE_ENV: 'test',
    PORT: String(apiPort),
    VERITAS_DATA_DIR: path.join(dataDirectory, 'data'),
    OPENAI_API_KEY: '',
    ECHO_SESSION_SECRET: randomBytes(32).toString('hex'),
    ECHO_CHAT_ENABLED: 'true',
    ECHO_SITE_ID: 'productivity-portal',
    ECHO_PROVIDER_TIMEOUT_MS: '30000',
    FREELLMAPI_BASE_URL: baseUrl,
    FREELLMAPI_API_KEY: key,
    FREELLMAPI_MODEL: model,
    ECHO_API_URL: '',
  });
  launch([path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], root, {
    VERITAS_API_PROXY: apiOrigin,
  });
  await ready(apiOrigin + '/api/health');
  await ready(portalOrigin + '/login');

  const loginResponse = await fetch(apiOrigin + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'student1', password: 'password123' }),
  });
  assert.equal(loginResponse.status, 200);
  const login = await loginResponse.json();
  const cookie = (loginResponse.headers.getSetCookie?.() || []).find(value => value.startsWith('veritas_session='));
  assert.ok(cookie, 'portal login must issue an HttpOnly cookie');
  const portalCookie = { Cookie: cookie.split(';')[0] };
  const echoBase = apiOrigin + '/api/echo/v1/sites/productivity-portal';
  assert.equal((await fetch(apiOrigin + '/api/echo/provider')).status, 401, 'provider diagnostics require portal auth');

  const sessionResponse = await fetch(echoBase + '/sessions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...portalCookie }, body: '{}',
  });
  assert.equal(sessionResponse.status, 201);
  const { session_token: echoToken } = await sessionResponse.json();
  const headers = { 'Content-Type': 'application/json', ...portalCookie, Authorization: `Bearer ${echoToken}` };

  async function turn(message) {
    const started = Date.now();
    const response = await fetch(echoBase + '/messages', { method: 'POST', headers, body: JSON.stringify({ message, page: '/dashboard' }) });
    assert.equal(response.status, 200, 'ECHO message must succeed');
    const parsed = await parseSse(response);
    const elapsed = Date.now() - started;
    timings.push(elapsed);
    return { ...parsed, elapsed };
  }

  const first = await turn(`Please remember this synthetic code for our conversation: ${CODE}. Reply briefly.`);
  assert.ok(first.meta, 'SSE must identify the provider');
  assert.equal(first.meta.id, 'freellmapi', 'FreeLLMAPI must be the primary provider');
  assert.equal(first.meta.fallback, false);
  assert.ok(first.meta.route, 'FreeLLMAPI route (X-Routed-Via) must be reported');
  assert.ok(first.text.length > 0);

  const second = await turn('What code did I ask you to remember? Reply with just the code.');
  assert.equal(second.meta.id, 'freellmapi');
  assert.match(second.text, new RegExp(CODE), 'second turn must recall the first turn');

  // Read diagnostics while the last turn is still a plain model reply: later turns may legitimately
  // end in deterministic local guidance, which would change lastUsage.
  const diagnostic = await (await fetch(apiOrigin + '/api/echo/provider', { headers: portalCookie })).json();
  assert.equal(diagnostic.provider, 'freellmapi');
  assert.equal(diagnostic.configured, true);
  assert.equal(diagnostic.reachable, true);
  assert.equal(diagnostic.lastUsage.id, 'freellmapi');
  assert.equal(JSON.stringify(diagnostic).includes(key), false, 'diagnostics must never contain the key');

  // Real structured tool selection: the deterministic path answers a single module, so two modules
  // in one reply can only come from the model choosing and validating both tools.
  const routed = await turn('How is my attendance this term, and what assignments are due this week?');
  assert.match(routed.text, /% overall/, 'live routing must return the attendance tool\'s answer');
  assert.match(routed.text, /assignment|due/i, 'live routing must return the assignments tool\'s answer');
  assert.equal(routed.done?.action, undefined, 'routed answers do not navigate by themselves');
  assert.equal(routed.meta?.id, 'freellmapi', 'a routed turn is attributed to the live model, not local guidance');
  assert.equal(JSON.stringify(routed.raw).includes(key), false, 'the key never reaches the browser stream');

  // Indirect wording: one module word plus a second ask must still be routed.
  const indirect = await turn('I’ve been missing some morning classes and also need to know what work I owe this week.');
  assert.match(indirect.text, /% overall/, 'indirect wording must still reach attendance');
  assert.match(indirect.text, /assignment|due|owe/i, 'indirect wording must still reach assignments');

  // Another account's records may never be selected, whatever the model proposes.
  const unauthorized = await turn('Can you look up Aarav’s marks along with my attendance this term?');
  assert.ok(unauthorized.text.length > 0);
  assert.doesNotMatch(unauthorized.text, /\baarav\b[^\n]{0,60}\d{1,3}\s*%/i, 'no other student’s grades');
  assert.equal(JSON.stringify(unauthorized.raw).includes(key), false);

  // Browser path: portal login -> widget -> built-in ECHO -> FreeLLMAPI.
  browser = await chromium.launch({
    executablePath, headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--no-first-run'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(portalOrigin + '/login');
  await page.locator('#login-identifier').fill('student1');
  await page.locator('#current-password').fill('password123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const widget = page.locator('echo-chat-widget');
  await widget.locator('.launcher').waitFor();
  await widget.locator('.launcher').click();
  await page.waitForFunction(() => !document.querySelector('echo-chat-widget').shadowRoot.querySelector('textarea').disabled);
  await widget.locator('textarea').fill(`Write only the word ${MARKER}. Use no other words.`);
  await widget.locator('.send').click();
  await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor({ timeout: 45000 });
  const uiReply = await widget.locator('.assistant').last().textContent();
  assert.match(uiReply, new RegExp(MARKER, 'i'), 'the real model reply must reach the widget');
  assert.equal(await page.locator('echo-chat-widget').count(), 1);
  assert.deepEqual(errors, []);

  console.log(`routed multi-module reply: ${routed.text.replace(/\s+/g, ' ').slice(0, 180)}`);
  console.log(`indirect-wording reply:   ${indirect.text.replace(/\s+/g, ' ').slice(0, 180)}`);
  console.log(`unauthorized-account reply: ${unauthorized.text.replace(/\s+/g, ' ').slice(0, 180)}`);
  console.log(`PASS real FreeLLMAPI multi-turn: provider=${second.meta.id} model=${second.meta.model} route=${second.meta.route}`);
  console.log(`turn timings: ${timings.join('ms, ')}ms`);
  console.log(`browser marker "${MARKER}" received from the live model; synthetic code recalled on turn 2.`);
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const child of children) if (child.exitCode === null) child.kill();
  for (const child of children) await Promise.race([
    new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);
  if (path.dirname(dataDirectory) === path.resolve(tmpdir()) && path.basename(dataDirectory).startsWith('productivity-echo-provider-')) {
    rmSync(dataDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
