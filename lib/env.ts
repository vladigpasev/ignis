export function getAppBaseUrl(): string {
  // Client-side: prefer public env, fallback to window.location.origin
  if (typeof window !== 'undefined') {
    // NEXT_PUBLIC_* are inlined at build time; cast to string if present
    const fromEnv = process.env.NEXT_PUBLIC_APP_BASE_URL as unknown as string | undefined;
    if (fromEnv && fromEnv.length) return fromEnv.replace(/\/$/, '');
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin.replace(/\/$/, '');
  }

  // Server-side: prefer explicit APP_BASE_URL, then NEXT_PUBLIC_*, then Vercel URL
  const envBase = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_BASE_URL;
  if (envBase && envBase.length) return envBase.replace(/\/$/, '');

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && vercelUrl.length) {
    const withProto = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
    return withProto.replace(/\/$/, '');
  }

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

