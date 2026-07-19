// Client-side (browser) Sentry setup. Safe to run before the DSN is
// configured — Sentry.init() with an empty dsn is a documented no-op,
// it will not throw or crash the app. Once Vercel's Sentry integration
// (or a manually-set NEXT_PUBLIC_SENTRY_DSN) provides a real DSN, error
// reporting activates automatically with no further code changes.
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Don't send anything if there's no DSN — belt-and-suspenders on top
  // of Sentry's own no-op behavior for an empty dsn.
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
});
