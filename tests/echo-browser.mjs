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
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
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
  const { message, page } = JSON.parse(raw);
  assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['message', 'page']);
  assert.ok(typeof page === 'string' && page.startsWith('/'), 'page context must be a portal path');
  res.setHeader('Content-Type', 'text/event-stream');
  const lower = message.toLowerCase();
  // Mirrors the real service: the offer is prose only, and only the acceptance carries an action.
  const offers = {
    'where can i see my attendance': 'Attendance is in the Attendance module. If you want, say “open attendance” and I’ll take you there.',
    'okay take me there': 'Opening Attendance.',
  };
  const reply = message === 'follow-up' ? `Previous: ${history.at(-1) || 'none'}` : (offers[lower] || `ECHO: ${message}`);
  const action = lower === 'okay take me there'
    ? { type: 'navigate', path: '/attendance', label: 'Attendance', actionId: 'nav:attendance' }
    : null;
  // Authorized tool results arrive as structured records; the widget must render them as text-only cards.
  const records = lower === 'what all is actually found'
    ? [
        { id: 'lostfound-2', title: 'Navy Blue Veritas Varsity Blazer (Size M)', subtitle: 'Campus Amphitheatre', meta: ['4 Nov 2026', 'apparel'], status: 'unclaimed' },
        { id: 'lostfound-3', title: 'HydroFlask Water Bottle (Sage Green)', subtitle: '<img src=x onerror="window.__echoXss=1">Computing Suite 104 Corridor', meta: ['2 Nov 2026', 'accessories'], status: 'claim pending review' },
      ]
    : null;
  history.push(message);
  res.write(`event: delta\ndata: ${JSON.stringify({ text: reply.slice(0, 6) })}\n\n`);
  let timer;
  res.on('close', () => { clearTimeout(timer); if (!res.writableEnded) abortedReplies++; });
  timer = setTimeout(() => {
    if (res.destroyed) return;
    res.write(`event: delta\ndata: ${JSON.stringify({ text: reply.slice(6) })}\n\n`);
    res.end(`event: done\ndata: ${JSON.stringify({ references: records ? [{ title: 'Lost & Found' }] : [], action, records })}\n\n`);
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
  const env = { NODE_ENV: 'test', PORT: String(apiPort), VERITAS_DATA_DIR: path.join(dataDirectory, 'data'), OPENAI_API_KEY: '', ECHO_SESSION_SECRET: randomBytes(32).toString('hex'), ECHO_CHAT_ENABLED: 'true', ECHO_SITE_ID: 'productivity-portal', ECHO_API_URL: echoUrl };
  console.log('Launching server and preview...');
  launch(['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server/index.ts')], dataDirectory, env);
  launch([path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(previewPort), '--strictPort'], root, { VERITAS_API_PROXY: apiOrigin });
  console.log('Waiting for api and preview ready...');
  const demo = await (await ready(apiOrigin + '/api/auth/demo-accounts')).json();
  await ready(portalOrigin + '/login');
  console.log('Servers ready. Demo accounts loaded:', demo.accounts.length);
  assert.equal((await fetch(apiOrigin + '/api/echo/config')).status, 401);
  // Actual built-in engine (no provider key here): not the fake SSE service above.
  // Sessions are account-bound, so use a real demo portal login rather than an anonymous token.
  const builtIn = apiOrigin + '/api/echo/v1/sites/productivity-portal';
  const loginResponse = await fetch(apiOrigin + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'student1', password: 'password123' }),
  });
  const portalLogin = await loginResponse.json();
  assert.ok(portalLogin.token, 'demo portal login must issue a token');
  const portalCookie = (loginResponse.headers.getSetCookie?.() || []).find(value => value.startsWith('veritas_session='));
  assert.ok(portalCookie, 'portal login must set the HttpOnly session cookie');
  // Exactly how the browser widget authenticates: the ECHO bearer token plus the portal cookie.
  const portalAuth = { Cookie: portalCookie.split(';')[0] };
  assert.equal((await fetch(builtIn + '/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'anonymous ECHO sessions must be rejected');
  async function builtInSession() {
    const response = await fetch(builtIn + '/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json', ...portalAuth }, body: '{}' });
    const body = await response.text();
    if (!response.ok) console.log('ECHO built-in session status:', response.status, body);
    return JSON.parse(body).session_token;
  }
  async function builtInMessage(token, message) {
    const response = await fetch(builtIn + '/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', ...portalAuth, Authorization: 'Bearer ' + token }, body: JSON.stringify({ message, page: '/dashboard' }) });
    const raw = await response.text();
    const text = response.ok ? raw.split('\n\n').filter(block => block.startsWith('event: delta\n'))
      .map(block => JSON.parse(block.split('\ndata: ')[1]).text).join('') : raw;
    return { status: response.status, text, meta: raw };
  }
  const builtA = await builtInSession();
  const builtB = await builtInSession();
  assert.notEqual(builtA, builtB);
  assert.match((await builtInMessage(builtA, 'How do I apply for leave?')).text, /Leave Requests/);
  assert.match((await builtInMessage(builtA, 'more')).text, /review/);
  assert.match((await builtInMessage(builtB, 'more')).text, /which part/i);
  assert.match((await builtInMessage(builtB, 'how do i aply for leev')).text, /Leave Requests/);
  const fallbackMeta = (await builtInMessage(builtB, 'hello')).meta;
  assert.match(fallbackMeta, /event: meta/);
  assert.match(fallbackMeta, /local-guidance/);
  assert.doesNotMatch(fallbackMeta, /super-secret|api[_-]?key/i);
  // Real database, real session: the reported Lost & Found question must return actual seeded items.
  const builtC = await builtInSession();
  const lostFound = await builtInMessage(builtC, 'Can you read lost and found and answer me what all are actually found');
  assert.match(lostFound.text, /listed as found/);
  assert.match(lostFound.text, /Varsity Blazer|HydroFlask/);
  assert.doesNotMatch(lostFound.text, /Communication is for requesting/);
  assert.match(lostFound.meta, /"records"/);
  assert.doesNotMatch(lostFound.meta, /Grade 10-A|VEX Robotics sticker|reporterUserId|contactInfo/);
  assert.match((await builtInMessage(builtC, 'tell me more about the second one')).text, /HydroFlask/);
  console.log('PASS authorized Lost & Found retrieval, follow-up resolution and field redaction');
  await fetch(builtIn + '/sessions/current', { method: 'DELETE', headers: { ...portalAuth, Authorization: 'Bearer ' + builtA } });
  assert.equal((await builtInMessage(builtA, 'hello')).status, 401);
  assert.equal((await builtInMessage('invalid', 'hello')).status, 401);
  console.log('PASS account-bound built-in conversation, typo/follow-up handling, attribution and reset revocation');
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
  // Headless Chromium has no audible voice, so instrument the same browser speech API the widget uses.
  await page.addInitScript(() => {
    const state = { spoken: [], cancels: 0, active: 0, maxActive: 0, fail: false, current: null, timer: null, cancelCurrent: null };
    window.__echoSpeech = state;
    const fake = {
      get speaking() { return state.active > 0; },
      speak(utterance) {
        if (state.fail) { setTimeout(() => utterance.onerror?.({ error: 'synthesis-failed' }), 0); return; }
        state.active += 1;
        state.maxActive = Math.max(state.maxActive, state.active);
        state.spoken.push({ text: utterance.text, rate: utterance.rate });
        state.current = utterance;
        state.timer = setTimeout(() => {
          if (state.current !== utterance) return;
          state.current = null;
          state.active = Math.max(0, state.active - 1);
          utterance.onend?.();
        }, 900);
        state.cancelCurrent = () => {
          clearTimeout(state.timer);
          if (state.current !== utterance) return;
          state.current = null;
          state.active = Math.max(0, state.active - 1);
          utterance.onerror?.({ error: 'canceled' });
        };
      },
      cancel() { state.cancels += 1; state.cancelCurrent?.(); state.cancelCurrent = null; },
      getVoices() { return [{ name: 'Microsoft Aria Online (Natural)', lang: 'en-US', default: true, localService: true }]; },
      pause() {}, resume() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: fake });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; };
    // No headless microphone either: instrument the same recognition API the widget uses.
    const mic = { starts: 0, stops: 0, aborts: 0, ends: 0, running: false, continuous: null, lang: null, denied: false, target: null };
    window.__echoMic = mic;
    class FakeRecognition {
      constructor() { mic.target = this; }
      start() {
        if (mic.denied) { setTimeout(() => { this.onerror?.({ error: 'not-allowed' }); this.onend?.(); }, 0); return; }
        mic.starts += 1;
        mic.running = true;
        mic.continuous = this.continuous;
        mic.lang = this.lang;
        setTimeout(() => this.onstart?.(), 0);
      }
      stop() { mic.stops += 1; mic.running = false; setTimeout(() => this.onend?.(), 0); }
      abort() { mic.aborts += 1; mic.running = false; setTimeout(() => this.onend?.(), 0); }
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
    window.__echoHear = (text, { final = true } = {}) => {
      if (!mic.target) return false;
      const result = Object.assign([{ transcript: text, confidence: 0.92 }], { isFinal: final });
      mic.target.onresult?.({ resultIndex: 0, results: [result] });
      return true;
    };
  });
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
  // Tool records render as cards inside the same bubble, with every field written as text.
  await send('what all is actually found');
  assert.equal(await widget.locator('.records .record').count(), 2);
  assert.match(await widget.locator('.records').first().textContent(), /Varsity Blazer/);
  assert.match(await widget.locator('.records').first().textContent(), /unclaimed/);
  assert.match(await widget.locator('.records').last().textContent(), /Computing Suite 104 Corridor/);
  assert.equal(await widget.locator('.records img').count(), 0, 'record content must never become markup');
  assert.equal(await page.evaluate(() => window.__echoXss), undefined, 'record content must not execute');
  const beforeCommands = traffic.length;
  const beforePortalRequests = portalRequests.length;
  await send('Open library');
  await page.waitForURL('**/library');
  assert.match(await widget.locator('.assistant').last().textContent(), /View confirmed/);
  await widget.locator('.suggestions').getByRole('button', { name: 'Show issue history', exact: true }).waitFor();
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
  await send('What filters are selected?');
  assert.match(await widget.locator('.assistant').last().textContent(), /read: unread/);
  assert.equal(await page.getByLabel('Read status filter').inputValue(), 'unread');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: portalOrigin });
  await widget.locator('.assistant').last().getByRole('button', { name: 'Copy message' }).click();
  await widget.locator('.status').filter({ hasText: 'Message copied.' }).waitFor();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /read: unread/);
  // Clipboard failures are actionable and never reported as successful copies.
  await page.evaluate(() => { window.originalClipboardWrite = navigator.clipboard.writeText.bind(navigator.clipboard); navigator.clipboard.writeText = async () => { throw new Error('denied'); }; });
  await widget.locator('.assistant').last().getByRole('button', { name: 'Copy message' }).click();
  await widget.locator('.status').filter({ hasText: 'Clipboard unavailable' }).waitFor();
  await page.evaluate(() => { navigator.clipboard.writeText = window.originalClipboardWrite; });
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
  // New recognition uses only registered read-only controls and the existing confirmation path.
  await send('opn attendence');
  await page.waitForURL('**/attendance');
  await send('tak me to dashbord');
  await page.waitForURL('**/dashboard');
  await send('go to calender');
  await page.waitForURL('**/calendar');
  await send('shwo only sprts');
  assert.equal(new URL(page.url()).searchParams.get('echo_category'), 'sports');
  assert.match(await page.getByRole('button', { name: 'sports', exact: true }).getAttribute('class'), /bg-slate-900/);
  await send('opn atendnce');
  assert.equal(new URL(page.url()).pathname, '/calendar', 'medium confidence must not navigate');
  assert.match(await widget.locator('.assistant').last().textContent(), /Did you mean/);
  await send('no');
  assert.equal(new URL(page.url()).pathname, '/calendar');
  await send('opn atendnce');
  await send('yes');
  await page.waitForURL('**/attendance');
  assert.match(await widget.locator('.assistant').last().textContent(), /View confirmed/);
  await send('open calendar or timetable');
  assert.equal(new URL(page.url()).pathname, '/attendance');
  await send('yes');
  assert.equal(new URL(page.url()).pathname, '/attendance', 'ambiguous yes cannot choose a route');
  await send('2');
  await page.waitForURL('**/timetable');
  await send('opn calender then shwo sprts events');
  await page.waitForURL('**/calendar?**');
  assert.equal(new URL(page.url()).searchParams.get('echo_category'), 'sports');
  await send('open attendance then show maths');
  assert.equal(new URL(page.url()).pathname, '/calendar', 'unsupported compound must not partially execute');
  await send('opn studnts');
  assert.equal(new URL(page.url()).pathname, '/calendar');
  await send('i wana see my marks');
  await page.waitForURL('**/examinations');
  await page.getByRole('region', { name: 'Subject-wise marks table' }).waitFor();
  await send('opn hw');
  await page.waitForURL('**/assignments');
  const maths = page.getByRole('button', { name: 'Advanced Mathematics', exact: true });
  await maths.waitFor();
  await send('shwo only maths');
  assert.ok(new URL(page.url()).searchParams.get('echo_subject'));
  assert.match(await maths.getAttribute('class'), /bg-blue-700/);
  const subjectBadges = page.locator('span').filter({ hasText: /^[A-Z0-9-]+\s*•\s*/ });
  assert.ok(await subjectBadges.count() > 0, 'Mathematics filter must render actual assignment cards');
  for (const badge of await subjectBadges.allTextContents()) assert.match(badge, /Mathematics/);
  await send('show overdue assignments');
  const selectedMath = new URL(page.url()).searchParams.get('echo_subject');
  assert.equal(new URL(page.url()).searchParams.get('echo_status'), 'overdue');
  assert.ok(selectedMath, 'existing subject selection must survive another view filter');
  await send('clear filters');
  assert.equal(new URL(page.url()).searchParams.get('echo_subject'), null);
  assert.equal(traffic.length, beforeCommands, 'Read-only commands must not call the remote conversation service.');
  assert.ok(portalRequests.slice(beforePortalRequests).every(request => request.method() === 'GET'), 'View commands must not mutate school records.');
  assert.equal(await page.locator('echo-chat-widget').count(), 1);
  // A server reply may only offer a route; accepting it must move the real router and be verified.
  await send('Open dashboard');
  await page.waitForURL('**/dashboard');
  await send('where can i see my attendance');
  assert.equal(new URL(page.url()).pathname, '/dashboard', 'an offer alone must not navigate');
  assert.match(await widget.locator('.assistant').last().textContent(), /take you there/i);
  await send('okay take me there');
  await page.waitForURL('**/attendance');
  assert.equal(new URL(page.url()).pathname, '/attendance');
  assert.match(await widget.locator('.assistant').last().textContent(), /You’re now on Attendance/);
  // An unobserved route change must never be reported as a successful navigation.
  await send('Open dashboard');
  await page.waitForURL('**/dashboard');
  await page.evaluate(() => {
    const original = history.pushState.bind(history);
    window.restoreEchoActionPushState = () => { history.pushState = original; };
    history.pushState = (state, unused) => original(state, unused, '/dashboard');
  });
  await send('okay take me there');
  assert.match(await widget.locator('.assistant').last().textContent(), /could not confirm/);
  await page.evaluate(() => window.restoreEchoActionPushState());
  await send('Open assignments');
  await page.waitForURL('**/assignments');
  await send('opn atendnce');
  await widget.getByRole('button', { name: 'New chat', exact: true }).click();
  await widget.locator('.status').filter({ hasText: 'New conversation.' }).waitFor();
  await send('yes');
  assert.equal(new URL(page.url()).pathname, '/assignments', 'reset must discard pending navigation');
  await send('Can you explain attendance rules?');
  assert.equal(new URL(page.url()).pathname, '/assignments', 'normal question must remain AI chat');
  assert.match(await widget.locator('.assistant').last().textContent(), /ECHO: Can you explain/);
  await send('opn atendnce');
  await widget.locator('.close').click();
  await page.locator('a[href="/library"]').first().click();
  await page.waitForURL('**/library');
  await page.locator('a[href="/assignments"]').first().click();
  await page.waitForURL('**/assignments');
  await maths.waitFor();
  await widget.locator('.launcher').click();
  await send('yes');
  assert.equal(new URL(page.url()).pathname, '/assignments', 'navigating away and back must discard old confirmation');
  await send('Switch academic year to 2025-2026');
  assert.match(await widget.locator('.assistant').last().textContent(), /Selected academic year 2025-2026/);
  // Force an observed URL mismatch to exercise honest failure feedback in-browser.
  await page.evaluate(() => {
    const original = history.pushState.bind(history);
    window.restoreEchoPushState = () => { history.pushState = original; };
    history.pushState = (state, unused, url) => original(state, unused, '/dashboard');
  });
  await send('Open library');
  assert.match(await widget.locator('.assistant').last().textContent(), /could not confirm/);
  await page.evaluate(() => window.restoreEchoPushState());
  await send('Open timetable');
  await page.waitForURL('**/timetable');
  await widget.locator('.close').click();
  await page.locator('a[href="/assignments"]').first().click();
  await page.waitForURL('**/assignments');
  assert.equal(await page.locator('echo-chat-widget').count(), 1);
  await widget.locator('.launcher').click();
  // Stop aborts the stream and starts subsequent conversation on a new token.
  await widget.locator('textarea').fill('slow reply');
  await widget.locator('.send').click();
  await widget.locator('.status').filter({ hasText: 'Replying' }).waitFor();
  await widget.getByRole('button', { name: 'Stop', exact: true }).click();
  await widget.locator('.status').filter({ hasText: 'Reply stopped.' }).waitFor();
  assert.equal(await widget.locator('.send').isEnabled(), true);
  await send('follow-up');
  assert.match(await widget.locator('.assistant').last().textContent(), /none/);
  await widget.getByRole('button', { name: 'New chat', exact: true }).click();
  await widget.locator('.status').filter({ hasText: 'New conversation.' }).waitFor();
  assert.equal(await widget.locator('.user').count(), 0);
  await send('follow-up');
  assert.match(await widget.locator('.assistant').last().textContent(), /none/);
  // Recover from transport failure without replaying a message automatically.
  await page.route('**/v1/sites/productivity-portal/messages', route => route.fulfill({ status: 503, json: { error: 'Test service unavailable.' } }));
  await widget.locator('textarea').fill('test failure');
  await widget.locator('.send').click();
  await widget.locator('.status').filter({ hasText: 'Test service unavailable.' }).waitFor();
  assert.equal(await widget.locator('.send').isEnabled(), true);
  await page.unroute('**/v1/sites/productivity-portal/messages');
  await send('Hello again');
  // ---------- Optional spoken replies ----------
  const speechState = () => page.evaluate(() => window.__echoSpeech);
  assert.equal(await widget.locator('.voice').getAttribute('aria-pressed'), 'false', 'voice starts off');
  assert.equal((await speechState()).spoken.length, 0, 'greeting and text replies are silent while voice is off');
  await widget.locator('.voice').click();
  assert.equal(await widget.locator('.voice').getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => window.__echoSpeech.spoken.length >= 1);
  assert.match((await speechState()).spoken[0].text, /Voice replies are on/);
  await widget.locator('.rate').selectOption('1.25');
  await send('The courtyard is quiet today. Soft rain falls on the stones.');
  await page.waitForFunction(() => window.__echoSpeech.spoken.some(item => item.text.includes('courtyard is quiet')));
  const spokenReply = (await speechState()).spoken.filter(item => item.text.includes('courtyard is quiet'));
  assert.ok(spokenReply.length >= 1, 'assistant reply is spoken');
  assert.ok(spokenReply.every(item => item.rate === 1.25), 'selected speed is applied');
  assert.ok((await speechState()).maxActive <= 1, 'utterances never overlap');
  const cancelsBeforeStop = (await speechState()).cancels;
  await widget.locator('.stop').click();
  await page.waitForFunction(count => window.__echoSpeech.cancels > count, cancelsBeforeStop);
  assert.equal(await widget.locator('.stop').isHidden(), true, 'Stop disappears after audio is cancelled');
  await send('Spoken again. Two sentences.');
  const cancelsBeforeReset = (await speechState()).cancels;
  await widget.getByRole('button', { name: 'New chat', exact: true }).click();
  await widget.locator('.status').filter({ hasText: 'New conversation.' }).waitFor();
  assert.ok((await speechState()).cancels > cancelsBeforeReset, 'new chat stops speech');
  await widget.locator('.voice').click();
  assert.equal(await widget.locator('.voice').getAttribute('aria-pressed'), 'false');
  const silentCount = (await speechState()).spoken.length;
  await send('This reply should be silent.');
  assert.equal((await speechState()).spoken.length, silentCount, 'voice off produces no audio');
  // ---------- Optional voice input: one-shot dictation and the "Echo" wake word ----------
  const micState = () => page.evaluate(() => window.__echoMic);
  const hear = (text, options = {}) => page.evaluate(([spoken, opts]) => window.__echoHear(spoken, opts), [text, options]);
  assert.equal(await widget.locator('.mic').isVisible(), true, 'microphone control is offered when the browser has a recognizer');
  assert.equal(await widget.locator('.mic').getAttribute('aria-pressed'), 'false');
  const usersBeforeSpeech = await widget.locator('.user').count();
  await widget.locator('.mic').click();
  await page.waitForFunction(() => window.__echoMic.starts >= 1);
  await widget.locator('.status').filter({ hasText: 'Listening…' }).waitFor();
  assert.equal(await widget.locator('.mic').getAttribute('aria-pressed'), 'true', 'listening is announced in the controls');
  await hear('Show att', { final: false });
  await widget.locator('.status').filter({ hasText: 'Show att' }).waitFor();
  assert.equal(await widget.locator('.user').count(), usersBeforeSpeech, 'interim speech is never submitted');
  await hear('Open attendance');
  await page.waitForURL('**/attendance');
  await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor();
  assert.match(await widget.locator('.assistant').last().textContent(), /View confirmed/, 'a spoken command runs the same verified navigation');
  assert.equal(await widget.locator('.mic').getAttribute('aria-pressed'), 'false', 'one dictation stops the microphone');
  assert.ok((await micState()).stops + (await micState()).aborts >= 1);
  // Denied permission must be explained, never swallowed, and must not break typing.
  await page.evaluate(() => { window.__echoMic.denied = true; });
  await widget.locator('.mic').click();
  await widget.locator('.status').filter({ hasText: /permission was denied/ }).waitFor();
  assert.equal(await widget.locator('.mic').getAttribute('aria-pressed'), 'false');
  await page.evaluate(() => { window.__echoMic.denied = false; });
  await send('Text still works after a denied microphone.');
  assert.match(await widget.locator('.assistant').last().textContent(), /ECHO: Text still works after a denied microphone/);
  // Stop is available while listening and releases the microphone.
  await widget.locator('.mic').click();
  await page.waitForFunction(() => window.__echoMic.running === true);
  assert.equal(await widget.getByRole('button', { name: 'Stop', exact: true }).isVisible(), true, 'Stop is offered while listening');
  const abortsBeforeStop = (await micState()).aborts;
  await widget.getByRole('button', { name: 'Stop', exact: true }).click();
  await page.waitForFunction(count => window.__echoMic.aborts > count, abortsBeforeStop);
  await widget.locator('.status').filter({ hasText: 'Voice input off.' }).waitFor();
  assert.equal(await widget.locator('.mic').getAttribute('aria-pressed'), 'false');
  // Wake word: continuous mode acts only on utterances that start with "Echo".
  await widget.locator('.wake').check();
  await widget.locator('.status').filter({ hasText: /Listening for “Echo”/ }).waitFor();
  assert.equal((await micState()).continuous, true, 'wake mode keeps one continuous stream');
  const usersBeforeIgnored = await widget.locator('.user').count();
  const startsBeforeIgnored = (await micState()).starts;
  await hear('open library');
  await page.waitForTimeout(500);
  assert.equal(await widget.locator('.user').count(), usersBeforeIgnored, 'speech without the wake word is ignored');
  assert.equal((await micState()).starts, startsBeforeIgnored, 'ignored speech never restarts the stream');
  await hear('Echo, open library');
  await page.waitForURL('**/library');
  await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor();
  assert.match(await widget.locator('.assistant').last().textContent(), /View confirmed/, 'the wake word hands the rest of the sentence to the same command path');
  assert.equal(await widget.locator('.wake').isChecked(), true, 'wake mode stays armed after a command');
  // Waiting for the wake word must not display what other people in the room said.
  await hear('what is the library policy', { final: false });
  await page.waitForTimeout(250);
  assert.doesNotMatch(await widget.locator('.status').textContent(), /library policy/, 'room speech is not shown while waiting for the wake word');
  // ECHO must not transcribe its own voice: recognition pauses while it speaks and resumes after.
  const abortsBeforeSpeaking = (await micState()).aborts;
  await widget.locator('.voice').click();
  await page.waitForFunction(count => window.__echoMic.aborts > count, abortsBeforeSpeaking);
  assert.equal((await micState()).running, false, 'the microphone is released while ECHO speaks');
  await page.waitForFunction(() => window.__echoMic.running === true, null, { timeout: 8000 });
  assert.equal(await widget.locator('.voice').getAttribute('aria-pressed'), 'true');
  await widget.locator('.voice').click();
  // A new conversation must release the microphone as well as the session.
  await widget.getByRole('button', { name: 'New chat', exact: true }).click();
  await widget.locator('.status').filter({ hasText: 'New conversation.' }).waitFor();
  assert.equal(await widget.locator('.wake').isChecked(), false, 'a new conversation releases the microphone');
  assert.equal(await widget.locator('.mic').getAttribute('aria-pressed'), 'false');
  await widget.locator('.wake').check();
  await widget.locator('.status').filter({ hasText: /Listening for “Echo”/ }).waitFor();
  await widget.locator('.wake').uncheck();
  await widget.locator('.status').filter({ hasText: 'Wake word off.' }).waitFor();
  const startsAfterDisarm = (await micState()).starts;
  await page.waitForTimeout(700);
  assert.equal((await micState()).starts, startsAfterDisarm, 'turning wake mode off stops re-arming the recognizer');
  // ---------- Expandable / full-screen workspace ----------
  const compactBox = await widget.locator('.panel').boundingBox();
  const assistantCount = await widget.locator('.assistant').count();
  const routeBeforeResize = new URL(page.url()).pathname;
  await widget.getByRole('button', { name: 'Expand chat', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('echo-chat-widget').dataset.mode === 'expanded');
  const expandedBox = await widget.locator('.panel').boundingBox();
  assert.ok(expandedBox.width > compactBox.width, 'expanded mode widens the panel');
  assert.equal(await widget.locator('.assistant').count(), assistantCount, 'expanding preserves the conversation');
  await widget.getByRole('button', { name: 'Full screen', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('echo-chat-widget').dataset.mode === 'full');
  const fullBox = await widget.locator('.panel').boundingBox();
  assert.ok(fullBox.width >= 1200 && fullBox.height >= 800, 'full screen fills the viewport');
  assert.equal(new URL(page.url()).pathname, routeBeforeResize, 'resizing never navigates');
  await widget.getByRole('button', { name: 'Restore size', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('echo-chat-widget').dataset.mode === 'compact');
  assert.ok((await widget.locator('.panel').boundingBox()).width <= 400, 'restore returns to compact');
  assert.equal(await widget.locator('.assistant').count(), assistantCount, 'restoring preserves the conversation');
  // Suggestions remain usable and inside the viewport on mobile.
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await widget.locator('.panel').boundingBox();
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await widget.locator('.suggestions').getByRole('button', { name: 'Help with this page', exact: true }).click();
  await widget.locator('.status').filter({ hasText: 'Ready.' }).waitFor();
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/echo-mobile.png' });
  await page.setViewportSize({ width: 1280, height: 850 });
  // ---------- Real built-in engine: unexplained follow-up actually moves the router ----------
  // Point the same widget at the portal's own authenticated ECHO service (cookie session), so
  // this exercises the shipped pending-offer lifecycle rather than the fake transport above.
  await page.route('**/api/echo/config', route => route.fulfill({ json: { enabled: true, siteId: 'productivity-portal', apiBaseUrl: '/api/echo' } }));
  await page.reload();
  await widget.locator('.launcher').waitFor();
  await widget.locator('.launcher').click();
  await page.waitForFunction(() => {
    const host = document.querySelector('echo-chat-widget');
    return host && !host.shadowRoot.querySelector('textarea').disabled;
  });
  const beforeRealEngine = new URL(page.url()).pathname;
  const trafficBeforeRealEngine = traffic.length;
  await send('Where can I see my attendance?');
  assert.equal(new URL(page.url()).pathname, beforeRealEngine, 'the offer itself must not navigate');
  assert.match(await widget.locator('.assistant').last().textContent(), /Attendance/);
  await send('okay take me there');
  await page.waitForURL('**/attendance');
  assert.equal(new URL(page.url()).pathname, '/attendance', 'accepted offer must change the real route');
  assert.match(await widget.locator('.assistant').last().textContent(), /You’re now on Attendance/);
  assert.equal(traffic.length, trafficBeforeRealEngine, 'the built-in engine, not the mock transport, served this flow');
  await page.unroute('**/api/echo/config');
  // Restore the mock-backed widget for the remaining stop/reset/speech checks.
  await page.reload();
  await widget.locator('.launcher').waitFor();
  await widget.locator('.launcher').click();
  await page.waitForFunction(() => {
    const host = document.querySelector('echo-chat-widget');
    return host && !host.shadowRoot.querySelector('textarea').disabled;
  });
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
  // Speech failure must never take text chat down.
  await widget.locator('.voice').click();
  await page.evaluate(() => { window.__echoSpeech.fail = true; });
  await send('Text survives speech failure.');
  assert.match(await widget.locator('.assistant').last().textContent(), /ECHO: Text survives speech failure/);
  await widget.locator('.voice-note').filter({ hasText: /Voice isn't available/ }).waitFor();
  assert.equal(await widget.locator('.voice').isDisabled(), true);
  await page.evaluate(() => { window.__echoSpeech.fail = false; });
  // A browser without any recognizer gets an honest widget instead of a dead control.
  await page.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  await page.reload();
  await widget.locator('.launcher').waitFor();
  await widget.locator('.launcher').click();
  await page.waitForFunction(() => {
    const host = document.querySelector('echo-chat-widget');
    return host && !host.shadowRoot.querySelector('textarea').disabled;
  });
  assert.equal(await widget.locator('.mic').isVisible(), false, 'no microphone control without a recognizer');
  assert.equal(await widget.locator('.wake-label').isVisible(), false, 'no wake word control without a recognizer');
  await send('Text works without voice input.');
  assert.match(await widget.locator('.assistant').last().textContent(), /ECHO: Text works without voice input/);
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
  console.log('PASS portal commands, verified feedback/failure, contextual help/suggestions, clipboard success/failure, stop/reset/error recovery, optional speech (on/off, speed, cancel, overlap, failure fallback), optional voice input (dictation, interim results, permission denial, Stop, Echo wake word, TTS pause/resume, unsupported browser), display modes, mobile, logout abort and account isolation, tool record cards rendered as text-only, plus real-database Lost & Found retrieval, follow-up resolution and field redaction through the built-in engine; mock SSE for command flows, simulated recognizer/voice (not real audio or provider evidence)');
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
