import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadCv } from "@/lib/cv-store";
import { CvWizard } from "@/components/cv-wizard";

export const metadata = { title: "Your CV" };

export default async function CvPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await loadCv(session.supabase, session.user.id);

  return (
    <main className="min-h-dvh px-5 pb-10 pt-6">
      <h1 className="title-hand text-3xl">Your CV</h1>
      <p className="mt-0.5 text-sm text-ink-soft">
        Six quick steps. We use these to find jobs that actually fit.
      </p>
      <div className="mt-4">
        <CvWizard initial={data as never} />
      </div>
    </main>
  );
}
