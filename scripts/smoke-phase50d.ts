/**
 * Lightweight Phase 50D smoke (no vitest / full app) for low-RAM local checks.
 */
import {
  classifyTicketBlocker,
  evaluateFxcmTicketEligibility,
  FXCM_TICKET_INELIGIBLE_MESSAGE,
  buildOpenAiAssistantGuidanceItems,
} from "../ai/forex-ai/analysis-response/index.ts";
import {
  buildDualMarketScenarios,
  isEmpiricallyCalibrated,
  resolveDirectionalProbability,
} from "../ai/forex-ai/multi-image-openai/index.ts";

let failed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) {
    failed += 1;
    console.error("FAIL:", msg);
  } else {
    console.log("PASS:", msg);
  }
}

assert(
  classifyTicketBlocker("No verified contract metadata for provider BINANCE / BABY/USDT.")?.code
    === "CONTRACT_NO_PROVIDER_META",
  "CONTRACT_NO_PROVIDER_META",
);
assert(
  classifyTicketBlocker("Stop loss not derived — missing swing structure or non-directional intent.")?.code
    === "SL_NO_STRUCTURE_OR_INTENT",
  "SL_NO_STRUCTURE_OR_INTENT",
);
assert(
  classifyTicketBlocker("Take profit not derived — missing swing structure or non-directional intent.")?.code
    === "TP_NO_STRUCTURE_OR_INTENT",
  "TP_NO_STRUCTURE_OR_INTENT",
);
assert(
  classifyTicketBlocker("Risk/reward requires finite entry, stop, and target prices.")?.code
    === "RR_NEED_ENTRY_STOP_TARGET",
  "RR_NEED_ENTRY_STOP_TARGET",
);

const prob = resolveDirectionalProbability({ instrument: "BABY/USDT" });
assert(prob.status === "NOT_CALIBRATED", "probability NOT_CALIBRATED");
assert(prob.display === "DIRECTIONAL PROBABILITY: NOT CALIBRATED", "probability display");
assert(!isEmpiricallyCalibrated(prob), "not empirically calibrated");

const dual = buildDualMarketScenarios({
  instrument: "BABY/USDT",
  timeframe: "1h",
  dataStatus: "HISTORICAL_ONLY",
  referencePrice: 0.042,
  referenceSource: "ANALYSIS_TIME last",
  referenceTimestampUtc: "2026-10-17T12:00:00.000Z",
  structure: {
    trendState: "BULLISH",
    lastSwingHigh: 0.05,
    lastSwingLow: 0.038,
    events: [],
    zones: [
      { side: "SUPPORT", low: 0.038, high: 0.04, status: "ACTIVE" },
      { side: "RESISTANCE", low: 0.048, high: 0.05, status: "ACTIVE" },
    ],
    patterns: [],
    warnings: [],
    insufficientHistory: false,
    quoteFreshness: "HISTORICAL_ONLY",
    dataUsable: true,
  },
  pullback: null,
  breakout: null,
});
assert(dual.bullish.available && dual.bearish.available, "dual scenarios available");
assert((dual.bullish.target1.price ?? 0) > 0.042, "bullish T1 above ref");
assert((dual.bearish.target1.price ?? 1) < 0.042, "bearish T1 below ref");

const elig = evaluateFxcmTicketEligibility({ provider: "BINANCE", instrument: "BABY/USDT" });
assert(!elig.eligible && elig.message === FXCM_TICKET_INELIGIBLE_MESSAGE, "Binance FXCM ineligible");
assert(elig.placesOrders === false, "never places orders");

const items = buildOpenAiAssistantGuidanceItems({
  plan: {
    schemaVersion: "forex-snapshot-trade-plans-v1",
    planId: "p1",
    planKind: "PULLBACK",
    version: 1,
    analysisProvider: "OPENAI",
    analysisId: "a1",
    snapshotId: "s1",
    contentFingerprint: "fp",
    instrument: "BABY/USDT",
    candleTimeframe: "1h",
    analysisPeriod: "7d",
    marketDirection: "UNCERTAIN",
    intent: "WAIT",
    lifecycle: "PLAN_CREATED",
    lifecycleNote: "waiting",
    entryZone: {
      lower: null,
      upper: null,
      reference: null,
      rationale: "",
      unavailableReason: "Entry zone unavailable — confirmed swing high/low not present in detector evidence.",
    },
    confirmationRequired: [],
    confirmationStatus: "NOT_STARTED",
    stopLoss: {
      price: null,
      rationale: "",
      unavailableReason: "Stop loss not derived — missing swing structure or non-directional intent.",
    },
    takeProfit: {
      prices: [],
      rationale: "",
      unavailableReason: "Take profit not derived — missing swing structure or non-directional intent.",
    },
    invalidationConditions: [],
    expiryConditions: [],
    riskReward: {
      ratio: null,
      risk: null,
      reward: null,
      unavailableReason: "Risk/reward requires finite entry, stop, and target prices.",
    },
    unsuitableReasons: [],
    positionRisk: {
      riskEligible: false,
      blockingReasons: ["Plan intent is WAIT — not risk-eligible for execution sizing."],
      accountCurrency: null,
      positionSize: null,
      positionSizeUnit: null,
      contract: {
        verified: false,
        convention: null,
        unavailableReason: "No verified contract metadata for provider BINANCE / BABY/USDT.",
      },
      netLossAccount: null,
      rewardRiskRatio: null,
      minRewardRiskRatio: null,
      margin: { unavailableReason: "n/a" },
      costs: { unavailableReason: "n/a", totalCostsAccount: null },
    },
  } as never,
  analysisDecision: "BUY",
  provider: "BINANCE",
  instrument: "BABY/USDT",
  tradeAllocation: { amount: 100, currency: "USD" },
});

assert(items.items.find((i) => i.tone === "direction")?.value === "BUY", "direction BUY with WAIT plan");
assert(items.items.find((i) => i.tone === "contracts")?.blockerCode?.startsWith("FXCM_"), "contracts FXCM blocker");
assert(items.items.find((i) => i.tone === "stop")?.blockerCode === "SL_NO_STRUCTURE_OR_INTENT", "stop blocker");
assert(items.items.find((i) => i.tone === "takeprofit")?.blockerCode === "TP_NO_STRUCTURE_OR_INTENT", "tp blocker");
assert(items.items.find((i) => i.tone === "risk")?.blockerCode === "RR_NEED_ENTRY_STOP_TARGET", "rr blocker");
assert(!items.fxcmEligibility.eligible, "guidance FXCM ineligible");

if (failed) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nPhase 50D smoke OK");
