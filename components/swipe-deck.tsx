"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedJob } from "@/lib/job-format";
import { Stars, Pill, Button } from "@/components/ui";
import { payLabel, CONTRACT_LABEL, MODE_LABEL } from "@/lib/job-format";

/**
 * Top Match — a stack of swipeable cards, best fit on top.
 * Right / heart saves (LOVE stamp, then it moves to Soulmates).
 * Left dismisses.
 *
 * Buttons sit under the deck so the screen is fully usable without dragging.
 */
export function SwipeDeck({ jobs }: { jobs: FeedJob[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [flying, setFlying] = useState<"love" | "nope" | null>(null);

  const job = jobs[index];
  const next = jobs[index + 1];

  async function decide(action: "save" | "dismiss") {
    if (!job) return;
    setFlying(action === "save" ? "love" : "nope");
    await fetch("/api/jobs/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id: job.id, action }),
    }).catch(() => {});
    setTimeout(() => {
      setFlying(null); setDrag(0); setIndex((i) => i + 1); router.refresh();
    }, 260);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (flying) return;
    const startX = e.clientX;
    function move(ev: PointerEvent) { setDrag(ev.clientX - startX); }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag((d) => {
        if (d > 90) { decide("save"); return d; }
        if (d < -90) { decide("dismiss"); return d; }
        return 0;
      });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  if (!job) {
    return (
      <div className="mx-4 mt-6 ink-card-flat p-8 text-center">
        <p className="title-hand text-2xl">That’s everyone for now</p>
        <p className="mt-2 text-sm text-ink-soft">
          You have been through every match. Check Soulmates for the ones you saved,
          or add more skills to your CV to widen the net.
        </p>
      </div>
    );
  }

  const offset = flying === "love" ? 500 : flying === "nope" ? -500 : drag;
  const rot = offset / 18;
  const loveOpacity = Math.max(0, Math.min(1, offset / 90));
  const nopeOpacity = Math.max(0, Math.min(1, -offset / 90));

  return (
    <div className="px-4">
      <div className="relative h-[27rem] select-none">
        {next ? (
          <article
            aria-hidden
            className="ink-card absolute inset-x-2 top-3 h-[25.5rem] opacity-60"
          />
        ) : null}

        <article
          onPointerDown={onPointerDown}
          className="ink-card absolute inset-0 touch-none p-5"
          style={{
            transform: `translateX(${offset}px) rotate(${rot}deg)`,
            transition: flying || drag === 0 ? "transform .26s ease" : "none",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold leading-tight">{job.title}</h2>
              <p className="text-sm text-ink-soft">{job.company}</p>
            </div>
            <Pill tone="money">{job.score}% fit</Pill>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill>{CONTRACT_LABEL[job.contract_type]}</Pill>
            <Pill>{MODE_LABEL[job.work_mode]}</Pill>
            <Pill>{job.location}</Pill>
          </div>

          <p className="mt-3 text-lg font-semibold">{payLabel(job)}</p>

          <div className="mt-2">
            {job.review_count > 0 ? (
              <Stars value={job.avg_rating} count={job.review_count} />
            ) : (
              <span className="text-xs text-ink-faint">No reviews yet</span>
            )}
          </div>

          <div className="mt-4 rounded-xl border-2 border-money bg-money-soft p-3">
            <p className="text-sm font-medium text-money">{job.reason}</p>
          </div>

          <p className="mt-3 line-clamp-4 text-sm text-ink-soft">{job.description}</p>

          {/* stamps */}
          <span
            className="stamp absolute left-5 top-5 text-4xl text-money"
            style={{ opacity: loveOpacity }}
            aria-hidden
          >
            LOVE
          </span>
          <span
            className="stamp absolute right-5 top-5 text-4xl text-danger"
            style={{ opacity: nopeOpacity, transform: "rotate(16deg)" }}
            aria-hidden
          >
            NOPE
          </span>
        </article>
      </div>

      <div className="mt-5 flex items-center justify-center gap-4">
        <Button
          tone="danger"
          onClick={() => decide("dismiss")}
          className="size-16 !rounded-full !px-0 text-2xl"
          aria-label={`Dismiss ${job.title}`}
        >
          ✕
        </Button>
        <Button
          tone="money"
          onClick={() => decide("save")}
          className="size-20 !rounded-full !px-0 text-3xl"
          aria-label={`Save ${job.title} to Soulmates`}
        >
          ♥
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-ink-faint">
        Swipe right to save, left to pass — or use the buttons.
      </p>
      <p className="mt-1 text-center text-[0.65rem] text-ink-faint">
        Ranked by AI · {index + 1} of {jobs.length}
      </p>
    </div>
  );
}
