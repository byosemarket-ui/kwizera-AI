#!/usr/bin/env node
/**
 * Post-build smoke: ensure market-evidence adapters barrel exports Phase 01+ names.
 * Prevents selective esbuild deploys that rebuild assemble-from-production.js but
 * leave a stale adapters/index.js (worker crash on missing named export).
 *
 * Usage (from repo root, after dist build):
 *   node deploy/smoke-hfm-adapters-exports.mjs
 */
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import { existsSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const barrel = path.join(
  root,
  "dist/ai/market-data/mt5-hfm/mif/market-evidence/adapters/index.js",
);
const fromOpp = path.join(
  root,
  "dist/ai/market-data/mt5-hfm/mif/market-evidence/adapters/from-opportunity.js",
);

if (!existsSync(barrel)) {
  console.error(`[KWIZERA] adapters barrel missing: ${barrel}`);
  process.exit(1);
}
if (!existsSync(fromOpp)) {
  console.error(`[KWIZERA] from-opportunity missing: ${fromOpp}`);
  process.exit(1);
}

const required = [
  "adaptDetectionEvidenceRefToEvidence",
  "adaptOpportunityCandidateToEvidence",
  "adaptProductionResultToEvidence",
  "adaptRankingRunToEvidence",
  "adaptProbabilityBundleToEvidence",
  "adaptStrategyEligibilityToEvidence",
];

const mod = await import(pathToFileURL(barrel).href);
const missing = required.filter((name) => typeof mod[name] !== "function");
if (missing.length) {
  console.error(
    `[KWIZERA] adapters/index.js missing exports: ${missing.join(", ")}`,
  );
  process.exit(2);
}
console.log("[KWIZERA] adapters export smoke OK:", required.join(", "));
