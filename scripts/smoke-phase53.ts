/**
 * Lightweight Phase 53 smoke (no full app / no OpenAI network / no broker orders).
 */
import {
  AUTOMATED_EXECUTION_BANNER,
  AT_CONFIDENCE_LABEL,
  buildEvidenceBundle,
  validatePriceLevel,
} from "../ai/forex-ai/automated-trading/index.ts";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("PASS:", msg);
}

assert(AUTOMATED_EXECUTION_BANNER.includes("PHASE 53"), "banner phase 53");
assert(AT_CONFIDENCE_LABEL === "NOT CALIBRATED", "confidence label");

const built = buildEvidenceBundle({
  environment: "DEMO",
  instrument: "EUR/USD",
  candlesByTf: {
    H1: Array.from({ length: 30 }, (_, i) => ({
      time: 1_700_000_000 + i * 3600,
      open: 1.1 + i * 0.0001,
      high: 1.1005 + i * 0.0001,
      low: 1.0995 + i * 0.0001,
      close: 1.1002 + i * 0.0001,
    })),
  },
  verification: null,
});
assert(built.ok === true, "evidence ok");
assert(built.ok && built.evidence?.historicalOnly === true, "historical only");

const bad = validatePriceLevel({ price: 50 }, [1.1, 1.2], 0.01);
assert(bad.verifiedAgainstSnapshot === false, "reject fabricated level");

if (failed) {
  console.error(`\nPhase 53 smoke FAILED (${failed})`);
  process.exit(1);
}
console.log("\nPhase 53 smoke OK");
