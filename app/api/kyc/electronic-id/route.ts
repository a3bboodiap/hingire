import { withUser } from "@/lib/route-helpers";
import { ok, fail } from "@/lib/http";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Non-biometric route: a recognised electronic ID (FNMT certificate, DNIe).
 *
 * No eID provider is connected in this prototype. Rather than silently
 * passing anyone, this route is DISABLED unless the operator explicitly sets
 * ALLOW_PROTOTYPE_VERIFICATION=true, which is meant for local testing only.
 * In that mode the result is recorded as a prototype pass and labelled as
 * such everywhere it is shown.
 */
const ALLOWED = process.env.ALLOW_PROTOTYPE_VERIFICATION === "true";

export async function POST() {
  return withUser("kyc", async ({ user, profile }) => {
    if (!ALLOWED) {
      return fail(
        503,
        "Electronic ID is not connected on this deployment. " +
        "At launch this is where an FNMT certificate or the electronic DNI is used.",
      );
    }
    if (!profile.is_adult) {
      return fail(403, "You need to be 18 or over.");
    }
    if (adminConfigured()) {
      const admin = createAdminClient();
      await admin.from("kyc_attempts").insert({
        user_id: user.id, route: "electronic_id", result: "passed",
        reason: "prototype electronic ID stub",
      } as never);
      await admin.from("profiles").update({
        kyc_status: "passed",
        kyc_verified_at: new Date().toISOString(),
        kyc_over_18: true,
        kyc_name_match: true,
        kyc_provider_ref: "prototype:electronic-id-stub",
      }).eq("id", user.id);
    }
    await audit("kyc_attempt", user.id, { route: "electronic_id", passed: true, prototype: true });
    return ok({ passed: true, prototype: true });
  });
}
