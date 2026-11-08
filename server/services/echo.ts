import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { buildEchoReply, generateProviderReply, LOCAL_PROVIDER, rememberProviderUsage } from './echoConversation.js';

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
  sub: string;
  exp: number;
}

/** Authenticated portal identity, resolved by the host app from its own session cookie/token. */
export interface EchoIdentity {
  sub: string;
  role: 'student' | 'teacher' | 'coordinator' | 'principal';
  name?: string;
}

export interface EchoRouterOptions {
  /** Secure by default: without an authenticator, every session endpoint denies access. */
  authenticate?: (req: Request) => EchoIdentity | null;
  allowedOrigins?: readonly string[];
}

/**
 * No shipped fallback secret. A configured secret is hashed into the ECHO key; otherwise an
 * unguessable per-process key is used. Tokens and history are process-local by design.
 */
const ECHO_SESSION_SECRET = (() => {
  const configured = (process.env.ECHO_SESSION_SECRET || process.env.SESSION_SECRET || '').trim();
  return configured
    ? crypto.createHash('sha256').update('echo-session:' + configured).digest()
    : crypto.randomBytes(32);
})();
const SESSION_TTL_SECONDS = 1800;
const MAX_SESSIONS = 1000;
const MAX_REVOKED = 5000;
const MAX_MESSAGES_PER_MINUTE = 30;
const ALLOWED_BODY_FIELDS = new Set(['message', 'page']);

const sessionHistory = new Map<string, Array<{ user: string; assistant: string }>>();
const revokedSessionIds = new Set<string>();
const messageTimestamps = new Map<string, number[]>();

function rememberSession(sid: string, history: Array<{ user: string; assistant: string }> = []) {
  if (!sessionHistory.has(sid) && sessionHistory.size >= MAX_SESSIONS) {
    const oldest = sessionHistory.keys().next().value;
    if (oldest !== undefined) sessionHistory.delete(oldest);
  }
  sessionHistory.set(sid, history);
}

function revokeSession(sid: string) {
  if (revokedSessionIds.size >= MAX_REVOKED) {
    const oldest = revokedSessionIds.values().next().value;
    if (oldest !== undefined) revokedSessionIds.delete(oldest);
  }
  revokedSessionIds.add(sid);
  sessionHistory.delete(sid);
}

function allowMessage(sub: string): boolean {
  const now = Date.now();
  const recent = (messageTimestamps.get(sub) || []).filter(at => now - at < 60_000);
  if (recent.length >= MAX_MESSAGES_PER_MINUTE) return false;
  recent.push(now);
  messageTimestamps.set(sub, recent);
  if (messageTimestamps.size > MAX_SESSIONS) {
    const oldest = messageTimestamps.keys().next().value;
    if (oldest !== undefined) messageTimestamps.delete(oldest);
  }
  return true;
}

function createEchoSessionToken(siteId: string, sub: string): { token: string; sid: string } {
  const sid = crypto.randomBytes(18).toString('base64url');
  const payload: EchoSessionPayload = {
    sid,
    siteId,
    sub,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ECHO_SESSION_SECRET).update(encoded).digest('base64url');
  return { token: `${encoded}.${sig}`, sid };
}

function verifyEchoSessionToken(token: string, expectedSiteId: string): EchoSessionPayload | null {
  try {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const parts = token.split('.');
    // Exactly two segments: a valid token plus any suffix is rejected.
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    if (!encoded || !sig) return null;
    const expectedSig = crypto.createHmac('sha256', ECHO_SESSION_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Partial<EchoSessionPayload>;
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.sid !== 'string' || payload.sid.length < 10 || payload.sid.length > 128) return null;
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) return null;
    if (payload.siteId !== expectedSiteId) return null;
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp) || !Number.isInteger(payload.exp)) return null;
    const now = Date.now();
    if (payload.exp <= now || payload.exp > now + SESSION_TTL_SECONDS * 1000 + 60_000) return null;
    if (revokedSessionIds.has(payload.sid)) return null;
    return payload as EchoSessionPayload;
  } catch {
    return null;
  }
}

function configuredOrigins(): string[] {
  const raw = (process.env.ECHO_ALLOWED_ORIGINS || process.env.APP_ORIGIN || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  return raw.filter(value => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  });
}

function originAllowed(req: Request, extra: readonly string[]): boolean {
  const origin = req.headers.origin;
  // Non-browser clients and same-origin navigations may omit Origin. Identity is still required.
  if (!origin) return true;
  if (origin === 'null') return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return false;
  const normalized = parsed.origin;
  const host = String(req.headers.host || '').toLowerCase();
  if (host && parsed.host.toLowerCase() === host) return true;
  if (configuredOrigins().includes(normalized) || extra.some(value => value.replace(/\/$/, '') === normalized)) {
    return true;
  }
  // Loopback development servers (the Vite proxy changes Host) outside production only.
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  return loopback && parsed.protocol === 'http:' && process.env.NODE_ENV !== 'production';
}

export function createEchoServiceRouter(options: EchoRouterOptions = {}): Router {
  const router = Router();
  const authenticate = options.authenticate ?? (() => null);
  const extraOrigins = options.allowedOrigins ?? [];

  router.use((req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!originAllowed(req, extraOrigins)) {
      res.status(403).json({ error: 'Origin is not approved for this ECHO site.' });
      return;
    }
    const origin = req.headers.origin;
    if (origin && origin !== 'null') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

  const requireIdentity = (req: Request, res: Response): EchoIdentity | null => {
    let identity: EchoIdentity | null = null;
    try {
      identity = authenticate(req);
    } catch {
      identity = null;
    }
    if (!identity || typeof identity.sub !== 'string' || !identity.sub) {
      res.status(401).json({ error: 'Sign in to the portal to use ECHO.' });
      return null;
    }
    return identity;
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
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const { token, sid } = createEchoSessionToken(siteId, identity.sub);
    rememberSession(sid);
    res.status(201).json({
      session_token: token,
      expires_in: SESSION_TTL_SECONDS,
    });
  });

  router.delete('/:siteId/sessions/current', (req: Request, res: Response) => {
    const siteId = validateSite(req, res);
    if (!siteId) return;
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const session = verifyEchoSessionToken(token, siteId);
    if (!session || session.sub !== identity.sub) {
      res.status(401).json({ error: 'Session expired or invalid.' });
      return;
    }
    revokeSession(session.sid);
    res.json({});
  });

  router.post('/:siteId/messages', async (req: Request, res: Response) => {
    const siteId = validateSite(req, res);
    if (!siteId) return;
    const identity = requireIdentity(req, res);
    if (!identity) return;
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const session = verifyEchoSessionToken(token, siteId);
    if (!session || session.sub !== identity.sub) {
      res.status(401).json({ error: 'Session expired or invalid.' });
      return;
    }

    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
    if (Object.keys(body).some(key => !ALLOWED_BODY_FIELDS.has(key))) {
      res.status(400).json({ error: 'Unsupported request field.' });
      return;
    }
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message || message.length > 4000) {
      res.status(400).json({ error: 'Provide a valid message up to 4000 characters.' });
      return;
    }
    // Page context only phrases a conversational reply; it never grants permissions or executes actions.
    if (body.page !== undefined && (typeof body.page !== 'string' || body.page.length > 100 || !/^\/[a-z0-9\-/]*$/.test(body.page))) {
      res.status(400).json({ error: 'Invalid page context.' });
      return;
    }
    if (!allowMessage(identity.sub)) {
      res.status(429).json({ error: 'Too many ECHO messages. Please wait a moment and try again.' });
      return;
    }

    const history = sessionHistory.get(session.sid) || [];
    const abortController = new AbortController();
    // IncomingMessage 'close' fires when the request body completes, which would abort the
    // provider call itself. Only an unfinished response means the client actually disconnected.
    res.on('close', () => { if (!res.writableEnded) abortController.abort(); });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    try {
      const context = {
        name: identity.name,
        role: identity.role,
        page: typeof body.page === 'string' ? body.page : undefined,
      };
      const providerReply = await generateProviderReply(message, history, context, abortController.signal).catch(() => null);
      const reply = providerReply || { ...buildEchoReply(message, history, context), provider: LOCAL_PROVIDER };
      if (!reply.provider || reply.provider.id === 'local-guidance') rememberProviderUsage(LOCAL_PROVIDER);

      history.push({ user: message, assistant: reply.text });
      if (history.length > 10) history.splice(0, history.length - 10);
      rememberSession(session.sid, history);

      // Provider attribution is explicit so the UI/tests can verify which brain answered.
      if (!res.writableEnded && !res.destroyed) {
        res.write(`event: meta\ndata: ${JSON.stringify({ provider: reply.provider || LOCAL_PROVIDER })}\n\n`);
      }

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
