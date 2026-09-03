import type { MetadataRoute } from 'next';
import { createAdminClient } from '@/lib/supabase/server';

const BASE_URL = 'https://legalwakeely.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/legal-ai`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/legal-ai/lawyers`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
  ];

  // Dynamic lawyer profile pages (public directory)
  let lawyerPages: MetadataRoute.Sitemap = [];
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createAdminClient();
      const { data } = await supabase.from('lawyers').select('id').eq('is_active', true);
      if (data) {
        lawyerPages = data.map((l) => ({
          url: `${BASE_URL}/legal-ai/lawyers/${l.id}`,
          lastModified: now,
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        }));
      }
    } catch {
      // Supabase not reachable at build time — fall back to static pages only
    }
  }

  return [...staticPages, ...lawyerPages];
}
