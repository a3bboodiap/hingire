"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice } from "@/components/ui";

const CONTRACTS = [
  ["internship", "Internship"], ["part_time", "Part-time"], ["full_time", "Full-time"],
] as const;

const RATINGS = [
  ["overall", "Overall"], ["pay_fairness", "Pay fairness"], ["workload", "Workload"],
  ["learning", "Learning"], ["management", "Management"],
] as const;

export function ReviewForm({ jobId, job }: {
  jobId: string;
  job: { title: string; company: string; location: string; contract_type: string };
}) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, unknown>>({
    job_title: job.title, job_description: "", job_location: job.location,
    contract_type: job.contract_type, months_worked: 6,
    overall: 0, pay_fairness: 0, workload: 0, learning: 0, management: 0,
    would_recommend: null, comment: "",
  });
  const [proof, setProof] = useState<{ path: string; engine: string } | null>(null);
  const [proofMsg, setProofMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (k: string, v: unknown) => setF({ ...f, [k]: v });

  async function uploadProof(file: File) {
    setBusy(true); setError(null); setProofMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("company", job.company);
    fd.append("months_worked", String(f.months_worked));
    const res = await fetch("/api/reviews/proof", { method: "POST", body: fd });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "Could not upload."); return; }
    setProof({ path: j.data.path, engine: j.data.engine });
    const bits: string[] = [];
    bits.push(j.data.company_name_found ? "company name found" : "company name NOT found");
    bits.push(j.data.person_name_found ? "your name found" : "your name NOT found");
    bits.push(j.data.dates_found ? "dates found" : "no dates found");
    setProofMsg(`Pre-check: ${bits.join(", ")}. A moderator makes the final decision.`);
  }

  async function submit() {
    setBusy(true); setError(null);
    const res = await fetch("/api/reviews/submit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, job_id: jobId, proof_path: proof?.path }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setError(j.error ?? "Could not submit."); return; }
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <Notice tone="money" title="Thanks, your review is being checked">
        <p>
          It stays hidden until a moderator approves it. We check your proof of
          work against the company and dates you gave.
        </p>
      </Notice>
    );
  }

  const complete =
    RATINGS.every(([k]) => Number(f[k]) > 0) &&
    f.would_recommend !== null &&
    String(f.comment).trim().length >= 20 &&
    String(f.job_description).trim().length >= 10 &&
    proof !== null;

  return (
    <div className="space-y-5">
      {/* Header of five large gold stars */}
      <div className="text-center">
        <div className="text-5xl tracking-[0.1em] text-gold" aria-hidden>★★★★★</div>
      </div>

      <Field label="Job name">
        <input className="ink-input" value={f.job_title as string}
          onChange={(e) => set("job_title", e.target.value)} />
      </Field>

      <Field label="Job description" hint="What did you actually do?">
        <textarea className="ink-input" rows={3} value={f.job_description as string}
          onChange={(e) => set("job_description", e.target.value)} />
      </Field>

      <Field label="Job location">
        <input className="ink-input" value={f.job_location as string}
          onChange={(e) => set("job_location", e.target.value)} />
      </Field>

      <Field label="Contract type">
        <select className="ink-input" value={f.contract_type as string}
          onChange={(e) => set("contract_type", e.target.value)}>
          {CONTRACTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </Field>

      <Field label="Months worked">
        <input className="ink-input" inputMode="numeric" value={String(f.months_worked)}
          onChange={(e) => set("months_worked", Number(e.target.value.replace(/\D/g, "")) || 0)} />
      </Field>

      {/* Proof of work */}
      <div className="ink-card-flat p-4">
        <p className="font-bold">Proof of work</p>
        <p className="mt-1 text-sm text-ink-soft">
          A contract, payslip, certificate, internship agreement or reference letter.
        </p>
        <Notice tone="gold" title="Black out your salary and ID numbers">
          Cover them before you upload. We only need your name, the company and
          the dates.
        </Notice>
        <label className="mt-3 inline-block cursor-pointer text-sm underline">
          {proof ? "Replace the file" : "Choose a file"}
          <input type="file" className="sr-only" accept=".pdf,.docx,.jpg,.jpeg,.png"
            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadProof(file); }} />
        </label>
        <p className="mt-1 text-xs text-ink-faint">PDF, DOCX, JPG or PNG. Up to 5 MB.</p>
        {proof ? <p className="mt-2 text-sm text-money">File uploaded.</p> : null}
        {proofMsg ? <p className="mt-1 text-xs text-ink-soft">{proofMsg}</p> : null}
      </div>

      {/* Tap to rate */}
      <div>
        <p className="font-bold">Tap to rate</p>
        <div className="mt-2 space-y-2">
          {RATINGS.map(([k, label]) => (
            <div key={k} className="flex items-center justify-between gap-3">
              <span className="text-sm">{label}</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-label={`${label}: ${n} of 5`}
                    onClick={() => set(k, n)}
                    className={`text-2xl leading-none ${Number(f[k]) >= n ? "text-gold" : "text-ink-faint"}`}>
                    ★
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="font-bold">Would you recommend it?</p>
        <div className="mt-2 flex gap-3">
          <Button tone={f.would_recommend === true ? "money" : "ink"} className="flex-1"
            onClick={() => set("would_recommend", true)}>Yes</Button>
          <Button tone={f.would_recommend === false ? "danger" : "ink"} className="flex-1"
            onClick={() => set("would_recommend", false)}>No</Button>
        </div>
      </div>

      <Field label="Your review" hint="Do not name individual managers or colleagues.">
        <textarea className="ink-input" rows={6} placeholder="Leave comment…"
          value={f.comment as string} maxLength={4000}
          onChange={(e) => set("comment", e.target.value)} />
      </Field>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Button tone="money" full disabled={busy || !complete} onClick={submit}>
        {busy ? "Submitting…" : "Submit review"}
      </Button>
      {!complete ? (
        <p className="text-center text-xs text-ink-soft">
          Rate every category, answer the recommend question, write at least a
          couple of sentences, and upload your proof.
        </p>
      ) : null}
    </div>
  );
}
