import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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
const apiOrigin = `http://127.0.0.1:${apiPort}`;
const portalOrigin = `http://127.0.0.1:${previewPort}`;
const executablePath = process.env.ECHO_BROWSER || [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium', '/usr/bin/google-chrome',
].find(existsSync);
if (!executablePath) throw new Error('Set ECHO_BROWSER to an installed Chromium browser.');

const nodeExecutable = process.env.ECHO_NODE || [
  'C:\\Users\\Kaashi\\.codex\\visualizations\\2026\\11\\05\\01a1ab5e-ef71-7313-8c93-84cd805d4fe0\\node22\\node-v22.23.4-win-x64\\node.exe',
].find(existsSync) || process.execPath;

const sessions = new Map();
const traffic = [];
let abortedReplies = 0;
const echo = createServer(async (req, res) => {
  traffic.push({ path: req.url, headers: req.headers });
  res.setHeader('Access-Control-Allow-Origin', portalOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.url === '/v1/sites/productivity-portal/config') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ enabled_capabilities: ['chat'], branding: {
      name: 'ECHO', accent: '#1d4ed8', greeting: 'Ask me about portal navigation.',
    } }));
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  if (req.url === '/v1/sites/productivity-portal/sessions' && req.method === 'POST') {
    assert.deepEqual(JSON.parse(raw), {});
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, []);
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(201);
    return res.end(JSON.stringify({ session_token: token, expires_in: 1800 }));
  }
  const token = (req.headers.authorization || '').slice(7);
  const history = sessions.get(token);
  if (!history) { res.writeHead(401); return res.end('{}'); }
  if (req.method === 'DELETE') { sessions.delete(token); return res.end('{}'); }
  const { message } = JSON.parse(raw);
  assert.deepEqual(Object.keys(JSON.parse(raw)), ['message']);
  res.setHeader('Content-Type', 'text/event-stream');
  const reply = message === 'follow-up' ? `Previous: ${history.at(-1) || 'none'}` : `ECHO: ${message}`;
  history.push(message);
  res.write(`event: delta\ndata: ${JSON.stringify({ text: reply.slice(0, 6) })}\n\n`);
  let timer;
  res.on('close', () => { clearTimeout(timer); if (!res.writableEnded) abortedReplies++; });
  timer = setTimeout(() => {
    if (res.destroyed) return;
    res.write(`event: delta\ndata: ${JSON.stringify({ text: reply.slice(6) })}\n\n`);
    res.end('event: done\ndata: {"references":[]}\n\n');
  }, message === 'slow reply' ? 10000 : 200);
});

const children = [];
let browser;
let logs = '';
const dataDirectory = mkdtempSync(path.join(tmpdir(), 'productivity-echo-test-'));
function launch(args, cwd, env = {}) {
  const child = spawn(nodeExecutable, ['--max-semi-space-size=2', '--max-old-space-size=128', ...args], { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  children.push(child);
  return child;
}
async function ready(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try { const response = await fetch(url); if (response.ok) return response; } catch {}
    if (children.some(child => child.exitCode !== null)) throw new Error(logs);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('App startup timed out: ' + logs);
}
try {
  console.log('Starting ECHO mock...');
  await new Promise(resolve => echo.listen(0, '127.0.0.1', resolve));
  const echoUrl = `http://127.0.0.1:${echo.address().port}`;
  const env = { NODE_ENV: 'test', PORT: String(apiPort), ECHO_CHAT_ENABLED: 'true', ECHO_SITE_ID: 'productivity-portal', ECHO_API_URL: echoUrl };
  console.log('Launching server and preview...');
  launch(['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server/index.ts')], dataDirectory, env);
  launch([path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], root, { VERITAS_API_PROXY: apiOrigin });
  console.log('Waiting for api and preview ready...');
  const demo = await (await ready(apiOrigin + '/api/auth/demo-accounts')).json();
  await ready(portalOrigin + '/login');
  console.log('Servers ready. Demo accounts loaded:', demo.accounts.length);
  assert.equal((await fetch(apiOrigin + '/api/echo/config')).status, 401);
  const students = demo.accounts.filter(account => account.role === 'student');
  assert.ok(students.length >= 2);
  console.log('Launching browser...');
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: [
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--disable-extensions',
      '--disable-component-update',
      '--disable-default-apps',
      '--mute-audio',
      '--no-first-run',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  const portalRequests = [];
  page.on('pageerror', error => { console.log('Page error:', error.message); errors.push(error.message); });
  page.on('console', msg => { if (msg.type() === 'error') console.log('Page console error:', msg.text()); });
  page.on('response', res => { if (res.status() >= 400) console.log('HTTP ERROR:', res.url(), res.status()); });
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));
  page.on('request', request => { if (request.url().startsWith(portalOrigin + '/api/')) portalRequests.push(request); });
  console.log('Navigating to login...');
  await page.goto(portalOrigin + '/login');
  assert.equal(await page.locator('echo-chat-widget').count(), 0);
  async function login(account) {
    console.log('Filling login for:', account.username);
    await page.locator('#login-identifier').fill(account.username);
    await page.locator('#current-password').fill('password123');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    console.log('Waiting for dashboard navigation...');
    await page.waitForURL('**/dashboard');
    console.log('Dashboard loaded, waiting for launcher...');
    await page.locator('echo-chat-widget .launcher').waitFor();
    console.log('Launcher ready for:', account.username);
  }
  await login(students[0]);
  assert.equal(await page.locator('echo-chat-widget').count(), 1);
  const portalToken = await page.evaluate(() => localStorage.getItem('veritas_auth_token'));
  const widget = page.locator('echo-chat-widget');
  await widget.locator('.launcher').click();
  await page.waitForFunction(() => !document.querySelector('echo-chat-widget').shadowRoot.querySelector('textarea').disabled);
  async function send(text) {
    console.log('Sending chat text:', text);
    await widget.locator('textarea').fill(text);
    await widget.locator('.send').click();
    try {
      await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor({ timeout: 10000 });
    } catch (e) {
      console.log('Current status text:', await widget.locator('.status').textContent());
      console.log('Last assistant message:', await widget.locator('.assistant').last().textContent());
      throw e;
    }
  }
  await send('Where are assignments?');
  await send('follow-up');
  assert.match(await widget.locator('.assistant').last().textContent(), /Where are assignments/);
  const beforeCommands = traffic.length;
  const beforePortalRequests = portalRequests.length;
  await send('Open library');
  await page.waitForURL('**/library');
  await send('Search books for physics');
  await page.waitForURL('**/library?**');
  await page.getByPlaceholder('Search catalogue by title, author, ISBN, or subject category...').waitFor();
  assert.equal(await page.getByPlaceholder('Search catalogue by title, author, ISBN, or subject category...').inputValue(), 'physics');
  await send('Show issue history');
  assert.equal(new URL(page.url()).searchParams.get('echo_tab'), 'transactions');
  await send('open attendence portal');
  await page.waitForURL('**/attendance');
  assert.equal(new URL(page.url()).pathname, '/attendance');
  assert.match(await widget.locator('.assistant').last().textContent(), /Opening Attendance/);
  await send('show subject attendance');
  await page.waitForURL('**/attendance?**');
  assert.equal(new URL(page.url()).searchParams.get('echo_tab'), 'subject');
  await send('open attendance portal');
  await page.waitForURL('**/attendance');
  assert.equal(new URL(page.url()).pathname, '/attendance');
  await send('Open calendar');
  await page.waitForURL('**/calendar');
  await send('Show only sports events');
  await page.waitForURL('**/calendar?**');
  assert.equal(new URL(page.url()).searchParams.get('echo_category'), 'sports');
  assert.match(await page.getByRole('button', { name: 'sports', exact: true }).getAttribute('class'), /bg-slate-900/);
  await send('Show all');
  await page.waitForURL('**/calendar');
  await send('Open directory');
  assert.equal(new URL(page.url()).pathname, '/calendar');
  assert.match(await widget.locator('.assistant').last().textContent(), /not available/);
  await send('Open announcements');
  await page.waitForURL('**/announcements');
  await send('Show unread announcements');
  assert.equal(await page.getByLabel('Read status filter').inputValue(), 'unread');
  await send('Open timetable');
  await page.waitForURL('**/timetable');
  await send('Show Monday timetable');
  assert.equal(new URL(page.url()).searchParams.get('echo_day'), 'Monday');
  assert.equal(new URL(page.url()).searchParams.get('echo_view'), 'daily');
  await page.getByRole('button', { name: 'Monday', exact: true }).waitFor();
  assert.match(await page.getByRole('button', { name: 'Monday', exact: true }).getAttribute('class'), /bg-blue-700/);
  await send('Where am I?');
  assert.match(await widget.locator('.assistant').last().textContent(), /Timetable/);
  await send('Open calendar');
  await page.waitForURL('**/calendar');
  await send('Go back');
  await page.waitForURL('**/timetable?**');
  assert.equal(traffic.length, beforeCommands, 'Read-only commands must not call the remote conversation service.');
  assert.ok(portalRequests.slice(beforePortalRequests).every(request => request.method() === 'GET'), 'View commands must not mutate school records.');
  assert.equal(await page.locator('echo-chat-widget').count(), 1);
  await widget.locator('.close').click();
  await page.locator('a[href="/assignments"]').first().click();
  await page.waitForURL('**/assignments');
  assert.equal(await page.locator('echo-chat-widget').count(), 1);
  await widget.locator('.launcher').click();
  await widget.locator('textarea').fill('slow reply');
  await widget.locator('.send').click();
  await widget.locator('.status').filter({ hasText: 'Replying' }).waitFor();
  await widget.locator('.close').click();
  await page.locator('header').getByRole('button').filter({ hasText: students[0].fullName }).click();
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await page.waitForURL('**/login');
  await page.waitForFunction(() => !document.querySelector('echo-chat-widget'));
  await login(students[1]);
  await widget.locator('.launcher').click();
  await page.waitForFunction(() => !document.querySelector('echo-chat-widget').shadowRoot.querySelector('textarea').disabled);
  await send('follow-up');
  assert.match(await widget.locator('.assistant').last().textContent(), /none/);
  assert.equal(await page.locator('echo-chat-widget').count(), 1);
  assert.ok(abortedReplies >= 1);
  assert.ok(traffic.every(request => !JSON.stringify(request).includes(portalToken)));
  assert.ok(traffic.every(request => request.headers.cookie === undefined));
  assert.ok(traffic.every(request => !/student|schoolId|passwordHash/i.test(request.path)));
  assert.deepEqual(errors, []);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/echo-portal.png' });
  await page.route('**/api/echo/config', route => route.fulfill({ json: { enabled: false } }));
  const disabledConfig = page.waitForResponse(response => response.url().endsWith('/api/echo/config'));
  await page.reload();
  await disabledConfig;
  assert.equal(await page.locator('echo-chat-widget').count(), 0);
  console.log('PASS portal login, authenticated config, chat/context, page/search/filter/tab/day/back commands without writes or model calls, logout abort, account isolation and credential separation');
} finally {
  if (browser) await browser.close();
  for (const child of children) if (child.exitCode === null) child.kill();
  for (const child of children) await Promise.race([
    new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);
  echo.closeAllConnections();
  await new Promise(resolve => echo.close(resolve));
  if (path.dirname(dataDirectory) === path.resolve(tmpdir()) && path.basename(dataDirectory).startsWith('productivity-echo-test-')) {
    rmSync(dataDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
