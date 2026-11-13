# Hingire — setup

Everything below is free. The one paid item (the Anthropic API) is optional and
called out clearly.

---

## 1. Supabase — database, auth and file storage (free)

1. Go to <https://supabase.com> and click **Start your project**. Sign in with
   GitHub or email.
2. Click **New project**.
   - **Name:** `hingire`
   - **Database password:** click *Generate a password* and save it in your
     password manager. You will rarely need it.
   - **Region:** pick an **EU** region — `West EU (Ireland)` or
     `Central EU (Frankfurt)`. This is not cosmetic: the PRD requires EU
     hosting, and the privacy notice in the app says so.
   - **Plan:** Free.
3. Wait about two minutes for it to finish building.
4. In the left sidebar go to **Project Settings → API keys** and copy these
   three values:

   | Supabase calls it | Goes into |
   |---|---|
   | Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
   | `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
   | `service_role` `secret` key | `SUPABASE_SERVICE_ROLE_KEY` |

   > **The `service_role` key bypasses all database security.** It belongs only
   > in `.env.local` and in Vercel's server-side environment variables. Never
   > paste it into a chat, a client file, or anywhere beginning `NEXT_PUBLIC_`.

5. Paste all three into `.env.local` in this project.

### Run the database migrations

In Supabase, open **SQL Editor → New query**, then run the four files in
`supabase/migrations/` **in order**, one at a time:

1. `0001_init.sql` — tables
2. `0002_rls.sql` — Row Level Security on every table
3. `0003_storage.sql` — private file buckets
4. `0004_functions.sql` — server functions

Each should say *Success. No rows returned*.

### Turn on email codes

**Authentication → Sign In / Providers → Email**: make sure *Enable email
provider* is on. The free tier sends a limited number of emails per hour, which
is plenty for testing.

---

## 2. Anthropic API — the six AI features (optional, paid)

**There is no free tier.** The minimum top-up is **$5**, and this app's usage
with `claude-haiku-5-5` is fractions of a cent per call.

**You do not need this to run the app.** Without a key, all six AI tasks fall
back to a deterministic offline engine built into the app, and the UI says
which engine produced each result. The acceptance tests pass either way.

If you do want real AI:

1. Go to <https://console.anthropic.com>, sign up.
2. **Billing** → add $5 of credit.
3. **API Keys** → *Create key* → copy it.
4. Put it in `.env.local` as `ANTHROPIC_API_KEY`.

It is server-only — there is no `NEXT_PUBLIC_` version of it, and a build error
is raised if any client file tries to import the AI module.

---

## 3. GitHub (free)

1. Sign up / sign in at <https://github.com>.
2. Click **New repository**. Name it `hingire`. **Private** is fine.
   Do **not** tick "Add a README" — this project already has one.
3. Copy the repository URL it shows you.

---

## 4. Vercel — hosting (free)

1. Go to <https://vercel.com> and **Sign up with GitHub**.
2. **Add New → Project**, pick the `hingire` repository, click **Import**.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your project URL | |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key | |
   | `SUPABASE_SERVICE_ROLE_KEY` | your service role key | **secret** |
   | `ANTHROPIC_API_KEY` | your key | **secret**, optional |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-app>.vercel.app` | |
   | `RATE_LIMIT_SALT` | any long random string | **secret** |

4. **Deploy.**
5. Back in Supabase: **Authentication → URL Configuration** → set **Site URL**
   to your Vercel URL, and add it under **Redirect URLs**.

The Hobby plan is free and is for non-commercial use.

---

## Running it locally

Node is installed at `~/.local/node`. Either add it to your PATH permanently:

```bash
echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> ~/.zshrc
```

…or prefix each command. Then:

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000> on a phone-width window (390px).

---

## What runs without which key

| Key missing | What happens |
|---|---|
| Supabase keys | Sign-up and login are switched off; the app explains why on screen. |
| `SUPABASE_SERVICE_ROLE_KEY` | Rate limits on login, OTP, review and KYC **fail closed** (they block rather than let traffic through). Ranking and audit writes are skipped. |
| `ANTHROPIC_API_KEY` | All six AI tasks use the offline engine. The UI labels which engine ran. |
