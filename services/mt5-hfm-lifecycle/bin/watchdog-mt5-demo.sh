#!/usr/bin/env bash
# If HFM terminal64 is absent but Xvfb :97 is up, re-authenticate Demo via admin login API.
# Never prints passwords. Demo-only. No orders.
set -euo pipefail

if pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1; then
  echo "watchdog_ok terminal_running"
  exit 0
fi

if ! pgrep -u mt5 -f 'Xvfb :97' >/dev/null 2>&1; then
  echo "watchdog_skip xvfb_missing"
  exit 0
fi

if ! systemctl is-active --quiet kwizera-mt5-hfm-agent.service; then
  echo "watchdog_skip agent_inactive"
  exit 0
fi

if ! systemctl is-active --quiet kwizera-ai.service; then
  echo "watchdog_skip ai_inactive"
  exit 0
fi

MAINPID="$(systemctl show kwizera-ai.service -p MainPID --value)"
if [[ -z "$MAINPID" || "$MAINPID" == "0" ]]; then
  echo "watchdog_skip ai_pid_missing"
  exit 0
fi

TOKEN="$(tr '\0' '\n' < "/proc/$MAINPID/environ" | sed -n 's/^KWIZERA_ADMIN_API_TOKEN=//p' | head -1)"
PORT="$(tr '\0' '\n' < "/proc/$MAINPID/environ" | sed -n 's/^KWIZERA_PORT=//p' | head -1)"
PORT="${PORT:-5173}"
if [[ -z "$TOKEN" ]]; then
  echo "watchdog_fail admin_token_missing" >&2
  exit 2
fi

echo "watchdog_relogin_begin"
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
# Confirm process present
sleep 2
if pgrep -u mt5 -f 'HFM Metatrader 5/terminal64.exe' >/dev/null 2>&1; then
  echo "watchdog_ok terminal_restored"
  exit 0
fi
echo "watchdog_fail terminal_missing_after_login" >&2
exit 7
