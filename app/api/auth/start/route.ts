import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startAuthSchema } from "@/lib/validation";
import { parseBody, ok, fail, ERR, logServerError } from "@/lib/http";
import { checkRateLimit, anonSubject, ipFrom } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

/**
 * Send a one-time code to an email address.
 *
 * Two rate limits: one per IP (stops a single host enumerating addresses) and
 * one per address (stops someone being mail-bombed from many hosts).
 *
 * The response is identical whether or not the address has an account, so this
 * endpoint cannot be used to find out who is registered.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, startAuthSchema);
  if (!parsed.ok) return parsed.response;
  const { email, mode } = parsed.data;

  const ipKey = anonSubject(ipFrom(request));
  const emailKey =
    "email:" + createHash("sha256").update(email).digest("hex").slice(0, 32);

  for (const [subject, bucket] of [
    [ipKey, mode === "signup" ? "signup" : "login"],
    [emailKey, "otp"],
  ] as const) {
    const limit = await checkRateLimit(subject, bucket);
    if (!limit.allowed) {
      await audit("rate_limited", null, { bucket });
      return fail(429, ERR.rateLimited, { retryAfter: limit.retryAfterSec });
    }
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // On login we must not quietly create an account for a typo'd address.
        shouldCreateUser: mode === "signup",
      },
    });

    // An error here is usually "user not found" on the login path. We log it
    // and still answer with the same success shape.
    if (error) logServerError("auth/start", error);
    await audit("otp_sent", null, { mode });
  } catch (e) {
    logServerError("auth/start", e);
  }

  return ok({
    sent: true,
    message: "If that address can be used, we've sent a 6-digit code to it.",
  });
}
