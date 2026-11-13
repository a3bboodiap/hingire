"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice } from "@/components/ui";

type Props = {
  email: string;
  initial: {
    first_name: string; last_name: string; location: string; phone: string;
  };
  phoneVerified: boolean;
};

/** Screen 2 — Info. Plain, calm tone: this is sign-up, not a browsing screen. */
export function InfoForm({ email, initial, phoneVerified }: Props) {
  const router = useRouter();
  const [f, setF] = useState({ ...initial, date_of_birth: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [ageBlocked, setAgeBlocked] = useState(false);

  // phone confirmation
  const [verified, setVerified] = useState(phoneVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [protoCode, setProtoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function sendCode() {
    setPhoneMsg(null);
    const res = await fetch("/api/auth/phone/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: f.phone }),
    });
    const j = await res.json();
    if (!res.ok) { setPhoneMsg(j.error ?? "Could not send the code."); return; }
    setCodeSent(true);
    setProtoCode(j.data?.code ?? null);
  }

  async function verifyCode() {
    const res = await fetch("/api/auth/phone/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const j = await res.json();
    if (!res.ok) { setPhoneMsg(j.error ?? "That code is not right."); return; }
    setVerified(true);
    setPhoneMsg(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setFields({}); setAgeBlocked(false);
    try {
      const res = await fetch("/api/profile/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.error ?? "Could not save.");
        setFields(j.fields ?? {});
        setAgeBlocked(Boolean(j.ageBlocked));
      } else {
        router.push("/cv");
        router.refresh();
      }
    } catch {
      setError("No connection. Check your internet and try again.");
    } finally { setBusy(false); }
  }

  if (ageBlocked) {
    return (
      <Notice tone="danger" title="You need to be 18 or over">
        <p>Hingire is an 18+ service, so we cannot create an account for you.</p>
        <form action="/api/auth/signout" method="post" className="mt-3">
          <button className="ink-btn bg-white px-4 py-2 text-sm">Close</button>
        </form>
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" hint="Confirmed already — this is the address you signed in with.">
        <input className="ink-input bg-cream-deep" value={email} disabled readOnly />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={fields.first_name}>
          <input className="ink-input" required autoComplete="given-name"
            value={f.first_name} onChange={set("first_name")} />
        </Field>
        <Field label="Last name" error={fields.last_name}>
          <input className="ink-input" required autoComplete="family-name"
            value={f.last_name} onChange={set("last_name")} />
        </Field>
      </div>

      <Field label="Where you live" hint="City or town." error={fields.location}>
        <input className="ink-input" required autoComplete="address-level2"
          value={f.location} onChange={set("location")} placeholder="Madrid" />
      </Field>

      <Field label="Phone" error={fields.phone}>
        <input className="ink-input" required type="tel" autoComplete="tel"
          value={f.phone} onChange={set("phone")} placeholder="+34 600 000 000" />
      </Field>

      {/* Phone confirmation */}
      {verified ? (
        <Notice tone="money">Phone confirmed.</Notice>
      ) : (
        <div className="rounded-xl border-2 border-ink-faint bg-cream-deep p-3">
          {!codeSent ? (
            <button type="button" onClick={sendCode} disabled={f.phone.length < 6}
              className="ink-btn w-full bg-white px-3 py-2 text-sm">
              Send me a code by SMS
            </button>
          ) : (
            <div className="space-y-2">
              {protoCode ? (
                <Notice tone="gold" title="Prototype: no SMS provider connected">
                  Your code is <strong className="font-mono text-base">{protoCode}</strong>.
                  With a provider configured this is texted to you instead.
                </Notice>
              ) : null}
              <div className="flex gap-2">
                <input className="ink-input text-center tracking-[0.3em]" inputMode="numeric"
                  maxLength={6} value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                <button type="button" onClick={verifyCode} disabled={code.length !== 6}
                  className="ink-btn shrink-0 bg-white px-3 py-2 text-sm">Confirm</button>
              </div>
            </div>
          )}
          {phoneMsg ? <p className="mt-2 text-xs font-medium text-danger">{phoneMsg}</p> : null}
        </div>
      )}

      <Field label="Date of birth" hint="Used only to check you are 18 or over. It never affects which jobs you see."
             error={fields.date_of_birth}>
        <input className="ink-input" required type="date" autoComplete="bday"
          max={new Date().toISOString().slice(0, 10)}
          value={f.date_of_birth} onChange={set("date_of_birth")} />
      </Field>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button tone="money" full disabled={busy || !verified}>
        {busy ? "Saving…" : "Continue"}
      </Button>
      {!verified ? (
        <p className="text-center text-xs text-ink-soft">Confirm your phone to continue.</p>
      ) : null}
    </form>
  );
}
