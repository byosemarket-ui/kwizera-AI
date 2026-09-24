#!/usr/bin/env bash
# Phase 6 QA delivery verification — runs on the VPS after deploy.
# Proves VISION_ANALYSIS readiness is reported truthfully for PMV QA.
# Never prints secrets. Does not invent online vision PASS.
set -euo pipefail

APP_DIR="${KWIZERA_PROJECT_ROOT:-/opt/kwizera-ai}"
ENV_FILE="${APP_DIR}/.env"
BASE_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/api/health}"

cd "$APP_DIR"
echo "[phase6] commit=$(git rev-parse HEAD)"

curl -fsS "$BASE_URL/api/health" >/tmp/phase6-health.json
node -e '
const h=JSON.parse(require("fs").readFileSync("/tmp/phase6-health.json","utf8"));
if (!h.ok && h.status !== "healthy") { console.error("health failed", h); process.exit(1); }
console.log("[phase6] health ok");
'

curl -fsS "$BASE_URL/api/video-production/capabilities?views=3" >/tmp/phase6-caps.json
node -e '
const c=JSON.parse(require("fs").readFileSync("/tmp/phase6-caps.json","utf8"));
const s=JSON.stringify(c);
if (/sk-|api[_-]?key|Bearer /i.test(s)) { console.error("secret leak in capabilities"); process.exit(1); }
if (!c.qa || typeof c.qa.visionQaAvailable !== "boolean") {
  console.error("missing qa.visionQaAvailable", c.qa);
  process.exit(1);
}
const exact=(c.capabilities||[]).find(m=>m.mode==="AI_PRODUCT_MOTION");
if (!exact || !exact.available) { console.error("Exact Product missing"); process.exit(1); }
console.log("[phase6] visionQaAvailable="+c.qa.visionQaAvailable);
console.log("[phase6] Exact Product available="+exact.available);
console.log("[phase6] PASS — QA capability probe + customer safety");
'

rm -f /tmp/phase6-*.json
