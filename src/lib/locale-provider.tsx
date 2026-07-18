"use client";

/**
 * LocaleProvider — compatibility shim.
 *
 * Sources locale from next-intl's useLocale() (the [locale] URL segment).
 * The NextIntlClientProvider in [locale]/layout.tsx wraps this provider,
 * so useLocale() is always available — no try/catch needed.
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useLocale as useNextLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { dictionaries, dir } from "./i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  dir: "rtl" | "ltr";
  t: (typeof dictionaries)["ar"];
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const nextLocale = (useNextLocale() as Locale) ?? routing.defaultLocale;
  const router = useRouter();
  const pathname = usePathname();

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale: nextLocale,
      setLocale: (l) => {
        router.replace(pathname, { locale: l });
        if (typeof document !== "undefined") {
          document.documentElement.lang = l;
          document.documentElement.dir = dir(l);
        }
      },
      dir: dir(nextLocale),
      t: dictionaries[nextLocale] as (typeof dictionaries)["ar"],
    }),
    [nextLocale, router, pathname],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

// Re-export for components that import from the provider directly.
export { dictionaries, dir };
export type { Locale };
export const locales = routing.locales as readonly Locale[];
export const defaultLocale = routing.defaultLocale as Locale;
