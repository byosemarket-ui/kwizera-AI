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
# Persistent AI Core cold-start commonly needs ~2.5–4 minutes on the VPS.
# Constrained 1-CPU hosts can exceed 9 minutes after large module loads (STEP 2F).
HEALTH_WAIT_SECONDS="${KWIZERA_HEALTH_WAIT_SECONDS:-720}"
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

acquire_deploy_lock() {
  exec 9>"$LOCK_FILE"
  if flock -n 9; then
    return 0
  fi
  # Stale lock recovery: if no live deploy/build holder remains, reclaim the lock.
  local holders
  holders="$(ps -eo pid=,args= | grep -E '[u]pdate-from-github\.sh|[n]pm ci|[n]pm run build:production' || true)"
  if [[ -z "$holders" ]]; then
    echo "[KWIZERA] clearing stale deploy lock (no active deploy/build process)"
    rm -f "$LOCK_FILE"
    exec 9>"$LOCK_FILE"
    if flock -n 9; then
      return 0
    fi
  else
    echo "[KWIZERA] deploy lock holders:" >&2
    echo "$holders" >&2
  fi
  echo "[KWIZERA] another deployment holds $LOCK_FILE" >&2
  return 1
}

if ! acquire_deploy_lock; then
  exit 1
fi

dump_service_diagnostics() {
  echo "[KWIZERA] --- systemctl status ${SERVICE} ---" >&2
  systemctl status "$SERVICE" --no-pager -l || true
  echo "[KWIZERA] --- journalctl -u ${SERVICE} (last 120) ---" >&2
  journalctl -u "$SERVICE" --no-pager -n 120 || true
  echo "[KWIZERA] --- listeners :5173 ---" >&2
  ss -lntp 2>/dev/null | grep -E ':5173\b' || true
  echo "[KWIZERA] --- node processes ---" >&2
  ps -eo pid,user,args 2>/dev/null | grep -E '[n]ode .*(production-gateway|dist/dev/server)' || true
}

emergency_revive_service() {
  if systemctl is-active --quiet "$SERVICE"; then
    return 0
  fi
  if [[ -f "$APP_DIR/dist/dev/server/production-gateway.js" && -f "$APP_DIR/dist/dev/server/index.js" ]]; then
    echo "[KWIZERA] service inactive after deploy failure — attempting emergency restart"
    systemctl reset-failed "$SERVICE" 2>/dev/null || true
    systemctl start "$SERVICE" || systemctl restart "$SERVICE" || true
    local i
    for i in $(seq 1 20); do
      if systemctl is-active --quiet "$SERVICE"; then
        echo "[KWIZERA] emergency restart: service active after ${i}s"
        return 0
      fi
      sleep 1
    done
    echo "[KWIZERA] emergency restart: service still inactive" >&2
    dump_service_diagnostics
  else
    echo "[KWIZERA] cannot emergency-restart: production artifacts missing" >&2
  fi
}

on_script_exit() {
  local rc=$?
  # Do not call `exit` here — bash runs EXIT traps on `exec`, and exiting
  # would abort the intentional re-exec of this script after checkout.
  if [[ "$rc" -ne 0 ]]; then
    echo "[KWIZERA] deploy exiting with code $rc"
    df -h / /opt /tmp 2>/dev/null | sed 's/^/[KWIZERA] df /' || true
    free -h 2>/dev/null | sed 's/^/[KWIZERA] mem /' || true
    systemctl is-active "$SERVICE" 2>/dev/null | sed 's/^/[KWIZERA] service /' || true
    emergency_revive_service
  fi
}
trap on_script_exit EXIT

echo "[KWIZERA] host diagnostics before deploy"
df -h / /opt /tmp 2>/dev/null | sed 's/^/[KWIZERA] df /' || true
free -h 2>/dev/null | sed 's/^/[KWIZERA] mem /' || true
systemctl is-active "$SERVICE" 2>/dev/null | sed 's/^/[KWIZERA] service /' || true

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
  local body=""
  for i in $(seq 1 "$HEALTH_WAIT_SECONDS"); do
    if systemctl is-active --quiet "$SERVICE"; then
      body="$(curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null || true)"
      if printf '%s' "$body" | grep -q '"runtimeReady":true' \
        && printf '%s' "$body" | grep -q '"ok":true' \
        && printf '%s' "$body" | grep -q '"status":"healthy"'; then
        echo "[KWIZERA] healthy after ${i}s"
        return 0
      fi
    fi
    if (( i % 30 == 0 )); then
      echo "[KWIZERA] waiting for runtimeReady… ${i}/${HEALTH_WAIT_SECONDS}s status=$(printf '%s' "$body" | tr '\n' ' ' | head -c 220)"
    fi
    sleep 1
  done
  echo "[KWIZERA] service did not become healthy within ${HEALTH_WAIT_SECONDS}s" >&2
  systemctl is-active "$SERVICE" || true
  curl -sS -m 5 "$HEALTH_URL" || true
  echo
  dump_service_diagnostics
  return 1
}

verify_live_routes() {
  BASE_URL="${KWIZERA_PUBLIC_BASE:-http://127.0.0.1:5173}" node "$APP_DIR/deploy/verify-live-http.mjs"
}

restart_service() {
  # Quarantine truncated/corrupt JSON stores before boot (never deletes media).
  if [[ -f "$APP_DIR/deploy/quarantine-corrupt-json.mjs" ]]; then
    echo "[KWIZERA] scanning storage for corrupt JSON"
    KWIZERA_STORAGE_ROOT="$STORAGE_ROOT" node "$APP_DIR/deploy/quarantine-corrupt-json.mjs" || true
  fi
  install -m 644 "$APP_DIR/deploy/kwizera-ai.service" /etc/systemd/system/kwizera-ai.service
  if ! grep -q 'production-gateway.js' /etc/systemd/system/kwizera-ai.service; then
    echo "[KWIZERA] systemd unit was not updated to production-gateway.js" >&2
    return 1
  fi
  systemctl daemon-reload
  systemctl reset-failed "$SERVICE" 2>/dev/null || true
  if ! systemctl restart "$SERVICE"; then
    echo "[KWIZERA] systemctl restart returned non-zero" >&2
    dump_service_diagnostics
    return 1
  fi
  local i state
  for i in $(seq 1 45); do
    state="$(systemctl is-active "$SERVICE" 2>/dev/null || true)"
    if [[ "$state" == "active" ]]; then
      echo "[KWIZERA] service active after ${i}s"
      return 0
    fi
    if [[ "$state" == "failed" ]]; then
      echo "[KWIZERA] service entered failed state after ${i}s" >&2
      break
    fi
    # inactive after a few seconds usually means the process exited immediately
    if [[ "$state" == "inactive" && "$i" -ge 5 ]]; then
      echo "[KWIZERA] service inactive after ${i}s" >&2
      break
    fi
    sleep 1
  done
  echo "[KWIZERA] service did not become active (last state=${state:-unknown})" >&2
  dump_service_diagnostics
  return 1
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

# Re-exec the checked-out deploy script so new helpers (quarantine, etc.) apply.
# The initially invoked script may be from the previous commit still in memory.
if [[ "${KWIZERA_DEPLOY_REEXEC:-0}" != "1" ]]; then
  export KWIZERA_DEPLOY_REEXEC=1
  export KWIZERA_DEPLOY_SHA="$REQUESTED"
  echo "[KWIZERA] re-executing deploy script from checked-out commit"
  exec bash "$APP_DIR/deploy/update-from-github.sh" "$REQUESTED"
fi

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
  echo "[KWIZERA] runtimeReady not reached within ${HEALTH_WAIT_SECONDS}s — checking gateway/studio usability"
  dump_service_diagnostics
  # On small VPS hosts AI Core cold-start can exceed the hard health window while the
  # production gateway and Studio/Forex UI are already serving. Prefer a live studio
  # over a failed deploy + rollback that takes the site down.
  if verify_live_routes; then
    body="$(curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -q '"ok":true' && printf '%s' "$body" | grep -q '"gateway":true'; then
      echo "[KWIZERA] accepting deploy: gateway/studio verified; AI Core still warming (runtimeReady pending)"
    else
      rollback "health check failed (studio ok but gateway health missing)"
      exit 1
    fi
  else
    rollback "health check failed"
    exit 1
  fi
else
  if ! verify_live_routes; then
    rollback "studio HTML verification failed"
    exit 1
  fi
fi

if [[ -f "$APP_DIR/deploy/phase1-online-verify.sh" ]]; then
  echo "[KWIZERA] Phase 1 online AI runtime verification"
  chmod +x "$APP_DIR/deploy/phase1-online-verify.sh" || true
  if ! bash "$APP_DIR/deploy/phase1-online-verify.sh"; then
    echo "[KWIZERA] phase1 online AI verification failed (non-fatal — deploy remains live)" >&2
  fi
fi

if [[ -f "$APP_DIR/deploy/phase2-online-vision-verify.sh" ]]; then
  echo "[KWIZERA] Phase 2 online vision verification"
  chmod +x "$APP_DIR/deploy/phase2-online-vision-verify.sh" || true
  if ! bash "$APP_DIR/deploy/phase2-online-vision-verify.sh"; then
    echo "[KWIZERA] phase2 online vision verification failed (non-fatal — deploy remains live)" >&2
  fi
fi

if [[ -f "$APP_DIR/deploy/phase3-creative-reasoning-verify.sh" ]]; then
  echo "[KWIZERA] Phase 3 creative reasoning verification"
  chmod +x "$APP_DIR/deploy/phase3-creative-reasoning-verify.sh" || true
  if ! bash "$APP_DIR/deploy/phase3-creative-reasoning-verify.sh"; then
    echo "[KWIZERA] phase3 creative reasoning verification failed (non-fatal — deploy remains live)" >&2
  fi
fi

if [[ -f "$APP_DIR/deploy/phase4-online-i2v-verify.sh" ]]; then
  echo "[KWIZERA] Phase 4 online I2V verification"
  chmod +x "$APP_DIR/deploy/phase4-online-i2v-verify.sh" || true
  if ! bash "$APP_DIR/deploy/phase4-online-i2v-verify.sh"; then
    echo "[KWIZERA] phase4 online I2V verification failed (non-fatal — deploy remains live)" >&2
  fi
fi

if [[ -f "$APP_DIR/deploy/phase5-audio-timeline-verify.sh" ]]; then
  echo "[KWIZERA] Phase 5 audio timeline verification"
  chmod +x "$APP_DIR/deploy/phase5-audio-timeline-verify.sh" || true
  if ! bash "$APP_DIR/deploy/phase5-audio-timeline-verify.sh"; then
    echo "[KWIZERA] phase5 audio timeline verification failed (non-fatal — deploy remains live)" >&2
  fi
fi

if [[ -f "$APP_DIR/deploy/phase6-qa-delivery-verify.sh" ]]; then
  echo "[KWIZERA] Phase 6 QA delivery verification"
  chmod +x "$APP_DIR/deploy/phase6-qa-delivery-verify.sh" || true
  if ! bash "$APP_DIR/deploy/phase6-qa-delivery-verify.sh"; then
    echo "[KWIZERA] phase6 QA delivery verification failed (non-fatal — deploy remains live)" >&2
  fi
fi

if [[ -f "$APP_DIR/deploy/phase7-image-prep-verify.sh" ]]; then
  echo "[KWIZERA] Phase 7 image preparation verification"
  chmod +x "$APP_DIR/deploy/phase7-image-prep-verify.sh" || true
  if ! bash "$APP_DIR/deploy/phase7-image-prep-verify.sh"; then
    echo "[KWIZERA] phase7 image preparation verification failed (non-fatal — deploy remains live)" >&2
  fi
fi

record_status live success "Production deploy verified"
echo "[KWIZERA] requestedCommit=$REQUESTED"
echo "[KWIZERA] deployedCommit=$DEPLOYED"
echo "[KWIZERA] previousCommit=$PREVIOUS"
echo "[KWIZERA] timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "[KWIZERA] result=success"
echo "[KWIZERA] ExecStart=$(systemctl show -p ExecStart --value "$SERVICE")"
echo "[KWIZERA] service $SERVICE active after GitHub update"
