import { withUser } from "@/lib/route-helpers";
import { reviewSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { canPublishReviews } from "@/lib/auth";
import { screenReview } from "@/lib/ai/tasks";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = await parseBody(request, reviewSchema);
  if (!parsed.ok) return parsed.response;
  const r = parsed.data;

  return withUser("review", async ({ user, profile, supabase }) => {
    // Gate 1: full KYC. Also enforced by the RLS insert policy.
    if (!canPublishReviews(profile)) {
      await audit("review_blocked_unverified", user.id, { at: "submit" });
      return fail(403, "You need to verify your identity before publishing a review.");
    }

    // Gate 2: the proof file must exist and be in this user's own folder.
    if (!r.proof_path.startsWith(`${user.id}/`)) {
      return fail(400, "That proof file does not belong to your account.");
    }
    const { data: proofInfo } = await supabase.storage
      .from("proofs")
      .list(user.id, { search: r.proof_path.split("/")[1] });
    if (!proofInfo || proofInfo.length === 0) {
      return fail(400, "Upload your proof of work before submitting.");
    }

    const { data: job } = await supabase
      .from("jobs").select("id, company_id").eq("id", r.job_id).maybeSingle();
    if (!job) return fail(404, "That job no longer exists.");

    // Gate 3: one review per person per job (also a unique index).
    const { data: existing } = await supabase
      .from("reviews").select("id")
      .eq("author_id", user.id).eq("job_id", r.job_id).maybeSingle();
    if (existing) return fail(409, "You have already reviewed this job.");

    const screen = await screenReview(r.comment);

    const { error } = await supabase.from("reviews").insert({
      author_id: user.id,
      job_id: r.job_id,
      company_id: job.company_id,
      job_title: r.job_title,
      job_description: r.job_description,
      job_location: r.job_location,
      contract_type: r.contract_type,
      months_worked: r.months_worked,
      overall: r.overall,
      pay_fairness: r.pay_fairness,
      workload: r.workload,
      learning: r.learning,
      management: r.management,
      would_recommend: r.would_recommend,
      comment: r.comment,
      // Always pending. A moderator publishes it, never this route.
      status: "pending",
      ai_flags: { ...screen.data, engine: screen.engine },
      proof_path: r.proof_path,
      proof_checked: false,
      year_label: new Date().getFullYear(),
    } as never);

    if (error) {
      if (error.code === "23505") return fail(409, "You have already reviewed this job.");
      return fail(500, "Could not submit your review.");
    }

    // Retention: proof is deleted within 30 days of the decision.
    if (adminConfigured()) {
      const after = new Date(); after.setDate(after.getDate() + 30);
      await createAdminClient().from("reviews")
        .update({ proof_delete_after: after.toISOString().slice(0, 10) })
        .eq("author_id", user.id).eq("job_id", r.job_id);
    }

    await audit("review_submitted", user.id, {
      flagged: screen.data.personal_names || screen.data.insults ||
               screen.data.personal_data || screen.data.off_topic,
      engine: screen.engine,
    });

    return ok({ submitted: true });
  });
}
