import "server-only";
import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Validates a JSON request body against a zod schema.
 * Returns either the parsed data or a 400 NextResponse (to short-circuit).
 *
 * Usage:
 *   const parsed = validateBody(req, schema);
 *   if (parsed instanceof NextResponse) return parsed;
 *   // parsed is now typed as z.infer<typeof schema>
 */
export async function validateBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<T | NextResponse> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body is not valid JSON." },
      { status: 400 },
    );
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }
  return result.data;
}

/**
 * Validates a search-params / query-string object against a zod schema.
 */
export function validateQuery<T>(
  params: Record<string, string | string[] | undefined>,
  schema: z.ZodSchema<T>,
): T | NextResponse {
  const result = schema.safeParse(params);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }
  return result.data;
}

// ── Reusable schemas ────────────────────────────────────────

export const UUID_SCHEMA = z.string().uuid();
export const SAFE_STRING = z.string().trim().min(1).max(10_000);
export const SAFE_SHORT_STRING = z.string().trim().min(1).max(200);
export const SAFE_TEXT = z.string().trim().min(1).max(50_000);

export const CASE_TYPE_SCHEMA = z.enum([
  "employment",
  "family",
  "commercial",
  "property",
  "criminal",
  "other",
]);

export const DEADLINE_TYPE_SCHEMA = z.enum(["court", "submission", "internal"]);

export const CURRENCY_SCHEMA = z.enum(["AED", "SAR", "KWD", "USD"]);
