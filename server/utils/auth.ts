import crypto from 'node:crypto';

const SECRET_KEY = process.env.SESSION_SECRET || 'veritas-local-dev-secret-key-2026-x99';

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
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
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
    .createHmac('sha256', SECRET_KEY)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;
    const expectedSig = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(data)
      .digest('base64url');
    if (signature !== expectedSig) return null;
    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
