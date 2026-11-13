#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Pre-commit secret check.
#
# Three things must never be true:
#   1. A client-side file reaches for a server-only secret.
#   2. A secret is exposed through a NEXT_PUBLIC_ name.
#   3. A real key value is committed anywhere in the tree.
#
# Run: npm run check:secrets
# ---------------------------------------------------------------------------
set -uo pipefail
fail=0
say() { printf '%s\n' "$*"; }
bad() { say "FAIL: $*"; fail=1; }

SRC=$(find app components lib hooks -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null)

# --- 1. "use client" files must not touch server secrets --------------------
for f in $SRC; do
  head -3 "$f" | grep -q '"use client"' || continue
  if grep -nE 'SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|RATE_LIMIT_SALT' "$f"; then
    bad "client component reads a server secret: $f"
  fi
  if grep -nE 'from "@/lib/(ai|supabase/admin|audit|rate-limit|auth)"' "$f"; then
    bad "client component imports a server-only module: $f"
  fi
done

# --- 2. secrets must never be published through NEXT_PUBLIC_ ----------------
if grep -rnE 'NEXT_PUBLIC_[A-Z_]*(SERVICE_ROLE|SECRET|ANTHROPIC|PRIVATE|SALT)' \
     app components lib scripts next.config.ts .env.local.example 2>/dev/null; then
  bad "a secret is being exposed under a NEXT_PUBLIC_ name"
fi

# --- 3. server-only modules must declare it ---------------------------------
for f in lib/supabase/admin.ts lib/ai/index.ts lib/audit.ts lib/rate-limit.ts lib/auth.ts lib/http.ts; do
  [ -f "$f" ] || continue
  head -2 "$f" | grep -q 'server-only' || bad "missing \`import \"server-only\"\`: $f"
done

# --- 4. no real key material anywhere in the tree ---------------------------
# Anthropic keys start sk-ant-, Supabase JWTs start eyJ, service keys are long.
if grep -rnE 'sk-ant-[A-Za-z0-9_-]{20,}' \
     --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' \
     --include='*.sql' --include='*.example' . 2>/dev/null \
     | grep -v node_modules | grep -v '\.next/'; then
  bad "an Anthropic API key appears in a tracked file"
fi
if grep -rnE '\beyJ[A-Za-z0-9_-]{30,}\.' \
     --include='*.ts' --include='*.tsx' --include='*.json' --include='*.md' \
     --include='*.example' . 2>/dev/null \
     | grep -v node_modules | grep -v '\.next/' | grep -v package-lock.json; then
  bad "what looks like a JWT / Supabase key appears in a tracked file"
fi

# --- 5. .env.local must never be tracked by git -----------------------------
if git ls-files --error-unmatch .env.local >/dev/null 2>&1; then
  bad ".env.local is tracked by git — remove it from the index immediately"
fi
if [ -f .env.local.example ]; then
  if grep -qE '=[A-Za-z0-9_.-]{12,}' .env.local.example; then
    bad ".env.local.example contains what looks like a real value"
  fi
fi

if [ "$fail" -eq 0 ]; then
  say "OK: no server secret reachable from client code, nothing sensitive committed."
fi
exit "$fail"
