#!/usr/bin/env bash
# Prepare Xauthority cookie for display :97. Idempotent. No process kills.
set -euo pipefail

XAUTH_DIR="${KWIZERA_MT5_XAUTH_DIR:-/home/mt5/.mt5-xauth}"
XAUTH_FILE="${XAUTHORITY:-$XAUTH_DIR/Xauthority}"
DISPLAY_NUM="${KWIZERA_MT5_DISPLAY_NUM:-97}"

umask 0077
mkdir -p "$XAUTH_DIR"
chmod 700 "$XAUTH_DIR"

if [[ ! -f "$XAUTH_FILE" ]] || [[ ! -s "$XAUTH_FILE" ]]; then
  : >"$XAUTH_FILE"
  chmod 600 "$XAUTH_FILE"
  COOKIE="$(mcookie)"
  xauth -f "$XAUTH_FILE" add ":${DISPLAY_NUM}" . "$COOKIE"
  chmod 600 "$XAUTH_FILE"
else
  chmod 600 "$XAUTH_FILE" || true
fi

# Directory must stay private; cookie file never world-readable.
chmod 700 "$XAUTH_DIR"
chmod 600 "$XAUTH_FILE"
