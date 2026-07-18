import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkLegalAiAccess } from "@/lib/legal-ai/gate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, Gavel, BookOpen, Scale, Sparkles, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LegalAiHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const access = await checkLegalAiAccess(user?.id);

  return (
    <div className="container-page max-w-5xl py-10">
      <div className="mb-8">
        <Badge className="mb-3 bg-teal-100 text-teal-800">Legal-AI Add-on</Badge>
        <h1 className="text-3xl font-extrabold text-ink-900">
          التحليل القانوني الذكي للوثائق
        </h1>
        <p className="mt-2 max-w-2xl text-ink-600">
          ارفع وثيقتك القانونية — عقد إيجار، إنذار عمل، مخالفة مرورية — واحصل على شرح
          واضح بالعربية خلال دقائق، مع توصية صريحة هل تحتاج محامياً أم لا.
        </p>
      </div>

      {!access.allowed && (
        <div className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <Lock className="mt-0.5 h-5 w-5 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              هذه الميزة ضمن إضافة Legal-AI المدفوعة
            </p>
            <p className="mt-1 text-xs text-amber-700">
              {access.reason === "usage_cap_reached"
                ? `لقد استخدمت حصتك الشهرية (${access.usedThisMonth}/${access.monthlyCap}).`
                : "فعّل الإضافة لفتح تحليل الوثائق."}
            </p>
          </div>
          <Link href="/billing" className="inline-flex items-center justify-center rounded-xl font-semibold transition-all bg-amber-600 text-white hover:bg-amber-700 h-8 px-3 text-xs gap-1.5">ترقية الاشتراك</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="p-5">
          <Upload className="h-6 w-6 text-teal-600" />
          <h3 className="mt-2 font-bold">رفع وثيقة</h3>
          <p className="mt-1 text-sm text-ink-600">
            اسحب PDF أو التقط صورة. ندعم العقود والإنذارات والمخالفات.
          </p>
          <Link href="/legal-ai/upload" className="mt-4 inline-flex items-center justify-center rounded-xl font-semibold transition-all bg-brand-600 text-white hover:bg-brand-700 h-10 px-4 text-sm gap-2">ابدأ التحليل</Link>
        </Card>

        <Card className="p-5">
          <FileText className="h-6 w-6 text-teal-600" />
          <h3 className="mt-2 font-bold">تحاليلي السابقة</h3>
          <p className="mt-1 text-sm text-ink-600">
            راجع كل تحاليلك السابقة ونتائجها ومراجعة المحامين عليها.
          </p>
          <Link href="/legal-ai/analyses" className="mt-4 inline-flex items-center justify-center rounded-xl font-semibold transition-all border border-ink-300 bg-white text-ink-900 hover:bg-ink-50 h-10 px-4 text-sm gap-2">عرض التحاليل</Link>
        </Card>

        <Card className="p-5">
          <Gavel className="h-6 w-6 text-teal-600" />
          <h3 className="mt-2 font-bold">دليل المحامين</h3>
          <p className="mt-1 text-sm text-ink-600">
            محامون موثقون متخصصون، جاهزون لاستلام قضيتك مباشرة من التحليل.
          </p>
          <Link href="/legal-ai/lawyers" className="mt-4 inline-flex items-center justify-center rounded-xl font-semibold transition-all border border-ink-300 bg-white text-ink-900 hover:bg-ink-50 h-10 px-4 text-sm gap-2">تصفح المحامين</Link>
        </Card>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4">
          <Sparkles className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="text-sm font-bold">تحليل بالعربية الفصحى</p>
            <p className="text-xs text-ink-500">مبني على قانون أردني حقيقي عبر RAG.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4">
          <Scale className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="text-sm font-bold">توصية صادقة</p>
            <p className="text-xs text-ink-500">هل تحتاج محامياً؟ نخبرك بصراحة.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-white p-4">
          <BookOpen className="mt-0.5 h-5 w-5 text-teal-600" />
          <div>
            <p className="text-sm font-bold">مصادر قانونية موثقة</p>
            <p className="text-xs text-ink-500">كل تحليل يستند إلى مواد قانونية محددة.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
