<!--
  This is the product contract for Hingire, extracted verbatim from
  Job_Finder_App_PRD-5.docx.

  One deliberate deviation, agreed at the start of the build: the PRD's
  "AI features" section specifies Lovable's built-in AI connector. This build
  uses the Anthropic Messages API (claude-haiku-5-5) called only from server
  routes instead. Every other requirement — features, screens, KYC policy,
  security and legal — is implemented as written.
-->

# Job Finder App: PRD
## Users and their problem
Job seeker (main user): a student or recent graduate looking for an internship or a first job. They check three or four job sites, keep running into the same posts, and can’t easily tell which roles they qualify for. Every application means typing the same details into a new form. Most never get a reply, so after a few weeks they lose track of where they applied. Rejections vanish into email, so they never learn from them. They can’t tell what a job is really like before applying.
Reviewer: someone who has worked or interned at a company, current or former. They rate and review the job they did so seekers know what to expect. Reviewers are individuals, never employers or recruiters.
## What the app must do
Pull listings from several sources into one feed, remove duplicates and closed posts, and rank the rest by fit with the user’s CV and preferences. Show the best matches as swipeable cards and as a list. Keep a record of every application and its stage. Log every rejection so users can spot patterns. Show ratings and reviews from verified people who did each job. Seekers browse, save, apply and track without heavy checks. Full identity verification (KYC) happens only when a user wants to publish a review.
## Core features, by priority
- CV builder. The user builds their CV by answering a short step-by-step questionnaire, like a CV builder app: education, experience, skills, languages, certificates and job preferences. A small skip option lets them upload an existing CV instead; AI reads it and fills in the questionnaire answers, which the user checks. Answers can be edited any time from Profile. Ranking never uses date of birth, gender, nationality or photo; the questionnaire does not ask for them and the AI ignores them in an uploaded CV.
- Ranked job feed. Jobs sorted by fit, each with a short reason it was picked. Shown two ways: Top Match (swipe cards) and Job Offers (list). Filters: location, pay, contract type, remote. Dismissing a job shows fewer like it. Each job shows its average rating and number of reviews.
- Application tracker. Saved and applied jobs on one list with a stage: saved, applied, interview, offer, rejected. Users can add jobs they applied to elsewhere.
- Rejection tracker. Moving an application to “rejected” prompts a short entry: date, stage rejected at (CV screen, assessment, interview, final round), reason if given, optional note. Users can add rejections from elsewhere. A summary view shows where most rejections happen and which role types or skills recur. Entries are private and never shown to employers or in reviews. Rejection data is a mild ranking signal, alongside dismissals.
- Job ratings and reviews. People who worked or interned at a company rate the job they did: overall score 1 to 5, plus pay fairness, workload, learning and management; job title, description, location, contract type, months worked; a written comment; would recommend yes/no. Posting requires passed KYC and proof of work for that employer. Reviews show only “Verified reviewer · Internship · 2025”, never a name or document. One review per person per job. Every review is moderated before going live and can be reported.
- Quick apply. When the employer allows it, the app fills the application from the profile and the user checks it before sending. Otherwise it opens the employer’s site and asks afterwards whether they applied.
- Job alerts. Bell icon with a count of new matching jobs, plus push notifications.
- Account verification (KYC). Required to publish a review; optional for seekers, who earn a “Verified” badge.
## Screens
Navigation: a bottom tab bar with Top Match, Job Offers, Soulmates, Tracker and Profile. Screens 1 to 3 are the sign-up flow and appear before the tab bar.
- Welcome. Title “Get that Bling Bling” with dollar bills floating around it. A “Log in” link for returning users. A “Swipe >>>” slider at the bottom starts sign-up.
- Info (personal details). Fields: email, first and last name, location, phone, date of birth. Email and phone are confirmed with a one-time code. Under 18 cannot continue and sees a plain message saying the app is 18+. No ID photo on this screen; ID checks happen only on the Verify screen.
- CV screen. A step-by-step questionnaire, one topic per step, with a progress bar (“Step 2 of 6”), Back and Next buttons, and answers saved after every step. A small “Skip: upload my CV instead” link sits under the first step: the user uploads a PDF or Word CV, AI reads it and fills in every step, and the user goes straight to the summary to check and fix the answers. Anything the AI could not find is left blank and highlighted.
- Step 1, Education: level (high school, bachelor’s, master’s, other), school or university, field of study, start year, end or expected year. “Add another” button.
- Step 2, Experience: job title, company, start and end month, two or three lines on what you did. “Add another” button and a “No experience yet” option that skips the step.
- Step 3, Skills: tap suggested skill chips or type your own; for each, pick a level: basic, good or advanced.
- Step 4, Languages: language plus level (A1, A2, B1, B2, C1, C2 or native). “Add another” button.
- Step 5, Certificates and courses (optional): name, who issued it, year.
- Step 6, Job preferences: roles you want, cities, contract type (internship, part-time, full-time), minimum pay, remote, hybrid or on-site, earliest start date.
- Last step: a summary of the CV with an edit link on each section, then “Find my matches”.
- Top Match. A stack of swipeable job cards, best fit on top. Each card shows: role, company, pay, location, average stars with review count, and one line on why it fits (“Matches your Excel and Spanish”). Swipe right, or tap the heart, to save: the card shows a “LOVE” stamp and moves to Soulmates. Swipe left to dismiss. Bell icon top right with the count of new matching jobs.
- Job Offers. The same ranked feed as a scrolling list. Filter icon top right opens filters for location, pay, contract type and remote. Each row: role, company, average stars, review count and the one-line reason.
- Soulmates. Saved jobs. Tapping one opens its detail: role, company, pay, location, average stars and review count, the reason it fits, and two buttons. Accept (green) applies: quick apply with a pre-filled form the user checks, or opens the employer’s site and asks afterwards whether they applied; the job then moves to the Tracker as “applied”. Decline (red) dismisses it. Below: Comments, the reviews for that job, each shown as “Verified reviewer · Internship · 2025” with its stars and text, plus a Report link. A “Write a review” button at the bottom.
- Tracker. Every saved and applied job grouped by stage: saved, applied, interview, offer, rejected. Users change the stage by tapping it. Choosing “rejected” opens the rejection entry form. A “Rejection summary” card at the top shows where most rejections happen and which skills recur. Button to add a job applied to elsewhere.
- Verify. Opens only when a user taps “Write a review” (or “Get verified” in Profile) and is not yet verified. Steps: consent screen, then either scan ID with the live camera plus a short selfie video, or verify with an electronic ID; then the result. If it fails, show the reason and a retry button.
- Review Page. Header of five large gold stars. Fields: job name, job description, job location, contract type, months worked, proof of work upload (with a reminder to black out salary and ID numbers). “Tap to rate”: overall stars, plus pay fairness, workload, learning and management. “Would you recommend it?” yes/no. “Leave comment…” text box. Submit shows “Thanks, your review is being checked” and the review stays hidden until a moderator approves it.
- Profile. Edit personal details and CV, preferences, “Get verified” for the badge, download my data, delete my account.
Empty and error states: no matches yet (“Add more skills to your CV to get matches”); questionnaire left halfway (answers are kept and the user resumes where they stopped); CV upload failed or unreadable (say so and continue with the questions); verification failed (reason plus retry, 3 tries a day); proof of work rejected (reason, review not published); no internet (retry button).
## Look and feel
- Style: hand-drawn and playful, like a sketchbook. Cream background with a faint grid, black ink outlines, rounded cards.
- Colours: cream background, black text, money green for positive actions (Accept, Love, save), red for Decline and errors, gold for stars.
- Fonts: a handwritten font for screen titles (Top Match, Job Offers, Soulmates); a clean, readable sans-serif for everything else.
- Tone: casual and fun on the browsing screens (“Get that Bling Bling”, “Soulmates”); plain, calm and serious on sign-up, Verify, privacy and error messages.
- First thing a new user sees: the Welcome screen. First thing a returning user sees: Top Match.
## AI features
Use Lovable’s built-in AI connector for every AI task: no separate API key and no provider account. Every AI call runs in a backend function, never from the browser. Every task returns structured JSON with fixed fields, so the app checks the output instead of trusting free text.
- CV reader (the “Skip: upload my CV instead” option). Input: the uploaded CV. Output: the six questionnaire steps filled in, with any field it could not find left empty. It ignores date of birth, gender, nationality and photo.
- Match score and reason. Input: the user’s CV answers and preferences plus one job listing. Output: a fit score from 0 to 100 and one plain sentence on why it fits, naming the matching skills or languages. The feed sorts by this score.
- ID photo check (prototype only). Input: the ID photo. Output: is it an ID document (yes/no), document type, all four corners visible (yes/no), text readable (yes/no), blur or glare (yes/no), date of birth, and a short reason if it fails. The app, not the AI, decides pass or fail from these fields: under 18, wrong date of birth or any “no” means fail.
- Proof of work pre-check. Input: the proof document and the review’s company and dates. Output: company name found (yes/no), person’s name found (yes/no), dates found, and a note for the moderator. A moderator still makes the final decision.
- Review pre-screen. Input: the review text. Output: flags for personal names, insults, personal data or off-topic content. Flagged reviews go to the moderator with the flag shown.
- Rejection summary. Input: the user’s rejection entries. Output: the stage where most rejections happen and the skills or role types that recur, as two or three short sentences. Patterns only, no advice.
## What the app will not do
- Apply to jobs automatically.
- Offer tools for employers or recruiters: no job posting, candidate search, paid placement or replies to reviews. Employers can only report a review.
- Cover freelance or gig work.
- Give career coaching, courses, interview practice or advice.
- Store copies of ID documents or face scans on its own servers.
- Scrape job sites that forbid it. Listings come only from official APIs or partner feeds.
## Success criteria
After launch, over the first three months: 1. 40% of new users finish their profile and save or apply to a job in their first session. 2. 25% of jobs shown get opened, saved or applied to instead of dismissed. 3. 20% of active users report an interview within 60 days. 4. 50% of rejections are logged with a stage. 5. Zero published reviews from people who never worked at the company.
Acceptance tests for the prototype: 1. A new user builds a profile and saves a matching job in under 2 minutes without help. 2. A user logs a rejection and sees the summary update. 3. A user who has not verified taps “Write a review” and is sent to Verify, not the Review Page.
## KYC policy
Every rule here is a requirement. The app must not let a user past a step until it is met.
Who verifies: - Sign up, CV profile, feed, tracker, rejection tracker, quick apply, alerts: verified email and phone, date of birth 18+. - “Verified” badge for seekers: full KYC. - Publish a review: full KYC plus proof of work for that employer. - Under 18 cannot create an account. If KYC shows a different date of birth, the review is blocked and the account flagged for manual review.
Full KYC steps: 1. Consent. Plain-language screen: the face scan is biometric data; ask for explicit consent; offer the non-biometric route on the same screen. 2. Document capture. Live in-app camera only, no gallery uploads or screenshots. Front and back of passport, national ID or residence card. Check security features, machine-readable zone, expiry, editing, all four corners visible, no blur or glare. On failure, say exactly why and allow a retake. 3. Liveness and face match. Short selfie video. Confirm it is a live person, not a photo, screen or mask, and match the face to the ID photo. 4. Data checks. Name and date of birth match the account; user is 18+; document not used on another account. 5. Result. Pass, fail with a reason, or manual review. Three attempts per 24 hours.
Non-biometric alternative: verify with a recognised electronic ID instead, such as an FNMT digital certificate or the electronic DNI.
What the app stores: verification status, date, provider reference, over-18 flag, name-match flag. Nothing else. The KYC provider holds document images and face data.
Proof of work: - Accepted: contract, payslip, employment or internship certificate, university internship agreement, reference letter, or a confirmed work email at the company’s domain. - Name must match the verified identity, company must match the review, dates must cover the role. - Ask users to black out salary and ID numbers before upload; provide a redaction tool. - A moderator checks proof before the review goes live. No valid proof, no review. - Delete proof files within 30 days of the decision and immediately on account deletion.
ID and proof files: encrypted in transit and at rest; only the verification process and named moderators can open them; never shown to other users, employers or in reviews.
## Security requirements
- Database access: Row Level Security on every table; users can only read and write their own rows.
- Authorisation: check on the server, on every request, that the user owns what they ask for. Never trust an ID sent from the browser.
- Input: validate all input server-side; sanitise user input; parameterised queries; escape output against XSS.
- Authentication: hashed passwords (bcrypt or argon2); sessions expire after inactivity; CSRF protection on state-changing requests; two-factor login for moderators and admins.
- Secrets: no API keys in code or the browser; database service key server-only; secrets in environment variables; rotate after any suspected leak.
- Abuse: rate limits on login, sign-up, search, apply, review and KYC endpoints; bot checks on sign-up and review submission.
- File upload (CV, proof of work): allowed types and size limits; malware scan; private storage with short-lived signed links; rename files on save.
- Network: HTTPS everywhere; security headers (CSP, HSTS, X-Frame-Options); strict CORS.
- AI features: treat uploaded CVs, questionnaire answers and job descriptions as untrusted input, since a CV can hide instructions to the AI; delete the uploaded CV file once its answers are saved; model output never runs code or changes permissions; send the model only the data it needs.
- Logging: log security events without personal data; show generic error messages, never stack traces.
- Dependencies: scan for known vulnerabilities before each release.
- Breaches: notify affected users and the AEPD within 72 hours.
- Flag any security risk you see instead of silently working around it.
- Before every publish, audit the app against this list and report what fails.
## Legal requirements
- EU AI Act: CV-based job ranking is high-risk. Show a reason on every ranked job, log how rankings are made, allow human review, test for bias, remove protected traits before ranking.
- GDPR: plain privacy notice; tell users the feed is ranked by AI and offer a newest-first feed; explicit consent for biometric data; self-service data export and account deletion; data hosted in the EU; AI provider set not to train on user data.
- ID copies: never stored; only the verification result.
- Digital Services Act: report link on every review; give reasons when a review is removed; clear moderation rules in the terms.
- Defamation: reviews may not name individual managers or colleagues; moderation removes personal attacks.
- Reviews: one per verified person per job; explain publicly how reviews are verified.
- Job listings: official APIs and partner feeds only; each listing links to its source.
- Cookies: consent banner, reject as easy as accept.
- Age: 18+ in the terms; date of birth at sign-up, confirmed by KYC.
## Build order
- Apply the security requirements for database access, authorisation and secrets from the start.
- Welcome, Info and CV screens; then Top Match, Job Offers and Soulmates with about 10 sample listings, each with its reason, stars and review count; then Tracker with the rejection form and summary.
- Review Page and Verify, with posting blocked until KYC and proof of work pass. If no KYC provider is connected, the prototype uses an AI image check instead: the AI looks at the photo and rejects it unless it is clearly an ID document (passport, national ID or residence card) with all four corners visible, readable text and no blur or glare; it reads the date of birth and rejects the user if it does not match the account or shows under 18; it tells the user exactly why a photo failed. A photo of a random object, a screenshot or a blank card must fail. Label the screen “Prototype check: a certified KYC provider replaces this at launch”. For testing, use a sample ID image, never a real person’s ID.
- Quick apply, job alerts and live listing APIs come later.
Sample data: use made-up company names, made-up job titles and made-up reviews, marked as sample data. Never put invented reviews on real companies.
