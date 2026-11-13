import "server-only";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { scoreMatch } from "@/lib/ai/tasks";
import { aiConfigured, AI_MODEL } from "@/lib/ai";
import { stripProtectedTraits } from "@/lib/ai/untrusted";
import { audit } from "@/lib/audit";
import type { MatchInputs } from "@/lib/ai/offline";

/**
 * Ranking.
 *
 * EU AI Act: CV-based job ranking is high-risk, so every decision is written
 * to ranking_logs with its inputs, its score and its reason, and the subject
 * can read their own log (and export it). Protected traits are stripped before
 * the inputs are built, so there is no path for them to reach the ranker.
 */
export async function rankJobsForUser(userId: string) {
  if (!adminConfigured()) return { ranked: 0, engine: "offline" as const };
  const admin = createAdminClient();

  const [skills, languages, prefs, jobs, dismissed] = await Promise.all([
    admin.from("cv_skills").select("name, level").eq("user_id", userId),
    admin.from("cv_languages").select("language, level").eq("user_id", userId),
    admin.from("cv_preferences").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("jobs").select("*").eq("closed", false),
    admin.from("dismissed_jobs").select("job_id").eq("user_id", userId),
  ]);

  const jobRows = jobs.data ?? [];
  if (jobRows.length === 0) return { ranked: 0, engine: "offline" as const };

  const dismissedIds = new Set((dismissed.data ?? []).map((d) => d.job_id));

  const candidate = stripProtectedTraits({
    skills: skills.data ?? [],
    languages: languages.data ?? [],
    preferences: {
      roles: prefs.data?.roles ?? [],
      cities: prefs.data?.cities ?? [],
      contract_types: prefs.data?.contract_types ?? [],
      min_pay: prefs.data?.min_pay ?? null,
      work_modes: prefs.data?.work_modes ?? [],
    },
  });

  const useAi = aiConfigured();
  const results = await Promise.all(
    jobRows.map(async (job) => {
      const input: MatchInputs = {
        ...candidate,
        job: {
          title: job.title, location: job.location,
          contract_type: job.contract_type, work_mode: job.work_mode,
          pay_min: job.pay_min, skills_wanted: job.skills_wanted,
          languages_wanted: job.languages_wanted,
        },
      };
      const r = await scoreMatch(input);
      // A dismissed job is pushed down rather than removed: "dismissing a job
      // shows fewer like it", it does not delete it from the catalogue.
      const penalty = dismissedIds.has(job.id) ? 25 : 0;
      return { job, result: r, score: Math.max(0, r.data.score - penalty) };
    }),
  );

  const engine = results.some((r) => r.result.engine === "claude") ? "claude" : "offline";

  await admin.from("job_matches").upsert(
    results.map((r) => ({
      user_id: userId, job_id: r.job.id, score: r.score,
      reason: r.result.data.reason, engine: r.result.engine,
      computed_at: new Date().toISOString(),
    })) as never,
  );

  await admin.from("ranking_logs").insert(
    results.map((r) => ({
      user_id: userId, job_id: r.job.id, score: r.score,
      reason: r.result.data.reason, engine: r.result.engine,
      model: r.result.engine === "claude" ? AI_MODEL : null,
      input_summary: {
        matched_skills: r.result.data.matched_skills,
        matched_languages: r.result.data.matched_languages,
        dismissed_penalty: dismissedIds.has(r.job.id) ? 25 : 0,
        protected_traits_used: [],
      },
    })) as never,
  );

  await audit("ranking_computed", userId, { jobs: results.length, engine, ai: useAi });
  return { ranked: results.length, engine };
}
