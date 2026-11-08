interface PortalModeEnv {
  NODE_ENV?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
}

/** Vercel previews are production builds too, so demo credentials stay disabled there. */
export function isProductionPortal(env: PortalModeEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || Boolean(env.VERCEL) || env.VERCEL_ENV === 'production';
}
