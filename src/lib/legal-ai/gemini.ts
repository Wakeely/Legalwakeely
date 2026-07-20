import "server-only";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Analysis, DocumentType, LawyerScore } from "@/lib/types";
import { mockAnalyses, mockDocuments } from "@/lib/mock-data";
import { sleep } from "@/lib/utils";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Gemini analysis engine + RAG retriever — Supabase-native.
 *
 * Consolidation changes vs. the old almustahar version:
 *   - No Prisma. Corpus matching now runs via an RPC (`match_legal_corpus`)
 *     over the `legal_corpus` table (pgvector cosine search), invoked
 *     through the Supabase client. Falls back gracefully if the RPC
 *     or embeddings are unavailable.
 *   - Embeddings use Gemini text-embedding-001 at 768 dims (matches the
 *     `vector(768)` column in 20260342_legal_ai_module.sql).
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";
const EMBED_DIM = 768;

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;
const useGemini = Boolean(genAI);

// ---------- Embeddings ----------

export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!genAI) return null;
  try {
    const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: cleaned }] },
        outputDimensionality: EMBED_DIM,
      }),
    });
    if (!r.ok) {
      console.warn(`[gemini] embedContent HTTP ${r.status}`);
      return null;
    }
    const j = (await r.json()) as { embedding?: { values?: number[] } };
    const vec = j.embedding?.values;
    if (!vec || vec.length !== EMBED_DIM) {
      console.warn(`[gemini] Unexpected embedding dim: ${vec?.length}, expected ${EMBED_DIM}`);
      return null;
    }
    return vec;
  } catch (e) {
    console.error("[gemini] embedContent failed:", e);
    return null;
  }
}

export function isGeminiConfigured(): boolean {
  return useGemini;
}

// ---------- Legal corpus matching (RAG) ----------

export interface CorpusMatch {
  id: string;
  lawName: string;
  lawType: string;
  articleNumber: string | null;
  title: string | null;
  content: string;
  similarity: number;
}

/**
 * Retrieves the top-N legal-corpus chunks most similar to `query`.
 *
 * Tries the `match_legal_corpus` Postgres RPC (pgvector cosine).
 * If the RPC isn't installed (e.g. before `supabase db push`), falls
 * back to a plain `ilike` keyword scan over `legal_corpus.content`.
 */
export async function matchLegalCorpus(query: string, limit = 5): Promise<CorpusMatch[]> {
  if (!genAI) return [];
  if (!isSupabaseConfigured) return [];

  const embedding = await generateEmbedding(query);
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  // ── Path A: vector RPC (preferred) ──────────────────────────
  if (embedding) {
    try {
      const { data, error } = await admin.rpc("match_legal_corpus", {
        query_embedding: embedding,
        match_count: limit,
      });
      if (!error && Array.isArray(data) && data.length > 0) {
        return (data as Array<Record<string, unknown>>).map((row) => ({
          id: String(row.id),
          lawName: String(row.law_name ?? row.lawName ?? ""),
          lawType: String(row.law_type ?? row.lawType ?? ""),
          articleNumber: (row.article_number ?? row.articleNumber ?? null) as string | null,
          title: (row.title ?? null) as string | null,
          content: String(row.content ?? ""),
          similarity: Number(row.similarity ?? 0),
        }));
      }
    } catch (e) {
      console.warn("[gemini] match_legal_corpus RPC failed, falling back to keyword scan:", e);
    }
  }

  // ── Path B: keyword fallback (no embeddings / RPC missing) ──
  try {
    const terms = query
      .slice(0, 200)
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 6);
    const orFilter = terms.map((t) => `content.ilike.%${t}%`).join(",");
    if (!orFilter) return [];
    const { data, error } = await admin
      .from("legal_corpus")
      .select("id, law_name, law_type, article_number, title, content")
      .or(orFilter)
      .limit(limit);
    if (error || !data) return [];
    return (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row.id),
      lawName: String(row.law_name ?? ""),
      lawType: String(row.law_type ?? ""),
      articleNumber: (row.article_number ?? null) as string | null,
      title: (row.title ?? null) as string | null,
      content: String(row.content ?? ""),
      similarity: 0.5,
    }));
  } catch {
    return [];
  }
}

// ---------- Document analysis ----------

const ANALYSIS_SYSTEM_PROMPT = `أنت مساعد قانوني أردني متخصص. حلّل الوثيقة القانونية المُقدّمة واستخرج المعلومات التالية بصيغة JSON دقيقة، بدون أي نص إضافي خارج الـ JSON.

قواعد الإخراج:
- "documentType" يجب أن يكون واحداً من: "rental" | "employment" | "traffic" | "consumer" | "general"
- "summary": موجز من 2-3 جمل بالعامية الأردنية المبسّطة، يفهمها الشخص العادي
- "rights": 3-5 حقوق للمستخدم بصياغة تبدأ بـ "الحق بـ..."
- "obligations": 2-4 التزامات على المستخدم
- "risks": 1-5 مخاطر، كل واحدة بـ "text" (الوصف) و "severity" (low/medium/high)
- "lawyerScore": LOW إن كانت الوثيقة بسيطة ولا تحتاج محامياً، MEDIUM إن كان الاستشارة مفيدة، HIGH إن كانت تحتاج محامياً قبل التوقيع
- "lawyerReason": سبب التقييم بجملة أو جملتين
- "nextSteps": 2-4 خطوات مقترحة، كل واحدة بـ "title" و "description" و "isPaid" (true إن كانت تتطلب محامياً)
- "sources": 1-4 مراجع قانونية مع "lawName" و "articleNumber" و "excerpt"
- "confidenceScore": رقم بين 0 و 1 يعبّر عن ثقتك في التحليل

أرجع JSON صالحاً فقط، بدون أي markdown أو تعليق.`;

interface GeminiAnalysisOutput {
  documentType: DocumentType;
  summary: string;
  rights: string[];
  obligations: string[];
  risks: Array<{ text: string; severity: "low" | "medium" | "high" }>;
  lawyerScore: LawyerScore;
  lawyerReason: string;
  nextSteps: Array<{ title: string; description: string; isPaid: boolean }>;
  sources: Array<{ lawName: string; articleNumber?: string; excerpt: string }>;
  confidenceScore: number;
}

function safeParseAnalysis(raw: string): GeminiAnalysisOutput | null {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.documentType && parsed.summary) return parsed as GeminiAnalysisOutput;
  } catch {
    /* fall through */
  }

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
      if (parsed.documentType && parsed.summary) return parsed as GeminiAnalysisOutput;
    } catch {
      /* fall through */
    }
  }
  return null;
}

export async function generateAnalysis({
  id,
  docType,
  title,
  content,
}: {
  id: string;
  docType: DocumentType;
  title: string;
  content?: string | null;
}): Promise<Analysis> {
  let parsed: GeminiAnalysisOutput | null = null;
  let relatedArticles: CorpusMatch[] = [];

  if (genAI && content && content.trim().length > 0) {
    try {
      const model = genAI.getGenerativeModel({
        model: TEXT_MODEL,
        generationConfig: { temperature: 0.2, topP: 0.8, maxOutputTokens: 4096 },
      });

      const ragQuery = `${title || ""} ${content.slice(0, 1500)}`;
      relatedArticles = await matchLegalCorpus(ragQuery, 5);

      const ragContext = relatedArticles.length > 0
        ? `\n\nقوانين مرجعية ذات صلة (استخدمها كأساس للـ "sources" — لا تخترع مواد غيرها):
${relatedArticles.map((a, i) => `[${i + 1}] ${a.lawName} ${a.articleNumber ?? ""} — ${a.title}\n${a.content}`).join("\n\n")}`
        : "";

      const userPrompt = `نوع الوثيقة المُحدَّد مسبقاً: ${docType}
عنوان الوثيقة: ${title || "غير محدد"}

نص الوثيقة:
---
${content.slice(0, 12000)}
---${ragContext}

أرجع JSON فقط.`;

      const result = await model.generateContent([ANALYSIS_SYSTEM_PROMPT, userPrompt]);
      const text = result.response.text();
      parsed = safeParseAnalysis(text);
    } catch (e) {
      console.error("[gemini] generateContent failed:", e);
    }
  }

  if (!parsed) {
    return generateMockAnalysis({ id, docType, title });
  }

  const sources = [
    ...parsed.sources,
    ...relatedArticles
      .filter((a) => !parsed!.sources.some((s) => s.lawName === a.lawName && s.articleNumber === a.articleNumber))
      .slice(0, 3)
      .map((a) => ({
        lawName: a.lawName,
        articleNumber: a.articleNumber ?? undefined,
        excerpt: a.content.slice(0, 200),
      })),
  ];

  const analysisId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const finalTitle = title?.trim() || `${docType} document`;

  mockDocuments.unshift({
    id,
    userId: "u1",
    title: finalTitle,
    fileType: "pdf",
    documentType: docType,
    status: "REVIEWED",
    contentExcerpt: (content ?? "").slice(0, 500),
    createdAt: new Date().toISOString(),
  });

  const analysis: Analysis = {
    id: analysisId,
    documentId: id,
    userId: "u1",
    documentType: docType,
    documentTitle: finalTitle,
    summary: parsed.summary,
    rights: parsed.rights,
    obligations: parsed.obligations,
    risks: parsed.risks,
    lawyerScore: parsed.lawyerScore,
    lawyerReason: parsed.lawyerReason,
    nextSteps: parsed.nextSteps,
    sources,
    confidenceScore: parsed.confidenceScore ?? 0.85,
    reviewStatus: "PENDING",
    createdAt: new Date().toISOString(),
  };

  mockAnalyses.unshift(analysis);
  return analysis;
}

// ---------- Mock fallback ----------

const MOCK_BY_TYPE: Record<DocumentType, Partial<GeminiAnalysisOutput>> = {
  rental: {
    summary: "عقد إيجار سكني لمدة سنة. يحتوي على بنود قابلة للتفاوض مثل غرامة الإخلاء المبكر.",
    rights: ["الحق باسترداد كامل مبلغ الضمان عند نهاية العقد.", "الحق بإخطار خطي قبل 90 يوماً."],
    obligations: ["دفع الإيجار في بداية كل شهر.", "الامتناع عن إحداث تغييرات إنشائية."],
    risks: [{ text: "بند الإخلاء المبكر يفرض غرامة 3 أشهر.", severity: "high" }],
    lawyerScore: "MEDIUM",
    lawyerReason: "بعض البنود قابلة للتفاوض.",
    nextSteps: [
      { title: "تفاوض على البند 6", description: "اطلب تخفيض غرامة الإخلاء.", isPaid: false },
      { title: "استشارة محامٍ", description: "30 دقيقة مع محامٍ متخصص.", isPaid: true },
    ],
    sources: [{ lawName: "قانون الإيجار الأردني", articleNumber: "المادة 14", excerpt: "..." }],
    confidenceScore: 0.85,
  },
  employment: {
    summary: "إنذار فصل من العمل. مؤشرات على فصل تعسفي تحتاج مراجعة محامٍ.",
    rights: ["الحق بالطعن خلال 60 يوماً.", "الحق بمكافأة نهاية الخدمة."],
    obligations: ["تسليم ممتلكات العمل.", "الامتناع عن إفشاء أسرار العمل."],
    risks: [{ text: "السبب 'فقدان الثقة' مرن وقد يُستخدم لرفض التعويضات.", severity: "high" }],
    lawyerScore: "HIGH",
    lawyerReason: "مؤشرات قوية على فصل تعسفي.",
    nextSteps: [{ title: "استشارة محامٍ عمل", description: "الطعن ممكن خلال 60 يوماً.", isPaid: true }],
    sources: [{ lawName: "قانون العمل الأردني", articleNumber: "المادة 22", excerpt: "..." }],
    confidenceScore: 0.88,
  },
  traffic: {
    summary: "مخالفة مرورية قابلة للتسوية الودية بـ 50% خلال 14 يوماً.",
    rights: ["الحق بالاعتراض خلال 30 يوماً.", "الحق بدفع 50% كتسوية ودية."],
    obligations: ["دفع الغرامة خلال 60 يوماً."],
    risks: [{ text: "التكرار قد يضاعف الغرامة.", severity: "medium" }],
    lawyerScore: "LOW",
    lawyerReason: "مخالفة بسيطة.",
    nextSteps: [{ title: "ادفع نصف المبلغ", description: "ضمن 14 يوماً.", isPaid: false }],
    sources: [{ lawName: "قانون المرور الأردني", articleNumber: "المادة 39", excerpt: "..." }],
    confidenceScore: 0.92,
  },
  consumer: {
    summary: "عقد اشتراك ببنود مقبولة عموماً. رسوم الإلغاء المبكر مرتفعة.",
    rights: ["الحق بإلغاء العقد خلال 14 يوماً."],
    obligations: ["دفع الاشتراك الشهري في تاريخ الاستحقاق."],
    risks: [{ text: "رسوم الإلغاء المبكر 80% من المبالغ المتبقية.", severity: "high" }],
    lawyerScore: "MEDIUM",
    lawyerReason: "تحتاج مراجعة.",
    nextSteps: [{ title: "احتفظ بنسخة من العقد", description: "إلكترونية ومطبوعة.", isPaid: false }],
    sources: [{ lawName: "قانون حماية المستهلك", articleNumber: "المادة 12", excerpt: "..." }],
    confidenceScore: 0.83,
  },
  general: {
    summary: "وثيقة قانونية عامة تحتاج تخصصاً محدداً.",
    rights: ["الحق بفهم كامل لمضمون الوثيقة."],
    obligations: ["قراءة الوثيقة كاملة قبل التوقيع."],
    risks: [{ text: "الوثيقة تحتاج مراجعة متخصصة.", severity: "medium" }],
    lawyerScore: "MEDIUM",
    lawyerReason: "نوع الوثيقة غير محدد.",
    nextSteps: [{ title: "استشر محامياً", description: "حدد التخصص المناسب.", isPaid: true }],
    sources: [{ lawName: "القانون المدني", articleNumber: "المادة 169", excerpt: "..." }],
    confidenceScore: 0.75,
  },
};

async function generateMockAnalysis({
  id,
  docType,
  title,
}: {
  id: string;
  docType: DocumentType;
  title: string;
}): Promise<Analysis> {
  await sleep(200);
  const m = MOCK_BY_TYPE[docType];
  const finalTitle = title?.trim() || `${docType} document`;
  const analysisId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  mockDocuments.unshift({
    id,
    userId: "u1",
    title: finalTitle,
    fileType: "pdf",
    documentType: docType,
    status: "REVIEWED",
    contentExcerpt: "...",
    createdAt: new Date().toISOString(),
  });

  return {
    id: analysisId,
    documentId: id,
    userId: "u1",
    documentType: docType,
    documentTitle: finalTitle,
    summary: m.summary ?? "—",
    rights: m.rights ?? [],
    obligations: m.obligations ?? [],
    risks: m.risks ?? [],
    lawyerScore: m.lawyerScore ?? "MEDIUM",
    lawyerReason: m.lawyerReason ?? "—",
    nextSteps: m.nextSteps ?? [],
    sources: m.sources ?? [],
    confidenceScore: m.confidenceScore ?? 0.8,
    reviewStatus: "PENDING",
    createdAt: new Date().toISOString(),
  };
}
