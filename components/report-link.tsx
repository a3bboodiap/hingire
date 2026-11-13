"use client";

import { useState } from "react";

/** Digital Services Act: a report link on every review. */
export function ReportLink({ reviewId }: { reviewId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) return <span className="text-xs text-money">Reported — thank you.</span>;

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs underline text-ink-soft">
        Report
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-5">
          <div className="w-full max-w-sm rounded-2xl border-2 border-ink bg-cream p-4">
            <h3 className="font-bold">Report this review</h3>
            <p className="mt-1 text-xs text-ink-soft">
              Tell us what is wrong with it. A moderator will look.
            </p>
            <textarea className="ink-input mt-2" rows={3} value={reason} maxLength={500}
              onChange={(e) => setReason(e.target.value)} />
            <div className="mt-3 flex gap-2">
              <button onClick={() => setOpen(false)}
                className="ink-btn flex-1 bg-white px-3 py-2 text-sm">Cancel</button>
              <button disabled={reason.trim().length < 5}
                className="ink-btn flex-1 bg-danger px-3 py-2 text-sm text-white"
                onClick={async () => {
                  await fetch("/api/reviews/report", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ review_id: reviewId, reason }),
                  }).catch(() => {});
                  setSent(true); setOpen(false);
                }}>Report</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
