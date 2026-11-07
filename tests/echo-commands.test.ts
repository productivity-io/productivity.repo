import assert from 'node:assert/strict';
import test from 'node:test';
import { ECHO_PAGES, resolvePortalCommand, viewValue, portalHelp } from '../src/lib/echoCommands.ts';
import { confirmPortalAction } from '../src/lib/echoActionFeedback.ts';

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
