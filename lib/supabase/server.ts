import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { PUBLIC_ENV } from "@/lib/env";
import type { Database } from "@/lib/database.types";

/**
 * Request-scoped Supabase client that carries the signed-in user's session.
 * Every query made through it is still subject to RLS — this is the client we
 * use for anything acting *as the user*.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(PUBLIC_ENV.supabaseUrl, PUBLIC_ENV.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: middleware refreshes the session
          // instead, so this is safe to ignore.
        }
      },
    },
  });
}
