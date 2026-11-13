import type { Metadata } from "next";
export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy notice</h1>
      <p className="text-ink-soft">
        Plain language, because you should be able to read this once and know
        what happens to your data.
      </p>

      <h2>What we hold</h2>
      <ul>
        <li>Your account: email, name, location, phone, date of birth.</li>
        <li>Your CV answers: education, experience, skills, languages, certificates, preferences.</li>
        <li>What you do here: jobs saved, dismissed and applied to, application stages, rejection entries.</li>
        <li>Reviews you write, and the proof of work you upload with them.</li>
        <li>Verification <em>results</em> only — see below.</li>
      </ul>

      <h2>Your date of birth</h2>
      <p>
        We use it for one thing: checking you are 18 or over. It is never sent
        to the ranking system and never affects which jobs you are shown.
      </p>

      <h2>Ranking is done by AI</h2>
      <p>
        Your job feed is ordered by an automated system that compares your CV
        answers with each listing. Every job shows the reason it was picked,
        and you can switch to a newest-first feed at any time in Profile. We
        remove age, gender, nationality and photos before ranking, we log how
        each ranking was made, and you can ask a human to review it.
      </p>

      <h2>Identity checks</h2>
      <p>
        We never store copies of ID documents or face scans. The verification
        provider holds those. We keep only the result: whether you passed, the
        date, a provider reference, an over-18 flag and a name-match flag.
      </p>

      <h2>Proof of work</h2>
      <p>
        Uploaded only when you publish a review. It is private, readable only
        by the moderator checking it, never shown to other users or employers,
        and deleted within 30 days of the decision — or immediately if you
        delete your account.
      </p>

      <h2>Rejection entries</h2>
      <p>
        Private to you. Never shown to employers and never included in reviews.
      </p>

      <h2>Where your data lives</h2>
      <p>
        In the EU. Our AI provider is configured not to train on your data.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Download everything we hold about you, from Profile, any time.</li>
        <li>Delete your account and all of it, from Profile, any time.</li>
        <li>Correct anything wrong — your CV answers are editable from Profile.</li>
        <li>Object to automated ranking by switching to the newest-first feed.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Only the ones that keep you signed in. No tracking or advertising
        cookies. Rejecting is one tap, same as accepting.
      </p>

      <h2>If something goes wrong</h2>
      <p>
        If your data is ever exposed we will tell you, and the AEPD, within 72
        hours.
      </p>
    </>
  );
}
