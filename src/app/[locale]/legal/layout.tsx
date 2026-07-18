import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return {
    title: locale === "ar" ? "صفحات قانونية" : "Legal",
    description: t("disclaimer"),
  };
}

export default async function LegalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <div dir={dir} className="container-page max-w-3xl py-12">
      <article className="prose prose-ink max-w-none">{children}</article>
    </div>
  );
}
