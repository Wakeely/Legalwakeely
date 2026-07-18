"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-provider";
import { showToast } from "@/components/ui/toast";
import { Check, Flag, X, Edit } from "lucide-react";

export function AdminActions({ analysisId }: { analysisId: string }) {
  const { locale } = useLocale();
  const [busy, setBusy] = useState<"approve" | "flag" | "reject" | null>(null);

  const act = async (action: "approve" | "flag" | "reject") => {
    setBusy(action);
    try {
      const res = await fetch(`/api/admin/analyses/${analysisId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error("failed");
      showToast({
        variant: action === "approve" ? "success" : action === "flag" ? "warning" : "danger",
        title:
          action === "approve"
            ? (locale === "ar" ? "تم اعتماد التحليل" : "Analysis approved")
            : action === "flag"
              ? (locale === "ar" ? "تم وضع علامة للمراجعة" : "Flagged for review")
              : (locale === "ar" ? "تم رفض التحليل" : "Analysis rejected"),
      });
    } catch {
      showToast({ variant: "danger", title: locale === "ar" ? "فشلت العملية" : "Action failed" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        size="sm"
        variant="primary"
        loading={busy === "approve"}
        onClick={() => act("approve")}
        icon={<Check className="h-3.5 w-3.5" />}
      >
        اعتماد
      </Button>
      <Button
        size="sm"
        variant="outline"
        loading={busy === "flag"}
        onClick={() => act("flag")}
        icon={<Flag className="h-3.5 w-3.5" />}
      >
        إبلاغ
      </Button>
      <Button
        size="sm"
        variant="danger"
        loading={busy === "reject"}
        onClick={() => act("reject")}
        icon={<X className="h-3.5 w-3.5" />}
      >
        رفض
      </Button>
    </div>
  );
}
