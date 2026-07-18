"use client";

/**
 * MobileBottomNav — native-app-style bottom navigation.
 *
 * Two modes:
 *
 * 1. LOGGED-IN users: full 5-tab bar (Home, Cases, Legal-AI center,
 *    Notifications, Settings).
 *
 * 2. ANONYMOUS visitors: a shortcut bar with 3 quick actions:
 *    - Upload Document (primary CTA, brand-colored)
 *    - Find Lawyers
 *    - Sign In
 *
 * Only renders on mobile (md:hidden). Respects iPhone safe-area.
 */

import { useEffect, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useSession } from "@/lib/session-provider";
import { useLocale } from "@/lib/locale-provider";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  Sparkles,
  Bell,
  Settings,
  Upload,
  Users,
  LogIn,
} from "lucide-react";

interface Tab {
  href: string;
  label: { ar: string; en: string };
  icon: typeof LayoutDashboard;
  matchPrefix: string;
  center?: boolean;
}

const LOGGED_IN_TABS: Tab[] = [
  { href: "/dashboard",     label: { ar: "الرئيسية",   en: "Home"     }, icon: LayoutDashboard, matchPrefix: "/dashboard" },
  { href: "/cases",         label: { ar: "قضاياي",     en: "Cases"    }, icon: FolderOpen,      matchPrefix: "/cases" },
  { href: "/legal-ai",      label: { ar: "المحامي الذكي", en: "Legal-AI" }, icon: Sparkles,     matchPrefix: "/legal-ai", center: true },
  { href: "/notifications", label: { ar: "الإشعارات",  en: "Alerts"   }, icon: Bell,            matchPrefix: "/notifications" },
  { href: "/settings",      label: { ar: "الإعدادات",  en: "Settings" }, icon: Settings,        matchPrefix: "/settings" },
];

const ANON_SHORTCUTS = [
  { href: "/legal-ai/upload",  label: { ar: "رفع وثيقة",   en: "Upload"    }, icon: Upload, primary: true },
  { href: "/legal-ai/lawyers", label: { ar: "المحامون",    en: "Lawyers"   }, icon: Users,  primary: false },
  { href: "/login",            label: { ar: "تسجيل دخول",  en: "Sign In"   }, icon: LogIn,  primary: false },
];

export function MobileBottomNav() {
  const { user, loading } = useSession();
  const { locale } = useLocale();
  const pathname = usePathname();
  const [hasUnread, setHasUnread] = useState(false);

  // Unread notification check (logged-in only)
  useEffect(() => {
    if (!user) {
      setHasUnread(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await window.fetch("/api/notifications?limit=10");
        if (!res.ok) return;
        const data: { read_at?: string | null }[] = await res.json();
        if (cancelled) return;
        setHasUnread(Array.isArray(data) && data.some((n) => !n.read_at));
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [user, pathname]);

  // Don't render on auth pages
  if (pathname?.startsWith("/login") || pathname?.startsWith("/register") || pathname?.startsWith("/forgot-password")) {
    return null;
  }

  // Don't render until session loads
  if (loading) return null;

  const isActive = (tab: Tab) => {
    if (!pathname) return false;
    if (tab.matchPrefix === "/legal-ai") return pathname.startsWith("/legal-ai");
    return pathname === tab.matchPrefix || pathname.startsWith(tab.matchPrefix + "/");
  };

  // ── Anonymous shortcut bar ───────────────────────────────────
  if (!user) {
    return (
      <nav
        aria-label="Quick actions"
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white md:hidden",
          "pb-[env(safe-area-inset-bottom)]",
        )}
        style={{ boxShadow: "0 -2px 12px rgba(15,23,42,0.08)" }}
      >
        <ul className="flex items-stretch justify-around px-2 py-2">
          {ANON_SHORTCUTS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex flex-1 justify-center">
                <Link
                  href={item.href}
                  className="flex w-full flex-col items-center justify-center gap-1 rounded-xl py-1.5"
                  aria-label={item.label[locale]}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-full transition-transform active:scale-95",
                      item.primary ? "text-white" : "text-ink-700",
                    )}
                    style={item.primary ? { backgroundColor: "#0d9488" } : { backgroundColor: "#f1f5f9" }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold leading-none",
                      item.primary ? "text-brand-700" : "text-ink-600",
                    )}
                    style={{ color: item.primary ? "#0f766e" : "#475569" }}
                  >
                    {item.label[locale]}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  // ── Logged-in full tab bar ───────────────────────────────────
  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white md:hidden",
        "pb-[env(safe-area-inset-bottom)]",
      )}
      style={{ boxShadow: "0 -2px 12px rgba(15,23,42,0.08)" }}
    >
      <ul className="relative flex items-stretch justify-around px-2 pt-1.5 pb-1">
        {LOGGED_IN_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab);

          if (tab.center) {
            return (
              <li key={tab.href} className="flex flex-1 justify-center">
                <Link
                  href={tab.href}
                  className="flex flex-col items-center justify-end gap-0.5 pt-1"
                  aria-label={tab.label[locale]}
                >
                  <span
                    className={cn(
                      "-mt-7 grid h-14 w-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-white transition-transform active:scale-95",
                    )}
                    style={{ backgroundColor: active ? "#0f766e" : "#0d9488" }}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span
                    className="mt-0.5 text-[10px] font-bold leading-none"
                    style={{ color: active ? "#0f766e" : "#94a3b8" }}
                  >
                    {tab.label[locale]}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex flex-1 justify-center">
              <Link
                href={tab.href}
                className="flex w-full flex-col items-center justify-center gap-1 py-1.5"
                aria-label={tab.label[locale]}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  <Icon
                    className="h-5 w-5 transition-colors"
                    style={{ color: active ? "#0f766e" : "#94a3b8" }}
                  />
                  {tab.href === "/notifications" && hasUnread && (
                    <span
                      aria-hidden
                      className="absolute -end-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"
                    />
                  )}
                </span>
                <span
                  className="text-[10px] font-medium leading-none transition-colors"
                  style={{ color: active ? "#0f766e" : "#94a3b8" }}
                >
                  {tab.label[locale]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
