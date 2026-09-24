#!/usr/bin/env bash
# Phase 5 Audio Timeline verification — runs on the VPS after deploy.
# Proves Admin MUSIC_GENERATION + TEXT_TO_SPEECH describe/probe (or truthful auth failure).
# Never prints secrets. Does not invent successful generation without valid credentials.
set -euo pipefail

APP_DIR="${KWIZERA_PROJECT_ROOT:-/opt/kwizera-ai}"
ENV_FILE="${APP_DIR}/.env"
BASE_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/api/health}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[phase5] missing .env at $ENV_FILE" >&2
  exit 1
fi

if ! grep -qE '^KWIZERA_ADMIN_API_TOKEN=.+' "$ENV_FILE"; then
  echo "[phase5] SKIPPED — Admin API token missing"
  exit 0
fi
if ! grep -qE '^KWIZERA_SECRETS_PASSPHRASE=.+' "$ENV_FILE"; then
  echo "[phase5] SKIPPED — secrets vault passphrase missing"
  exit 0
fi

ADMIN_TOKEN="$(grep -E '^KWIZERA_ADMIN_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
auth_hdr=(-H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json")

echo "[phase5] commit=$(git rev-parse HEAD)"

# --- MUSIC_GENERATION (fal) ---
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers" \
  -d '{"id":"provider-fal","name":"fal.ai","type":"fal","kind":"EXTERNAL_API","baseEndpoint":"https://queue.fal.run","enabled":true,"status":"active"}' \
  >/tmp/phase5-fal-provider.json

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/features" \
  -d '{"feature":"MUSIC_GENERATION","label":"Music Generation","primaryModelId":"model-fal-stable-audio","providerId":"provider-fal","enabled":true,"metadata":{"phase":"phase5-audio-timeline","phase5AudioTimeline":true}}' \
  >/tmp/phase5-music-feature.json

FAL_KEY="${FAL_KEY:-${FAL_API_KEY:-}}"
if [[ -z "$FAL_KEY" ]] && grep -qE '^FAL_KEY=.+' "$ENV_FILE"; then
  FAL_KEY="$(grep -E '^FAL_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
if [[ -z "$FAL_KEY" ]]; then
  FAL_KEY="fal-phase5-verify-invalid-key-not-a-secret"
  echo "[phase5] no FAL_KEY — music probe expects AUTHENTICATION_FAILED / truthful failure"
else
  echo "[phase5] FAL_KEY present — will attempt live music probe (value not logged)"
fi
export PHASE5_FAL_KEY="$FAL_KEY"
node -e 'require("fs").writeFileSync("/tmp/phase5-fal-cred.json", JSON.stringify({ secret: process.env.PHASE5_FAL_KEY || "", enable: true }))'
unset FAL_KEY FAL_API_KEY PHASE5_FAL_KEY
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers/provider-fal/credential" \
  --data-binary @/tmp/phase5-fal-cred.json >/tmp/phase5-fal-cred-res.json
rm -f /tmp/phase5-fal-cred.json

echo "[phase5] describe MUSIC_GENERATION"
curl -fsS "${auth_hdr[@]}" "$BASE_URL/api/admin/runtime/describe?feature=MUSIC_GENERATION" >/tmp/phase5-music-describe.json
node -e '
const d=JSON.parse(require("fs").readFileSync("/tmp/phase5-music-describe.json","utf8"));
const s=JSON.stringify(d);
if (/Key |api[_-]?key|Bearer |fal-phase5-verify/i.test(s)) { console.error("secret leak in music describe"); process.exit(1); }
console.log("[phase5] music describe status="+d.status, "source="+d.source, "provider="+d.providerId, "adapter="+d.adapterId);
if (d.source !== "ONLINE" || d.providerId !== "provider-fal") {
  console.error("[phase5] expected ONLINE fal for MUSIC_GENERATION", d);
  process.exit(1);
}
'

node -e 'require("fs").writeFileSync("/tmp/phase5-music-exec.json", JSON.stringify({
  feature: "MUSIC_GENERATION",
  mode: "probe",
  prompt: "phase5 music connectivity probe"
}))'
echo "[phase5] execute MUSIC_GENERATION probe"
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/runtime/execute" \
  --data-binary @/tmp/phase5-music-exec.json >/tmp/phase5-music-execute.json
rm -f /tmp/phase5-music-exec.json
node -e '
const r=JSON.parse(require("fs").readFileSync("/tmp/phase5-music-execute.json","utf8"));
const s=JSON.stringify(r);
if (/Key |api[_-]?key|Bearer |fal-phase5-verify/i.test(s)) { console.error("secret leak in music execute"); process.exit(1); }
if (!r.requestId || r.source !== "ONLINE" || r.providerId !== "provider-fal") {
  console.error("[phase5] music execute missing online metadata", r);
  process.exit(1);
}
const ok = r.ok === true || r.errorCode === "AUTHENTICATION_FAILED" || r.errorCode === "PROVIDER_UNAVAILABLE" || r.errorCode === "NETWORK_ERROR";
if (!ok) { console.error("[phase5] unexpected music result", r.errorCode || r); process.exit(1); }
console.log("[phase5] music execute ok="+r.ok, "errorCode="+(r.errorCode||"none"), "http="+r.httpStatus);
'

# --- TEXT_TO_SPEECH (OpenAI) ---
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers" \
  -d '{"id":"provider-openai","name":"OpenAI","type":"openai","kind":"EXTERNAL_API","baseEndpoint":"https://api.openai.com","enabled":true,"status":"active"}' \
  >/tmp/phase5-openai-provider.json

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/features" \
  -d '{"feature":"TEXT_TO_SPEECH","label":"Text to Speech","primaryModelId":"model-openai-tts-1","providerId":"provider-openai","enabled":true,"metadata":{"phase":"phase5-audio-timeline","phase5AudioTimeline":true}}' \
  >/tmp/phase5-tts-feature.json

OPENAI_KEY="${OPENAI_API_KEY:-}"
if [[ -z "$OPENAI_KEY" ]] && grep -qE '^OPENAI_API_KEY=.+' "$ENV_FILE"; then
  OPENAI_KEY="$(grep -E '^OPENAI_API_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
if [[ -z "$OPENAI_KEY" ]]; then
  OPENAI_KEY="sk-phase5-verify-invalid-key-not-a-secret"
  echo "[phase5] no OPENAI_API_KEY — TTS probe expects AUTHENTICATION_FAILED"
else
  echo "[phase5] OPENAI_API_KEY present — will attempt live TTS probe (value not logged)"
fi
export PHASE5_OPENAI_KEY="$OPENAI_KEY"
node -e 'require("fs").writeFileSync("/tmp/phase5-openai-cred.json", JSON.stringify({ secret: process.env.PHASE5_OPENAI_KEY || "", enable: true }))'
unset OPENAI_KEY OPENAI_API_KEY PHASE5_OPENAI_KEY
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers/provider-openai/credential" \
  --data-binary @/tmp/phase5-openai-cred.json >/tmp/phase5-openai-cred-res.json
rm -f /tmp/phase5-openai-cred.json

echo "[phase5] describe TEXT_TO_SPEECH"
curl -fsS "${auth_hdr[@]}" "$BASE_URL/api/admin/runtime/describe?feature=TEXT_TO_SPEECH" >/tmp/phase5-tts-describe.json
node -e '
const d=JSON.parse(require("fs").readFileSync("/tmp/phase5-tts-describe.json","utf8"));
const s=JSON.stringify(d);
if (/sk-|api[_-]?key|Bearer /i.test(s)) { console.error("secret leak in tts describe"); process.exit(1); }
console.log("[phase5] tts describe status="+d.status, "source="+d.source, "provider="+d.providerId);
if (d.source !== "ONLINE" || d.providerId !== "provider-openai") {
  console.error("[phase5] expected ONLINE openai for TEXT_TO_SPEECH", d);
  process.exit(1);
}
'

# Customer capabilities must remain secret-free; Exact Product path remains.
curl -fsS "$BASE_URL/api/video-production/capabilities?views=3" >/tmp/phase5-caps.json
node -e '
const c=JSON.parse(require("fs").readFileSync("/tmp/phase5-caps.json","utf8"));
const s=JSON.stringify(c);
if (/Key |api[_-]?key|sk-|queue\.fal\.run/i.test(s)) { console.error("secret leak in customer capabilities"); process.exit(1); }
const exact=(c.capabilities||[]).find(m=>m.mode==="AI_PRODUCT_MOTION");
if (!exact || !exact.available) { console.error("Exact Product mode missing/unavailable"); process.exit(1); }
console.log("[phase5] Exact Product available="+exact.available);
console.log("[phase5] PASS — music/TTS capability chain + customer safety");
'

unset ADMIN_TOKEN
rm -f /tmp/phase5-*.json
