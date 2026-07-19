import createNextIntlPlugin from 'next-intl/plugin';
import { withSentryConfig } from '@sentry/nextjs';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ── Performance ─────────────────────────────────────────────
  compress: true,                   // gzip/brotli all responses
  poweredByHeader: false,           // remove X-Powered-By header (tiny security + perf)

  // Minimize server-side bundle by marking heavy packages as external
  serverExternalPackages: ['@anthropic-ai/sdk'],

  // Optimize package imports — tree-shake icon libraries
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  async redirects() {
    return [
      {
        source: '/',
        destination: '/ar',
        permanent: false,
      },
      // ── Old Almustahar paths → consolidated /legal-ai/* paths ──
      // Catches stale bookmarks and links pointing to the pre-merge URLs.
      { source: '/lawyers/:path*', destination: '/legal-ai/lawyers/:path*', permanent: true },
      { source: '/upload',          destination: '/legal-ai/upload',          permanent: true },
      { source: '/analyses/:path*', destination: '/legal-ai/analyses/:path*', permanent: true },
      // Locale-prefixed variants (e.g. /ar/lawyers/l5 → /ar/legal-ai/lawyers/l5)
      { source: '/:locale/lawyers/:path*', destination: '/:locale/legal-ai/lawyers/:path*', permanent: true },
      { source: '/:locale/upload',          destination: '/:locale/legal-ai/upload',          permanent: true },
      { source: '/:locale/analyses/:path*', destination: '/:locale/legal-ai/analyses/:path*', permanent: true },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
    // Use modern format for better compression
    formats: ['image/avif', 'image/webp'],
    // Local logo image needs SVG support. Per Next.js's own security guidance,
    // dangerouslyAllowSVG must be paired with a strict CSP + forced download
    // disposition, otherwise an uploaded/remote SVG could execute script when
    // served through the image optimizer.
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  async headers() {
    return [
      {
        // Static assets — aggressive caching
        source: '/_next/static/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // All pages
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'X-XSS-Protection',          value: '1; mode=block' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://us.i.posthog.com https://us-assets.i.posthog.com https://js.sentry-cdn.com https://browser.sentry-cdn.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://us.i.posthog.com https://us-assets.i.posthog.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://us.i.posthog.com https://us-assets.i.posthog.com https://sentry.io https://*.sentry.io",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          // Tell browsers to revalidate HTML but serve stale while revalidating
          { key: 'Cache-Control',             value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

export default withSentryConfig(withNextIntl(nextConfig), {
  // Only used for uploading source maps (nicer stack traces in
  // Sentry). If SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN aren't
  // set yet (e.g. Vercel's Sentry integration hasn't been installed
  // or is still provisioning), this step is silently skipped by
  // Sentry's own tooling — the build itself is unaffected either way.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
