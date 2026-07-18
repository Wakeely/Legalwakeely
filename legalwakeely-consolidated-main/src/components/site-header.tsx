"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import { useLocale } from "@/lib/locale-provider";
import { useSession } from "@/lib/session-provider";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  Languages,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  GavelIcon,
  ShieldCheck,
  Home,
  Upload,
  Users,
  CreditCard,
} from "lucide-react";

export function SiteHeader() {
  const { t, locale, setLocale, dir } = useLocale();
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const isRTL = dir === "rtl";

  // Hide on auth pages — they have their own minimal header in (auth)/layout.tsx
  // This prevents the double-header issue on /login, /register, /forgot-password
  const isAuthPage =
    pathname?.includes("/login") ||
    pathname?.includes("/register") ||
    pathname?.includes("/forgot-password");
  if (isAuthPage) return null;

  const navItems = [
    { href: "/", label: t.nav.home, icon: Home },
    { href: "/legal-ai/upload", label: t.nav.upload, icon: Upload },
    { href: "/legal-ai/lawyers", label: t.nav.lawyers, icon: Users },
    { href: "/billing", label: t.nav.pricing, icon: CreditCard },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  const dashboardHref =
    user?.role === "LAWYER"
      ? "/lawyer/cases"
      : user?.role === "ADMIN"
        ? "/admin"
        : "/dashboard";

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
    setUserMenu(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-200/70 bg-white/90 backdrop-blur-lg">
      <div className="container-page flex h-16 items-center justify-between gap-6">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt={locale === "ar" ? "وكيلي القانونى" : "Legal Wakeely"}
            className="h-12 w-auto"
            width={428}
            height={189}
          />
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-bold transition-colors",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-700 hover:bg-ink-50 hover:text-ink-700",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="hidden items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-50 sm:inline-flex"
            aria-label={t.nav.language}
          >
            <Languages className="h-3.5 w-3.5" />
            {locale === "ar" ? "EN" : "العربية"}
          </button>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setUserMenu((o) => !o)}
                className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
              >
                <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand-600 to-brand-400 text-xs font-bold text-white">
                  {user.name?.[0] ?? "U"}
                </div>
                <span className="hidden sm:inline">{user.name.split(" ")[0]}</span>
              </button>
              {userMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setUserMenu(false)}
                  />
                  <div className="absolute end-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-lg">
                    <div className="border-b border-ink-100 px-4 py-3">
                      <div className="text-sm font-semibold text-ink-900">{user.name}</div>
                      <div className="text-xs text-ink-500">{user.phone}</div>
                    </div>
                    <div className="py-1">
                      <Link
                        href={dashboardHref}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                        onClick={() => setUserMenu(false)}
                      >
                        <LayoutDashboard className="h-4 w-4" />
                        {t.nav.dashboard}
                      </Link>
                      {user.role === "LAWYER" && (
                        <Link
                          href="/lawyer/cases"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                          onClick={() => setUserMenu(false)}
                        >
                          <GavelIcon className="h-4 w-4" />
                          {t.nav.lawyerArea}
                        </Link>
                      )}
                      {user.role === "ADMIN" && (
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                          onClick={() => setUserMenu(false)}
                        >
                          <ShieldCheck className="h-4 w-4" />
                          {t.nav.admin}
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          signOut();
                          setUserMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
                      >
                        <LogOut className="h-4 w-4" />
                        {t.nav.logout}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden items-center gap-2 rounded-lg bg-ink-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-ink-800 sm:inline-flex"
            >
              <UserIcon className="h-4 w-4" />
              {t.nav.login}
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-ink-200 text-ink-700 hover:bg-ink-50 md:hidden"
            aria-label="Menu"
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile slide-in drawer ─────────────────────────────────────── */}
      {/* Overlay — dark backdrop, click to close */}
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 transition-opacity duration-300 ease-out md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ backgroundColor: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
      />

      {/* Drawer panel — slides from the right in LTR, from the left in RTL */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "fixed top-0 z-50 flex h-full w-[300px] max-w-[85vw] flex-col transition-transform duration-300 ease-out md:hidden",
          isRTL ? "left-0" : "right-0",
          open
            ? "translate-x-0"
            : isRTL
              ? "-translate-x-full"
              : "translate-x-full",
        )}
        style={{ backgroundColor: "#ffffff", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", borderInlineStart: "1px solid #e2e8f0" }}
      >
        {/* Drawer header: logo + close */}
        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-4" style={{ backgroundColor: "#f8fafc" }}>
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt={locale === "ar" ? "وكيلي القانونى" : "Legal Wakeely"}
              className="h-14 w-auto"
              width={428}
              height={189}
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-600 hover:bg-ink-100"
            aria-label="Close menu"
            style={{ color: "#334155" }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer body: nav rows */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex h-14 items-center gap-3 rounded-xl px-3 text-base font-bold transition-colors",
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-ink-800 hover:bg-ink-50",
                    )}
                    style={active ? { backgroundColor: "#f0fdfa", color: "#0f766e" } : { color: "#1e293b" }}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Auth-only entries */}
          {user && (
            <div className="mt-3 border-t border-ink-100 pt-3">
              <Link
                href={dashboardHref}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center gap-3 rounded-xl px-3 text-base font-bold text-ink-700 hover:bg-ink-50"
                style={{ color: "#1e293b" }}
              >
                <LayoutDashboard className="h-5 w-5 shrink-0" />
                {t.nav.dashboard}
              </Link>
              {user.role === "LAWYER" && (
                <Link
                  href="/lawyer/cases"
                  onClick={() => setOpen(false)}
                  className="flex h-14 items-center gap-3 rounded-xl px-3 text-base font-bold text-ink-700 hover:bg-ink-50"
                >
                  <GavelIcon className="h-5 w-5 shrink-0" />
                  {t.nav.lawyerArea}
                </Link>
              )}
              {user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  onClick={() => setOpen(false)}
                  className="flex h-14 items-center gap-3 rounded-xl px-3 text-base font-bold text-ink-700 hover:bg-ink-50"
                >
                  <ShieldCheck className="h-5 w-5 shrink-0" />
                  {t.nav.admin}
                </Link>
              )}
            </div>
          )}
        </nav>

        {/* Drawer footer: language toggle + login/logout + copyright */}
        <div className="border-t border-ink-100 px-4 py-4 space-y-3">
          {/* Language toggle pill */}
          <button
            type="button"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-ink-200 bg-ink-50 px-4 py-2.5 text-sm font-bold text-ink-800 hover:bg-ink-100"
          >
            <Languages className="h-4 w-4" />
            {locale === "ar" ? "English" : "العربية"}
          </button>

          {/* Login / Logout */}
          {user ? (
            <button
              type="button"
              onClick={() => {
                signOut();
                setOpen(false);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700"
            >
              <LogOut className="h-4 w-4" />
              {t.nav.logout}
            </button>
          ) : (
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink-900 px-4 py-3 text-sm font-bold text-white hover:bg-ink-800"
            >
              <UserIcon className="h-4 w-4" />
              {t.nav.login}
            </Link>
          )}

          {/* Copyright */}
          <p className="pt-1 text-center text-[11px] text-ink-400">
            © {new Date().getFullYear()} {t.brand}
          </p>
        </div>
      </aside>
    </header>
  );
}
