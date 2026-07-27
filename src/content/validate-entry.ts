// One real branch, testable in isolation — see design.md's Architecture
// Decisions: "Validation seam".
import type { z } from "zod";

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function parseEntry<T>(
  schema: z.ZodType<T>,
  input: unknown,
): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error.message };
}
