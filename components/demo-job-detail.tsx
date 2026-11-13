import Link from "next/link";
import type { FeedJob } from "@/lib/job-format";
import { payLabel, CONTRACT_LABEL, MODE_LABEL } from "@/lib/job-format";
import { Stars, Pill, Button, Notice } from "@/components/ui";
import { AcceptDecline } from "@/components/accept-decline";
import { CommentBox } from "@/components/comment-box";
import { ReportLink } from "@/components/report-link";
import type { DemoReview } from "@/lib/demo";

/** Soulmates detail rendered from sample data in demo mode. */
export function DemoJobDetail({
  job, reviews, saved, verified,
}: { job: FeedJob; reviews: DemoReview[]; saved: boolean; verified: boolean }) {
  return (
    <div className="px-4 pb-8 pt-5">
      <Link href="/soulmates" className="text-sm underline text-ink-soft">← Soulmates</Link>

      <header className="mt-3">
        <h1 className="text-2xl font-bold leading-tight">{job.title}</h1>
        <p className="text-sm text-ink-soft">{job.company}</p>
      </header>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Pill>{CONTRACT_LABEL[job.contract_type]}</Pill>
        <Pill>{MODE_LABEL[job.work_mode]}</Pill>
        <Pill>{job.location}</Pill>
        <Pill tone="money">{job.score}% fit</Pill>
      </div>

      <p className="mt-3 text-xl font-bold">{payLabel(job)}</p>

      <div className="mt-2">
        {job.review_count > 0
          ? <Stars value={job.avg_rating} count={job.review_count} />
          : <span className="text-xs text-ink-faint">No reviews yet</span>}
      </div>

      <div className="mt-4 rounded-xl border-2 border-money bg-money-soft p-3">
        <p className="text-sm font-medium text-money">{job.reason}</p>
        <p className="mt-1 text-[0.65rem] text-ink-soft">
          Ranked by the built-in rules. You can ask us to review this.
        </p>
      </div>

      <section className="mt-5">
        <h2 className="font-bold">About the job</h2>
        <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{job.description}</p>
        <p className="mt-2 text-xs text-ink-faint">
          Listed via {job.source_name} · sample listing
        </p>
      </section>

      <div className="mt-6">
        <AcceptDecline jobId={job.id} sourceUrl={job.source_url} saved={saved} stage={null} />
      </div>

      <section className="mt-8">
        <h2 className="title-hand text-2xl">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Nobody has reviewed this job yet.</p>
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
                    {r.months_worked} months ·{" "}
                    {r.would_recommend ? "Would recommend" : "Would not recommend"}
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

      <section className="mt-8">
        <h2 className="title-hand text-2xl">Comments</h2>
        <div className="mt-2"><CommentBox jobId={job.id} /></div>
        <p className="mt-3 text-sm text-ink-faint">No comments yet.</p>
      </section>

      <section className="mt-8">
        {!verified ? (
          <Notice tone="gold" title="Reviews need verification">
            To publish a review you need to verify your identity and show proof
            you worked here.
          </Notice>
        ) : null}
        <Link href={verified ? `/review/${job.id}` : `/verify?next=/soulmates/${job.id}`}>
          <Button tone="money" full className="mt-3">Write a review</Button>
        </Link>
      </section>
    </div>
  );
}
