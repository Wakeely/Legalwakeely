import type { MetadataRoute } from 'next';

// Public marketing/directory pages are indexable; everything behind
// login (dashboard, admin, lawyer portal, billing, vault, case data)
// and one-time token links (witness/share/invite) stay out of search
// results. Previously this blocked the entire site ('/') — a leftover
// from pre-launch development that meant no page could ever be found
// via Google/Bing.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/*/dashboard',
          '/*/admin',
          '/*/lawyer/',
          '/*/vault',
          '/*/billing',
          '/*/cases/',
          '/*/legal-ai/upload',
          '/*/legal-ai/analyses',
          '/*/settings',
          '/witness/',
          '/share/',
          '/invite/',
        ],
      },
    ],
  };
}
