import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkLegalAiAccess } from "@/lib/legal-ai/gate";
import { LegalAiGate } from "@/components/legal-ai/gate-banner";
import { getAnalyses } from "@/lib/legal-ai/data";
import { mockAnalyses } from "@/lib/mock-data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCheck2, Plus, ArrowLeft, Calendar, Eye } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AnalysesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await checkLegalAiAccess(user?.id);

  // Non-subscribers see the upgrade CTA instead of the analysis gallery.
  if (!access.allowed) {
    return <LegalAiGate access={access} />;
  }

  // Subscribers see their own analyses first, plus the sample gallery.
  let myAnalyses: typeof mockAnalyses = [];
  if (user) {
    try {
      myAnalyses = await getAnalyses(user.id);
    } catch {
      // fall through to mock gallery
    }
  }

  const docTypeLabel = (t: string) =>
    t === "rental"
      ? "عقد إيجار"
      : t === "employment"
        ? "إنذار عمل"
        : t === "traffic"
          ? "مخالفة مرورية"
          : t === "consumer"
            ? "عقد استهلاكي"
            : "وثيقة عامة";

  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="info" icon={<FileCheck2 className="h-3.5 w-3.5" />}>
            تحليلاتي
          </Badge>
          <h1 className="mt-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
            {myAnalyses.length > 0 ? "تحليلاتك السابقة" : "نماذج تحليل لوثائق شائعة"}
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            {myAnalyses.length > 0
              ? `لديك ${myAnalyses.length} تحليل. تعرّف على شكل التحليل الكامل عبر النماذج أدناه.`
              : "تعرّف على شكل التحليل الكامل عبر نماذج من وثائق حقيقية."}
          </p>
        </div>
        <Link href="/legal-ai/upload">
          <Button icon={<Plus className="h-4 w-4" />}>جرّب بنفسك</Button>
        </Link>
      </div>

      {myAnalyses.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">تحليلاتك</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {myAnalyses.map((a) => (
              <Card key={a.id} className="flex flex-col">
                <CardHeader
                  icon={<FileCheck2 className="h-5 w-5" />}
                  title={a.documentTitle}
                  description={`تحليل: ${docTypeLabel(a.documentType)}`}
                />
                <CardBody className="flex-1 space-y-3">
                  <p className="line-clamp-3 text-sm leading-7 text-ink-600">{a.summary}</p>
                  <div className="flex items-center gap-3 text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(a.createdAt).toLocaleDateString("ar-JO", { dateStyle: "medium" })}
                    </span>
                    <span>
                      · {a.rights.length} حقوق · {a.risks.length} مخاطر
                    </span>
                  </div>
                </CardBody>
                <div className="border-t border-ink-100 p-4">
                  <Link href={`/legal-ai/analyses/${a.id}`}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      iconEnd={<ArrowLeft className="h-3.5 w-3.5" />}
                    >
                      اقرأ التحليل الكامل
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-ink-500">نماذج</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockAnalyses.map((a) => (
            <Card key={a.id} className="flex flex-col">
              <CardHeader
                icon={<Eye className="h-5 w-5" />}
                title={a.documentTitle}
                description={`تحليل: ${docTypeLabel(a.documentType)}`}
              />
              <CardBody className="flex-1 space-y-3">
                <p className="line-clamp-3 text-sm leading-7 text-ink-600">{a.summary}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={
                      a.lawyerScore === "HIGH"
                        ? "danger"
                        : a.lawyerScore === "MEDIUM"
                          ? "warning"
                          : "success"
                    }
                  >
                    محامي:{" "}
                    {a.lawyerScore === "HIGH"
                      ? "عالية"
                      : a.lawyerScore === "MEDIUM"
                        ? "متوسطة"
                        : "منخفضة"}
                  </Badge>
                  <Badge
                    tone={
                      a.reviewStatus === "APPROVED"
                        ? "success"
                        : a.reviewStatus === "PENDING"
                          ? "warning"
                          : "danger"
                    }
                  >
                    {a.reviewStatus === "APPROVED"
                      ? "معتمد"
                      : a.reviewStatus === "PENDING"
                        ? "معلّق"
                        : "مرفوض"}
                  </Badge>
                  <Badge tone="neutral">الثقة {Math.round(a.confidenceScore * 100)}%</Badge>
                </div>
              </CardBody>
              <div className="border-t border-ink-100 p-4">
                <Link href={`/legal-ai/analyses/${a.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    iconEnd={<ArrowLeft className="h-3.5 w-3.5" />}
                  >
                    اقرأ التحليل الكامل
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
