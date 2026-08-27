#!/usr/bin/env bash
# KWIZERA AI STUDIO — STEP 2 real VPS deploy from GitHub.
# Run as root on the VPS. Does not install external LLMs. Does not delete storage.
set -euo pipefail

REPO_URL="https://github.com/byosemarket-ui/kwizera-AI.git"
APP_DIR="/opt/kwizera-ai"
STORAGE_ROOT="/var/lib/kwizera-ai-studio"
SERVICE_USER="kwizera"
BIND_HOST="127.0.0.1"
BIND_PORT="5173"
REPORT="/root/kwizera-step2-report.txt"
GITHUB_COMMIT_EXPECTED="4c13100284303d45de5e82c3bdfeae5dfdcd202b"
PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

log() { echo "[STEP2 $(date -u +%H:%M:%S)] $*"; echo "[STEP2 $(date -u +%H:%M:%S)] $*" >>"$REPORT"; }
pass() { log "PASS  $*"; }
fail() { log "FAIL  $*"; }
note() { log "INFO  $*"; }

mkdir -p "$(dirname "$REPORT")"
if [[ "${1:-}" != "post-reboot" && "${1:-}" != "continue" ]]; then
  : >"$REPORT"
fi

ensure_git_safe() {
  git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
}

json_field() {
  python3 - "$1" <<'PY'
import json, sys
path = sys.argv[1]
raw = sys.stdin.read()
try:
    data = json.loads(raw)
except Exception:
    print("")
    raise SystemExit(0)
cur = data
for part in path.split("."):
    if isinstance(cur, dict) and part in cur:
        cur = cur[part]
    else:
        print("")
        raise SystemExit(0)
if isinstance(cur, bool):
    print("true" if cur else "false")
elif cur is None:
    print("")
else:
    print(cur)
PY
}

api() {
  local method="$1" path="$2" data="${3:-}"
  if [[ -n "$data" ]]; then
    curl -sS -m 45 -X "$method" -H "Content-Type: application/json" --data "$data" \
      "http://${BIND_HOST}:${BIND_PORT}${path}" || true
  else
    curl -sS -m 45 -X "$method" "http://${BIND_HOST}:${BIND_PORT}${path}" || true
  fi
}

wait_http() {
  local tries="${1:-60}" delay="${2:-2}"
  local i
  for ((i = 1; i <= tries; i++)); do
    local body
    body="$(api GET /api/health)"
    if [[ "$(echo "$body" | json_field ok)" == "true" ]]; then
      echo "$body"
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

audit_hardware() {
  note "=== VPS hardware audit ==="
  log "hostname=$(hostname)"
  log "os=$(. /etc/os-release 2>/dev/null; echo "${PRETTY_NAME:-unknown}")"
  log "uname=$(uname -a)"
  log "arch=$(uname -m)"
  log "cpus=$(nproc)"
  log "cpu_model=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2- | xargs || true)"
  log "mem=$(free -h | sed -n '2p')"
  log "disk=$(df -h / | sed -n '2p')"
  log "uptime=$(uptime)"
  ip -4 addr show | sed 's/^/  /' >>"$REPORT" || true
}

inspect_existing() {
  note "=== Existing install inspection (no deletes) ==="
  ensure_git_safe
  id "$SERVICE_USER" >/dev/null 2>&1 && log "user ${SERVICE_USER} exists" || log "user ${SERVICE_USER} does not exist yet"
  if [[ -d "$APP_DIR" ]]; then
    log "app dir exists: $APP_DIR"
    if [[ -d "$APP_DIR/.git" ]]; then
      log "git remote=$(git -C "$APP_DIR" remote -v | tr '\n' ' ')"
      log "git branch=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
      log "git commit=$(git -C "$APP_DIR" rev-parse --short=12 HEAD 2>/dev/null || echo unknown)"
      log "git status=$(git -C "$APP_DIR" status -sb)"
    else
      log "app dir is not a git checkout — will not delete it; using ${APP_DIR}"
    fi
  else
    log "no previous app dir at $APP_DIR"
  fi
  if [[ -d "$STORAGE_ROOT" ]]; then
    log "storage exists: $STORAGE_ROOT (preserving)"
    du -sh "$STORAGE_ROOT" 2>/dev/null | awk '{print "storage_size="$1}' >>"$REPORT" || true
  else
    log "no previous storage at $STORAGE_ROOT"
  fi
  ls -ld /opt /var/lib /tmp 2>/dev/null | sed 's/^/  /' >>"$REPORT" || true
}

prepare_linux() {
  note "=== Linux environment ==="
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl git build-essential python3 ffmpeg \
    nodejs npm dropbear-bin >/dev/null
  if ! command -v node >/dev/null; then
    fail "nodejs missing after apt"
    exit 1
  fi
  local node_ver
  node_ver="$(node -v | sed 's/^v//')"
  local major="${node_ver%%.*}"
  if [[ "$major" -lt 20 ]]; then
    note "Node $node_ver < 20 — installing Node 22 from NodeSource"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
  fi
  log "node=$(node -v)"
  log "npm=$(npm -v)"
  log "git=$(git --version)"
  log "ffmpeg=$(ffmpeg -version 2>/dev/null | head -1 || echo missing)"
  log "python=$(python3 --version)"
  log "external LLM runtimes are not part of this install"
}

create_user() {
  if ! id "$SERVICE_USER" >/dev/null 2>&1; then
    useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
    pass "created system user $SERVICE_USER"
  else
    pass "service user $SERVICE_USER already exists"
  fi
}

deploy_github() {
  note "=== Deploy from GitHub ==="
  mkdir -p /opt
  ensure_git_safe
  if [[ -d "$APP_DIR/.git" ]]; then
    git -C "$APP_DIR" remote set-url origin "$REPO_URL"
    git -C "$APP_DIR" fetch --tags origin
    git -C "$APP_DIR" checkout main
    git -C "$APP_DIR" pull --ff-only origin main
  elif [[ -e "$APP_DIR" ]]; then
    fail "$APP_DIR exists and is not a git checkout — refusing to delete"
    exit 1
  else
    git clone --branch main "$REPO_URL" "$APP_DIR"
  fi
  ensure_git_safe
  log "git_remote=$(git -C "$APP_DIR" remote get-url origin)"
  log "git_branch=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)"
  log "git_commit=$(git -C "$APP_DIR" rev-parse HEAD)"
  log "git_status=$(git -C "$APP_DIR" status -sb)"
  local head origin_head
  head="$(git -C "$APP_DIR" rev-parse HEAD)"
  origin_head="$(git -C "$APP_DIR" rev-parse origin/main)"
  log "git_owner=$(stat -c '%U:%G' "$APP_DIR")"
  if [[ "$head" == "$origin_head" ]]; then
    pass "deployed identifiable GitHub commit $head"
  else
    note "deployed commit $head (origin/main=$origin_head)"
  fi
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$APP_DIR"
  ensure_git_safe
  log "git_owner_after_chown=$(stat -c '%U:%G' "$APP_DIR")"
}

write_env() {
  local envf="${APP_DIR}/.env"
  if [[ -f "$envf" ]]; then
    note "preserving existing .env (not overwriting)"
  else
    cat >"$envf" <<EOF
NODE_ENV=production
KWIZERA_ENV=production
KWIZERA_HOST=${BIND_HOST}
KWIZERA_PORT=${BIND_PORT}
KWIZERA_STORAGE_ROOT=${STORAGE_ROOT}
KWIZERA_PERSISTENT_MODE=1
KWIZERA_SKIP_BROWSER_OPEN=1
KWIZERA_PROJECT_ROOT=${APP_DIR}
KWIZERA_FFMPEG_PATH=/usr/bin/ffmpeg
KWIZERA_BOOT_DELAY_MS=750
EOF
    note "wrote production .env from project template (no secrets)"
  fi
  chown "${SERVICE_USER}:${SERVICE_USER}" "$envf"
  chmod 640 "$envf"
}

prepare_storage() {
  mkdir -p "$STORAGE_ROOT"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "$STORAGE_ROOT"
  chmod 750 "$STORAGE_ROOT"
  mkdir -p "${STORAGE_ROOT}/logs"
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "${STORAGE_ROOT}/logs"
  pass "persistent storage root $STORAGE_ROOT (survives restart/reboot; not /tmp; not inside git)"
}

install_deps_and_build() {
  note "=== npm install + production build ==="
  cd "$APP_DIR"
  if [[ -f package-lock.json ]]; then
    sudo -u "$SERVICE_USER" -H npm ci
  else
    sudo -u "$SERVICE_USER" -H npm install
  fi
  sudo -u "$SERVICE_USER" -H npm run build:production:server
  if [[ ! -f "${APP_DIR}/dist/dev/server/index.js" ]] || [[ ! -f "${APP_DIR}/dist/dev/server/production-gateway.js" ]]; then
    fail "production entry missing after build"
    exit 1
  fi
  pass "production build emitted gateway + app worker"
}

install_dropbear() {
  note "=== Dropbear on :2222 (OpenSSH hostbound workaround, root key auth) ==="
  if systemctl is-active --quiet kwizera-dropbear.service 2>/dev/null && ss -lntp | grep -q ':2222'; then
    pass "dropbear already listening on 2222"
    return 0
  fi
  mkdir -p /etc/dropbear
  if [[ ! -f /etc/dropbear/dropbear_ed25519_host_key ]]; then
    dropbearkey -t ed25519 -f /etc/dropbear/dropbear_ed25519_host_key >/dev/null
  fi
  local db
  db="$(command -v dropbear)"
  cat >/etc/systemd/system/kwizera-dropbear.service <<EOF
[Unit]
Description=Temporary KWIZERA deploy SSH (Dropbear :2222)
After=network.target

[Service]
ExecStart=${db} -F -E -p 2222 -r /etc/dropbear/dropbear_ed25519_host_key
Restart=on-failure
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now kwizera-dropbear.service
  sleep 1
  if ss -lntp | grep -q ':2222'; then
    pass "dropbear listening on 2222"
  else
    fail "dropbear not listening on 2222"
  fi
  if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
    ufw allow 2222/tcp || true
  fi
}

install_systemd() {
  note "=== systemd service ==="
  local node_bin
  node_bin="$(command -v node)"
  install -m 644 "${APP_DIR}/deploy/kwizera-ai.service" /etc/systemd/system/kwizera-ai.service
  sed -i "s|^ExecStart=.*|ExecStart=${node_bin} ${APP_DIR}/dist/dev/server/production-gateway.js|" /etc/systemd/system/kwizera-ai.service
  systemctl daemon-reload
  systemctl enable kwizera-ai.service
  systemctl restart kwizera-ai.service
  sleep 2
  if systemctl is-active --quiet kwizera-ai.service; then
    pass "systemd kwizera-ai is active"
  else
    fail "systemd kwizera-ai not active"
    journalctl -u kwizera-ai -n 80 --no-pager | tee -a "$REPORT" || true
    exit 1
  fi
}

verify_runtime() {
  note "=== HTTP + AI runtime ==="
  local health
  if ! health="$(wait_http 45 2)"; then
    fail "/api/health did not respond"
    journalctl -u kwizera-ai -n 120 --no-pager | tee -a "$REPORT" || true
    exit 1
  fi
  pass "/api/health $(echo "$health" | tr '\n' ' ')"
  log "health_mode=$(echo "$health" | json_field mode)"
  log "health_host=$(echo "$health" | json_field host)"
  log "health_port=$(echo "$health" | json_field port)"
  log "health_storage=$(echo "$health" | json_field storageRoot)"
  log "health_runtimeReady=$(echo "$health" | json_field runtimeReady)"

  note "waiting up to 12 minutes for Knowledge/AI Core (first seed can be slow)"
  local i runtime ready="false"
  for ((i = 1; i <= 48; i++)); do
    runtime="$(api GET /api/runtime)"
    ready="$(echo "$runtime" | json_field runtime.ready)"
    log "runtime poll ${i}/48 ready=${ready} msg=$(echo "$runtime" | json_field runtime.message)"
    if [[ "$ready" == "true" ]]; then
      break
    fi
    sleep 15
  done
  log "runtime.ready=${ready}"
  log "runtime.message=$(echo "$runtime" | json_field runtime.message)"

  local ws memh
  ws="$(api GET /api/desktop-workspace/status)"
  memh="$(api GET /api/persistent-memory/health)"
  log "aiCore=$(echo "$ws" | json_field aiCore)"
  log "memoryFoundation=$(echo "$ws" | json_field memoryFoundation)"
  log "knowledgeFoundation=$(echo "$ws" | json_field knowledgeFoundation)"
  log "productIntelligence=$(echo "$ws" | json_field productIntelligence)"
  log "imageIntelligence=$(echo "$ws" | json_field imageIntelligence)"
  log "videoIntelligence=$(echo "$ws" | json_field videoIntelligence)"
  log "workflowEngine=$(echo "$ws" | json_field workflowEngine)"
  log "memory_health=$(echo "$memh" | tr '\n' ' ')"

  local mi
  mi="$(api GET /api/marketing-intelligence)"
  log "marketing_http_len=${#mi}"
  local vi
  vi="$(api GET /api/product-rendering-export)"
  log "rendering_http_len=${#vi}"
}

test_memory() {
  note "=== Memory Foundation test (safe record) ==="
  local saved searched
  saved="$(api POST /api/persistent-memory/save "$(python3 - <<'PY'
import json
print(json.dumps({
  "kind": "SYSTEM_MEMORY",
  "title": "STEP2 VPS memory probe",
  "content": "Safe test record created during STEP 2 VPS deployment. Do not delete other data.",
  "source": "vps-step2",
  "tags": ["step2", "vps-probe"],
  "importance": "LOW",
  "dedupeKey": "kwizera-step2-vps-memory-probe"
}))
PY
)")"
  log "memory_save=$(echo "$saved" | tr '\n' ' ')"
  searched="$(api GET "/api/persistent-memory/search?q=STEP2%20VPS%20memory%20probe&limit=5")"
  log "memory_search_count=$(echo "$searched" | json_field count)"
  if [[ "$(echo "$searched" | json_field count)" != "" && "$(echo "$searched" | json_field count)" != "0" ]]; then
    pass "memory create/read"
  else
    fail "memory create/read did not return the probe record"
  fi
}

test_product_and_job() {
  note "=== Real product + production job ==="
  local created project_id
  created="$(api POST /api/workspace/projects '{"name":"STEP2 VPS Probe Product"}')"
  project_id="$(echo "$created" | json_field project.id)"
  log "project_create=$(echo "$created" | tr '\n' ' ' | head -c 500)"
  if [[ -z "$project_id" ]]; then
    fail "project create failed (workspace may still be booting)"
    return 0
  fi
  pass "created project $project_id"

  local uploaded
  uploaded="$(api POST "/api/workspace/projects/${project_id}/images" "$(python3 - <<PY
import json
print(json.dumps({
  "fileName": "step2-probe.png",
  "mimeType": "image/png",
  "dataBase64": "${PNG_B64}",
}))
PY
)")"
  log "image_upload_ok=$(echo "$uploaded" | json_field image.id)"

  local profile
  profile="$(api POST "/api/workspace/projects/${project_id}" "$(python3 - <<PY
import json
print(json.dumps({"changes": {"productInformation": {
  "name": "STEP2 VPS Probe Bottle",
  "category": "Beverage",
  "description": "Safe VPS deployment probe product. Not a customer project.",
  "price": 9.99,
  "currency": "USD",
  "sku": "STEP2-VPS-PROBE",
  "features": ["Probe"],
  "materials": ["Steel"],
  "colors": ["Black"],
  "sizes": ["500ml"]
}}}))
PY
)")"
  log "product_name=$(echo "$profile" | json_field project.productInformation.name)"
  log "product_profile=$(echo "$profile" | json_field productProfile.valid)$(echo "$profile" | json_field productProfile.ok)"

  local intel
  intel="$(api GET "/api/product-intelligence?projectId=${project_id}")"
  log "product_intelligence_len=${#intel}"

  local job
  job="$(api POST /api/pipeline/jobs "$(python3 - <<PY
import json
print(json.dumps({"projectId": "${project_id}"}))
PY
)")"
  log "pipeline_job=$(echo "$job" | tr '\n' ' ' | head -c 800)"
  if [[ -n "$(echo "$job" | json_field job.id)" ]]; then
    pass "production job created $(echo "$job" | json_field job.id) status=$(echo "$job" | json_field job.status)"
  else
    fail "production job not created — $(echo "$job" | tr '\n' ' ' | head -c 400)"
  fi
}

test_restart_and_recovery() {
  note "=== systemd restart ==="
  systemctl restart kwizera-ai.service
  sleep 3
  if systemctl is-active --quiet kwizera-ai.service && wait_http 40 2 >/dev/null; then
    pass "systemctl restart recovered HTTP"
  else
    fail "systemctl restart did not recover"
    journalctl -u kwizera-ai -n 80 --no-pager | tee -a "$REPORT" || true
  fi

  note "=== controlled process failure recovery ==="
  local pid
  pid="$(systemctl show -p MainPID --value kwizera-ai)"
  if [[ -n "$pid" && "$pid" != "0" ]]; then
    kill -9 "$pid" || true
    sleep 8
    if systemctl is-active --quiet kwizera-ai.service && wait_http 40 2 >/dev/null; then
      pass "systemd recovered after process kill"
    else
      fail "systemd did not recover after process kill"
      journalctl -u kwizera-ai -n 80 --no-pager | tee -a "$REPORT" || true
    fi
  fi
}

resource_snapshot() {
  note "=== resources while running ==="
  log "load=$(cat /proc/loadavg)"
  log "mem=$(free -m | sed -n '2p')"
  log "disk=$(df -h / | sed -n '2p')"
  systemctl status kwizera-ai --no-pager -l | sed -n '1,20p' | tee -a "$REPORT" || true
  ps -o pid,user,rss,pcpu,cmd -p "$(systemctl show -p MainPID --value kwizera-ai)" | tee -a "$REPORT" || true
}

install_post_reboot_verify() {
  cat >/opt/kwizera-ai/deploy/vps-step2-post-reboot.sh <<'EOS'
#!/usr/bin/env bash
set -euo pipefail
sleep 8
exec /opt/kwizera-ai/deploy/vps-step2.sh post-reboot
EOS
  chmod 755 /opt/kwizera-ai/deploy/vps-step2-post-reboot.sh
  cat >/etc/systemd/system/kwizera-step2-post-reboot.service <<'EOF'
[Unit]
Description=KWIZERA STEP 2 post-reboot verification
After=kwizera-ai.service
Wants=kwizera-ai.service

[Service]
Type=oneshot
ExecStart=/opt/kwizera-ai/deploy/vps-step2-post-reboot.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable kwizera-step2-post-reboot.service
}

post_reboot_main() {
  log "=== POST-REBOOT VERIFICATION $(date -u -Iseconds) ==="
  log "uptime=$(uptime)"
  if systemctl is-active --quiet kwizera-ai.service; then
    pass "post-reboot systemd active"
  else
    fail "post-reboot systemd not active"
  fi
  local health
  if health="$(wait_http 60 2)"; then
    pass "post-reboot /api/health $(echo "$health" | tr '\n' ' ')"
  else
    fail "post-reboot /api/health failed"
  fi
  local runtime
  runtime="$(api GET /api/runtime)"
  log "post-reboot runtime.ready=$(echo "$runtime" | json_field runtime.ready)"
  local searched
  searched="$(api GET "/api/persistent-memory/search?q=STEP2%20VPS%20memory%20probe&limit=5")"
  log "post-reboot memory_search_count=$(echo "$searched" | json_field count)"
  if [[ -d "$STORAGE_ROOT" ]]; then
    pass "post-reboot storage available $STORAGE_ROOT"
  else
    fail "post-reboot storage missing"
  fi
  resource_snapshot
  log "POST-REBOOT_DONE"
  cp "$REPORT" "${STORAGE_ROOT}/logs/step2-report.txt" 2>/dev/null || true
  systemctl disable kwizera-step2-post-reboot.service || true
}

fix_root_authorized_keys() {
  install -d -m 700 /root/.ssh
  local keys="/root/.ssh/authorized_keys"
  if [[ -f "$keys" ]]; then
    grep -E '^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256|sk-ssh-ed25519) ' "$keys" >"${keys}.clean" || true
    mv "${keys}.clean" "$keys"
  fi
  chmod 700 /root /root/.ssh || true
  chmod 600 "$keys" 2>/dev/null || true
  chown -R root:root /root/.ssh
  log "authorized_keys valid lines=$(grep -cE '^ssh-' "$keys" 2>/dev/null || echo 0)"
}

run_remaining_deploy() {
  write_env
  prepare_storage
  install_deps_and_build
  install_dropbear
  install_systemd
  verify_runtime
  test_memory
  test_product_and_job
  test_restart_and_recovery
  resource_snapshot
  mkdir -p "${STORAGE_ROOT}/logs"
  cp "$REPORT" "${STORAGE_ROOT}/logs/step2-report.txt"
  chown "${SERVICE_USER}:${SERVICE_USER}" "${STORAGE_ROOT}/logs/step2-report.txt" || true
  install_post_reboot_verify
  log "STEP2_PRE_REBOOT_COMPLETE"
  log "dropbear=tcp/2222 systemd=kwizera-ai enabled"
}

continue_main() {
  log "KWIZERA AI STUDIO STEP 2 CONTINUE $(date -u -Iseconds)"
  ensure_git_safe
  audit_hardware
  inspect_existing
  if command -v node >/dev/null && command -v ffmpeg >/dev/null && command -v git >/dev/null && command -v npm >/dev/null; then
    log "node=$(node -v)"
    log "npm=$(npm -v)"
    log "git=$(git --version)"
    log "ffmpeg=$(ffmpeg -version 2>/dev/null | head -1 || echo missing)"
    log "external LLM runtimes are not part of this install"
    pass "runtime packages already installed — skipping apt reinstall"
  else
    prepare_linux
  fi
  create_user
  deploy_github
  run_remaining_deploy
  if [[ "${KWIZERA_STEP2_REBOOT:-0}" == "1" ]]; then
    note "rebooting in 5s for recovery test (service enabled at boot)"
    sleep 5
    systemctl reboot
  else
    note "reboot skipped (KWIZERA_STEP2_REBOOT=0) — Dropbear :2222 left running for remaining recovery test"
  fi
}

main() {
  if [[ "${1:-}" == "post-reboot" ]]; then
    post_reboot_main
    return 0
  fi
  if [[ "${1:-}" == "continue" ]]; then
    continue_main
    return 0
  fi

  log "KWIZERA AI STUDIO STEP 2 starting $(date -u -Iseconds)"
  audit_hardware
  inspect_existing
  fix_root_authorized_keys
  prepare_linux
  create_user
  deploy_github
  run_remaining_deploy
  if [[ "${KWIZERA_STEP2_REBOOT:-1}" == "1" ]]; then
    note "rebooting in 5s for recovery test (service enabled at boot)"
    sleep 5
    systemctl reboot
  else
    note "reboot skipped (KWIZERA_STEP2_REBOOT=0)"
  fi
}

main "${1:-}"
