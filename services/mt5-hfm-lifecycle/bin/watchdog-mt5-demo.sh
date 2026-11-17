#!/usr/bin/env bash
# HFM Demo terminal watchdog.
# - Missing terminal64 OR stale MQL snapshot → recover.
# Prefers systemd demo unit (vault-backed login.ini). Falls back to admin login API.
# Never prints passwords. Demo-only. No orders.
set -euo pipefail

SNAP_PATH="${KWIZERA_MT5_HFM_SNAPSHOT:-/home/mt5/.wine-hfm/drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files/kwizera_readonly_snapshot.json}"
MAX_STALE_SEC="${KWIZERA_MT5_HFM_WATCHDOG_MAX_STALE_SEC:-180}"
LIFE="${KWIZERA_APP_ROOT:-/opt/kwizera-ai}/services/mt5-hfm-lifecycle"

terminal_running() {
  pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1
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

need_relogin=0
reason=""

if terminal_running; then
  age="$(snapshot_age_sec)"
  if [[ "$age" -le "$MAX_STALE_SEC" ]]; then
    echo "watchdog_ok terminal_running snapshot_age_sec=$age"
    exit 0
  fi
  need_relogin=1
  reason="snapshot_stale age_sec=$age max=$MAX_STALE_SEC"
else
  need_relogin=1
  reason="terminal_missing"
fi

if ! pgrep -u mt5 -f 'Xvfb :97' >/dev/null 2>&1; then
  echo "watchdog_skip xvfb_missing reason=$reason"
  exit 0
fi

echo "watchdog_recover_begin reason=$reason"

# Clear any prior instance so start-mt5-demo.sh cannot hit terminal_already_running,
# and so systemd Restart= cannot race an in-flight vault login.
if systemctl cat kwizera-mt5-hfm-demo.service >/dev/null 2>&1; then
  systemctl stop kwizera-mt5-hfm-demo.service 2>/dev/null || true
fi
if [[ -x "$LIFE/bin/stop-mt5-demo.sh" ]]; then
  sudo -u mt5 env WINEPREFIX=/home/mt5/.wine-hfm "$LIFE/bin/stop-mt5-demo.sh" 2>/dev/null || true
fi
sleep 2

recovered=0
if systemctl cat kwizera-mt5-hfm-demo.service >/dev/null 2>&1; then
  echo "watchdog_recover_via systemd_demo"
  if systemctl start kwizera-mt5-hfm-demo.service; then
    # Give Wine + EA time to auth and write snapshot.
    for _ in $(seq 1 40); do
      if terminal_running; then
        age="$(snapshot_age_sec)"
        if [[ "$age" -le "$MAX_STALE_SEC" ]]; then
          recovered=1
          break
        fi
      fi
      sleep 3
    done
  fi
fi

if [[ "$recovered" -eq 0 ]]; then
  echo "watchdog_recover_fallback admin_login_api"
  if ! systemctl is-active --quiet kwizera-mt5-hfm-agent.service || ! systemctl is-active --quiet kwizera-ai.service; then
    echo "watchdog_fail fallback_services_inactive" >&2
    exit 5
  fi
  MAINPID="$(systemctl show kwizera-ai.service -p MainPID --value)"
  TOKEN="$(tr '\0' '\n' < "/proc/$MAINPID/environ" 2>/dev/null | sed -n 's/^KWIZERA_ADMIN_API_TOKEN=//p' | head -1 || true)"
  PORT="$(tr '\0' '\n' < "/proc/$MAINPID/environ" 2>/dev/null | sed -n 's/^KWIZERA_PORT=//p' | head -1 || true)"
  PORT="${PORT:-5173}"
  if [[ -z "$TOKEN" && -f /opt/kwizera-ai/.env ]]; then
    TOKEN="$(sed -n 's/^KWIZERA_ADMIN_API_TOKEN=//p' /opt/kwizera-ai/.env | head -1 | tr -d '\r')"
  fi
  if [[ -z "$TOKEN" ]]; then
    echo "watchdog_fail admin_token_missing" >&2
    exit 2
  fi
  set +e
  code="$(curl -sS -o /tmp/hfm-watchdog-login.json -w '%{http_code}' --max-time 240 \
    -H "x-kwizera-admin-token: ${TOKEN}" -H 'content-type: application/json' \
    -X POST "http://127.0.0.1:${PORT}/api/forex/providers/mt5-hfm/login" \
    -d '{}')"
  curl_rc=$?
  python3 - <<'PY'
import json
try:
  d=json.load(open("/tmp/hfm-watchdog-login.json"))
except Exception as e:
  print("watchdog_parse_err", type(e).__name__)
  raise SystemExit(1)
auth=bool(d.get("authenticatedLogin") or (d.get("bridge") or {}).get("authenticatedLogin"))
print("login_http_auth", auth)
raise SystemExit(0 if auth else 6)
PY
  auth_rc=$?
  set -e
  echo "watchdog_relogin_http=$code curl_rc=$curl_rc auth_rc=$auth_rc"
  if [[ "$curl_rc" != "0" || "$code" != "200" || "$auth_rc" != "0" ]]; then
    exit 6
  fi
fi

sleep 2
if ! terminal_running; then
  echo "watchdog_fail terminal_missing_after_recover" >&2
  exit 7
fi
age="$(snapshot_age_sec)"
if [[ "$age" -gt "$MAX_STALE_SEC" ]]; then
  echo "watchdog_fail snapshot_still_stale age_sec=$age" >&2
  exit 8
fi
echo "watchdog_ok terminal_restored snapshot_age_sec=$age"
exit 0
