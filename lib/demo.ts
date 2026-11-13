import type { FeedJob } from "@/lib/job-format";

/**
 * DEMO MODE.
 *
 * Active only when Supabase is not configured. It lets every screen render
 * from the same invented sample data the seed migration uses, so the app can
 * be shown end to end with no database and no accounts.
 *
 * State lives in module memory: it survives navigation within one server
 * process and resets on restart. Nothing here is persisted, and none of it
 * runs when real Supabase keys are present.
 */
export const DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const demoProfile = {
  id: "demo-user",
  email: "you@example.com",
  first_name: "Alex",
  last_name: "Moreno",
  location: "Madrid",
  phone: "+34600000000",
  date_of_birth: "2003-04-12",
  email_verified: true,
  phone_verified: true,
  is_adult: true,
  kyc_status: "none" as const,
  kyc_verified_at: null,
  kyc_over_18: null,
  kyc_name_match: null,
  flagged_for_review: false,
  feed_sort: "ai_rank" as const,
  onboarding_step: "done",
};

type Raw = {
  title: string; company: string; location: string;
  pay_min: number; pay_max: number; contract_type: string; work_mode: string;
  description: string; score: number; reason: string;
  avg_rating: number; review_count: number; days: number;
};

const RAW: Raw[] = [
  { title: "Junior Data Analyst", company: "Verdabyte", location: "Barcelona",
    pay_min: 1600, pay_max: 2000, contract_type: "full_time", work_mode: "hybrid",
    description: "Clean and analyse product usage data, build dashboards and answer questions from the product team. SQL is used daily; Python is a bonus. Structured onboarding over the first month.",
    score: 92, reason: "Matches your Excel and SQL, and you asked for analyst roles.",
    avg_rating: 4.5, review_count: 2, days: 5 },
  { title: "Marketing Intern", company: "Lumen & Pike", location: "Madrid",
    pay_min: 900, pay_max: 1100, contract_type: "internship", work_mode: "hybrid",
    description: "Support the marketing team with social posts, a weekly newsletter and simple campaign reports. You will own the content calendar with help from your mentor.",
    score: 88, reason: "Matches your Social Media and Spanish, and it is in Madrid.",
    avg_rating: 3.5, review_count: 2, days: 2 },
  { title: "Research Assistant (Part-time)", company: "Kestrel Analytics", location: "Madrid",
    pay_min: 800, pay_max: 1000, contract_type: "part_time", work_mode: "hybrid",
    description: "Help a small research team gather and tidy data for client reports. Flexible hours around study, 20 hours a week.",
    score: 81, reason: "Matches your Excel and Research, and it is in Madrid.",
    avg_rating: 5.0, review_count: 1, days: 11 },
  { title: "Junior Software Engineer", company: "Arcadia Health Tech", location: "Barcelona",
    pay_min: 1900, pay_max: 2400, contract_type: "full_time", work_mode: "hybrid",
    description: "Build features in a TypeScript and React codebase for a clinic scheduling product. Pair programming twice a week, code review on everything. Graduates welcome.",
    score: 76, reason: "Matches your SQL and English.",
    avg_rating: 4.5, review_count: 2, days: 6 },
  { title: "Operations Assistant", company: "Olivetree Logistics", location: "Valencia",
    pay_min: 1300, pay_max: 1500, contract_type: "full_time", work_mode: "on_site",
    description: "Keep shipments moving: track deliveries, update the system, and sort out problems with carriers over phone and email.",
    score: 70, reason: "Matches your Excel and Customer Service.",
    avg_rating: 3.5, review_count: 2, days: 1 },
  { title: "Content Writing Intern", company: "Papersun Media", location: "Seville",
    pay_min: 700, pay_max: 900, contract_type: "internship", work_mode: "hybrid",
    description: "Write short articles and social copy for lifestyle brands. You get a style guide, an editor and real bylines.",
    score: 64, reason: "Matches your Copywriting and Spanish.",
    avg_rating: 3.0, review_count: 2, days: 3 },
  { title: "Junior UI Designer", company: "Northwind Studio", location: "Remote",
    pay_min: 1400, pay_max: 1800, contract_type: "full_time", work_mode: "remote",
    description: "Work on screens for client apps under an art director. Figma all day, with a weekly critique. Portfolio matters more than years of experience.",
    score: 58, reason: "Remote, and open to people early in their career.",
    avg_rating: 4.0, review_count: 1, days: 8 },
  { title: "Sales Assistant", company: "Marigold Retail Co", location: "Zaragoza",
    pay_min: 1200, pay_max: 1400, contract_type: "full_time", work_mode: "on_site",
    description: "Help customers find what they need, keep the shop floor tidy and handle the till. Good first job: structured training and a supportive store manager.",
    score: 52, reason: "Matches your Customer Service and Spanish.",
    avg_rating: 3.0, review_count: 2, days: 7 },
  { title: "Front of House Team Member", company: "Bluefig Hospitality", location: "Malaga",
    pay_min: 1100, pay_max: 1300, contract_type: "part_time", work_mode: "on_site",
    description: "Greet guests, take orders and keep the floor running during service. Training provided, including barista basics.",
    score: 45, reason: "Matches your Customer Service and Teamwork.",
    avg_rating: 3.5, review_count: 2, days: 4 },
  { title: "QA Tester Intern", company: "Tinderbox Games", location: "Remote",
    pay_min: 600, pay_max: 800, contract_type: "internship", work_mode: "remote",
    description: "Play builds, find bugs, write them up clearly and re-test fixes. You will sit with the dev team and see how a game gets finished.",
    score: 38, reason: "Remote, and open to people early in their career.",
    avg_rating: 3.0, review_count: 1, days: 9 },
];

export const demoJobs: FeedJob[] = RAW.map((r, i) => ({
  id: `demo-${i + 1}`,
  title: r.title, company: r.company, location: r.location,
  pay_min: r.pay_min, pay_max: r.pay_max, currency: "EUR",
  contract_type: r.contract_type, work_mode: r.work_mode,
  description: r.description,
  source_name: "Sample data",
  source_url: `https://example.invalid/jobs/${r.company.toLowerCase().replace(/\W+/g, "-")}`,
  posted_at: new Date(Date.now() - r.days * 86400_000).toISOString(),
  score: r.score, reason: r.reason, engine: "offline",
  avg_rating: r.avg_rating, review_count: r.review_count,
  saved: false,
}));

export type DemoReview = {
  id: string; job_id: string; overall: number; comment: string;
  contract_type: string; year_label: number; months_worked: number;
  would_recommend: boolean;
};

export const demoReviews: DemoReview[] = [
  { id: "r1", job_id: "demo-1", overall: 5, contract_type: "full_time", year_label: 2025, months_worked: 14, would_recommend: true,
    comment: "Best first job I could have asked for. Proper code review on SQL, a real onboarding plan, and my manager protected my time when other teams piled on requests. Pay was fair for a junior role in the city." },
  { id: "r2", job_id: "demo-1", overall: 4, contract_type: "full_time", year_label: 2024, months_worked: 9, would_recommend: true,
    comment: "Steady, well-organised team. Some weeks are repetitive data cleaning, which nobody pretends otherwise about. Flexible hybrid policy that was actually respected." },
  { id: "r3", job_id: "demo-2", overall: 4, contract_type: "internship", year_label: 2025, months_worked: 6, would_recommend: true,
    comment: "Genuinely learned a lot. I was given real work in week two rather than filing things. Pay is low for the hours, which is the main downside, but the mentoring was excellent." },
  { id: "r4", job_id: "demo-2", overall: 3, contract_type: "internship", year_label: 2024, months_worked: 4, would_recommend: true,
    comment: "Good people and a relaxed office. The internship pay barely covered transport and lunch. Work itself was varied and nobody treated me like free labour." },
  { id: "r5", job_id: "demo-3", overall: 5, contract_type: "part_time", year_label: 2025, months_worked: 10, would_recommend: true,
    comment: "Genuinely flexible around exams, which is rare. Work is detailed and quiet. If you like spreadsheets and being left alone to concentrate, it is ideal." },
  { id: "r6", job_id: "demo-5", overall: 3, contract_type: "full_time", year_label: 2025, months_worked: 11, would_recommend: false,
    comment: "Busy is an understatement. You learn the whole supply chain fast, but the phone does not stop and cover during holidays was thin." },
  { id: "r7", job_id: "demo-8", overall: 2, contract_type: "full_time", year_label: 2024, months_worked: 8, would_recommend: false,
    comment: "Understaffed most shifts, so you are covering two sections at once. Nothing malicious, just stretched thin. Would not go back." },
];

/* ---------------- mutable demo state (module memory) ---------------- */
export const demoState = {
  saved: new Set<string>(["demo-2"]),
  dismissed: new Set<string>(),
  applications: [
    { id: "a1", job_id: "demo-2", stage: "saved", title: "Marketing Intern", company: "Lumen & Pike", hasRejection: false },
    { id: "a2", job_id: "demo-4", stage: "applied", title: "Junior Software Engineer", company: "Arcadia Health Tech", hasRejection: false },
    { id: "a3", job_id: "demo-6", stage: "interview", title: "Content Writing Intern", company: "Papersun Media", hasRejection: false },
    { id: "a4", job_id: "demo-5", stage: "rejected", title: "Operations Assistant", company: "Olivetree Logistics", hasRejection: true },
    { id: "a5", job_id: "demo-8", stage: "rejected", title: "Sales Assistant", company: "Marigold Retail Co", hasRejection: true },
  ] as { id: string; job_id: string; stage: string; title: string; company: string; hasRejection: boolean }[],
  rejections: [
    { application_id: "a4", stage: "cv_screen" },
    { application_id: "a5", stage: "cv_screen" },
  ] as { application_id: string; stage: string }[],
  comments: [] as { id: string; job_id: string; body: string; created_at: string }[],
  kycPassed: false,
};

export function demoFeed(opts?: {
  includeDismissed?: boolean; sort?: "ai_rank" | "newest";
  filters?: { location?: string; minPay?: number; contract?: string[]; remote?: string[] };
}) {
  const f = opts?.filters ?? {};
  let rows = demoJobs
    .map((j) => ({ ...j, saved: demoState.saved.has(j.id) }))
    .filter((j) => opts?.includeDismissed || !demoState.dismissed.has(j.id))
    .filter((j) => !f.location || j.location.toLowerCase().includes(f.location.toLowerCase()))
    .filter((j) => f.minPay == null || (j.pay_min ?? 0) >= f.minPay)
    .filter((j) => !f.contract?.length || f.contract.includes(j.contract_type))
    .filter((j) => !f.remote?.length || f.remote.includes(j.work_mode));
  rows = opts?.sort === "newest"
    ? rows.sort((a, b) => +new Date(b.posted_at) - +new Date(a.posted_at))
    : rows.sort((a, b) => b.score - a.score);
  return rows;
}
