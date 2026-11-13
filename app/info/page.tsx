import Link from "next/link";
import { Notice } from "@/components/ui";

export const metadata = { title: "Your details" };

export default function InfoPage() {
  return (
    <main className="min-h-dvh px-5 pb-10 pt-8">
      <h1 className="text-2xl font-bold">Your details</h1>
      <p className="mt-1 text-sm text-ink-soft">Step 2 of sign-up.</p>
      <div className="mt-6">
        <Notice tone="gold" title="Screen not built yet">
          The server side of this screen is finished and tested
          (<code className="font-mono">/api/profile/info</code>, with the 18+ gate
          and phone one-time code). The form itself is the next thing to build.
        </Notice>
      </div>
      <form action="/api/auth/signout" method="post" className="mt-6">
        <button className="ink-btn bg-white px-4 py-3 text-sm">Sign out</button>
      </form>
      <Link href="/" className="mt-4 inline-block text-sm underline text-ink-soft">
        Back to Welcome
      </Link>
    </main>
  );
}
