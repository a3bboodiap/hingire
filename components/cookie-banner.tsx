"use client";

import { useEffect, useState } from "react";

/**
 * Cookie consent. Legal requirement: reject must be as easy as accept, so both
 * are the same size, same prominence, side by side. Nothing non-essential runs
 * before a choice is made — there are no analytics or marketing scripts in
 * this build at all, so "accept" only records the preference.
 */
const KEY = "hingire.cookie-choice";

export function CookieBanner() {
  const [choice, setChoice] = useState<string | null>("pending");

  useEffect(() => {
    try {
      setChoice(localStorage.getItem(KEY));
    } catch {
      setChoice(null);
    }
  }, []);

  if (choice !== null) return null;

  function decide(value: "accepted" | "rejected") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* private mode — the banner simply reappears next visit */
    }
    setChoice(value);
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie choices"
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] p-3"
    >
      <div className="ink-card p-4 text-sm">
        <p className="font-semibold">Cookies</p>
        <p className="mt-1 text-ink-soft">
          We use only the cookies needed to keep you signed in. We do not use
          tracking or advertising cookies.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => decide("rejected")}
            className="ink-btn bg-white px-3 py-2"
          >
            Reject
          </button>
          <button
            onClick={() => decide("accepted")}
            className="ink-btn bg-white px-3 py-2"
          >
            Accept
          </button>
        </div>
        <a href="/legal/privacy" className="mt-2 inline-block underline text-ink-soft">
          Privacy notice
        </a>
      </div>
    </div>
  );
}
