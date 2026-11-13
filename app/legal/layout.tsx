import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh px-5 pb-16 pt-8">
      <Link href="/" className="text-sm underline text-ink-soft">← Back</Link>
      <article className="prose-sm mt-4 space-y-4 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
      </article>
    </main>
  );
}
