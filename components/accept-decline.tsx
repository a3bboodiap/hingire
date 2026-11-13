"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Notice } from "@/components/ui";

/**
 * Accept (green) applies; Decline (red) dismisses.
 * The employer here has no quick-apply integration, so Accept opens the
 * source and then asks whether they actually applied — which is the PRD's
 * fallback path.
 */
export function AcceptDecline({
  jobId, sourceUrl, saved, stage,
}: { jobId: string; sourceUrl: string; saved: boolean; stage: string | null }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(stage);

  async function post(url: string, body: unknown) {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return res.ok;
    } finally { setBusy(false); }
  }

  if (done === "applied") {
    return (
      <Notice tone="money" title="Applied">
        This is in your Tracker as applied. Update the stage there as you hear back.
      </Notice>
    );
  }

  if (asking) {
    return (
      <div className="ink-card-flat p-4">
        <p className="font-semibold">Did you apply?</p>
        <p className="mt-1 text-sm text-ink-soft">
          We opened the employer’s site. Tell us how it went so your Tracker stays right.
        </p>
        <div className="mt-3 flex gap-3">
          <Button className="flex-1" disabled={busy}
            onClick={async () => {
              await post("/api/jobs/apply", { job_id: jobId, applied: false });
              setAsking(false); router.refresh();
            }}>Not yet</Button>
          <Button tone="money" className="flex-1" disabled={busy}
            onClick={async () => {
              if (await post("/api/jobs/apply", { job_id: jobId, applied: true })) {
                setDone("applied"); router.refresh();
              }
            }}>Yes, I applied</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <Button tone="danger" className="flex-1" disabled={busy}
        onClick={async () => {
          if (await post("/api/jobs/action", { job_id: jobId, action: "dismiss" })) {
            router.push("/soulmates"); router.refresh();
          }
        }}>
        Decline
      </Button>
      <Button tone="money" className="flex-[2]" disabled={busy}
        onClick={() => {
          window.open(sourceUrl, "_blank", "noopener,noreferrer");
          setAsking(true);
        }}>
        Accept {saved ? "" : "& save"}
      </Button>
    </div>
  );
}
