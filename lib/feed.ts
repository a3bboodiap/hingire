import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEMO } from "@/lib/demo";

export type { FeedJob } from "@/lib/job-format";
export { payLabel, CONTRACT_LABEL, MODE_LABEL } from "@/lib/job-format";
import type { FeedJob } from "@/lib/job-format";

export type FeedFilters = {
  location?: string; minPay?: number;
  contract?: string[]; remote?: string[];
};

/**
 * The ranked feed. Same data behind Top Match and Job Offers.
 * Ordering honours the user's feed_sort: 'ai_rank' or 'newest' (GDPR —
 * users must be able to opt out of the AI-ranked feed).
 */
export async function getFeed(
  db: SupabaseClient<Database>,
  userId: string,
  opts: { sort: "ai_rank" | "newest"; filters?: FeedFilters; includeDismissed?: boolean } = {
    sort: "ai_rank",
  },
) {
  if (DEMO) {
    const { demoFeed } = await import("@/lib/demo");
    return demoFeed({
      includeDismissed: opts.includeDismissed,
      sort: opts.sort,
      filters: opts.filters,
    });
  }

  const [jobsRes, matchesRes, statsRes, savedRes, dismissedRes] = await Promise.all([
    db.from("jobs").select("*, companies(name)").eq("closed", false),
    db.from("job_matches").select("*").eq("user_id", userId),
    db.from("job_review_stats").select("*"),
    db.from("saved_jobs").select("job_id").eq("user_id", userId),
    db.from("dismissed_jobs").select("job_id").eq("user_id", userId),
  ]);

  const matches = new Map((matchesRes.data ?? []).map((m) => [m.job_id, m]));
  const stats = new Map((statsRes.data ?? []).map((s) => [s.job_id, s]));
  const saved = new Set((savedRes.data ?? []).map((s) => s.job_id));
  const dismissed = new Set((dismissedRes.data ?? []).map((d) => d.job_id));

  const f = opts.filters ?? {};

  let rows: FeedJob[] = (jobsRes.data ?? [])
    .filter((j) => opts.includeDismissed || !dismissed.has(j.id))
    .filter((j) => !f.location || j.location.toLowerCase().includes(f.location.toLowerCase()))
    .filter((j) => f.minPay == null || (j.pay_min ?? 0) >= f.minPay)
    .filter((j) => !f.contract?.length || f.contract.includes(j.contract_type))
    .filter((j) => !f.remote?.length || f.remote.includes(j.work_mode))
    .map((j) => {
      const m = matches.get(j.id);
      const s = stats.get(j.id);
      return {
        id: j.id,
        title: j.title,
        company: (j.companies as unknown as { name: string } | null)?.name ?? "Unknown",
        location: j.location,
        pay_min: j.pay_min, pay_max: j.pay_max, currency: j.currency,
        contract_type: j.contract_type, work_mode: j.work_mode,
        description: j.description,
        source_name: j.source_name, source_url: j.source_url,
        posted_at: j.posted_at,
        score: m?.score ?? 0,
        reason: m?.reason ?? "Ranked once you finish your CV.",
        engine: m?.engine ?? "offline",
        avg_rating: Number(s?.avg_rating ?? 0),
        review_count: s?.review_count ?? 0,
        saved: saved.has(j.id),
      };
    });

  rows = opts.sort === "newest"
    ? rows.sort((a, b) => +new Date(b.posted_at) - +new Date(a.posted_at))
    : rows.sort((a, b) => b.score - a.score);

  return rows;
}
