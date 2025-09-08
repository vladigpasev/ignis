import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip ESLint during production builds to avoid blocking deploys
  eslint: { ignoreDuringBuilds: true },

  // Rewrite everything to a static maintenance page.
  // Using a single array returns "afterFiles" rewrites, so existing static files
  // (like /img/logo.svg) are served directly from the CDN with zero compute.
  async rewrites() {
    return [
      { source: "/:path*", destination: "/maintenance.html" },
    ];
  },

  // Apply strict security headers and noindex globally.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" },
          { key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        ],
      },
    ];
  },
};

export default nextConfig;
