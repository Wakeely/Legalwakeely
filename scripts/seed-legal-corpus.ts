/**
 * Seed the `legal_corpus` table from data/jordanian-corpus.ts.
 *
 * Run with:  npm run legal-ai:seed-corpus
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL in env.
 * Idempotent: rows are upserted on `external_id`.
 *
 * Embeddings: if GEMINI_API_KEY is set, each chunk is embedded with
 * text-embedding-001 (768 dims) and stored in the `embedding` column.
 * If not set, chunks are inserted without embeddings (RAG will fall
 * back to keyword search).
 */

import { createClient } from "@supabase/supabase-js";
import { CORPUS } from "../data/jordanian-corpus";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
const embedModel = process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function embed(text: string): Promise<number[] | null> {
  if (!geminiKey) return null;
  const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${embedModel}:embedContent?key=${geminiKey}`;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text: cleaned }] },
        outputDimensionality: 768,
      }),
    });
    if (!r.ok) {
      console.warn(`  embed HTTP ${r.status}`);
      return null;
    }
    const j = (await r.json()) as { embedding?: { values?: number[] } };
    return j.embedding?.values ?? null;
  } catch (e) {
    console.warn("  embed failed:", e);
    return null;
  }
}

async function main() {
  console.log(`Seeding ${CORPUS.length} corpus chunks…`);
  console.log(`  embeddings: ${geminiKey ? "ENABLED (768-dim Gemini)" : "DISABLED (set GEMINI_API_KEY to enable)"}`);

  let ok = 0;
  let fail = 0;

  for (const article of CORPUS) {
    const embedding = await embed(`${article.title ?? ""} ${article.content}`);
    const { error } = await supabase.from("legal_corpus").upsert(
      {
        external_id: article.id,
        law_name: article.lawName,
        law_type: article.lawType,
        article_number: article.articleNumber,
        title: article.title,
        content: article.content,
        metadata: (article.metadata as Record<string, unknown>) ?? {},
        embedding,
      },
      { onConflict: "external_id" },
    );
    if (error) {
      console.error(`  ✗ ${article.id}: ${error.message}`);
      fail++;
    } else {
      ok++;
      if (ok % 10 === 0) console.log(`  …${ok} done`);
    }
    // Light throttle to respect Gemini free-tier RPM (1500/min).
    if (geminiKey) await new Promise((r) => setTimeout(r, 50));
  }

  console.log(`\nDone. ${ok} upserted, ${fail} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
