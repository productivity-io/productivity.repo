/**
 * Built-in ECHO conversation engine.
 *
 * Deliberately model-free and deterministic: approved portal guidance only, no record reads,
 * no invented memory and no action execution. Website commands are resolved locally by the
 * authenticated React layer before a message ever reaches this service.
 */
import type { EchoIdentity } from './echo.js';

export type EchoTurn = { user: string; assistant: string };
export type EchoProviderInfo = {
  id: 'freellmapi' | 'openai' | 'local-guidance';
  name: string;
  model: string;
  route?: string;
  fallback: boolean;
};
/**
 * A read-only navigation the authenticated browser may execute. Paths come only from the
 * server's own allowlist, never from model output, and the host page re-validates role.
 */
export type EchoNavigationAction = { type: 'navigate'; actionId: string; path: string; label: string };
export type EchoReply = {
  text: string;
  references: Array<{ title: string }>;
  provider?: EchoProviderInfo;
  action?: EchoNavigationAction;
};
export type EchoContext = {
  name?: string;
  role?: EchoIdentity['role'];
  page?: string;
};

export const LOCAL_PROVIDER: EchoProviderInfo = {
  id: 'local-guidance',
  name: 'Built-in portal guidance',
  model: 'deterministic',
  fallback: true,
};

type Topic = {
  id: string;
  title: string;
  keywords: string[];
  summary: string;
  extra: string;
  command?: string;
  path?: string;
};

const TOPICS: readonly Topic[] = [
  {
    id: 'attendance',
    title: 'Attendance & corrections',
    keywords: ['attendance', 'attendence', 'present', 'absent', 'absence', 'late', 'excused', 'percentage', 'correction', 'shortage', '75%', '85%'],
    summary: 'Attendance is in the Attendance module, with daily logs, subject-wise percentages and a Corrections tab if an entry looks wrong.',
    extra: 'For a correction, open the Corrections tab, pick the date, add a short reason and submit. A teacher or coordinator reviews it — I can take you there, but I can’t change the record myself.',
    command: 'open attendance',
    path: '/attendance',
  },
  {
    id: 'assignments',
    title: 'Assignments & homework',
    keywords: ['assignment', 'assignments', 'assignement', 'homework', 'hw', 'submit', 'submission', 'overdue', 'due date', 'upload', 'graded'],
    summary: 'Assignments is where homework, due dates, attachments and submission status live. You can submit text or files and follow each item from Assigned to Submitted to Graded.',
    extra: 'Overdue work stays visible until it’s graded, and your teacher’s remarks appear on the submission. I can also filter the current view to overdue work.',
    command: 'open assignments',
    path: '/assignments',
  },
  {
    id: 'timetable',
    title: 'Timetable & substitutions',
    keywords: ['timetable', 'timtable', 'time table', 'schedule', 'period', 'class time', 'substitution', 'substitute', 'cancelled', 'room', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    summary: 'The Timetable module has weekly and daily schedules, rooms, faculty names, break periods, and any substitutions or cancelled classes.',
    extra: 'Substitutions show inline on the period, and the daily view is the easiest one on a phone. Say “show Monday timetable” and I’ll switch the view for you.',
    command: 'open timetable',
    path: '/timetable',
  },
  {
    id: 'exams',
    title: 'Examinations & report cards',
    keywords: ['exam', 'exams', 'examination', 'examinations', 'result', 'results', 'marks', 'mark', 'report card', 'grades', 'grade', 'rank', 'syllabus'],
    summary: 'Examinations holds subject-wise marks, the exam schedule and printable report cards.',
    extra: 'Results is the default tab, and Report Card opens the printable term view. I can jump you to either one — I just can’t view or edit a private mark.',
    command: 'open examinations',
    path: '/examinations',
  },
  {
    id: 'leave',
    title: 'Leave requests',
    keywords: ['leave', 'leaves', 'sick', 'medical', 'vacation', 'permission', 'apply for leave', 'leave request'],
    summary: 'Leave Requests is where you apply: choose start and end dates, pick a leave type, attach supporting documents if you have them, then submit.',
    extra: 'Teachers, coordinators and the Principal review pending requests and add remarks. You can track the status in the same module.',
    command: 'open leave requests',
    path: '/leave-requests',
  },
  {
    id: 'library',
    title: 'Library & book issues',
    keywords: ['library', 'libary', 'liberary', 'book', 'books', 'isbn', 'borrow', 'issue', 'return', 'fine', 'catalogue', 'catalog', 'rack'],
    summary: 'The Library module searches the catalogue by title, author, category or ISBN, and shows rack locations plus your issue history and due dates.',
    extra: 'If a book is already out, the issue history shows its due date and return status. Renewals and fines go through the library desk.',
    command: 'open library',
    path: '/library',
  },
  {
    id: 'announcements',
    title: 'Announcements & alerts',
    keywords: ['announcement', 'announcements', 'announce', 'notice', 'notices', 'alert', 'alerts', 'emergency', 'circular', 'unread'],
    summary: 'Announcements carries school circulars, academic updates, event notices and emergency alerts. Unread items are easy to isolate.',
    extra: 'Coordinator notices go through Principal approval, and emergency alerts appear at the top of the portal.',
    command: 'open announcements',
    path: '/announcements',
  },
  {
    id: 'transport',
    title: 'Transport & bus routes',
    keywords: ['transport', 'transpot', 'bus', 'buses', 'route', 'driver', 'pickup', 'drop', 'attendant', 'delay'],
    summary: 'Transport shows your bus, route, morning and afternoon timings, stops, and driver or attendant contacts.',
    extra: 'There’s also a form for reporting delays or route issues.',
    command: 'open transport',
    path: '/transport',
  },
  {
    id: 'portfolio',
    title: 'Portfolio & achievements',
    keywords: ['portfolio', 'portfolo', 'achievement', 'achievements', 'certificate', 'award', 'project', 'skills', 'extracurricular'],
    summary: 'Portfolio is your record of awards, projects, sports and cultural achievements, skills and teacher feedback, with a print/export view.',
    extra: 'Students can add new entries and faculty verify them afterwards.',
    command: 'open portfolio',
    path: '/portfolio',
  },
  {
    id: 'communication',
    title: 'Communication, contacts & lost and found',
    keywords: ['communication', 'communicaton', 'message', 'messages', 'contact', 'contacts', 'teacher', 'lost', 'found', 'it support'],
    summary: 'Communication is for requesting a conversation with a teacher or coordinator, Contacts is the staff directory, and Lost & Found handles campus items.',
    extra: 'Messages unlock once the other person accepts your request. Lost & Found also takes claim requests.',
    command: 'open communication',
    path: '/communication',
  },
  {
    id: 'calendar',
    title: 'Calendar & events',
    keywords: ['calendar', 'calender', 'events', 'event', 'holiday', 'deadline', 'competition', 'cultural', 'sports'],
    summary: 'Calendar & Events collects competitions, cultural events, exams, holidays, deadlines and personal entries.',
    extra: 'You can filter the calendar by category, for example “show sports events”.',
    command: 'open calendar',
    path: '/calendar',
  },
  {
    id: 'dashboard',
    title: 'Dashboard overview',
    keywords: ['dashboard', 'dashbord', 'overview', 'home page', 'summary', 'standing'],
    summary: 'The Dashboard is your at-a-glance view: attendance rate, pending work, academic standing, notices and today’s timetable.',
    extra: 'Each card links into the full module when you need the detail.',
    command: 'open dashboard',
    path: '/dashboard',
  },
  {
    id: 'privacy',
    title: 'Privacy and account changes',
    keywords: ['password', 'private', 'privacy', 'record', 'records', 'delete', 'account', 'policy', 'data', 'security', 'who am i'],
    summary: 'I can’t view or change private records — marks, attendance entries, messages, passwords or anyone’s account. Those changes go through school staff.',
    extra: 'For a password or profile change, open Profile or contact IT support. For an academic correction, use the module’s own request flow.',
    command: 'open profile',
    path: '/profile',
  },
];

const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/announcements': 'Announcements',
  '/attendance': 'Attendance',
  '/timetable': 'Timetable',
  '/assignments': 'Assignments',
  '/examinations': 'Examinations',
  '/portfolio': 'Portfolio',
  '/transport': 'Transport',
  '/contacts': 'Contacts',
  '/lost-and-found': 'Lost & Found',
  '/leave-requests': 'Leave Requests',
  '/calendar': 'Calendar & Events',
  '/library': 'Library',
  '/communication': 'Communication',
  '/directory': 'Students & Faculty',
  '/students': 'Students',
  '/staff': 'Staff',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

const PAGE_HELP: Record<string, string> = {
  '/dashboard': 'It summarises attendance, pending work, standing, notices and today’s classes. I can open any module from here.',
  '/announcements': 'I can show unread or read notices, or filter by emergency, academic, event and other categories.',
  '/attendance': 'I can switch between daily attendance, subject-wise attendance and correction requests.',
  '/timetable': 'I can switch between the weekly and daily views, or jump to a specific weekday.',
  '/assignments': 'I can filter by status or by one of the subjects already loaded on this page.',
  '/examinations': 'I can switch between results, the exam schedule and the printable report card.',
  '/library': 'I can search the catalogue or switch to your issue history.',
  '/calendar': 'I can filter by sports, cultural, exam, holiday, deadline or personal events.',
  '/contacts': 'I can search the directory or filter by department.',
  '/leave-requests': 'I can explain the application steps, but I won’t submit or approve a request for you.',
  '/portfolio': 'I can filter achievements by category. Adding an entry is done with the page’s own form.',
  '/communication': 'I can explain how conversation requests work, but I won’t send a message for you.',
};

const TYPO_FIXES: Record<string, string> = {
  helo: 'hello', hii: 'hi', hiya: 'hi', hey: 'hey', thanx: 'thanks', thx: 'thanks', ty: 'thanks',
  wat: 'what', wht: 'what', wats: 'whats', whats: 'what is', hw: 'homework', libary: 'library',
  liberary: 'library', attendence: 'attendance', atendance: 'attendance', assigment: 'assignment',
  assignement: 'assignment', assignements: 'assignments', examz: 'exams', exm: 'exam',
  timtable: 'timetable', calender: 'calendar', portfolo: 'portfolio', transpot: 'transport',
  communicaton: 'communication', anouncement: 'announcement', anouncements: 'announcements',
  studing: 'studying', studdy: 'study', pls: 'please', plz: 'please', pleae: 'please',
  aply: 'apply', aplly: 'apply', leev: 'leave', levae: 'leave', lev: 'leave', attnd: 'attendance',
  asignment: 'assignment', asignments: 'assignments', examn: 'exam', timetble: 'timetable',
  calandar: 'calendar', transpott: 'transport', mesage: 'message', mesages: 'messages',
  passward: 'password', recods: 'records', markss: 'marks', subjet: 'subject',
  wanna: 'want to', wana: 'want to', gonna: 'going to', dunno: 'do not know', cant: 'cannot',
  im: 'i am', ive: 'i have', id: 'i would', ur: 'your', u: 'you', r: 'are', abt: 'about',
  dont: 'do not', doesnt: 'does not', isnt: 'is not', wont: 'will not', shouldnt: 'should not',
};

const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'\s%&/+.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tidy = (text: string) => normalize(text).replace(/^echo[,!\s]+/, '').replace(/[.!?]+$/, '').trim();

function words(text: string): string[] {
  return tidy(text).split(' ').flatMap(word => (TYPO_FIXES[word] || word).split(' ')).filter(Boolean);
}

/** Optimal-string-alignment distance (adjacent transpositions count once). */
function editDistance(a: string, b: string): number {
  if (a.length > 60 || b.length > 60) return Math.max(a.length, b.length);
  const grid = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) grid[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1, grid[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) grid[i][j] = Math.min(grid[i][j], grid[i - 2][j - 2] + 1);
  }
  return grid[a.length][b.length];
}

function topicScore(message: string, topic: Topic): number {
  const normalized = ' ' + words(message).join(' ') + ' ';
  let score = 0;
  for (const keyword of topic.keywords) {
    const key = normalize(keyword);
    if (!key) continue;
    if (normalized.includes(' ' + key + ' ')) score += key.includes(' ') ? 5 : 3;
  }
  // Typo-tolerant single-word matching keeps "attandance" or "libary" understandable.
  const tokens = normalized.trim().split(' ');
  for (const keyword of topic.keywords) {
    const key = normalize(keyword);
    if (!key || key.includes(' ') || key.length < 5) continue;
    for (const token of tokens) {
      if (token.length < 5 || token === key) continue;
      if (Math.abs(token.length - key.length) <= 2 && editDistance(token, key) <= 1) {
        score += 2;
        break;
      }
    }
  }
  return score;
}

function bestTopic(message: string): { topic: Topic; score: number } | null {
  let best: { topic: Topic; score: number } | null = null;
  for (const topic of TOPICS) {
    const score = topicScore(message, topic);
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }
  return best;
}

function historyTopic(history: EchoTurn[]): Topic | null {
  for (let index = history.length - 1; index >= 0; index--) {
    const turn = history[index];
    const fromUser = bestTopic(turn.user);
    if (fromUser) return fromUser.topic;
    const fromAssistant = bestTopic(turn.assistant);
    if (fromAssistant) return fromAssistant.topic;
  }
  return null;
}

/**
 * Conversational navigation lifecycle.
 *
 * A navigation is only ever offered from this fixed topic allowlist. The server holds the offer
 * (bound to the session, account and role) until the user accepts it, then returns a structured
 * action that the authenticated browser must execute and verify. Plain reply text never moves
 * the router by itself.
 */
export const NAVIGATION_OFFER_TTL_MS = 60_000;
export type NavigationOffer = { topicId: string; actionId: string };

/** Deictic acceptance of an offer ECHO actually made. Never a data-changing instruction. */
export function isNavigationFollowUp(rawMessage: string): boolean {
  const text = tidy(rawMessage).replace(/^(?:ok|okay|alright|so|and)\s+/, '');
  if (!text) return false;
  if (/\b(?:no|not|cancel|never ?mind|forget it|stop|don'?t)\b/.test(text)) return false;
  if (/^(?:yes|yeah|yep|yup|sure|ok|okay|alright|please|go ahead|do it|proceed|agreed|sounds good|that(?:'s| is) fine)(?:\s+(?:please|then|thanks|thank you))?$/.test(text)) return true;
  return /\b(?:take|bring|get|lead|walk|show)\s+me\s+(?:there|to it)\b/.test(text)
    || /\b(?:open|show|go|take|view|pull up|bring up|jump to|head to)\s+(?:it|that|this)\b/.test(text)
    || /\b(?:go|head|jump)\s+there\b/.test(text)
    || /\blet(?:'s| us)\s+(?:do|open|go\s+with|see)\s+(?:that|it)\b/.test(text)
    || /^(?:show|open)\s+(?:me|it|that)$/.test(text);
}

/** Clearly withdrawing an offer, so an ambiguous "okay" can never revive it. */
export function isNavigationCancellation(rawMessage: string): boolean {
  return /^(?:no|nope|nah|cancel|never ?mind|forget it|not now|stop)(?:\s+(?:no|cancel|thanks|thank you|that|it))*$/.test(tidy(rawMessage));
}

/** The only paths ECHO may ask the browser to open. */
export function navigationActionForTopic(topicId: string): EchoNavigationAction | null {
  const topic = TOPICS.find(item => item.id === topicId);
  if (!topic?.path || !topic.command) return null;
  return {
    type: 'navigate',
    actionId: 'nav:' + topic.path.replace(/^\//, ''),
    path: topic.path,
    label: PAGE_LABELS[topic.path] || topic.title,
  };
}

/** "Actually, open assignments instead" replaces the offer with that single allowlisted page. */
export function explicitNavigationDestination(rawMessage: string): { topicId: string } | null {
  const match = normalize(rawMessage).match(
    /^(?:actually\s+|instead\s+|no\s+)?(?:open|show|take me to|go to|navigate to|bring up|pull up|switch to)\s+(?:the\s+|my\s+)?(.+?)(?:\s+instead)?$/,
  );
  const destination = match?.[1]?.trim();
  if (!destination || destination.length > 60) return null;
  const topic = bestTopic(destination)?.topic;
  return topic?.command && topic.path ? { topicId: topic.id } : null;
}

/**
 * Detect a navigation ECHO genuinely offered in its own reply. The canonical offer names the
 * command; a provider may phrase it differently, but then the reply must name exactly one
 * allowlisted page. Two possible destinations mean "ask for clarification", never a guess.
 */
export function navigationOfferFor(replyText: string): NavigationOffer | null {
  const canonical = replyText.match(/say\s+[“"']?(open\s+[a-z][a-z\s]{1,40}?)[”"']?\s+and\s+i[’']?ll\s+take\s+you\s+there/i);
  if (canonical) {
    const command = normalize(canonical[1]);
    const topic = TOPICS.find(item => item.command && normalize(item.command) === command);
    const action = topic ? navigationActionForTopic(topic.id) : null;
    if (topic && action) return { topicId: topic.id, actionId: action.actionId };
  }
  if (!/\b(?:want me to take you|shall i take you|i can take you|i(?:'|’)ll take you|would you like me to open|want me to open|take you there)\b/.test(normalize(replyText))) return null;
  const named = TOPICS.filter(topic => topic.command && topic.path && topicScore(replyText, topic) > 0);
  if (named.length !== 1) return null;
  const action = navigationActionForTopic(named[0].id);
  return action ? { topicId: named[0].id, actionId: action.actionId } : null;
}

function pageTitleFor(path: string): string {
  return PAGE_LABELS[path] || 'that page';
}

/**
 * Ensure a reply that clearly concerns one allowlisted page actually offers navigation to it.
 * This keeps the offer honest: the sentence is added to the reply the user sees, and the pending
 * action is registered from that same text.
 */
export function attachNavigationOffer(reply: EchoReply, rawMessage: string): EchoReply {
  if (!reply.text || reply.action) return reply;
  if (navigationOfferFor(reply.text)) return reply;
  const message = tidy(rawMessage);
  if (!message || message.length > 400) return reply;
  if (COMMAND.test(message)) return reply;
  if (/\b(?:delete|remove|erase|change|edit|update|overwrite|approve|reject|submit|send|pay|upload|cancel)\b/.test(message)) return reply;
  if (/^(?:hi|hello|hey|thanks|thank you|bye|goodbye)\b/.test(message)) return reply;
  const topic = bestTopic(rawMessage)?.topic;
  if (!topic?.command || !topic.path) return reply;
  if (topicScore(reply.text, topic) === 0) return reply;
  if (reply.text.length > 900) return reply;
  return { ...reply, text: `${reply.text.trim()} ${commandFor(topic)}`.replace(/\s+/g, ' ').trim() };
}

export function navigationAcceptedReply(action: EchoNavigationAction): EchoReply {
  return { text: `Opening ${pageTitleFor(action.path)}.`, references: [{ title: pageTitleFor(action.path) }], action };
}

export function navigationCancelledReply(): EchoReply {
  return {
    text: 'Cancelled — I haven’t changed the page. Tell me where you’d like to go whenever you’re ready.',
    references: [{ title: 'Portal navigation' }],
  };
}

export function navigationExpiredReply(): EchoReply {
  return {
    text: 'That page offer has expired, so nothing changed. Name the page — for example “open attendance” — and I’ll take you there.',
    references: [{ title: 'Portal navigation' }],
  };
}

function pick(message: string, options: readonly string[]): string {
  let hash = 0;
  for (let index = 0; index < message.length; index++) hash = (hash * 31 + message.charCodeAt(index)) >>> 0;
  return options[hash % options.length];
}

function firstName(context: EchoContext): string {
  const name = (context.name || '').trim();
  return /^[A-Za-z][A-Za-z'-]{0,40}$/.test(name) ? name : '';
}

function pageLabel(context: EchoContext): string {
  return (context.page && PAGE_LABELS[context.page]) || '';
}

function commandFor(topic: Topic): string {
  return topic.command ? `If you want, say “${topic.command}” and I’ll take you there.` : '';
}

function topicReply(topic: Topic, message: string, context: EchoContext, detailed: boolean): EchoReply {
  const lead = pick(message, ['Sure thing.', 'Happy to help.', 'Got it.', 'Here’s the short version.']);
  const onPage = topic.command && context.page && PAGE_LABELS[context.page]?.toLowerCase() === topic.command.replace('open ', '').toLowerCase();
  const personal = /\b(?:my|mine)\b/.test(words(message).join(' ')) && /\b(?:attendance|marks?|grades?|results?|record|timetable|assignments?)\b/.test(words(message).join(' '));
  const parts = [`${lead} ${topic.summary}`];
  if (personal) parts.push('I can’t read your personal record from this chat, but the page will show it once you open it.');
  if (detailed || onPage) parts.push(topic.extra);
  if (!onPage) parts.push(commandFor(topic));
  return {
    text: parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim(),
    references: [{ title: topic.title }],
  };
}

function pageHelpReply(context: EchoContext, message: string): EchoReply {
  const label = pageLabel(context);
  if (!label) {
    return {
      text: 'Tell me which portal page you’re on — Dashboard, Attendance, Assignments, Library — and I’ll explain what’s available there.',
      references: [{ title: 'Portal navigation' }],
    };
  }
  const help = PAGE_HELP[context.page!] || 'I can explain what this page is for or help you move somewhere else.';
  return {
    text: `${pick(message, ['You’re on the', 'This is the', 'Right now you’re on the'])} ${label} page. ${help}`,
    references: [{ title: label }],
  };
}

function capabilitiesReply(context: EchoContext): EchoReply {
  const staff = context.role && context.role !== 'student';
  const name = firstName(context);
  const lines = [
    `Here’s what I’m good at${name ? `, ${name}` : ''}:`,
    '• Getting you places — “open attendance”, “take me to the dashboard”, “go back”',
    '• Explaining workflows — leave, assignments, exams, library, transport and more',
    '• Adjusting a view — “show unread announcements”, “show Monday timetable”',
    staff
      ? '• Staff shortcuts — “open directory”, “open reports”, “search students for Aarav”'
      : '• Finding your work — “show overdue assignments”, “i wanna see my marks”',
    'You can also just ask a normal question. What are you trying to do?',
  ];
  return { text: lines.join('\n'), references: [{ title: 'ECHO capabilities' }] };
}

function identityReply(): EchoReply {
  return {
    text: 'I’m ECHO, the assistant built into the Veritas portal. I can explain how the modules work, take you to the right page, and talk through what you’re trying to do. I don’t read or change private school records.',
    references: [{ title: 'About ECHO' }],
  };
}

function noMemoryReply(): EchoReply {
  return {
    text: 'I only keep the current conversation while this chat is open — I don’t remember past sessions or personal details between them. If you remind me what you were working on, I’ll pick it right back up.',
    references: [{ title: 'Privacy and conversation memory' }],
  };
}

function sensitiveReply(): EchoReply {
  return {
    text: 'I can’t change marks, attendance, messages, passwords or anyone’s account — those actions stay with school staff and the module’s own forms. I can open the right page or explain the correction process instead.',
    references: [{ title: 'Privacy and account changes' }],
  };
}

function commandMissReply(message: string): EchoReply {
  const topic = bestTopic(message)?.topic;
  if (topic) return { ...topicReply(topic, message, {}, false), text: topicReply(topic, message, {}, false).text };
  return {
    text: 'I couldn’t match that to a portal page. Try naming one — Dashboard, Attendance, Assignments, Timetable, Examinations, Library, Calendar or Leave Requests — or ask “what can you do?”.',
    references: [{ title: 'Portal navigation' }],
  };
}

function smalltalkReply(message: string, context: EchoContext): EchoReply | null {
  const text = words(message).join(' ');
  const name = firstName(context);
  if (/\b(joke|make me laugh|something funny)\b/.test(text)) {
    return {
      text: pick(message, [
        'Why did the student bring a ladder to school? To reach the higher grades. …I’ll see myself out.',
        'I told my timetable a joke. It didn’t laugh — too many periods.',
        'Why was the maths book sad? It had too many problems. Speaking of which, want me to open Assignments?',
      ]),
      references: [{ title: 'ECHO' }],
    };
  }
  if (/\b(stressed|stressful|nervous|anxious|overwhelmed|worried|tired|exhausted|confusing|confused|hard|difficult)\b/.test(text)) {
    return {
      text: `That sounds like a lot${name ? `, ${name}` : ''}. Let’s make it smaller: tell me the one thing that’s most urgent — a deadline, an exam, or a page you can’t find — and I’ll point you straight at it.`,
      references: [{ title: 'ECHO' }],
    };
  }
  if (/\b(how are you|how r u|how's it going|hows it going)\b/.test(text)) {
    return {
      text: 'Doing well, thanks for asking — ready when you are. What are we working on?',
      references: [{ title: 'ECHO' }],
    };
  }
  if (/\b(what is the weather|weather today|is it raining)\b/.test(text)) {
    return {
      text: 'I don’t have live weather here. The Dashboard does show school alerts — including weather advisories — so that’s the best place to check.',
      references: [{ title: 'Dashboard overview' }],
    };
  }
  return null;
}

const QUESTION = /^(?:what|why|how|where|when|who|which|can|could|would|will|do|does|did|is|are|should|tell me|explain|describe|help)\b/;
const FOLLOW_UP = /^(?:more|tell me more|go on|continue|anything else|and\?|why\?|really\?|ok(?:ay)? so)\b/;
const COMMAND = /^(?:open|go to|go back|take me|navigate|show me|show|view|switch to|filter|select|clear|reset|search|find|look for|display|pull up|bring up|jump to|let me see|head to|get me to)\b/;

export function buildEchoReply(
  rawMessage: string,
  history: EchoTurn[] = [],
  context: EchoContext = {}
): EchoReply {
  const message = String(rawMessage || '').trim();
  if (!message) {
    return { text: 'I’m here — what would you like help with?', references: [{ title: 'ECHO' }] };
  }
  if (message.length > 4000) {
    return { text: 'That message is a little long for me. Could you shorten it to the main question?', references: [{ title: 'ECHO' }] };
  }

  const text = words(message).join(' ');
  const name = firstName(context);
  const label = pageLabel(context);
  const turnCount = history.length;

  if (/^(?:hi|hello|hey|yo|good morning|good afternoon|good evening|greetings)\b/.test(text)) {
    if (turnCount > 0) {
      return {
        text: `Hey again${name ? `, ${name}` : ''}. What’s next?`,
        references: [{ title: 'ECHO' }],
      };
    }
    return {
      text: label
        ? `Hey${name ? ` ${name}` : ''} — you’re on the ${label} page. I can explain it, open another module, or just chat. What do you need?`
        : `Hey${name ? ` ${name}` : ''}! I’m ECHO. I can help you find your way around the portal, explain how things work, or just talk it through. What do you need?`,
      references: [{ title: 'ECHO' }],
    };
  }

  if (/^(?:thanks|thank you|cheers|appreciate it|that helps|perfect|great)\b/.test(text)) {
    const topic = historyTopic(history);
    return {
      text: `Anytime${name ? `, ${name}` : ''}.${topic?.command ? ` If you still need it, just say “${topic.command}”.` : ' Shout if you need anything else.'}`,
      references: [{ title: 'ECHO' }],
    };
  }

  if (/^(?:bye|goodbye|see you|good night|that's all|thats all|nothing else)\b/.test(text)) {
    return { text: `See you${name ? `, ${name}` : ''}. I’ll be here when you need me.`, references: [{ title: 'ECHO' }] };
  }

  if (/\b(?:who are you|what are you|your name|are you (?:a )?(?:bot|robot|ai|human|real))\b/.test(text)) {
    return identityReply();
  }

  if (/\b(?:remember|memory|yesterday|last time|earlier today|previous chat|past conversation)\b/.test(text)) {
    return noMemoryReply();
  }

  if (/\b(?:delete|remove|erase|change|edit|update|overwrite|approve|reject|submit|send|pay|upload)\b/.test(text)
    && /\b(?:my|the|his|her|their)?\s*(?:marks?|grades?|attendance|record|records|password|account|message|leave request|submission)\b/.test(text)) {
    return sensitiveReply();
  }

  if (/^(?:what can you do|what do you do|help|commands|capabilities|how can you help|what are your commands|what can i ask)\b/.test(text)) {
    if (/\b(?:this page|here|current page)\b/.test(text) && context.page) return pageHelpReply(context, message);
    return capabilitiesReply(context);
  }

  if (/\b(?:what page am i on|where am i|what is this page|what's this page|help with this page|what can i do here|explain this page|this page)\b/.test(text)) {
    if (context.page) return pageHelpReply(context, message);
  }

  if (FOLLOW_UP.test(text)) {
    const topic = historyTopic(history);
    if (topic) return topicReply(topic, message, context, true);
    return {
      text: 'Happy to go deeper — which part? I can cover attendance, assignments, timetable, exams, leave, library, transport, portfolio, announcements or the calendar.',
      references: [{ title: 'ECHO capabilities' }],
    };
  }

  const about = text.match(/^(?:and\s+|so\s+)?(?:what|how)\s+about\s+(.+)$/);
  if (about) {
    const topic = bestTopic(about[1]);
    if (topic) return topicReply(topic.topic, message, context, false);
    return {
      text: `I don’t have specific guidance on “${about[1].slice(0, 80)}”. I can help with portal modules, navigation and how the workflows fit together — try asking about a page or a process.`,
      references: [{ title: 'ECHO' }],
    };
  }

  if (/^(?:tell me a joke|make me laugh|something funny|how are you|how r u|what is the weather|weather today)\b/.test(text)) {
    const smalltalk = smalltalkReply(message, context);
    if (smalltalk) return smalltalk;
  }
  const smalltalk = smalltalkReply(message, context);
  if (smalltalk) return smalltalk;

  const topic = bestTopic(message);
  const asksForDetail = /\b(?:exactly|step by step|steps|details?|explain|how do i|how can i|how to|tell me more|guide)\b/.test(text);

  if (COMMAND.test(text) && !/\b(?:how|what|why|where|when|who)\b/.test(text)) {
    const recognized = topic ? topicReply(topic.topic, message, context, false) : commandMissReply(message);
    return {
      text: `That looks like a portal command, but it didn’t match an action on this page, so nothing changed. ${recognized.text}`,
      references: recognized.references,
    };
  }

  if (topic && (QUESTION.test(text) || topic.score >= 3)) {
    return topicReply(topic.topic, message, context, asksForDetail);
  }

  if (/\b(?:it|that|this|there|they)\b/.test(text)) {
    const previous = historyTopic(history);
    if (previous) return topicReply(previous, message, context, true);
  }

  if (QUESTION.test(text)) {
    return {
      text: `I’m not sure about that one. I know the Veritas portal well — modules, navigation, leave, assignments, exams, library, transport and announcements — and I’m happy to chat through what you’re trying to do. What’s the context?`,
      references: [{ title: 'ECHO capabilities' }],
    };
  }

  // Ordinary conversational statement: acknowledge, stay useful, never invent facts.
  return {
    text: `Got it${name ? `, ${name}` : ''}.${label ? ` You’re on ${label};` : ''} tell me what you’d like to do next and I’ll either take you there or explain the process.`,
    references: [{ title: 'ECHO' }],
  };
}

type ProviderConfig = {
  id: 'freellmapi' | 'openai';
  name: string;
  url: string;
  baseUrl: string | null;
  key: string;
  model: string;
};

type ProviderUsage = EchoProviderInfo & { at: string };
let lastProviderUsage: ProviderUsage | null = null;

function baseUrl(value: string): string | null {
  const base = value.trim().replace(/\/+$/, '');
  if (!base) return null;
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
  if (!parsed.pathname.replace(/\/+$/, '').endsWith('/v1')) return null;
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  const allowed = parsed.protocol === 'https:' || (parsed.protocol === 'http:' && loopback && process.env.NODE_ENV !== 'production');
  return allowed ? base : null;
}

/**
 * Provider priority:
 *   1. FreeLLMAPI (the intended primary brain; no mandatory paid usage).
 *   2. A paid OpenAI key only when explicitly opted in with ECHO_ALLOW_PAID_PROVIDER=true.
 * No configuration -> null -> deterministic local guidance.
 * Kept exportable so configuration can be audited without exposing the key.
 */
export function getEchoProviderConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig | null {
  const freeBaseRaw = (env.FREELLMAPI_BASE_URL || env.FREELMAPI_BASE_URL || env.ECHO_MODEL_BASE_URL || '').trim();
  const freeKey = (env.FREELLMAPI_API_KEY || env.FREELMAPI_API_KEY || env.ECHO_MODEL_API_KEY || '').trim();
  if (freeKey) {
    const fallbackBase = env.NODE_ENV !== 'production' ? 'http://127.0.0.1:31415/v1' : '';
    const base = baseUrl(freeBaseRaw || fallbackBase);
    if (!base) return null;
    return {
      id: 'freellmapi',
      name: 'FreeLLMAPI',
      baseUrl: base,
      url: `${base}/chat/completions`,
      key: freeKey,
      model: (env.FREELLMAPI_MODEL || env.FREELMAPI_MODEL || env.ECHO_MODEL_NAME || 'auto:reliable').trim() || 'auto:reliable',
    };
  }
  const paidKey = (env.OPENAI_API_KEY || '').trim();
  if (paidKey && env.ECHO_ALLOW_PAID_PROVIDER === 'true') {
    return {
      id: 'openai',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      url: 'https://api.openai.com/v1/chat/completions',
      key: paidKey,
      model: (env.ECHO_OPENAI_MODEL || 'gpt-4o-mini').trim(),
    };
  }
  return null;
}

export function getLastProviderUsage(): ProviderUsage | null {
  return lastProviderUsage;
}

export function rememberProviderUsage(usage: EchoProviderInfo): void {
  lastProviderUsage = { ...usage, at: new Date().toISOString() };
}

/** Authenticated diagnostics only: never includes the key or request content. */
export function echoProviderStatus(env: NodeJS.ProcessEnv = process.env) {
  const config = getEchoProviderConfig(env);
  return {
    primary: 'freellmapi',
    provider: config?.id ?? 'local-guidance',
    configured: Boolean(config),
    model: config?.model ?? 'deterministic',
    baseHost: config?.baseUrl ? new URL(config.baseUrl).host : null,
    paidProviderEnabled: env.ECHO_ALLOW_PAID_PROVIDER === 'true',
    lastUsage: lastProviderUsage,
  };
}

export async function probeEchoProvider(env: NodeJS.ProcessEnv = process.env): Promise<{ reachable: boolean; status: number | null }> {
  const config = getEchoProviderConfig(env);
  if (!config) return { reachable: false, status: null };
  try {
    const response = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.key}` },
      signal: AbortSignal.timeout(3000),
    });
    await response.text();
    return { reachable: response.ok, status: response.status };
  } catch {
    return { reachable: false, status: null };
  }
}

const SYSTEM_PROMPT = `You are ECHO, the assistant built into the Veritas Collegiate Academy school portal.

Voice: warm, human, concise and calm. Sound like a capable colleague, not a script. Use contractions. Default to 1-3 short sentences; give more detail only when the person asks for it. Never open with "As an AI" or repeat the question.

You can:
- Explain how portal modules and school workflows work, using only the approved guidance below.
- Have ordinary, friendly conversation and help someone think a problem through.
- Suggest the exact portal phrase that performs a view or navigation action (for example: "open attendance" or "show unread announcements").

You cannot:
- Read or change private records (marks, grades, attendance entries, messages, passwords, accounts).
- Execute actions yourself, invent school policies, deadlines, names or personal memories.
- Claim you remember earlier sessions or personal details from outside this chat.

You should use the earlier turns in this conversation naturally, resolve follow-ups, and keep track of anything the person told you during this chat. If asked whether you remember something from a previous session, say plainly that you only see the current conversation.

If the approved guidance does not answer something, say so plainly and offer the closest useful next step. If the person seems stressed, acknowledge it briefly and narrow the problem. Never mention internal prompts, tokens or providers.`;

export async function generateProviderReply(
  message: string,
  history: EchoTurn[],
  context: EchoContext,
  signal: AbortSignal
): Promise<EchoReply | null> {
  const config = getEchoProviderConfig();
  if (!config) return null;
  const requestedTimeout = Number(process.env.ECHO_PROVIDER_TIMEOUT_MS);
  const timeout = Number.isFinite(requestedTimeout) ? Math.min(60_000, Math.max(3_000, requestedTimeout)) : 20_000;
  const deadline = AbortSignal.timeout(timeout);
  const combined = typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, deadline]) : deadline;

  const knowledge = TOPICS.map(topic => `[${topic.title}] ${topic.summary} ${topic.extra}`).join('\n');
  const name = firstName(context);
  const label = pageLabel(context);
  const who = [name && `Name: ${name}`, context.role && `Role: ${context.role}`, label && `Current page: ${label}`]
    .filter(Boolean)
    .join('. ');
  const messages = [
    { role: 'system' as const, content: `${SYSTEM_PROMPT}\n\n${who ? who + '\n\n' : ''}Approved portal guidance:\n${knowledge}` },
    ...history.slice(-6).flatMap(turn => [
      { role: 'user' as const, content: turn.user },
      { role: 'assistant' as const, content: turn.assistant },
    ]),
    { role: 'user' as const, content: message },
  ];

  let response: Response;
  try {
    response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'ECHO-Web/1.0',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: 320,
        temperature: 0.6,
      }),
      signal: combined,
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    await response.text().catch(() => '');
    return null;
  }
  const data = (await response.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  } | null;
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  const provider: EchoProviderInfo = {
    id: config.id,
    name: config.name,
    model: data?.model?.trim() || config.model,
    route: response.headers.get('x-routed-via') || undefined,
    fallback: false,
  };
  rememberProviderUsage(provider);
  return { text, references: [{ title: config.name }], provider };
}
