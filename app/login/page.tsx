import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Notice } from "@/components/ui";
import { supabaseConfigured } from "@/lib/env";
import { DEMO } from "@/lib/demo";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
  // No database: there is nothing to sign in to, so go straight to the app.
  if (DEMO) redirect("/top-match");

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-10 pt-8">
      <Link href="/" className="text-sm underline text-ink-soft">
        ← Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-ink-soft">
        We will email you a 6-digit code.
      </p>

      <div className="mt-6">
        {supabaseConfigured ? (
          <AuthForm mode="login" />
        ) : (
          <Notice tone="gold" title="Not connected yet">
            Log-in is off until the Supabase keys are set — in{" "}
            <code className="font-mono">.env.local</code> locally, or in the
            host’s environment variables when deployed. See{" "}
            <code className="font-mono">SETUP.md</code>.
          </Notice>
        )}
      </div>

      <p className="mt-auto pt-8 text-center text-sm">
        No account yet?{" "}
        <Link href="/signup" className="font-semibold underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
