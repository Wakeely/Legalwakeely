import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * POST /api/admin/generate-embeddings
 *
 * Generates Gemini embeddings for all corpus articles that don't have
 * one yet. Runs from Vercel's servers (in a Gemini-supported region).
 * Admin-only — call once after setting a valid GEMINI_API_KEY.
 */
export async function POST() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

  if (!GEMINI_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 });
  }

  const admin = createAdminClient();

  // Fetch articles without embeddings
  const { data: articles, error: fetchErr } = await admin
    .from("legal_corpus")
    .select("id, law_name, title, content")
    .is("embedding", null);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!articles || articles.length === 0) {
    return NextResponse.json({ ok: true, message: "All articles already have embeddings", embedded: 0 });
  }

  let embedded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const article of articles) {
    const text = `${article.law_name} ${article.title ?? ""} ${article.content}`;
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: 768,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        errors.push(`${article.id}: HTTP ${res.status} ${errBody.slice(0, 100)}`);
        failed++;
        continue;
      }

      const j = await res.json();
      const vec = j.embedding?.values;

      if (!vec || vec.length !== 768) {
        errors.push(`${article.id}: bad embedding dim ${vec?.length}`);
        failed++;
        continue;
      }

      // Update the row with the embedding (cast as vector)
      const vecLiteral = `[${vec.join(",")}]`;
      const { error: updateErr } = await admin
        .from("legal_corpus")
        .update({ embedding: vecLiteral as unknown as never })
        .eq("id", article.id);

      if (updateErr) {
        errors.push(`${article.id}: ${updateErr.message}`);
        failed++;
      } else {
        embedded++;
      }

      // Throttle (1500 RPM on free tier)
      await new Promise((r) => setTimeout(r, 50));
    } catch (e) {
      errors.push(`${article.id}: ${e instanceof Error ? e.message : "unknown"}`);
      failed++;
    }
  }

  return NextResponse.json({
    ok: true,
    total: articles.length,
    embedded,
    failed,
    errors: errors.slice(0, 5),
  });
}
