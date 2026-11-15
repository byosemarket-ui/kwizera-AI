#!/usr/bin/env bash
# Wait until DISPLAY :97 is reachable. No process kills.
set -euo pipefail

DISPLAY_VAL="${DISPLAY:-:97}"
XAUTH="${XAUTHORITY:-/home/mt5/.mt5-xauth/Xauthority}"
TRIES="${KWIZERA_MT5_DISPLAY_TRIES:-30}"
SOCK_PATH="/tmp/.X11-unix/X${DISPLAY_VAL#:}"

export DISPLAY="$DISPLAY_VAL"
export XAUTHORITY="$XAUTH"

for ((i = 1; i <= TRIES; i++)); do
  if [[ -S "$SOCK_PATH" ]]; then
    if command -v xdpyinfo >/dev/null 2>&1; then
      if xdpyinfo -display "$DISPLAY_VAL" >/dev/null 2>&1; then
        exit 0
      fi
    else
      # Socket present is sufficient when xdpyinfo is unavailable.
      exit 0
    fi
  fi
  sleep 0.5
done

echo "display_not_ready display=$DISPLAY_VAL sock=$SOCK_PATH" >&2
exit 1
