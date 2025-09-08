import type { NextRequest } from "next/server";

// Global maintenance mode: block all routes and return a static page.
export async function middleware(_request: NextRequest) {
  const html = `<!doctype html>
  <html lang="bg">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex,nofollow,noarchive" />
      <meta name="theme-color" content="#DD6630" />
      <title>Сайтът е в режим на поддръжка</title>
      <style>
        /* Brand-aligned variables (mirror of app/globals.css) */
        :root {
          --background: #ffffff;
          --foreground: #21272A;
          --card: #ffffff;
          --card-foreground: #21272A;
          --primary: #DD6630; /* brand orange */
          --primary-foreground: #ffffff;
          --secondary: #F5F7FA;
          --muted-foreground: #667085;
          --border: #E6E8EA;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --background: #0F1115;
            --foreground: #F5F7FA;
            --card: #14171B;
            --card-foreground: #F5F7FA;
            --primary: #FFA16D; /* brighter on dark */
            --primary-foreground: #0F1115;
            --secondary: #1B1F24;
            --muted-foreground: #A0A8B0;
            --border: #FFFFFF1A;
          }
        }

        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body {
          margin: 0;
          color: var(--foreground);
          background:
            radial-gradient(900px 500px at 5% 10%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%),
            radial-gradient(900px 500px at 95% 90%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%),
            linear-gradient(180deg, color-mix(in oklab, var(--background) 92%, var(--primary) 8%), var(--background));
          display: grid;
          place-items: center;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }

        /* Subtle grid pattern overlay for depth */
        .grid-overlay {
          position: fixed; inset: 0; pointer-events: none;
          background-image: linear-gradient(to right, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px),
                            linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px);
          background-size: 44px 44px;
          opacity: .06;
        }

        /* Soft glowing orbs behind the card */
        .orbs { position: fixed; inset: 0; pointer-events: none; filter: blur(36px); opacity: .35; }
        .orb { position: absolute; width: 360px; height: 360px; border-radius: 50%; transform: translate(-50%, -50%); }
        .orb.one { left: 20%; top: 18%; background: radial-gradient(circle at 30% 30%, var(--primary), transparent 60%); }
        .orb.two { left: 80%; top: 78%; background: radial-gradient(circle at 70% 70%, color-mix(in oklab, var(--primary) 70%, #ffecd9), transparent 60%); }

        .wrap { width: 100%; padding: 28px; display: grid; place-items: center; }

        .card {
          width: min(860px, 96vw);
          position: relative;
          border-radius: 16px;
          padding: clamp(20px, 3vw, 28px);
          background: color-mix(in oklab, var(--card) 86%, transparent);
          border: 1px solid color-mix(in oklab, var(--border) 65%, transparent);
          box-shadow:
            0 20px 60px rgba(2, 8, 23, 0.35),
            inset 0 1px 0 rgba(255,255,255,0.12);
          text-align: center;
          backdrop-filter: blur(10px) saturate(120%);
        }

        .badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 12px; border-radius: 999px;
          border: 1px solid color-mix(in oklab, var(--primary) 35%, var(--border));
          background: color-mix(in oklab, var(--primary) 12%, var(--card));
          color: color-mix(in oklab, var(--primary) 60%, var(--card-foreground));
          font-weight: 600; font-size: 13px; letter-spacing: .2px;
          margin: 0 auto 14px;
        }

        .brand {
          display: inline-flex; align-items: center; gap: 12px; margin-bottom: 8px;
        }
        .glyph {
          width: 48px; height: 48px; border-radius: 12px; display: grid; place-items: center;
          background: linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, #fff), color-mix(in oklab, var(--primary) 36%, #fff));
          box-shadow: 0 10px 30px rgba(2, 8, 23, 0.25);
        }
        .brand-name { font-weight: 800; font-size: clamp(18px, 3vw, 22px); letter-spacing: .3px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

        h1 {
          margin: 8px 0 10px;
          font-size: clamp(28px, 4vw, 42px);
          line-height: 1.15;
          color: var(--card-foreground);
        }
        .highlight { background: linear-gradient(90deg, var(--primary), color-mix(in oklab, var(--primary) 65%, #ffb892)); -webkit-background-clip: text; background-clip: text; color: transparent; }
        p { margin: 0 auto; max-width: 64ch; color: var(--muted-foreground); font-size: clamp(15px, 1.6vw, 18px); }

        .cta {
          margin-top: 20px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;
        }
        .btn {
          --btn-bg: var(--primary); --btn-fg: var(--primary-foreground);
          display: inline-flex; align-items: center; gap: 8px; border-radius: 999px;
          padding: 12px 18px; font-weight: 600; font-size: 14px; text-decoration: none;
          color: var(--btn-fg); background: var(--btn-bg); border: 1px solid color-mix(in oklab, var(--primary) 20%, var(--border));
        }
        .btn.secondary {
          --btn-bg: color-mix(in oklab, var(--primary) 8%, var(--card));
          --btn-fg: color-mix(in oklab, var(--primary) 70%, var(--card-foreground));
        }

        .note { margin-top: 14px; font-size: 13px; color: color-mix(in oklab, var(--foreground) 70%, var(--muted-foreground)); }

        /* Decorative progress shimmer */
        .shimmer { height: 6px; width: min(320px, 50vw); margin: 18px auto 0; border-radius: 999px; overflow: hidden; background: color-mix(in oklab, var(--primary) 20%, var(--secondary)); }
        .shimmer::before {
          content: ""; display: block; height: 100%; width: 40%;
          background: linear-gradient(90deg, transparent, color-mix(in oklab, var(--primary) 60%, #fff), transparent);
          animation: slide 2.6s ease-in-out infinite;
        }
        @keyframes slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }
        @media (prefers-reduced-motion: reduce) { .shimmer::before { animation: none; } }
      </style>
    </head>
    <body>
      <div class="orbs"><div class="orb one"></div><div class="orb two"></div></div>
      <div class="grid-overlay"></div>
      <div class="wrap">
        <main class="card" role="main" aria-label="Сайтът е в режим на поддръжка" aria-live="polite">
          <div class="badge" aria-hidden="true">⚙️ Планирана поддръжка</div>
          <div class="brand">
            <div class="glyph" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stop-color="#FFD1B8" />
                    <stop offset="1" stop-color="#DD6630" />
                  </linearGradient>
                </defs>
                <path d="M12 2c1.8 2.3 2.3 4.4 1.2 6.2-1.1 1.8-3.1 2.5-5.3 3.7-2.2 1.2-3.4 3.4-2.7 5.7C6 20.9 8.1 22 10.5 22c3.3 0 6-2.7 6-6 0-2.2-.7-3.7-1.6-4.9-.9-1.2-1.5-2.1-.6-3.8.9-1.7 3.2-2.1 4-1.6C17.5 3 15.1 2 12 2Z" fill="url(#g)"/>
              </svg>
            </div>
            <div class="brand-name">FireLinks<span class="sr-only"> – режим на поддръжка</span></div>
          </div>
          <h1><span class="highlight">Сайтът е временно недостъпен</span></h1>
          <p>
            Работим по важни подобрения и подготовка за следващата версия.
            Достъпът до всички страници и функционалности е временно ограничен.
            Благодарим за търпението и доверието!
          </p>
          <div class="cta">
            <span class="btn" aria-hidden="true">Скоро се връщаме</span>
            <a class="btn secondary" href="#" onclick="return false" aria-disabled="true">Всичко е безопасно изключено</a>
          </div>
          <div class="shimmer" aria-hidden="true"></div>
          <div class="note">HTTP 503 • Retry-After: 24h • noindex</div>
        </main>
      </div>
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
