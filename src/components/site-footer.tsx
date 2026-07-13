"use client";

import Link from "next/link";
import { useLocale } from "@/lib/locale-provider";
import { Scale, MapPin, Heart } from "lucide-react";

export function SiteFooter() {
  const { t } = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-ink-200 bg-ink-50/60">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 text-white">
                <Scale className="h-5 w-5" />
              </div>
              <span className="text-base font-extrabold text-ink-900">
                {t.brand}
              </span>
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-7 text-ink-600">
              {t.footer.tagline}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-ink-500">
              <MapPin className="h-3.5 w-3.5" />
              {t.footer.madeIn}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-900">{t.footer.product}</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link href="/upload" className="hover:text-brand-700">{t.nav.upload}</Link></li>
              <li><Link href="/lawyers" className="hover:text-brand-700">{t.nav.lawyers}</Link></li>
              <li><Link href="/learn" className="hover:text-brand-700">{t.nav.learn}</Link></li>
              <li><Link href="/pricing" className="hover:text-brand-700">{t.nav.pricing}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-ink-900">{t.footer.legal}</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><Link href="/legal/terms" className="hover:text-brand-700">{t.footer.terms}</Link></li>
              <li><Link href="/legal/privacy" className="hover:text-brand-700">{t.footer.privacy}</Link></li>
              <li><Link href="/legal/disclaimer" className="hover:text-brand-700">{t.footer.disclaimer}</Link></li>
              <li><Link href="/about" className="hover:text-brand-700">{t.footer.about}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-ink-200 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center">
          <p>
            © {year} {t.brand}. {t.footer.copyright.replace(/© \d{4} .+\. /, "")}
          </p>
          <p className="flex items-center gap-1">
            {t.footer.madeIn} <Heart className="h-3 w-3 text-rose-500" /> for citizens.
          </p>
        </div>
      </div>
    </footer>
  );
}
