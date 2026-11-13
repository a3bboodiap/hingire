import Link from "next/link";
import { Notice } from "@/components/ui";

export const metadata = { title: "Your CV" };

export default function CvPage() {
  return (
    <main className="min-h-dvh px-5 pb-10 pt-8">
      <h1 className="text-2xl font-bold">Your CV</h1>
      <p className="mt-1 text-sm text-ink-soft">Step 3 of sign-up.</p>
      <div className="mt-6">
        <Notice tone="gold" title="Screen not built yet">
          The six-step questionnaire and the “Skip: upload my CV instead”
          option are the next thing to build. The CV reader behind them is
          already written and working.
        </Notice>
      </div>
      <Link href="/" className="mt-6 inline-block text-sm underline text-ink-soft">
        Back to Welcome
      </Link>
    </main>
  );
}
