import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DEMO } from "@/lib/demo";

export type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  location: string | null;
  phone: string | null;
  date_of_birth: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  is_adult: boolean;
  kyc_status: "none" | "pending" | "passed" | "failed" | "manual_review";
  kyc_verified_at: string | null;
  kyc_over_18: boolean | null;
  kyc_name_match: boolean | null;
  flagged_for_review: boolean;
  feed_sort: "ai_rank" | "newest";
  onboarding_step: string;
};

export type Session = {
  user: User;
  profile: Profile;
  supabase: SupabaseClient<Database>;
};

/**
 * The single place a route handler establishes who is calling.
 *
 * getUser() asks Supabase to verify the JWT rather than decoding the cookie
 * locally, so a forged or stale cookie fails here.
 */
export async function getSession(): Promise<Session | null> {
  // Demo mode: no Supabase configured, so hand back a sample session so every
  // screen can be shown. Never reached once real keys are set.
  if (DEMO) {
    const { demoSession } = await import("@/lib/demo-session");
    return demoSession();
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return null;
  return { user, profile: profile as Profile, supabase };
}

/** Throws a typed sentinel the route turns into a 401. */
export class Unauthenticated extends Error {}
export class Forbidden extends Error {}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Unauthenticated();
  return session;
}

/** Gate for anything that publishes a review. */
export function canPublishReviews(profile: Profile) {
  return (
    profile.kyc_status === "passed" &&
    profile.is_adult &&
    !profile.flagged_for_review
  );
}

/** Age in whole years on a given date. */
export function ageOn(dob: string, on = new Date()): number {
  const birth = new Date(dob + "T00:00:00Z");
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const m = on.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export function isAdult(dob: string) {
  return ageOn(dob) >= 18;
}
