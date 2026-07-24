export type RedactionCategory = 'pii' | 'financial' | 'privilege';

export interface RedactionPattern {
  id: string;
  category: RedactionCategory;
  label: { en: string; ar: string };
  regex: RegExp;
}

/**
 * v1 detection is pattern/regex-based, not a trained model. Kept as plain
 * configurable constants (not hardcoded inline) so these can be tweaked
 * without touching the detection logic itself — per the agreed design,
 * this module is the one place to swap in a real AI backend (e.g.
 * Almustahar) later without changing the API route or UI.
 *
 * ⚠️ Draft patterns — review and correct before relying on these for real
 * court-filing redaction. In particular:
 *  - jordanCivilId / jordanPassport are generic digit-count patterns and
 *    WILL over-match (e.g. any 9-10 digit number, phone numbers, case
 *    numbers). Tighten with real format rules once available.
 *  - financialAmount is intentionally broad and will catch plain numbers
 *    too — treat its suggestions as lower-confidence.
 */
export const REDACTION_PATTERNS: RedactionPattern[] = [
  {
    id: 'jordanCivilId',
    category: 'pii',
    label: { en: 'Jordanian Civil ID', ar: 'الرقم الوطني الأردني' },
    regex: /\b[1-9]\d{9}\b/g,
  },
  {
    id: 'jordanPassport',
    category: 'pii',
    label: { en: 'Passport number', ar: 'رقم جواز السفر' },
    regex: /\b\d{9}\b/g,
  },
  {
    id: 'jordanIban',
    category: 'financial',
    label: { en: 'IBAN', ar: 'رقم الآيبان' },
    regex: /\bJO\d{2}[A-Z0-9]{4,30}\b/g,
  },
  {
    id: 'swiftBic',
    category: 'financial',
    label: { en: 'SWIFT / BIC code', ar: 'رمز السويفت' },
    regex: /\b[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?\b/g,
  },
  {
    id: 'financialAmount',
    category: 'financial',
    label: { en: 'Financial amount', ar: 'مبلغ مالي' },
    regex: /\b(JOD|USD|\$)\s?\d{1,3}(,\d{3})*(\.\d{2})?\b/g,
  },
];
