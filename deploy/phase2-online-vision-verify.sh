#!/usr/bin/env bash
# Phase 2 online vision verification — runs on the VPS after deploy.
# Proves Admin VISION_ANALYSIS → multimodal HTTPS (or truthful AUTHENTICATION_FAILED).
# Never prints secrets. Never mutates customer product assets.
set -euo pipefail

APP_DIR="${KWIZERA_PROJECT_ROOT:-/opt/kwizera-ai}"
ENV_FILE="${APP_DIR}/.env"
BASE_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/api/health}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[phase2] missing .env at $ENV_FILE" >&2
  exit 1
fi

if ! grep -qE '^KWIZERA_ADMIN_API_TOKEN=.+' "$ENV_FILE"; then
  echo "[phase2] SKIPPED — Admin API token missing (phase1 verify should provision it)"
  exit 0
fi
if ! grep -qE '^KWIZERA_SECRETS_PASSPHRASE=.+' "$ENV_FILE"; then
  echo "[phase2] SKIPPED — secrets vault passphrase missing"
  exit 0
fi

ADMIN_TOKEN="$(grep -E '^KWIZERA_ADMIN_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
auth_hdr=(-H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json")

echo "[phase2] commit=$(git rev-parse HEAD)"
echo "[phase2] mapping VISION_ANALYSIS → OpenAI gpt-4o-mini"

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers" \
  -d '{"id":"provider-openai","name":"OpenAI","type":"openai","kind":"EXTERNAL_API","baseEndpoint":"https://api.openai.com","enabled":true,"status":"active"}' \
  >/tmp/phase2-provider.json

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/features" \
  -d '{"feature":"VISION_ANALYSIS","label":"Vision Analysis","primaryModelId":"model-openai-gpt-4o-mini","fallbackModelId":"model-local-vision","providerId":"provider-openai","enabled":true,"metadata":{"phase":"phase2-online-vision","phase2OnlineVision":true}}' \
  >/tmp/phase2-feature.json

OPENAI_KEY="${OPENAI_API_KEY:-}"
if [[ -z "$OPENAI_KEY" ]] && grep -qE '^OPENAI_API_KEY=.+' "$ENV_FILE"; then
  OPENAI_KEY="$(grep -E '^OPENAI_API_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
if [[ -z "$OPENAI_KEY" ]]; then
  OPENAI_KEY="sk-phase2-verify-invalid-key-not-a-secret"
  echo "[phase2] no OPENAI_API_KEY configured — using invalid probe key (expect AUTHENTICATION_FAILED)"
else
  echo "[phase2] OPENAI_API_KEY present — will attempt live vision request (value not logged)"
fi

export PHASE2_OPENAI_KEY="$OPENAI_KEY"
node -e 'require("fs").writeFileSync("/tmp/phase2-cred-body.json", JSON.stringify({ secret: process.env.PHASE2_OPENAI_KEY || "", enable: true }))'
unset OPENAI_KEY PHASE2_OPENAI_KEY

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers/provider-openai/credential" \
  --data-binary @/tmp/phase2-cred-body.json \
  >/tmp/phase2-cred.json
rm -f /tmp/phase2-cred-body.json

echo "[phase2] describe VISION_ANALYSIS"
curl -fsS "${auth_hdr[@]}" "$BASE_URL/api/admin/runtime/describe?feature=VISION_ANALYSIS" >/tmp/phase2-describe.json
node -e '
const d=JSON.parse(require("fs").readFileSync("/tmp/phase2-describe.json","utf8"));
const s=JSON.stringify(d);
if (/sk-|Bearer |api[_-]?key/i.test(s)) { console.error("secret leak in describe"); process.exit(1); }
console.log("[phase2] describe status="+d.status, "source="+d.source, "provider="+d.providerId, "model="+d.modelId);
if (d.source !== "ONLINE" || d.providerId !== "provider-openai") {
  console.error("[phase2] expected ONLINE OpenAI resolution", d);
  process.exit(1);
}
'

export TINY_PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
node -e 'require("fs").writeFileSync("/tmp/phase2-exec-body.json", JSON.stringify({
  feature: "VISION_ANALYSIS",
  mode: "vision",
  prompt: "Analyze the product image. Reply with JSON only containing view, viewConfidence, backgroundType, backgroundConfidence, category, categoryConfidence, dominantColors.",
  images: [{ mimeType: "image/png", base64: process.env.TINY_PNG_B64 }]
}))'
unset TINY_PNG_B64

echo "[phase2] execute VISION_ANALYSIS (real HTTPS multimodal)"
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/runtime/execute" \
  --data-binary @/tmp/phase2-exec-body.json \
  >/tmp/phase2-execute.json
rm -f /tmp/phase2-exec-body.json

node -e '
const r=JSON.parse(require("fs").readFileSync("/tmp/phase2-execute.json","utf8"));
const s=JSON.stringify(r);
if (/sk-|Bearer |api[_-]?key/i.test(s)) { console.error("secret leak in execute"); process.exit(1); }
if (!r.requestId || r.source !== "ONLINE" || r.providerId !== "provider-openai") {
  console.error("[phase2] missing online metadata", { source:r.source, providerId:r.providerId, requestId:r.requestId });
  process.exit(1);
}
if (typeof r.httpStatus !== "number") {
  console.error("[phase2] missing httpStatus — outbound call not evidenced");
  process.exit(1);
}
const ok = r.ok === true || r.errorCode === "AUTHENTICATION_FAILED";
if (!ok) {
  console.error("[phase2] unexpected execute result", r.errorCode || r);
  process.exit(1);
}
console.log("[phase2] execute ok="+r.ok, "source="+r.source, "errorCode="+(r.errorCode||"none"), "http="+r.httpStatus, "model="+r.modelId, "requestId="+r.requestId);
console.log("[phase2] PASS — online vision capability chain verified");
'

unset ADMIN_TOKEN
rm -f /tmp/phase2-cred.json /tmp/phase2-describe.json /tmp/phase2-execute.json /tmp/phase2-feature.json /tmp/phase2-provider.json
