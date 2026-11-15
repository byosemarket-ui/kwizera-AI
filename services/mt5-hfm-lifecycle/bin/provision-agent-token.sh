#!/usr/bin/env bash
# Provision /run/kwizera/mt5-hfm-agent.token WITHOUT printing the value.
# Prefers copying from a vault-exported file; otherwise generates a new token
# into the runtime path (backend vault remains source of truth when Node runs ensureMt5HfmAgentToken).
set -euo pipefail

TOKEN_FILE="${KWIZERA_MT5_HFM_AGENT_TOKEN_FILE:-/run/kwizera/mt5-hfm-agent.token}"
RUN_ROOT="${KWIZERA_MT5_HFM_RUN_ROOT:-/run/kwizera}"
SOURCE_FILE="${1:-}"

mkdir -p "$RUN_ROOT"
chmod 755 "$RUN_ROOT"

if [[ -n "$SOURCE_FILE" ]]; then
  if [[ ! -f "$SOURCE_FILE" ]]; then
    echo "source_token_missing" >&2
    exit 1
  fi
  install -m 640 -o mt5 -g kwizera "$SOURCE_FILE" "$TOKEN_FILE" 2>/dev/null \
    || install -m 640 -o mt5 -g mt5 "$SOURCE_FILE" "$TOKEN_FILE"
  shred -u "$SOURCE_FILE" 2>/dev/null || rm -f "$SOURCE_FILE"
  echo "agent_token_provisioned_from_source path=$TOKEN_FILE"
  exit 0
fi

if [[ -f "$TOKEN_FILE" ]]; then
  if getent group kwizera >/dev/null 2>&1; then
    chown mt5:kwizera "$TOKEN_FILE"
  else
    chown mt5:mt5 "$TOKEN_FILE"
  fi
  chmod 640 "$TOKEN_FILE"
  echo "agent_token_already_present path=$TOKEN_FILE"
  exit 0
fi

# Generate without echoing value.
umask 077
TMP="$(mktemp)"
python3 - <<'PY' >"$TMP"
import secrets
print(secrets.token_urlsafe(32), end="")
PY

if getent group kwizera >/dev/null 2>&1; then
  install -m 640 -o mt5 -g kwizera "$TMP" "$TOKEN_FILE"
else
  install -m 640 -o mt5 -g mt5 "$TMP" "$TOKEN_FILE"
fi
shred -u "$TMP" 2>/dev/null || rm -f "$TMP"
echo "agent_token_generated path=$TOKEN_FILE (sync into vault via backend ensureMt5HfmAgentToken / rotate)"
