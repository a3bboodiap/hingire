import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { Notice } from "@/components/ui";
import { supabaseConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage() {
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
            Add your Supabase keys to <code className="font-mono">.env.local</code>.
            See <code className="font-mono">SETUP.md</code>.
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
