#!/usr/bin/env bash
# Controlled MT5-only restart using the established lifecycle (systemd demo unit).
# Does NOT restart Core, Agent, or Xvfb.
# Does NOT pkill broadly. Bounded retries. Clear diagnostics.
#
# Usage (root): /opt/kwizera-ai/services/mt5-hfm-lifecycle/bin/controlled-mt5-restart.sh
set -euo pipefail

ROOT="${KWIZERA_APP_ROOT:-/opt/kwizera-ai}"
LIFE="$ROOT/services/mt5-hfm-lifecycle"
RUN_DIR="${KWIZERA_MT5_HFM_RUN_DIR:-/run/kwizera/mt5-hfm}"
SNAP_PATH="${KWIZERA_MT5_HFM_SNAPSHOT:-/home/mt5/.wine-hfm/drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files/kwizera_readonly_snapshot.json}"
LOG_DIR="/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/logs"
MAX_ATTEMPTS="${KWIZERA_MT5_RESTART_MAX_ATTEMPTS:-2}"
READY_TIMEOUT_SEC="${KWIZERA_MT5_RESTART_READY_TIMEOUT_SEC:-120}"

log() { echo "controlled_mt5_restart $*"; }

terminal_pids() {
  pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' || true
}

terminal_count() {
  terminal_pids | wc -l | tr -d ' '
}

snapshot_age_sec() {
  SNAP_PATH="$SNAP_PATH" python3 - <<'PY'
import os, time
p = os.environ["SNAP_PATH"]
try:
  print(int(time.time() - os.path.getmtime(p)))
except OSError:
  print(999999)
PY
}

expert_loaded_recent() {
  python3 - <<'PY'
from pathlib import Path
import re, time
log_dir = Path("/home/mt5/.wine-hfm/drive_c/Program Files/HFM Metatrader 5/logs")
logs = sorted(log_dir.glob("2026*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
if not logs:
  raise SystemExit(1)
raw = logs[0].read_bytes()
text = raw.decode("utf-16", errors="ignore")
hits = [ln for ln in text.splitlines() if "KwizeraReadonlySnapshot" in ln and "loaded successfully" in ln]
if not hits:
  raise SystemExit(1)
# Accept if a load line exists for today (journal already filtered by file date).
print(hits[-1][:200])
raise SystemExit(0)
PY
}

preflight() {
  log "preflight_begin"
  if ! systemctl is-active --quiet kwizera-mt5-xvfb.service && ! pgrep -u mt5 -f 'Xvfb :97' >/dev/null; then
    log "fail xvfb_missing"
    exit 10
  fi
  if ! systemctl is-active --quiet kwizera-mt5-hfm-agent.service; then
    log "fail agent_inactive"
    exit 11
  fi
  if ! systemctl is-active --quiet kwizera-ai.service; then
    log "fail core_inactive"
    exit 12
  fi
  agent_before="$(pgrep -u mt5 -f 'services/mt5-hfm-agent/agent.py' | head -1 || true)"
  xvfb_before="$(pgrep -u mt5 -f 'Xvfb :97' | head -1 || true)"
  core_before="$(systemctl show kwizera-ai.service -p MainPID --value)"
  mt5_before="$(terminal_pids | head -1 || true)"
  printf 'agent_before=%s\nxvfb_before=%s\ncore_before=%s\nmt5_before=%s\nmt5_count_before=%s\n' \
    "$agent_before" "$xvfb_before" "$core_before" "$mt5_before" "$(terminal_count)"
  log "preflight_ok"
}

postflight() {
  local attempt="$1"
  log "postflight_begin attempt=$attempt"
  local mt5_after agent_after xvfb_after core_after
  mt5_after="$(terminal_pids | head -1 || true)"
  agent_after="$(pgrep -u mt5 -f 'services/mt5-hfm-agent/agent.py' | head -1 || true)"
  xvfb_after="$(pgrep -u mt5 -f 'Xvfb :97' | head -1 || true)"
  core_after="$(systemctl show kwizera-ai.service -p MainPID --value)"
  count="$(terminal_count)"
  printf 'mt5_after=%s\nmt5_count=%s\nagent_after=%s\nxvfb_after=%s\ncore_after=%s\n' \
    "$mt5_after" "$count" "$agent_after" "$xvfb_after" "$core_after"

  if [[ -z "$mt5_after" ]]; then
    log "fail terminal_missing"
    return 1
  fi
  if [[ "$count" -gt 1 ]]; then
    log "fail duplicate_terminals count=$count"
    return 1
  fi
  if [[ -n "${agent_before:-}" && "$agent_after" != "$agent_before" ]]; then
    log "fail agent_pid_changed"
    return 1
  fi
  if [[ -n "${xvfb_before:-}" && "$xvfb_after" != "$xvfb_before" ]]; then
    log "fail xvfb_pid_changed"
    return 1
  fi
  if [[ -n "${core_before:-}" && "$core_after" != "$core_before" ]]; then
    log "fail core_pid_changed"
    return 1
  fi

  local ready=0 age=999999
  for _ in $(seq 1 "$READY_TIMEOUT_SEC"); do
    age="$(snapshot_age_sec)"
    if [[ "$age" -le 180 ]]; then
      ready=1
      break
    fi
    sleep 1
  done
  if [[ "$ready" -ne 1 ]]; then
    log "fail snapshot_not_ready age_sec=$age"
    return 1
  fi
  if ! expert_loaded_recent; then
    log "fail expert_not_loaded"
    return 1
  fi
  log "postflight_ok snapshot_age_sec=$age mt5_pid=$mt5_after"
  return 0
}

do_restart_once() {
  log "restart_begin"
  # Pause watchdog during controlled window to avoid racing a second recover.
  systemctl stop kwizera-mt5-hfm-watchdog.timer 2>/dev/null || true

  if systemctl cat kwizera-mt5-hfm-demo.service >/dev/null 2>&1; then
    systemctl stop kwizera-mt5-hfm-demo.service 2>/dev/null || true
  fi
  if [[ -x "$LIFE/bin/stop-mt5-demo.sh" ]]; then
    sudo -u mt5 env WINEPREFIX=/home/mt5/.wine-hfm "$LIFE/bin/stop-mt5-demo.sh" || true
  fi
  sleep 2
  if [[ "$(terminal_count)" -gt 0 ]]; then
    log "fail terminal_still_running_after_stop"
    systemctl start kwizera-mt5-hfm-watchdog.timer 2>/dev/null || true
    return 1
  fi

  if [[ -x "$LIFE/bin/prepare-demo-login-ini.sh" ]]; then
    "$LIFE/bin/prepare-demo-login-ini.sh" || {
      log "fail prepare_login_ini"
      systemctl start kwizera-mt5-hfm-watchdog.timer 2>/dev/null || true
      return 1
    }
  fi

  if systemctl cat kwizera-mt5-hfm-demo.service >/dev/null 2>&1; then
    log "start_via systemd_demo"
    systemctl start kwizera-mt5-hfm-demo.service
  else
    log "fail demo_unit_missing"
    systemctl start kwizera-mt5-hfm-watchdog.timer 2>/dev/null || true
    return 1
  fi

  # Wait for wineserver/terminal PID to appear (not just unit active).
  local appeared=0
  for _ in $(seq 1 60); do
    if [[ "$(terminal_count)" -ge 1 ]]; then
      appeared=1
      break
    fi
    sleep 1
  done
  systemctl start kwizera-mt5-hfm-watchdog.timer 2>/dev/null || true
  if [[ "$appeared" -ne 1 ]]; then
    log "fail terminal_pid_timeout"
    return 1
  fi
  if [[ "$(terminal_count)" -gt 1 ]]; then
    log "fail refuse_duplicate count=$(terminal_count)"
    return 1
  fi
  log "restart_spawn_ok"
  return 0
}

main() {
  if [[ "$(id -u)" -ne 0 ]]; then
    log "fail must_run_as_root"
    exit 2
  fi
  preflight
  local attempt=1
  while [[ "$attempt" -le "$MAX_ATTEMPTS" ]]; do
    log "attempt=$attempt max=$MAX_ATTEMPTS"
    if do_restart_once && postflight "$attempt"; then
      log "success attempt=$attempt"
      exit 0
    fi
    log "attempt_failed attempt=$attempt"
    attempt=$((attempt + 1))
    sleep 3
  done
  log "fail exhausted_attempts"
  # Ensure watchdog is running for automatic recovery.
  systemctl start kwizera-mt5-hfm-watchdog.timer 2>/dev/null || true
  exit 1
}

main "$@"
