import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEchoReply,
  echoProviderStatus,
  generateProviderReply,
  getEchoProviderConfig,
} from '../server/services/echoConversation.ts';

const student = { name: 'Aarav', role: 'student' as const };
const staff = { name: 'Marcus', role: 'coordinator' as const };

test('greeting is warm, concise, personalised and page-aware', () => {
  const reply = buildEchoReply('hi', [], { ...student, page: '/dashboard' });
  assert.match(reply.text, /^Hey Aarav/);
  assert.match(reply.text, /Dashboard/);
  assert.doesNotMatch(reply.text, /I am ECHO, your Veritas portal assistant/);
  assert.ok(reply.text.length < 240);
});

test('commonly mistyped greetings are understood', () => {
  assert.match(buildEchoReply('helo', [], student).text, /^Hey Aarav/);
  assert.match(buildEchoReply('hii echo', [], student).text, /^Hey Aarav/);
});

test('typo-heavy and incomplete questions resolve to the right topic', () => {
  const reply = buildEchoReply('how do i aply for leev', [], student);
  assert.match(reply.text, /Leave Requests/);
  assert.match(reply.text, /open leave requests/);
  assert.equal(reply.references[0].title, 'Leave requests');
});

test('follow-up questions use the previous topic without pretending to remember more', () => {
  const history = [{ user: 'how do I apply for leave?', assistant: 'Leave Requests is where you apply...' }];
  const reply = buildEchoReply('more', history, student);
  assert.match(reply.text, /Leave Requests/);
  assert.match(reply.text, /review/);
  assert.doesNotMatch(reply.text, /Following up on/);
});

test('a new "what about" topic switches context instead of repeating the old one', () => {
  const history = [{ user: 'how do I apply for leave?', assistant: 'Leave Requests...' }];
  const reply = buildEchoReply('what about the libary', history, student);
  assert.match(reply.text, /Library/);
  assert.doesNotMatch(reply.text, /Leave Requests/);
});

test('a follow-up without any prior topic asks a useful clarifying question', () => {
  const reply = buildEchoReply('tell me more', [], student);
  assert.match(reply.text, /which part/i);
});

test('current-page help names the page and its real controls', () => {
  const reply = buildEchoReply('what can i do here', [], { ...student, page: '/library' });
  assert.match(reply.text, /Library page/);
  assert.match(reply.text, /catalogue|issue history/i);
});

test('personal-record questions never imply ECHO can read private data', () => {
  const reply = buildEchoReply('whats my attendance', [], student);
  assert.match(reply.text, /Attendance/);
  assert.match(reply.text, /can’t read your personal record/);
});

test('record-changing requests are refused clearly and without action language', () => {
  const reply = buildEchoReply('can you change my marks', [], student);
  assert.match(reply.text, /can’t change/);
  assert.doesNotMatch(reply.text, /I(?:'ve| have) (?:opened|changed|updated)|Done[,.]/);
});

test('unknown questions are admitted instead of invented', () => {
  const reply = buildEchoReply('what is on the cafeteria menu today', [], student);
  assert.match(reply.text, /not sure/i);
  assert.doesNotMatch(reply.text, /pasta|sandwich|curry|menu includes/i);
});

test('normal conversational statements get empathy rather than a canned module dump', () => {
  const reply = buildEchoReply('im really nervous about my exams', [], student);
  assert.match(reply.text, /That sounds like a lot, Aarav/);
  assert.match(reply.text, /urgent/i);
  assert.doesNotMatch(reply.text, /Quick Commands/);
});

test('light conversation is supported alongside portal help', () => {
  const reply = buildEchoReply('tell me a joke', [], student);
  assert.ok(reply.text.length > 20);
  assert.equal(reply.references[0].title, 'ECHO');
});

test('no cross-session memory is claimed', () => {
  const reply = buildEchoReply('what did i tell you yesterday', [], student);
  assert.match(reply.text, /current conversation/i);
  assert.match(reply.text, /don’t remember past sessions/i);
});

test('a repeated greeting acknowledges the ongoing conversation', () => {
  const reply = buildEchoReply('hi again', [{ user: 'hello', assistant: 'Hey Aarav!' }], student);
  assert.match(reply.text, /Hey again, Aarav/);
});

test('unmatched portal commands state that nothing changed', () => {
  const reply = buildEchoReply('open a portal page that does not exist', [], student);
  assert.match(reply.text, /nothing changed/i);
  assert.doesNotMatch(reply.text, /Opening /);
});

test('capabilities are tailored by role', () => {
  const studentReply = buildEchoReply('what can you do', [], student);
  const staffReply = buildEchoReply('what can you do', [], staff);
  assert.match(studentReply.text, /marks/);
  assert.match(staffReply.text, /directory/);
  assert.match(staffReply.text, /reports/);
});

test('the same input produces a stable reply', () => {
  const first = buildEchoReply('tell me about transport', [], student);
  const second = buildEchoReply('tell me about transport', [], student);
  assert.deepEqual(first, second);
});

test('overlong input is declined without processing', () => {
  const reply = buildEchoReply('a'.repeat(4001), [], student);
  assert.match(reply.text, /long/);
});

test('ordinary conversation with no history still ends helpfully', () => {
  const reply = buildEchoReply('i have three classes today', [], student);
  assert.match(reply.text, /Got it/);
  assert.ok(reply.text.length < 260);
});

test('provider generation is skipped when no provider is configured', async () => {
  const names = ['OPENAI_API_KEY', 'ECHO_MODEL_BASE_URL', 'ECHO_MODEL_API_KEY', 'FREELLMAPI_BASE_URL', 'FREELLMAPI_API_KEY', 'FREELLMAPI_MODEL', 'FREELMAPI_BASE_URL', 'FREELMAPI_API_KEY', 'FREELMAPI_MODEL'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  for (const name of names) delete process.env[name];
  try {
    const reply = await generateProviderReply('hello', [], student, new AbortController().signal);
    assert.equal(reply, null);
    assert.equal(getEchoProviderConfig(), null);
  } finally {
    for (const name of names) if (previous[name] !== undefined) process.env[name] = previous[name];
  }
});

test('FreeLLMAPI is the primary provider and defaults to its compatible local gateway in development', () => {
  const config = getEchoProviderConfig({ FREELLMAPI_API_KEY: 'test-key', NODE_ENV: 'test' });
  assert.equal(config?.id, 'freellmapi');
  assert.equal(config?.name, 'FreeLLMAPI');
  assert.equal(config?.model, 'auto:reliable');
  assert.equal(config?.baseUrl, 'http://127.0.0.1:31415/v1');
  assert.equal(config?.url, 'http://127.0.0.1:31415/v1/chat/completions');
});

test('FreeLLMAPI uses an explicit HTTPS endpoint and model in production', () => {
  const config = getEchoProviderConfig({
    FREELLMAPI_API_KEY: 'test-key',
    FREELLMAPI_BASE_URL: 'https://llm.example.com/v1/',
    FREELLMAPI_MODEL: 'auto:fast',
    NODE_ENV: 'production',
  });
  assert.equal(config?.baseUrl, 'https://llm.example.com/v1');
  assert.equal(config?.url, 'https://llm.example.com/v1/chat/completions');
  assert.equal(config?.model, 'auto:fast');
});

test('FreeLLMAPI wins over an OpenAI key, and paid providers require explicit opt-in', () => {
  const free = getEchoProviderConfig({ FREELLMAPI_API_KEY: 'free-test', OPENAI_API_KEY: 'paid-test', NODE_ENV: 'test' });
  assert.equal(free?.id, 'freellmapi');
  const paidBlocked = getEchoProviderConfig({ OPENAI_API_KEY: 'paid-test', NODE_ENV: 'test' });
  assert.equal(paidBlocked, null);
  const paidAllowed = getEchoProviderConfig({ OPENAI_API_KEY: 'paid-test', ECHO_ALLOW_PAID_PROVIDER: 'true', NODE_ENV: 'test' });
  assert.equal(paidAllowed?.id, 'openai');
});

test('unsafe or malformed provider endpoints are ignored', () => {
  for (const FREELLMAPI_BASE_URL of ['http://public.example.com/v1', 'https://llm.example.com', 'https://user:pass@llm.example.com/v1', 'https://llm.example.com/v1?key=secret']) {
    assert.equal(getEchoProviderConfig({ FREELLMAPI_API_KEY: 'test-key', FREELLMAPI_BASE_URL, NODE_ENV: 'test' }), null, FREELLMAPI_BASE_URL);
  }
});

test('provider status is safe to expose to an authenticated admin view', () => {
  const status = echoProviderStatus({ FREELLMAPI_API_KEY: 'super-secret-test-key', NODE_ENV: 'test' });
  assert.equal(status.provider, 'freellmapi');
  assert.equal(status.configured, true);
  assert.equal(status.baseHost, '127.0.0.1:31415');
  assert.equal(JSON.stringify(status).includes('super-secret-test-key'), false);
});

test('legacy FREELMAPI aliases remain accepted for existing deployments', () => {
  const legacy = getEchoProviderConfig({ FREELMAPI_API_KEY: 'legacy-key', FREELMAPI_MODEL: 'auto:fast', NODE_ENV: 'test' });
  assert.equal(legacy?.id, 'freellmapi');
  assert.equal(legacy?.model, 'auto:fast');
  const canonicalWins = getEchoProviderConfig({
    FREELLMAPI_API_KEY: 'canonical-key',
    FREELLMAPI_MODEL: 'auto:reliable',
    FREELMAPI_API_KEY: 'legacy-key',
    FREELMAPI_MODEL: 'auto:fast',
    NODE_ENV: 'test',
  });
  assert.equal(canonicalWins?.model, 'auto:reliable');
});
