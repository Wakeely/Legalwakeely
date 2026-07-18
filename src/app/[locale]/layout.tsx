import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/theme-provider';
import { SafeClient } from '@/components/safe-client';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { SessionEnforcementChecker } from '@/components/session-enforcement-checker';
import { PageViewTracker } from '@/components/page-view-tracker';
import { LocaleProvider } from '@/lib/locale-provider';
import { SessionProvider } from '@/lib/session-provider';
import '../globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap', weight: ['400', '600', '700', '900'] });
const ibmPlexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '600', '700'], variable: '--font-arabic', display: 'swap' });

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  const isArabic = locale === 'ar';
  return {
    title: { default: t('appName'), template: `%s | ${t('appName')}` },
    description: isArabic 
      ? 'منصة الشفافية القانونية للموكلين في دول الخليج.' 
      : 'LegalWakeely - Document Analysis, Lawyer Matching & Case Accountability',
    openGraph: { title: t('appName'), siteName: t('appName'), locale: isArabic ? 'ar_AE' : 'en_US', type: 'website' },
    robots: { index: true, follow: true },
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://legalwakeely.com'),
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) notFound();

  const allMessages = await getMessages({ locale });
  const clientNamespaces = ['common', 'auth', 'register', 'wizard', 'cases', 'nde', 'nde_alerts', 'tracker', 'notifications', 'onboarding', 'splash', 'dashboard', 'navigation', 'legal', 'lawyer', 'billing', 'escalation', 'invite'];
  const messages = Object.fromEntries(
    clientNamespaces.filter((ns) => ns in allMessages).map((ns) => [ns, allMessages[ns]])
  );

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${inter.variable} ${ibmPlexArabic.variable}`} suppressHydrationWarning>
      <body className={locale === 'ar' ? 'font-arabic' : 'font-sans'}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
          <LocaleProvider>
            <SessionProvider>
              <SafeClient>
                <SiteHeader />
              </SafeClient>
              {children}
              <SafeClient>
                <SiteFooter />
              </SafeClient>
              <SafeClient>
                <MobileBottomNav />
              </SafeClient>
              <SafeClient>
                <CookieConsentBanner />
              </SafeClient>
              <SafeClient>
                <SessionEnforcementChecker />
              </SafeClient>
              <SafeClient>
                <PageViewTracker locale={locale} />
              </SafeClient>
            </SessionProvider>
          </LocaleProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}