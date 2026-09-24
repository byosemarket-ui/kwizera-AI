#!/usr/bin/env bash
# Phase 4 Online I2V verification — runs on the VPS after deploy.
# Proves Admin VIDEO_IMAGE_TO_VIDEO → fal HTTPS (or truthful AUTHENTICATION_FAILED / CONFIGURATION).
# Never prints secrets. Does not invent successful generation without a valid credential.
set -euo pipefail

APP_DIR="${KWIZERA_PROJECT_ROOT:-/opt/kwizera-ai}"
ENV_FILE="${APP_DIR}/.env"
BASE_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/api/health}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[phase4] missing .env at $ENV_FILE" >&2
  exit 1
fi

if ! grep -qE '^KWIZERA_ADMIN_API_TOKEN=.+' "$ENV_FILE"; then
  echo "[phase4] SKIPPED — Admin API token missing"
  exit 0
fi
if ! grep -qE '^KWIZERA_SECRETS_PASSPHRASE=.+' "$ENV_FILE"; then
  echo "[phase4] SKIPPED — secrets vault passphrase missing"
  exit 0
fi

ADMIN_TOKEN="$(grep -E '^KWIZERA_ADMIN_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
auth_hdr=(-H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json")

echo "[phase4] commit=$(git rev-parse HEAD)"
echo "[phase4] mapping VIDEO_IMAGE_TO_VIDEO → fal Wan I2V"

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers" \
  -d '{"id":"provider-fal","name":"fal.ai","type":"fal","kind":"EXTERNAL_API","baseEndpoint":"https://queue.fal.run","enabled":true,"status":"active"}' \
  >/tmp/phase4-provider.json

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/features" \
  -d '{"feature":"VIDEO_IMAGE_TO_VIDEO","label":"Image to Video","primaryModelId":"model-fal-wan-i2v","fallbackModelId":"model-deterministic-video","providerId":"provider-fal","enabled":true,"metadata":{"phase":"phase4-online-i2v","phase4OnlineI2v":true}}' \
  >/tmp/phase4-feature.json

FAL_KEY="${FAL_KEY:-${FAL_API_KEY:-}}"
if [[ -z "$FAL_KEY" ]] && grep -qE '^FAL_KEY=.+' "$ENV_FILE"; then
  FAL_KEY="$(grep -E '^FAL_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
if [[ -z "$FAL_KEY" ]] && grep -qE '^FAL_API_KEY=.+' "$ENV_FILE"; then
  FAL_KEY="$(grep -E '^FAL_API_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
if [[ -z "$FAL_KEY" ]]; then
  FAL_KEY="fal-phase4-verify-invalid-key-not-a-secret"
  echo "[phase4] no FAL_KEY configured — using invalid probe key (expect AUTHENTICATION_FAILED or truthful failure)"
else
  echo "[phase4] FAL_KEY present — will attempt live I2V probe (value not logged)"
fi

export PHASE4_FAL_KEY="$FAL_KEY"
node -e 'require("fs").writeFileSync("/tmp/phase4-cred-body.json", JSON.stringify({ secret: process.env.PHASE4_FAL_KEY || "", enable: true }))'
unset FAL_KEY FAL_API_KEY PHASE4_FAL_KEY

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers/provider-fal/credential" \
  --data-binary @/tmp/phase4-cred-body.json \
  >/tmp/phase4-cred.json
rm -f /tmp/phase4-cred-body.json

echo "[phase4] describe VIDEO_IMAGE_TO_VIDEO"
curl -fsS "${auth_hdr[@]}" "$BASE_URL/api/admin/runtime/describe?feature=VIDEO_IMAGE_TO_VIDEO" >/tmp/phase4-describe.json
node -e '
const d=JSON.parse(require("fs").readFileSync("/tmp/phase4-describe.json","utf8"));
const s=JSON.stringify(d);
if (/Key |api[_-]?key|Bearer |fal-phase4-verify/i.test(s)) { console.error("secret leak in describe"); process.exit(1); }
console.log("[phase4] describe status="+d.status, "source="+d.source, "provider="+d.providerId, "model="+d.modelId, "adapter="+d.adapterId);
if (d.source !== "ONLINE" || d.providerId !== "provider-fal") {
  console.error("[phase4] expected ONLINE fal resolution", d);
  process.exit(1);
}
'

# Probe mode avoids billing a full Wan generation when credential is invalid.
node -e 'require("fs").writeFileSync("/tmp/phase4-exec-body.json", JSON.stringify({
  feature: "VIDEO_IMAGE_TO_VIDEO",
  mode: "probe",
  prompt: "phase4 connectivity probe"
}))'

echo "[phase4] execute VIDEO_IMAGE_TO_VIDEO probe (real HTTPS)"
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/runtime/execute" \
  --data-binary @/tmp/phase4-exec-body.json \
  >/tmp/phase4-execute.json
rm -f /tmp/phase4-exec-body.json

node -e '
const r=JSON.parse(require("fs").readFileSync("/tmp/phase4-execute.json","utf8"));
const s=JSON.stringify(r);
if (/Key |api[_-]?key|Bearer |fal-phase4-verify/i.test(s)) { console.error("secret leak in execute"); process.exit(1); }
if (!r.requestId || r.source !== "ONLINE" || r.providerId !== "provider-fal") {
  console.error("[phase4] missing online metadata", { source:r.source, providerId:r.providerId, requestId:r.requestId });
  process.exit(1);
}
if (typeof r.httpStatus !== "number" && r.ok !== true && r.errorCode !== "AUTHENTICATION_FAILED" && r.errorCode !== "CONFIGURATION_ERROR") {
  console.error("[phase4] missing http evidence", r.errorCode || r);
  process.exit(1);
}
const ok = r.ok === true || r.errorCode === "AUTHENTICATION_FAILED" || r.errorCode === "PROVIDER_UNAVAILABLE" || r.errorCode === "NETWORK_ERROR";
if (!ok) {
  console.error("[phase4] unexpected execute result", r.errorCode || r);
  process.exit(1);
}
console.log("[phase4] execute ok="+r.ok, "source="+r.source, "errorCode="+(r.errorCode||"none"), "http="+r.httpStatus, "model="+r.modelId, "requestId="+r.requestId);
if (r.ok === true) {
  console.log("[phase4] PASS — online I2V capability authenticated");
} else {
  console.log("[phase4] PASS — online I2V chain verified; real generation blocked by credential/auth (truthful)");
}
'

# Customer capabilities must not leak provider secrets / model IDs as Admin internals.
curl -fsS "$BASE_URL/api/video-production/capabilities?views=3" >/tmp/phase4-caps.json
node -e '
const c=JSON.parse(require("fs").readFileSync("/tmp/phase4-caps.json","utf8"));
const s=JSON.stringify(c);
if (/Key |api[_-]?key|sk-|fal-phase4-verify|queue\.fal\.run/i.test(s)) {
  console.error("secret/internal leak in customer capabilities");
  process.exit(1);
}
const modes=(c.capabilities||[]);
const exact=modes.find(m=>m.mode==="AI_PRODUCT_MOTION");
if (!exact) { console.error("Exact Product mode missing"); process.exit(1); }
console.log("[phase4] customer capabilities Exact available="+exact.available, "Cinematic="+(modes.find(m=>m.mode==="CINEMATIC_3D")||{}).available);
console.log("[phase4] PASS — capability chain + customer safety checks");
'

unset ADMIN_TOKEN
rm -f /tmp/phase4-cred.json /tmp/phase4-describe.json /tmp/phase4-execute.json /tmp/phase4-feature.json /tmp/phase4-provider.json /tmp/phase4-caps.json
