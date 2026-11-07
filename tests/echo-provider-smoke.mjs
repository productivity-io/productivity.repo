/** Opt-in portal -> real Python ECHO -> configured provider -> browser smoke test. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

if (!process.env.ECHO_SOURCE_ROOT) {
  console.error('BLOCKED: Set ECHO_SOURCE_ROOT and approved provider configuration. No provider fallback is used.');
  process.exit(2);
}
const root = process.cwd();
const temp = mkdtempSync(path.join(tmpdir(), 'echo-live-'));
const children = [];
let browser;
async function port() {
  const s = createServer();
  await new Promise(resolve => s.listen(0, '127.0.0.1', resolve));
  const p = s.address().port;
  await new Promise(resolve => s.close(resolve));
  return p;
}
function start(executable, args, cwd, env = {}) {
  const child = spawn(executable, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  // Never print subprocess logs, which could include private backend configuration.
  child.on('error', () => {});
  return child;
}
async function ready(url) {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(url); if (r.ok) return r; } catch {}
    assert.ok(children.every(c => c.exitCode === null), 'A smoke-test service stopped');
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('Smoke-test startup timeout');
}
try {
  const webPort = await port();
  const apiPort = await port();
  const web = `http://127.0.0.1:${webPort}`;
  const api = `http://127.0.0.1:${apiPort}`;
  const fixture = start(process.env.ECHO_PYTHON || 'python', [path.join(root, 'tests/echo-live-fixture.py'), web], root);
  const upstream = await new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error('Provider fixture startup timeout')), 15000);
    fixture.stdout.on('data', chunk => {
      buffer += chunk;
      const line = buffer.split('\n').find(line => line.startsWith('{'));
      if (line) { clearTimeout(timer); resolve(JSON.parse(line).apiOrigin); }
    });
    fixture.once('exit', () => { clearTimeout(timer); reject(new Error('Provider fixture unavailable')); });
  });
  const executablePath = process.env.ECHO_BROWSER || [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
  ].find(existsSync);
  assert.ok(executablePath, 'Configure an installed browser');
  start(process.env.ECHO_NODE || process.execPath,
    ['--max-semi-space-size=2', '--max-old-space-size=128', '--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server/index.ts')], temp,
    { NODE_ENV: 'test', PORT: String(apiPort), VERITAS_DATA_DIR: path.join(temp, 'data'), OPENAI_API_KEY: '', ECHO_CHAT_ENABLED: 'true', ECHO_SITE_ID: 'productivity-portal', ECHO_API_URL: upstream });
  start(process.execPath, ['--max-semi-space-size=2', '--max-old-space-size=128', path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], root, { VERITAS_API_PROXY: api });
  const demo = await (await ready(api + '/api/auth/demo-accounts')).json();
  await ready(web + '/login');
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking', '--disable-extensions', '--disable-component-update', '--no-first-run'] });
  const page = await browser.newPage();
  await page.goto(web + '/login');
  await page.locator('#login-identifier').fill(demo.accounts.find(a => a.role === 'student').username);
  await page.locator('#current-password').fill('password123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.waitForURL('**/dashboard');
  const widget = page.locator('echo-chat-widget');
  await widget.locator('.launcher').click();
  const marker = 'cedar-' + randomBytes(4).toString('hex');
  const evidence = [];
  for (const text of [`For this synthetic test only, remember the code ${marker}. Repeat just that code.`, 'What was the synthetic code I gave you in my previous message? Repeat only the code.']) {
    const began = Date.now();
    const done = page.waitForResponse(r => r.url() === upstream + '/v1/sites/productivity-portal/messages', { timeout: 45000 });
    await widget.locator('textarea').fill(text);
    await widget.locator('.send').click();
    const response = await done;
    const stream = await response.text();
    assert.equal(response.status(), 200);
    assert.match(stream, /event: done/);
    assert.doesNotMatch(stream, /event: error/);
    await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor({ timeout: 45000 });
    const answer = await widget.locator('.assistant').last().textContent();
    assert.ok(answer.includes(marker), 'Provider did not preserve synthetic conversation context');
    evidence.push({ http: response.status(), deltaEvents: (stream.match(/event: delta/g) || []).length, replyCharacters: answer.length, milliseconds: Date.now() - began });
  }
  // The same widget still handles an existing portal command after real conversation.
  await widget.locator('textarea').fill('open attendence portal');
  await widget.locator('.send').click();
  await page.waitForURL('**/attendance');
  await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor();
  assert.match(await widget.locator('.assistant').last().textContent(), /View confirmed/);
  console.log(JSON.stringify({ result: 'PASS', path: 'Veritas browser -> real external ECHO -> configured provider', mock: false, turns: evidence, attendanceCommand: 'PASS' }));
} catch {
  console.error('FAIL: Real-provider portal smoke did not complete. Private provider errors and responses were not logged.');
  process.exitCode = 1;
} finally {
  await browser?.close();
  for (const child of children) if (child.exitCode === null) child.kill();
  await Promise.all(children.map(child => new Promise(resolve => {
    if (child.exitCode !== null) return resolve();
    const timer = setTimeout(resolve, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  })));
  if (path.dirname(temp) === path.resolve(tmpdir()) && path.basename(temp).startsWith('echo-live-')) rmSync(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
