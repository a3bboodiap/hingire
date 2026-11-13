import { withUser } from "@/lib/route-helpers";
import { sendPhoneCodeSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import { createHash, randomInt } from "node:crypto";

export const runtime = "nodejs";

/**
 * Phone one-time code.
 *
 * No SMS provider is connected (every provider Supabase supports is paid), so
 * this runs in prototype mode: the code is generated and hashed server-side
 * exactly as a real one would be, and returned to the caller so it can be
 * shown on screen with a clear notice. Set SMS_PROVIDER_CONNECTED=true once a
 * provider exists and the code stops being returned.
 */
const PROTOTYPE = process.env.SMS_PROVIDER_CONNECTED !== "true";

export async function POST(request: Request) {
  const parsed = await parseBody(request, sendPhoneCodeSchema);
  if (!parsed.ok) return parsed.response;

  return withUser("otp", async ({ user }) => {
    if (!adminConfigured()) {
      return fail(503, "Phone confirmation is unavailable: the server is missing its key.");
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const admin = createAdminClient();

    await admin.from("otp_codes").update({ consumed: true })
      .eq("user_id", user.id).eq("channel", "phone").eq("consumed", false);

    const { error } = await admin.from("otp_codes").insert({
      user_id: user.id,
      channel: "phone",
      code_hash: createHash("sha256").update(code).digest("hex"),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (error) return fail(500, "Could not send the code.");

    await audit("otp_sent", user.id, { channel: "phone", prototype: PROTOTYPE });
    return ok({
      sent: true,
      prototype: PROTOTYPE,
      // Only ever present in prototype mode.
      code: PROTOTYPE ? code : undefined,
    });
  });
}
