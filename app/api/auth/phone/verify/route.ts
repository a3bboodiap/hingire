import { withUser } from "@/lib/route-helpers";
import { verifyPhoneCodeSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, verifyPhoneCodeSchema);
  if (!parsed.ok) return parsed.response;

  return withUser("otp", async ({ user }) => {
    if (!adminConfigured()) return fail(503, "Phone confirmation is unavailable.");
    const admin = createAdminClient();

    const { data: row } = await admin
      .from("otp_codes")
      .select("id, code_hash, expires_at, attempts")
      .eq("user_id", user.id).eq("channel", "phone").eq("consumed", false)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle();

    if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) {
      await audit("otp_failed", user.id, { channel: "phone", reason: "expired_or_exhausted" });
      return fail(400, "That code has expired. Ask for a new one.");
    }

    const given = createHash("sha256").update(parsed.data.code).digest("hex");
    const match =
      given.length === row.code_hash.length &&
      timingSafeEqual(Buffer.from(given), Buffer.from(row.code_hash));

    if (!match) {
      await admin.from("otp_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      await audit("otp_failed", user.id, { channel: "phone" });
      return fail(400, "That code is not right.");
    }

    await admin.from("otp_codes").update({ consumed: true }).eq("id", row.id);
    await admin.from("profiles").update({ phone_verified: true }).eq("id", user.id);
    await audit("otp_verified", user.id, { channel: "phone" });
    return ok({ verified: true });
  });
}
