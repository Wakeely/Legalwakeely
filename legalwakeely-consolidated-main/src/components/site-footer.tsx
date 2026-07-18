"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useLocale } from "@/lib/locale-provider";
import { useSession } from "@/lib/session-provider";
import { cn } from "@/lib/utils";

/**
 * SiteFooter — global footer for the public/marketing shell.
 *
 * Visibility rules:
 *   - Never rendered on auth routes (login / register / forgot-password)
 *     — those pages use a dedicated `(auth)` layout with its own footer.
 *   - On mobile when the user is logged in, the footer is hidden entirely
 *     (the `<MobileBottomNav />` replaces it for app-like navigation).
 *   - On mobile when anonymous, a minimal single-column footer is shown.
 *   - On `md+`, a full 3-column layout (brand + Product + Legal).
 *
 * `pb-20 md:pb-0` keeps the legal links clear of the mobile bottom nav
 * when both are visible (i.e. anonymous mobile users that still see
 * the cookie banner area).
 */

const AUTH_SEGMENTS = ["/login", "/register", "/forgot-password"];

function isAuthRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return AUTH_SEGMENTS.some((seg) =>
    pathname === seg || pathname.startsWith(seg + "/"),
  );
}

export function SiteFooter() {
  const { t, locale } = useLocale();
  const { user } = useSession();
  const pathname = usePathname();
  const year = new Date().getFullYear();

  if (isAuthRoute(pathname)) return null;

  // Logged-in users on mobile get the bottom nav instead.
  const hideOnMobile = !!user;

  return (
    <footer
      className={cn(
        "border-t border-ink-200 bg-ink-50/60",
        hideOnMobile ? "hidden md:block" : "block",
        "pb-20 md:pb-0",
      )}
    >
      <div className="container-page py-10 md:py-12">
        {/* ── Desktop: 3-column layout ─────────────────────────────── */}
        <div className="hidden gap-10 md:grid md:grid-cols-3">
          {/* Brand column */}
          <div>
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt={locale === "ar" ? "وكيلي القانونى" : "Legal Wakeely"}
                className="h-12 w-auto"
                width={428}
                height={189}
              />
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-7 text-ink-600">
              {t.footer.tagline}
            </p>
          </div>

          {/* Product column */}
          <div>
            <h3 className="text-sm font-semibold text-ink-900">{t.footer.product}</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li>
                <Link href="/legal-ai/upload" className="transition-colors hover:text-brand-700">
                  {t.nav.upload}
                </Link>
              </li>
              <li>
                <Link href="/legal-ai/lawyers" className="transition-colors hover:text-brand-700">
                  {t.nav.lawyers}
                </Link>
              </li>
              <li>
                <Link href="/legal-ai/analyses" className="transition-colors hover:text-brand-700">
                  {t.nav.dashboard}
                </Link>
              </li>
              <li>
                <Link href="/billing" className="transition-colors hover:text-brand-700">
                  {t.nav.pricing}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal column */}
          <div>
            <h3 className="text-sm font-semibold text-ink-900">{t.footer.legal}</h3>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li>
                <Link href="/legal/terms" className="transition-colors hover:text-brand-700">
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link href="/legal/privacy" className="transition-colors hover:text-brand-700">
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link href="/legal/disclaimer" className="transition-colors hover:text-brand-700">
                  {t.footer.disclaimer}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Mobile minimal layout (anonymous only) ──────────────── */}
        <div className="md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt={locale === "ar" ? "وكيلي القانونى" : "Legal Wakeely"}
              className="h-14 w-auto"
              width={428}
              height={189}
            />
          </Link>

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-600">
            <li>
              <Link href="/legal/terms" className="transition-colors hover:text-brand-700">
                {t.footer.terms}
              </Link>
            </li>
            <li>
              <Link href="/legal/privacy" className="transition-colors hover:text-brand-700">
                {t.footer.privacy}
              </Link>
            </li>
            <li>
              <Link href="/legal/disclaimer" className="transition-colors hover:text-brand-700">
                {t.footer.disclaimer}
              </Link>
            </li>
          </ul>
        </div>

        {/* ── Bottom bar: copyright ─────────────────────────────────── */}
        <div className="mt-8 border-t border-ink-200 pt-5 text-xs text-ink-500">
          <p>
            © {year} {t.brand}. {t.footer.madeIn}.
          </p>
        </div>
      </div>
    </footer>
  );
}
