"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { showToast } from "@/components/ui/toast";
import { useLocale } from "@/lib/locale-provider";
import { useSession } from "@/lib/session-provider";
import { Sparkles, Send, Check } from "lucide-react";

export function HireForm({
  lawyerId,
  analysisContext,
}: {
  lawyerId: string;
  analysisContext: { id: string; title: string; summary: string } | null;
}) {
  const { t, locale } = useLocale();
  const { user } = useSession();
  const router = useRouter();
  const [message, setMessage] = useState(
    analysisContext
      ? `السلام عليكم، أحتاج استشارة بخصوص: ${analysisContext.title}`
      : "",
  );
  const [fee, setFee] = useState(30);
  const [attach, setAttach] = useState(!!analysisContext);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!user) {
      router.push("/auth/login");
      return;
    }
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lawyerId, message, feeOffered: fee, attachAnalysis: attach, analysisContext }),
      });
      if (!res.ok) throw new Error("failed");
      setSent(true);
      showToast({
        variant: "success",
        title: locale === "ar" ? "تم إرسال الطلب" : "Request sent",
      });
    } catch {
      showToast({
        variant: "danger",
        title: locale === "ar" ? "فشل إرسال الطلب" : "Failed to send",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Alert variant="success" title={locale === "ar" ? "تم إرسال الطلب بنجاح" : "Request sent"}>
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 h-4 w-4 text-emerald-600" />
          <p className="text-sm">
            {locale === "ar"
              ? "سيتواصل معك المحامي خلال 24 ساعة على رقمك المسجّل."
              : "The lawyer will reach out within 24 hours on your registered phone."}
          </p>
        </div>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {analysisContext && (
        <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-800">
            <Sparkles className="h-3.5 w-3.5" />
            {locale === "ar" ? "سيتم إرفاق التحليل التالي" : "Analysis to attach"}
          </div>
          <p className="mt-1 text-sm font-semibold text-ink-900">
            {analysisContext.title}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-ink-600">
            {analysisContext.summary}
          </p>
        </div>
      )}

      <Field
        label={locale === "ar" ? "رسالة قصيرة" : "Short message"}
        required
      >
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={locale === "ar" ? "اشرح للمحامي طبيعة مشكلتك باختصار..." : "Briefly explain your situation..."}
          rows={4}
        />
      </Field>

      <Field
        label={locale === "ar" ? "عرض أتعاب مبدئي (د.أ)" : "Initial fee offer (JOD)"}
        hint={locale === "ar" ? "هذا عرض استرشادي فقط، للمحامي حرية القبول أو الرفض أو التفاوض." : "Indicative offer only — the lawyer may accept, decline, or counter."}
      >
        <Input
          type="number"
          min={0}
          step={5}
          value={fee}
          onChange={(e) => setFee(parseInt(e.target.value || "0", 10))}
        />
      </Field>

      <Button
        onClick={submit}
        loading={submitting}
        className="w-full"
        size="md"
        icon={<Send className="h-4 w-4" />}
      >
        {locale === "ar" ? "إرسال الطلب" : "Send request"}
      </Button>
    </div>
  );
}
