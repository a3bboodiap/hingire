/**
 * Environment access.
 *
 * Anything exported from here that is NOT prefixed NEXT_PUBLIC_ must only ever
 * be read on the server. `lib/supabase/admin.ts` and `lib/ai/*` import
 * "server-only", which makes a client-component import of them a build error.
 */

export const PUBLIC_ENV = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/** True when the browser-safe Supabase config is present. */
export const supabaseConfigured =
  PUBLIC_ENV.supabaseUrl.length > 0 && PUBLIC_ENV.supabaseAnonKey.length > 0;

export function requirePublicEnv() {
  if (!supabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see SETUP.md).",
    );
  }
  return PUBLIC_ENV;
}
