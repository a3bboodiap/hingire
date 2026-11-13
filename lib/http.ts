import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * Generic error messages only — never a stack trace, never the internals of a
 * failed query. The detail goes to the server log, the user gets a sentence.
 */
export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export const ERR = {
  unauthenticated: "Please sign in and try again.",
  forbidden: "You do not have access to that.",
  notFound: "We could not find that.",
  invalid: "Some details were not valid. Please check and try again.",
  rateLimited: "Too many attempts. Please wait a moment and try again.",
  server: "Something went wrong on our side. Please try again.",
  tooLarge: "That file is too large. The limit is 5 MB.",
  badType: "That file type is not allowed. Use PDF, DOCX, JPG or PNG.",
} as const;

/**
 * Parse and validate a JSON body with zod. Every route uses this; no route
 * reads `await req.json()` straight into a query.
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: fail(400, ERR.invalid) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: fail(400, ERR.invalid, { fields: fieldErrors(parsed.error) }),
    };
  }
  return { ok: true, data: parsed.data };
}

export function fieldErrors(error: ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Log a server-side problem without leaking it to the client. */
export function logServerError(scope: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${scope}] ${message}`);
}
