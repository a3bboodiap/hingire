import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TrackerBoard, type TrackerItem } from "@/components/tracker-board";

export const metadata = { title: "Tracker" };
export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { supabase, user } = session;

  const [appsRes, rejRes] = await Promise.all([
    supabase.from("applications")
      .select("id, stage, applied_at, external_title, external_company, jobs(title, companies(name))")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("rejections").select("application_id").eq("user_id", user.id),
  ]);

  const withRejection = new Set((rejRes.data ?? []).map((r) => r.application_id));

  const items: TrackerItem[] = (appsRes.data ?? []).map((a) => {
    const job = a.jobs as unknown as
      { title: string; companies: { name: string } | null } | null;
    return {
      id: a.id,
      stage: a.stage,
      title: job?.title ?? a.external_title ?? "Untitled",
      company: job?.companies?.name ?? a.external_company ?? "Unknown",
      applied_at: a.applied_at,
      hasRejection: withRejection.has(a.id),
    };
  });

  return (
    <>
      <div className="px-4 pt-5">
        <h1 className="title-hand text-[2.6rem] leading-none">Tracker</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Everything you saved or applied to, by stage.
        </p>
      </div>
      <div className="mt-4">
        <TrackerBoard items={items} />
      </div>
    </>
  );
}
