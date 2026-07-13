"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLocale } from "@/lib/locale-provider";
import { useSession } from "@/lib/session-provider";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  Scale,
  Languages,
  User as UserIcon,
  LogOut,
  LayoutDashboard,
  GavelIcon,
  ShieldCheck,
} from "lucide-react";

export function SiteHeader() {
  const { t, locale, setLocale } = useLocale();
  const { user, signOut } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const navItems = [
    { href: "/", label: t.nav.home },
    { href: "/upload", label: t.nav.upload },
    { href: "/lawyers", label: t.nav.lawyers },
    { href: "/learn", label: t.nav.learn },
    { href: "/pricing", label: t.nav.pricing },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  };

  const dashboardHref =
    user?.role === "LAWYER"
      ? "/dashboard/lawyer"
      : user?.role === "ADMIN"
        ? "/dashboard/lawyer"
        : "/dashboard";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-ink-200/70 bg-white/80 backdrop-blur-lg">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 text-white shadow-sm">
            <Scale className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-extrabold tracking-tight text-ink-900">
              {t.brand}
            </span>
            <span className="mt-0.5 text-[10px] font-medium text-ink-500">
              {locale === "ar" ? "ليجال نافيغيتور" : "Legal Navigator"}
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-700 hover:bg-ink-50 hover:text-ink-900",
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
                          href="/dashboard/lawyer"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-ink-700 hover:bg-ink-50"
                          onClick={() => setUserMenu(false)}
                        >
                          <GavelIcon className="h-4 w-4" />
                          {t.nav.lawyerArea}
                        </Link>
                      )}
                      {user.role === "ADMIN" && (
                        <Link
                          href="/dashboard/lawyer"
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
              href="/auth/login"
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
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-ink-200 bg-white md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-lg px-3 py-2.5 text-sm font-medium",
                  isActive(item.href)
                    ? "bg-brand-50 text-brand-700"
                    : "text-ink-700 hover:bg-ink-50",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-3">
              <button
                type="button"
                onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-semibold text-ink-700"
              >
                <Languages className="h-3.5 w-3.5" />
                {locale === "ar" ? "English" : "العربية"}
              </button>
              {!user && (
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {t.nav.login}
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
