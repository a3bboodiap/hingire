import * as React from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Handwritten screen title, per the PRD's look and feel. */
export function ScreenTitle({
  children,
  sub,
}: {
  children: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <header className="px-4 pt-5 pb-3">
      <h1 className="title-hand text-[2.6rem] leading-none">{children}</h1>
      {sub ? <p className="mt-1 text-sm text-ink-soft">{sub}</p> : null}
    </header>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "ink" | "money" | "danger" | "plain";
  full?: boolean;
};

export function Button({
  tone = "ink",
  full,
  className,
  ...rest
}: ButtonProps) {
  const tones: Record<string, string> = {
    ink: "bg-white text-ink",
    money: "bg-money text-white",
    danger: "bg-danger text-white",
    plain: "bg-cream-deep text-ink",
  };
  return (
    <button
      {...rest}
      className={cx(
        "ink-btn px-4 py-3 text-[0.95rem]",
        tones[tone],
        full && "w-full",
        className,
      )}
    />
  );
}

/** Gold stars. `size="lg"` is the Review Page header row. */
export function Stars({
  value,
  count,
  size = "sm",
}: {
  value: number;
  count?: number;
  size?: "sm" | "lg";
}) {
  const full = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span
        aria-hidden
        className={cx(
          "tracking-[.06em] text-gold",
          size === "lg" ? "text-3xl" : "text-sm",
        )}
      >
        {"★★★★★".slice(0, full)}
        <span className="text-ink-faint">{"☆☆☆☆☆".slice(0, 5 - full)}</span>
      </span>
      <span className="sr-only">{value} out of 5 stars</span>
      {typeof count === "number" ? (
        <span className="text-xs text-ink-soft">
          {value.toFixed(1)} ({count})
        </span>
      ) : null}
    </span>
  );
}

export function Pill({
  children,
  tone = "plain",
}: {
  children: React.ReactNode;
  tone?: "plain" | "money" | "danger" | "gold";
}) {
  const tones = {
    plain: "bg-cream-deep text-ink-soft border-ink-faint",
    money: "bg-money-soft text-money border-money",
    danger: "bg-danger-soft text-danger border-danger",
    gold: "bg-[#FFF3D6] text-[#8A6100] border-gold",
  } as const;
  return (
    <span
      className={cx(
        "inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  tone = "plain",
  title,
  children,
}: {
  tone?: "plain" | "danger" | "money" | "gold";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    plain: "border-ink-faint bg-cream-deep",
    danger: "border-danger bg-danger-soft",
    money: "border-money bg-money-soft",
    gold: "border-gold bg-[#FFF8E6]",
  } as const;
  return (
    <div className={cx("rounded-xl border-2 p-3 text-sm", tones[tone])}>
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-4 my-8 ink-card-flat p-6 text-center">
      <p className="title-hand text-2xl">{title}</p>
      {children ? <p className="mt-2 text-sm text-ink-soft">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  highlight,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-2 text-sm font-semibold">
        {label}
        {highlight ? <Pill tone="gold">check this</Pill> : null}
      </span>
      {children}
      {hint && !error ? (
        <span className="mt-1 block text-xs text-ink-soft">{hint}</span>
      ) : null}
      {error ? (
        <span role="alert" className="mt-1 block text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  );
}
