/**
 * Browser regression for model-assisted tool selection.
 *
 * The model is stubbed (this is not live-provider evidence): it returns a router JSON payload so the
 * real server, real session and real widget are exercised end to end. One multi-module question must
 * produce both modules' data and cards; one unauthorized tool request must be refused with no data.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const root = process.cwd();
async function freePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
const apiPort = await freePort();
const previewPort = await freePort();
const providerPort = await freePort();
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const portalOrigin = `http://127.0.0.1:${previewPort}`;
const providerOrigin = `http://127.0.0.1:${providerPort}`;

const executablePath = process.env.ECHO_BROWSER || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);
if (!executablePath) throw new Error('Set ECHO_BROWSER to an installed Chromium browser.');

const nodeExecutable = process.env.ECHO_NODE || process.execPath;
const children = [];
function launch(args, cwd, env = {}) {
  const child = spawn(nodeExecutable, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  children.push(child);
  return child;
}
async function ready(url, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    if (children.some(child => child.exitCode !== null)) throw new Error('server exited early');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('startup timed out: ' + url);
}

// Stubbed router model: returns an allowlisted pair, or an unknown tool for the Aarav request.
const provider = createServer(async (req, res) => {
  if (req.url === '/v1/models') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"data":[]}'); return; }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw || '{}');
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const user = String(messages.at(-1)?.content || '');
  const calls = /aarav/i.test(user)
    ? [{ tool: 'get_any_student_marks', args: { studentId: 7 } }]
    : [
        { tool: 'get_attendance', args: { focus: 'attendance' } },
        { tool: 'get_assignments', args: { focus: 'due this week' } },
      ];
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ model: 'stub-router', choices: [{ message: { content: JSON.stringify({ tool_calls: calls }) } }] }));
});
await new Promise(resolve => provider.listen(providerPort, '127.0.0.1', resolve));

const dataDirectory = mkdtempSync(path.join(tmpdir(), 'echo-tools-browser-'));
let browser;
try {
  launch(['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server/index.ts')], dataDirectory, {
    NODE_ENV: 'test',
    PORT: String(apiPort),
    VERITAS_DATA_DIR: path.join(dataDirectory, 'data'),
    ECHO_SESSION_SECRET: randomBytes(32).toString('hex'),
    ECHO_CHAT_ENABLED: 'true',
    ECHO_SITE_ID: 'productivity-portal',
    ECHO_PORTAL_TIMEZONE: 'UTC',
    FREELLMAPI_BASE_URL: providerOrigin + '/v1',
    FREELLMAPI_API_KEY: 'stub-key',
    OPENAI_API_KEY: '',
  });
  launch([path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], root, {
    VERITAS_API_PROXY: apiOrigin,
  });
  await ready(apiOrigin + '/api/health');
  await ready(portalOrigin + '/login');

  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--no-first-run'],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  await page.goto(portalOrigin + '/login');
  const demo = await (await fetch(apiOrigin + '/api/auth/demo-accounts')).json();
  const student = demo.accounts.find(account => account.role === 'student');
  await page.locator('#login-identifier').fill(student.username);
  await page.locator('#current-password').fill('password123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const widget = page.locator('echo-chat-widget');
  await widget.locator('.launcher').click();
  await page.waitForFunction(() => {
    const host = document.querySelector('echo-chat-widget');
    return host && !host.shadowRoot.querySelector('textarea').disabled;
  });

  async function send(text) {
    await widget.locator('textarea').fill(text);
    await widget.locator('.send').click();
    await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor({ timeout: 25000 });
  }

  await send('how is my attendance and what assignments are due this week?');
  const answer = await widget.locator('.assistant').last().textContent();
  assert.match(answer, /% overall/, 'attendance tool contributed to the answer');
  assert.match(answer, /assignment|due/i, 'assignments tool contributed to the answer');
  assert.ok(await widget.locator('.records .record').count() >= 2, 'both modules contributed cards');
  assert.equal(new URL(page.url()).pathname, '/dashboard', 'tool answers do not navigate by themselves');

  await send('can you tell me Aarav’s attendance and my assignments');
  const refused = await widget.locator('.assistant').last().textContent();
  assert.match(refused, /can only read/, 'an unknown tool is refused');
  assert.doesNotMatch(refused, /% overall/, 'the refusal contains no retrieved data');
  assert.equal(new URL(page.url()).pathname, '/dashboard');

  console.log('PASS model-assisted multi-module answer with cards, and an unauthorized tool request refused without data (stubbed router model, real server/session/widget)');
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const child of children) { try { child.kill(); } catch {} }
  await new Promise(resolve => provider.close(resolve));
  // Windows can still hold the SQLite file briefly; cleanup must not mask a test result.
  try { rmSync(dataDirectory, { recursive: true, force: true }); } catch {}
}
