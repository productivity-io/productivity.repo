/**
 * Generalized read-only tools for ECHO.
 *
 * Same contract as the Lost & Found reader: the host app authenticates the request and supplies
 * only the records that account may see; this module sanitizes, aggregates and phrases them.
 * Record text is data, never instructions, and it never reaches a model provider.
 */
import type { EchoRecord } from './echoData.js';

export type PortalModule = 'attendance' | 'assignments' | 'contacts' | 'timetable' | 'announcements';

export type PortalSnapshot = {
  attendance?: unknown;
  assignments?: unknown;
  contacts?: unknown;
  timetable?: unknown;
  announcements?: unknown;
};

export type ToolMemory = {
  lastModule?: PortalModule;
  /** Subject the conversation is currently about, e.g. the weakest attendance subject. */
  subject?: string;
};

export type ToolAnswer = {
  title: string;
  text: string;
  records: EchoRecord[];
  memory: ToolMemory;
};

const MAX_ITEMS = 6;

const normalize = (value: string): string =>
  String(value || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'&\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const text = (value: unknown, limit: number): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\s+/g, ' ').trim().slice(0, limit)
    : '';

export type AttendanceRow = { date: string; status: string; subjectName: string };
export type AssignmentRow = {
  id: number; title: string; subjectName: string; dueDate: string; status: string; maxMarks: number;
};
export type ContactRow = {
  name: string; role: string; department: string; category: string;
  email: string; phone: string; office: string; hours: string;
};

export function shapeAttendance(raw: unknown): AttendanceRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: AttendanceRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const status = text(row.status, 16);
    if (!status) continue;
    rows.push({
      date: text(row.date, 24),
      status,
      subjectName: text(row.subjectName, 80) || 'Daily homeroom',
    });
  }
  return rows;
}

export function shapeAssignments(raw: unknown): AssignmentRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: AssignmentRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = Number(row.id);
    const title = text(row.title, 160);
    if (!Number.isInteger(id) || id <= 0 || !title) continue;
    rows.push({
      id,
      title,
      subjectName: text(row.subjectName, 80),
      dueDate: text(row.dueDate, 24),
      status: text(row.status, 20) || 'assigned',
      maxMarks: Number(row.maxMarks) || 0,
    });
  }
  return rows;
}

export function shapeContacts(raw: unknown): ContactRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: ContactRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const name = text(row.contactPerson ?? row.name, 80);
    if (!name) continue;
    rows.push({
      name,
      role: text(row.roleTitle ?? row.role, 90),
      department: text(row.department, 90),
      category: text(row.category, 40),
      email: text(row.email, 120),
      phone: text(row.phone, 40),
      office: text(row.officeLocation ?? row.office, 120),
      hours: text(row.availableHours ?? row.hours, 120),
    });
  }
  return rows;
}

export type TimetableRow = {
  day: string; period: number; start: string; end: string; subject: string; teacher: string;
  room: string; isBreak: boolean; breakLabel: string; status: string;
  substitutionTeacher: string; note: string;
};

export type AnnouncementRow = {
  id: number; title: string; content: string; category: string; priority: string;
  author: string; publishedAt: string; isRead: boolean; isEmergency: boolean;
};

/** Clock used for "today", "tomorrow" and "next class". The zone is explicit, never the host's. */
export type PortalClock = { now: number; timeZone: string };

export function shapeTimetable(raw: unknown): TimetableRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: TimetableRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const day = text(row.dayOfWeek ?? row.day, 20);
    if (!day) continue;
    rows.push({
      day,
      period: Number(row.periodNumber ?? row.period) || 0,
      start: text(row.startTime ?? row.start, 20),
      end: text(row.endTime ?? row.end, 20),
      subject: text(row.subjectName ?? row.subject, 80),
      teacher: text(row.teacherName ?? row.teacher, 80),
      room: text(row.roomNumber ?? row.room, 60),
      isBreak: Boolean(row.isBreak),
      breakLabel: text(row.breakLabel, 40),
      status: text(row.status, 20) || 'scheduled',
      substitutionTeacher: text(row.substitutionTeacherName, 80),
      note: text(row.statusNote, 140),
    });
  }
  return rows;
}

export function shapeAnnouncements(raw: unknown): AnnouncementRow[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: AnnouncementRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Record<string, unknown>;
    const id = Number(row.id);
    const title = text(row.title, 160);
    if (!Number.isInteger(id) || id <= 0 || !title) continue;
    rows.push({
      id,
      title,
      content: text(row.content, 400),
      category: text(row.category, 40),
      priority: text(row.priority, 20) || 'normal',
      author: text(row.authorName, 80),
      publishedAt: text(row.publishedAt, 40),
      isRead: Boolean(row.isRead),
      isEmergency: Boolean(row.isEmergency),
    });
  }
  return rows;
}

export const MODULE_UNAVAILABLE: Record<PortalModule, string> = {
  attendance:
    'I couldn’t reach your attendance records just now, so I won’t guess at the numbers. The Attendance page shows the live record and I can take you there.',
  assignments:
    'I couldn’t reach your assignment records just now, so I won’t invent a deadline. The Assignments page shows the live list.',
  contacts:
    'I couldn’t reach the staff directory just now, so I won’t guess at names or addresses. The Contacts page has the current list.',
  timetable:
    'I couldn’t reach a timetable for this account, so I won’t guess at rooms or times. Your own class timetable is the only one I can read; the Timetable page shows what is published.',
  announcements:
    'I couldn’t reach the announcements for this account just now, so I won’t summarise from memory. The Announcements page shows the live list.',
};

const MODULE_TITLE: Record<PortalModule, string> = {
  attendance: 'Attendance',
  assignments: 'Assignments',
  contacts: 'Contacts',
  timetable: 'Timetable',
  announcements: 'Announcements',
};

const EXPLANATION = /\b(?:explain|what does|how does|what is the .{0,20} (?:page|module)|what are .{0,20} for)\b/;
// "Tell me about assignments" wants an explanation and keeps the navigation offer; "what are my
// assignments" wants the records. Concrete cues decide.
const EXPLANATION_LEAD = /^(?:what (?:are|is)|tell me about|describe)\b/;
const DATA_CUE = /\b(?:my|mine|due|overdue|this week|next week|tomorrow|today|percentage|how many|lowest|weakest|which|missing|submitted)\b/;
const NAVIGATION = /^(?:open|go to|go back|take me|navigate|bring up|pull up|switch to|head to)\b/;
const ANNOUNCEMENTS = /\b(?:announcements?|notices?|circulars?|notice ?board)\b|\bwhat'?s new\b/;
const TIMETABLE = /\b(?:timetable|time table|periods?|next (?:class|period|lesson)|which room|what room|room number|schedule)\b|\bclasses? (?:do|have|today|tomorrow|on)\b/;
const FOLLOW_UP = /^(?:what|how|which|and|also|anything|what about|how about|what else|more)\b/;

/**
 * Which module a message is about. Data questions only: explanations, navigation and unrelated
 * conversation stay with the existing pipeline.
 */
export function detectPortalModule(message: string, lastModule?: PortalModule): PortalModule | null {
  const value = normalize(message);
  if (!value || value.length > 400) return null;
  if (NAVIGATION.test(value) || EXPLANATION.test(value)) return null;
  if (EXPLANATION_LEAD.test(value) && !DATA_CUE.test(value)) return null;
  if (ANNOUNCEMENTS.test(value)) return 'announcements';
  // Timetable questions can start with "where is" ("where is my next class"), so they are decided
  // before the page-location guard below.
  if (TIMETABLE.test(value)) return 'timetable';
  // "Where can I see my attendance?" is a location/guidance question: it keeps the navigation
  // offer lifecycle instead of being answered with numbers.
  if (/^(?:where\b|how (?:do|can|should|would) i\b|how does\b)/.test(value)) return null;

  if (/\b(?:contacts?|directory|who teaches|who should i contact|whom should i contact|who do i contact|staff room|extension)\b/.test(value)) {
    return 'contacts';
  }
  if (/\b(?:attendance|attendence|absent|absence|present|late|lowest|weakest|attendance percentage)\b/.test(value)) {
    return 'attendance';
  }
  if (/\b(?:assignments?|homework|hw|submissions?|submitted|due|overdue|deadlines?|marks? obtained)\b/.test(value)) {
    return 'assignments';
  }
  // "Anything I should look at?" continues the module already in play.
  if (lastModule && FOLLOW_UP.test(value) && value.length < 120) return lastModule;
  return null;
}

const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0);

function groupAttendance(rows: readonly AttendanceRow[]) {
  const groups = new Map<string, { present: number; late: number; absent: number; excused: number }>();
  for (const row of rows) {
    const group = groups.get(row.subjectName) || { present: 0, late: 0, absent: 0, excused: 0 };
    if (row.status === 'present') group.present += 1;
    else if (row.status === 'late') group.late += 1;
    else if (row.status === 'absent') group.absent += 1;
    else if (row.status === 'excused') group.excused += 1;
    groups.set(row.subjectName, group);
  }
  return [...groups]
    .map(([subject, group]) => {
      const counted = group.present + group.late + group.absent;
      return { subject, ...group, counted, rate: pct(group.present + group.late, counted) };
    })
    .sort((a, b) => a.rate - b.rate);
}

function attendanceCards(stats: ReturnType<typeof groupAttendance>): EchoRecord[] {
  return stats.slice(0, MAX_ITEMS).map(stat => ({
    id: 'attendance-' + normalize(stat.subject).replace(/\s+/g, '-'),
    title: stat.subject,
    subtitle: `${stat.present + stat.late} of ${stat.counted} sessions attended`,
    meta: stat.excused ? [`${stat.excused} excused`] : [],
    status: `${stat.rate}%`,
  }));
}

function answerAttendance(message: string, rows: readonly AttendanceRow[]): ToolAnswer {
  const memory: ToolMemory = { lastModule: 'attendance' };
  if (!rows.length) {
    return {
      title: 'Attendance',
      text: 'There are no attendance sessions recorded for your account yet, so there’s nothing to average. Once a teacher marks a register it appears on the Attendance page.',
      records: [],
      memory,
    };
  }
  const stats = groupAttendance(rows);
  const attended = stats.reduce((sum, stat) => sum + stat.present + stat.late, 0);
  const counted = stats.reduce((sum, stat) => sum + stat.counted, 0);
  const excused = stats.reduce((sum, stat) => sum + stat.excused, 0);
  const overall = pct(attended, counted);
  const lowest = stats[0];
  const highest = stats[stats.length - 1];
  memory.subject = lowest.subject;

  const basis = `late counts as attended and excused sessions are left out of the calculation${excused ? ` (${excused} excused)` : ''}`;
  const asksLowest = /\b(?:lowest|weakest|worst|which subject|pay attention|anything)\b/.test(normalize(message));

  const lead = asksLowest
    ? `${lowest.subject} is your weakest at ${lowest.rate}% — ${lowest.present + lowest.late} of ${lowest.counted} sessions attended${lowest.absent ? `, ${lowest.absent} absent` : ''}.`
    : `You’re at ${overall}% overall — ${attended} of ${counted} sessions (${basis}).`;

  const parts = [lead];
  if (!asksLowest) {
    parts.push(lowest.rate === highest.rate
      ? `Every subject is level at ${lowest.rate}%.`
      : `Strongest is ${highest.subject} at ${highest.rate}%; lowest is ${lowest.subject} at ${lowest.rate}%.`);
  } else if (lowest.absent) {
    parts.push(`That’s ${lowest.absent} absent ${lowest.absent === 1 ? 'session' : 'sessions'} in ${lowest.subject} — the Attendance page lists the dates if you want to check them.`);
  }
  return { title: 'Attendance', text: parts.join(' '), records: attendanceCards(stats), memory };
}

const OPEN_STATUSES = new Set(['assigned', 'in_progress', 'overdue']);

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value || 'no date';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(match[3])} ${months[Number(match[2]) - 1] || ''} ${match[1]}`.replace(/\s+/g, ' ').trim();
}

const dayNumber = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000 : NaN;
};

function subjectNames(rows: readonly AssignmentRow[]): string[] {
  return [...new Set(rows.map(row => row.subjectName).filter(Boolean))];
}

function referencedSubject(rows: readonly AssignmentRow[], message: string, memory?: ToolMemory): string {
  const value = normalize(message);
  const named = subjectNames(rows).find(subject => value.includes(normalize(subject)));
  if (named) return named;
  if (memory?.subject && /\b(?:that|this|same) subject\b|\bit\b/.test(value)) return memory.subject;
  return '';
}

function answerAssignments(message: string, rows: readonly AssignmentRow[], memory?: ToolMemory): ToolAnswer {
  const value = normalize(message);
  const open = rows.filter(row => OPEN_STATUSES.has(row.status));
  const subject = referencedSubject(rows, message, memory);
  const scoped = subject ? open.filter(row => normalize(row.subjectName) === normalize(subject)) : open;
  const nextMemory: ToolMemory = { lastModule: 'assignments', subject: subject || memory?.subject };

  if (!rows.length) {
    return {
      title: 'Assignments',
      text: 'No assignments are published for your class yet, so there’s nothing due.',
      records: [],
      memory: nextMemory,
    };
  }
  if (!scoped.length) {
    return {
      title: 'Assignments',
      text: subject
        ? `Nothing is open in ${subject} right now — everything set for that subject is submitted or graded.`
        : 'Nothing is open right now; every published assignment is submitted or graded.',
      records: [],
      memory: nextMemory,
    };
  }

  const today = dayNumber(new Date().toISOString().slice(0, 10));
  const withDays = scoped
    .map(row => ({ row, days: dayNumber(row.dueDate) - today }))
    .sort((a, b) => a.days - b.days);
  const overdue = withDays.filter(item => item.days < 0);
  const asksOverdue = /\boverdue|late submission|missed\b/.test(value);
  const asksWindow = /\b(?:today|tomorrow|this week|next week|due)\b/.test(value);

  let chosen = withDays;
  let lead: string;
  if (asksOverdue) {
    chosen = overdue;
    lead = overdue.length
      ? `${overdue.length === 1 ? 'One assignment is' : `${overdue.length} assignments are`} past the due date:`
      : 'Nothing is overdue — every open assignment still has time left.';
    if (!overdue.length) chosen = withDays.slice(0, MAX_ITEMS);
  } else if (/\btomorrow\b/.test(value)) {
    chosen = withDays.filter(item => item.days === 1);
    lead = chosen.length ? 'Due tomorrow:' : 'Nothing is due tomorrow.';
  } else if (/\btoday\b/.test(value)) {
    chosen = withDays.filter(item => item.days === 0);
    lead = chosen.length ? 'Due today:' : 'Nothing is due today.';
  } else if (asksWindow) {
    chosen = withDays.filter(item => item.days >= 0 && item.days <= 7);
    lead = chosen.length
      ? `${chosen.length === 1 ? 'One assignment is' : `${chosen.length} assignments are`} due in the next week${subject ? ` in ${subject}` : ''}:`
      : `Nothing is due in the next week${subject ? ` in ${subject}` : ''}.`;
    if (!chosen.length) chosen = withDays.slice(0, MAX_ITEMS);
  } else {
    lead = `${scoped.length === 1 ? 'You have one open assignment' : `You have ${scoped.length} open assignments`}${subject ? ` in ${subject}` : ''}:`;
  }

  const shown = chosen.slice(0, MAX_ITEMS);
  const lines = shown.map(({ row, days }) => {
    const when = days < 0 ? `was due ${formatDate(row.dueDate)}` : days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : `due ${formatDate(row.dueDate)}`;
    return `• ${row.title}${row.subjectName ? ` (${row.subjectName})` : ''} — ${when}${row.status === 'overdue' ? ', overdue' : ''}`;
  });
  const records: EchoRecord[] = shown.map(({ row, days }) => ({
    id: `assignment-${row.id}`,
    title: row.title,
    subtitle: row.subjectName || 'Assignment',
    meta: [formatDate(row.dueDate)],
    status: days < 0 ? 'overdue' : days === 0 ? 'due today' : days === 1 ? 'due tomorrow' : row.status.replace(/_/g, ' '),
  }));
  return { title: 'Assignments', text: [lead, ...lines].join('\n'), records, memory: nextMemory };
}

const CONTACT_STOPWORDS = new Set([
  'who', 'should', 'contact', 'contacts', 'about', 'the', 'for', 'with', 'and', 'can', 'you', 'tell',
  'me', 'is', 'are', 'what', 'which', 'does', 'teach', 'teaches', 'my', 'a', 'an', 'of', 'in', 'to',
  'i', 'do', 'need', 'help', 'email', 'phone', 'number', 'where', 'how', 'reach', 'find', 'staff',
  'directory', 'department', 'missing', 'submission', 'assignment', 'grade', 'grades', 'marks',
]);

function answerContacts(message: string, rows: readonly ContactRow[]): ToolAnswer {
  const value = normalize(message);
  const memory: ToolMemory = { lastModule: 'contacts' };
  const terms = value.split(' ').filter(word => word.length >= 3 && !CONTACT_STOPWORDS.has(word));
  const matches = rows.filter(row => {
    const haystack = normalize([row.name, row.role, row.department, row.category].join(' '));
    return terms.some(term => haystack.includes(term));
  });
  const academic = rows.filter(row => row.category === 'academic');
  const chosen = matches.length
    ? matches
    : /\b(?:assignment|submission|grade|marks|academic|teacher)\b/.test(value) ? academic : [];
  const title = 'Contacts';

  if (!chosen.length) {
    const seen = [...new Set(rows.map(row => row.role || row.department).filter(Boolean))].slice(0, 6);
    return {
      title,
      text: seen.length
        ? `I don’t see a contact matching “${terms.join(' ')}” in the directory. Listed roles include ${seen.join(', ')}.`
        : 'The staff directory doesn’t have a contact matching that. The Contacts page lists everyone currently published.',
      records: [],
      memory,
    };
  }

  const shown = chosen.slice(0, MAX_ITEMS);
  const lines = shown.map(row => {
    const identity = [row.role, row.department].filter(Boolean).join(', ');
    const reach = [row.email, row.phone, row.office].filter(Boolean).join(' · ');
    return `• ${row.name}${identity ? ` — ${identity}` : ''}${reach ? `\n   ${reach}` : ''}`;
  });
  const lead = matches.length
    ? `${matches.length === 1 ? 'That’s' : `I found ${matches.length} matching contacts:`}`
    : 'For anything academic, these are the people to ask:';
  const records: EchoRecord[] = shown.map((row, index) => ({
    id: `contact-${normalize(row.name).replace(/\s+/g, '-') || index}`,
    title: row.name,
    subtitle: [row.role, row.department].filter(Boolean).join(' · '),
    meta: [row.email, row.phone, row.office].filter(Boolean),
    status: row.hours || '',
  }));
  return { title, text: [lead, ...lines].join('\n'), records, memory };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

function minutesOf(value: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)?/i.exec(String(value || '').trim());
  if (!match) return Number.NaN;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = (match[3] || '').toLowerCase();
  if (suffix === 'pm' && hour < 12) hour += 12;
  if (suffix === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

/** School-local date, weekday and minute-of-day for the configured zone (never the host's zone). */
export function zonedClock(now: number, timeZone: string): { iso: string; weekday: string; minutes: number } {
  const date = new Date(now);
  try {
    const zone = timeZone || 'UTC';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (type: string) => parts.find(item => item.type === type)?.value || '';
    const weekday = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long' }).format(date);
    const time = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    const hour = Number(time.find(item => item.type === 'hour')?.value || '0');
    const minute = Number(time.find(item => item.type === 'minute')?.value || '0');
    return { iso: `${part('year')}-${part('month')}-${part('day')}`, weekday, minutes: hour * 60 + minute };
  } catch {
    return {
      iso: date.toISOString().slice(0, 10),
      weekday: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(date),
      minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
    };
  }
}

function followingSchoolDay(day: string): string {
  const index = DAYS.indexOf(day);
  if (index === -1) return 'Monday';
  return DAYS[(index + 1) % DAYS.length];
}

function timetableCards(rows: readonly TimetableRow[]): EchoRecord[] {
  return rows.slice(0, MAX_ITEMS).map(row => ({
    id: `timetable-${row.day}-${row.period}`,
    title: row.isBreak ? row.breakLabel || 'Break' : row.subject || `Period ${row.period}`,
    subtitle: `${row.start}–${row.end}${row.room ? ` · ${row.room}` : ''}`,
    meta: [row.day],
    status: row.isBreak ? 'break' : row.status === 'scheduled' ? row.teacher : row.status,
  }));
}

function answerTimetable(message: string, rows: readonly TimetableRow[], clock: PortalClock): ToolAnswer {
  const value = normalize(message);
  const memory: ToolMemory = { lastModule: 'timetable' };
  if (!rows.length) {
    return { title: 'Timetable', text: 'No timetable is published for your class yet, so I can’t say what is next.', records: [], memory };
  }
  const now = zonedClock(clock.now, clock.timeZone);
  const lessons = rows.filter(row => !row.isBreak);
  const named = DAYS.find(day => value.includes(day.toLowerCase()));
  const targetDay = named || (/\btomorrow\b/.test(value) ? followingSchoolDay(now.weekday) : now.weekday);
  const dayRows = rows.filter(row => row.day === targetDay).sort((a, b) => a.period - b.period);

  const subjectMatch = lessons.find(row => {
    const name = normalize(row.subject);
    return Boolean(name) && name.split(' ').some(word => word.length >= 4 && value.includes(word));
  });
  if (subjectMatch && /\b(?:which|what) room\b|\bwhere\b/.test(value)) {
    return {
      title: 'Timetable',
      text: `${subjectMatch.subject} is in ${subjectMatch.room || 'a room that isn’t recorded'} on ${subjectMatch.day} — Period ${subjectMatch.period}, ${subjectMatch.start}–${subjectMatch.end}${subjectMatch.teacher ? `, with ${subjectMatch.teacher}` : ''}.`,
      records: timetableCards([subjectMatch]),
      memory,
    };
  }

  if (/\bnext (?:class|period|lesson)\b|\bwhat'?s next\b/.test(value)) {
    const today = lessons.filter(row => row.day === now.weekday && row.status !== 'cancelled').sort((a, b) => a.period - b.period);
    const upcoming = today.find(row => minutesOf(row.start) >= now.minutes);
    if (upcoming) {
      const cover = upcoming.status === 'substituted' && upcoming.substitutionTeacher ? ` (covered by ${upcoming.substitutionTeacher})` : '';
      return {
        title: 'Timetable',
        text: `Your next class is ${upcoming.subject || `Period ${upcoming.period}`} — ${upcoming.start}–${upcoming.end}${upcoming.room ? ` in ${upcoming.room}` : ''}${upcoming.teacher ? `, with ${upcoming.teacher}` : ''}${cover}.`,
        records: timetableCards([upcoming]),
        memory,
      };
    }
    const nextDay = followingSchoolDay(now.weekday);
    const first = lessons.filter(row => row.day === nextDay && row.status !== 'cancelled').sort((a, b) => a.period - b.period)[0];
    const dayNote = DAYS.includes(now.weekday) ? 'No classes are left today.' : `It’s ${now.weekday}, so there are no classes today.`;
    return {
      title: 'Timetable',
      text: `${dayNote} The next school day is ${nextDay}${first ? `, starting with ${first.subject || `Period ${first.period}`} at ${first.start}` : ''}.`,
      records: first ? timetableCards([first]) : [],
      memory,
    };
  }

  if (!DAYS.includes(targetDay)) {
    const first = lessons.filter(row => row.day === 'Monday').sort((a, b) => a.period - b.period)[0];
    return {
      title: 'Timetable',
      text: `It’s ${now.weekday}, so there are no classes today. The next school day is Monday${first ? `, starting with ${first.subject || `Period ${first.period}`} at ${first.start}` : ''}.`,
      records: first ? timetableCards([first]) : [],
      memory,
    };
  }
  if (!dayRows.length) {
    return { title: 'Timetable', text: `No periods are published for ${targetDay}.`, records: [], memory };
  }
  const lines = dayRows.map(row => row.isBreak
    ? `• ${row.start}–${row.end} ${row.breakLabel || 'Break'}`
    : `• ${row.start}–${row.end} ${row.subject || `Period ${row.period}`}${row.room ? ` — ${row.room}` : ''}${row.teacher ? ` (${row.teacher})` : ''}${row.status === 'cancelled' ? ' — cancelled' : row.status === 'substituted' && row.substitutionTeacher ? ` — covered by ${row.substitutionTeacher}` : ''}`);
  const lessonCount = dayRows.filter(row => !row.isBreak).length;
  return {
    title: 'Timetable',
    text: `${targetDay} has ${lessonCount} ${lessonCount === 1 ? 'period' : 'periods'}:\n${lines.join('\n')}`,
    records: timetableCards(dayRows),
    memory,
  };
}

const ANNOUNCEMENT_STOPWORDS = new Set([
  'what', 'whats', 'new', 'announcement', 'announcements', 'notice', 'notices', 'any', 'anything',
  'about', 'the', 'are', 'there', 'in', 'for', 'is', 'unread', 'read', 'show', 'list', 'tell', 'me',
  'latest', 'recent', 'today', 'this', 'week', 'from', 'have', 'has', 'been', 'posted', 'published',
]);

function answerAnnouncements(message: string, rows: readonly AnnouncementRow[]): ToolAnswer {
  const value = normalize(message);
  const memory: ToolMemory = { lastModule: 'announcements' };
  if (!rows.length) {
    return { title: 'Announcements', text: 'There are no announcements published for your account right now.', records: [], memory };
  }
  const unreadOnly = /\bunread\b|\bnot read\b|\bhaven'?t read\b/.test(value);
  const terms = value.split(' ').filter(word => word.length >= 3 && !ANNOUNCEMENT_STOPWORDS.has(word));
  const keyed = terms.length
    ? rows.filter(row => terms.some(term => normalize([row.title, row.content, row.category].join(' ')).includes(term)))
    : [];
  const scoped = (keyed.length ? keyed : rows).filter(row => (unreadOnly ? !row.isRead : true));

  if (!scoped.length) {
    return {
      title: 'Announcements',
      text: unreadOnly
        ? `You’re up to date — none of the ${rows.length} announcements for your account are unread.`
        : 'Nothing matches that in the announcements for your account.',
      records: [],
      memory,
    };
  }

  const shown = scoped.slice(0, 5);
  const lead = scoped.length === 1 ? 'There’s one announcement' : `There are ${scoped.length} announcements`;
  const lines = shown.map(row => `• ${row.title} — ${row.category.replace(/_/g, ' ')}, ${formatDate(row.publishedAt.slice(0, 10))}${row.priority !== 'normal' ? `, ${row.priority}` : ''}${row.isEmergency ? ' (emergency)' : ''}`);
  return {
    title: 'Announcements',
    text: [`${lead}${unreadOnly ? ' unread' : ''}:`, ...lines].join('\n'),
    records: shown.map(row => ({
      id: `announcement-${row.id}`,
      title: row.title,
      subtitle: [row.category.replace(/_/g, ' '), row.author].filter(Boolean).join(' · '),
      meta: [formatDate(row.publishedAt.slice(0, 10))],
      status: row.isEmergency ? 'emergency' : row.priority,
    })),
    memory,
  };
}

/**
 * Answer one module question from an authorized snapshot. A missing module means the host app could
 * not read it for this account, which is reported rather than guessed.
 */
export function answerPortalRequest(
  message: string,
  module: PortalModule,
  snapshot: PortalSnapshot | null,
  memory?: ToolMemory,
  clock: PortalClock = { now: Date.now(), timeZone: 'UTC' }
): ToolAnswer {
  if (!snapshot) {
    return { title: MODULE_TITLE[module], text: MODULE_UNAVAILABLE[module], records: [], memory: memory || { lastModule: module } };
  }
  if (module === 'attendance') {
    const rows = shapeAttendance(snapshot.attendance);
    return rows ? answerAttendance(message, rows) : { title: MODULE_TITLE.attendance, text: MODULE_UNAVAILABLE.attendance, records: [], memory: { lastModule: 'attendance' } };
  }
  if (module === 'assignments') {
    const rows = shapeAssignments(snapshot.assignments);
    return rows ? answerAssignments(message, rows, memory) : { title: MODULE_TITLE.assignments, text: MODULE_UNAVAILABLE.assignments, records: [], memory: { lastModule: 'assignments' } };
  }
  if (module === 'timetable') {
    const rows = shapeTimetable(snapshot.timetable);
    return rows ? answerTimetable(message, rows, clock) : { title: MODULE_TITLE.timetable, text: MODULE_UNAVAILABLE.timetable, records: [], memory: { lastModule: 'timetable' } };
  }
  if (module === 'announcements') {
    const rows = shapeAnnouncements(snapshot.announcements);
    return rows ? answerAnnouncements(message, rows) : { title: MODULE_TITLE.announcements, text: MODULE_UNAVAILABLE.announcements, records: [], memory: { lastModule: 'announcements' } };
  }
  const rows = shapeContacts(snapshot.contacts);
  return rows ? answerContacts(message, rows) : { title: MODULE_TITLE.contacts, text: MODULE_UNAVAILABLE.contacts, records: [], memory: { lastModule: 'contacts' } };
}
