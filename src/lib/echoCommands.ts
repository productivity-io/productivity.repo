/** Read-only portal commands. No model text, URLs, selectors or database writes are executed. */
import type { UserRole } from '../context/AuthContext';

type Page = { path: string; label: string; aliases: string[]; staff?: boolean };
export const ECHO_PAGES: readonly Page[] = [
  { path: '/dashboard', label: 'Dashboard', aliases: ['dashboard', 'home', 'overview'] },
  { path: '/announcements', label: 'Announcements', aliases: ['announcements', 'alerts', 'notices', 'announcement', 'anouncements'] },
  { path: '/attendance', label: 'Attendance', aliases: ['attendance', 'attendence', 'attendance portal', 'attendence portal', 'attendance page', 'attendence page'] },
  { path: '/timetable', label: 'Timetable', aliases: ['timetable', 'class timetable', 'schedule', 'time table', 'timtable'] },
  { path: '/assignments', label: 'Assignments', aliases: ['assignments', 'homework', 'assignment', 'assignements'] },
  { path: '/examinations', label: 'Examinations', aliases: ['examinations', 'exams', 'results', 'exam', 'examination', 'marks', 'grades'] },
  { path: '/portfolio', label: 'Portfolio', aliases: ['portfolio', 'achievements'] },
  { path: '/transport', label: 'Transport', aliases: ['transport', 'bus routes', 'buses'] },
  { path: '/contacts', label: 'Contacts', aliases: ['contacts', 'contact directory'] },
  { path: '/lost-and-found', label: 'Lost & Found', aliases: ['lost and found', 'lost & found'] },
  { path: '/leave-requests', label: 'Leave Requests', aliases: ['leave requests', 'leaves'] },
  { path: '/calendar', label: 'Calendar & Events', aliases: ['calendar', 'events', 'school calendar'] },
  { path: '/library', label: 'Library', aliases: ['library', 'books', 'book catalogue'] },
  { path: '/communication', label: 'Communication', aliases: ['communication', 'messages', 'communication hub'] },
  { path: '/directory', label: 'Students & Faculty', aliases: ['directory', 'students and faculty'], staff: true },
  { path: '/students', label: 'Students', aliases: ['students'], staff: true },
  { path: '/staff', label: 'Staff', aliases: ['staff', 'faculty'], staff: true },
  { path: '/reports', label: 'Reports', aliases: ['reports', 'analytics'], staff: true },
  { path: '/settings', label: 'Settings', aliases: ['settings', 'preferences'] },
  { path: '/profile', label: 'Profile', aliases: ['profile', 'my profile'] },
];

export type Field = { initial: string; values?: readonly string[]; aliases?: Record<string, string> };
export const ECHO_VIEWS: Record<string, Record<string, Field>> = {
  '/announcements': {
    search: { initial: '' },
    category: { initial: 'all', values: ['all', 'emergency', 'school_wide', 'academic', 'class_specific', 'event'] },
    read: { initial: 'all', values: ['all', 'unread', 'read'] },
  },
  '/calendar': { category: { initial: 'all', values: ['all', 'competition', 'cultural', 'sports', 'examination', 'holiday', 'deadline', 'personal'] } },
  '/library': {
    search: { initial: '' },
    tab: { initial: 'catalogue', values: ['catalogue', 'transactions'], aliases: { 'issue history': 'transactions', 'due dates': 'transactions', 'book catalogue': 'catalogue', 'catalog': 'catalogue' } },
  },
  '/contacts': { search: { initial: '' }, category: { initial: 'all', values: ['all', 'academic', 'administration', 'transport', 'emergency', 'support'] } },
  '/assignments': { status: { initial: 'all', values: ['all', 'assigned', 'in_progress', 'submitted', 'under_review', 'graded', 'overdue'] }, subject: { initial: 'all' } },
  '/lost-and-found': { type: { initial: 'all', values: ['all', 'lost', 'found', 'archived'] } },
  '/portfolio': { category: { initial: 'all', values: ['all', 'academic', 'project', 'competition', 'arts_cultural', 'sports', 'award'] } },
  '/timetable': {
    view: { initial: 'weekly', values: ['weekly', 'daily'] },
    day: { initial: 'Thursday', values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  },
  '/examinations': { tab: { initial: 'results', values: ['results', 'timetable', 'report_card'], aliases: { 'exam schedule': 'timetable', 'report card': 'report_card' } } },
  '/attendance': { tab: { initial: 'daily', values: ['daily', 'subject', 'corrections'], aliases: { 'daily attendance': 'daily', 'subject attendance': 'subject', 'correction requests': 'corrections' } } },
  '/directory': { search: { initial: '' }, tab: { initial: 'students', values: ['students', 'staff', 'academics'] } },
  '/students': { search: { initial: '' }, tab: { initial: 'students', values: ['students', 'staff', 'academics'] } },
  '/staff': { search: { initial: '' }, tab: { initial: 'staff', values: ['students', 'staff', 'academics'] } },
};

export function viewValue(path: string, field: string, params: URLSearchParams): string {
  const rule = ECHO_VIEWS[path]?.[field];
  if (!rule) throw new Error('Unsupported portal view field.');
  const raw = params.get('echo_' + field);
  return raw !== null && raw.length <= 200 && (!rule.values || rule.values.includes(raw)) ? raw : rule.initial;
}

export type CommandContext = { path: string; search: string; role: UserRole; academicYears: string[]; subjects?: readonly SubjectOption[] };
export type SubjectOption = { value: string; label: string; aliases?: readonly string[] };
type Context = CommandContext;

/** Public UI metadata only: never inspect records or send page content to a provider. */
export function portalHelp(context: Context): { summary: string; suggestions: string[] } {
  const page = ECHO_PAGES.find(p => p.path === context.path && allowed(p, context.role));
  if (!page) return { summary: 'Open a portal page to see its available commands.', suggestions: ['Open dashboard'] };
  const params = new URLSearchParams(context.search);
  const selections = Object.keys(ECHO_VIEWS[page.path] || {})
    .filter(field => !((page.path === '/attendance' || (page.path === '/assignments' && field === 'status')) && context.role !== 'student'))
    .map(field => `${field}: ${field === 'subject' ? context.subjects?.find(s => s.value === viewValue(page.path, field, params))?.label || 'all' : viewValue(page.path, field, params).replace(/_/g, ' ') || 'none'}`);
  const suggestions: string[] = [];
  if (page.path === '/attendance' && context.role === 'student') suggestions.push('Show subject attendance', 'Show daily attendance');
  if (page.path === '/assignments' && context.role === 'student') suggestions.push('Show overdue assignments');
  if (page.path === '/announcements') suggestions.push('Show unread announcements', 'Clear filters');
  if (page.path === '/calendar') suggestions.push('Show sports events', 'Clear filters');
  if (page.path === '/library') suggestions.push('Show issue history', 'Switch to catalogue');
  if (page.path === '/timetable') suggestions.push('Show Monday timetable', 'Switch to weekly view');
  if (page.path === '/examinations') suggestions.push('Show report card', 'Show exam schedule');
  if (page.path === '/contacts') suggestions.push('Show support contacts', 'Clear filters');
  if (!suggestions.length) suggestions.push('Open attendance', 'Open library');
  suggestions.push('Help with this page');
  return {
    summary: `You are on ${page.label}.${selections.length ? ' Current view - ' + selections.join('; ') + '.' : ''}`,
    suggestions,
  };
}

export type PortalCommand = { reply: string; href?: string; back?: boolean; academicYear?: string };
export const normalize = (text: string) => text.toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
export const allowed = (page: Page, role: UserRole) => !page.staff || ['teacher', 'coordinator', 'principal'].includes(role);
const TYPO_MAP: Record<string, string> = {
  attendence: 'attendance',
  calender: 'calendar',
  'time table': 'timetable',
  timtable: 'timetable',
  anouncement: 'announcements',
  anouncements: 'announcements',
  annoucement: 'announcements',
  annoucements: 'announcements',
  assignement: 'assignments',
  assignements: 'assignments',
  assignment: 'assignments',
  exam: 'examinations',
  exams: 'examinations',
  examination: 'examinations',
  leave: 'leave requests',
  leaves: 'leave requests',
  student: 'students',
  report: 'reports',
  libary: 'library',
  liberary: 'library',
  portfolo: 'portfolio',
  transpot: 'transport',
  communicaton: 'communication',
  settngs: 'settings',
};

export const normalizePageTerm = (input: string): string => {
  let cleaned = normalize(input);
  cleaned = cleaned.replace(/\s+(?:portal|page|screen|module|section|tab|view|hub)s?$/i, '').trim();
  cleaned = cleaned.replace(/^(?:the|my)\s+/i, '').trim();
  return TYPO_MAP[cleaned] || cleaned;
};

const pageNamed = (text: string) => {
  const norm = normalize(text);
  const canonical = normalizePageTerm(text);
  return ECHO_PAGES.find(page =>
    page.aliases.some(alias => {
      const aNorm = normalize(alias);
      return aNorm === norm || aNorm === canonical || normalizePageTerm(alias) === canonical;
    }) ||
    normalize(page.label) === norm ||
    normalizePageTerm(page.label) === canonical
  );
};

export function resolvePortalCommand(message: string, context: Context): PortalCommand | null {
  const original = message.trim()
    .replace(/^echo[,!\s]+/i, '')
    .replace(/^please\s+/i, '')
    .replace(/[\s,]+please$/i, '')
    .replace(/[.!?]+$/, '');
  if (!original || original.length > 4000) return null;
  const text = normalize(original);
  if (/^(help(?: with this page)?|what can i do here|what filters are selected|explain this page)$/.test(text)) {
    const help = portalHelp(context);
    return { reply: help.summary + '\nTry: ' + help.suggestions.filter(s => s !== 'Help with this page').join('; ') + '. These commands change the view only.' };
  }
  if (/^(go )?back$|^previous page$/.test(text)) return { back: true, reply: 'Opening the previous portal view.' };
  if (/^(where am i|what page am i on)$/.test(text)) {
    return { reply: 'You are on ' + (ECHO_PAGES.find(p => p.path === context.path)?.label || 'the portal') + '.' };
  }
  const year = text.match(/^(?:switch|change|select|set)(?: the| my)?(?: academic| school)? year(?: to)? (\d{4}-\d{4})$/);
  if (year) return context.academicYears.includes(year[1])
    ? { academicYear: year[1], reply: `Selected academic year ${year[1]}.` }
    : { reply: 'That academic year is not in the portal selector.' };

  const goto = text.match(/^(?:open|go to|take me to|navigate to|show(?: me)?|view|switch to) (?:the |my )?(.+)$/);
  const directPortal = !goto && text.match(/^(?:the |my )?(.+?)(?:\s+(?:portal|page))$/);
  const named = (goto && pageNamed(goto[1])) || (directPortal && pageNamed(directPortal[1]));
  if (named) return allowed(named, context.role)
    ? { href: named.path, reply: `Opening ${named.label}.` }
    : { reply: 'That page is not available for your portal role.' };

  const currentPage = ECHO_PAGES.find(p => p.path === context.path);
  let target = currentPage;
  let valueText = text;
  // Explicit destination suffixes, such as "show sports events", change that page's existing filter.
  for (const page of ECHO_PAGES) {
    const alias = page.aliases.find(a => text.endsWith(' ' + a));
    if (alias) { target = page; valueText = text.slice(0, -(alias.length + 1)); break; }
  }
  if (!target || !allowed(target, context.role)) {
    return goto ? { reply: 'That page is not available for your portal role.' } : null;
  }
  const fields = ECHO_VIEWS[target.path] || {};
  const params = new URLSearchParams(target.path === context.path ? context.search : '');
  const href = () => target!.path + (params.size ? '?' + params : '');
  if (/^(clear|reset)(?: the| my)? (?:search|filters|view)$|^show all$/.test(text)) {
    for (const key of [...params.keys()]) if (key.startsWith('echo_')) params.delete(key);
    return { href: href(), reply: 'Cleared the current view filters.' };
  }

  const searchIn = original.match(/^(?:search|find|look for) (.+?) (?:in|on) (?:the )?(.+)$/i);
  const searchFor = original.match(/^(?:search|find|look)(?: (?:the )?(library|books|announcements|contacts|directory|students|staff|faculty))? (?:for )?(.+)$/i);
  if (searchIn || searchFor) {
    const destination = searchIn ? pageNamed(searchIn[2]) : searchFor?.[1] ? pageNamed(searchFor[1]) : currentPage;
    const query = (searchIn?.[1] || searchFor?.[2] || '').trim();
    if (!destination || !allowed(destination, context.role) || !ECHO_VIEWS[destination.path]?.search)
      return { reply: 'Use search in Library, Announcements, Contacts or the staff directory.' };
    if (!query || query.length > 200) return { reply: 'Enter a search phrase of 1 to 200 characters.' };
    const next = new URLSearchParams(destination.path === context.path ? context.search : '');
    next.set('echo_search', query);
    if (destination.path === '/library') next.set('echo_tab', 'catalogue');
    return { href: destination.path + '?' + next, reply: `Searching ${destination.label} for “${query}”.` };
  }

  valueText = valueText.replace(/^(?:show(?: me)?|filter(?: by)?|select|switch to|view)\s+/, '')
    .replace(/^only\s+/, '').replace(/\s+(?:only|view|tab)$/, '');
  for (const [field, rule] of Object.entries(fields)) {
    // Attendance tabs are only rendered by the existing student page.
    if (target.path === '/attendance' && context.role !== 'student') continue;
    if (target.path === '/assignments' && field === 'status' && context.role !== 'student') continue;
    const value = rule.aliases?.[valueText] || rule.values?.find(v => normalize(v) === valueText);
    if (value && /^(show|filter|select|switch to|view)\b/.test(text)) {
      params.set('echo_' + field, value);
      if (target.path === '/timetable' && field === 'day') params.set('echo_view', 'daily');
      return { href: href(), reply: `Applying ${normalize(value)} view in ${target.label}.` };
    }
  }
  if (goto || /^(filter|select|switch to|clear|reset)\b/.test(text))
    return { reply: 'I can open portal pages and use existing view controls. Try “Open library”, “Search books for physics”, or “Show sports events”. Saved records are unchanged.' };
  return null; // Normal conversation stays on the existing ECHO service.
}
