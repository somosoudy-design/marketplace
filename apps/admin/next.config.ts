import type { NextConfig } from 'next';

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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default config;
