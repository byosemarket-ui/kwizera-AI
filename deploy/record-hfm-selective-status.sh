#!/usr/bin/env bash
# Record deployment/status.json after a selective HFM deploy (keeps /api/deployment honest).
# Usage (on VPS, from /opt/kwizera-ai):
#   bash deploy/record-hfm-selective-status.sh <full-sha> [previous-sha] [message]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
SHA="${1:?usage: record-hfm-selective-status.sh <sha> [previous] [message]}"
PREV="${2:-}"
MSG="${3:-Selective HFM deploy verified}"
export KWIZERA_STORAGE_ROOT="${KWIZERA_STORAGE_ROOT:-/var/lib/kwizera-ai-studio}"
export KWIZERA_DEPLOY_SHA="$SHA"
export KWIZERA_DEPLOYED_SHA="$SHA"
export KWIZERA_PREVIOUS_SHA="${PREV}"
export KWIZERA_DEPLOY_RESULT=success
export KWIZERA_DEPLOY_MESSAGE="$MSG"
node "$ROOT/deploy/record-status.mjs" live
echo "[KWIZERA] selective deployment status recorded for $SHA"
