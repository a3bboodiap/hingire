"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * GDPR: users must be told the feed is AI-ranked and be offered a
 * newest-first feed instead.
 */
export function SortToggle({ current }: { current: "ai_rank" | "newest" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(sort: "ai_rank" | "newest") {
    if (sort === current || busy) return;
    setBusy(true);
    await fetch("/api/profile/feed-sort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_sort: sort }),
    }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border-2 border-ink-faint bg-cream-deep p-1.5 text-xs">
      <span className="pl-1 text-ink-soft">Order:</span>
      {([["ai_rank", "Best fit (AI)"], ["newest", "Newest first"]] as const).map(([k, l]) => (
        <button key={k} onClick={() => set(k)} disabled={busy}
          className={`rounded-lg border-2 px-2 py-1 font-semibold ${
            current === k ? "border-ink bg-white" : "border-transparent text-ink-soft"
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}
