#!/usr/bin/env bash
# Phase 1 online AI runtime verification — runs on the VPS after deploy.
# Never prints secrets. Proves Admin → credential → OpenAI HTTPS (or AUTHENTICATION_FAILED).
set -euo pipefail

APP_DIR="${KWIZERA_PROJECT_ROOT:-/opt/kwizera-ai}"
ENV_FILE="${APP_DIR}/.env"
BASE_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/api/health}"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[phase1] missing .env at $ENV_FILE" >&2
  exit 1
fi

# Ensure Admin API token exists (generate once; never echo value).
if ! grep -qE '^KWIZERA_ADMIN_API_TOKEN=.+' "$ENV_FILE"; then
  token="$(openssl rand -hex 24)"
  printf '\nKWIZERA_ADMIN_API_TOKEN=%s\n' "$token" >>"$ENV_FILE"
  echo "[phase1] generated KWIZERA_ADMIN_API_TOKEN (value not logged)"
  systemctl restart kwizera-ai.service
  for _ in $(seq 1 60); do
    if curl -fsS -m 3 "$BASE_URL/api/health" | grep -q '"status":"healthy"'; then
      break
    fi
    sleep 2
  done
fi

if ! grep -qE '^KWIZERA_SECRETS_PASSPHRASE=.+' "$ENV_FILE"; then
  echo "[phase1] KWIZERA_SECRETS_PASSPHRASE is not set — cannot store provider credentials" >&2
  exit 1
fi

ADMIN_TOKEN="$(grep -E '^KWIZERA_ADMIN_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
if [[ -z "${ADMIN_TOKEN}" ]]; then
  echo "[phase1] Admin token still empty after ensure step" >&2
  exit 1
fi

auth_hdr=(-H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json")

echo "[phase1] commit=$(git rev-parse HEAD)"
echo "[phase1] verifying Admin auth denial without token"
code="$(curl -sS -o /tmp/phase1-admin-deny.json -w '%{http_code}' "$BASE_URL/api/admin/providers" || true)"
if [[ "$code" != "403" ]]; then
  echo "[phase1] expected 403 without token, got $code" >&2
  cat /tmp/phase1-admin-deny.json >&2 || true
  exit 1
fi
echo "[phase1] unauthenticated Admin denied (HTTP 403)"

echo "[phase1] enabling OpenAI provider + ONLINE_API_PROBE"
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers" \
  -d '{"id":"provider-openai","name":"OpenAI","type":"openai","kind":"EXTERNAL_API","baseEndpoint":"https://api.openai.com","enabled":true,"status":"active"}' \
  >/tmp/phase1-provider.json

OPENAI_KEY="${OPENAI_API_KEY:-}"
if [[ -z "$OPENAI_KEY" ]] && grep -qE '^OPENAI_API_KEY=.+' "$ENV_FILE"; then
  OPENAI_KEY="$(grep -E '^OPENAI_API_KEY=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
fi
if [[ -z "$OPENAI_KEY" ]]; then
  OPENAI_KEY="sk-phase1-verify-invalid-key-not-a-secret"
  echo "[phase1] no OPENAI_API_KEY configured — using invalid probe key (expect AUTHENTICATION_FAILED)"
else
  echo "[phase1] OPENAI_API_KEY present — will attempt live authenticated probe (value not logged)"
fi

export PHASE1_OPENAI_KEY="$OPENAI_KEY"
node -e 'require("fs").writeFileSync("/tmp/phase1-cred-body.json", JSON.stringify({ secret: process.env.PHASE1_OPENAI_KEY || "" }))'
unset OPENAI_KEY PHASE1_OPENAI_KEY

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers/provider-openai/credential" \
  --data-binary @/tmp/phase1-cred-body.json \
  >/tmp/phase1-cred.json
rm -f /tmp/phase1-cred-body.json

curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/features" \
  -d '{"feature":"ONLINE_API_PROBE","label":"Online API Probe","primaryModelId":"model-openai-gpt-4o-mini","providerId":"provider-openai","enabled":true}' \
  >/tmp/phase1-feature.json

echo "[phase1] provider health"
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/providers/provider-openai/health" \
  -d '{}' >/tmp/phase1-health.json
node -e '
const h=JSON.parse(require("fs").readFileSync("/tmp/phase1-health.json","utf8"));
const s=JSON.stringify(h);
if (/sk-|Bearer |api[_-]?key/i.test(s)) { console.error("secret leak in health"); process.exit(1); }
console.log("[phase1] health", h.code, "http="+ (h.httpStatus||"n/a"), "host="+ (h.endpointHost||"n/a"), "requestId="+h.requestId);
'

echo "[phase1] runtime execute ONLINE_API_PROBE"
curl -fsS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/runtime/execute" \
  -d '{"feature":"ONLINE_API_PROBE","prompt":"Reply with exactly: OK"}' \
  >/tmp/phase1-execute.json
node -e '
const r=JSON.parse(require("fs").readFileSync("/tmp/phase1-execute.json","utf8"));
const s=JSON.stringify(r);
if (/sk-|Bearer |api[_-]?key/i.test(s)) { console.error("secret leak in execute"); process.exit(1); }
const ok = r.ok === true || r.errorCode === "AUTHENTICATION_FAILED";
if (!ok) {
  console.error("[phase1] unexpected execute result", r.errorCode || r);
  process.exit(1);
}
if (!r.requestId || r.source !== "ONLINE" || r.providerId !== "provider-openai") {
  console.error("[phase1] missing online metadata", { source:r.source, providerId:r.providerId, requestId:r.requestId });
  process.exit(1);
}
if (typeof r.httpStatus !== "number") {
  console.error("[phase1] missing httpStatus — outbound call not evidenced");
  process.exit(1);
}
console.log("[phase1] execute ok="+r.ok, "source="+r.source, "errorCode="+(r.errorCode||"none"), "http="+r.httpStatus, "model="+r.modelId, "requestId="+r.requestId);
console.log("[phase1] PASS — online AI runtime chain verified");
'

unset ADMIN_TOKEN
rm -f /tmp/phase1-cred.json /tmp/phase1-cred-body.json
