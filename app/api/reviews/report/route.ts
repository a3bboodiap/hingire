import { withUser } from "@/lib/route-helpers";
import { reportSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, reportSchema);
  if (!parsed.ok) return parsed.response;

  return withUser("report", async ({ user, supabase }) => {
    const { error } = await supabase.from("review_reports").insert({
      review_id: parsed.data.review_id,
      reporter_id: user.id,
      reason: parsed.data.reason,
    } as never);
    if (error) return fail(500, "Could not send that report.");
    await audit("review_reported", user.id, {});
    return ok({ reported: true });
  });
}
