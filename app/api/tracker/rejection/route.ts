import { withUser } from "@/lib/route-helpers";
import { rejectionSchema } from "@/lib/validation";
import { parseBody, ok, fail, ERR } from "@/lib/http";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, rejectionSchema);
  if (!parsed.ok) return parsed.response;
  const r = parsed.data;

  return withUser("apply", async ({ user, supabase }) => {
    const { data: app } = await supabase
      .from("applications").select("id, user_id")
      .eq("id", r.application_id).maybeSingle();
    if (!app || app.user_id !== user.id) return fail(404, ERR.notFound);

    const { error } = await supabase.from("rejections").upsert({
      user_id: user.id,
      application_id: r.application_id,
      rejected_on: r.rejected_on,
      stage: r.stage,
      reason: r.reason ?? null,
      note: r.note ?? null,
    } as never, { onConflict: "application_id" });
    if (error) return fail(500, "Could not log that rejection.");

    await supabase.from("applications")
      .update({ stage: "rejected" }).eq("id", r.application_id).eq("user_id", user.id);

    await audit("rejection_logged", user.id, { stage: r.stage });
    return ok({ logged: true });
  });
}
