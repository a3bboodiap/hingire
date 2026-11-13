import { withUser } from "@/lib/route-helpers";
import { ok } from "@/lib/http";
import { summariseRejections } from "@/lib/ai/tasks";

export const runtime = "nodejs";

export async function GET() {
  return withUser("ai", async ({ user, supabase }) => {
    const { data } = await supabase.rpc("rejection_stats", { p_user: user.id });
    const s = (data ?? {}) as {
      total?: number; by_stage?: Record<string, number>;
      role_types?: { title: string; n: number }[]; skills?: { name: string; n: number }[];
    };

    const result = await summariseRejections({
      total: s.total ?? 0,
      byStage: s.by_stage ?? {},
      roleTypes: s.role_types ?? [],
      skills: s.skills ?? [],
    });

    return ok({ ...result.data, engine: result.engine, total: s.total ?? 0 });
  });
}
