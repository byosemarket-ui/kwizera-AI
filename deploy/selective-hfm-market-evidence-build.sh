#!/usr/bin/env bash
# Selective rebuild for HFM market-evidence + adapters barrel (deploy reliability).
# Always rebuild from-opportunity BEFORE adapters/index, then run export smoke.
# Usage (on VPS, from /opt/kwizera-ai as root or with sudo -u kwizera for build):
#   bash deploy/selective-hfm-market-evidence-build.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=768}"
ESBUILD="${ROOT}/node_modules/.bin/esbuild"
test -x "$ESBUILD"

build_one() {
  local src="$1" out="$2"
  mkdir -p "$(dirname "$out")"
  "$ESBUILD" "$src" --outfile="$out" --platform=node --format=esm --packages=external --sourcemap
  echo "built $out"
}

# Order matters: leaf modules before barrel.
build_one ai/market-data/mt5-hfm/mif/market-evidence/adapters/common.ts \
  dist/ai/market-data/mt5-hfm/mif/market-evidence/adapters/common.js
build_one ai/market-data/mt5-hfm/mif/market-evidence/adapters/from-opportunity.ts \
  dist/ai/market-data/mt5-hfm/mif/market-evidence/adapters/from-opportunity.js
build_one ai/market-data/mt5-hfm/mif/market-evidence/adapters/index.ts \
  dist/ai/market-data/mt5-hfm/mif/market-evidence/adapters/index.js
build_one ai/market-data/mt5-hfm/mif/market-evidence/assemble-from-production.ts \
  dist/ai/market-data/mt5-hfm/mif/market-evidence/assemble-from-production.js
build_one ai/market-data/mt5-hfm/mif/market-evidence/package.ts \
  dist/ai/market-data/mt5-hfm/mif/market-evidence/package.js
build_one ai/market-data/mt5-hfm/mif/market-evidence/index.ts \
  dist/ai/market-data/mt5-hfm/mif/market-evidence/index.js

node "$ROOT/deploy/smoke-hfm-adapters-exports.mjs"
echo "[KWIZERA] selective market-evidence build + smoke OK"
