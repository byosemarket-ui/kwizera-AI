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
# Core (kwizera group) must traverse RUN_DIR to read candles-cache.json for C7.
if getent group kwizera >/dev/null 2>&1; then
  chown mt5:kwizera "$RUN_DIR"
else
  chown mt5:mt5 "$RUN_DIR"
fi
chmod 750 "$RUN_DIR"

# Stale socket from a previous crash — remove only our AF_UNIX path.
if [[ -e "$SOCK" ]]; then
  rm -f "$SOCK"
fi

# /run is tmpfs — restore token from vault after reboot. Never log contents.
if [[ ! -f "$TOKEN" ]]; then
  ROOT="${KWIZERA_APP_ROOT:-/opt/kwizera-ai}"
  SYNC="$ROOT/services/mt5-hfm-lifecycle/bin/sync-agent-token-from-vault.mjs"
  PROVISION="$ROOT/services/mt5-hfm-lifecycle/bin/provision-agent-token.sh"
  if [[ -f "$SYNC" && -x "$PROVISION" ]]; then
    set -a
    # shellcheck disable=SC1091
    [[ -f "$ROOT/.env" ]] && . "$ROOT/.env"
    set +a
    TMP_PATH="$(
      sudo -u kwizera -H env \
        KWIZERA_APP_ROOT="$ROOT" \
        KWIZERA_STORAGE_ROOT="${KWIZERA_STORAGE_ROOT:-/var/lib/kwizera-ai-studio}" \
        KWIZERA_SECRETS_PASSPHRASE="${KWIZERA_SECRETS_PASSPHRASE:-}" \
        HOME=/home/kwizera \
        PATH="/usr/bin:/bin" \
        node "$SYNC"
    )"
    if [[ -n "$TMP_PATH" && -f "$TMP_PATH" ]]; then
      "$PROVISION" "$TMP_PATH"
    fi
  fi
fi
if [[ ! -f "$TOKEN" ]]; then
  echo "agent_token_missing path=$TOKEN (vault sync failed; provision before enabling agent unit)" >&2
  exit 1
fi

if getent group kwizera >/dev/null 2>&1; then
  chown mt5:kwizera "$TOKEN"
else
  chown mt5:mt5 "$TOKEN"
fi
chmod 640 "$TOKEN"
