"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * The "Swipe >>>" slider that starts sign-up on the Welcome screen.
 * Pointer-drag on touch, and a real <button> fallback for keyboard and
 * screen-reader users — a drag-only control would lock them out.
 */
export function SwipeSlider({ href, label = "Swipe" }: { href: string; label?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const KNOB = 56;

  function maxX() {
    const w = trackRef.current?.clientWidth ?? 280;
    return Math.max(0, w - KNOB - 8);
  }

  function go() {
    if (done) return;
    setDone(true);
    setX(maxX());
    router.push(href);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (done) return;
    const startX = e.clientX;
    const startVal = x;
    (e.target as Element).setPointerCapture?.(e.pointerId);

    function move(ev: PointerEvent) {
      const next = Math.min(maxX(), Math.max(0, startVal + ev.clientX - startX));
      setX(next);
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setX((cur) => {
        if (cur > maxX() * 0.75) {
          go();
          return maxX();
        }
        return 0;
      });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const progress = maxX() > 0 ? x / maxX() : 0;

  return (
    <div
      ref={trackRef}
      className="relative h-16 w-full select-none overflow-hidden rounded-2xl border-2 border-ink bg-white shadow-[3px_4px_0_0_var(--color-ink)]"
    >
      <div
        className="absolute inset-y-0 left-0 bg-money-soft transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-base font-semibold text-ink-soft"
        aria-hidden
      >
        {done ? "Let's go…" : `${label} »»»`}
      </span>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onClick={() => {
          // keyboard / assistive activation, and a plain tap
          if (x === 0) go();
        }}
        aria-label={`${label} to start sign-up`}
        className="absolute top-1 left-1 grid h-14 w-14 touch-none place-items-center rounded-xl border-2 border-ink bg-money text-xl text-white"
        style={{ transform: `translateX(${x}px)` }}
      >
        <span aria-hidden>{"»"}</span>
      </button>
    </div>
  );
}
