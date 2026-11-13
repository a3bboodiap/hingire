import "server-only";

import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

/**
 * Fixed-window counters in Postgres. Deliberately simple — the PRD asks for
 * rate limits on login, sign-up, search, apply, review and KYC, and a counter
 * table is enough for a prototype. Swap for a Redis/edge limiter at scale.
 */
export type Bucket =
  | "login"
  | "signup"
  | "otp"
  | "search"
  | "apply"
  | "review"
  | "kyc"
  | "ai"
  | "upload"
  | "report";

const LIMITS: Record<Bucket, { max: number; windowSec: number }> = {
  login:  { max: 8,  windowSec: 15 * 60 },
  signup: { max: 5,  windowSec: 60 * 60 },
  otp:    { max: 6,  windowSec: 15 * 60 },
  search: { max: 120, windowSec: 60 },
  apply:  { max: 40, windowSec: 60 * 60 },
  review: { max: 5,  windowSec: 24 * 60 * 60 },
  // KYC policy: three attempts per 24 hours.
  kyc:    { max: 3,  windowSec: 24 * 60 * 60 },
  ai:     { max: 60, windowSec: 60 * 60 },
  upload: { max: 20, windowSec: 60 * 60 },
  report: { max: 20, windowSec: 24 * 60 * 60 },
};

export type RateResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
};

/** Hash anonymous subjects (IP) so the table holds no raw personal data. */
export function anonSubject(ip: string | null) {
  const salt = process.env.RATE_LIMIT_SALT ?? "job-finder-dev-salt";
  return "ip:" + createHash("sha256").update(salt + (ip ?? "unknown")).digest("hex").slice(0, 32);
}

export function ipFrom(request: Request) {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0]!.trim() : request.headers.get("x-real-ip");
}

export async function checkRateLimit(
  subject: string,
  bucket: Bucket,
): Promise<RateResult> {
  const { max, windowSec } = LIMITS[bucket];

  // Fail closed only for the security-critical buckets; a missing service key
  // in local development should not silently remove the KYC attempt cap.
  if (!adminConfigured()) {
    const critical: Bucket[] = ["kyc", "review", "login", "otp"];
    return {
      allowed: !critical.includes(bucket),
      remaining: 0,
      retryAfterSec: windowSec,
    };
  }

  const admin = createAdminClient();
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSec * 1000)) * windowSec * 1000);

  const { data, error } = await admin.rpc("bump_rate_limit", {
    p_subject: subject,
    p_bucket: bucket,
    p_window_start: windowStart.toISOString(),
    p_max: max,
  });

  if (error) {
    console.error(`[rate-limit] ${bucket}: ${error.message}`);
    // Never let a limiter outage become an open door on critical buckets.
    const critical: Bucket[] = ["kyc", "review", "login", "otp"];
    return { allowed: !critical.includes(bucket), remaining: 0, retryAfterSec: 60 };
  }

  const count = (data as number) ?? 0;
  const retryAfterSec = Math.max(
    1,
    Math.ceil((windowStart.getTime() + windowSec * 1000 - now) / 1000),
  );

  return {
    allowed: count <= max,
    remaining: Math.max(0, max - count),
    retryAfterSec,
  };
}

/** How many attempts are left in the window, without consuming one. */
export async function peekRateLimit(subject: string, bucket: Bucket) {
  const { max, windowSec } = LIMITS[bucket];
  if (!adminConfigured()) return { used: 0, max };

  const admin = createAdminClient();
  const windowStart = new Date(
    Math.floor(Date.now() / (windowSec * 1000)) * windowSec * 1000,
  );
  const { data } = await admin
    .from("rate_limits")
    .select("count")
    .eq("subject", subject)
    .eq("bucket", bucket)
    .eq("window_start", windowStart.toISOString())
    .maybeSingle();

  return { used: data?.count ?? 0, max };
}
