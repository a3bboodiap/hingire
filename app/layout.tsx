import type { Metadata, Viewport } from "next";
import { Caveat, Inter } from "next/font/google";
import "./globals.css";
import { CookieBanner } from "@/components/cookie-banner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Handwritten font for screen titles (Top Match, Job Offers, Soulmates…)
const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Hingire", template: "%s · Hingire" },
  description: "Find internships and first jobs, with honest reviews from people who did them.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FBF6E9",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${caveat.variable} h-full`}>
      <body className="min-h-full">
        {/* Designed for a 390px phone first; centred with edges on wider screens. */}
        <div className="mx-auto w-full max-w-[430px] min-h-dvh flex flex-col shadow-[0_0_0_1px_rgba(22,21,15,.08)]">
          {children}
        </div>
        <CookieBanner />
      </body>
    </html>
  );
}
