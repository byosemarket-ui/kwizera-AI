#!/usr/bin/env bash
# Post-start: restrict agent socket ownership for kwizera ↔ mt5 (root-capable).
set -euo pipefail

SOCK="${KWIZERA_MT5_HFM_AGENT_SOCK:-/run/kwizera/mt5-hfm-agent.sock}"
TRIES=20

for ((i = 1; i <= TRIES; i++)); do
  if [[ -S "$SOCK" ]]; then
    chown mt5:kwizera "$SOCK" 2>/dev/null || chown mt5:mt5 "$SOCK"
    chmod 660 "$SOCK"
    exit 0
  fi
  sleep 0.25
done

echo "agent_socket_missing path=$SOCK" >&2
exit 1
