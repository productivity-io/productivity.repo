interface PortalModeEnv {
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  PORTAL_DEMO_MODE?: string;
}

/**
 * Returns true when running in production mode without explicit demo override.
 * When PORTAL_DEMO_MODE is set to 'true', demo credentials and helper panels stay available.
 */
export function isProductionPortal(env: PortalModeEnv = process.env): boolean {
  if (env.PORTAL_DEMO_MODE === 'true') {
    return false;
  }
  if (env.PORTAL_DEMO_MODE === 'false') {
    return true;
  }
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL) || env.VERCEL_ENV === 'production';
}
