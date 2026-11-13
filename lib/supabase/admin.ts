import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Service-role client. BYPASSES Row Level Security.
 *
 * Rules for using this:
 *   1. Never import this file from a client component. The "server-only"
 *      import above turns that into a build error.
 *   2. Every call made through it must be preceded by an explicit ownership
 *      check on the server. Never pass a browser-supplied id straight into a
 *      query made with this client.
 *   3. Use `createSupabaseServerClient()` instead whenever RLS alone is enough.
 *
 * It exists for the handful of jobs the user legitimately cannot do as
 * themselves: writing ranking results, OTP codes, rate-limit counters, audit
 * rows, KYC outcomes and moderation state.
 */
let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Service role client unavailable: set SUPABASE_SERVICE_ROLE_KEY (server-only).",
    );
  }
  if (cached) return cached;

  cached = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}

/** True when the server has the service-role key available. */
export function adminConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
