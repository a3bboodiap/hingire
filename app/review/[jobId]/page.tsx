import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession, canPublishReviews } from "@/lib/auth";
import { ReviewForm } from "@/components/review-form";

export const metadata = { title: "Write a review" };
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  // Acceptance test 3: an unverified user is sent to Verify, not here.
  if (!canPublishReviews(session.profile)) {
    redirect(`/verify?next=/review/${jobId}`);
  }

  const { data: job } = await session.supabase
    .from("jobs").select("title, location, contract_type, companies(name)")
    .eq("id", jobId).maybeSingle();
  if (!job) notFound();

  return (
    <main className="min-h-dvh px-5 pb-12 pt-6">
      <Link href={`/soulmates/${jobId}`} className="text-sm underline text-ink-soft">
        ← Back
      </Link>
      <h1 className="title-hand mt-3 text-3xl">Rate this job</h1>
      <p className="mt-0.5 text-sm text-ink-soft">
        {job.title} · {(job.companies as unknown as { name: string } | null)?.name}
      </p>
      <div className="mt-6">
        <ReviewForm
          jobId={jobId}
          job={{
            title: job.title,
            company: (job.companies as unknown as { name: string } | null)?.name ?? "",
            location: job.location,
            contract_type: job.contract_type,
          }}
        />
      </div>
    </main>
  );
}
