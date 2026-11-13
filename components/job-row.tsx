import Link from "next/link";
import type { FeedJob } from "@/lib/job-format";
import { payLabel, CONTRACT_LABEL } from "@/lib/job-format";
import { Stars, Pill } from "@/components/ui";

export function JobRow({ job }: { job: FeedJob }) {
  return (
    <Link href={`/soulmates/${job.id}`} className="block">
      <article className="ink-card-flat p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold">{job.title}</h3>
            <p className="truncate text-sm text-ink-soft">{job.company}</p>
          </div>
          <Pill tone="money">{job.score}%</Pill>
        </div>
        <div className="mt-2 flex items-center gap-3">
          {job.review_count > 0 ? (
            <Stars value={job.avg_rating} count={job.review_count} />
          ) : (
            <span className="text-xs text-ink-faint">No reviews yet</span>
          )}
        </div>
        <p className="mt-1.5 text-sm font-semibold">{payLabel(job)}</p>
        <p className="mt-1 text-xs text-ink-soft">
          {CONTRACT_LABEL[job.contract_type]} · {job.location}
        </p>
        <p className="mt-2 text-sm text-money">{job.reason}</p>
      </article>
    </Link>
  );
}
