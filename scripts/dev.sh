#!/usr/bin/env bash
# Starts the dev server with the local Node install on PATH.
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")/.."
exec npm run dev -- "$@"
