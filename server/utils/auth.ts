import crypto from 'node:crypto';

const ROLES = new Set(['student', 'teacher', 'coordinator', 'principal']);
const DEV_SECRET = crypto.randomBytes(32).toString('base64url');
let cachedSecret: string | null = null;

interface SecretEnv {
  SESSION_SECRET?: string;
  NODE_ENV?: string;
  VERCEL?: string;
}

function productionRuntime(env: SecretEnv): boolean {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL);
}

/**
 * Returns a configuration problem, or null when the secret is usable.
 * Production never falls back to a shipped or per-process default: that would either be public
 * or invalidate every session on the next serverless instance.
 */
export function sessionSecretIssue(env: SecretEnv = process.env): string | null {
  const configured = (env.SESSION_SECRET || '').trim();
  if (configured) {
    if (productionRuntime(env) && Buffer.byteLength(configured, 'utf8') < 32) {
      return 'SESSION_SECRET must contain at least 32 characters in production.';
    }
    return null;
  }
  return productionRuntime(env)
    ? 'SESSION_SECRET is required in production; refusing to sign sessions with a default secret.'
    : null;
}

/** Fail fast at server startup when a production deployment is missing its signing secret. */
export function assertSessionSecretConfigured(env: SecretEnv = process.env): void {
  const issue = sessionSecretIssue(env);
  if (issue) throw new Error(issue);
}

function secretKey(): string {
  if (cachedSecret) return cachedSecret;
  assertSessionSecretConfigured();
  const configured = (process.env.SESSION_SECRET || '').trim();
  cachedSecret = configured || DEV_SECRET;
  return cachedSecret;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return keyBuffer.length === derivedKey.length && crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export interface SessionPayload {
  userId: number;
  role: 'student' | 'teacher' | 'coordinator' | 'principal';
  schoolId: string;
  exp: number;
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>, rememberMe = false): string {
  const exp = Date.now() + (rememberMe ? 30 * 24 * 3600 * 1000 : 24 * 3600 * 1000);
  const fullPayload: SessionPayload = { ...payload, exp };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', secretKey())
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [data, signature, ...rest] = token.split('.');
    if (!data || !signature || rest.length) return null;
    const expectedSig = crypto
      .createHmac('sha256', secretKey())
      .update(data)
      .digest('base64url');
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSig);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;

    const payload: unknown = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object') return null;
    const candidate = payload as Partial<SessionPayload>;
    if (!Number.isSafeInteger(candidate.userId) || (candidate.userId as number) <= 0) return null;
    if (typeof candidate.role !== 'string' || !ROLES.has(candidate.role)) return null;
    if (typeof candidate.schoolId !== 'string' || !candidate.schoolId.trim()) return null;
    if (!Number.isFinite(candidate.exp) || (candidate.exp as number) < Date.now()) return null;
    return candidate as SessionPayload;
  } catch {
    return null;
  }
}
