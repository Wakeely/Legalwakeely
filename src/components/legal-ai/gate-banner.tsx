import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import type { LegalAiAccess } from "@/lib/legal-ai/gate";

/**
 * Renders when a user tries to access a Legal-AI page without the
 * add-on. Shows a clear upgrade CTA and explains the value.
 */
export function LegalAiGate({ access }: { access: LegalAiAccess }) {
  const isCapReached = access.reason === "usage_cap_reached";

  return (
    <div className="container-page max-w-2xl py-16">
      <div className="rounded-3xl border border-ink-200 bg-white p-8 text-center shadow-sm sm:p-12">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white">
          {isCapReached ? <Sparkles className="h-7 w-7" /> : <Lock className="h-7 w-7" />}
        </div>

        <h1 className="text-2xl font-extrabold text-ink-900">
          {isCapReached ? "لقد وصلت إلى الحد الشهري" : "إضافة Legal-AI مطلوبة"}
        </h1>

        <p className="mt-3 text-ink-600">
          {isCapReached
            ? `استخدمت ${access.usedThisMonth} من ${access.monthlyCap} تحليلاً هذا الشهر. تتجدد الحصة في بداية الشهر التالي، أو يمكنك ترقية باقتك للحصول على تحاليل أكثر.`
            : "تحليل الوثائق القانونية بالذكاء الاصطناعي ميزة مدفوعة ضمن إضافة Legal-AI. فعّلها الآن لفتح تحليل غير محدود للعقود والإنذارات والمخالفات."}
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/billing"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
          >
            {isCapReached ? "ترقية الباقة" : "فعّل الإضافة الآن"}
          </Link>
          <Link
            href="/legal-ai"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-ink-300 bg-white px-6 text-sm font-semibold text-ink-900 transition-colors hover:bg-ink-50"
          >
            العودة إلى Legal-AI
          </Link>
        </div>

        {!isCapReached && (
          <p className="mt-6 text-xs text-ink-400">
            الإضافة متاحة أيضاً ضمن باقة Premium بدون تكلفة إضافية.
          </p>
        )}
      </div>
    </div>
  );
}
