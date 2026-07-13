import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import { routing } from '@/i18n/routing';
import { ThemeProvider } from '@/components/theme-provider';
import { RTLProvider } from '@/components/rtl-provider';
import { AnalyticsProvider } from '@/components/analytics-provider';
import SiteHeader from '@/components/site-header';   // Updated import
import SiteFooter from '@/components/site-footer';
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
  const clientNamespaces = ['common', 'auth', 'nde', 'nde_alerts', 'tracker', 'notifications', 'onboarding'];
  const messages = Object.fromEntries(
    clientNamespaces.filter((ns) => ns in allMessages).map((ns) => [ns, allMessages[ns]])
  );

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${inter.variable} ${ibmPlexArabic.variable}`} suppressHydrationWarning>
      <body className={locale === 'ar' ? 'font-arabic' : 'font-sans'}>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <RTLProvider>
              <AnalyticsProvider>
                <SiteHeader />   {/* This will include navigation to new pages */}
                {children}
                <SiteFooter />
              </AnalyticsProvider>
            </RTLProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}