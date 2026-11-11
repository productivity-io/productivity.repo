/**
 * End-to-end upload access test against a real server and real database.
 *
 * Verifies the old public `/uploads` mount is gone: anonymous reads are rejected, another student
 * gets 403, the uploader and staff get the file, and a legacy file with no registry row stays
 * private. Uses synthetic data in a temporary directory only.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const nodeExecutable = process.env.ECHO_NODE || process.execPath;

async function freePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}

const apiPort = await freePort();
const origin = `http://127.0.0.1:${apiPort}`;
const dataDirectory = mkdtempSync(path.join(tmpdir(), 'veritas-upload-'));
const children = [];
let logs = '';

function launch(args, env) {
  const child = spawn(nodeExecutable, args, {
    cwd: dataDirectory,
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
      if (response.ok) return;
    } catch {}
    if (children.some(child => child.exitCode !== null)) throw new Error('server exited: ' + logs.slice(-800));
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('startup timed out');
}

try {
  launch(['--import', pathToFileURL(path.join(root, 'node_modules/tsx/dist/loader.mjs')).href, path.join(root, 'server/index.ts')], {
    NODE_ENV: 'test',
    PORT: String(apiPort),
    VERITAS_DATA_DIR: path.join(dataDirectory, 'data'),
    VERITAS_UPLOAD_DIR: path.join(dataDirectory, 'uploads'),
    ECHO_SESSION_SECRET: randomBytes(32).toString('hex'),
    SESSION_SECRET: randomBytes(32).toString('hex'),
    OPENAI_API_KEY: '',
  });
  await ready(origin + '/api/health');

  async function login(identifier) {
    const response = await fetch(origin + '/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: 'password123' }),
    });
    assert.equal(response.status, 200, `login failed for ${identifier}`);
    const setCookie = (response.headers.getSetCookie?.() || []).find(value => value.startsWith('veritas_session='));
    assert.ok(setCookie, 'login must issue a session cookie');
    return setCookie.split(';')[0];
  }

  const demo = await (await fetch(origin + '/api/auth/demo-accounts')).json();
  const studentA = demo.accounts.find(account => account.role === 'student');
  const studentB = demo.accounts.filter(account => account.role === 'student')[1];
  const teacher = demo.accounts.find(account => account.role === 'teacher');
  assert.ok(studentA && studentB && teacher, 'need two students and a teacher');

  const cookieA = await login(studentA.username);
  const cookieB = await login(studentB.username);
  const cookieTeacher = await login(teacher.username);

  const form = new FormData();
  form.append('file', new Blob(['synthetic evidence file'], { type: 'text/plain' }), 'evidence.txt');
  form.append('folder', 'general');
  const uploadResponse = await fetch(origin + '/api/upload', { method: 'POST', headers: { Cookie: cookieA }, body: form });
  assert.equal(uploadResponse.status, 200, 'owner can upload');
  const uploaded = await uploadResponse.json();
  assert.match(uploaded.url, /^\/uploads\/general\//);

  const anonymous = await fetch(origin + uploaded.url, { redirect: 'manual' });
  assert.equal(anonymous.status, 401, 'anonymous reads are rejected');

  const otherStudent = await fetch(origin + uploaded.url, { headers: { Cookie: cookieB } });
  assert.equal(otherStudent.status, 403, 'another student is refused');

  const owner = await fetch(origin + uploaded.url, { headers: { Cookie: cookieA } });
  assert.equal(owner.status, 200, 'the uploader can read the file');
  assert.equal(await owner.text(), 'synthetic evidence file');

  const staff = await fetch(origin + uploaded.url, { headers: { Cookie: cookieTeacher } });
  assert.equal(staff.status, 200, 'staff can read the file');

  const legacy = await fetch(origin + '/uploads/circulars/term1-circular.pdf', { headers: { Cookie: cookieB } });
  assert.equal(legacy.status, 403, 'legacy unreferenced file stays private');
  const traversal = await fetch(origin + '/uploads/general/..%2f..%2fdata%2fveritas_school.db', { headers: { Cookie: cookieA } });
  assert.ok([400, 403, 404].includes(traversal.status), 'path traversal is refused');

  // Real restart proof: the running server must write ECHO state to SQLite, and that state must
  // survive process shutdown (a new connection is what a restart produces).
  const echoBase = origin + '/api/echo/v1/sites/productivity-portal';
  const echoSession = await fetch(echoBase + '/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA },
    body: '{}',
  });
  assert.equal(echoSession.status, 201, 'ECHO session created');
  const { session_token: echoToken } = await echoSession.json();
  const chat = await fetch(echoBase + '/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieA, Authorization: 'Bearer ' + echoToken },
    body: JSON.stringify({ message: 'open attendance', page: '/dashboard' }),
  });
  assert.equal(chat.status, 200, 'ECHO message answered');
  await chat.text();

  for (const child of children) { try { child.kill(); } catch {} }
  await Promise.all(children.map(child => new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve))));

  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(path.join(dataDirectory, 'data', 'veritas_school.db'));
  const row = database.prepare('SELECT history FROM echo_state ORDER BY updated_at DESC LIMIT 1').get();
  database.close();
  assert.ok(row, 'the running server persisted ECHO state to SQLite');
  assert.match(String(row.history), /open attendance/, 'conversation history survived shutdown');

  console.log('PASS upload access: anonymous 401, other student 403, owner 200, staff 200, legacy private, traversal refused (synthetic file only)');
  console.log('PASS restart persistence: ECHO history written by the server is on disk after shutdown');
} finally {
  for (const child of children) { try { child.kill(); } catch {} }
  try { rmSync(dataDirectory, { recursive: true, force: true }); } catch {}
}
