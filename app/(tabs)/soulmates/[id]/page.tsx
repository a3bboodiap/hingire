import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession, canPublishReviews } from "@/lib/auth";
import { payLabel, CONTRACT_LABEL, MODE_LABEL } from "@/lib/job-format";
import { Stars, Pill, Button, Notice } from "@/components/ui";
import { AcceptDecline } from "@/components/accept-decline";
import { CommentBox } from "@/components/comment-box";
import { ReportLink } from "@/components/report-link";
import { DEMO } from "@/lib/demo";
import { DemoJobDetail } from "@/components/demo-job-detail";

export const dynamic = "force-dynamic";

export default async function JobDetail({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");
  const { supabase, user } = session;

  if (DEMO) {
    const { demoJobs, demoReviews, demoState } = await import("@/lib/demo");
    const dj = demoJobs.find((j) => j.id === id);
    if (!dj) notFound();
    const revs = demoReviews.filter((r) => r.job_id === id);
    return (
      <DemoJobDetail
        job={dj}
        reviews={revs}
        saved={demoState.saved.has(id)}
        verified={demoState.kycPassed}
      />
    );
  }

  // RLS already limits this to open jobs; an id the user may not see misses.
  const { data: job } = await supabase
    .from("jobs").select("*, companies(name)").eq("id", id).maybeSingle();
  if (!job) notFound();

  const [matchRes, statsRes, reviewsRes, commentsRes, savedRes, appRes] =
    await Promise.all([
      supabase.from("job_matches").select("score, reason, engine")
        .eq("user_id", user.id).eq("job_id", id).maybeSingle(),
      supabase.from("job_review_stats").select("*").eq("job_id", id).maybeSingle(),
      supabase.from("reviews")
        .select("id, overall, comment, contract_type, year_label, months_worked, would_recommend")
        .eq("job_id", id).eq("status", "approved")
        .order("published_at", { ascending: false }),
      supabase.from("job_comments").select("id, body, created_at, user_id")
        .eq("job_id", id).eq("status", "approved")
        .order("created_at", { ascending: false }).limit(50),
      supabase.from("saved_jobs").select("job_id")
        .eq("user_id", user.id).eq("job_id", id).maybeSingle(),
      supabase.from("applications").select("stage")
        .eq("user_id", user.id).eq("job_id", id).maybeSingle(),
    ]);

  const company = (job.companies as unknown as { name: string } | null)?.name ?? "Unknown";
  const stats = statsRes.data;
  const reviews = reviewsRes.data ?? [];
  const verified = canPublishReviews(session.profile);

  return (
    <div className="px-4 pb-8 pt-5">
      <Link href="/soulmates" className="text-sm underline text-ink-soft">← Soulmates</Link>

      <header className="mt-3">
        <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
        <p className="text-sm text-ink-soft">{company}</p>
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill>{CONTRACT_LABEL[job.contract_type]}</Pill>
        <Pill>{MODE_LABEL[job.work_mode]}</Pill>
        <Pill>{job.location}</Pill>
        {matchRes.data ? <Pill tone="money">{matchRes.data.score}% fit</Pill> : null}
      </div>

      <p className="mt-3 text-xl font-bold">{payLabel(job)}</p>

      <div className="mt-2">
        {stats && stats.review_count > 0 ? (
          <Stars value={Number(stats.avg_rating)} count={stats.review_count} />
        ) : (
          <span className="text-xs text-ink-faint">No reviews yet</span>
        )}
      </div>

      {matchRes.data ? (
        <div className="mt-4 rounded-xl border-2 border-money bg-money-soft p-3">
          <p className="text-sm font-medium text-money">{matchRes.data.reason}</p>
          <p className="mt-1 text-[0.65rem] text-ink-soft">
            Ranked by {matchRes.data.engine === "claude" ? "AI" : "the built-in rules"}.
            You can ask us to review this.
          </p>
        </div>
      ) : null}

      <section className="mt-5">
        <h2 className="font-bold">About the job</h2>
        <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{job.description}</p>
        <p className="mt-2 text-xs text-ink-faint">
          Listed via {job.source_name} ·{" "}
          <a href={job.source_url} target="_blank" rel="noopener noreferrer nofollow"
             className="underline">view the original</a>
        </p>
      </section>

      <div className="mt-6">
        <AcceptDecline
          jobId={job.id}
          sourceUrl={job.source_url}
          saved={Boolean(savedRes.data)}
          stage={appRes.data?.stage ?? null}
        />
      </div>

      {/* ---- Reviews ---- */}
      <section className="mt-8">
        <h2 className="title-hand text-2xl">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Nobody has reviewed this job yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="ink-card-flat p-4">
                <div className="flex items-center justify-between gap-2">
                  <Pill tone="money">
                    Verified reviewer · {CONTRACT_LABEL[r.contract_type]} · {r.year_label}
                  </Pill>
                  <Stars value={r.overall} />
                </div>
                <p className="mt-2 text-sm">{r.comment}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-ink-soft">
                    {r.months_worked} months · {r.would_recommend ? "Would recommend" : "Would not recommend"}
                  </span>
                  <ReportLink reviewId={r.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          <Link href="/legal/reviews" className="underline">How reviews are verified</Link>
        </p>
      </section>

      {/* ---- Comments ---- */}
      <section className="mt-8">
        <h2 className="title-hand text-2xl">Comments</h2>
        <div className="mt-2">
          <CommentBox jobId={job.id} />
        </div>
        <ul className="mt-3 space-y-2">
          {(commentsRes.data ?? []).map((c) => (
            <li key={c.id} className="rounded-xl border-2 border-ink-faint bg-white p-3">
              <p className="text-sm">{c.body}</p>
              <p className="mt-1 text-[0.65rem] text-ink-faint">
                {c.user_id === user.id ? "You" : "Someone"} ·{" "}
                {new Date(c.created_at).toLocaleDateString()}
              </p>
            </li>
          ))}
          {(commentsRes.data ?? []).length === 0 ? (
            <li className="text-sm text-ink-faint">No comments yet.</li>
          ) : null}
        </ul>
      </section>

      {/* ---- Write a review ---- */}
      <section className="mt-8">
        {!verified ? (
          <Notice tone="gold" title="Reviews need verification">
            To publish a review you need to verify your identity and show proof
            you worked here.
          </Notice>
        ) : null}
        <Link href={verified ? `/review/${job.id}` : `/verify?next=/review/${job.id}`}>
          <Button tone="money" full className="mt-3">Write a review</Button>
        </Link>
      </section>
    </div>
  );
}
