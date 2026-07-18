import type { SubscriptionTier } from "@/types";

/**
 * CliQ payment configuration for the Jordan market.
 *
 * CliQ is Jordan's national mobile payment platform (operated by JoPACC).
 * Users transfer money via their bank app to a merchant's CliQ alias.
 * Verification is semi-manual (admin reconciles + verifies proof).
 *
 * This file is safe to import from client components (no "server-only").
 * Server-only functions (generateReference, calculatePeriodEnd) live in
 * src/lib/cliq-server.ts.
 */

export const CLIQ_ALIAS = process.env.CLIQ_ALIAS || "legalwakeely@cliq";
export const CLIQ_ALIAS_NAME = process.env.CLIQ_ALIAS_NAME || "LegalWakeely";

/**
 * Plan pricing in JOD (Jordanian Dinar).
 * CliQ payments are in JOD only.
 *
 * These are the same relative price points as the old Stripe plans,
 * converted to JOD (1 USD ≈ 0.71 JOD).
 */
export interface CliQPlan {
  tier: SubscriptionTier | "legal_ai_addon";
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  jod: {
    monthly: number;
    quarterly: number;
    annual: number;
  };
  features: string[];
  featuresAr: string[];
  popular?: boolean;
}

export const CLIQ_PLANS: CliQPlan[] = [
  {
    tier: "basic",
    label: "Basic",
    labelAr: "الأساسية",
    description: "For individuals managing one case",
    descriptionAr: "للأفراد الذين يديرون قضية واحدة",
    jod: { monthly: 6, quarterly: 16, annual: 56 },
    features: [
      "Up to 3 active cases",
      "5 documents per case",
      "1 GB storage",
      "Deadline tracking",
      "Basic chat with lawyer",
    ],
    featuresAr: [
      "حتى 3 قضايا نشطة",
      "5 مستندات لكل قضية",
      "1 غيغابايت تخزين",
      "تتبع المواعيد القانونية",
      "محادثة أساسية مع المحامي",
    ],
  },
  {
    tier: "pro",
    label: "Pro",
    labelAr: "الاحترافية",
    description: "For active clients with multiple cases",
    descriptionAr: "للعملاء النشطين بقضايا متعددة",
    jod: { monthly: 21, quarterly: 56, annual: 176 },
    features: [
      "Up to 10 active cases",
      "50 documents per case",
      "10 GB storage",
      "NDE escalation alerts",
      "Lawyer scoring + performance",
      "Invoices + disbursements",
      "Voice AI queries (50/day)",
      "WhatsApp notifications",
    ],
    featuresAr: [
      "حتى 10 قضايا نشطة",
      "50 مستند لكل قضية",
      "10 غيغابايت تخزين",
      "تنبيهات تصعيد NDE",
      "تقييم المحامين + الأداء",
      "الفواتير + المدفوعات",
      "استعلامات صوتية (50/يوم)",
      "إشعارات واتساب",
    ],
    popular: true,
  },
  {
    tier: "premium",
    label: "Premium",
    labelAr: "المميزة",
    description: "Unlimited everything + Legal-AI bundled",
    descriptionAr: "كل شيء غير محدود + Legal-AI مضمّنة",
    jod: { monthly: 56, quarterly: 150, annual: 495 },
    features: [
      "Unlimited active cases",
      "Unlimited documents",
      "30 GB storage",
      "Everything in Pro",
      "Legal-AI document analysis (100/mo)",
      "Priority support",
      "Voice AI (unlimited)",
    ],
    featuresAr: [
      "قضايا نشطة غير محدودة",
      "مستندات غير محدودة",
      "30 غيغابايت تخزين",
      "كل ما في الاحترافية",
      "تحليل الوثائق بالذكاء الاصطناعي (100/شهر)",
      "دعم ذو أولوية",
      "استعلامات صوتية غير محدودة",
    ],
  },
  {
    tier: "legal_ai_addon",
    label: "Legal-AI Add-on",
    labelAr: "إضافة Legal-AI",
    description: "Add AI document analysis to any plan",
    descriptionAr: "أضف تحليل الوثائق بالذكاء الاصطناعي لأي باقة",
    jod: { monthly: 11, quarterly: 30, annual: 106 },
    features: [
      "Unlimited document uploads",
      "AI analysis with Jordanian law RAG",
      "Rights / obligations / risks extraction",
      "Lawyer-needed gauge",
      "Cited legal sources",
      "25 analyses/month (Pro)",
    ],
    featuresAr: [
      "رفع وثائق غير محدود",
      "تحليل ذكي بالقانون الأردني (RAG)",
      "استخراج الحقوق / الالتزامات / المخاطر",
      "مؤشر الحاجة لمحامٍ",
      "مصادر قانونية موثقة",
      "25 تحليلاً/شهر (الاحترافية)",
    ],
  },
];

export function getPlan(tier: string): CliQPlan | undefined {
  return CLIQ_PLANS.find((p) => p.tier === tier);
}
