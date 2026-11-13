import { withUser } from "@/lib/route-helpers";
import { externalApplicationSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, externalApplicationSchema);
  if (!parsed.ok) return parsed.response;

  return withUser("apply", async ({ user, supabase }) => {
    const { data, error } = await supabase.from("applications").insert({
      user_id: user.id,
      external_title: parsed.data.external_title,
      external_company: parsed.data.external_company,
      stage: parsed.data.stage,
      applied_at: new Date().toISOString(),
    } as never).select("id").single();
    if (error) return fail(500, "Could not add that job.");
    return ok({ id: data.id });
  });
}
