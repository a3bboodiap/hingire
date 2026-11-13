"use client";

import { createBrowserClient } from "@supabase/ssr";
import { PUBLIC_ENV } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Browser client. Uses the anon key only — the anon key is designed to be
 * public and every table it can reach is gated by Row Level Security.
 */
export function createClient() {
  return createBrowserClient<Database>(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabaseAnonKey);
}
