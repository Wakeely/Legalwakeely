import { createClient } from '@/lib/supabase/server';  // <-- FIXED

/**
 * Generate a signed URL for a document stored in Supabase Storage
 * @param filePath - The file path in the storage bucket
 * @param expiresIn - Expiry time in seconds (default: 300 = 5 minutes)
 * @returns The signed URL or null if generation fails
 */
export async function getDocumentSignedUrl(filePath: string, expiresIn: number = 300): Promise<string | null> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .storage
    .from('documents')
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }

  return data.signedUrl;
}
