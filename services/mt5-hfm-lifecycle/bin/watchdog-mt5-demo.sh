#!/usr/bin/env bash
# HFM Demo terminal watchdog.
# - If terminal64 is missing → vault Demo login via admin API.
# - If terminal64 exists but MQL snapshot is stale → same re-login.
# Before login, stop systemd demo unit (if active) so Restart=on-failure cannot race.
# Never prints passwords. Demo-only. No orders.
set -euo pipefail

SNAP_PATH="${KWIZERA_MT5_HFM_SNAPSHOT:-/home/mt5/.wine-hfm/drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files/kwizera_readonly_snapshot.json}"
MAX_STALE_SEC="${KWIZERA_MT5_HFM_WATCHDOG_MAX_STALE_SEC:-180}"

terminal_running() {
  pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1
}

snapshot_age_sec() {
  python3 - <<PY
import os, time
p = os.environ.get("SNAP_PATH", "${SNAP_PATH}")
try:
  age = time.time() - os.path.getmtime(p)
  print(int(age))
except OSError:
  print(999999)
PY
}

need_relogin=0
reason=""

if terminal_running; then
  export SNAP_PATH
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

if ! systemctl is-active --quiet kwizera-mt5-hfm-agent.service; then
  echo "watchdog_skip agent_inactive reason=$reason"
  exit 0
fi

if ! systemctl is-active --quiet kwizera-ai.service; then
  echo "watchdog_skip ai_inactive reason=$reason"
  exit 0
fi

MAINPID="$(systemctl show kwizera-ai.service -p MainPID --value)"
if [[ -z "$MAINPID" || "$MAINPID" == "0" ]]; then
  echo "watchdog_skip ai_pid_missing reason=$reason"
  exit 0
fi

# Prefer live process env; fall back to app .env (token value never echoed).
TOKEN="$(tr '\0' '\n' < "/proc/$MAINPID/environ" 2>/dev/null | sed -n 's/^KWIZERA_ADMIN_API_TOKEN=//p' | head -1 || true)"
PORT="$(tr '\0' '\n' < "/proc/$MAINPID/environ" 2>/dev/null | sed -n 's/^KWIZERA_PORT=//p' | head -1 || true)"
PORT="${PORT:-5173}"
if [[ -z "$TOKEN" && -f /opt/kwizera-ai/.env ]]; then
  TOKEN="$(sed -n 's/^KWIZERA_ADMIN_API_TOKEN=//p' /opt/kwizera-ai/.env | head -1 | tr -d '\r')"
fi
if [[ -z "$TOKEN" ]]; then
  echo "watchdog_fail admin_token_missing reason=$reason" >&2
  exit 2
fi

echo "watchdog_relogin_begin reason=$reason"

# Avoid systemd Restart=on-failure racing agent login (wineserver -k).
if systemctl is-active --quiet kwizera-mt5-hfm-demo.service; then
  echo "watchdog_stop_demo_unit_before_login"
  systemctl stop kwizera-mt5-hfm-demo.service || true
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
  print("watchdog_parse_err", e)
  raise SystemExit(1)
def scrub(x):
  if isinstance(x, list): return [scrub(i) for i in x]
  if isinstance(x, dict):
    return {k:("[redacted]" if any(s in str(k).lower() for s in ("pass","token","secret","mac","pwd")) else scrub(v)) for k,v in x.items()}
  return x
s=scrub(d)
acct=((s.get("bridge") or {}).get("account") or {})
print(json.dumps({
  "ok": s.get("ok"),
  "authenticatedLogin": s.get("authenticatedLogin"),
  "terminalConnected": s.get("terminalConnected"),
  "loginHint": acct.get("loginHint"),
  "server": acct.get("server"),
}, default=str))
auth=bool(s.get("authenticatedLogin") or (s.get("bridge") or {}).get("authenticatedLogin"))
raise SystemExit(0 if auth else 6)
PY
auth_rc=$?
set -e
echo "watchdog_relogin_http=$code curl_rc=$curl_rc auth_rc=$auth_rc"
if [[ "$curl_rc" != "0" || "$code" != "200" || "$auth_rc" != "0" ]]; then
  exit 6
fi

sleep 3
if ! terminal_running; then
  echo "watchdog_fail terminal_missing_after_login" >&2
  exit 7
fi
export SNAP_PATH
age="$(snapshot_age_sec)"
if [[ "$age" -gt "$MAX_STALE_SEC" ]]; then
  echo "watchdog_fail snapshot_still_stale age_sec=$age" >&2
  exit 8
fi
echo "watchdog_ok terminal_restored snapshot_age_sec=$age"
exit 0
