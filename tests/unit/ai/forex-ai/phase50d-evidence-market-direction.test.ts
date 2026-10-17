/**
 * Phase 50D — evidence direction, probability honesty, dual scenarios, FXCM blockers.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  classifyTicketBlocker,
  evaluateFxcmTicketEligibility,
  FXCM_TICKET_INELIGIBLE_MESSAGE,
  buildOpenAiAssistantGuidanceItems,
} from "../../../../ai/forex-ai/analysis-response/index.ts";
import {
  applyBinaryDirectionalClassification,
  buildDualMarketScenarios,
  computeBearishDirectionalScore,
  computeBullishDirectionalScore,
  isEmpiricallyCalibrated,
  resolveDirectionalProbability,
  syntheticMtfFromAnalysisText,
  type MultiImageCaptureRef,
} from "../../../../ai/forex-ai/multi-image-openai/index.ts";
import type { SnapshotStructureEvidenceSummary } from "../../../../ai/forex-ai/snapshot-plans/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function ref(partial: Partial<MultiImageCaptureRef> & { captureId: string; timeframe: string }): MultiImageCaptureRef {
  return {
    capturedAtUtc: "2026-10-17T11:00:00.000Z",
    capturedAtLocal: "local",
    mode: "MANUAL",
    instrument: { symbol: "BABY/USDT", displaySymbol: "BABY/USDT", provider: "BINANCE" },
    quote: {
      bid: 0.042,
      ask: null,
      mid: null,
      lastPrice: 0.042,
      feedHealth: "HISTORICAL_ONLY",
      lastGenuinePriceChangeAt: null,
      lastGenuinePriceChangeAgeMs: null,
    },
    candleWindow: {
      closedCount: 200,
      formingCount: 1,
      totalCount: 201,
      firstOpenTimeSec: 1,
      lastOpenTimeSec: 200,
    },
    marketSnapshot: { snapshotId: null, contentFingerprint: null },
    image: { mimeType: "image/png", width: 100, height: 50, byteLength: 1000 },
    hasImage: true,
    ...partial,
  };
}

function structure(partial?: Partial<SnapshotStructureEvidenceSummary>): SnapshotStructureEvidenceSummary {
  return {
    trendState: "BULLISH",
    lastSwingHigh: 0.05,
    lastSwingLow: 0.038,
    events: [{ type: "BOS", direction: "BULLISH", status: "CONFIRMED", level: 0.045 }],
    zones: [
      { side: "SUPPORT", low: 0.038, high: 0.04, status: "ACTIVE" },
      { side: "RESISTANCE", low: 0.048, high: 0.05, status: "ACTIVE" },
    ],
    patterns: [],
    warnings: [],
    insufficientHistory: false,
    quoteFreshness: "HISTORICAL_ONLY",
    dataUsable: true,
    ...partial,
  };
}

function waitPlan(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe("Phase 50D blocker codes", () => {
  it("maps distinct BABY/USDT-style reasons to distinct codes", () => {
    expect(classifyTicketBlocker(
      "No verified contract metadata for provider BINANCE / BABY/USDT.",
    )?.code).toBe("CONTRACT_NO_PROVIDER_META");
    expect(classifyTicketBlocker(
      "Stop loss not derived — missing swing structure or non-directional intent.",
    )?.code).toBe("SL_NO_STRUCTURE_OR_INTENT");
    expect(classifyTicketBlocker(
      "Take profit not derived — missing swing structure or non-directional intent.",
    )?.code).toBe("TP_NO_STRUCTURE_OR_INTENT");
    expect(classifyTicketBlocker(
      "Risk/reward requires finite entry, stop, and target prices.",
    )?.code).toBe("RR_NEED_ENTRY_STOP_TARGET");
    expect(classifyTicketBlocker(
      "Entry zone unavailable — confirmed swing high/low not present in detector evidence.",
    )?.code).toBe("ENTRY_NO_SWINGS");
    expect(classifyTicketBlocker(
      "Plan intent is WAIT — not risk-eligible for execution sizing.",
    )?.code).toBe("RISK_PLAN_WAIT");
    expect(classifyTicketBlocker(
      "Insufficient closed candles for structure/pattern detectors (have 3, need ≥20)",
    )?.code).toBe("STRUCTURE_INSUFFICIENT_CANDLES");
  });
});

describe("Phase 50D directional probability honesty", () => {
  it("always returns NOT CALIBRATED and never treats evidence score as probability", () => {
    const report = resolveDirectionalProbability({ instrument: "BABY/USDT", timeframe: "1h" });
    expect(report.status).toBe("NOT_CALIBRATED");
    expect(report.display).toBe("DIRECTIONAL PROBABILITY: NOT CALIBRATED");
    expect(report.bullishProbabilityPercent).toBeNull();
    expect(report.bearishProbabilityPercent).toBeNull();
    expect(report.sampleCount).toBe(0);
    expect(report.evidenceScoreIsNotProbability).toBe(true);
    expect(isEmpiricallyCalibrated(report)).toBe(false);
  });

  it("does not mark synthetic fixtures as calibrated", () => {
    const fake = {
      ...resolveDirectionalProbability(),
      // Even if a test mutates display text, empirical gate stays false without real journal fields.
    };
    expect(isEmpiricallyCalibrated(fake)).toBe(false);
  });
});

describe("Phase 50D binary direction independence", () => {
  it("strong bullish / bearish / mixed keep BUY|SELL independent of entry readiness", () => {
    const captures = [ref({ captureId: "a", timeframe: "5m" }), ref({ captureId: "b", timeframe: "1h" })];
    const mtfBull = {
      ...syntheticMtfFromAnalysisText({ timeframe: "1h" }),
      timeframeAgreement: "ALIGNED" as const,
      bullishScenario: "continuation",
      bearishScenario: "only if support breaks",
      higherTimeframeContext: "VISIBLE_IN_IMAGE: higher highs and higher lows uptrend",
    };
    const scoreInBull = {
      decision: "BUY",
      marketBias: "BULLISH",
      mtf: mtfBull,
      captures,
      hasAnalysisTimeSnapshot: true,
      quoteFreshness: "HISTORICAL_ONLY",
      feedHealth: "HISTORICAL_ONLY",
      keyEvidence: ["VISIBLE_IN_IMAGE: higher highs and higher lows", "CONFIRMED_BY_DATA: bullish BOS"],
      bullishScenario: "continuation",
      bearishScenario: "only if support breaks",
    };
    const bullish = applyBinaryDirectionalClassification({
      modelDecision: "WAIT",
      marketBias: "BULLISH",
      bullish: computeBullishDirectionalScore(scoreInBull),
      bearish: computeBearishDirectionalScore(scoreInBull),
      mtf: mtfBull,
      keyEvidence: scoreInBull.keyEvidence,
      bullishScenario: "continuation",
      bearishScenario: "only if support breaks",
      captures,
    });
    expect(bullish.direction).toBe("BUY");
    expect(bullish.entryReadiness).toBe("NOT_CONFIRMED");

    const mtfBear = {
      ...syntheticMtfFromAnalysisText({ timeframe: "1h" }),
      timeframeAgreement: "ALIGNED" as const,
      bullishScenario: "only if resistance breaks",
      bearishScenario: "continuation",
      higherTimeframeContext: "VISIBLE_IN_IMAGE: lower highs and lower lows downtrend",
    };
    const scoreInBear = {
      decision: "SELL",
      marketBias: "BEARISH",
      mtf: mtfBear,
      captures,
      hasAnalysisTimeSnapshot: true,
      quoteFreshness: "LIVE",
      feedHealth: "LIVE",
      keyEvidence: ["VISIBLE_IN_IMAGE: lower highs and lower lows", "CONFIRMED_BY_DATA: breakdown"],
      bullishScenario: "only if resistance breaks",
      bearishScenario: "continuation",
    };
    const bearish = applyBinaryDirectionalClassification({
      modelDecision: "SELL",
      marketBias: "BEARISH",
      bullish: computeBullishDirectionalScore(scoreInBear),
      bearish: computeBearishDirectionalScore(scoreInBear),
      mtf: mtfBear,
      keyEvidence: scoreInBear.keyEvidence,
      bullishScenario: "only if resistance breaks",
      bearishScenario: "continuation",
      captures,
    });
    expect(bearish.direction).toBe("SELL");
  });
});

describe("Phase 50D dual scenarios", () => {
  it("builds bullish and bearish levels from swing structure without inventing ATR", () => {
    const dual = buildDualMarketScenarios({
      instrument: "BABY/USDT",
      timeframe: "1h",
      dataStatus: "HISTORICAL_ONLY",
      referencePrice: 0.042,
      referenceSource: "ANALYSIS_TIME last",
      referenceTimestampUtc: "2026-10-17T12:00:00.000Z",
      structure: structure(),
      pullback: null,
      breakout: null,
      keyEvidence: ["CONFIRMED_BY_DATA: bullish BOS"],
      bullishScenarioText: "hold support",
      bearishScenarioText: "lose support",
    });
    expect(dual.bullish.available).toBe(true);
    expect(dual.bearish.available).toBe(true);
    expect(dual.bullish.target1.price).toBeGreaterThan(0.042);
    expect(dual.bearish.target1.price).toBeLessThan(0.042);
    expect(dual.bullish.invalidation.price).toBe(0.038);
    expect(dual.bearish.invalidation.price).toBe(0.05);
    expect(dual.bullish.atrDisclosure).toBeNull();
    expect(dual.dataStatus).toBe("HISTORICAL_ONLY");
  });

  it("withholds scenarios when swing structure is missing", () => {
    const dual = buildDualMarketScenarios({
      instrument: "BABY/USDT",
      timeframe: "1h",
      dataStatus: "HISTORICAL_ONLY",
      referencePrice: 0.042,
      referenceSource: "quote",
      referenceTimestampUtc: null,
      structure: structure({
        lastSwingHigh: null,
        lastSwingLow: null,
        dataUsable: false,
        insufficientHistory: true,
        warnings: ["Insufficient closed candles for structure/pattern detectors (have 3, need ≥20)"],
      }),
      pullback: null,
      breakout: null,
    });
    expect(dual.bullish.available).toBe(false);
    expect(dual.bearish.available).toBe(false);
    expect(dual.bullish.unavailableReason).toMatch(/Insufficient closed candles|Structure evidence/i);
  });
});

describe("Phase 50D FXCM eligibility + BABY/USDT ticket blockers", () => {
  it("marks Binance BABY/USDT as FXCM ticket ineligible while preserving BUY direction", () => {
    const elig = evaluateFxcmTicketEligibility({
      provider: "BINANCE",
      instrument: "BABY/USDT",
    });
    expect(elig.eligible).toBe(false);
    expect(elig.message).toBe(FXCM_TICKET_INELIGIBLE_MESSAGE);
    expect(elig.placesOrders).toBe(false);

    const items = buildOpenAiAssistantGuidanceItems({
      plan: waitPlan() as never,
      analysisDecision: "BUY",
      marketDirection: "BULLISH",
      provider: "BINANCE",
      instrument: "BABY/USDT",
      tradeAllocation: { amount: 100, currency: "USD" },
      supportingEvidence: ["higher lows"],
      contradictingEvidence: ["historical only"],
    });

    expect(items.items.find((i) => i.tone === "direction")?.value).toBe("BUY");
    expect(items.finalSummary.directionOrWait).toBe("BUY");

    const contracts = items.items.find((i) => i.tone === "contracts");
    expect(contracts?.value).toBe("unavailable");
    expect(contracts?.blockerCode).toMatch(/FXCM_/);
    expect(contracts?.unavailableReason).toMatch(/FXCM TICKET INELIGIBLE|BROKER INSTRUMENT NOT VERIFIED/);

    const stop = items.items.find((i) => i.tone === "stop");
    expect(stop?.blockerCode).toBe("SL_NO_STRUCTURE_OR_INTENT");

    const tp = items.items.find((i) => i.tone === "takeprofit");
    expect(tp?.blockerCode).toBe("TP_NO_STRUCTURE_OR_INTENT");

    const risk = items.items.find((i) => i.tone === "risk");
    expect(risk?.value).toBe("unavailable");
    expect(risk?.blockerCode).toBe("RR_NEED_ENTRY_STOP_TARGET");

    expect(items.fxcmEligibility.eligible).toBe(false);
    expect(items.items.find((i) => i.tone === "risk")?.why).toMatch(/capital set aside|Allocated capital/);
    expect(items.disclaimer).toMatch(/never places|Does not place/i);
  });

  it("keeps FXCM path eligible when provider is ForexConnect", () => {
    const elig = evaluateFxcmTicketEligibility({
      provider: "FOREXCONNECT",
      instrument: "EUR/USD",
      fxcmMappingStatus: "RESOLVED",
    });
    expect(elig.eligible).toBe(true);
    expect(elig.status).toBe("ELIGIBLE_WHEN_RISK_CLEARS");
  });
});

describe("Phase 50D static contracts", () => {
  it("wires probability, dual scenarios, broker gate, and phase tag", () => {
    const engine = read("ai/forex-ai/multi-image-openai/engine.ts");
    expect(engine).toContain("resolveDirectionalProbability");
    expect(engine).toContain("buildDualMarketScenarios");
    expect(engine).toContain("provider: String(snapshot.provider)");
    expect(engine).toContain("applyBinaryDirectionalClassification");
    expect(engine).not.toContain("placeOrder");
    expect(engine).not.toContain("submitOrder");

    expect(read("ai/forex-ai/multi-image-openai/directional-probability.ts"))
      .toContain("NOT_CALIBRATED");
    expect(read("desktop/forex/SnapshotAiResultPanels.tsx"))
      .toContain("DIRECTIONAL PROBABILITY: NOT CALIBRATED");
    expect(read("desktop/forex/SnapshotAiResultPanels.tsx"))
      .toContain("data-fx-market-direction-brief");
    expect(read("dev/server/forex-ai-openai-snapshot-api.ts")).toContain('phase: "50D"');
    expect(read("desktop/forex/ForexAiAnalysisPage.tsx")).toMatch(/Local|OpenAI|Compare/);
  });
});
