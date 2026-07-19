import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { checkDocLimit, checkStorageLimit } from '@/lib/feature-gate';

const docSchema = z.object({
  case_id: z.string().uuid(),
  documents: z.array(z.object({
    file_path: z.string().min(1),
    file_name: z.string().min(1),
    file_size: z.number().int().min(0),
    file_hash: z.string().optional(),
  })).min(1).max(50),
});

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file
const STORAGE_BUCKET = 'documents';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const parsed = docSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 });
  }

  const { case_id, documents } = parsed.data;

  // Verify case ownership
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id, client_id')
    .eq('id', case_id)
    .eq('client_id', user.id)
    .single();

  if (!caseRow) {
    return NextResponse.json({ error: 'Case not found or access denied' }, { status: 404 });
  }

  // ── Get user's subscription tier ────────────────────────────
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, current_period_end')
    .eq('user_id', user.id)
    .maybeSingle();

  const tier = sub?.tier ?? 'basic';
  const effectiveTier = (sub?.current_period_end && new Date(sub.current_period_end) < new Date()) ? 'basic' : tier;

  // ── Verify real file sizes against Supabase Storage ─────────
  // The `file_size` above is reported by the client's own browser.
  // A modified or buggy client could under-report it to slip past
  // the storage quota below — look up each file's actual stored
  // size instead of trusting the client's number. Uses the admin
  // client since we've already independently verified case
  // ownership above.
  const admin = createAdminClient();
  const verifiedDocuments: typeof documents = [];
  for (const doc of documents) {
    const lastSlash = doc.file_path.lastIndexOf('/');
    const dir = lastSlash === -1 ? '' : doc.file_path.slice(0, lastSlash);
    const fileName = lastSlash === -1 ? doc.file_path : doc.file_path.slice(lastSlash + 1);

    const { data: listing, error: listErr } = await admin
      .storage
      .from(STORAGE_BUCKET)
      .list(dir, { search: fileName, limit: 1 });

    const realEntry = listing?.find((f) => f.name === fileName);
    if (listErr || !realEntry || typeof realEntry.metadata?.size !== 'number') {
      return NextResponse.json(
        { error: `Could not verify uploaded file "${doc.file_name}" in storage.`, code: 'FILE_NOT_FOUND_IN_STORAGE' },
        { status: 422 },
      );
    }

    verifiedDocuments.push({ ...doc, file_size: realEntry.metadata.size });
  }

  // ── Check individual file sizes (using verified sizes) ──────
  for (const doc of verifiedDocuments) {
    if (doc.file_size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File "${doc.file_name}" exceeds the 50 MB limit (${(doc.file_size / 1024 / 1024).toFixed(1)} MB).`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 413 },
      );
    }
  }

  // ── Check document count limit ──────────────────────────────
  const totalDocsToAdd = verifiedDocuments.length;
  const docCheck = await checkDocLimit(case_id, effectiveTier, supabase, totalDocsToAdd);
  if (!docCheck.allowed) {
    return NextResponse.json(
      {
        error: `You've reached the maximum of ${docCheck.max} documents per case on the ${effectiveTier} plan. Upgrade to upload more.`,
        code: 'DOC_LIMIT_REACHED',
        current: docCheck.current,
        max: docCheck.max,
      },
      { status: 403 },
    );
  }

  // ── Check storage limit (using verified sizes) ──────────────
  const totalBytes = verifiedDocuments.reduce((sum, d) => sum + d.file_size, 0);
  const storageCheck = await checkStorageLimit(user.id, effectiveTier, supabase, totalBytes);
  if (!storageCheck.allowed) {
    const usedMB = (storageCheck.bytes_used / (1024 * 1024)).toFixed(1);
    const limitMB = (storageCheck.bytes_limit / (1024 * 1024)).toFixed(0);
    return NextResponse.json(
      {
        error: `Storage limit reached (${usedMB} MB of ${limitMB} MB on ${effectiveTier} plan). Delete old documents or upgrade.`,
        code: 'STORAGE_LIMIT_REACHED',
        bytes_used: storageCheck.bytes_used,
        bytes_limit: storageCheck.bytes_limit,
      },
      { status: 403 },
    );
  }

  // ── Insert document records (using verified sizes) ──────────
  const rows = verifiedDocuments.map((d) => ({
    case_id,
    uploader_id: user.id,
    file_path: d.file_path,
    file_name: d.file_name,
    file_size: d.file_size,
    file_hash: d.file_hash ?? null,
    version: 1,
  }));

  const { error: insertErr } = await supabase.from('documents').insert(rows);
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: rows.length }, { status: 201 });
}
