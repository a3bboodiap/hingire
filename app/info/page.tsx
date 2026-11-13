import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { InfoForm } from "@/components/info-form";

export const metadata = { title: "Your details" };

export default async function InfoPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const p = session.profile;

  return (
    <main className="min-h-dvh px-5 pb-12 pt-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
        Step 1 of 2
      </p>
      <h1 className="mt-1 text-2xl font-bold">Your details</h1>
      <p className="mt-1 text-sm text-ink-soft">
        We need these to set up your account. You can change them later in Profile.
      </p>
      <div className="mt-6">
        <InfoForm
          email={p.email}
          phoneVerified={p.phone_verified}
          initial={{
            first_name: p.first_name ?? "",
            last_name: p.last_name ?? "",
            location: p.location ?? "",
            phone: p.phone ?? "",
          }}
        />
      </div>
    </main>
  );
}
