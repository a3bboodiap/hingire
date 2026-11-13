"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";

export function CommentBox({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, body }),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Could not post."); return; }
      setBody(""); router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div>
      <textarea className="ink-input" rows={2} value={body} maxLength={2000}
        placeholder="Leave comment…" onChange={(e) => setBody(e.target.value)} />
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      <Button tone="money" className="mt-2" disabled={busy || body.trim().length === 0}
        onClick={send}>
        {busy ? "Posting…" : "Post comment"}
      </Button>
    </div>
  );
}
