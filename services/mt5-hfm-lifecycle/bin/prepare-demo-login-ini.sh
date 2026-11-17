#!/usr/bin/env bash
# Root/privileged helper: vault → staged login.ini → /run/kwizera/mt5-hfm (mt5:0600).
# Never echoes password.
set -euo pipefail

ROOT="${KWIZERA_APP_ROOT:-/opt/kwizera-ai}"
RUN_DIR="${KWIZERA_MT5_HFM_RUN_DIR:-/run/kwizera/mt5-hfm}"
STORAGE="${KWIZERA_STORAGE_ROOT:-/var/lib/kwizera-ai-studio}"
MODE="${1:-}" # optional: --validate
STAGE_DIR="${KWIZERA_MT5_HFM_LOGIN_STAGE_DIR:-/home/kwizera/.kwizera-mt5-hfm-login-stage}"

umask 0077
mkdir -p /run/kwizera "$RUN_DIR"
chown mt5:kwizera /run/kwizera 2>/dev/null || true
chmod 0750 /run/kwizera 2>/dev/null || true
chown mt5:kwizera "$RUN_DIR" 2>/dev/null || true
chmod 0750 "$RUN_DIR" 2>/dev/null || true

set -a
# shellcheck disable=SC1091
[[ -f "$ROOT/.env" ]] && . "$ROOT/.env"
set +a
export KWIZERA_APP_ROOT="$ROOT"
export KWIZERA_STORAGE_ROOT="${KWIZERA_STORAGE_ROOT:-$STORAGE}"
export KWIZERA_MT5_HFM_RUN_DIR="$RUN_DIR"
export KWIZERA_MT5_HFM_LOGIN_STAGE_DIR="$STAGE_DIR"
export WINEPREFIX="${WINEPREFIX:-/home/mt5/.wine-hfm}"

ARGS=()
if [[ "$MODE" == "--validate" ]]; then
  ARGS+=(--validate)
fi

# Ensure staging dir exists and is private to kwizera.
install -d -o kwizera -g kwizera -m 0700 "$STAGE_DIR"

OUT="$(
  sudo -u kwizera -H env \
    KWIZERA_APP_ROOT="$KWIZERA_APP_ROOT" \
    KWIZERA_STORAGE_ROOT="$KWIZERA_STORAGE_ROOT" \
    KWIZERA_MT5_HFM_RUN_DIR="$RUN_DIR" \
    KWIZERA_MT5_HFM_LOGIN_STAGE_DIR="$STAGE_DIR" \
    WINEPREFIX="$WINEPREFIX" \
    HOME=/home/kwizera \
    PATH="/usr/bin:/bin" \
    node "$ROOT/services/mt5-hfm-lifecycle/bin/write-demo-login-ini.mjs" "${ARGS[@]}"
)"
printf '%s\n' "$OUT"

INI_BASENAME="$(printf '%s\n' "$OUT" | sed -n 's/^INI_BASENAME=//p' | head -1)"
if [[ -z "$INI_BASENAME" ]]; then
  echo "prepare_demo_login_ini_failed missing_basename" >&2
  exit 1
fi

# Non-secret startup.env for the mt5 start script (always refresh).
LOGIN_HINT="$(printf '%s\n' "$OUT" | sed -n 's/^LOGIN_HINT=//p' | head -1)"
SERVER="$(printf '%s\n' "$OUT" | sed -n 's/^SERVER=//p' | head -1)"
EXPERT="$(printf '%s\n' "$OUT" | sed -n 's/^EXPERT=//p' | head -1)"
printf 'INI_BASENAME=%s\nLOGIN_HINT=%s\nSERVER=%s\nEXPERT=%s\n' \
  "$INI_BASENAME" "$LOGIN_HINT" "$SERVER" "$EXPERT" >"$RUN_DIR/startup.env"
chown mt5:kwizera "$RUN_DIR/startup.env"
chmod 0640 "$RUN_DIR/startup.env"

if [[ "$MODE" == "--validate" ]]; then
  # Ini already shredded by Node; ensure no staged leftovers.
  rm -f "$STAGE_DIR/$INI_BASENAME" 2>/dev/null || true
  echo "prepare_validate_ok"
  exit 0
fi

if [[ ! -f "$STAGE_DIR/$INI_BASENAME" ]]; then
  echo "staged_ini_missing" >&2
  exit 1
fi

# Atomic-ish install into the Wine-visible run dir.
install -o mt5 -g mt5 -m 0600 "$STAGE_DIR/$INI_BASENAME" "$RUN_DIR/$INI_BASENAME"
# Shred staged copy.
size=$(wc -c <"$STAGE_DIR/$INI_BASENAME" | tr -d ' ')
dd if=/dev/zero of="$STAGE_DIR/$INI_BASENAME" bs=1 count="$size" conv=notrunc status=none 2>/dev/null || true
rm -f "$STAGE_DIR/$INI_BASENAME"
echo "prepare_demo_login_ini_ok path=$RUN_DIR/$INI_BASENAME"
