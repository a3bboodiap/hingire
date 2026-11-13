import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { demoProfile } from "@/lib/demo";
import type { Session } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

/**
 * A Supabase stand-in used only in demo mode. Every query resolves to an
 * empty result rather than throwing, so a screen that has not been given
 * explicit demo data renders empty instead of crashing. Screens that matter
 * read from lib/demo.ts directly.
 */
function emptyResult() {
  return Promise.resolve({ data: null, error: null, count: 0 });
}

function chain(): Record<string, unknown> {
  const target = function () { return chain(); } as unknown as Record<string, unknown>;
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === "then") {
        // awaiting the chain yields an empty result
        return (res: (v: unknown) => void) =>
          emptyResult().then(res);
      }
      if (prop === "maybeSingle" || prop === "single") return () => emptyResult();
      return () => chain();
    },
    apply() { return chain(); },
  }) as unknown as Record<string, unknown>;
}

export const demoSupabase = {
  from: () => chain(),
  rpc: () => emptyResult(),
  storage: { from: () => ({ list: () => emptyResult(), upload: () => emptyResult(), remove: () => emptyResult() }) },
  auth: { getUser: () => Promise.resolve({ data: { user: null }, error: null }), signOut: () => Promise.resolve({ error: null }) },
} as unknown as SupabaseClient<Database>;

export function demoSession(): Session {
  return {
    user: { id: demoProfile.id, email: demoProfile.email } as User,
    profile: { ...demoProfile },
    supabase: demoSupabase,
  };
}
