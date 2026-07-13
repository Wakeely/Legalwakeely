import { notFound } from "next/navigation";
import Link from "next/link";
import { mockAnalyses, mockLawyers } from "@/lib/mock-data";
import { getAnalysisById } from "@/lib/data";
import type { Analysis } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Accordion } from "@/components/ui/accordion";
import { LawyerScoreGauge } from "@/components/lawyer-score-gauge";
import { CheckCircle2, FileText, Gavel, Sparkles, BookOpen, ArrowLeft, ShieldCheck } from "lucide-react";

// Force dynamic so newly-created analyses are visible immediately
export const dynamic = "force-dynamic";
// Don't try to statically generate any analysis pages
export const dynamicParams = true;

async function fetchAnalysisDirectly(id: string): Promise<Analysis | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`[analysis-page] fetch id=${id} url=${url} keySet=${Boolean(key)}`);
  if (!url || !key) return null;
  try {
    const r = await fetch(
      `${url}/rest/v1/Analysis?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        cache: "no-store",
      },
    );
    console.log(`[analysis-page] status=${r.status}`);
    if (!r.ok) {
      const text = await r.text();
      console.log(`[analysis-page] error body: ${text.slice(0, 200)}`);
      return null;
    }
    const rows = (await r.json()) as any[];
    console.log(`[analysis-page] rows returned: ${rows.length}`);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      documentId: row.documentId,
      userId: row.userId,
      documentType: row.documentType,
      documentTitle: row.documentTitle,
      summary: row.summary,
      rights: row.rights ?? [],
      obligations: row.obligations ?? [],
      risks: row.risks ?? [],
      lawyerScore: row.lawyerScore,
      lawyerReason: row.lawyerReason,
      nextSteps: row.nextSteps ?? [],
      sources: row.sources ?? [],
      confidenceScore: row.confidenceScore ?? 0.85,
      reviewStatus: row.reviewStatus ?? "PENDING",
      reviewedBy: row.reviewedById ?? undefined,
      reviewNotes: row.reviewNotes ?? undefined,
      createdAt: row.createdAt,
    };
  } catch (e: any) {
    console.log(`[analysis-page] fetch threw: ${e?.message}`);
    return null;
  }
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  console.log(`[analysis-page] rendering id=${id}`);
  // Direct fetch to Supabase REST API (works from Vercel serverless)
  let analysis = await fetchAnalysisDirectly(id);
  // Fall back to data layer (Prisma or supabase-js client)
  if (!analysis) analysis = await getAnalysisById(id);
  // Last resort: in-memory mock
  if (!analysis) analysis = mockAnalyses.find((a) => a.id === id) ?? null;
  if (!analysis) notFound();

  const matchingLawyers = mockLawyers.filter((l) =>
    l.specialties.includes(analysis.documentType),
  );

  return (
    <div className="container-page max-w-5xl py-10">
      <Link
        href="/dashboard"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5 flip-rtl" />
        العودة إلى لوحة التحكم
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              tone={
                analysis.reviewStatus === "APPROVED"
                  ? "success"
                  : analysis.reviewStatus === "PENDING"
                    ? "warning"
                    : "danger"
              }
              icon={
                analysis.reviewStatus === "APPROVED" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : undefined
              }
            >
              {analysis.reviewStatus === "APPROVED"
                ? "مراجَع من محامٍ"
                : "في انتظار المراجعة"}
            </Badge>
            <Badge tone="info">{documentTypeLabel(analysis.documentType)}</Badge>
          </div>
          <h1 className="mt-2 text-xl font-extrabold text-ink-900 sm:text-2xl">
            {analysis.documentTitle}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            تم إنشاؤه في {new Date(analysis.createdAt).toLocaleDateString("ar-JO", { dateStyle: "long" })} · نسبة الثقة {Math.round(analysis.confidenceScore * 100)}%
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm">تحميل PDF</Button>
          <Button variant="outline" size="sm">حفظ في حسابي</Button>
          <Link href={`/lawyers?docType=${analysis.documentType}&fromAnalysis=${analysis.id}`}>
            <Button size="sm" iconEnd={<ArrowLeft className="h-3.5 w-3.5" />}>
              تواصل مع محامٍ
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              icon={<FileText className="h-5 w-5" />}
              title="الملخص"
              description="فهم سريع لوثيقتك"
            />
            <CardBody>
              <p className="text-base leading-8 text-ink-800">{analysis.summary}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              icon={<Sparkles className="h-5 w-5" />}
              title="التفاصيل الكاملة"
              description="اضغط على كل قسم للتوسع"
            />
            <div className="p-5">
              <Accordion
                defaultOpen={0}
                items={[
                  {
                    id: "rights",
                    title: `حقوقك (${analysis.rights.length})`,
                    badge: <Badge tone="success">حقوق</Badge>,
                    content: (
                      <ul className="space-y-2.5">
                        {analysis.rights.map((r, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-ink-800">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    id: "obligations",
                    title: `التزاماتك (${analysis.obligations.length})`,
                    badge: <Badge tone="info">التزامات</Badge>,
                    content: (
                      <ul className="space-y-2.5">
                        {analysis.obligations.map((o, i) => (
                          <li key={i} className="flex items-start gap-2.5 text-sm text-ink-800">
                            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                              {i + 1}
                            </span>
                            {o}
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    id: "risks",
                    title: `المخاطر (${analysis.risks.length})`,
                    badge: <Badge tone="danger">مخاطر</Badge>,
                    content: (
                      <ul className="space-y-3">
                        {analysis.risks.map((r, i) => (
                          <li
                            key={i}
                            className="rounded-xl border border-ink-200 bg-white p-3"
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                tone={
                                  r.severity === "high"
                                    ? "danger"
                                    : r.severity === "medium"
                                      ? "warning"
                                      : "neutral"
                                }
                              >
                                {r.severity === "high"
                                  ? "مرتفع"
                                  : r.severity === "medium"
                                    ? "متوسط"
                                    : "منخفض"}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-ink-800">{r.text}</p>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                  {
                    id: "sources",
                    title: `المراجع القانونية (${analysis.sources.length})`,
                    badge: <Badge tone="info">قانون أردني</Badge>,
                    content: (
                      <ul className="space-y-3">
                        {analysis.sources.map((s, i) => (
                          <li
                            key={i}
                            className="rounded-xl border border-brand-200 bg-brand-50/40 p-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-ink-900">
                                {s.lawName}
                              </span>
                              {s.articleNumber && (
                                <Badge tone="info">{s.articleNumber}</Badge>
                              )}
                            </div>
                            <p className="mt-1.5 text-xs leading-6 text-ink-600">
                              {s.excerpt}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            </div>
          </Card>

          <Card>
            <CardHeader
              icon={<Gavel className="h-5 w-5" />}
              title="الخطوات التالية الموصى بها"
              description="تصرف بثقة بناءً على تحليل وثيقتك"
            />
            <CardBody className="space-y-3">
              {analysis.nextSteps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4"
                >
                  <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-ink-900">
                        {step.title}
                      </h4>
                      {step.isPaid && <Badge tone="info">موصى بمحامٍ</Badge>}
                    </div>
                    <p className="mt-1 text-sm leading-7 text-ink-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              icon={<ShieldCheck className="h-5 w-5" />}
              title="هل تحتاج محامياً؟"
            />
            <CardBody>
              <LawyerScoreGauge score={analysis.lawyerScore} />
              <p className="mt-4 text-sm leading-7 text-ink-700">
                {analysis.lawyerReason}
              </p>
              <div className="mt-4">
                <Link href={`/lawyers?docType=${analysis.documentType}&fromAnalysis=${analysis.id}`}>
                  <Button className="w-full" iconEnd={<ArrowLeft className="h-3.5 w-3.5" />}>
                    ابحث عن محامٍ متخصص
                  </Button>
                </Link>
              </div>
            </CardBody>
          </Card>

          {matchingLawyers.length > 0 && (
            <Card>
              <CardHeader
                icon={<Gavel className="h-5 w-5" />}
                title={`محامون متخصصون (${matchingLawyers.length})`}
              />
              <CardBody className="space-y-3">
                {matchingLawyers.slice(0, 3).map((l) => (
                  <Link
                    key={l.id}
                    href={`/lawyers/${l.id}?fromAnalysis=${analysis.id}`}
                    className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/30"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={l.avatar}
                      alt={l.name}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold text-ink-900">{l.name}</span>
                        {l.verified && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                      </div>
                      <div className="text-xs text-ink-500">
                        {l.hourlyRate} د.أ / ساعة · ⭐ {l.rating}
                      </div>
                    </div>
                    <ArrowLeft className="h-3.5 w-3.5 text-ink-400 flip-rtl" />
                  </Link>
                ))}
              </CardBody>
            </Card>
          )}

          <Alert
            variant="warning"
            title="⚠️ إخلاء مسؤولية"
          >
            هذا التحليل لأغراض توضيحية فقط وليس استشارة قانونية رسمية. يُرجى استشارة محامٍ مرخص للحصول على نصيحة قانونية مخصصة لحالتك.
          </Alert>
        </div>
      </div>
    </div>
  );
}

function documentTypeLabel(t: string) {
  return {
    rental: "عقد إيجار",
    employment: "قانون العمل",
    traffic: "مخالفة مرورية",
    consumer: "حماية المستهلك",
    general: "وثيقة عامة",
  }[t as "rental"] ?? "وثيقة";
}
