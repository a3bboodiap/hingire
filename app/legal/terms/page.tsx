import type { Metadata } from "next";
export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms</h1>

      <h2>Who can use Hingire</h2>
      <p>
        You must be 18 or over. We ask your date of birth at sign-up and confirm
        it during identity verification. If verification shows a different date
        of birth, reviews are blocked and the account is held for manual review.
      </p>

      <h2>What Hingire is for</h2>
      <p>
        Finding internships and first jobs, tracking your applications, and
        reading honest reviews from people who did the job. It is for job
        seekers only. We do not offer employer or recruiter tools: no job
        posting, no candidate search, no paid placement and no employer replies
        to reviews. An employer can report a review.
      </p>

      <h2>Writing a review</h2>
      <ul>
        <li>You must have passed identity verification.</li>
        <li>You must upload proof that you worked or interned there, covering the dates you claim.</li>
        <li>One review per person per job.</li>
        <li>A moderator checks every review before it goes live.</li>
        <li>Reviews may not name individual managers or colleagues. Personal attacks are removed.</li>
        <li>Reviews show as “Verified reviewer · Internship · 2025”. Your name is never shown.</li>
      </ul>

      <h2>Moderation</h2>
      <p>
        We remove reviews that name individuals, contain insults or personal
        data, or are off topic. If we remove yours we tell you why. Every review
        carries a report link, and we review reports.
      </p>

      <h2>What we do not do</h2>
      <ul>
        <li>Apply to jobs for you automatically.</li>
        <li>Cover freelance or gig work.</li>
        <li>Give career coaching, courses or interview practice.</li>
        <li>Scrape job sites that forbid it — listings come from official APIs and partner feeds, and each links to its source.</li>
      </ul>
    </>
  );
}
