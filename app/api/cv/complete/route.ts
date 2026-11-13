import { withUser } from "@/lib/route-helpers";
import { ok } from "@/lib/http";
import { rankJobsForUser } from "@/lib/ranking";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  return withUser("apply", async ({ user, supabase }) => {
    await supabase.from("profiles").update({ onboarding_step: "done" }).eq("id", user.id);
    const { ranked, engine } = await rankJobsForUser(user.id);
    return ok({ next: "/top-match", ranked, engine });
  });
}
