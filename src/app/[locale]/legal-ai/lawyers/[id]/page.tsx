import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { mockLawyers, specialtyLabels, cityLabels, mockAnalyses } from "@/lib/mock-data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/star-rating";
import { HireForm } from "@/components/hire-form";
import { CheckCircle2, Gavel, MapPin, Award, Globe2, ArrowLeft } from "lucide-react";

export function generateStaticParams() {
  return mockLawyers.map((l) => ({ id: l.id }));
}

export default async function LawyerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ fromAnalysis?: string }>;
}) {
  const { id } = await params;
  const { fromAnalysis } = await searchParams;
  const lawyer = mockLawyers.find((l) => l.id === id);
  if (!lawyer) notFound();

  const analysis = fromAnalysis
    ? mockAnalyses.find((a) => a.id === fromAnalysis)
    : null;

  return (
    <div className="container-page max-w-5xl py-10">
      <Link
        href="/legal-ai/lawyers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5 flip-rtl" />
        العودة إلى الدليل
      </Link>

      <Card>
        <CardBody>
          <div className="flex flex-col items-start gap-6 md:flex-row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lawyer.avatar}
              alt={lawyer.name}
              className="h-28 w-28 rounded-2xl border-4 border-white object-cover shadow-md"
            />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-extrabold text-ink-900">
                  {lawyer.name}
                </h1>
                {lawyer.verified && (
                  <Badge tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
                    موثّق
                  </Badge>
                )}
                {lawyer.isAvailable ? (
                  <Badge tone="info">متاح</Badge>
                ) : (
                  <Badge tone="neutral">غير متاح</Badge>
                )}
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm text-ink-600">
                <StarRating value={lawyer.rating} showValue size="md" />
                <span>·</span>
                <span>{lawyer.totalReviews} تقييم</span>
                <span>·</span>
                <span>{lawyer.yearsExperience} سنة خبرة</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-ink-600">
                <span className="inline-flex items-center gap-1">
                  <Gavel className="h-4 w-4" />
                  نقابة: {lawyer.barNumber}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {lawyer.cities.map((c) => cityLabels[c]?.ar ?? c).join("، ")}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Globe2 className="h-4 w-4" />
                  {lawyer.languages.map((l) => (l === "ar" ? "العربية" : "English")).join("، ")}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {lawyer.specialties.map((s) => (
                  <Badge key={s} tone="info">
                    {specialtyLabels[s]?.ar ?? s}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-end">
              <div className="text-xs text-ink-500">الأتعاب بالساعة</div>
              <div className="text-2xl font-extrabold text-ink-900">
                {lawyer.hourlyRate} د.أ
              </div>
              <div className="mt-1 text-xs text-ink-500">
                استشارة مدتها 30 دقيقة تبدأ من {Math.round(lawyer.hourlyRate / 2)} د.أ
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="نبذة عن المحامي" />
            <CardBody>
              <p className="text-sm leading-8 text-ink-700">{lawyer.bio.ar}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="إحصائيات" />
            <CardBody>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="سنوات الخبرة" value={lawyer.yearsExperience} suffix="سنة" />
                <Stat label="قضايا ناجحة" value={lawyer.successStories} />
                <Stat label="تقييم العملاء" value={lawyer.rating} suffix="⭐" />
                <Stat label="أتعاب/ساعة" value={lawyer.hourlyRate} suffix="د.أ" />
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6" id="contact">
          <Card>
            <CardHeader
              icon={<Gavel className="h-5 w-5" />}
              title="طلب استشارة"
              description="سيتم إرفاق تحليل وثيقتك تلقائياً"
            />
            <CardBody>
              <HireForm
                lawyerId={lawyer.id}
                analysisContext={analysis ? {
                  id: analysis.id,
                  title: analysis.documentTitle,
                  summary: analysis.summary,
                } : null}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4 text-center">
      <div className="text-xl font-extrabold text-ink-900">
        {value}
        {suffix && <span className="ms-1 text-xs text-ink-500">{suffix}</span>}
      </div>
      <div className="mt-1 text-xs text-ink-500">{label}</div>
    </div>
  );
}
