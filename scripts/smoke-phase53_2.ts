/**
 * Lightweight Phase 53.2 smoke (no full app / no OpenAI network / no broker orders).
 */
import {
  AUTOMATED_EXECUTION_BANNER,
  AT_DIRECTIONAL_CONFIDENCE_NOTE,
  normalizeAtOpenAiAnalysis,
  parseAtBinaryDirection,
  parseAtDirectionalConfidencePct,
  resolveAtForecastHorizon,
} from "../ai/forex-ai/automated-trading/index.ts";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else console.log("PASS:", msg);
}

assert(AUTOMATED_EXECUTION_BANNER.includes("PHASE 53.2"), "banner 53.2");
assert(AT_DIRECTIONAL_CONFIDENCE_NOTE.includes("NOT CALIBRATED"), "confidence note");
assert(parseAtBinaryDirection("BUY").ok === true, "BUY ok");
assert(parseAtBinaryDirection("WAIT").ok === false, "WAIT rejected");
assert(parseAtDirectionalConfidencePct(101).ok === false, "pct>100 rejected");
assert(resolveAtForecastHorizon("15m").ok === true, "horizon 15m");

const candles = Array.from({ length: 30 }, (_, i) => ({
  time: 1_700_000_000 + i * 3600,
  open: 1.1,
  high: 1.11,
  low: 1.09,
  close: 1.105,
}));
const { result } = normalizeAtOpenAiAnalysis({
  analysisId: "smoke",
  raw: {
    direction: "SELL",
    directionalConfidencePct: 66,
    directionalBias: "BEARISH",
    trendState: "DOWNTREND",
    keyEvidence: ["LH"],
    structureNotes: ["BOS down"],
    dataQuality: "PARTIAL",
    explanation: "SELL lean — not an order.",
  },
  environment: "DEMO",
  environmentEpoch: 1,
  instrument: "EUR/USD",
  timeframes: ["1h"],
  primaryTimeframe: "1h",
  inputFingerprint: "fp",
  modelRequested: "gpt-6-luna",
  modelUsed: "gpt-6-luna",
  candlesByTf: { "1h": candles },
  historicalOnly: true,
  createdAtUtc: new Date().toISOString(),
  latencyMs: 1,
});
assert(result.direction === "SELL", "normalized SELL");
assert(result.directionalConfidencePct === 66, "normalized pct");
assert(result.placesOrders === false, "no orders");

if (failed) {
  console.error(`\nPhase 53.2 smoke FAILED (${failed})`);
  process.exit(1);
}
console.log("\nPhase 53.2 smoke OK");
