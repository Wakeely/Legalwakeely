"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * PageViewTracker — fires a page-view event on every route change.
 *
 * Stores a random visitor_id in localStorage (anonymous, not tied
 * to user identity). Sends to /api/track which inserts into the
 * page_views table for the admin analytics dashboard.
 */
export function PageViewTracker({ locale }: { locale: string }) {
  const pathname = usePathname();

  useEffect(() => {
    try {
      // Get or create visitor ID
      let visitorId = localStorage.getItem("lw.visitor-id");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("lw.visitor-id", visitorId);
      }

      // Fire and forget — don't block the page
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: pathname,
          visitor_id: visitorId,
          locale,
          referrer: document.referrer || null,
        }),
      }).catch(() => {
        // silent fail — tracking is non-critical
      });
    } catch {
      // If anything fails (localStorage blocked, crypto unavailable, etc.),
      // silently skip — this component must NEVER crash the page
    }
  }, [pathname, locale]);

  return null;
}
