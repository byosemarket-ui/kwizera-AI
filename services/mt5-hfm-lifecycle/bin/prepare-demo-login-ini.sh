#!/usr/bin/env bash
# Root/privileged helper: write vault-backed Demo login.ini for MT5 startup.
# Never echoes password. Sets ownership so User=mt5 can read the ini.
set -euo pipefail

ROOT="${KWIZERA_APP_ROOT:-/opt/kwizera-ai}"
RUN_DIR="${KWIZERA_MT5_HFM_RUN_DIR:-/run/kwizera/mt5-hfm}"
STORAGE="${KWIZERA_STORAGE_ROOT:-/var/lib/kwizera-ai-studio}"
MODE="${1:-}" # optional: --validate

umask 0077
mkdir -p "$RUN_DIR"
chmod 0750 "$RUN_DIR" || true
# Ensure mt5 can traverse /run/kwizera (agent runtime also uses this tree).
if [[ -d /run/kwizera ]]; then
  chown mt5:kwizera /run/kwizera 2>/dev/null || true
  chmod 0750 /run/kwizera 2>/dev/null || true
fi
chown mt5:kwizera "$RUN_DIR" 2>/dev/null || true

# Load app env for vault passphrase without printing it.
set -a
# shellcheck disable=SC1091
[[ -f "$ROOT/.env" ]] && . "$ROOT/.env"
set +a
export KWIZERA_APP_ROOT="$ROOT"
export KWIZERA_STORAGE_ROOT="${KWIZERA_STORAGE_ROOT:-$STORAGE}"
export KWIZERA_MT5_HFM_RUN_DIR="$RUN_DIR"
export WINEPREFIX="${WINEPREFIX:-/home/mt5/.wine-hfm}"

# Run Node as kwizera (vault owner). Drop secrets from argv.
ARGS=()
if [[ "$MODE" == "--validate" ]]; then
  ARGS+=(--validate)
fi

sudo -u kwizera -H env \
  KWIZERA_APP_ROOT="$KWIZERA_APP_ROOT" \
  KWIZERA_STORAGE_ROOT="$KWIZERA_STORAGE_ROOT" \
  KWIZERA_MT5_HFM_RUN_DIR="$RUN_DIR" \
  WINEPREFIX="$WINEPREFIX" \
  HOME=/home/kwizera \
  PATH="/usr/bin:/bin:$ROOT/node_modules/.bin" \
  node "$ROOT/services/mt5-hfm-lifecycle/bin/write-demo-login-ini.mjs" "${ARGS[@]}"

# Ownership for mt5 terminal process (and shred later).
if [[ -f "$RUN_DIR/startup.env" ]]; then
  # shellcheck disable=SC1090
  source "$RUN_DIR/startup.env"
  if [[ -n "${INI_BASENAME:-}" && -f "$RUN_DIR/$INI_BASENAME" ]]; then
    chown mt5:mt5 "$RUN_DIR/$INI_BASENAME"
    chmod 0600 "$RUN_DIR/$INI_BASENAME"
  fi
  chown mt5:kwizera "$RUN_DIR/startup.env"
  chmod 0640 "$RUN_DIR/startup.env"
fi
