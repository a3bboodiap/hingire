import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { getFeed } from "@/lib/feed";
import { JobRow } from "@/components/job-row";
import { FilterSheet } from "@/components/filter-sheet";
import { EmptyState } from "@/components/ui";
import { SortToggle } from "@/components/sort-toggle";

export const metadata = { title: "Job Offers" };
export const dynamic = "force-dynamic";

export default async function JobOffersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;

  const jobs = await getFeed(session.supabase, session.user.id, {
    sort: session.profile.feed_sort,
    filters: {
      location: sp.location,
      minPay: sp.minPay ? Number(sp.minPay) : undefined,
      contract: sp.contract?.split(",").filter(Boolean),
      remote: sp.remote?.split(",").filter(Boolean),
    },
  });

  return (
    <>
      <div className="flex items-start justify-between px-4 pt-5">
        <div>
          <h1 className="title-hand text-[2.6rem] leading-none">Job Offers</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {jobs.length} job{jobs.length === 1 ? "" : "s"}
            {session.profile.feed_sort === "ai_rank" ? ", ranked by AI" : ", newest first"}
          </p>
        </div>
        <div className="pt-1">
          <Suspense fallback={null}><FilterSheet /></Suspense>
        </div>
      </div>

      <div className="mt-3 px-4">
        <SortToggle current={session.profile.feed_sort} />
      </div>

      <div className="mt-3 space-y-3 px-4 pb-6">
        {jobs.length === 0 ? (
          <EmptyState title="Nothing matches those filters">
            Try widening the location or lowering the minimum pay.
          </EmptyState>
        ) : (
          jobs.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </div>
    </>
  );
}
