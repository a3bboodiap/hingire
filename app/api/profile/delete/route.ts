import { withUser } from "@/lib/route-helpers";
import { parseBody, ok, fail } from "@/lib/http";
import { z } from "zod";
import { createAdminClient, adminConfigured } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * GDPR: self-service account deletion.
 * Storage objects go first (proof files must go immediately on deletion),
 * then the profile row cascades through every table, then the auth user.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, z.object({
    confirm: z.literal("DELETE"),
  }));
  if (!parsed.ok) {
    return fail(400, 'Type DELETE exactly to confirm.');
  }

  return withUser(null, async ({ user, supabase }) => {
    const userId = user.id;

    // 1. proof files
    try {
      const { data: files } = await supabase.storage.from("proofs").list(userId);
      if (files?.length) {
        await supabase.storage.from("proofs")
          .remove(files.map((f) => `${userId}/${f.name}`));
      }
      const { data: cvs } = await supabase.storage.from("cvs").list(userId);
      if (cvs?.length) {
        await supabase.storage.from("cvs").remove(cvs.map((f) => `${userId}/${f.name}`));
      }
    } catch { /* keep going: the rows still have to go */ }

    // 2. all database rows, via the cascade on profiles
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return fail(500, "Could not delete your account. Nothing was removed.");

    // 3. the auth user itself
    if (adminConfigured()) {
      await createAdminClient().auth.admin.deleteUser(userId);
    }

    await audit("account_deleted", null, {});
    await supabase.auth.signOut();
    return ok({ deleted: true });
  });
}
