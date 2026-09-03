import type { MetadataRoute } from "next";
import { mockLawyers } from "@/lib/mock-data";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://legalwakeely.com";
const locales = ["ar", "en"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/ar`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${baseUrl}/en`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
  ];

  const lawyerPages: MetadataRoute.Sitemap = mockLawyers.flatMap((lawyer) =>
    locales.map((locale) => ({
      url: `${baseUrl}/${locale}/lawyers/${lawyer.id}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  );

  const lawyersIndex: MetadataRoute.Sitemap = locales.map((locale) => ({
    url: `${baseUrl}/${locale}/lawyers`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...lawyersIndex, ...lawyerPages];
}
