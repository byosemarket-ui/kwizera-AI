#!/usr/bin/env bash
# Canonical KWIZERA AI STUDIO production deployment.
# Deploys one exact git commit. Does not delete KWIZERA_STORAGE_ROOT.
# Does not install any external LLM.
set -euo pipefail
export GIT_TERMINAL_PROMPT=0
export DEBIAN_FRONTEND=noninteractive

APP_DIR="${APP_DIR:-/opt/kwizera-ai}"
SERVICE_USER="${SERVICE_USER:-kwizera}"
SERVICE="${SERVICE:-kwizera-ai}"
LOCK_FILE="${KWIZERA_DEPLOY_LOCK:-/var/lock/kwizera-ai-deploy.lock}"
HEALTH_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173/api/health}"
HEALTH_WAIT_SECONDS="${KWIZERA_HEALTH_WAIT_SECONDS:-180}"
STORAGE_ROOT="${KWIZERA_STORAGE_ROOT:-/var/lib/kwizera-ai-studio}"
REQUESTED="${KWIZERA_DEPLOY_SHA:-${1:-}}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "No git checkout at $APP_DIR" >&2
  exit 1
fi

mkdir -p "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[KWIZERA] another deployment holds $LOCK_FILE" >&2
  exit 1
fi

git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

load_storage_root() {
  if [[ -f "$APP_DIR/.env" ]]; then
    local from_env
    from_env="$(grep -E '^KWIZERA_STORAGE_ROOT=' "$APP_DIR/.env" | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
    if [[ -n "$from_env" ]]; then
      STORAGE_ROOT="$from_env"
    fi
  fi
}

record_status() {
  local phase="$1"
  local result="${2:-}"
  local message="${3:-}"
  KWIZERA_STORAGE_ROOT="$STORAGE_ROOT" \
    KWIZERA_DEPLOY_SHA="$REQUESTED" \
    KWIZERA_DEPLOYED_SHA="${DEPLOYED:-}" \
    KWIZERA_PREVIOUS_SHA="${PREVIOUS:-}" \
    KWIZERA_DEPLOY_RESULT="$result" \
    KWIZERA_DEPLOY_MESSAGE="$message" \
    node "$APP_DIR/deploy/record-status.mjs" "$phase" || true
}

verify_artifacts() {
  local gateway="$APP_DIR/dist/dev/server/production-gateway.js"
  local worker="$APP_DIR/dist/dev/server/index.js"
  local desktop="$APP_DIR/dev/ui/desktop/index.html"
  if [[ ! -f "$gateway" ]] || [[ ! -f "$worker" ]]; then
    echo "[KWIZERA] production-gateway.js or app worker missing after build" >&2
    return 1
  fi
  if [[ ! -f "$desktop" ]]; then
    echo "[KWIZERA] Studio UI missing after build: $desktop" >&2
    return 1
  fi
  if grep -q "Dev Dashboard" "$desktop"; then
    echo "[KWIZERA] $desktop still looks like the legacy Dev Dashboard" >&2
    return 1
  fi
  echo "[KWIZERA] artifacts ok: $gateway"
  echo "[KWIZERA] artifacts ok: $worker"
  echo "[KWIZERA] artifacts ok: $desktop"
}

build_production() {
  cd "$APP_DIR"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"
  if [[ -f "$APP_DIR/.env" ]]; then
    chown "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR/.env"
    chmod 640 "$APP_DIR/.env"
  fi
  if [[ -f package-lock.json ]]; then
    sudo -u "$SERVICE_USER" -H env NODE_ENV=development npm ci --include=dev
  else
    sudo -u "$SERVICE_USER" -H env NODE_ENV=development npm install
  fi
  sudo -u "$SERVICE_USER" -H npm run build:production
  verify_artifacts
}

wait_healthy() {
  local i
  for i in $(seq 1 "$HEALTH_WAIT_SECONDS"); do
    if systemctl is-active --quiet "$SERVICE"; then
      if curl -fsS -m 5 "$HEALTH_URL" | grep -q '"runtimeReady":true' \
        && curl -fsS -m 5 "$HEALTH_URL" | grep -q '"ok":true' \
        && curl -fsS -m 5 "$HEALTH_URL" | grep -q '"status":"healthy"'; then
        return 0
      fi
    fi
    sleep 1
  done
  echo "[KWIZERA] service did not become healthy within ${HEALTH_WAIT_SECONDS}s" >&2
  systemctl is-active "$SERVICE" || true
  curl -sS -m 5 "$HEALTH_URL" || true
  echo
  return 1
}

verify_live_routes() {
  BASE_URL="${KWIZERA_PUBLIC_BASE:-http://127.0.0.1:5173}" node "$APP_DIR/deploy/verify-live-http.mjs"
}

restart_service() {
  install -m 644 "$APP_DIR/deploy/kwizera-ai.service" /etc/systemd/system/kwizera-ai.service
  if ! grep -q 'production-gateway.js' /etc/systemd/system/kwizera-ai.service; then
    echo "[KWIZERA] systemd unit was not updated to production-gateway.js" >&2
    return 1
  fi
  systemctl daemon-reload
  systemctl restart "$SERVICE"
  sleep 2
  systemctl is-active --quiet "$SERVICE"
}

rollback() {
  local why="$1"
  echo "[KWIZERA] deployment failed: $why" >&2
  if [[ "${KWIZERA_SKIP_ROLLBACK:-0}" == "1" ]]; then
    record_status failed failure "$why (rollback skipped)"
    return 1
  fi
  if [[ -z "${PREVIOUS:-}" || "$PREVIOUS" == "$REQUESTED" ]]; then
    record_status failed failure "$why (no previous commit to restore)"
    return 1
  fi
  echo "[KWIZERA] rolling back to $PREVIOUS"
  record_status deploying in-progress "Rolling back to $PREVIOUS"
  git -C "$APP_DIR" fetch origin --prune
  git -C "$APP_DIR" checkout --detach --force "$PREVIOUS"
  DEPLOYED="$(git -C "$APP_DIR" rev-parse HEAD)"
  if ! KWIZERA_SKIP_ROLLBACK=1 build_production; then
    record_status failed failure "Rollback build failed after: $why"
    return 1
  fi
  if ! restart_service || ! wait_healthy || ! verify_live_routes; then
    record_status failed failure "Rollback also failed after: $why"
    return 1
  fi
  record_status rolled_back failure "Rolled back after: $why"
  echo "[KWIZERA] rollback restored $DEPLOYED"
  return 1
}

load_storage_root
PREVIOUS="$(git -C "$APP_DIR" rev-parse HEAD)"
echo "[KWIZERA] previous: $PREVIOUS"

record_status github in-progress "Fetching requested commit"

git -C "$APP_DIR" fetch origin --prune
if [[ -z "$REQUESTED" ]]; then
  REQUESTED="$(git -C "$APP_DIR" rev-parse origin/main)"
fi
if ! git -C "$APP_DIR" cat-file -e "${REQUESTED}^{commit}" 2>/dev/null; then
  git -C "$APP_DIR" fetch origin "$REQUESTED"
fi

echo "[KWIZERA] requested: $REQUESTED"
record_status deploying in-progress "Checking out $REQUESTED"
git -C "$APP_DIR" checkout --detach --force "$REQUESTED"
DEPLOYED="$(git -C "$APP_DIR" rev-parse HEAD)"
FULL_REQUESTED="$(git -C "$APP_DIR" rev-parse --verify "${REQUESTED}^{commit}")"
if [[ "$DEPLOYED" != "$FULL_REQUESTED" ]]; then
  echo "[KWIZERA] checked-out commit $DEPLOYED does not match requested $REQUESTED" >&2
  rollback "commit mismatch"
  exit 1
fi
REQUESTED="$DEPLOYED"
echo "[KWIZERA] deployed working tree: $DEPLOYED"

record_status deploying in-progress "Building production server and studio UI"
if ! build_production; then
  rollback "production build failed"
  exit 1
fi

record_status verifying in-progress "Restarting service and checking health"
if ! restart_service; then
  rollback "systemd restart failed"
  exit 1
fi
if ! wait_healthy; then
  rollback "health check failed"
  exit 1
fi
if ! verify_live_routes; then
  rollback "studio HTML verification failed"
  exit 1
fi

record_status live success "Production deploy verified"
echo "[KWIZERA] requestedCommit=$REQUESTED"
echo "[KWIZERA] deployedCommit=$DEPLOYED"
echo "[KWIZERA] previousCommit=$PREVIOUS"
echo "[KWIZERA] timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[KWIZERA] result=success"
echo "[KWIZERA] ExecStart=$(systemctl show -p ExecStart --value "$SERVICE")"
echo "[KWIZERA] service $SERVICE active after GitHub update"
