#!/usr/bin/env bash
# Phase 3 Creative Director verification — runs on the VPS after deploy.
# Proves Admin CREATIVE_REASONING → multimodal-capable chat HTTPS (or truthful AUTHENTICATION_FAILED).
# Never prints secrets.
set -euo pipefail

APP_DIR="${KWIZERA_PROJECT_ROOT:-/opt/kwizera-ai}"
ENV_FILE="${APP_DIR}/.env"
BASE_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/api/health}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[phase3] missing .env at $ENV_FILE" >&2
  exit 1
fi

if ! grep -qE '^KWIZERA_ADMIN_API_TOKEN=.+' "$ENV_FILE"; then
  echo "[phase3] SKIPPED — Admin API token missing"
  exit 0
fi
if ! grep -qE '^KWIZERA_SECRETS_PASSPHRASE=.+' "$ENV_FILE"; then
  echo "[phase3] SKIPPED — secrets vault passphrase missing"
  exit 0
fi

ADMIN_TOKEN="$(grep -E '^KWIZERA_ADMIN_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
auth_hdr=(-H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json")

echo "[phase3] commit=$(git rev-parse HEAD)"
echo "[phase3] mapping CREATIVE_REASONING → OpenAI gpt-4o-mini"

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers" \
  -d '{"id":"provider-openai","name":"OpenAI","type":"openai","kind":"EXTERNAL_API","baseEndpoint":"https://api.openai.com","enabled":true,"status":"active"}' \
  >/tmp/phase3-provider.json

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/features" \
  -d '{"feature":"CREATIVE_REASONING","label":"Creative Reasoning","primaryModelId":"model-openai-gpt-4o-mini","fallbackModelId":"model-local-llm","providerId":"provider-openai","enabled":true,"metadata":{"phase":"phase3-creative-director","phase3CreativeReasoning":true}}' \
  >/tmp/phase3-feature.json

OPENAI_KEY="${OPENAI_API_KEY:-}"
if [[ -z "$OPENAI_KEY" ]] && grep -qE '^OPENAI_API_KEY=.+' "$ENV_FILE"; then
  OPENAI_KEY="$(grep -E '^OPENAI_API_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
if [[ -z "$OPENAI_KEY" ]]; then
  OPENAI_KEY="sk-phase3-verify-invalid-key-not-a-secret"
  echo "[phase3] no OPENAI_API_KEY configured — using invalid probe key (expect AUTHENTICATION_FAILED)"
else
  echo "[phase3] OPENAI_API_KEY present — will attempt live creative reasoning (value not logged)"
fi

export PHASE3_OPENAI_KEY="$OPENAI_KEY"
node -e 'require("fs").writeFileSync("/tmp/phase3-cred-body.json", JSON.stringify({ secret: process.env.PHASE3_OPENAI_KEY || "", enable: true }))'
unset OPENAI_KEY PHASE3_OPENAI_KEY

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers/provider-openai/credential" \
  --data-binary @/tmp/phase3-cred-body.json \
  >/tmp/phase3-cred.json
rm -f /tmp/phase3-cred-body.json

echo "[phase3] describe CREATIVE_REASONING"
curl -fsS "${auth_hdr[@]}" "$BASE_URL/api/admin/runtime/describe?feature=CREATIVE_REASONING" >/tmp/phase3-describe.json
node -e '
const d=JSON.parse(require("fs").readFileSync("/tmp/phase3-describe.json","utf8"));
const s=JSON.stringify(d);
if (/sk-|Bearer |api[_-]?key/i.test(s)) { console.error("secret leak in describe"); process.exit(1); }
console.log("[phase3] describe status="+d.status, "source="+d.source, "provider="+d.providerId, "model="+d.modelId);
if (d.source !== "ONLINE" || d.providerId !== "provider-openai") {
  console.error("[phase3] expected ONLINE OpenAI resolution", d);
  process.exit(1);
}
'

node -e 'require("fs").writeFileSync("/tmp/phase3-exec-body.json", JSON.stringify({
  feature: "CREATIVE_REASONING",
  mode: "chat",
  messages: [
    { role: "system", content: "You are the Creative Director for KWIZERA. Reply with JSON only." },
    { role: "user", content: "{\"projectId\":\"phase3-verify\",\"creativeDirection\":\"product-first\",\"primarySellingPoint\":\"comfort\",\"textStrategy\":{\"headline\":\"Boot\",\"price\":\"\",\"cta\":\"Shop\"},\"scenes\":[{\"id\":\"scene-1\",\"purpose\":\"HOOK\",\"assetId\":\"a1\",\"duration\":3,\"camera\":\"hold\",\"motion\":\"hold\",\"narration\":\"\",\"transitionOut\":\"cut\"}]}" }
  ]
}))'

echo "[phase3] execute CREATIVE_REASONING (real HTTPS chat)"
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/runtime/execute" \
  --data-binary @/tmp/phase3-exec-body.json \
  >/tmp/phase3-execute.json
rm -f /tmp/phase3-exec-body.json

node -e '
const r=JSON.parse(require("fs").readFileSync("/tmp/phase3-execute.json","utf8"));
const s=JSON.stringify(r);
if (/sk-|Bearer |api[_-]?key/i.test(s)) { console.error("secret leak in execute"); process.exit(1); }
if (!r.requestId || r.source !== "ONLINE" || r.providerId !== "provider-openai") {
  console.error("[phase3] missing online metadata", { source:r.source, providerId:r.providerId, requestId:r.requestId });
  process.exit(1);
}
if (typeof r.httpStatus !== "number") {
  console.error("[phase3] missing httpStatus — outbound call not evidenced");
  process.exit(1);
}
const ok = r.ok === true || r.errorCode === "AUTHENTICATION_FAILED";
if (!ok) {
  console.error("[phase3] unexpected execute result", r.errorCode || r);
  process.exit(1);
}
console.log("[phase3] execute ok="+r.ok, "source="+r.source, "errorCode="+(r.errorCode||"none"), "http="+r.httpStatus, "model="+r.modelId, "requestId="+r.requestId);
console.log("[phase3] PASS — online creative reasoning capability chain verified");
'

unset ADMIN_TOKEN
rm -f /tmp/phase3-cred.json /tmp/phase3-describe.json /tmp/phase3-execute.json /tmp/phase3-feature.json /tmp/phase3-provider.json
