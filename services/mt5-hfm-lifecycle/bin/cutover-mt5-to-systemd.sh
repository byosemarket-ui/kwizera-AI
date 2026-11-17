#!/usr/bin/env bash
# OWNER APPROVAL REQUIRED.
# Safe cutover of manual Xvfb + agent-started terminal → systemd ownership.
# Refuses to run unless CONFIRM=YES-CUTOVER.
# Demo-only. Does not place orders. Does not print secrets.
set -euo pipefail

if [[ "${CONFIRM:-}" != "YES-CUTOVER" ]]; then
  cat <<'EOF' >&2
cutover_refused: set CONFIRM=YES-CUTOVER after owner approval.

Prepared sequence (do not improvise):
  1) Record API health (quotes LIVE, account snapshot)
  2) systemctl stop kwizera-mt5-hfm-watchdog.timer  (pause during cutover)
  3) stop-mt5-demo.sh (prefix-scoped wineserver -k)
  4) SIGTERM manual Xvfb :97 only (no global pkill)
  5) prepare-xauth.sh as mt5 (regenerate cookie while display down)
  6) systemctl start kwizera-mt5-xvfb.service
  7) wait-display.sh
  8) POST /api/forex/providers/mt5-hfm/login  (vault Demo auth; starts terminal64)
     NOTE: do NOT start kwizera-mt5-hfm-demo.service in the same window —
     systemd ExecStart is /portable without login.ini and Restart=on-failure
     races agent login. After auth is stable, optionally enable demo for boot
     cold-start only; watchdog handles missing/stale terminal.
  9) Verify snapshot age < 30s, 9 LIVE quotes, account fields
 10) systemctl start kwizera-mt5-hfm-watchdog.timer

EOF
  exit 2
fi

LIFE=/opt/kwizera-ai/services/mt5-hfm-lifecycle
BAK=/root/kwizera-hfm-cutover-backup-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$BAK"
cp -a /etc/systemd/system/kwizera-mt5-*.service /etc/systemd/system/kwizera-mt5-*.timer "$BAK/" 2>/dev/null || true
echo "backup=$BAK"

MAINPID=$(systemctl show kwizera-ai.service -p MainPID --value)
TOKEN=$(tr '\0' '\n' < /proc/$MAINPID/environ | sed -n 's/^KWIZERA_ADMIN_API_TOKEN=//p' | head -1 || true)
[[ -z "$TOKEN" && -f /opt/kwizera-ai/.env ]] && TOKEN=$(sed -n 's/^KWIZERA_ADMIN_API_TOKEN=//p' /opt/kwizera-ai/.env | head -1 | tr -d '\r')
PORT=$(tr '\0' '\n' < /proc/$MAINPID/environ | sed -n 's/^KWIZERA_PORT=//p' | head -1 || true)
PORT=${PORT:-5173}
HDR=(-H "x-kwizera-admin-token: ${TOKEN}" -H "content-type: application/json")

echo "=== PRE HEALTH ==="
curl -sS "${HDR[@]}" "http://127.0.0.1:${PORT}/api/forex/providers/mt5-hfm/quotes" -o "$BAK/pre-quotes.json"
python3 - <<PY
import json
from collections import Counter
q=json.load(open("$BAK/pre-quotes.json"))["snapshot"]
print("pre", q.get("feedFreshness"), q.get("sequence"), dict(Counter(x.get("status") for x in q.get("quotes") or [])))
PY

echo "=== PAUSE WATCHDOG ==="
systemctl stop kwizera-mt5-hfm-watchdog.timer

echo "=== STOP TERMINAL (prefix-scoped) ==="
sudo -u mt5 env WINEPREFIX=/home/mt5/.wine-hfm "$LIFE/bin/stop-mt5-demo.sh" || true
sleep 2

echo "=== STOP MANUAL XVFB ==="
XVFB_PID=$(pgrep -u mt5 -f 'Xvfb :97' || true)
if [[ -n "${XVFB_PID:-}" ]]; then
  kill -TERM "$XVFB_PID" || true
  for _ in $(seq 1 20); do
    pgrep -u mt5 -f 'Xvfb :97' >/dev/null || break
    sleep 0.5
  done
fi
if pgrep -u mt5 -f 'Xvfb :97' >/dev/null; then
  echo "xvfb_still_running abort" >&2
  systemctl start kwizera-mt5-hfm-watchdog.timer || true
  exit 3
fi

echo "=== PREPARE XAUTH ==="
sudo -u mt5 env HOME=/home/mt5 XAUTHORITY=/home/mt5/.mt5-xauth/Xauthority \
  KWIZERA_MT5_XAUTH_DIR=/home/mt5/.mt5-xauth KWIZERA_MT5_DISPLAY_NUM=97 \
  "$LIFE/bin/prepare-xauth.sh"
wc -c /home/mt5/.mt5-xauth/Xauthority

echo "=== START SYSTEMD XVFB ==="
systemctl start kwizera-mt5-xvfb.service
systemctl is-active kwizera-mt5-xvfb.service
sudo -u mt5 "$LIFE/bin/wait-display.sh"

echo "=== DEMO LOGIN (vault) — not systemd demo unit ==="
# Ensure demo unit is not running during login.
systemctl stop kwizera-mt5-hfm-demo.service 2>/dev/null || true
code=$(curl -sS -o "$BAK/login.json" -w '%{http_code}' --max-time 240 "${HDR[@]}" \
  -X POST "http://127.0.0.1:${PORT}/api/forex/providers/mt5-hfm/login" -d '{}')
echo "login_http=$code"
python3 - <<PY
import json
d=json.load(open("$BAK/login.json"))
print("authenticatedLogin", d.get("authenticatedLogin"), "terminalConnected", d.get("terminalConnected"))
PY

echo "=== WAIT SNAPSHOT ==="
python3 - <<'PY'
import json, os, time
p="/home/mt5/.wine-hfm/drive_c/users/mt5/AppData/Roaming/MetaQuotes/Terminal/Common/Files/kwizera_readonly_snapshot.json"
deadline=time.time()+120
while time.time()<deadline:
  if os.path.isfile(p) and time.time()-os.path.getmtime(p) <= 15:
    d=json.loads(open(p,encoding="utf-8",errors="replace").read())
    print("READY age", round(time.time()-os.path.getmtime(p),1), "seq", d.get("seq"), "login", (d.get("account") or {}).get("loginExact"))
    break
  time.sleep(3)
else:
  raise SystemExit("snapshot_timeout")
PY

sleep 8
curl -sS "${HDR[@]}" "http://127.0.0.1:${PORT}/api/forex/providers/mt5-hfm/quotes" -o "$BAK/post-quotes.json"
curl -sS "${HDR[@]}" -X POST "http://127.0.0.1:${PORT}/api/forex/providers/mt5-hfm/account/sync" -d '{}' -o "$BAK/post-acct-sync.json"
python3 - <<PY
import json
from collections import Counter
q=json.load(open("$BAK/post-quotes.json"))["snapshot"]
print("post", q.get("feedFreshness"), q.get("sequence"), q.get("terminalRunning"), dict(Counter(x.get("status") for x in q.get("quotes") or [])))
for x in q.get("quotes") or []:
  print(x.get("symbol"), x.get("bid"), x.get("ask"), x.get("status"))
PY

echo "=== RESUME WATCHDOG ==="
systemctl start kwizera-mt5-hfm-watchdog.timer

echo "=== PROCESS CHECK ==="
pgrep -a -u mt5 -f 'Xvfb :97|terminal64' || true
systemctl is-active kwizera-mt5-xvfb.service
echo "cutover_complete note=terminal_via_agent_login xvfb_via_systemd demo_unit_left_inactive_for_boot"
