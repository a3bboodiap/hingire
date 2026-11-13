"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice } from "@/components/ui";

/**
 * Email + one-time code. Two panes: ask for the address, then ask for the
 * code. Tone here is plain and calm — this is the sign-up flow, not a
 * browsing screen.
 */
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [stage, setStage] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not send the code.");
      } else {
        setNote(json.data?.message ?? null);
        setStage("code");
      }
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "That code did not work.");
      } else {
        router.push(json.data.next);
        router.refresh();
      }
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "email") {
    return (
      <form onSubmit={send} className="space-y-4">
        <Field label="Email address">
          <input
            className="ink-input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button tone="money" full disabled={busy || email.length < 3}>
          {busy ? "Sending…" : "Send me a code"}
        </Button>
        <p className="text-xs text-ink-soft">
          We send a 6-digit code instead of using a password.
        </p>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      {note ? <Notice>{note}</Notice> : null}
      <Field label="6-digit code" hint={`Sent to ${email}`}>
        <input
          className="ink-input text-center text-2xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Button tone="money" full disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : "Continue"}
      </Button>
      <button
        type="button"
        className="w-full text-sm underline text-ink-soft"
        onClick={() => {
          setStage("email");
          setCode("");
          setError(null);
        }}
      >
        Use a different address
      </button>
    </form>
  );
}
