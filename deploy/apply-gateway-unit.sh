#!/usr/bin/env bash
# Install/refresh the systemd unit so KWIZERA listens via production-gateway.js.
# Does not delete KWIZERA_STORAGE_ROOT. Does not install an external LLM.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kwizera-ai}"
SERVICE="${SERVICE:-kwizera-ai}"
SERVICE_USER="${SERVICE_USER:-kwizera}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

UNIT_SRC="$APP_DIR/deploy/kwizera-ai.service"
GATEWAY_JS="$APP_DIR/dist/dev/server/production-gateway.js"
APP_JS="$APP_DIR/dist/dev/server/index.js"

if [[ ! -f "$UNIT_SRC" ]]; then
  echo "Missing $UNIT_SRC" >&2
  exit 1
fi

if [[ ! -f "$GATEWAY_JS" ]] || [[ ! -f "$APP_JS" ]] || [[ ! -f "$APP_DIR/dev/ui/desktop/index.html" ]]; then
  echo "[KWIZERA] gateway/app worker/studio UI missing — rebuilding production (server + Vite desktop)"
  cd "$APP_DIR"
  sudo -u "$SERVICE_USER" -H env NODE_ENV=development npm ci --include=dev
  sudo -u "$SERVICE_USER" -H npm run build:production
fi

if [[ ! -f "$GATEWAY_JS" ]]; then
  echo "Still missing $GATEWAY_JS after build" >&2
  exit 1
fi

echo "[KWIZERA] repo=$(git -C "$APP_DIR" rev-parse HEAD)"
echo "[KWIZERA] unit source ExecStart:"
grep '^ExecStart=' "$UNIT_SRC"

install -m 644 "$UNIT_SRC" /etc/systemd/system/kwizera-ai.service
if ! grep -q 'production-gateway.js' /etc/systemd/system/kwizera-ai.service; then
  echo "Installed unit does not start production-gateway.js" >&2
  exit 1
fi

systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE"

echo "[KWIZERA] live ExecStart=$(systemctl show -p ExecStart --value "$SERVICE")"
echo "[KWIZERA] $SERVICE is active"
