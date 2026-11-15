#!/usr/bin/env bash
# Prepare /run/kwizera paths for the Demo agent socket (root-capable).
# Does not create or print secrets. Token file must already exist for agent start.
set -euo pipefail

RUN_ROOT="${KWIZERA_MT5_HFM_RUN_ROOT:-/run/kwizera}"
RUN_DIR="${KWIZERA_MT5_HFM_RUN_DIR:-/run/kwizera/mt5-hfm}"
SOCK="${KWIZERA_MT5_HFM_AGENT_SOCK:-/run/kwizera/mt5-hfm-agent.sock}"
TOKEN="${KWIZERA_MT5_HFM_AGENT_TOKEN_FILE:-/run/kwizera/mt5-hfm-agent.token}"

mkdir -p "$RUN_ROOT" "$RUN_DIR"

# Socket lives directly under RUN_ROOT — mt5 must be able to bind(2) there.
if getent group kwizera >/dev/null 2>&1; then
  chown mt5:kwizera "$RUN_ROOT"
else
  chown mt5:mt5 "$RUN_ROOT"
fi
chmod 775 "$RUN_ROOT"
chown mt5:mt5 "$RUN_DIR"
chmod 750 "$RUN_DIR"

# Stale socket from a previous crash — remove only our AF_UNIX path.
if [[ -e "$SOCK" ]]; then
  rm -f "$SOCK"
fi

# Token must be provisioned out-of-band (vault → file). Never log contents.
if [[ ! -f "$TOKEN" ]]; then
  echo "agent_token_missing path=$TOKEN (provision before enabling agent unit)" >&2
  exit 1
fi

if getent group kwizera >/dev/null 2>&1; then
  chown mt5:kwizera "$TOKEN"
else
  chown mt5:mt5 "$TOKEN"
fi
chmod 640 "$TOKEN"
