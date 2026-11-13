import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/env";
import { SwipeSlider } from "@/components/swipe-slider";
import { MoneyRain } from "@/components/money-rain";
import { Notice } from "@/components/ui";
import { DEMO } from "@/lib/demo";

/**
 * Screen 1 — Welcome.
 * First thing a new user sees. A returning, fully signed-up user goes
 * straight to Top Match instead.
 */
export default async function WelcomePage() {
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      redirect(session.profile.onboarding_step === "done" ? "/top-match" : "/info");
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-8 pt-10">
      {!supabaseConfigured ? (
        <div className="mb-4">
          <Notice tone="gold" title="Demo mode">
            No database is connected, so the app is running on built-in sample
            data. Every screen works; nothing is saved between restarts.
          </Notice>
        </div>
      ) : null}

      <div className="relative flex flex-1 flex-col items-center justify-center text-center">
        <MoneyRain />
        <p className="title-hand text-2xl text-ink-soft">Hingire</p>
        <h1 className="title-hand mt-2 text-[3.6rem] leading-[0.95]">
          Get that
          <br />
          Bling Bling
        </h1>
        <p className="mt-5 max-w-[17rem] text-sm text-ink-soft">
          Internships and first jobs, ranked for you — with honest reviews from
          people who actually did them.
        </p>
      </div>

      <div className="space-y-4">
        <SwipeSlider href={DEMO ? "/top-match" : "/signup"} label="Swipe" />
        <p className="text-center text-sm">
          {DEMO ? (
            <Link href="/top-match" className="font-semibold underline">
              Skip into the app
            </Link>
          ) : (
            <>
              Already with us?{" "}
              <Link href="/login" className="font-semibold underline">Log in</Link>
            </>
          )}
        </p>
        <p className="text-center text-xs text-ink-faint">
          18+ only. By continuing you agree to our{" "}
          <Link href="/legal/terms" className="underline">terms</Link> and{" "}
          <Link href="/legal/privacy" className="underline">privacy notice</Link>.
        </p>
      </div>
    </main>
  );
}
