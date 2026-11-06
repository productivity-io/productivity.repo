export type EchoWidgetConfig =
  | { enabled: false }
  | { enabled: true; siteId: string; apiBaseUrl: string };

export function getEchoWidgetConfig(env: NodeJS.ProcessEnv = process.env): EchoWidgetConfig {
  if (env.ECHO_CHAT_ENABLED !== 'true') return { enabled: false };

  const siteId = env.ECHO_SITE_ID || '';
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(siteId)) {
    throw new Error('Configure a valid ECHO_SITE_ID.');
  }
  const api = new URL(env.ECHO_API_URL || '');
  const localHttp = api.protocol === 'http:' && env.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname);
  if ((!localHttp && api.protocol !== 'https:') || api.username || api.password
    || api.search || api.hash || !['', '/'].includes(api.pathname)) {
    throw new Error('Configure an HTTPS ECHO API origin; local HTTP is development-only.');
  }
  return { enabled: true, siteId, apiBaseUrl: api.origin };
}
