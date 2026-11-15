#!/usr/bin/env bash
# Start HFM MT5 Demo terminal under Wine Staging. Demo-only. No Live. No orders.
set -euo pipefail

WINE_BIN="${KWIZERA_MT5_WINE_BIN:-/opt/wine-staging/bin/wine}"
WINEPREFIX="${WINEPREFIX:-/home/mt5/.wine-hfm}"
TERM_EXE="${KWIZERA_MT5_TERM_EXE:-$WINEPREFIX/drive_c/Program Files/HFM Metatrader 5/terminal64.exe}"
DISPLAY_VAL="${DISPLAY:-:97}"
XAUTH="${XAUTHORITY:-/home/mt5/.mt5-xauth/Xauthority}"

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

# Portable mode verified on VPS (process currently launched with /portable).
exec "$WINE_BIN" "$TERM_EXE" /portable
