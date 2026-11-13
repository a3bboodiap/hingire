import Link from "next/link";

/** Alerts bell with the count of new matching jobs. */
export function Bell({ count }: { count: number }) {
  return (
    <Link
      href="/job-offers"
      aria-label={`${count} new matching jobs`}
      className="relative grid size-11 place-items-center rounded-xl border-2 border-ink bg-white"
    >
      <span aria-hidden className="text-lg">🔔</span>
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border-2 border-ink bg-money px-1 text-[0.6rem] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
