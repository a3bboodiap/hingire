import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFeed } from "@/lib/feed";
import { SwipeDeck } from "@/components/swipe-deck";
import { ScreenTitle, EmptyState, Button } from "@/components/ui";
import { Bell } from "@/components/bell";
import Link from "next/link";

export const metadata = { title: "Top Match" };
export const dynamic = "force-dynamic";

export default async function TopMatchPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const jobs = await getFeed(session.supabase, session.user.id, {
    sort: session.profile.feed_sort,
  });
  const fresh = jobs.filter(
    (j) => Date.now() - +new Date(j.posted_at) < 7 * 86400_000,
  ).length;

  return (
    <>
      <div className="flex items-start justify-between px-4 pt-5">
        <div>
          <h1 className="title-hand text-[2.6rem] leading-none">Top Match</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Your best fits, best first.</p>
        </div>
        <div className="pt-1"><Bell count={fresh} /></div>
      </div>

      <div className="mt-4">
        {jobs.length === 0 ? (
          <EmptyState
            title="No matches yet"
            action={
              <Link href="/cv?edit=1">
                <Button tone="money">Add more skills</Button>
              </Link>
            }
          >
            Add more skills to your CV to get matches.
          </EmptyState>
        ) : (
          <SwipeDeck jobs={jobs} />
        )}
      </div>
    </>
  );
}
