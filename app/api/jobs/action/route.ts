import { withUser } from "@/lib/route-helpers";
import { jobActionSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, jobActionSchema);
  if (!parsed.ok) return parsed.response;
  const { job_id, action } = parsed.data;

  return withUser("apply", async ({ user, supabase }) => {
    // The job must exist and be open. RLS on jobs already restricts this to
    // open listings, so a closed or invented id simply misses.
    const { data: job } = await supabase
      .from("jobs").select("id").eq("id", job_id).maybeSingle();
    if (!job) return fail(404, "That job is no longer available.");

    if (action === "save") {
      await supabase.from("dismissed_jobs").delete()
        .eq("user_id", user.id).eq("job_id", job_id);
      const { error } = await supabase.from("saved_jobs")
        .upsert({ user_id: user.id, job_id } as never, { onConflict: "user_id,job_id" });
      if (error) return fail(500, "Could not save that job.");
      // Saving also creates the tracker entry at stage "saved".
      await supabase.from("applications")
        .upsert({ user_id: user.id, job_id, stage: "saved" } as never,
                { onConflict: "user_id,job_id", ignoreDuplicates: true });
      await audit("job_saved", user.id, {});
    } else if (action === "unsave") {
      await supabase.from("saved_jobs").delete()
        .eq("user_id", user.id).eq("job_id", job_id);
      await audit("job_dismissed", user.id, { via: "unsave" });
    } else {
      await supabase.from("saved_jobs").delete()
        .eq("user_id", user.id).eq("job_id", job_id);
      const { error } = await supabase.from("dismissed_jobs")
        .upsert({ user_id: user.id, job_id } as never, { onConflict: "user_id,job_id" });
      if (error) return fail(500, "Could not dismiss that job.");
      await audit("job_dismissed", user.id, {});
    }

    return ok({ done: true });
  });
}
