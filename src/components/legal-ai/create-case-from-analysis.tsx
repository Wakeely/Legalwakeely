"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Gavel, Loader2, CheckCircle2 } from "lucide-react";
import type { CaseType } from "@/types";

/**
 * Cross-module handoff button: creates a Legal Wakeely case pre-filled
 * with the Legal-AI analysis context, then routes the user to it.
 *
 * This is the "killer feature" of the consolidation — the Legal-AI
 * module's output (lawyer-needed gauge) directly seeds the case-
 * management module's input (a new case).
 */
export function CreateCaseFromAnalysisButton({
  analysisId,
  title,
  caseType,
  summary,
}: {
  analysisId: string;
  title: string;
  caseType: CaseType;
  summary: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "creating" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function handleCreate() {
    setState("creating");
    setErrorMsg("");
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.slice(0, 120),
          case_type: caseType,
          jurisdiction: "",
          city: "",
          // Carry the analysis context into the case draft so the
          // onboarding flow / lawyer can see why the case was opened.
          draft_data: {
            source: "legal-ai",
            analysis_id: analysisId,
            summary,
          },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const { case: created } = await res.json();
      setState("done");
      // Brief success state, then navigate to the case.
      setTimeout(() => {
        router.push(`/cases/${created.id}`);
      }, 600);
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to create case");
    }
  }

  if (state === "done") {
    return (
      <Button className="bg-teal-700 hover:bg-teal-800" disabled>
        <CheckCircle2 className="h-4 w-4" />
        تم إنشاء القضية — جاري التحويل…
      </Button>
    );
  }

  return (
    <Button
      onClick={handleCreate}
      disabled={state === "creating"}
      className="bg-teal-700 hover:bg-teal-800"
    >
      {state === "creating" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Gavel className="h-4 w-4" />
      )}
      {state === "creating" ? "جاري الإنشاء…" : "افتح قضية من هذا التحليل"}
      {state === "error" && (
        <span className="ml-2 text-xs text-red-100">({errorMsg})</span>
      )}
    </Button>
  );
}
