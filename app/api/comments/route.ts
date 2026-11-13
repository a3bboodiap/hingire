import { withUser } from "@/lib/route-helpers";
import { commentSchema } from "@/lib/validation";
import { parseBody, ok, fail } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, commentSchema);
  if (!parsed.ok) return parsed.response;

  return withUser("report", async ({ user, supabase }) => {
    const { error } = await supabase.from("job_comments").insert({
      user_id: user.id, job_id: parsed.data.job_id, body: parsed.data.body,
    } as never);
    if (error) return fail(500, "Could not post that comment.");
    return ok({ posted: true });
  });
}
