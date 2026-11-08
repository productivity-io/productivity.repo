const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface OriginPolicyEnv {
  NODE_ENV?: string;
  VERCEL?: string;
  APP_ORIGIN?: string;
  PUBLIC_APP_ORIGIN?: string;
  ECHO_ALLOWED_ORIGINS?: string;
  VERCEL_URL?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
}

/** Return the canonical http(s) origin, or null for malformed or non-origin values. */
export function normalizeHttpOrigin(value: string): string | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    if (parsed.pathname !== '/') return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

function productionRuntime(env: OriginPolicyEnv): boolean {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL);
}

function configuredOrigins(env: OriginPolicyEnv): Set<string> {
  const values = [
    env.APP_ORIGIN,
    env.PUBLIC_APP_ORIGIN,
    env.VERCEL_URL ? `https://${env.VERCEL_URL}` : undefined,
    env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    ...(env.ECHO_ALLOWED_ORIGINS || '').split(','),
  ];
  const origins = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeHttpOrigin(value);
    if (normalized) origins.add(normalized);
  }
  return origins;
}

/**
 * Browser requests are accepted only from this deployment's host, an explicitly configured
 * origin, or loopback during local development. Non-browser clients may omit Origin; identity
 * is still required by the API.
 */
export function isAllowedPortalOrigin(
  origin: string | undefined,
  host: string | undefined,
  env: OriginPolicyEnv = process.env
): boolean {
  if (!origin) return true;
  if (origin === 'null') return false;
  const normalized = normalizeHttpOrigin(origin);
  if (!normalized) return false;

  const parsed = new URL(normalized);
  const requestHost = String(host || '').trim().toLowerCase();
  if (requestHost && parsed.host.toLowerCase() === requestHost) return true;
  if (configuredOrigins(env).has(normalized)) return true;

  return (
    !productionRuntime(env) &&
    parsed.protocol === 'http:' &&
    LOOPBACK_HOSTS.has(parsed.hostname)
  );
}
