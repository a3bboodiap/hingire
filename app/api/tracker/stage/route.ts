import { withUser } from "@/lib/route-helpers";
import { stageChangeSchema } from "@/lib/validation";
import { parseBody, ok, fail, ERR } from "@/lib/http";
import { audit } from "@/lib/audit";
import { DEMO } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, stageChangeSchema);
  if (!parsed.ok) return parsed.response;
  const { application_id, stage } = parsed.data;

  if (DEMO) {
    const { demoState } = await import("@/lib/demo");
    const a = demoState.applications.find((x) => x.id === application_id);
    if (a) a.stage = stage;
    return ok({ stage, needsRejectionForm: stage === "rejected" && !a?.hasRejection });
  }

  return withUser("apply", async ({ user, supabase }) => {
    // Ownership checked on the server; the id from the browser is not trusted.
    const { data: app } = await supabase
      .from("applications").select("id, user_id")
      .eq("id", application_id).maybeSingle();
    if (!app || app.user_id !== user.id) return fail(404, ERR.notFound);

    const { error } = await supabase.from("applications")
      .update({
        stage,
        applied_at: stage === "applied" ? new Date().toISOString() : undefined,
      })
      .eq("id", application_id).eq("user_id", user.id);
    if (error) return fail(500, "Could not change the stage.");

    await audit("application_stage_changed", user.id, { to: stage });
    return ok({ stage, needsRejectionForm: stage === "rejected" });
  });
}
