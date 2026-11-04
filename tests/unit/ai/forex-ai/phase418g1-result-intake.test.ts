/**
 * Phase 4.18G.1 — AI analysis result intake & decision understanding.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ANALYSIS_CONFIDENCE_TYPE,
  type CanonicalAnalysisResult,
} from "../../../../ai/forex-ai/automated-trading/analysis/canonical-analysis.types.ts";
import {
  ingestCanonicalAnalysisResult,
  getResultIntakePublicStatus,
  mapCanonicalToDecision,
  resetAtResultIntakeStoreForTests,
  resultIntakeIdempotencyKey,
  toOrderPreparationHandoff,
  validateCanonicalForIntake,
  AtResultIntakeStore,
  AT_RESULT_INTAKE_SCHEMA,
} from "../../../../ai/forex-ai/automated-trading/result-intake/index.ts";
import {
  getAtSystemMasterStore,
  resetAtSystemMasterStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/system-master/store.ts";
import { AT_SYSTEM_MASTER_OWNED_MODULES } from "../../../../ai/forex-ai/automated-trading/system-master/types.ts";

function baseResult(over: Partial<CanonicalAnalysisResult> = {}): CanonicalAnalysisResult {
  const now = "2026-11-03T15:30:00.000Z";
  return {
    schemaVersion: "kwizera.canonical-analysis.v1",
    analysisVersion: "4.18C",
    analysisId: "analysis-buy-1",
    environment: "DEMO",
    instrument: "XAU/USD",
    provider: "FOREXCONNECT",
    primaryTimeframe: "5m",
    analyzedAtUtc: now,
    trigger: "unit_test",
    evidenceFingerprint: "fp-buy-1",
    quote: {
      instrument: "XAU/USD",
      bid: 2600,
      ask: 2600.5,
      quoteFresh: true,
      freshnessReasonCode: "LIVE_FRESH",
      effectivePriceChangeAgeMs: 100,
      snapshotFingerprint: "q1",
      evaluatedAtUtc: now,
    },
    dataQuality: "SUFFICIENT",
    candleQuality: {
      strategyReady: true,
      blockers: [],
      closedBars: 80,
      invalidOhlcCount: 0,
      duplicateCount: 0,
    },
    indicators: {
      fastSma: { value: 10, provenance: "DETERMINISTIC_COMPUTED", sourceComponent: "sma9", asOfUtc: now },
      slowSma: { value: 9, provenance: "DETERMINISTIC_COMPUTED", sourceComponent: "sma21", asOfUtc: now },
      atr: { value: 1.2, provenance: "DETERMINISTIC_COMPUTED", sourceComponent: "atr", asOfUtc: now },
      atrMethod: "SMA_OF_TR",
      atrLength: 14,
    },
    marketStructure: {
      trendDirection: { value: "BULLISH", provenance: "DETERMINISTIC_COMPUTED", sourceComponent: "structure", asOfUtc: now },
      trendStrength: { value: "MODERATE", provenance: "DETERMINISTIC_COMPUTED", sourceComponent: "structure", asOfUtc: now },
      momentum: { value: "UP", provenance: "DETERMINISTIC_COMPUTED", sourceComponent: "structure", asOfUtc: now },
      volatilityRegime: { value: "NORMAL", provenance: "DETERMINISTIC_COMPUTED", sourceComponent: "structure", asOfUtc: now },
    },
    supportResistance: { support: [], resistance: [] },
    htf: {
      primaryTimeframe: "5m",
      confirmationTimeframes: ["15m", "1h"],
      perTf: [],
      agreement: "AGREE_BULLISH",
    },
    deterministic: {
      strategyId: "sma-crossover-v1",
      direction: "BUY",
      code: "SMA_CROSS_UP",
      reasons: ["SMA9 crossed above SMA21"],
      entryPrice: 2600,
      stopLoss: 2590,
      takeProfit: 2620,
      confidencePct: 60,
      closedCandle: null,
      atrMethod: "SMA_OF_TR",
    },
    ai: {
      analysisId: "oa-1",
      schemaVersion: "at-openai-ta-v1",
      lifecycle: "ANALYSIS_VALID",
      direction: "BUY",
      directionalBias: "BULLISH",
      trendState: "UP",
      trendStrength: "MODERATE",
      mtfAgreement: "AGREE",
      supportLevels: [],
      resistanceLevels: [],
      explanation: "AI agrees BUY",
      directionalConfidencePct: 55,
      placesOrders: false,
    },
    finalOutcome: "BUY_CANDIDATE",
    direction: "BUY",
    marketInterpretation: "BULLISH",
    confidencePct: 62,
    confidenceType: ANALYSIS_CONFIDENCE_TYPE,
    confidenceModelVersion: "analysis-confidence.v1",
    confidenceBreakdown: {
      modelVersion: "analysis-confidence.v1",
      confidenceType: ANALYSIS_CONFIDENCE_TYPE,
      factors: [],
      availableWeightSum: 0,
      weightedScorePct: 62,
      limitations: ["NOT_CALIBRATED"],
      isCalibratedWinProbability: false,
    },
    confidenceLimitations: ["NOT_CALIBRATED"],
    reconciliationCode: "RECON_DET_BUY",
    explanation: ["Deterministic BUY candidate"],
    validationErrors: [],
    placesOrders: false,
    acceptsForExecution: false,
    ...over,
  };
}

describe("Phase 4.18G.1 result intake", () => {
  let tmp: string;
  let store: AtResultIntakeStore;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-g1-"));
    fs.mkdirSync(path.join(tmp, "forex-automated-trading"), { recursive: true });
    resetAtResultIntakeStoreForTests();
    resetAtSystemMasterStoreForTests();
    store = new AtResultIntakeStore(tmp);
  });

  afterEach(() => {
    resetAtResultIntakeStoreForTests();
    resetAtSystemMasterStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("includes result_intake in System Master owned modules", () => {
    expect(AT_SYSTEM_MASTER_OWNED_MODULES).toContain("result_intake");
  });

  it("1. accepts valid canonical BUY", async () => {
    const out = await ingestCanonicalAnalysisResult({
      result: baseResult(),
      enrichment: {
        observationId: "obs-1",
        imageId: "img-1",
        imageHash: "hash-1",
        expectedImageHash: "hash-1",
        includedImageBytesInRequest: true,
        imageSource: "SERVER_OHLC_RENDER",
      },
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    expect(out.ok).toBe(true);
    expect(out.record?.decision).toBe("BUY");
    expect(out.record?.canonicalDecision).toBe("BUY");
    expect(out.record?.intakeLifecycle).toBe("ACCEPTED");
    expect(out.record?.eligibleForOrderPreparation).toBe(true);
    expect(out.record?.confidenceType).toBe("ANALYSIS_CONFIDENCE");
    expect(out.record?.isCalibratedWinProbability).toBe(false);
    expect(out.handoff?.canonicalDirection).toBe("BUY");
    expect(out.placesOrders).toBe(false);
    expect(out.mutatesBroker).toBe(false);
  });

  it("2. accepts valid canonical SELL", async () => {
    const out = await ingestCanonicalAnalysisResult({
      result: baseResult({
        analysisId: "analysis-sell-1",
        evidenceFingerprint: "fp-sell",
        finalOutcome: "SELL_CANDIDATE",
        direction: "SELL",
        marketInterpretation: "BEARISH",
        reconciliationCode: "RECON_DET_SELL",
        deterministic: {
          strategyId: "sma-crossover-v1",
          direction: "SELL",
          code: "SMA_CROSS_DOWN",
          reasons: ["cross down"],
          entryPrice: 1,
          stopLoss: 2,
          takeProfit: 0.5,
          confidencePct: 58,
          closedCandle: null,
          atrMethod: "SMA_OF_TR",
        },
        ai: {
          analysisId: "oa-s",
          schemaVersion: "at-openai-ta-v1",
          lifecycle: "ANALYSIS_VALID",
          direction: "SELL",
          directionalBias: "BEARISH",
          trendState: "DOWN",
          trendStrength: "MODERATE",
          mtfAgreement: "AGREE",
          supportLevels: [],
          resistanceLevels: [],
          explanation: "sell",
          directionalConfidencePct: 60,
          placesOrders: false,
        },
      }),
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    expect(out.record?.decision).toBe("SELL");
    expect(out.handoff?.canonicalDirection).toBe("SELL");
  });

  it("3. accepts valid NO_TRADE without order handoff", async () => {
    const out = await ingestCanonicalAnalysisResult({
      result: baseResult({
        analysisId: "analysis-nt-1",
        evidenceFingerprint: "fp-nt",
        finalOutcome: "NO_TRADE",
        direction: null,
        marketInterpretation: null,
        confidencePct: null,
        reconciliationCode: "RECON_NO_CROSS_AI_IGNORED",
        deterministic: {
          strategyId: "sma-crossover-v1",
          direction: "NO_TRADE",
          code: "NO_CROSS",
          reasons: ["no cross"],
          entryPrice: null,
          stopLoss: null,
          takeProfit: null,
          confidencePct: null,
          closedCandle: null,
          atrMethod: "SMA_OF_TR",
        },
      }),
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    expect(out.ok).toBe(true);
    expect(out.record?.decision).toBe("NO_TRADE");
    expect(out.record?.eligibleForOrderPreparation).toBe(false);
    expect(out.handoff).toBeNull();
    expect(out.record?.noTradeReason).toBeTruthy();
  });

  it("4. AI BUY but canonical NO_TRADE stays NO_TRADE", async () => {
    const mapped = mapCanonicalToDecision(
      baseResult({
        finalOutcome: "NO_TRADE",
        direction: null,
        ai: {
          analysisId: "oa",
          schemaVersion: "at-openai-ta-v1",
          lifecycle: "ANALYSIS_VALID",
          direction: "BUY",
          directionalBias: "BULLISH",
          trendState: "UP",
          trendStrength: "WEAK",
          mtfAgreement: "MIXED",
          supportLevels: [],
          resistanceLevels: [],
          explanation: "ai buy",
          directionalConfidencePct: 70,
          placesOrders: false,
        },
        deterministic: {
          strategyId: "sma-crossover-v1",
          direction: "NO_TRADE",
          code: "NO_CROSS",
          reasons: ["no cross"],
          entryPrice: null,
          stopLoss: null,
          takeProfit: null,
          confidencePct: null,
          closedCandle: null,
          atrMethod: "SMA_OF_TR",
        },
        reconciliationCode: "RECON_NO_CROSS_AI_IGNORED",
      }),
    );
    expect(mapped.decision).toBe("NO_TRADE");
    expect(mapped.canonicalDecision).toBe("NO_TRADE");
  });

  it("5. AI SELL vs strategy BUY conflict has no order handoff", async () => {
    const out = await ingestCanonicalAnalysisResult({
      result: baseResult({
        analysisId: "analysis-conflict",
        evidenceFingerprint: "fp-cf",
        finalOutcome: "CONFLICT",
        direction: null,
        confidencePct: null,
        reconciliationCode: "RECON_DIR_CONFLICT",
        ai: {
          analysisId: "oa",
          schemaVersion: "at-openai-ta-v1",
          lifecycle: "ANALYSIS_VALID",
          direction: "SELL",
          directionalBias: "BEARISH",
          trendState: "DOWN",
          trendStrength: "MODERATE",
          mtfAgreement: "CONFLICT",
          supportLevels: [],
          resistanceLevels: [],
          explanation: "ai sell",
          directionalConfidencePct: 66,
          placesOrders: false,
        },
      }),
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    expect(out.record?.decision).toBe("NO_TRADE");
    expect(out.record?.canonicalOutcome).toBe("CONFLICT");
    expect(out.handoff).toBeNull();
  });

  it("6–8. missing observation/image and hash mismatch", () => {
    const r = baseResult();
    const nowMs = Date.parse("2026-11-03T15:31:00.000Z");
    expect(
      validateCanonicalForIntake(r, {}, { requireObservation: true, nowMs }).validationStatus,
    ).toBe("INVALID_OBSERVATION");
    expect(
      validateCanonicalForIntake(r, { observationId: "o" }, { requireImage: true, nowMs }).validationStatus,
    ).toBe("INVALID_IMAGE");
    expect(
      validateCanonicalForIntake(
        r,
        { imageHash: "a", expectedImageHash: "b" },
        { nowMs },
      ).validationStatus,
    ).toBe("IMAGE_HASH_MISMATCH");
  });

  it("9. rejects stale result", () => {
    const r = baseResult({ analyzedAtUtc: "2026-11-01T00:00:00.000Z" });
    expect(
      validateCanonicalForIntake(r, null, {
        nowMs: Date.parse("2026-11-03T15:30:00.000Z"),
        maxAgeMs: 60_000,
      }).validationStatus,
    ).toBe("STALE_ANALYSIS");
  });

  it("10–11. invalid confidence and calibration claims", () => {
    expect(
      validateCanonicalForIntake(baseResult({ confidencePct: 150 }), null).validationStatus,
    ).toBe("INVALID_CONFIDENCE");
    expect(
      validateCanonicalForIntake(
        baseResult({
          confidenceBreakdown: {
            modelVersion: "analysis-confidence.v1",
            confidenceType: ANALYSIS_CONFIDENCE_TYPE,
            factors: [],
            availableWeightSum: 0,
            weightedScorePct: 50,
            limitations: [],
            isCalibratedWinProbability: true as false,
          },
        }),
        null,
      ).validationStatus,
    ).toBe("CALIBRATION_CLAIM_REJECTED");
  });

  it("12. invalid AI schema", () => {
    expect(
      validateCanonicalForIntake(
        baseResult({ schemaVersion: "bad" as "kwizera.canonical-analysis.v1" }),
        null,
      ).validationStatus,
    ).toBe("INVALID_SCHEMA");
  });

  it("13. duplicate analysis delivery is idempotent", async () => {
    const result = baseResult();
    const a = await ingestCanonicalAnalysisResult({
      result,
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    const b = await ingestCanonicalAnalysisResult({
      result,
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.record?.resultId).toBe(a.record?.resultId);
    expect(store.count()).toBe(1);
    expect(resultIntakeIdempotencyKey(result.analysisId, result.evidenceFingerprint)).toContain(result.analysisId);
  });

  it("14. superseded result preserves history", async () => {
    const first = await ingestCanonicalAnalysisResult({
      result: baseResult({ analysisId: "a1", evidenceFingerprint: "fp1" }),
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    const second = await ingestCanonicalAnalysisResult({
      result: baseResult({ analysisId: "a2", evidenceFingerprint: "fp2" }),
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:32:00.000Z"),
    });
    expect(second.record?.intakeLifecycle).toBe("ACCEPTED");
    const prior = store.get(first.record!.resultId);
    expect(prior?.intakeLifecycle).toBe("SUPERSEDED");
    expect(prior?.supersededByResultId).toBe(second.record?.resultId);
    expect(store.count()).toBe(2);
  });

  it("15–16. persistent history recovery and corrupt file", async () => {
    await ingestCanonicalAnalysisResult({
      result: baseResult(),
      store,
      bypassSystemMasterGate: true,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    resetAtResultIntakeStoreForTests();
    const reloaded = new AtResultIntakeStore(tmp);
    expect(reloaded.count()).toBe(1);
    expect(reloaded.latest()?.schemaVersion).toBe(AT_RESULT_INTAKE_SCHEMA);

    const corruptPath = path.join(tmp, "forex-automated-trading", "analysis-result-intake.json");
    fs.writeFileSync(corruptPath, "{not-json", "utf8");
    const recovered = new AtResultIntakeStore(tmp);
    expect(recovered.count()).toBe(0);
    expect(recovered.latest()).toBeNull();
  });

  it("17. System Master OFF skips new intake", async () => {
    const prevRoot = process.env.KWIZERA_STORAGE_ROOT;
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    resetAtSystemMasterStoreForTests();
    const master = getAtSystemMasterStore();
    await master.forceSet((prev) => ({
      ...prev,
      ownerState: "OFF",
      masterEnabled: false,
      operationalState: "OFF",
    }));
    const out = await ingestCanonicalAnalysisResult({
      result: baseResult({ analysisId: "off-1", evidenceFingerprint: "fp-off" }),
      store,
      bypassSystemMasterGate: false,
      nowMs: Date.parse("2026-11-03T15:31:00.000Z"),
    });
    if (prevRoot == null) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevRoot;
    resetAtSystemMasterStoreForTests();
    expect(out.skipped).toBe(true);
    expect(out.ok).toBe(false);
    expect(store.count()).toBe(0);
  });

  it("18. automatic ingestion wiring exists after canonical persist", () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), "ai/forex-ai/automated-trading/analysis/canonical-analysis.service.ts"),
      "utf8",
    );
    expect(src).toContain("publishResultIntake");
    expect(src).toContain("ingestCanonicalAnalysisResult");
    expect(src).toContain("ingestResultIntake");
  });

  it("19. dashboard/backend markers present", () => {
    const ui = fs.readFileSync(
      path.join(process.cwd(), "desktop/forex/ForexAutomatedTradingPage.tsx"),
      "utf8",
    );
    expect(ui).toContain("data-fx-at-result-intake");
    expect(ui).toContain("/api/forex/automated-trading/result-intake/status");
    expect(ui).toContain("not a broker order");
    const api = fs.readFileSync(
      path.join(process.cwd(), "dev/server/forex-automated-trading-api.ts"),
      "utf8",
    );
    expect(api).toContain("result-intake/status");
    expect(api).toContain("result-intake/handoff");
  });

  it("20. no broker mutation flags on handoff and status", () => {
    const handoff = toOrderPreparationHandoff(null);
    expect(handoff).toBeNull();
    const status = getResultIntakePublicStatus(store);
    expect(status.placesOrders).toBe(false);
    expect(status.acceptsForExecution).toBe(false);
    expect(status.mutatesBroker).toBe(false);
  });
});
