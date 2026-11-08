import type { NextConfig } from 'next';

// KORA_PANEL_EXPORT=1 builds the hosted panel: a static export (every page is a client page that talks to
// Supabase with the anon key and the user's session). Route handlers (route.ts) are left out by pageExtensions;
// the hosted panel reaches the same actions through the panel-api edge function (NEXT_PUBLIC_PANEL_API).
// The hosting adds the security headers below on its own (tools/panel/eas-routes.mjs).
const exportStatic = process.env.KORA_PANEL_EXPORT === '1';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const config: NextConfig = {
  // workspace packages ship TypeScript sources
  transpilePackages: ['@kora/api', '@kora/core', '@kora/design-tokens'],
  reactStrictMode: true,
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  // local Playwright checks load the dev server through 127.0.0.1
  allowedDevOrigins: ['127.0.0.1'],
  images: { unoptimized: true },
  ...(exportStatic
    ? { output: 'export', pageExtensions: ['tsx'] }
    : {
        async headers() {
          return [{ source: '/:path*', headers: securityHeaders }];
        },
      }),
};

export default config;
