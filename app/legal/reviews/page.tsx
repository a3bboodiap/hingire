import type { Metadata } from "next";
export const metadata: Metadata = { title: "How reviews are verified" };

export default function ReviewPolicyPage() {
  return (
    <>
      <h1>How reviews are verified</h1>
      <p className="text-ink-soft">
        We publish this openly so you know what a “Verified reviewer” label
        actually means.
      </p>

      <h2>Every published review has passed all four of these</h2>
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <strong>Identity check.</strong> The writer completed full identity
          verification — a government ID plus a liveness check, or a recognised
          electronic ID. We hold only the result, never the documents.
        </li>
        <li>
          <strong>Proof of work.</strong> They uploaded a contract, payslip,
          employment or internship certificate, university internship
          agreement, reference letter, or confirmed a work email at the
          company’s domain. The name must match their verified identity, the
          company must match the review, and the dates must cover the role.
        </li>
        <li>
          <strong>Automated pre-screen.</strong> The text is checked for
          personal names, insults, personal data and off-topic content. Anything
          flagged goes to a moderator with the flag attached.
        </li>
        <li>
          <strong>Human moderation.</strong> A moderator makes the final call.
          No valid proof, no review.
        </li>
      </ol>

      <h2>One review per person per job</h2>
      <p>Enforced in our database, not just in the form.</p>

      <h2>What you see, and what you never see</h2>
      <p>
        You see the rating, the written comment, the contract type and the year.
        You never see the reviewer’s name, their documents or their proof of
        work. Reviewers are individual workers, never employers or recruiters.
      </p>

      <h2>Reporting</h2>
      <p>
        Every review has a report link. If we remove a review we give the author
        the reason.
      </p>
    </>
  );
}
