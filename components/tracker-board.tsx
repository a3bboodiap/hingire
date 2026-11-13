"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Notice, Pill } from "@/components/ui";

const STAGES = [
  ["saved", "Saved"], ["applied", "Applied"], ["interview", "Interview"],
  ["offer", "Offer"], ["rejected", "Rejected"],
] as const;

const REJECTION_STAGES = [
  ["cv_screen", "CV screen"], ["assessment", "Assessment"],
  ["interview", "Interview"], ["final_round", "Final round"],
] as const;

export type TrackerItem = {
  id: string; stage: string; title: string; company: string;
  applied_at: string | null; hasRejection: boolean;
};

export function TrackerBoard({ items }: { items: TrackerItem[] }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState<TrackerItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [summary, setSummary] = useState<{
    summary: string; engine: string; total: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/tracker/summary")
      .then((r) => r.json())
      .then((j) => { if (j.ok) setSummary(j.data); })
      .catch(() => {});
  }, [items.length]);

  async function setStage(item: TrackerItem, stage: string) {
    const res = await fetch("/api/tracker/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ application_id: item.id, stage }),
    });
    const j = await res.json();
    if (res.ok && j.data.needsRejectionForm && !item.hasRejection) {
      setRejecting({ ...item, stage });
    }
    router.refresh();
  }

  return (
    <div className="px-4 pb-6">
      {/* Rejection summary card, at the top */}
      {summary && summary.total > 0 ? (
        <div className="ink-card mb-4 p-4">
          <div className="flex items-center justify-between">
            <p className="title-hand text-xl">Rejection summary</p>
            <Pill>{summary.total} logged</Pill>
          </div>
          <p className="mt-2 text-sm">{summary.summary}</p>
          <p className="mt-2 text-[0.65rem] text-ink-faint">
            Patterns only. Private to you — never shown to employers or in reviews.
            {summary.engine === "offline" ? " Worked out from your own counts." : " Written by AI."}
          </p>
        </div>
      ) : null}

      {STAGES.map(([key, label]) => {
        const rows = items.filter((i) => i.stage === key);
        return (
          <section key={key} className="mb-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
              {label} <span className="text-ink-faint">({rows.length})</span>
            </h2>
            {rows.length === 0 ? (
              <p className="text-sm text-ink-faint">Nothing here.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((i) => (
                  <li key={i.id} className="ink-card-flat p-3">
                    <p className="font-semibold">{i.title}</p>
                    <p className="text-sm text-ink-soft">{i.company}</p>
                    <select
                      aria-label={`Stage for ${i.title}`}
                      className="mt-2 w-full rounded-lg border-2 border-ink bg-white px-2 py-1.5 text-sm"
                      value={i.stage}
                      onChange={(e) => setStage(i, e.target.value)}
                    >
                      {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    {i.stage === "rejected" && !i.hasRejection ? (
                      <button onClick={() => setRejecting(i)}
                        className="mt-2 text-xs underline text-danger">
                        Add rejection details
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <Button full onClick={() => setAdding(true)}>+ Add a job I applied to elsewhere</Button>

      {rejecting ? (
        <RejectionForm item={rejecting} onDone={() => { setRejecting(null); router.refresh(); }} />
      ) : null}
      {adding ? <ExternalForm onDone={() => { setAdding(false); router.refresh(); }} /> : null}
    </div>
  );
}

function RejectionForm({ item, onDone }: { item: TrackerItem; onDone: () => void }) {
  const [f, setF] = useState({
    rejected_on: new Date().toISOString().slice(0, 10),
    stage: "cv_screen", reason: "", note: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Sheet title="Log this rejection" onClose={onDone}>
      <p className="text-sm text-ink-soft">
        {item.title} at {item.company}
      </p>
      <div className="mt-3 space-y-3">
        <Field label="Date">
          <input className="ink-input" type="date" value={f.rejected_on}
            onChange={(e) => setF({ ...f, rejected_on: e.target.value })} />
        </Field>
        <Field label="Rejected at which stage?">
          <select className="ink-input" value={f.stage}
            onChange={(e) => setF({ ...f, stage: e.target.value })}>
            {REJECTION_STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field label="Reason, if they gave one" hint="Optional">
          <input className="ink-input" value={f.reason} maxLength={300}
            onChange={(e) => setF({ ...f, reason: e.target.value })} />
        </Field>
        <Field label="Your note" hint="Optional. Private to you.">
          <textarea className="ink-input" rows={3} value={f.note} maxLength={1000}
            onChange={(e) => setF({ ...f, note: e.target.value })} />
        </Field>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button tone="money" full disabled={busy}
          onClick={async () => {
            setBusy(true); setError(null);
            const res = await fetch("/api/tracker/rejection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                application_id: item.id, rejected_on: f.rejected_on, stage: f.stage,
                reason: f.reason || undefined, note: f.note || undefined,
              }),
            });
            setBusy(false);
            if (res.ok) onDone();
            else setError((await res.json()).error ?? "Could not save.");
          }}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </Sheet>
  );
}

function ExternalForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ external_title: "", external_company: "", stage: "applied" });
  const [busy, setBusy] = useState(false);
  return (
    <Sheet title="Add a job" onClose={onDone}>
      <p className="text-sm text-ink-soft">One you applied to somewhere else.</p>
      <div className="mt-3 space-y-3">
        <Field label="Job title">
          <input className="ink-input" value={f.external_title}
            onChange={(e) => setF({ ...f, external_title: e.target.value })} />
        </Field>
        <Field label="Company">
          <input className="ink-input" value={f.external_company}
            onChange={(e) => setF({ ...f, external_company: e.target.value })} />
        </Field>
        <Field label="Stage">
          <select className="ink-input" value={f.stage}
            onChange={(e) => setF({ ...f, stage: e.target.value })}>
            {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Button tone="money" full
          disabled={busy || !f.external_title || !f.external_company}
          onClick={async () => {
            setBusy(true);
            await fetch("/api/tracker/external", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(f),
            }).catch(() => {});
            setBusy(false); onDone();
          }}>
          {busy ? "Adding…" : "Add"}
        </Button>
      </div>
    </Sheet>
  );
}

function Sheet({ title, onClose, children }: {
  title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40">
      <div className="max-h-[88dvh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl border-t-2 border-ink bg-cream p-5 pb-8">
        <div className="flex items-center justify-between">
          <h2 className="title-hand text-2xl">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-2xl">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
