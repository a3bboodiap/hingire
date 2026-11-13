/**
 * Dollar bills floating around the Welcome title.
 * Decorative only: aria-hidden, and it stops dead under
 * prefers-reduced-motion (handled globally in globals.css).
 */
const BILLS = [
  { left: "6%",  top: "4%",  delay: "0s",   rot: "-18deg", size: "2rem" },
  { left: "74%", top: "0%",  delay: ".7s",  rot: "14deg",  size: "1.6rem" },
  { left: "84%", top: "38%", delay: "1.4s", rot: "-8deg",  size: "2.2rem" },
  { left: "2%",  top: "52%", delay: "2.1s", rot: "22deg",  size: "1.7rem" },
  { left: "40%", top: "-6%", delay: "1.0s", rot: "6deg",   size: "1.4rem" },
  { left: "58%", top: "62%", delay: "1.8s", rot: "-24deg", size: "1.9rem" },
];

export function MoneyRain() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <style>{`
        @keyframes bill-float {
          0%,100% { transform: translateY(0)    rotate(var(--rot)); }
          50%     { transform: translateY(-14px) rotate(calc(var(--rot) * -0.6)); }
        }
      `}</style>
      {BILLS.map((b, i) => (
        <span
          key={i}
          className="absolute opacity-80"
          style={{
            left: b.left,
            top: b.top,
            fontSize: b.size,
            // @ts-expect-error custom property
            "--rot": b.rot,
            animation: `bill-float ${3.4 + i * 0.3}s ease-in-out ${b.delay} infinite`,
          }}
        >
          💵
        </span>
      ))}
    </div>
  );
}
