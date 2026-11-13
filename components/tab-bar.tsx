"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/top-match", label: "Top Match", icon: "♥" },
  { href: "/job-offers", label: "Job Offers", icon: "☰" },
  { href: "/soulmates", label: "Soulmates", icon: "★" },
  { href: "/tracker", label: "Tracker", icon: "◷" },
  { href: "/profile", label: "Profile", icon: "☺" },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-30 mt-auto border-t-2 border-ink bg-cream/97 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = path === t.href || path.startsWith(t.href + "/");
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-semibold ${
                  active ? "text-money" : "text-ink-soft"
                }`}
              >
                <span aria-hidden className="text-lg leading-none">{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
