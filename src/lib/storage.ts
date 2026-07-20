import "server-only";
import { supabaseAdmin, isSupabaseConfigured } from "./supabase";

const BUCKET = "documents";

/**
 * Upload a file to Supabase Storage.
 * Returns the storage path on success, null on failure.
 */
export async function uploadDocument(
  userId: string,
  documentId: string,
  file: File | Blob,
  mimeType: string,
): Promise<{ path: string; publicUrl: string } | null> {
  if (!isSupabaseConfigured || !supabaseAdmin) return null;
  try {
    const ext = mimeType === "application/pdf"
      ? "pdf"
      : mimeType === "image/jpeg" ? "jpg"
      : mimeType === "image/png" ? "png"
      : mimeType === "image/heic" ? "heic"
      : "bin";
    const path = `${userId}/${documentId}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, file, {
        contentType: mimeType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) {
      console.error("[storage] upload error:", error.message);
      return null;
    }
    return { path, publicUrl: `${BUCKET}/${path}` };
  } catch (e: unknown) {
    console.error("[storage] upload threw:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteDocument(path: string): Promise<boolean> {
  if (!isSupabaseConfigured || !supabaseAdmin) return false;
  try {
    const { error } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return !error;
  } catch {
    return false;
  }
}
