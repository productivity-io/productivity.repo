import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';

export type EchoWidgetConfig =
  | { enabled: false }
  | { enabled: true; siteId: string; apiBaseUrl: string };

const SITE_ID_PATTERN = /^[a-z][a-z0-9-]{1,62}$/;
const PLACEHOLDER_API_URLS = new Set([
  '',
  'https://echo-api.example.com',
  'https://echo-api.example.com/',
  'https://your-echo-api.example.com',
  'https://your-echo-api.example.com/',
]);

/**
 * Validates explicit external ECHO configuration.
 * Preserves strict behavior covered by unit tests.
 */
export function getEchoWidgetConfig(env: NodeJS.ProcessEnv = process.env): EchoWidgetConfig {
  if (env.ECHO_CHAT_ENABLED !== 'true') return { enabled: false };

  const siteId = env.ECHO_SITE_ID || '';
  if (!SITE_ID_PATTERN.test(siteId)) {
    throw new Error('Configure a valid ECHO_SITE_ID.');
  }
  const api = new URL(env.ECHO_API_URL || '');
  const localHttp =
    api.protocol === 'http:' &&
    env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
  if (
    (!localHttp && api.protocol !== 'https:') ||
    api.username ||
    api.password ||
    api.search ||
    api.hash ||
    !['', '/'].includes(api.pathname)
  ) {
    throw new Error('Configure an HTTPS ECHO API origin; local HTTP is development-only.');
  }
  return { enabled: true, siteId, apiBaseUrl: api.origin };
}

/**
 * Resolves the active ECHO configuration for the authenticated portal endpoint `/api/echo/config`.
 * - Set `ECHO_CHAT_ENABLED=false` to disable ECHO completely.
 * - Set `ECHO_CHAT_ENABLED=true` + `ECHO_API_URL=https://...` to connect to a dedicated external ECHO server.
 * - Otherwise defaults to the built-in self-hosted `/api/echo` engine so ECHO works out-of-the-box locally and on Vercel.
 */
export function resolvePortalEchoConfig(env: NodeJS.ProcessEnv = process.env): EchoWidgetConfig {
  if (env.ECHO_CHAT_ENABLED === 'false') {
    return { enabled: false };
  }

  const rawApiUrl = (env.ECHO_API_URL || '').trim();
  if (env.ECHO_CHAT_ENABLED === 'true' && rawApiUrl && !PLACEHOLDER_API_URLS.has(rawApiUrl)) {
    return getEchoWidgetConfig(env);
  }

  if (env.ECHO_CHAT_ENABLED === 'true' && !rawApiUrl && env.ECHO_REQUIRE_EXTERNAL === 'true') {
    throw new Error('Configure an HTTPS ECHO API origin; local HTTP is development-only.');
  }

  const siteId = (env.ECHO_SITE_ID || 'productivity-portal').trim();
  if (!SITE_ID_PATTERN.test(siteId)) {
    throw new Error('Configure a valid ECHO_SITE_ID.');
  }

  return {
    enabled: true,
    siteId,
    apiBaseUrl: '/api/echo',
  };
}

// ==========================================
// Built-in Self-Hosted ECHO v1 Service Engine
// ==========================================

interface EchoSessionPayload {
  sid: string;
  siteId: string;
  exp: number;
}

interface KnowledgeEntry {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
}

const ECHO_SESSION_SECRET =
  process.env.ECHO_SESSION_SECRET || 'veritas-echo-isolated-chat-session-secret-v1';
const SESSION_TTL_SECONDS = 1800;

const sessionHistory = new Map<string, Array<{ user: string; assistant: string }>>();
const revokedSessionIds = new Set<string>();

function createEchoSessionToken(siteId: string): { token: string; sid: string } {
  const sid = crypto.randomBytes(18).toString('base64url');
  const payload: EchoSessionPayload = {
    sid,
    siteId,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ECHO_SESSION_SECRET).update(encoded).digest('base64url');
  return { token: `${encoded}.${sig}`, sid };
}

function verifyEchoSessionToken(token: string, expectedSiteId: string): EchoSessionPayload | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', ECHO_SESSION_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as EchoSessionPayload;
    if (payload.siteId !== expectedSiteId || payload.exp < Date.now()) return null;
    if (revokedSessionIds.has(payload.sid)) return null;
    return payload;
  } catch {
    return null;
  }
}

const PORTAL_KNOWLEDGE: readonly KnowledgeEntry[] = [
  {
    id: 'echo-commands',
    title: 'ECHO Quick Commands & Navigation',
    keywords: ['command', 'commands', 'navigate', 'navigation', 'shortcut', 'open', 'filter', 'search', 'what can you do', 'help', 'features'],
    answer:
      'You can type direct portal commands right here in ECHO to jump to pages or filter views instantly:\n' +
      '• Open any module: "Open attendance", "Open assignments", "Open library", "Open timetable", or "Open calendar"\n' +
      '• Filter current views: "Show unread announcements", "Show sports events", "Show overdue assignments", "Show Monday timetable", or "Show report card"\n' +
      '• Search & reset: "Search books for physics", "Find science in library", "Clear filters", or "Go back"',
  },
  {
    id: 'attendance-guide',
    title: 'Attendance & Correction Requests',
    keywords: ['attendance', 'absent', 'present', 'late', 'excused', 'percentage', 'correction', 'shortage', '75%', '85%'],
    answer:
      'In the Attendance module (/attendance), students can review daily attendance, subject-wise attendance percentages, and monthly logs. ' +
      'If an entry looks inaccurate, students can submit an Attendance Correction Request from the "Corrections" tab with a reason—teachers and coordinators review and approve or decline requests. ' +
      'Type "Open attendance" or "Show subject attendance" to jump straight there.',
  },
  {
    id: 'assignments-homework',
    title: 'Homework & Assignments',
    keywords: ['assignment', 'assignments', 'homework', 'submit', 'submission', 'grade', 'graded', 'overdue', 'upload', 'due date'],
    answer:
      'The Assignments module (/assignments) lists all class assignments with instructions, attachments, due dates, and maximum marks. ' +
      'Students can submit text responses and upload supporting files, then track statuses from Assigned → Submitted → Graded with teacher remarks. ' +
      'Teachers can create assignments and grade student submissions. Try typing "Open assignments" or "Show overdue assignments".',
  },
  {
    id: 'timetable-schedule',
    title: 'Class Timetable & Substitutions',
    keywords: ['timetable', 'schedule', 'period', 'class time', 'substitution', 'cancelled', 'room', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    answer:
      'The Timetable module (/timetable) shows both Weekly and Daily schedules, including subjects, faculty names, room numbers, break periods, and live substitution or cancelled-class notices. ' +
      'Coordinators can assign substitute faculty or update period statuses. Try typing "Open timetable" or "Show Monday timetable".',
  },
  {
    id: 'exams-results',
    title: 'Examinations & Report Cards',
    keywords: ['exam', 'exams', 'examination', 'examinations', 'result', 'results', 'marks', 'report card', 'grades', 'rank', 'syllabus'],
    answer:
      'The Examinations module (/examinations) provides subject-wise marks, term exam schedules with room and syllabus notes, and printable official Report Cards. ' +
      'Teachers and coordinators can enter or update exam marks for their classes. Try typing "Open examinations" or "Show report card".',
  },
  {
    id: 'leave-requests',
    title: 'Leave Applications & Approvals',
    keywords: ['leave', 'leaves', 'sick', 'medical', 'absence', 'apply for leave', 'vacation', 'permission'],
    answer:
      'To apply for leave, open Leave Requests (/leave-requests), choose start and end dates, select the leave type (Medical, Family, Academic Event, etc.), attach optional supporting documents, and submit. ' +
      'Teachers, Academic Coordinators, and the Principal can review pending leave requests and record approval remarks. Try typing "Open leave requests".',
  },
  {
    id: 'library-catalogue',
    title: 'Library Catalogue & Book Issues',
    keywords: ['library', 'book', 'books', 'isbn', 'borrow', 'issue', 'return', 'fine', 'overdue book', 'catalogue', 'catalog'],
    answer:
      'The Library module (/library) lets you search available books by title, author, category, or ISBN, check rack locations, and view active book issue history, due dates, and return statuses. ' +
      'Try typing "Search books for physics" or "Show issue history".',
  },
  {
    id: 'announcements-alerts',
    title: 'Announcements & Emergency Alerts',
    keywords: ['announcement', 'announcements', 'notice', 'notices', 'alert', 'emergency', 'circular', 'unread'],
    answer:
      'Announcements (/announcements) displays school-wide circulars, academic updates, event notices, and high-priority Emergency Alerts. ' +
      'Coordinator announcements flow through Principal executive approval, while Emergency Alerts highlight critical instructions at the top of the portal. ' +
      'Try typing "Open announcements" or "Show unread announcements".',
  },
  {
    id: 'transport-buses',
    title: 'School Transport & Bus Routes',
    keywords: ['transport', 'bus', 'buses', 'route', 'driver', 'pickup', 'drop', 'attendant', 'delay'],
    answer:
      'The Transport module (/transport) shows assigned bus numbers, morning and afternoon departure timings, stop schedules, driver and bus attendant contact details, and a form to report transport issues. ' +
      'Type "Open transport" to view route details.',
  },
  {
    id: 'portfolio-achievements',
    title: 'Student Portfolio & Achievements',
    keywords: ['portfolio', 'achievement', 'achievements', 'certificate', 'award', 'project', 'skills', 'extracurricular'],
    answer:
      'The Student Portfolio (/portfolio) showcases academic awards, projects, sports and cultural achievements, skills, and teacher feedback, with a print/export presentation mode. ' +
      'Students can submit new portfolio entries for faculty verification. Try typing "Open portfolio" or "Show sports achievements".',
  },
  {
    id: 'lost-found-contacts-comm',
    title: 'Communication, Contacts & Lost and Found',
    keywords: ['contact', 'contacts', 'communication', 'message', 'teacher', 'lost', 'found', 'principal office', 'it support'],
    answer:
      '• Communication (/communication): Request a conversation with a subject teacher or coordinator and message once accepted.\n' +
      '• Quick Contacts (/contacts): Directory of faculty, coordinator, Principal’s Office, transport desk, library, and IT support.\n' +
      '• Lost & Found (/lost-and-found): Report lost or found campus items and submit claim requests.',
  },
  {
    id: 'assistant-scope',
    title: 'Assistant Scope & Privacy',
    keywords: ['password', 'reset', 'private', 'record', 'change my marks', 'delete', 'who am i', 'account', 'policy', 'privacy'],
    answer:
      'ECHO provides general portal navigation and workflow guidance from approved help content. For privacy and security, ECHO cannot view or modify private student records, marks, attendance entries, messages, or passwords. ' +
      'To update your password or preferences, type "Open profile", or contact school staff for official academic changes.',
  },
];

function buildLocalEchoReply(
  message: string,
  history: Array<{ user: string; assistant: string }>
): { text: string; references: Array<{ title: string }> } {
  const lower = message.toLowerCase().trim();

  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(lower)) {
    return {
      text:
        'Hello! I am ECHO, your Veritas portal assistant. I can explain how any module works or navigate the portal for you—try asking "How do I apply for leave?" or typing commands like "Open attendance" or "Search books for physics".',
      references: [{ title: 'ECHO Quick Commands & Navigation' }],
    };
  }

  const scored = PORTAL_KNOWLEDGE.map(entry => {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) {
        score += kw.includes(' ') ? 3 : 2;
      }
    }
    return { entry, score };
  })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const top = scored.slice(0, 2);
    const text = top.map(item => item.entry.answer).join('\n\n');
    return {
      text,
      references: top.map(item => ({ title: item.entry.title })),
    };
  }

  if (history.length > 0 && /\b(more|else|that|it|again|follow[- ]?up)\b/.test(lower)) {
    const prev = history[history.length - 1];
    return {
      text:
        `Following up on "${prev.user}": you can jump directly to any module by typing "Open <module name>" (for example, "Open dashboard", "Open calendar", or "Open communication"), or ask me about attendance, assignments, exams, leave requests, library books, or transport.`,
      references: [{ title: 'ECHO Quick Commands & Navigation' }],
    };
  }

  return {
    text:
      'I can help you navigate the Veritas school portal and explain its workflows. Ask me about Attendance, Assignments, Timetable, Examinations, Leave Requests, Library, Transport, Portfolio, Lost & Found, or Announcements—or type a command like "Open timetable" or "Search books for physics".',
    references: [
      { title: 'ECHO Quick Commands & Navigation' },
      { title: 'Assistant Scope & Privacy' },
    ],
  };
}

async function generateOptionalProviderReply(
  message: string,
  history: Array<{ user: string; assistant: string }>,
  signal: AbortSignal
): Promise<{ text: string; references: Array<{ title: string }> } | null> {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openAiKey) return null;

  const knowledgeContext = PORTAL_KNOWLEDGE.map(k => `[${k.title}]: ${k.answer}`).join('\n');
  const messages = [
    {
      role: 'system',
      content:
        'You are ECHO, the helpful website navigation assistant for Veritas Collegiate Academy portal. ' +
        'Answer concisely using ONLY the approved portal guidance below. Never claim to read or alter private school records.\n\n' +
        knowledgeContext,
    },
    ...history.slice(-4).flatMap(turn => [
      { role: 'user' as const, content: turn.user },
      { role: 'assistant' as const, content: turn.assistant },
    ]),
    { role: 'user' as const, content: message },
  ];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.ECHO_OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: 350,
      temperature: 0.3,
    }),
    signal,
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return null;
  return {
    text,
    references: [{ title: 'Portal navigation' }],
  };
}

export function createEchoServiceRouter(): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  const validateSite = (req: Request, res: Response): string | null => {
    const expectedSite = (process.env.ECHO_SITE_ID || 'productivity-portal').trim();
    const siteId = String(req.params.siteId || '');
    if (!SITE_ID_PATTERN.test(siteId) || siteId !== expectedSite) {
      res.status(404).json({ error: 'Unknown ECHO site configuration.' });
      return null;
    }
    if (process.env.ECHO_CHAT_ENABLED === 'false') {
      res.status(403).json({ error: 'Chat is currently disabled.' });
      return null;
    }
    return siteId;
  };

  router.get('/:siteId/config', (req: Request, res: Response) => {
    if (!validateSite(req, res)) return;
    res.json({
      enabled_capabilities: ['chat'],
      branding: {
        name: 'ECHO',
        accent: '#1d4ed8',
        greeting:
          'Hi! I can help you navigate the school portal. Try commands like “Open attendance”, “Search books for physics”, or ask how any module works.',
      },
    });
  });

  router.post('/:siteId/sessions', (req: Request, res: Response) => {
    const siteId = validateSite(req, res);
    if (!siteId) return;
    const { token, sid } = createEchoSessionToken(siteId);
    sessionHistory.set(sid, []);
    res.status(201).json({
      session_token: token,
      expires_in: SESSION_TTL_SECONDS,
    });
  });

  router.delete('/:siteId/sessions/current', (req: Request, res: Response) => {
    const siteId = validateSite(req, res);
    if (!siteId) return;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const session = verifyEchoSessionToken(token, siteId);
    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid.' });
      return;
    }
    revokedSessionIds.add(session.sid);
    sessionHistory.delete(session.sid);
    res.json({});
  });

  router.post('/:siteId/messages', async (req: Request, res: Response) => {
    const siteId = validateSite(req, res);
    if (!siteId) return;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const session = verifyEchoSessionToken(token, siteId);
    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid.' });
      return;
    }

    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 4000) {
      res.status(400).json({ error: 'Provide a valid message up to 4000 characters.' });
      return;
    }

    const history = sessionHistory.get(session.sid) || [];
    const abortController = new AbortController();
    req.on('close', () => abortController.abort());

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const reply =
        (await generateOptionalProviderReply(message, history, abortController.signal).catch(() => null)) ||
        buildLocalEchoReply(message, history);

      history.push({ user: message, assistant: reply.text });
      if (history.length > 10) history.splice(0, history.length - 10);
      sessionHistory.set(session.sid, history);

      // Stream response chunks smoothly as SSE delta events
      const words = reply.text.split(/(\s+)/);
      const chunkSize = 6;
      for (let i = 0; i < words.length; i += chunkSize) {
        if (res.writableEnded || res.destroyed) return;
        const piece = words.slice(i, i + chunkSize).join('');
        if (piece) {
          res.write(`event: delta\ndata: ${JSON.stringify({ text: piece })}\n\n`);
        }
      }

      if (!res.writableEnded && !res.destroyed) {
        res.end(`event: done\ndata: ${JSON.stringify({ references: reply.references })}\n\n`);
      }
    } catch {
      if (!res.writableEnded && !res.destroyed) {
        res.end(
          `event: error\ndata: ${JSON.stringify({ message: 'Unable to complete chat reply right now.' })}\n\n`
        );
      }
    }
  });

  return router;
}
