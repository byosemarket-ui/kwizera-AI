#!/usr/bin/env bash
# Phase 7 image preparation verification — runs on the VPS after deploy.
# Executes IMAGE_SEGMENTATION → IMAGE_EDITING (mask-guided) → IMAGE_UPSCALE through the Admin-routed
# CapabilityRuntime on a synthetic product image. Reports truthfully; never prints secrets.
set -euo pipefail

APP_DIR="${KWIZERA_PROJECT_ROOT:-/opt/kwizera-ai}"
ENV_FILE="${APP_DIR}/.env"
BASE_URL="${KWIZERA_HEALTH_URL:-http://127.0.0.1:5173}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL%/api/health}"
WORK="$(mktemp -d /tmp/phase7-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

cd "$APP_DIR"
echo "[phase7] commit=$(git rev-parse HEAD)"

curl -fsS "$BASE_URL/api/video-production/capabilities?views=3" >"$WORK/caps.json"
node -e '
const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
const s=JSON.stringify(c);
if (/sk-|api[_-]?key|Bearer |fal-ai|flux|sam2|esrgan/i.test(s)) { console.error("[phase7] internal leak in customer capabilities"); process.exit(1); }
if (!c.imagePreparation || typeof c.imagePreparation.editingAvailable !== "boolean") { console.error("[phase7] missing imagePreparation"); process.exit(1); }
console.log("[phase7] customer imagePreparation editing="+c.imagePreparation.editingAvailable, "enhancement="+c.imagePreparation.enhancementAvailable);
' "$WORK/caps.json"

if ! grep -qE '^KWIZERA_ADMIN_API_TOKEN=.+' "$ENV_FILE" 2>/dev/null; then
  echo "[phase7] SKIPPED — Admin API token missing (online stages not verified)"
  exit 0
fi
ADMIN_TOKEN="$(grep -E '^KWIZERA_ADMIN_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2-)"
auth_hdr=(-H "Authorization: Bearer ${ADMIN_TOKEN}" -H "Content-Type: application/json")

for feature in IMAGE_SEGMENTATION IMAGE_EDITING IMAGE_UPSCALE; do
  curl -fsS "${auth_hdr[@]}" "$BASE_URL/api/admin/runtime/describe?feature=$feature" >"$WORK/describe-$feature.json"
  node -e '
const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));
if (/Key |api[_-]?key|Bearer /i.test(JSON.stringify(d))) { console.error("secret leak in describe"); process.exit(1); }
console.log("[phase7] describe "+process.argv[2]+" status="+d.status, "source="+d.source, "provider="+d.providerId, "model="+d.modelId, "acceptsMask="+(d.acceptsMask===true));
' "$WORK/describe-$feature.json" "$feature"
done

FFMPEG="$(command -v ffmpeg || true)"
if [[ -z "$FFMPEG" ]]; then
  echo "[phase7] SKIPPED — ffmpeg missing on VPS"
  exit 0
fi
# Synthetic "product": red box on a grey studio floor. Mask: white = editable environment.
"$FFMPEG" -v error -y -f lavfi -i "color=c=0x9a9a9a:s=1024x1024" -vf "drawbox=x=392:y=352:w=240:h=320:color=0xc0282d:t=fill,drawbox=x=432:y=412:w=160:h=40:color=white:t=fill" -frames:v 1 "$WORK/product.png"
"$FFMPEG" -v error -y -f lavfi -i "color=c=white:s=1024x1024" -vf "drawbox=x=380:y=340:w=264:h=344:color=black:t=fill,format=gray" -frames:v 1 "$WORK/editmask.png"
"$FFMPEG" -v error -y -i "$WORK/product.png" -vf "scale=512:512" -frames:v 1 "$WORK/small.png"

node -e '
const fs=require("fs");
const w=process.argv[1];
const b64=(f)=>fs.readFileSync(w+"/"+f).toString("base64");
fs.writeFileSync(w+"/seg.json", JSON.stringify({ feature:"IMAGE_SEGMENTATION", images:[{mimeType:"image/png",base64:b64("product.png")}], targetPoint:{x:512,y:512} }));
fs.writeFileSync(w+"/edit.json", JSON.stringify({ feature:"IMAGE_EDITING", images:[{mimeType:"image/png",base64:b64("product.png")}], maskImage:{mimeType:"image/png",base64:b64("editmask.png")},
  prompt:"PRODUCT — LOCKED:\nPreserve the exact product.\n\nENVIRONMENT — EDITABLE:\nEdit target: luxury marble studio with soft cinematic lighting.\n\nQUALITY:\nPhotorealistic commercial product photography, no text." }));
fs.writeFileSync(w+"/up.json", JSON.stringify({ feature:"IMAGE_UPSCALE", images:[{mimeType:"image/png",base64:b64("small.png")}], upscaleFactor:2 }));
' "$WORK"

run_stage() {
  local name="$1" file="$2"
  curl -sS "${auth_hdr[@]}" -X POST "$BASE_URL/api/admin/runtime/execute" --data-binary @"$WORK/$file" >"$WORK/out-$name.json" || true
  node -e '
const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")||"{}");
const s=JSON.stringify(r);
if (/Key |api[_-]?key|Bearer |base64/i.test(s)) { console.error("[phase7] leak in execute response"); process.exit(1); }
const o=r.output||{};
console.log("[phase7] "+process.argv[2]+" ok="+r.ok, "source="+r.source, "model="+r.modelId, "http="+r.httpStatus, "errorCode="+(r.errorCode||"none"), "output="+(o.width?o.width+"x"+o.height+" "+o.sizeBytes+"B":"none"), "requestId="+r.requestId);
' "$WORK/out-$name.json" "$name"
}

run_stage SEGMENTATION seg.json
run_stage EDITING edit.json
run_stage ENHANCEMENT up.json

unset ADMIN_TOKEN
echo "[phase7] done — see per-stage ok= lines (failures are reported, never faked)"
