import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAnalysis, saveAnalysis } from "@/lib/legal-ai";
import { checkLegalAiAccess } from "@/lib/legal-ai/gate";
import { sanitizeText } from "@/lib/sanitize";
import type { DocumentType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_TYPES: DocumentType[] = ["rental", "employment", "traffic", "consumer", "general"];

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

/**
 * POST /api/legal-ai/analyze
 *
 * Gated entry point to the Legal-AI document analysis engine.
 * Accepts `multipart/form-data` (file + metadata) from the upload page,
 * OR `application/json` ({ docType, title, content, fileName }) for
 * text-only analysis (e.g. pasted text).
 *
 * Enforces: Supabase auth → Legal-AI subscription → monthly fair-use cap.
 *
 * Returns: { analysisId, persisted, usage }
 */
export async function POST(req: Request) {
  // ── 1. Auth ────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // ── 2. Subscription gate ───────────────────────────────────────
  const access = await checkLegalAiAccess(user.id);
  if (!access.allowed) {
    if (access.reason === "usage_cap_reached") {
      return NextResponse.json(
        { error: "usage_cap_reached", used: access.usedThisMonth, cap: access.monthlyCap },
        { status: 429 },
      );
    }
    return NextResponse.json(
      { error: "legal_ai_not_purchased", upgradeUrl: "/billing" },
      { status: 402 },
    );
  }

  // ── 3. Parse input (FormData or JSON) ──────────────────────────
  let docType: DocumentType;
  let title: string;
  let content: string;
  let fileName = "upload.pdf";
  let file: File | null = null;

  const contentType = req.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      docType = String(form.get("docType") ?? "") as DocumentType;
      title = String(form.get("title") ?? "");
      content = String(form.get("content") ?? "");
      const maybeFile = form.get("file");
      if (maybeFile instanceof File) {
        file = maybeFile;
        fileName = maybeFile.name;
      }
      // If content is empty but a file was provided, the client should have
      // extracted text already (PDF.js / Tesseract). If not, we can't proceed.
      if (!content && file) {
        return NextResponse.json(
          { error: "extraction_failed", detail: "Client did not provide extracted text." },
          { status: 422 },
        );
      }
    } else {
      const body = await req.json();
      docType = body.docType as DocumentType;
      title = body.title ?? "";
      content = body.content ?? "";
      fileName = body.fileName ?? "upload.pdf";
    }
  } catch {
    return NextResponse.json({ error: "body_parse_failed" }, { status: 422 });
  }

  // ── 4. Validate ────────────────────────────────────────────────
  if (!VALID_TYPES.includes(docType)) {
    return NextResponse.json(
      { error: "invalid_doc_type", valid: VALID_TYPES },
      { status: 422 },
    );
  }
  if (content.trim().length < 20) {
    return NextResponse.json(
      { error: "content_too_short", minLength: 20 },
      { status: 422 },
    );
  }
  // File size + type validation (defense-in-depth, even though the client
  // extracts text before sending — the raw file may still be attached).
  if (file) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "file_too_large", maxBytes: MAX_FILE_SIZE }, { status: 413 });
    }
    if (file.type && !ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: "unsupported_file_type", allowed: ALLOWED_MIME }, { status: 415 });
    }
  }

  const cleanContent = sanitizeText(content).slice(0, 12000);
  const cleanTitle = sanitizeText(title).slice(0, 200) || `${docType} document`;
  const cleanFileName = sanitizeText(fileName).slice(0, 200);

  // ── 5. Run Gemini + RAG analysis ───────────────────────────────
  const analysis = await generateAnalysis({
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    docType,
    title: cleanTitle,
    content: cleanContent,
  });

  analysis.userId = user.id;

  // ── 6. Persist ─────────────────────────────────────────────────
  const saveRes = await saveAnalysis(analysis, {
    userId: user.id,
    contentExcerpt: cleanContent.slice(0, 500),
    fileName: cleanFileName,
  });

  return NextResponse.json({
    analysisId: analysis.id,
    persisted: saveRes.ok,
    persistReason: saveRes.ok ? undefined : saveRes.reason,
    usage: {
      usedThisMonth: access.usedThisMonth + 1,
      monthlyCap: access.monthlyCap,
      remaining: Math.max(0, access.remaining - 1),
    },
  });
}
