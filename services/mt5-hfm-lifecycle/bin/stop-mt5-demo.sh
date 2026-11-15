#!/usr/bin/env bash
# Stop only the HFM Demo terminal for this Wine prefix.
# Does NOT pkill globally. Does NOT touch other users' Wine.
# Does NOT stop Xvfb. Does NOT stop kwizera-ai / forexconnect.
set -euo pipefail

WINEPREFIX="${WINEPREFIX:-/home/mt5/.wine-hfm}"
WINE_BIN_DIR="${KWIZERA_MT5_WINE_BIN_DIR:-/opt/wine-staging/bin}"
export WINEPREFIX
export WINEARCH="${WINEARCH:-win64}"
export WINEDEBUG="${WINEDEBUG:--all}"
export PATH="$WINE_BIN_DIR:/usr/bin:/bin"

# Graceful: ask wineserver for this prefix only to terminate its children.
# wineserver -k is scoped to $WINEPREFIX — not system-wide Wine.
if [[ -x "$WINE_BIN_DIR/wineserver" ]]; then
  "$WINE_BIN_DIR/wineserver" -k || true
fi

# If a stray terminal64 for this prefix remains, SIGTERM that PID only.
while read -r pid; do
  [[ -z "$pid" ]] && continue
  # Confirm command line still references this prefix or HFM path before signal.
  cmd="$(tr '\0' ' ' </proc/$pid/cmdline 2>/dev/null || true)"
  if echo "$cmd" | grep -q 'HFM Metatrader 5/terminal64.exe'; then
    kill -TERM "$pid" 2>/dev/null || true
  fi
done < <(pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' || true)

# Brief wait; systemd TimeoutStopSec covers the rest.
for _ in 1 2 3 4 5; do
  if ! pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

exit 0
