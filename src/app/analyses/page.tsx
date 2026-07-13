import Link from "next/link";
import { mockAnalyses } from "@/lib/mock-data";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileCheck2, Plus, ArrowLeft, Calendar, Eye } from "lucide-react";

export default function AnalysesPage() {
  return (
    <div className="container-page py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="info" icon={<FileCheck2 className="h-3.5 w-3.5" />}>
            نماذج تحليل
          </Badge>
          <h1 className="mt-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
            تحليلات لوثائق شائعة
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            تعرّف على شكل التحليل الكامل عبر نماذج من وثائق حقيقية.
          </p>
        </div>
        <Link href="/upload">
          <Button icon={<Plus className="h-4 w-4" />}>جرّب بنفسك</Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockAnalyses.map((a) => (
          <Card key={a.id} className="flex flex-col">
            <CardHeader
              icon={<FileCheck2 className="h-5 w-5" />}
              title={a.documentTitle}
              description={`تحليل: ${
                a.documentType === "rental"
                  ? "عقد إيجار"
                  : a.documentType === "employment"
                    ? "إنذار عمل"
                    : a.documentType === "traffic"
                      ? "مخالفة مرورية"
                      : a.documentType === "consumer"
                        ? "عقد استهلاكي"
                        : "وثيقة عامة"
              }`}
            />
            <CardBody className="flex-1 space-y-3">
              <p className="line-clamp-3 text-sm leading-7 text-ink-600">
                {a.summary}
              </p>
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
                  محامي: {a.lawyerScore === "HIGH" ? "عالية" : a.lawyerScore === "MEDIUM" ? "متوسطة" : "منخفضة"}
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
                  {a.reviewStatus === "APPROVED" ? "معتمد" : a.reviewStatus === "PENDING" ? "معلّق" : "مرفوض"}
                </Badge>
                <Badge tone="neutral">الثقة {Math.round(a.confidenceScore * 100)}%</Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-ink-500">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(a.createdAt).toLocaleDateString("ar-JO", { dateStyle: "medium" })}
                </span>
                <span>· {a.rights.length} حقوق · {a.risks.length} مخاطر</span>
              </div>
            </CardBody>
            <div className="border-t border-ink-100 p-4">
              <Link href={`/analyses/${a.id}`}>
                <Button variant="outline" size="sm" className="w-full" iconEnd={<ArrowLeft className="h-3.5 w-3.5" />}>
                  اقرأ التحليل الكامل
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

