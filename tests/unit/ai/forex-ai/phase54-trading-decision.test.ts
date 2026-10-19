/**
 * Phase 54 — Trading Decision Engine (signal validation only).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  AUTOMATED_EXECUTION_BANNER,
  AT_DECISION_PHASE,
  AT_DIRECTIONAL_CONFIDENCE_NOTE,
  defaultDecisionPolicy,
  evaluateTradingDecision,
  parseDecisionPolicyPatch,
  resetAtDecisionEngineForTests,
  resetAtDecisionStoreForTests,
  resolveMaxAnalysisAgeMs,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import type { AtOpenAiAnalysisResult } from "../../../../ai/forex-ai/automated-trading/analysis/types.ts";
import type { AutomatedTradingVerificationResult } from "../../../../ai/forex-ai/automated-trading/verification-types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function baseAnalysis(over: Partial<AtOpenAiAnalysisResult> = {}): AtOpenAiAnalysisResult {
  const now = new Date().toISOString();
  return {
    schemaVersion: "at-openai-ta-v1",
    phase: "53.3",
    analysisId: "analysis-buy-1",
    lifecycle: "ANALYSIS_VALID",
    environment: "DEMO",
    environmentEpoch: 1,
    instrument: "EUR/USD",
    timeframes: ["15m"],
    primaryTimeframe: "15m",
    inputFingerprint: "fp-evidence-abcdef0123456789",
    provider: "OPENAI",
    modelRequested: "gpt-6-luna",
    modelUsed: "gpt-6-luna",
    modelVisionEligible: true,
    trigger: "manual",
    monitorConfigEpoch: null,
    chartImage: {
      available: false,
      imageHash: null,
      capturedAtUtc: null,
      source: "none",
      note: "No chart",
      blocker: null,
      includedInOpenAiRequest: false,
    },
    direction: "BUY",
    directionalConfidencePct: 62,
    directionalConfidenceNote: AT_DIRECTIONAL_CONFIDENCE_NOTE,
    forecastHorizon: "Next 1× M15 candle close after observation (900000ms horizon; directional forecast only — not an order).",
    directionalBias: "BULLISH",
    trendState: "UPTREND",
    trendStrength: "MODERATE",
    mtfAgreement: "UNKNOWN",
    keyEvidence: ["HH"],
    counterEvidence: [],
    supportLevels: [],
    resistanceLevels: [],
    patterns: [],
    structureNotes: [],
    scenarios: [],
    explanation: "BUY lean — not an order.",
    dataQuality: "SUFFICIENT",
    limitations: [],
    blockers: [],
    confidenceLabel: "NOT CALIBRATED",
    evidenceScoreIsWinProbability: false,
    createdAtUtc: now,
    latencyMs: 10,
    placesOrders: false,
    historicalOnly: false,
    liveLabeled: false,
    ...over,
  };
}

function freshVerification(
  over: Partial<AutomatedTradingVerificationResult> = {},
): AutomatedTradingVerificationResult {
  return {
    identityStatus: "ACCOUNT_VERIFIED",
    environmentSelected: "DEMO",
    environmentConnected: "DEMO",
    environmentMatches: true,
    connectionStatus: "CONNECTED",
    environmentEpoch: 1,
    account: {
      accountIdMasked: "••••1234",
      environment: "DEMO",
      accountCurrency: "USD",
      balance: 10000,
      equity: 10000,
      equityDerived: false,
      equityDerivation: null,
      usedMargin: 0,
      usableMargin: 10000,
      fetchedAtUtc: new Date().toISOString(),
      ageMs: 100,
      isFresh: true,
      fields: {
        accountCurrency: true,
        balance: true,
        equity: true,
        usedMargin: true,
        usableMargin: true,
      },
      missingFields: [],
      snapshotCode: "ok",
    },
    instrument: {
      symbol: "EUR/USD",
      displaySymbol: "EUR/USD",
      provider: "FOREXCONNECT",
      recognized: true,
      level: "ELIGIBLE_FOR_FUTURE_RISK",
      instrumentType: "forex",
      baseAsset: "EUR",
      quoteAsset: "USD",
      pointSize: 0.00001,
      pipCostAccount: null,
      contractMultiplier: null,
      baseUnitSize: null,
      quantityMin: null,
      quantityStep: null,
      quantityUnit: null,
      marginRate: null,
      marginPerLotAccount: null,
      contractVerified: true,
      contractSource: "fc",
      unavailableReason: null,
    },
    market: {
      bid: 1.1001,
      ask: 1.1003,
      spread: 0.0002,
      feedStatus: "LIVE",
      sourceTimestampMs: Date.now(),
      receivedAtMs: Date.now(),
      priceChangeAgeMs: 500,
      receiptAgeMs: 200,
      updateCount: 10,
      marketSession: "ACTIVE",
    },
    readiness: {
      environmentVerified: true,
      accountIdentityVerified: true,
      accountMetadataSufficient: true,
      instrumentMetadataVerified: true,
      marketDataHealthVerified: true,
      riskEngineVerified: false,
      executionImplemented: false,
      readyForFutureAnalysis: true,
      readyForTrading: false,
    },
    blockers: [],
    verifiedAtUtc: new Date().toISOString(),
    placesOrders: false,
    ...over,
  };
}

function evalOpts(over: Partial<Parameters<typeof evaluateTradingDecision>[0]> = {}) {
  const analysis = over.analysis === undefined ? baseAnalysis() : over.analysis;
  return {
    analysis,
    latestAnalysis: over.latestAnalysis === undefined ? analysis : over.latestAnalysis,
    verification: over.verification === undefined ? freshVerification() : over.verification,
    currentEnvironment: "DEMO" as const,
    currentEnvironmentEpoch: 1,
    selectedInstrument: "EUR/USD",
    expectedEnvironmentEpoch: 1,
    policy: defaultDecisionPolicy(),
    nowMs: Date.now(),
    ...over,
  };
}

describe("Phase 54 decision evaluation", () => {
  it("accepts a valid BUY analysis for review when all gates pass", () => {
    const d = evaluateTradingDecision(evalOpts());
    expect(d.phase).toBe(AT_DECISION_PHASE);
    expect(d.decisionStatus).toBe("ACCEPTED_FOR_REVIEW");
    expect(d.direction).toBe("BUY");
    expect(d.directionalConfidencePct).toBe(62);
    expect(d.directionalConfidenceNote).toContain("NOT CALIBRATED");
    expect(d.confidenceIsCalibratedWinProbability).toBe(false);
    expect(d.placesOrders).toBe(false);
    expect(d.acceptsForExecution).toBe(false);
    expect(d.verification.readyForTrading).toBe(false);
    expect(d.blockers).toHaveLength(0);
  });

  it("accepts a valid SELL analysis for review", () => {
    const d = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({
        analysisId: "analysis-sell-1",
        direction: "SELL",
        directionalBias: "BEARISH",
        directionalConfidencePct: 71,
      }),
    }));
    expect(d.decisionStatus).toBe("ACCEPTED_FOR_REVIEW");
    expect(d.direction).toBe("SELL");
  });

  it("rejects missing source analysis", () => {
    const d = evaluateTradingDecision(evalOpts({ analysis: null, latestAnalysis: null }));
    expect(d.decisionStatus).toBe("REJECTED");
    expect(d.rejectionReasons.some((r) => /No source/i.test(r))).toBe(true);
    expect(d.blockers.some((b) => b.code === "SOURCE_ANALYSIS_MISSING")).toBe(true);
  });

  it("rejects invalid lifecycle / WAIT direction is already null on failed analysis", () => {
    const d = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({
        lifecycle: "ANALYSIS_FAILED",
        direction: null,
        directionalConfidencePct: null,
      }),
    }));
    expect(d.decisionStatus).toBe("REJECTED");
    expect(d.blockers.some((b) => b.code === "ANALYSIS_NOT_VALID")).toBe(true);
  });

  it("rejects stale quotes and unverified account", () => {
    const stale = evaluateTradingDecision(evalOpts({
      verification: freshVerification({
        market: {
          ...freshVerification().market,
          feedStatus: "STALE",
          bid: 1.1,
          ask: 1.1002,
        },
      }),
    }));
    expect(stale.decisionStatus).toBe("REJECTED");
    expect(stale.blockers.some((b) => b.code === "STALE_QUOTES")).toBe(true);

    const unverified = evaluateTradingDecision(evalOpts({
      verification: freshVerification({
        identityStatus: "ACCOUNT_IDENTITY_UNVERIFIED",
        account: { ...freshVerification().account, isFresh: false },
      }),
    }));
    expect(unverified.blockers.some((b) => b.code === "ACCOUNT_IDENTITY_UNVERIFIED")).toBe(true);
  });

  it("rejects instrument, environment, and epoch mismatches", () => {
    const inst = evaluateTradingDecision(evalOpts({ selectedInstrument: "GBP/USD" }));
    expect(inst.blockers.some((b) => b.code === "INSTRUMENT_MISMATCH")).toBe(true);

    const env = evaluateTradingDecision(evalOpts({ currentEnvironment: "LIVE" }));
    expect(env.blockers.some((b) => b.code === "ENVIRONMENT_MISMATCH")).toBe(true);

    const epoch = evaluateTradingDecision(evalOpts({ currentEnvironmentEpoch: 9 }));
    expect(epoch.blockers.some((b) => b.code === "EPOCH_MISMATCH")).toBe(true);
  });

  it("rejects when monitor chart was required but not included in OpenAI", () => {
    const d = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({
        trigger: "scheduled",
        monitorConfigEpoch: 3,
        chartImage: {
          available: true,
          imageHash: "abc",
          capturedAtUtc: new Date().toISOString(),
          source: "server-ohlc-render",
          note: "chart",
          blocker: null,
          includedInOpenAiRequest: false,
          marketDataFingerprint: "fp-evidence-abcdef0123456789",
        },
      }),
    }));
    expect(d.decisionStatus).toBe("REJECTED");
    expect(d.blockers.some((b) => b.code === "IMAGE_NOT_INCLUDED")).toBe(true);
  });

  it("accepts monitor analysis when image was included and fingerprint matches", () => {
    const fp = "fp-evidence-abcdef0123456789";
    const d = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({
        trigger: "scheduled",
        monitorConfigEpoch: 2,
        inputFingerprint: fp,
        chartImage: {
          available: true,
          imageHash: "imghash99",
          capturedAtUtc: new Date().toISOString(),
          source: "server-ohlc-render",
          note: "server chart",
          blocker: null,
          includedInOpenAiRequest: true,
          marketDataFingerprint: fp,
        },
      }),
    }));
    expect(d.decisionStatus).toBe("ACCEPTED_FOR_REVIEW");
    expect(d.chartImage.includedInOpenAiRequest).toBe(true);
    expect(d.chartImage.fingerprintMatch).toBe(true);
  });

  it("rejects stale / superseded / historical-only analyses", () => {
    const staleLifecycle = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({ lifecycle: "STALE_RESULT" }),
    }));
    expect(staleLifecycle.blockers.some((b) => b.code === "STALE_RESULT")).toBe(true);

    const old = baseAnalysis({
      analysisId: "old",
      createdAtUtc: new Date(Date.now() - 60_000).toISOString(),
    });
    const newer = baseAnalysis({
      analysisId: "new",
      createdAtUtc: new Date().toISOString(),
    });
    const superseded = evaluateTradingDecision(evalOpts({
      analysis: old,
      latestAnalysis: newer,
    }));
    expect(superseded.blockers.some((b) => b.code === "SUPERSEDED")).toBe(true);

    const hist = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({ historicalOnly: true, dataQuality: "HISTORICAL_ONLY" }),
    }));
    expect(hist.blockers.some((b) => b.code === "ANALYSIS_NOT_LIVE")).toBe(true);
  });

  it("does not apply confidence threshold when disabled; rejects below min when enabled", () => {
    const disabled = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({ directionalConfidencePct: 40 }),
      policy: { ...defaultDecisionPolicy(), confidenceThresholdEnabled: false },
    }));
    expect(disabled.decisionStatus).toBe("ACCEPTED_FOR_REVIEW");
    expect(disabled.checks.some((c) => c.code === "CONFIDENCE_THRESHOLD" && c.status === "SKIPPED")).toBe(true);

    const enabled = evaluateTradingDecision(evalOpts({
      analysis: baseAnalysis({ directionalConfidencePct: 40 }),
      policy: {
        ...defaultDecisionPolicy(),
        confidenceThresholdEnabled: true,
        minDirectionalConfidencePct: 70,
      },
    }));
    expect(enabled.decisionStatus).toBe("REJECTED");
    expect(enabled.blockers.some((b) => b.code === "CONFIDENCE_BELOW_THRESHOLD")).toBe(true);
  });

  it("BUY/SELL alone is never sufficient without fresh verification", () => {
    const d = evaluateTradingDecision(evalOpts({ verification: null }));
    expect(d.direction).toBe("BUY");
    expect(d.decisionStatus).toBe("REJECTED");
    expect(d.blockers.some((b) => b.code === "VERIFICATION_MISSING")).toBe(true);
  });
});

describe("Phase 54 policy helpers", () => {
  it("keeps confidence threshold disabled by default and validates patches", () => {
    const p = defaultDecisionPolicy();
    expect(p.confidenceThresholdEnabled).toBe(false);
    expect(resolveMaxAnalysisAgeMs(p, "15m")).toBeGreaterThanOrEqual(1_800_000);

    const bad = parseDecisionPolicyPatch({ minDirectionalConfidencePct: 150 });
    expect(bad.ok).toBe(false);

    const good = parseDecisionPolicyPatch({
      confidenceThresholdEnabled: true,
      minDirectionalConfidencePct: 65,
    });
    expect(good.ok).toBe(true);
    if (!good.ok) return;
    expect(good.patch.confidenceThresholdEnabled).toBe(true);
    expect(good.patch.minDirectionalConfidencePct).toBe(65);
  });
});

describe("Phase 54 static contracts", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p54-"));
    resetAtDecisionStoreForTests();
    resetAtDecisionEngineForTests();
    void tmp;
  });

  afterEach(() => {
    resetAtDecisionEngineForTests();
    resetAtDecisionStoreForTests();
  });

  it("registers decision APIs, Phase 54 banner, keeps orders forbidden, no Local AI", () => {
    expect(AUTOMATED_EXECUTION_BANNER).toContain("PHASE 54");
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/api/forex/automated-trading/decision/status");
    expect(api).toContain("/api/forex/automated-trading/decision/evaluate");
    expect(api).toContain("/api/forex/automated-trading/decision/history");
    expect(api).toContain("/api/forex/automated-trading/decision/policy");
    expect(api).toContain("requireForexAdmin");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);

    const engine = read("ai/forex-ai/automated-trading/decision/engine.ts");
    expect(engine).toContain("ACCEPTED_FOR_REVIEW");
    expect(engine).toContain("acceptsForExecution: false");
    expect(engine).not.toMatch(/getLocalAi|ollama|placeOrder/i);

    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("data-fx-at-decision");
    expect(page).toContain("PHASE 54");
    expect(page).toContain("Validate signal");
    expect(page).toContain("NOT CALIBRATED");
  });
});
