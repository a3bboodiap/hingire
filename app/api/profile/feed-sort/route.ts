import { withUser } from "@/lib/route-helpers";
import { parseBody, ok, fail } from "@/lib/http";
import { z } from "zod";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseBody(request, z.object({
    feed_sort: z.enum(["ai_rank", "newest"]),
  }));
  if (!parsed.ok) return parsed.response;

  return withUser(null, async ({ user, supabase }) => {
    const { error } = await supabase
      .from("profiles").update({ feed_sort: parsed.data.feed_sort }).eq("id", user.id);
    if (error) return fail(500, "Could not change the order.");
    return ok({ feed_sort: parsed.data.feed_sort });
  });
}
