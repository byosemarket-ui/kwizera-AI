#!/usr/bin/env bash
# Start HFM MT5 Demo terminal under Wine Staging with vault-backed login.ini.
# Demo-only. No Live. No orders. Password never on argv (only inside short-lived ini).
set -euo pipefail

WINE_BIN="${KWIZERA_MT5_WINE_BIN:-/opt/wine-staging/bin/wine}"
WINEPREFIX="${WINEPREFIX:-/home/mt5/.wine-hfm}"
TERM_EXE="${KWIZERA_MT5_TERM_EXE:-$WINEPREFIX/drive_c/Program Files/HFM Metatrader 5/terminal64.exe}"
DISPLAY_VAL="${DISPLAY:-:97}"
XAUTH="${XAUTHORITY:-/home/mt5/.mt5-xauth/Xauthority}"
RUN_DIR="${KWIZERA_MT5_HFM_RUN_DIR:-/run/kwizera/mt5-hfm}"
STARTUP_ENV="${KWIZERA_MT5_HFM_STARTUP_ENV:-$RUN_DIR/startup.env}"

export HOME="${HOME:-/home/mt5}"
export USER="${USER:-mt5}"
export LOGNAME="${LOGNAME:-mt5}"
export WINEPREFIX
export WINEARCH="${WINEARCH:-win64}"
export WINEDEBUG="${WINEDEBUG:--all}"
export DISPLAY="$DISPLAY_VAL"
export XAUTHORITY="$XAUTH"
export PATH="/opt/wine-staging/bin:/usr/bin:/bin"

if [[ ! -x "$WINE_BIN" ]]; then
  echo "wine_missing path=$WINE_BIN" >&2
  exit 1
fi
if [[ ! -f "$TERM_EXE" ]]; then
  echo "terminal_missing path=$TERM_EXE" >&2
  exit 1
fi
if [[ "$(id -un)" != "mt5" ]]; then
  echo "must_run_as_mt5 actual=$(id -un)" >&2
  exit 1
fi

# Refuse to launch a second terminal (cutover/stop must clear the live one first).
if pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1; then
  echo "terminal_already_running refuse_duplicate" >&2
  exit 10
fi

if [[ ! -f "$STARTUP_ENV" ]]; then
  echo "startup_env_missing path=$STARTUP_ENV (run prepare-demo-login-ini.sh first)" >&2
  exit 11
fi
# shellcheck disable=SC1090
source "$STARTUP_ENV"
if [[ -z "${INI_BASENAME:-}" ]]; then
  echo "ini_basename_missing" >&2
  exit 12
fi
INI_PATH="$RUN_DIR/$INI_BASENAME"
if [[ ! -f "$INI_PATH" ]]; then
  echo "login_ini_missing path=$INI_PATH" >&2
  exit 13
fi

# Wine Z: → / mapping makes /run/... available as Z:\run\...
WIN_INI="Z:\\run\\kwizera\\mt5-hfm\\${INI_BASENAME}"

echo "starting_hfm_demo portable=1 server=${SERVER:-unknown} login_hint=${LOGIN_HINT:-unknown} expert=${EXPERT:-0}"

# Shred login.ini after MT5 has had time to read it (password must not linger).
(
  sleep 25
  if [[ -f "$INI_PATH" ]]; then
    size=$(wc -c <"$INI_PATH" | tr -d ' ')
    dd if=/dev/zero of="$INI_PATH" bs=1 count="$size" conv=notrunc status=none 2>/dev/null || true
    rm -f "$INI_PATH" || true
  fi
) >/dev/null 2>&1 &

exec "$WINE_BIN" "$TERM_EXE" /portable "/config:${WIN_INI}"
