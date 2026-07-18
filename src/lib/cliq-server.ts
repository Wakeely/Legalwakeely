import "server-only";

/**
 * Server-only CliQ helpers. These must NOT be imported from client
 * components (they use crypto + date logic that's fine on the server
 * but the "server-only" guard prevents accidental client bundling).
 */

/**
 * Generates a short, human-readable reference code for a payment order.
 * Format: LW-XXXXXX (6 alphanumeric chars, uppercase, no ambiguous chars).
 */
export function generateReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `LW-${code}`;
}

/**
 * Calculates the period end date based on the billing period.
 * Returns ISO string.
 */
export function calculatePeriodEnd(billingPeriod: "monthly" | "quarterly" | "annual"): string {
  const end = new Date();
  if (billingPeriod === "monthly") end.setMonth(end.getMonth() + 1);
  else if (billingPeriod === "quarterly") end.setMonth(end.getMonth() + 3);
  else if (billingPeriod === "annual") end.setFullYear(end.getFullYear() + 1);
  return end.toISOString();
}

/**
 * Order expiry: if no proof uploaded within 7 days, the order expires.
 */
export function calculateOrderExpiry(): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);
  return expiry.toISOString();
}
