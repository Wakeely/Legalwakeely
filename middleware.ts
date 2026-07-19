import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { routing } from './src/i18n/routing';
import { rateLimiters, checkRateLimit, rateLimitResponse } from './src/lib/rate-limit';

const intlMiddleware = createIntlMiddleware(routing);

const PROTECTED_PATHS = [
  '/dashboard', '/cases', '/vault', '/settings',
  '/deadlines', '/alerts', '/notifications', '/billing',
  '/escalation', '/admin', '/lawyer',
  '/legal-ai',
];

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
  const isPageRoute = !pathname.startsWith('/api/');
  if (isPageRoute) {
    const looksLikeBrowser = ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox') || ua.includes('edge');
    if (!looksLikeBrowser) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // ── Check if Upstash Redis is configured ────────────────────
  const hasRedis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasRedis) {
    // ── Upstash-backed rate limiting (cross-instance) ─────────
    const globalResult = await checkRateLimit(rateLimiters.global, `global:${ip}`);
    if (!globalResult.allowed) {
      return rateLimitResponse(globalResult.reset);
    }

    if (pathname === '/api/track') {
      const trackResult = await checkRateLimit(rateLimiters.track, `track:${ip}`);
      if (!trackResult.allowed) return rateLimitResponse(trackResult.reset);
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/webhooks/')) {
      const webhookResult = await checkRateLimit(rateLimiters.webhook, `webhook:${ip}`);
      if (!webhookResult.allowed) return rateLimitResponse(webhookResult.reset);
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      if (pathname.includes('/api/auth/') || pathname.includes('/api/invites/')) {
        const authResult = await checkRateLimit(rateLimiters.auth, `auth:${ip}`);
        if (!authResult.allowed) return rateLimitResponse(authResult.reset);
      }

      if (
        pathname.includes('/api/ai/') ||
        pathname.includes('/api/voice/') ||
        pathname.includes('/api/onboarding/chat') ||
        pathname.includes('/api/legal-ai/')
      ) {
        const aiResult = await checkRateLimit(rateLimiters.ai, `ai:${ip}`);
        if (!aiResult.allowed) return rateLimitResponse(aiResult.reset);
      }

      const apiResult = await checkRateLimit(rateLimiters.api, `api:${ip}`);
      if (!apiResult.allowed) return rateLimitResponse(apiResult.reset);
      return NextResponse.next();
    }
  } else {
    // ── Fallback: in-memory rate limiting (single instance only) ──
    // Used when Upstash is not configured (local dev, etc.)
    const { checkRateLimit: checkLocalRateLimit } = await import('./src/lib/rate-limit-local');
    const globalResult = checkLocalRateLimit(`global:${ip}`, 60);
    if (!globalResult.allowed) {
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    if (pathname === '/api/track') {
      const trackResult = checkLocalRateLimit(`track:${ip}`, 15);
      if (!trackResult.allowed) return new NextResponse('Too Many Requests', { status: 429 });
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/webhooks/')) {
      return NextResponse.next();
    }

    if (pathname.startsWith('/api/')) {
      if (pathname.includes('/api/auth/') || pathname.includes('/api/invites/')) {
        const authResult = checkLocalRateLimit(`auth:${ip}`, 10);
        if (!authResult.allowed) return new NextResponse('Too Many Requests', { status: 429 });
      }

      if (
        pathname.includes('/api/ai/') ||
        pathname.includes('/api/voice/') ||
        pathname.includes('/api/onboarding/chat') ||
        pathname.includes('/api/legal-ai/')
      ) {
        const aiResult = checkLocalRateLimit(`ai:${ip}`, 10);
        if (!aiResult.allowed) return new NextResponse('Too Many Requests', { status: 429 });
      }

      return NextResponse.next();
    }
  }

  // ── Kill stale NEXT_LOCALE cookie ───────────────────────────
  request.cookies.delete('NEXT_LOCALE');

  // ── Page rate limit ─────────────────────────────────────────
  if (hasRedis) {
    const pageResult = await checkRateLimit(rateLimiters.page, `page:${ip}`);
    if (!pageResult.allowed) return rateLimitResponse(pageResult.reset);
  } else {
    const { checkRateLimit: checkLocalRateLimit } = await import('./src/lib/rate-limit-local');
    const pageResult = checkLocalRateLimit(`page:${ip}`, 20);
    if (!pageResult.allowed) return new NextResponse('Too Many Requests', { status: 429 });
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
