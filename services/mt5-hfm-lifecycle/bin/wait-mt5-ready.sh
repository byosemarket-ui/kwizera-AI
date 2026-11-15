#!/usr/bin/env bash
# Readiness for kwizera-mt5-hfm-agent ExecStartPre.
# Prefer a running HFM terminal64. If absent, accept Xvfb + terminal binary so the
# agent can start and perform Demo login (which starts the terminal).
# No login/trading checks.
set -euo pipefail

TRIES="${KWIZERA_MT5_READY_TRIES:-60}"
TERM_EXE="${KWIZERA_MT5_TERM_EXE:-/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/terminal64.exe}"
DISPLAY_NUM="${KWIZERA_MT5_DISPLAY:-:97}"

for ((i = 1; i <= TRIES; i++)); do
  if pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1; then
    exit 0
  fi
  # Fallback: display + Wine binary present (agent login will start terminal).
  if [[ -x /opt/wine-staging/bin/wine || -x /usr/bin/wine ]] \
    && [[ -f "$TERM_EXE" ]] \
    && pgrep -u mt5 -f "Xvfb ${DISPLAY_NUM}" >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done

echo "mt5_terminal_not_ready" >&2
exit 1
