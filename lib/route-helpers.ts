import "server-only";
import { requireSession, Unauthenticated, type Session } from "@/lib/auth";
import { fail, ERR, logServerError } from "@/lib/http";
import { checkRateLimit, type Bucket } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { NextResponse } from "next/server";

/** Wraps a route: resolves the session, applies a per-user rate limit. */
export async function withUser(
  bucket: Bucket | null,
  handler: (session: Session) => Promise<NextResponse>,
): Promise<NextResponse> {
  let session: Session;
  try {
    session = await requireSession();
  } catch (e) {
    if (e instanceof Unauthenticated) return fail(401, ERR.unauthenticated);
    logServerError("withUser", e);
    return fail(500, ERR.server);
  }

  if (bucket) {
    const limit = await checkRateLimit(`user:${session.user.id}`, bucket);
    if (!limit.allowed) {
      await audit("rate_limited", session.user.id, { bucket });
      return fail(429, ERR.rateLimited, { retryAfter: limit.retryAfterSec });
    }
  }

  try {
    return await handler(session);
  } catch (e) {
    logServerError("route", e);
    return fail(500, ERR.server);
  }
}
