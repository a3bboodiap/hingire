import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 * Next needs 'unsafe-inline' for its injected bootstrap styles/scripts; in dev
 * it additionally needs 'unsafe-eval' for React Refresh. connect-src is held
 * to self plus the project's own Supabase origin so a compromised dependency
 * cannot quietly exfiltrate to a third party.
 */
const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : "";
  } catch {
    return "";
  }
})();
const supabaseWs = supabaseOrigin.replace(/^https/, "wss");

const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `object-src 'none'`,
  `img-src 'self' blob: data:`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`.trim(),
  `media-src 'self' blob:`,
  `worker-src 'self' blob:`,
  `upgrade-insecure-requests`,
].join("; ");

const nextConfig: NextConfig = {
  // cacheComponents adds strict static/dynamic rules that fight an
  // every-request-is-authenticated app. Off by design.
  cacheComponents: false,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // camera stays enabled on self: the Verify screen needs a live capture.
            value:
              "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
    ];
  },
};

export default nextConfig;
