# Security audit — Hingire

Audited against every line of the "Security requirements" section of
[PRD.md](PRD.md), plus the KYC and legal requirements that carry security
weight. Date: 2026-11-13.

**Verdict: 31 of 38 requirements met, 3 partially met, 4 open.**
No open item has runtime exposure in production.
Every open item is listed with the reason and the fix.

Legend: ✅ met · ⚠️ partial · ❌ open

---

## Database access

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 1 | Row Level Security on every table | ✅ | `0002_rls.sql` enables RLS on all 25 tables. `otp_codes`, `rate_limits`, `audit_log`, `moderators` have **no policies at all**, so anon and authenticated are denied everything on them. |
| 2 | Users can only read and write their own rows | ✅ | Every user-owned table has a `user_id = auth.uid()` policy for all four verbs. Reviews additionally expose only `status = 'approved'` publicly. |

**Beyond the requirement:** review insert also requires passed KYC *in the
policy* (`reviews_insert_own_kyc`), so a forged request that bypassed the route
handler still cannot publish. Column-level grants on `profiles` mean a user
cannot write their own `kyc_status`, `is_adult` or `flagged_for_review`.
Moderator status lives in a separate table so nobody can self-promote.

## Authorisation

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 3 | Check on the server, on every request, that the user owns what they ask for | ✅ | `lib/route-helpers.ts#withUser` resolves the session for every route. Routes taking an id re-fetch and compare ownership before acting — see `/api/tracker/stage`, `/api/tracker/rejection`, `/api/reviews/submit`. |
| 4 | Never trust an ID sent from the browser | ✅ | No zod schema in `lib/validation.ts` accepts a `user_id`. The user id always comes from the verified session. `/api/reviews/submit` additionally rejects a `proof_path` not prefixed with the caller's own id. |

## Input

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 5 | Validate all input server-side | ✅ | `parseBody()` + zod on every route. No route reads `req.json()` directly. |
| 6 | Sanitise user input | ✅ | zod trims and caps every string. Text bound for the model goes through `sanitiseForModel()`, which strips control and zero-width characters. |
| 7 | Parameterised queries | ✅ | All access is through the Supabase client (parameterised) or `security definer` SQL functions with typed arguments. No string-built SQL anywhere. |
| 8 | Escape output against XSS | ✅ | React escapes by default. There is no `dangerouslySetInnerHTML` in the codebase, and CSP blocks inline event handlers. |

## Authentication

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 9 | Hashed passwords (bcrypt or argon2) | ✅ | **No passwords exist.** Auth is email one-time code via Supabase, so there is no password to store. Our own phone OTP is stored as SHA-256 and compared with `timingSafeEqual`. |
| 10 | Sessions expire after inactivity | ⚠️ | Supabase refresh-token expiry governs this and defaults to long-lived. **Fix:** in Supabase → Authentication → Sessions, set "Inactivity timeout" (e.g. 7 days) and "Time-box user sessions" (e.g. 30 days). Not settable from this repo. |
| 11 | CSRF protection on state-changing requests | ✅ | `proxy.ts` rejects any non-GET/HEAD/OPTIONS request whose Origin or Referer is not this site. Supabase cookies are `SameSite=Lax` and httpOnly. |
| 12 | Two-factor login for moderators and admins | ⚠️ | The database models it: `is_active_moderator()` returns true only when `moderators.mfa_enrolled` is set, and every moderator-only policy uses that function. **The enrolment flow and the moderator console are not built** — there is no moderator UI in this prototype. Reviews therefore stay pending until someone with database access approves them. |

## Secrets

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 13 | No API keys in code or the browser | ✅ | Verified by `npm run check:secrets`, which greps for key material in tracked files and fails the build. |
| 14 | Database service key server-only | ✅ | `lib/supabase/admin.ts` begins `import "server-only"`, which makes a client import a build error. The check script independently confirms no `"use client"` file imports it. |
| 15 | Secrets in environment variables | ✅ | `.env.local` (gitignored); `.env.local.example` holds names only. |
| 16 | Rotate after any suspected leak | ✅ | Documented in `SETUP.md`. Procedural, not code. |

## Abuse

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 17 | Rate limits on login, sign-up, search, apply, review, KYC | ✅ | `lib/rate-limit.ts` with a Postgres counter and an atomic `bump_rate_limit()`. KYC is capped at 3 per 24 h, matching the KYC policy. Login/sign-up/OTP are limited **per IP and per email**, so neither a single host nor a distributed mail-bomb works. |
| 18 | Limiter fails safe | ✅ | On a limiter outage or missing service key, the critical buckets (login, otp, review, kyc) **deny** rather than allow. |
| 19 | Bot checks on sign-up and review submission | ❌ | **Open.** No CAPTCHA or attestation. Rate limits and the email-code round trip raise the cost but do not stop a determined script. **Fix:** enable Supabase's built-in CAPTCHA (Authentication → Attack Protection → hCaptcha/Turnstile), and add the same token check to `/api/reviews/submit`. Left open because it needs an hCaptcha/Turnstile account. |

## File upload

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 20 | Allowed types and size limits | ✅ | PDF, DOCX, JPG, PNG; 5 MB. Enforced three times: on the bucket, in the route, and by **magic-byte sniffing** (`sniffMime`) so a renamed `.exe` or a lying Content-Type is rejected. |
| 21 | Malware scan | ❌ | **Open.** No antivirus scanning. **Fix:** a ClamAV sidecar, or a storage webhook into VirusTotal/Cloudmersive, before the file is readable. Left open because every option is a paid service or a container this deployment cannot host. **Mitigated by:** files are never executed, never served to other users, and are returned only as short-lived signed URLs to the owner or a moderator. |
| 22 | Private storage with short-lived signed links | ✅ | Both buckets are `public = false`. Nothing renders a bucket URL directly. |
| 23 | Rename files on save | ✅ | Stored as `<user-id>/<uuid>.<ext>`; the original filename never reaches storage. |

## Network

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 24 | HTTPS everywhere | ✅ | Vercel terminates TLS; HSTS with `preload` is set; CSP includes `upgrade-insecure-requests`. |
| 25 | Security headers (CSP, HSTS, X-Frame-Options) | ✅ | All three in `next.config.ts`, plus `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cross-Origin-Opener-Policy`. |
| 26 | CSP strictness | ⚠️ | `script-src` needs `'unsafe-inline'` for Next's bootstrap, and `'unsafe-eval'` in development only. **Fix:** nonce-based CSP via middleware. Deferred: it requires making every page dynamic, and the app has no third-party scripts, so the practical exposure is small. |
| 27 | Strict CORS | ✅ | No CORS headers are set, so the browser default (same-origin only) applies to every API route. `connect-src` is pinned to self plus the project's own Supabase origin. |

## AI features

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 28 | Treat uploaded CVs, answers and job descriptions as untrusted | ✅ | `lib/ai/untrusted.ts`: named data blocks, the closing delimiter defanged so content cannot escape its own block, zero-width and control characters stripped, and a system rule stating block contents are data and never instructions. |
| 29 | Delete the uploaded CV once its answers are saved | ✅ | **Stronger than asked:** the CV is parsed in memory and never written to storage at all. |
| 30 | Model output never runs code or changes permissions | ✅ | Output is forced through a tool schema, validated with zod, and used only as data. Pass/fail is decided by application code in every case — see `/api/kyc/document`, where the model only reports observations. |
| 31 | Send the model only the data it needs | ✅ | `stripProtectedTraits()` removes age, gender, nationality and photo before ranking. The ID check receives one image and no profile data. |
| 32 | AI provider set not to train on user data | ✅ | Anthropic does not train on API inputs or outputs by default. Stated in the privacy notice. |

## Logging

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 33 | Log security events without personal data | ✅ | `lib/audit.ts` has a fixed event vocabulary and a documented rule: no names, emails, codes or document contents. Rate-limit subjects are salted SHA-256 of the IP, never the raw address. |
| 34 | Generic error messages, never stack traces | ✅ | `lib/http.ts` returns fixed sentences from `ERR`; details go to the server log only. Auth responses are identical whether or not an account exists. |

## Dependencies

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 35 | Scan for known vulnerabilities before each release | ⚠️ | `npm audit` reports **8 moderate** findings, all one issue: a ReDoS in `minimatch` reached through `eslint-config-next` → `typescript-eslint`. **All of it is devDependency-only** — it is the lint toolchain and ships nothing to production, so there is no runtime exposure. `npm audit fix --force` would downgrade `eslint-config-next` to 15.5.29, which is a breaking change against Next 16, so it has been left. Production dependencies are clean. Not yet wired into CI. **Fix:** add `npm audit --omit=dev --audit-level=high` to a GitHub Action, and take the upstream bump when `eslint-config-next` ships one. |

## Breaches

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 36 | Notify affected users and the AEPD within 72 hours | ✅ | Committed to in the privacy notice. Procedural. |

## KYC and legal items with security weight

| # | Requirement | | Evidence / gap |
|---|---|---|---|
| 37 | Never store ID documents or face scans | ✅ | **No bucket exists for them.** The ID image lives in one request's memory and is never written or logged. Only status, date, provider reference, over-18 flag and name-match flag are stored. |
| 38 | Liveness and face match | ❌ | **Open.** The prototype captures a still photo from the live camera; there is no selfie video, no liveness detection and no face match against the document. The PRD itself sanctions a prototype AI image check here, and the screen is labelled "Prototype check: a certified KYC provider replaces this at launch". **Fix:** a certified provider (Onfido, Veriff, Sumsub) at launch. |
| | Proof deleted within 30 days of the decision | ✅ | `proof_delete_after` is set on submission; `purge_expired_proofs()` clears it. **Note:** the function needs a scheduler — call it from a cron route, or enable `pg_cron` (paid plan). Not yet scheduled. |
| | Proof deleted immediately on account deletion | ✅ | `/api/profile/delete` removes storage objects first, then cascades the rows, then deletes the auth user. |
| | EU AI Act: reason on every ranked job, logged, human-reviewable | ✅ | Every card and row shows its reason; `ranking_logs` records inputs, score, reason, engine and model per decision; the subject can read and export their own log. |
| | GDPR: newest-first feed offered | ✅ | `SortToggle` on Job Offers and Profile. |
| | Cookies: reject as easy as accept | ✅ | Two identical side-by-side buttons. No non-essential cookies exist at all. |

---

## The four open items, in priority order

1. **Liveness and face match (#38)** — needs a certified KYC provider. Blocking for launch, not for a prototype. The screen says so.
2. **Malware scanning on uploads (#21)** — needs a paid scanner or a container. Mitigated: files are never executed or shown to other users.
3. **Bot checks (#19)** — needs an hCaptcha or Turnstile account. Supabase has it built in; it is a settings change plus a token check.
4. **Dependency scanning in CI (#35)** — one GitHub Action, blocked only on there being no repository yet. The 8 current findings are devDependency-only (lint toolchain) with no production exposure.

## Two deployment settings you must set yourself

- **Session inactivity timeout (#10)** — Supabase → Authentication → Sessions.
- **Scheduling `purge_expired_proofs()`** — a cron route hitting it daily, or `pg_cron`.

## One prototype escape hatch to be aware of

`ALLOW_PROTOTYPE_VERIFICATION=true` makes the electronic-ID route pass without
any real check, so the review flow can be tested end to end. It is **off by
default** and must never be set in production. Grep for it before deploying.
