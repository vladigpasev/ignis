import type { NextRequest } from "next/server";

// Global maintenance mode: block all routes and return a static page.
export async function middleware(_request: NextRequest) {
  const html = `<!doctype html>
  <html lang="bg">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,nofollow,noarchive" />
      <title>Сайтът е в режим на поддръжка</title>
      <style>
        :root { --bg1:#0ea5e9; --bg2:#6366f1; --text:#0b1220; --card:#ffffff; --muted:#4b5563; }
        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body {
          margin: 0;
          color: var(--text);
          background: radial-gradient(1200px 800px at 10% 10%, rgba(255,255,255,0.08), transparent),
                      radial-gradient(1200px 800px at 90% 90%, rgba(255,255,255,0.08), transparent),
                      linear-gradient(135deg, var(--bg1), var(--bg2));
          display: grid;
          place-items: center;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }
        .card {
          width: min(680px, 92vw);
          backdrop-filter: blur(12px) saturate(120%);
          background: color-mix(in oklab, var(--card) 86%, transparent);
          border: 1px solid rgba(255,255,255,0.35);
          box-shadow: 0 20px 60px rgba(2, 8, 23, 0.35), inset 0 1px 0 rgba(255,255,255,0.2);
          border-radius: 18px;
          padding: 28px 28px 26px;
          text-align: center;
        }
        .logo {
          width: 56px; height: 56px; border-radius: 14px;
          background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6));
          box-shadow: 0 10px 30px rgba(2, 8, 23, 0.25);
          display: grid; place-items: center; margin: 0 auto 18px;
        }
        .logo span { font-weight: 800; font-size: 20px; letter-spacing: 0.5px; color: #0f172a; }
        h1 { margin: 10px 0 10px; font-size: clamp(24px, 3.2vw, 34px); line-height: 1.15; }
        p  { margin: 0 auto; max-width: 52ch; color: var(--muted); font-size: 16px; }
        .pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 12px; border-radius: 999px;
          background: rgba(255,255,255,0.66);
          border: 1px solid rgba(15, 23, 42, 0.08);
          color: #0f172a; font-weight: 600; font-size: 13px; letter-spacing: .2px;
          margin-bottom: 10px;
        }
        .footer { margin-top: 18px; font-size: 13px; color: rgba(15, 23, 42, 0.7); }
      </style>
    </head>
    <body>
      <main class="card" role="main" aria-label="Сайтът е в режим на поддръжка">
        <div class="pill" aria-hidden="true">⚙️ Планирана поддръжка</div>
        <div class="logo"><span>IG</span></div>
        <h1>Сайтът е временно недостъпен</h1>
        <p>
          В момента извършваме подобрения и подготовка за следващата версия.
          Достъпът до всички страници и услуги е временно ограничен.
          Благодарим за търпението и разбирането!
        </p>
        <div class="footer">Ще се върнем съвсем скоро.</div>
      </main>
    </body>
  </html>`;

  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "Retry-After": "86400",
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "Content-Security-Policy": [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        "img-src 'self' data:",
        "connect-src 'none'",
        "font-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ].join('; '),
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
      // HSTS is safe if site is on HTTPS (e.g., Vercel)
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    },
  });
}

export const config = {
  // Intercept absolutely everything to ensure nothing else runs
  matcher: ["/:path*"],
};
