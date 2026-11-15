#!/usr/bin/env bash
# Readiness: HFM terminal64 process present under user mt5. No login/trading checks.
set -euo pipefail

TRIES="${KWIZERA_MT5_READY_TRIES:-60}"

for ((i = 1; i <= TRIES; i++)); do
  if pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "mt5_terminal_not_ready" >&2
exit 1
