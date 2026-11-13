import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession, canPublishReviews } from "@/lib/auth";
import { peekRateLimit } from "@/lib/rate-limit";
import { VerifyFlow } from "@/components/verify-flow";
import { Notice, Button } from "@/components/ui";

export const metadata = { title: "Verify" };
export const dynamic = "force-dynamic";

export default async function VerifyPage({
  searchParams,
}: { searchParams: Promise<{ next?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const sp = await searchParams;

  // Only ever follow an internal path.
  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//")
    ? sp.next : "/profile";

  if (canPublishReviews(session.profile)) {
    return (
      <main className="min-h-dvh px-5 pb-10 pt-8">
        <h1 className="text-2xl font-bold">Verify</h1>
        <div className="mt-4">
          <Notice tone="money" title="Already verified">
            You have a Verified badge and can publish reviews.
          </Notice>
        </div>
        <Link href={next}><Button tone="money" full className="mt-4">Continue</Button></Link>
      </main>
    );
  }

  const { used, max } = await peekRateLimit(`user:${session.user.id}`, "kyc");

  return (
    <main className="min-h-dvh px-5 pb-10 pt-8">
      <Link href={next} className="text-sm underline text-ink-soft">← Back</Link>
      <h1 className="mt-3 text-2xl font-bold">Verify your identity</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Only needed to publish a review. Everything else works without it.
      </p>
      <div className="mt-6">
        <VerifyFlow next={next} attemptsUsed={used} attemptsMax={max} />
      </div>
    </main>
  );
}
