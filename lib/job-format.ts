/** Shared, client-safe job types and formatters. No server imports here. */

export type FeedJob = {
  id: string; title: string; company: string; location: string;
  pay_min: number | null; pay_max: number | null; currency: string;
  contract_type: string; work_mode: string; description: string;
  source_name: string; source_url: string; posted_at: string;
  score: number; reason: string; engine: string;
  avg_rating: number; review_count: number;
  saved: boolean;
};

export function payLabel(j: Pick<FeedJob, "pay_min" | "pay_max" | "currency">) {
  if (j.pay_min == null && j.pay_max == null) return "Pay not stated";
  const sym = j.currency === "EUR" ? "€" : "";
  if (j.pay_min != null && j.pay_max != null) {
    return `${sym}${j.pay_min}–${sym}${j.pay_max}/mo`;
  }
  return `${sym}${j.pay_min ?? j.pay_max}/mo`;
}

export const CONTRACT_LABEL: Record<string, string> = {
  internship: "Internship", part_time: "Part-time", full_time: "Full-time",
};
export const MODE_LABEL: Record<string, string> = {
  remote: "Remote", hybrid: "Hybrid", on_site: "On-site",
};
