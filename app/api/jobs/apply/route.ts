import { withUser } from "@/lib/route-helpers";
import { applySchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** Accept on a Soulmate: record that the user applied. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, applySchema);
  if (!parsed.ok) return parsed.response;
  const { job_id, applied } = parsed.data;

  return withUser("apply", async ({ user, supabase }) => {
    if (!applied) return ok({ stage: "saved" });

    const { error } = await supabase.from("applications").upsert(
      {
        user_id: user.id, job_id, stage: "applied",
        applied_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,job_id" },
    );
    if (error) return fail(500, "Could not update your tracker.");
    await audit("application_stage_changed", user.id, { to: "applied" });
    return ok({ stage: "applied" });
  });
}
