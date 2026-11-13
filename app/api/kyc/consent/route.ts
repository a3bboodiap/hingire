import { withUser } from "@/lib/route-helpers";
import { consentSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, consentSchema);
  if (!parsed.ok) return parsed.response;
  const { biometric, route } = parsed.data;

  return withUser(null, async ({ user, supabase }) => {
    // The biometric route cannot proceed without explicit consent to biometrics.
    if (route === "document" && !biometric) {
      return fail(400, "The document route needs your explicit consent to the face check.");
    }
    const { error } = await supabase.from("consents").insert({
      user_id: user.id, kind: "biometric", granted: biometric,
    } as never);
    if (error) return fail(500, "Could not record your choice.");
    await audit("kyc_consent", user.id, { biometric, route });
    return ok({ route });
  });
}
