import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

/** Routes reachable without a session. */
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/legal/privacy",
  "/legal/terms",
  "/legal/reviews",
  "/auth/callback",
];

/** Signed-in but mid-onboarding: these are the only app paths allowed. */
const ONBOARDING_PATHS = ["/info", "/cv"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const { pathname, origin } = request.nextUrl;

  // -------------------------------------------------------------------------
  // CSRF: a state-changing request must come from this origin. Supabase auth
  // uses cookies, so an Origin/Referer check is the cheap, correct guard.
  // -------------------------------------------------------------------------
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const reqOrigin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const allowed = [origin];
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) allowed.push(siteUrl.replace(/\/$/, ""));

    const originOk = reqOrigin ? allowed.includes(reqOrigin) : false;
    const refererOk = referer
      ? allowed.some((a) => referer.startsWith(a + "/") || referer === a)
      : false;

    if (!originOk && !refererOk) {
      return NextResponse.json(
        { error: "Request blocked." },
        { status: 403, headers: { "x-reason": "csrf" } },
      );
    }
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without Supabase configured we cannot authenticate anyone; let the pages
  // render their own "not configured" notice rather than redirect-looping.
  if (!url || !anon) return response;

  const supabase = createServerClient<Database>(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() revalidates the JWT with Supabase on every request rather than
  // trusting whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname) && !pathname.startsWith("/api/")) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }

  // A signed-in user who has not finished sign-up is held in the flow.
  if (user && !isPublic(pathname) && !pathname.startsWith("/api/")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step")
      .eq("id", user.id)
      .maybeSingle();

    const step = profile?.onboarding_step ?? "info";
    const inOnboarding = ONBOARDING_PATHS.some((p) => pathname.startsWith(p));

    if (step !== "done" && !inOnboarding) {
      const to = request.nextUrl.clone();
      to.pathname = step === "cv" ? "/cv" : "/info";
      return NextResponse.redirect(to);
    }
    // Returning, fully signed-up user landing on an onboarding page.
    if (step === "done" && inOnboarding && !request.nextUrl.searchParams.has("edit")) {
      const to = request.nextUrl.clone();
      to.pathname = "/top-match";
      to.search = "";
      return NextResponse.redirect(to);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // everything except Next internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
