import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = [
  '/dashboard', '/cases', '/vault', '/settings',
  '/deadlines', '/alerts', '/notifications', '/billing',
  '/escalation', '/admin', '/lawyer',
  '/legal-ai',
];

// ── IP-based rate limiting (in-memory, per edge instance) ──────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120; // requests per window
const WINDOW_MS = 60_000; // 1 minute

function getRateLimitKey(ip: string, path: string): string {
  // Separate buckets for different route categories
  if (path.startsWith('/api/track')) return `track:${ip}`;
  if (path.startsWith('/api/webhooks')) return `webhook:${ip}`;
  if (path.startsWith('/api/')) return `api:${ip}`;
  return `page:${ip}`;
}

function checkIpRateLimit(key: string, limit: number = RATE_LIMIT): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (record.count >= limit) return false;

  record.count++;
  return true;
}

// Periodic cleanup to prevent memory leak
let lastCleanup = Date.now();
function cleanupRateLimitStore() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [k, v] of rateLimitStore.entries()) {
    if (now > v.resetAt) rateLimitStore.delete(k);
  }
}

// ── Blocked paths (junk traffic / non-existent routes) ─────────
const BLOCKED_PATHS = [
  '/independently-consolidated',
  '/love2hope',
  '/angel',
  '/jordan-cable-news',
  '/wp-admin',
  '/wp-login',
  '/xmlrpc.php',
  '/.env',
  '/.git',
  '/config',
  '/debug',
  '/phpmyadmin',
];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  cleanupRateLimitStore();

  // ── Block known junk paths ──────────────────────────────────
  const lowerPath = pathname.toLowerCase();
  if (BLOCKED_PATHS.some((p) => lowerPath.startsWith(p))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── Block common bot scan paths ─────────────────────────────
  if (
    lowerPath.endsWith('.php') ||
    lowerPath.endsWith('.asp') ||
    lowerPath.endsWith('.aspx') ||
    lowerPath.includes('/cgi-bin') ||
    lowerPath.includes('/admin/') && !lowerPath.startsWith('/ar/admin') && !lowerPath.startsWith('/en/admin')
  ) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // ── Block requests with NO user-agent (bots, scanners) ─────
  const ua = (request.headers.get('user-agent') ?? '').toLowerCase();
  if (!ua || ua.length < 10) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── Block known bots / scrapers / crawlers ─────────────────
  const BLOCKED_BOTS = [
    'semrush', 'ahrefs', 'mj12bot', 'dotbot', 'blexbot', 'petalbot',
    'bytespider', 'gptbot', 'ccbot', 'claudebot', 'anthropic',
    'scrapy', 'python-requests', 'go-http-client', 'curl',
    'nikto', 'sqlmap', 'masscan', 'zgrab', 'nuclei',
    'headlesschrome', 'phantomjs', 'puppeteer', 'selenium',
    'wget', 'httpclient', 'java/', 'libwww',
    'censys', 'shodan', 'zoominfobot', 'archive.org',
    'yandexbot', 'baiduspider', 'sogou', 'exabot',
  ];
  if (BLOCKED_BOTS.some((bot) => ua.includes(bot))) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // ── Block non-browser user-agents on page routes ───────────
  // Real browsers always contain "mozilla" or "chrome" or "safari" or "firefox"
  const isPageRoute = !pathname.startsWith('/api/');
  if (isPageRoute) {
    const looksLikeBrowser = ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox') || ua.includes('edge');
    if (!looksLikeBrowser) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // ── Global IP rate limit (all routes) ───────────────────────
  const globalKey = `global:${ip}`;
  if (!checkIpRateLimit(globalKey, 60)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  // ── API-specific rate limiting ──────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Aggressive rate limit on /api/track (no auth, high abuse potential)
    if (pathname === '/api/track') {
      const trackKey = getRateLimitKey(ip, pathname);
      if (!checkIpRateLimit(trackKey, 15)) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
      return NextResponse.next();
    }

    // Rate limit webhooks
    if (pathname.startsWith('/api/webhooks/')) {
      const webhookKey = getRateLimitKey(ip, pathname);
      if (!checkIpRateLimit(webhookKey, 30)) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
      return NextResponse.next();
    }

    // Auth routes: stricter limit
    if (pathname.includes('/api/auth/') || pathname.includes('/api/invites/')) {
      const authKey = `auth:${ip}`;
      if (!checkIpRateLimit(authKey, 10)) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    }

    // AI routes: strict limit (expensive operations)
    if (
      pathname.includes('/api/ai/') ||
      pathname.includes('/api/voice/') ||
      pathname.includes('/api/onboarding/chat') ||
      pathname.includes('/api/legal-ai/')
    ) {
      const aiKey = `ai:${ip}`;
      if (!checkIpRateLimit(aiKey, 10)) {
        return new NextResponse('Too Many Requests', { status: 429 });
      }
    }

    // All other API routes
    const apiKey = getRateLimitKey(ip, pathname);
    if (!checkIpRateLimit(apiKey, 60)) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    return NextResponse.next();
  }

  // ── Kill stale NEXT_LOCALE cookie ───────────────────────────
  request.cookies.delete('NEXT_LOCALE');

  // ── Strict page rate limit (SSR is expensive) ──────────────
  const pageKey = `page:${ip}`;
  if (!checkIpRateLimit(pageKey, 20)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  // ── Extract locale from URL ─────────────────────────────────
  const pathSegments = pathname.split('/');
  const urlLocale    = ['en', 'ar'].includes(pathSegments[1]) ? pathSegments[1] : 'ar';

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-wakeela-locale', urlLocale);

  // ── Run intl middleware ─────────────────────────────────────
  const intlResponse = intlMiddleware(request);
  intlResponse.cookies.delete('NEXT_LOCALE');

  // ── Supabase auth — ONLY for protected routes ───────────────
  const pathnameWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';
  const isProtected = PROTECTED_PATHS.some((p) => pathnameWithoutLocale.startsWith(p));
  const isAuthPage  = ['/login', '/register'].includes(pathnameWithoutLocale);

  if (!isProtected && !isAuthPage) {
    intlResponse.cookies.delete('NEXT_LOCALE');
    return intlResponse;
  }

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return intlResponse;

  const pendingCookies: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll()  { return request.cookies.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          pendingCookies.push({ name, value, options });
        });
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  const applyAll = (response: NextResponse): NextResponse => {
    response.cookies.delete('NEXT_LOCALE');
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set({ name, value, ...options });
    });
    return response;
  };

  if (isProtected && !user) {
    const loginUrl = new URL(`/${urlLocale}/login`, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return applyAll(NextResponse.redirect(loginUrl));
  }

  if (isAuthPage && user) {
    return applyAll(NextResponse.redirect(new URL(`/${urlLocale}/dashboard`, request.url)));
  }

  return applyAll(intlResponse);
}

export const config = {
  matcher: [
    '/((?!_next|_vercel|witness|share|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp|woff2?|ttf|otf|css|js)).*)',
  ],
};
