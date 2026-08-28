#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/dist/dev/server/production-gateway.js" ]] || [[ ! -f "$ROOT/dist/dev/server/index.js" ]]; then
  echo "[KWIZERA] Production build missing. Run: npm run build:production" >&2
  exit 1
fi

export NODE_ENV="${NODE_ENV:-production}"
export KWIZERA_ENV="${KWIZERA_ENV:-production}"
export KWIZERA_SKIP_BROWSER_OPEN="${KWIZERA_SKIP_BROWSER_OPEN:-1}"
export KWIZERA_PERSISTENT_MODE="${KWIZERA_PERSISTENT_MODE:-1}"
export KWIZERA_PROJECT_ROOT="${KWIZERA_PROJECT_ROOT:-$ROOT}"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

exec node "$ROOT/dist/dev/server/production-gateway.js"
