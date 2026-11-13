import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getFeed } from "@/lib/feed";
import { JobRow } from "@/components/job-row";
import { EmptyState, Button } from "@/components/ui";

export const metadata = { title: "Soulmates" };
export const dynamic = "force-dynamic";

export default async function SoulmatesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const all = await getFeed(session.supabase, session.user.id, {
    sort: "ai_rank", includeDismissed: true,
  });
  const saved = all.filter((j) => j.saved);

  return (
    <>
      <div className="px-4 pt-5">
        <h1 className="title-hand text-[2.6rem] leading-none">Soulmates</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          The ones you swiped right on.
        </p>
      </div>

      <div className="mt-4 space-y-3 px-4 pb-6">
        {saved.length === 0 ? (
          <EmptyState
            title="No soulmates yet"
            action={<Link href="/top-match"><Button tone="money">Start swiping</Button></Link>}
          >
            Swipe right on a job in Top Match and it lands here.
          </EmptyState>
        ) : (
          saved.map((j) => <JobRow key={j.id} job={j} />)
        )}
      </div>
    </>
  );
}
