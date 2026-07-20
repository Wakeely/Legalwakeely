"use client";

import { useState, useCallback, useRef, useEffect, Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { useLocale } from "@/lib/locale-provider";
import { useSession } from "@/lib/session-provider";
import { showToast } from "@/components/ui/toast";
import { cn, sleep } from "@/lib/utils";
import { extractPdfText, extractImageText } from "@/lib/legal-ai/pdf-client";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Camera,
  X,
  Check,
  AlertTriangle,
  Sparkles,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { DocumentType } from "@/lib/types";

const STAGES: { key: string; ar: string; en: string }[] = [
  { key: "upload", ar: "رفع الملف", en: "Uploading file" },
  { key: "ocr", ar: "استخراج النص (OCR)", en: "Extracting text (OCR)" },
  { key: "classify", ar: "تصنيف الوثيقة", en: "Classifying document" },
  { key: "rag", ar: "البحث في القانون الأردني", en: "Searching Jordanian law" },
  { key: "analyze", ar: "توليد التحليل", en: "Generating analysis" },
  { key: "review", ar: "في انتظار المراجعة البشرية", en: "Awaiting human review" },
];

const DOC_TYPES: DocumentType[] = ["rental", "employment", "traffic", "consumer", "general"];

export default function UploadPage() {
  return (
    <Suspense fallback={<UploadSkeleton />}>
      <UploadPageInner />
    </Suspense>
  );
}

function UploadSkeleton() {
  return (
    <div className="container-page max-w-3xl py-10">
      <div className="skeleton mb-8 h-32 rounded-2xl" />
      <div className="skeleton h-96 rounded-2xl" />
    </div>
  );
}

function UploadPageInner() {
  const { t, locale } = useLocale();
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get("plan");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [docType, setDocType] = useState<DocumentType>("rental");
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (plan === "report" || plan === "monthly") {
      showToast({
        variant: "info",
        title: locale === "ar" ? "وضع التقرير المدفوع مفعّل" : "Paid report mode active",
        description:
          locale === "ar"
            ? "سيتم تسليم تقرير مفصّل قابل للتصدير."
            : "You'll get a detailed exportable report.",
      });
    }
  }, [plan, locale]);

  const onSelectFile = useCallback(async (f: File) => {
    setError(null);
    setExtractedText("");
    const valid = ["application/pdf", "image/jpeg", "image/png", "image/heic"];
    if (!valid.includes(f.type) && !f.name.match(/\.(pdf|jpg|jpeg|png|heic)$/i)) {
      setError(locale === "ar" ? "نوع ملف غير مدعوم." : "Unsupported file type.");
      return;
    }
    if (f.size > 4 * 1024 * 1024) {
      setError(
        locale === "ar"
          ? "الملف أكبر من 4 ميغا. الحد الأقصى 4 ميغابايت."
          : "File too large (max 4 MB).",
      );
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, ""));
    }
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }

    // Extract text in the background
    setExtracting(true);
    setOcrProgress(0);
    try {
      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      const result = isPdf
        ? await extractPdfText(f)
        : await extractImageText(f, (pct) => setOcrProgress(pct));
      if (result.ok && result.text) {
        setExtractedText(result.text);
        if (locale === "ar") {
          showToast({
            variant: "success",
            title: "تم استخراج النص",
            description: isPdf
              ? `تم استخراج نص من ${result.pageCount} صفحة.`
              : "تم استخراج النص من الصورة.",
          });
        }
      } else if (result.error) {
        console.warn("Text extraction warning:", result.error);
        if (locale === "ar") {
          showToast({
            variant: "warning",
            title: "تعذّر استخراج النص",
            description: "سيتم استخدام Gemini لتحليل الصورة مباشرة.",
          });
        }
      }
    } catch (e: unknown) {
      console.error("Text extraction failed:", e);
    } finally {
      setExtracting(false);
    }
  }, [locale, title]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const f = e.dataTransfer.files[0];
      if (f) onSelectFile(f);
    },
    [onSelectFile],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async () => {
    if (!file) {
      setError(locale === "ar" ? "الرجاء اختيار ملف أولاً." : "Please choose a file first.");
      return;
    }
    if (!consent) {
      setError(locale === "ar" ? "الرجاء الموافقة على الإقرار." : "Please accept the disclaimer.");
      return;
    }
    setError(null);
    setSubmitting(true);
    setCurrentStage(0);

    const id = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Show stages with real progress. We only delay briefly between stages.
    setCurrentStage(0);
    await sleep(400);
    setCurrentStage(1);
    // If we have extracted text, show it. Otherwise wait briefly.
    if (extracting) {
      // Wait for extraction to finish (cap at 8 seconds)
      const t0 = Date.now();
      while (extracting && Date.now() - t0 < 8000) await sleep(200);
    } else if (!extractedText && file) {
      // Run extraction now (if it wasn't triggered on file select)
      setExtracting(true);
      try {
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        const result = isPdf ? await extractPdfText(file) : await extractImageText(file);
        if (result.text) setExtractedText(result.text);
      } catch (e) {
        console.error(e);
      } finally {
        setExtracting(false);
      }
    }
    setCurrentStage(2);
    await sleep(300);
    setCurrentStage(3);
    await sleep(300);
    setCurrentStage(4);

    let res: Response;
    try {
      const form = new FormData();
      form.append("id", id);
      form.append("docType", docType);
      form.append("title", title);
      if (plan) form.append("plan", plan);
      if (user?.id) form.append("userId", user.id);
      form.append("content", extractedText);
      if (file) form.append("file", file, file.name);
      res = await fetch("/api/legal-ai/analyze", { method: "POST", body: form });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : (locale === "ar" ? "غير معروف" : "unknown");
      setError(
        locale === "ar"
          ? `خطأ في الاتصال بالخادم: ${msg}`
          : `Network error: ${msg}`,
      );
      setSubmitting(false);
      return;
    }

    if (!res.ok) {
      let detail = "";
      let userMessage = "";
      try {
        const j = await res.json();
        if (j?.error === "file_too_large") {
          userMessage =
            locale === "ar"
              ? "الملف كبير جداً. الحد الأقصى 4 ميغابايت."
              : "File too large. Max 4 MB.";
        } else if (j?.error === "body_parse_failed") {
          userMessage =
            locale === "ar"
              ? "تعذّر قراءة الملف. جرّب ملفاً أصغر (أقل من 4 ميغابايت)."
              : "Couldn't read the file. Try one under 4 MB.";
        } else if (j?.error === "rate_limited") {
          userMessage =
            locale === "ar"
              ? "تجاوزت الحد المسموح من الطلبات. انتظر قليلاً."
              : "Rate limit reached. Wait a moment.";
        } else if (j?.error === "db_insert_failed") {
          userMessage =
            locale === "ar"
              ? "تعذّر حفظ النتيجة. حاول مرة أخرى."
              : "Couldn't save the result. Try again.";
        } else if (j?.error === "unsupported_file_type") {
          userMessage =
            locale === "ar"
              ? "نوع الملف غير مدعوم. استخدم PDF أو صورة."
              : "Unsupported file type. Use PDF or image.";
        }
        detail = j?.error || j?.details ? `: ${JSON.stringify(j).slice(0, 200)}` : "";
      } catch { /* not JSON */ }
      setError(
        userMessage ||
          (locale === "ar" ? "فشل التحليل. حاول مرة أخرى." : "Analysis failed. Try again.") +
          (detail ? ` (${res.status}${detail})` : ` (${res.status})`),
      );
      setSubmitting(false);
      return;
    }

    const { analysisId } = (await res.json()) as { analysisId: string };
    setCurrentStage(5);
    showToast({
      variant: "success",
      title: locale === "ar" ? "تم التحليل بنجاح" : "Analysis complete",
      description:
        locale === "ar"
          ? "يمكنك الآن مراجعة النتيجة على الصفحة التالية."
          : "You can review the result on the next page.",
    });
    router.push(`/legal-ai/analyses/${analysisId}`);
  };

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="mb-8 text-center">
        <Badge tone="info" icon={<Sparkles className="h-3.5 w-3.5" />}>
          {locale === "ar" ? "تحليل ذكي بالعربية" : "AI analysis in Arabic"}
        </Badge>
        <h1 className="mt-3 text-2xl font-extrabold text-ink-900 sm:text-3xl">
          {t.upload.title}
        </h1>
        <p className="mt-2 text-base text-ink-600">{t.upload.subtitle}</p>
      </div>

      {!submitting ? (
        <Card>
          <CardBody className="space-y-6">
            <div>
              <Label>
                {locale === "ar" ? "1. ارفع الوثيقة" : "1. Upload the document"}
              </Label>
              <div
                role="button"
                tabIndex={0}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                }}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-ink-50/40 p-8 text-center transition-colors",
                  dragActive
                    ? "border-brand-500 bg-brand-50"
                    : "border-ink-300 hover:border-brand-400 hover:bg-brand-50/40",
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onSelectFile(f);
                  }}
                />
                {file ? (
                  <FilePreview
                    file={file}
                    preview={preview}
                    extracting={extracting}
                    ocrProgress={ocrProgress}
                    onRemove={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                  />
                ) : (
                  <>
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-100 text-brand-700">
                      <Upload className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        {t.upload.dropTitle}
                      </p>
                      <p className="mt-1 text-xs text-ink-500">{t.upload.dropHint}</p>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        icon={<FileText className="h-3.5 w-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          inputRef.current?.click();
                        }}
                      >
                        {t.upload.browse}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        icon={<Camera className="h-3.5 w-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (inputRef.current) {
                            inputRef.current.setAttribute("capture", "environment");
                            inputRef.current.click();
                            inputRef.current.removeAttribute("capture");
                          }
                        }}
                      >
                        {t.upload.camera}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t.upload.typeLabel}
                required
                htmlFor="docType"
              >
                <Select
                  id="docType"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType)}
                >
                  {DOC_TYPES.map((d) => (
                    <option key={d} value={d}>
                      {t.upload.types[d]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t.upload.titleLabel}
                htmlFor="title"
                hint={locale === "ar" ? "سيظهر في لوحة تحكمك." : "Shown in your dashboard."}
              >
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t.upload.titlePlaceholder}
                />
              </Field>
            </div>

            <Alert variant="warning" title={locale === "ar" ? "تنبيه مهم" : "Important"}>
              {locale === "ar"
                ? "هذا التحليل لأغراض توضيحية فقط وليس استشارة قانونية رسمية. لا يُنشئ علاقة محامي-موكل بينك وبين المنصة."
                : "This analysis is informational only and does not create a lawyer-client relationship."}
            </Alert>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-ink-50 p-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span className="text-xs leading-6 text-ink-700">{t.upload.consent}</span>
            </label>

            {error && (
              <Alert variant="danger" title={locale === "ar" ? "خطأ" : "Error"}>
                {error}
              </Alert>
            )}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-500">
                {locale === "ar"
                  ? "مشفّر من الطرف إلى الطرف · لا يُشارَك مع أي طرف"
                  : "End-to-end encrypted · Not shared with anyone"}
              </p>
              <Button onClick={submit} size="lg" iconEnd={<ChevronRight className="h-4 w-4" />}>
                {t.upload.submit}
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="space-y-6 py-12">
            <div className="text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-600 to-accent-500 text-white shadow-lg">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <h2 className="mt-4 text-xl font-bold text-ink-900">
                {locale === "ar" ? "جاري تحليل وثيقتك" : "Analyzing your document"}
              </h2>
              <p className="mt-1 text-sm text-ink-500">
                {locale === "ar"
                  ? "عادة ما يستغرق أقل من 15 ثانية."
                  : "Usually takes less than 15 seconds."}
              </p>
            </div>
            <ol className="space-y-2">
              {STAGES.map((s, i) => {
                const done = i < currentStage;
                const active = i === currentStage;
                return (
                  <li
                    key={s.key}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors",
                      done && "border-emerald-200 bg-emerald-50/50",
                      active && "border-brand-300 bg-brand-50",
                      !done && !active && "border-ink-200",
                    )}
                  >
                    <div
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-full",
                        done && "bg-emerald-500 text-white",
                        active && "bg-brand-600 text-white",
                        !done && !active && "bg-ink-100 text-ink-400",
                      )}
                    >
                      {done ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : active ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <span className="text-[10px] font-bold">{i + 1}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "font-medium",
                        done && "text-emerald-800",
                        active && "text-brand-900",
                        !done && !active && "text-ink-400",
                      )}
                    >
                      {locale === "ar" ? s.ar : s.en}
                    </span>
                  </li>
                );
              })}
            </ol>
          </CardBody>
        </Card>
      )}

      <div className="mt-8">
        <Alert variant="info" title={locale === "ar" ? "كيف نضمن جودة التحليل؟" : "How do we ensure quality?"}>
          <ul className="mt-1 list-disc ps-5 text-sm leading-7">
            <li>
              {locale === "ar"
                ? "كل تحليل يمر بمراجعة بشرية من محامٍ مرخص قبل تسليمه لك."
                : "Every analysis is reviewed by a licensed lawyer before delivery."}
            </li>
            <li>
              {locale === "ar"
                ? "التحليل مدعوم بقانون أردني محدّث (RAG)."
                : "The analysis is grounded in updated Jordanian law (RAG)."}
            </li>
            <li>
              {locale === "ar"
                ? "لا نحفظ وثيقتك إلا إذا أنشأت حساباً."
                : "We don't store your document unless you create an account."}
            </li>
          </ul>
        </Alert>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-sm font-semibold text-ink-800">{children}</div>
  );
}

function FilePreview({
  file,
  preview,
  extracting,
  ocrProgress,
  onRemove,
}: {
  file: File;
  preview: string | null;
  extracting: boolean;
  ocrProgress: number;
  onRemove: (e: React.MouseEvent) => void;
}) {
  const sizeKb = (file.size / 1024).toFixed(0);
  return (
      <div className="flex w-full items-center gap-4 rounded-xl border border-ink-200 bg-white p-3 text-start">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        {file.type.startsWith("image/") && preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={file.name}
            className="h-12 w-12 rounded-lg object-cover"
          />
        ) : file.type === "application/pdf" ? (
          <FileText className="h-6 w-6" />
        ) : (
          <ImageIcon className="h-6 w-6" />
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="truncate text-sm font-semibold text-ink-900">
          {file.name}
        </div>
        <div className="text-xs text-ink-500">
          {file.type || "file"} · {sizeKb} KB
        </div>
        {extracting && file.type.startsWith("image/") && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-brand-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            جارٍ قراءة النص من الصورة... {ocrProgress > 0 ? `${ocrProgress}%` : ""}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-ink-100"
        aria-label="Remove"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}


