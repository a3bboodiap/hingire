import { withUser } from "@/lib/route-helpers";
import { ok } from "@/lib/http";
import { summariseRejections } from "@/lib/ai/tasks";
import { DEMO } from "@/lib/demo";

export const runtime = "nodejs";

export async function GET() {
  if (DEMO) {
    const { demoState } = await import("@/lib/demo");
    const byStage: Record<string, number> = {};
    for (const r of demoState.rejections) byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
    const titles: Record<string, number> = {};
    for (const r of demoState.rejections) {
      const a = demoState.applications.find((x) => x.id === r.application_id);
      if (a) titles[a.title] = (titles[a.title] ?? 0) + 1;
    }
    const result = await summariseRejections({
      total: demoState.rejections.length,
      byStage,
      roleTypes: Object.entries(titles).map(([title, n]) => ({ title, n })),
      skills: [{ name: "Excel", n: 2 }, { name: "Customer service", n: 2 }],
    });
    return ok({ ...result.data, engine: result.engine, total: demoState.rejections.length });
  }

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
