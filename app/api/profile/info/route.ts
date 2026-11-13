import { withUser } from "@/lib/route-helpers";
import { infoSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { isAdult, ageOn } from "@/lib/auth";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, infoSchema);
  if (!parsed.ok) return parsed.response;
  const info = parsed.data;

  return withUser("apply", async ({ user, supabase }) => {
    // 18+ gate. Checked on the server; the client cannot skip it.
    if (!isAdult(info.date_of_birth)) {
      await audit("age_gate_blocked", user.id, { age: ageOn(info.date_of_birth) });
      return fail(403, "You need to be 18 or over to use Hingire.", { ageBlocked: true });
    }

    // date_of_birth and is_adult are not user-updatable columns, by design:
    // they go through the service role so the age gate cannot be edited away.
    if (adminConfigured()) {
      const { error } = await createAdminClient()
        .from("profiles")
        .update({
          first_name: info.first_name,
          last_name: info.last_name,
          location: info.location,
          phone: info.phone,
          date_of_birth: info.date_of_birth,
          is_adult: true,
          onboarding_step: "cv",
        })
        .eq("id", user.id);
      if (error) return fail(500, "Could not save your details.");
    } else {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: info.first_name,
          last_name: info.last_name,
          location: info.location,
          phone: info.phone,
          onboarding_step: "cv",
        })
        .eq("id", user.id);
      if (error) return fail(500, "Could not save your details.");
    }

    return ok({ next: "/cv" });
  });
}
