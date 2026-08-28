#!/usr/bin/env bash
# Safe update from GitHub for an existing KWIZERA AI STUDIO VPS install.
# Does not delete KWIZERA_STORAGE_ROOT. Does not install any external LLM.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/kwizera-ai}"
SERVICE_USER="${SERVICE_USER:-kwizera}"
SERVICE="${SERVICE:-kwizera-ai}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "No git checkout at $APP_DIR" >&2
  exit 1
fi

echo "[KWIZERA] Current: $(git -C "$APP_DIR" rev-parse --short=12 HEAD) $(git -C "$APP_DIR" status -sb)"
git -C "$APP_DIR" fetch origin
git -C "$APP_DIR" checkout main
git -C "$APP_DIR" pull --ff-only origin main
echo "[KWIZERA] Updated: $(git -C "$APP_DIR" rev-parse HEAD)"

chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"
# Keep .env root-readable by the service user only; never commit it.
if [[ -f "$APP_DIR/.env" ]]; then
  chown "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR/.env"
  chmod 640 "$APP_DIR/.env"
fi

cd "$APP_DIR"
if [[ -f package-lock.json ]]; then
  sudo -u "$SERVICE_USER" -H env NODE_ENV=development npm ci --include=dev
else
  sudo -u "$SERVICE_USER" -H env NODE_ENV=development npm install
fi
sudo -u "$SERVICE_USER" -H npm run build:production

GATEWAY_JS="$APP_DIR/dist/dev/server/production-gateway.js"
APP_JS="$APP_DIR/dist/dev/server/index.js"
DESKTOP_INDEX="$APP_DIR/dev/ui/desktop/index.html"
if [[ ! -f "$GATEWAY_JS" ]] || [[ ! -f "$APP_JS" ]]; then
  echo "[KWIZERA] production-gateway.js or app worker missing after build" >&2
  exit 1
fi
if [[ ! -f "$DESKTOP_INDEX" ]]; then
  echo "[KWIZERA] Studio UI missing after build: $DESKTOP_INDEX" >&2
  echo "[KWIZERA] npm run build:production must emit the Vite desktop bundle." >&2
  exit 1
fi
if grep -q "Dev Dashboard" "$DESKTOP_INDEX"; then
  echo "[KWIZERA] $DESKTOP_INDEX still looks like the legacy Dev Dashboard" >&2
  exit 1
fi
echo "[KWIZERA] Studio UI: $DESKTOP_INDEX"

install -m 644 "$APP_DIR/deploy/kwizera-ai.service" /etc/systemd/system/kwizera-ai.service
if ! grep -q 'production-gateway.js' /etc/systemd/system/kwizera-ai.service; then
  echo "[KWIZERA] systemd unit was not updated to production-gateway.js" >&2
  exit 1
fi
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 2
systemctl is-active --quiet "$SERVICE"
echo "[KWIZERA] ExecStart=$(systemctl show -p ExecStart --value "$SERVICE")"
echo "[KWIZERA] service $SERVICE active after GitHub update"
