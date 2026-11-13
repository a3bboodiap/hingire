import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, canPublishReviews } from "@/lib/auth";
import { Pill, Button, Notice } from "@/components/ui";
import { DownloadData, DeleteAccount, SignOut } from "@/components/profile-actions";
import { SortToggle } from "@/components/sort-toggle";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const p = session.profile;
  const verified = canPublishReviews(p);

  const { count: reviewCount } = await session.supabase
    .from("reviews").select("id", { count: "exact", head: true })
    .eq("author_id", session.user.id);

  return (
    <div className="px-4 pb-8 pt-5">
      <h1 className="title-hand text-[2.6rem] leading-none">Profile</h1>

      <section className="mt-4 ink-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-bold">
              {[p.first_name, p.last_name].filter(Boolean).join(" ") || "Your name"}
            </p>
            <p className="text-sm text-ink-soft">{p.email}</p>
            {p.location ? <p className="text-sm text-ink-soft">{p.location}</p> : null}
          </div>
          {verified ? <Pill tone="money">Verified</Pill> : <Pill>Not verified</Pill>}
        </div>
      </section>

      <section className="mt-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Your details
        </h2>
        <Link href="/info?edit=1" className="block">
          <Button full>Edit personal details</Button>
        </Link>
        <Link href="/cv?edit=1" className="block">
          <Button full>Edit my CV and preferences</Button>
        </Link>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          How your feed is ordered
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your job feed is ranked by an automated system that compares your CV
          with each listing. You can switch it off.
        </p>
        <div className="mt-2"><SortToggle current={p.feed_sort} /></div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Verification
        </h2>
        {verified ? (
          <Notice tone="money" title="Verified">
            You can publish reviews. You have written {reviewCount ?? 0}.
          </Notice>
        ) : p.kyc_status === "manual_review" ? (
          <Notice tone="gold" title="Under review">
            Something on your document did not match your account, so a person
            is checking it. Reviews are blocked until that is done.
          </Notice>
        ) : (
          <>
            <p className="text-sm text-ink-soft">
              Optional. It gives you a Verified badge and lets you publish reviews.
            </p>
            <Link href="/verify?next=/profile" className="block">
              <Button tone="money" full>Get verified</Button>
            </Link>
          </>
        )}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">
          Your data
        </h2>
        <DownloadData />
        <p className="text-xs text-ink-soft">
          A JSON file with everything we hold about you, including how each job
          ranking was decided.
        </p>
        <div className="pt-2"><DeleteAccount /></div>
      </section>

      <section className="mt-8 space-y-3">
        <SignOut />
        <div className="flex justify-center gap-4 text-xs text-ink-soft">
          <Link href="/legal/privacy" className="underline">Privacy</Link>
          <Link href="/legal/terms" className="underline">Terms</Link>
          <Link href="/legal/reviews" className="underline">How reviews work</Link>
        </div>
      </section>
    </div>
  );
}
