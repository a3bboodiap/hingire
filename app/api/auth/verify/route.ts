import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifyEmailSchema } from "@/lib/validation";
import { parseBody, ok, fail, ERR, logServerError } from "@/lib/http";
import { checkRateLimit, anonSubject, ipFrom } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Exchange the emailed code for a session. Supabase sets the auth cookies
 * through our server client, so the session is httpOnly and never touched by
 * page JavaScript.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, verifyEmailSchema);
  if (!parsed.ok) return parsed.response;
  const { email, code } = parsed.data;

  const limit = await checkRateLimit(anonSubject(ipFrom(request)), "login");
  if (!limit.allowed) {
    await audit("rate_limited", null, { bucket: "login" });
    return fail(429, ERR.rateLimited, { retryAfter: limit.retryAfterSec });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error || !data.user) {
      await audit("otp_failed", null, {});
      // Same message for a wrong code and an expired one: no oracle.
      return fail(400, "That code is not right, or it has expired.");
    }

    await audit("otp_verified", data.user.id, {});

    // Where to send them next depends on how far through sign-up they are.
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step")
      .eq("id", data.user.id)
      .maybeSingle();

    const step = profile?.onboarding_step ?? "info";
    const next = step === "done" ? "/top-match" : step === "cv" ? "/cv" : "/info";

    await audit("login", data.user.id, {});
    return ok({ next });
  } catch (e) {
    logServerError("auth/verify", e);
    return fail(500, ERR.server);
  }
}
