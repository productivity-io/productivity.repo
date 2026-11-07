import assert from 'node:assert/strict';
import test from 'node:test';
import { ECHO_PAGES, resolvePortalCommand, viewValue, portalHelp } from '../src/lib/echoCommands.ts';
import { confirmPortalAction } from '../src/lib/echoActionFeedback.ts';
import { recognizePortalCommand, EchoCommandSession, editDistance } from '../src/lib/echoRecognition.ts';
import { registerEchoSubjects, getEchoSubjects } from '../src/lib/echoSubjectOptions.ts';

const context = { path: '/dashboard', search: '', role: 'student' as const, academicYears: ['2026-2027', '2025-2026'] };
for (const page of ECHO_PAGES) {
  test(`open real route ${page.path}, enforcing the existing student role`, () => {
    const result = resolvePortalCommand('Open ' + page.aliases[0], context);
    assert.equal(result?.href, page.staff ? undefined : page.path);
    if (page.staff) assert.match(result!.reply, /not available/);
  });
  if (page.staff) test(`staff can navigate to ${page.path}`, () => {
    assert.equal(resolvePortalCommand('Open ' + page.aliases[0], { ...context, role: 'teacher' })?.href, page.path);
  });
}
const views: [string, string, string, string][] = [
  ['/calendar', 'Show only sports events', 'category', 'sports'],
  ['/calendar', 'Show cultural events', 'category', 'cultural'],
  ['/announcements', 'Show unread announcements', 'read', 'unread'],
  ['/announcements', 'Show emergency announcements', 'category', 'emergency'],
  ['/library', 'Show issue history', 'tab', 'transactions'],
  ['/library', 'Switch to catalogue', 'tab', 'catalogue'],
  ['/contacts', 'Show support contacts', 'category', 'support'],
  ['/assignments', 'Show overdue assignments', 'status', 'overdue'],
  ['/lost-and-found', 'Show found', 'type', 'found'],
  ['/portfolio', 'Show sports achievements', 'category', 'sports'],
  ['/timetable', 'Show Monday timetable', 'day', 'Monday'],
  ['/timetable', 'Switch to daily view', 'view', 'daily'],
  ['/examinations', 'Show report card', 'tab', 'report_card'],
  ['/attendance', 'Show subject attendance', 'tab', 'subject'],
];
for (const [path, text, field, value] of views) test(`existing ${path} control: ${text}`, () => {
  const result = resolvePortalCommand(text, { ...context, path });
  assert.ok(result?.href, JSON.stringify(result));
  const url = new URL(result.href, 'https://portal.example');
  assert.equal(url.pathname, path);
  assert.equal(viewValue(path, field, url.searchParams), value);
});
test('search routes to existing library input and encodes user text as data', () => {
  const result = resolvePortalCommand('Search books for physics & optics', context)!;
  const url = new URL(result.href!, 'https://portal.example');
  assert.equal(url.pathname, '/library');
  assert.equal(url.searchParams.get('echo_search'), 'physics & optics');
  assert.equal(url.searchParams.get('echo_tab'), 'catalogue');
});
test('follow-up search uses current page, preserving unrelated filters', () => {
  const result = resolvePortalCommand('Search for library', { ...context, path: '/announcements', search: '?echo_read=unread' })!;
  const url = new URL(result.href!, 'https://portal.example');
  assert.equal(url.pathname, '/announcements');
  assert.equal(url.searchParams.get('echo_read'), 'unread');
  assert.equal(url.searchParams.get('echo_search'), 'library');
});
test('explicit search destination overrides current page', () => {
  const result = resolvePortalCommand('Find science in library', context)!;
  assert.match(result.href!, /^\/library\?/);
});
test('clear view removes only ECHO view keys', () => {
  const result = resolvePortalCommand('Clear filters', { ...context, path: '/calendar', search: '?echo_category=sports&other=keep' })!;
  assert.equal(result.href, '/calendar?other=keep');
});
test('back is an intent for internal portal history, not an arbitrary URL', () => {
  assert.deepEqual(resolvePortalCommand('go back', context), { back: true, reply: 'Opening the previous portal view.' });
});
test('natural variations and spelling mistakes navigate to real attendance route /attendance', () => {
  const variations = [
    'open attendence portal',
    'open attendance portal',
    'open attendance',
    'open attendence',
    'go to attendence portal',
    'take me to the attendance portal',
    'navigate to attendance page',
    'attendence portal',
    'attendance portal',
    'please open attendence portal',
    'open attendence portal please',
  ];
  for (const phrase of variations) {
    const res = resolvePortalCommand(phrase, context);
    assert.equal(res?.href, '/attendance', `Failed on: ${phrase}`);
    assert.equal(res?.reply, 'Opening Attendance.', `Failed on: ${phrase}`);
  }
});
test('spelling mistakes and portal suffixes on other pages resolve correctly', () => {
  assert.equal(resolvePortalCommand('open assignments portal', context)?.href, '/assignments');
  assert.equal(resolvePortalCommand('open calender', context)?.href, '/calendar');
  assert.equal(resolvePortalCommand('open library portal', context)?.href, '/library');
  assert.equal(resolvePortalCommand('open libary', context)?.href, '/library');
  assert.equal(resolvePortalCommand('open timetable portal', context)?.href, '/timetable');
});
test('staff can search students and staff directories via ECHO commands', () => {
  const staffCtx = { ...context, role: 'teacher' as const };
  const stuSearch = resolvePortalCommand('Search students for Aarav', staffCtx)!;
  assert.equal(stuSearch.href, '/students?echo_search=Aarav');
  const blockedForStudent = resolvePortalCommand('Search students for Aarav', context)!;
  assert.equal(blockedForStudent.href, undefined);
});
test('conversational queries about attendance are preserved for general AI engine', () => {
  for (const text of ['What is attendance policy?', 'How do I check attendance?', 'Can you explain attendance rules?']) {
    assert.equal(resolvePortalCommand(text, context), null, `Should be null: ${text}`);
  }
});
test('school year is selected only from actual selector options', () => {
  assert.equal(resolvePortalCommand('Switch academic year to 2025-2026', context)?.academicYear, '2025-2026');
  assert.equal(resolvePortalCommand('Switch academic year to 2000-2001', context)?.academicYear, undefined);
});
test('normal conversational questions are forwarded to the existing engine', () => {
  for (const text of ['Hello Echo', 'Can you explain homework?', 'How do I apply for leave?', '', ' '])
    assert.equal(resolvePortalCommand(text, context), null);
});
for (const text of ['Open https://evil.example', 'Open //evil.example', 'Open javascript:alert(1)',
  'Open /api/settings/reset-seed', 'Delete all events', '<script>alert(1)</script>', 'Run powershell.exe']) {
  test(`no executable command or external navigation from ${text}`, () => {
    const action = resolvePortalCommand(text, context);
    assert.equal(action?.href, undefined);
    assert.equal(action?.academicYear, undefined);
    assert.equal(action?.back, undefined);
  });
}
test('invalid query values cannot select unsupported controls', () => {
  assert.equal(viewValue('/calendar', 'category', new URLSearchParams('echo_category=<script>')), 'all');
  assert.equal(viewValue('/timetable', 'day', new URLSearchParams('echo_day=Sunday')), 'Thursday');
  assert.equal(viewValue('/library', 'search', new URLSearchParams({ echo_search: 'x'.repeat(201) })), '');
  assert.throws(() => viewValue('/settings', 'shell', new URLSearchParams()));
});

test('context help describes validated current filters and stays local', () => {
  const ctx = { ...context, path: '/announcements', search: '?echo_read=unread&echo_category=invalid&secret=do-not-read' };
  const help = portalHelp(ctx);
  assert.match(help.summary, /Announcements.*category: all.*read: unread/);
  assert.equal(help.summary.includes('do-not-read'), false);
  assert.ok(help.suggestions.includes('Show unread announcements'));
  assert.match(resolvePortalCommand('What filters are selected?', ctx)!.reply, /read: unread/);
  assert.equal(resolvePortalCommand('Help with this page', ctx)?.href, undefined);
});

test('suggestions resolve locally and honor student/staff controls', () => {
  for (const role of ['student', 'teacher', 'coordinator', 'principal'] as const) {
    for (const page of ECHO_PAGES) {
      const ctx = { ...context, role, path: page.path };
      const help = portalHelp(ctx);
      for (const text of help.suggestions) assert.ok(resolvePortalCommand(text, ctx), `${role} ${page.path}: ${text}`);
      if (role !== 'student' && page.path === '/attendance') {
        assert.equal(help.summary.includes('tab:'), false);
        assert.equal(help.suggestions.includes('Show subject attendance'), false);
      }
      if (role === 'student' && page.staff) assert.equal(help.summary.includes(page.label), false);
    }
  }
});

test('confirmation waits for observed state and fails honestly on timeout/cancel', async () => {
  let matched = false;
  setTimeout(() => { matched = true; }, 10);
  assert.equal(await confirmPortalAction(() => matched, 'Confirmed', new AbortController().signal), 'Confirmed');
  assert.match(await confirmPortalAction(() => false, 'False success', new AbortController().signal, 0), /could not confirm/);
  const controller = new AbortController();
  controller.abort();
  assert.match(await confirmPortalAction(() => true, 'False success', controller.signal), /cancelled/);
});

for (const [text, path] of [
  ['opn attendence', '/attendance'], ['tak me to dashbord', '/dashboard'], ['go calender', '/calendar'],
  ['shwo attendnce', '/attendance'], ['could you please opne the libary for me', '/library'],
  ['i wana see my marks', '/examinations'], ['i want to check my grades', '/examinations'],
  ['attn', '/attendance'], ['open hw', '/assignments'], ['cal', '/calendar'], ['attendance', '/attendance'],
] as const) test(`fuzzy/alternate command executes registered route: ${text}`, () => {
  const result = recognizePortalCommand(text, context);
  assert.equal(result?.confidence, 'high', JSON.stringify(result));
  assert.equal(result?.action?.href, path);
});
test('adjacent transposition and edit distance are bounded', () => {
  assert.equal(editDistance('shwo', 'show'), 1);
  assert.equal(editDistance('atendnce', 'attendance'), 2);
  assert.equal(editDistance('a'.repeat(81), 'a'), 81);
});
test('multiple weak spelling errors require confirmation without an action', () => {
  const result = recognizePortalCommand('opn atendnce', context);
  assert.equal(result?.confidence, 'medium');
  assert.equal(result.action, undefined);
  assert.equal(result.choices?.[0].message, 'Open attendance');
  const session = new EchoCommandSession();
  assert.equal(session.resolve('opn atendnce', context)?.confidence, 'medium');
  assert.equal(session.resolve('yes', context)?.action?.href, '/attendance');
  assert.equal(session.resolve('yes', context), null, 'confirmation is single-use');
  assert.equal(recognizePortalCommand('attendnce', context)?.confidence, 'medium', 'fuzzy bare fragments need confirmation');
});
test('explicit ambiguity requires a numbered choice; yes alone executes nothing', () => {
  const session = new EchoCommandSession();
  const result = session.resolve('open calendar or timetable', context);
  assert.equal(result?.confidence, 'medium');
  assert.equal(result?.choices?.length, 2);
  assert.equal(session.resolve('yes', context)?.action, undefined);
  assert.equal(session.resolve('2', context)?.action?.href, '/timetable');
});
test('cancel, expiry, view/role/year changes, reset and unrelated chat invalidate pending intent', () => {
  let now = 0;
  const session = new EchoCommandSession(() => now);
  session.resolve('opn atendnce', context);
  assert.match(session.resolve('no', context)!.reply!, /cancelled/);
  assert.equal(session.resolve('yes', context), null);
  for (const changed of [ { ...context, path: '/library' }, { ...context, role: 'teacher' as const }, { ...context, academicYear: '2025-2026' }, { ...context, search: '?echo_tab=subject' } ]) {
    session.resolve('opn atendnce', context);
    assert.equal(session.resolve('yes', changed)?.action, undefined);
  }
  session.resolve('opn atendnce', context); now = 60001;
  assert.equal(session.resolve('yes', context)?.action, undefined);
  session.resolve('opn atendnce', context); session.reset();
  assert.equal(session.resolve('yes', context), null);
  session.resolve('opn atendnce', context); session.resolve('Hello Echo', context);
  assert.equal(session.resolve('yes', context), null);
});
test('fuzzy filters and atomic navigation + filter preserve registered state', () => {
  const result = recognizePortalCommand('opn calender then shwo sprts events', { ...context, path: '/calendar', search: '?keep=value&echo_category=cultural' });
  assert.equal(result?.confidence, 'high', JSON.stringify(result));
  const url = new URL(result!.action!.href!, 'https://portal.example');
  assert.equal(url.pathname, '/calendar');
  assert.equal(url.searchParams.get('echo_category'), 'sports');
  assert.equal(url.searchParams.get('keep'), null, 'explicit open resets destination as existing navigation does');
  const view = recognizePortalCommand('shwo only sprts', { ...context, path: '/calendar', search: '?keep=value' });
  assert.match(view?.action?.href || '', /keep=value/);
  assert.match(view?.action?.href || '', /echo_category=sports/);
  assert.match(recognizePortalCommand('select sprts', { ...context, path: '/calendar' })?.action?.href || '', /echo_category=sports/);
  const session = new EchoCommandSession();
  const timetable = { ...context, path: '/timetable' };
  assert.equal(session.resolve('switch to daly view', timetable)?.confidence, 'medium');
  assert.match(session.resolve('yes', timetable)?.action?.href || '', /echo_view=daily/);
});
test('multi-part uncertainty confirms the entire plan and unsupported parts execute nothing', () => {
  const session = new EchoCommandSession();
  assert.equal(session.resolve('opn atendnce then show subject attendance', context)?.confidence, 'medium');
  assert.equal(session.resolve('yes', context)?.action?.href, '/attendance?echo_tab=subject');
  for (const text of ['open attendance then show maths', 'open library then delete all books', 'open calendar then open transport', 'open attendance then nonsense'])
    assert.equal(recognizePortalCommand(text, context)?.action?.href, undefined, text);
});
test('only authenticated, currently registered subject options can select a Mathematics filter', () => {
  const cleanup = registerEchoSubjects(42, [{ id: 7, name: 'Advanced Mathematics', code: 'MAT-101' }, { id: 8, name: 'Physics' }]);
  const ctx = { ...context, path: '/assignments', search: '?echo_status=overdue&keep=1', subjects: getEchoSubjects(42) };
  const result = recognizePortalCommand('shwo only maths', ctx);
  assert.equal(result?.confidence, 'high');
  const url = new URL(result!.action!.href!, 'https://portal.example');
  assert.equal(url.searchParams.get('echo_subject'), '7');
  assert.equal(url.searchParams.get('echo_status'), 'overdue');
  assert.equal(url.searchParams.get('keep'), '1');
  assert.match(recognizePortalCommand('show maths assignments', ctx)?.action?.href || '', /echo_subject=7/);
  assert.match(recognizePortalCommand('shwo maths only', ctx)?.action?.href || '', /echo_subject=7/);
  assert.match(recognizePortalCommand('select maths', ctx)?.action?.href || '', /echo_subject=7/);
  assert.equal(getEchoSubjects(43).length, 0);
  assert.equal(recognizePortalCommand('shwo only maths', { ...ctx, subjects: [] })?.action?.href, undefined);
  cleanup();
  assert.equal(getEchoSubjects(42).length, 0);
  assert.equal(recognizePortalCommand('show me my atendnce for maths', context)?.action?.href, undefined);
  const ambiguous = { ...ctx, subjects: [{ value: '7', label: 'Advanced Mathematics', aliases: ['maths'] }, { value: '9', label: 'Applied Mathematics', aliases: ['maths'] }] };
  assert.equal(recognizePortalCommand('shwo only maths', ambiguous)?.confidence, 'medium');
  assert.equal(recognizePortalCommand('shwo only maths', ambiguous)?.action, undefined);
});
test('fuzzy role restrictions cannot produce a forbidden navigation or confirmation choice', () => {
  for (const text of ['opn staf', 'open studnts', 'opn reportss']) {
    const result = recognizePortalCommand(text, context);
    assert.equal(result?.action?.href, undefined, text);
    assert.equal(result?.choices, undefined, text);
  }
  assert.equal(recognizePortalCommand('opn reportss', { ...context, role: 'teacher' })?.action?.href, '/reports');
});
test('normal questions, negations, unsupported mutations and external URLs never become fuzzy actions', () => {
  for (const text of ['What is attendance policy?', 'How do I check my marks?', 'Can you explain attendance?', 'Can you show me how attendance works?', 'I like the calendar', 'do not open attendance', 'open attendance if I am absent', 'say open library', 'change my marks', 'delete attendance', 'submit assignment', 'open https://evil.invalid', 'open qzxv', 'show me my attendance for maths']) {
    const result = recognizePortalCommand(text, context);
    assert.equal(result?.action?.href, undefined, text);
    assert.equal(result?.choices, undefined, text);
  }
  assert.equal(recognizePortalCommand('How do I check my marks?', context), null);
  for (const text of ['slow reply', 'slow attendance', 'shop calendar', 'cake attendance'])
    assert.equal(recognizePortalCommand(text, context), null, `A valid non-command word must not turn into an imperative: ${text}`);
});
test('literal search data is never typo-corrected or split into commands', () => {
  const result = recognizePortalCommand('Search books for maths and physics', context);
  const url = new URL(result!.action!.href!, 'https://portal.example');
  assert.equal(url.searchParams.get('echo_search'), 'maths and physics');
  const special = recognizePortalCommand('Search books for "delete" and http://example.invalid', context);
  assert.equal(new URL(special!.action!.href!, 'https://portal.example').searchParams.get('echo_search'), '"delete" and http://example.invalid');
});
