export function getAppBaseUrl(): string {
  // Client-side: prefer public env, fallback to window.location.origin
  if (typeof window !== 'undefined') {
    // NEXT_PUBLIC_* are inlined at build time; cast to string if present
    const fromEnv = process.env.NEXT_PUBLIC_APP_BASE_URL as unknown as string | undefined;
    if (fromEnv && fromEnv.length) return fromEnv.replace(/\/$/, '');
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/$/, '');
  }

  // Server-side: prefer sane production defaults, avoid localhost in prod
  const envBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const vercelBase = vercelUrl && vercelUrl.length
    ? (vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`)
    : undefined;

  // In production: if envBase points to localhost, prefer Vercel domain when available
  if (process.env.NODE_ENV === 'production') {
    if (vercelBase) {
      if (!envBase) return vercelBase.replace(/\/$/, '');
      const lower = envBase.toLowerCase();
      if (lower.includes('localhost') || lower.includes('127.0.0.1')) {
        return vercelBase.replace(/\/$/, '');
      }
    }
  }

  // Otherwise, trust explicit env, then Vercel URL
  if (envBase && envBase.length) return envBase.replace(/\/$/, '');
  if (vercelBase) return vercelBase.replace(/\/$/, '');

  // Fallback for local dev
  return 'http://localhost:3000';
}

export function withBase(path: string): string {
  const base = getAppBaseUrl();
  if (!path) return base;
  // Ensure exactly one slash between base and path
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
