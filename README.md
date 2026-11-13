# Hingire

Find internships and first jobs, ranked against your CV, with honest reviews
from people who actually did the job.

Mobile-first web app, designed for a 390px phone screen.
Built to the contract in [PRD.md](PRD.md).

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS 4 — sketchbook theme, Caveat for titles, Inter for the rest |
| Backend | Supabase — Postgres, auth (email one-time code), private storage |
| AI | Anthropic Messages API, `claude-haiku-5-5`, server routes only, with a deterministic offline fallback |
| Validation | zod, on every request body, server-side |

## Getting started

See **[SETUP.md](SETUP.md)** — it covers creating the Supabase project, running
the migrations, and the optional Anthropic key, all from zero.

```bash
npm install
```

```bash
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run check:secrets` | Verifies no server secret is reachable from client code |
| `npm run verify` | Secret check, then a full build |

## Security posture

- Row Level Security on **every** table from the first migration; each user
  reaches only their own rows. Reviews are publicly readable only at
  `status = 'approved'`.
- The `service_role` key and `ANTHROPIC_API_KEY` are server-only, enforced by
  `import "server-only"` and checked by `npm run check:secrets`.
- Every request body is validated with zod; ownership is checked on the server
  and never inferred from an id sent by the browser.
- Storage buckets are private; files are served through short-lived signed URLs.
  PDF, DOCX, JPG, PNG only, 5 MB cap, renamed on save.
- Rate limits on login, sign-up, OTP, search, apply, review, KYC and AI routes.
- CSP, HSTS, X-Frame-Options and friends set in `next.config.ts`.

Full audit against the PRD's security list: [SECURITY-AUDIT.md](SECURITY-AUDIT.md).

## Layout

```
app/           screens and API routes
components/    shared UI
lib/           supabase clients, auth, validation, rate limiting, AI
supabase/      SQL migrations (run in order)
scripts/       pre-commit secret check
```
