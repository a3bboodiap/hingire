import { withUser } from "@/lib/route-helpers";
import { cvStepSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { saveStep } from "@/lib/cv-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, cvStepSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  return withUser("apply", async ({ user, supabase }) => {
    // user.id comes from the verified session, never from the request body.
    await saveStep(supabase, user.id, body.step, body);

    const { data: prog } = await supabase
      .from("cv_progress").select("completed_steps")
      .eq("user_id", user.id).maybeSingle();

    const done = Array.from(new Set([...(prog?.completed_steps ?? []), body.step]));
    const { error } = await supabase.from("cv_progress").upsert({
      user_id: user.id,
      current_step: Math.min(7, body.step + 1),
      completed_steps: done,
    } as never);
    if (error) return fail(500, "Could not save that step.");

    return ok({ saved: true, completed: done });
  });
}
