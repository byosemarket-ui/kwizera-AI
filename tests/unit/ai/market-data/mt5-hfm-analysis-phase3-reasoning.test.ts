/**
 * Phase 3 / 3.1 — HFM AI Reasoning unit tests (mocked OpenAI; no real credentials).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HFM_REASONING_DISCLAIMER,
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
  __resetReasoningJobStateForTests,
  __setHfmReasoningStorageForTests,
  buildHfmReasoningEvidencePackage,
  buildMockValidReasoningPayload,
  HfmReasoningStorage,
  tryAcquireReasoningLock,
  releaseReasoningLock,
  isReasoningLocked,
  validateHfmReasoningModelResponse,
  normalizeHfmReasoningConfidence,
  validateTradePlanPricesAgainstInstrument,
  loadAndValidateHfmReasoningContext,
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/index";
import {
  __setHfmAnalysisStorageForTests,
  HfmAnalysisStorage,
  HFM_ANALYSIS_PROVIDER,
} from "../../../../ai/market-data/mt5-hfm/analysis/index";
import type { HfmAnalysisContextResult } from "../../../../ai/market-data/mt5-hfm/analysis/types";

const MOCK_INSTRUMENT = {
  symbol: "XAUUSD",
  digits: 2,
  point: 0.01,
  tickSize: 0.01,
  source: "HFM_CATALOG" as const,
};

function makeContext(symbol = "XAUUSD"): HfmAnalysisContextResult {
  const snapId = "11111111-2222-3333-4444-555555555555";
  const hash = "a".repeat(64);
  const mkTf = (tf: string) => {
    const historical = Array.from({ length: 40 }, (_, i) => ({
      symbol,
      provider: "HFM_MT5" as const,
      timeframe: tf,
      timestamp: 1_700_000_000 + i * 300,
      open: 100 + i * 0.01,
      high: 100.1 + i * 0.01,
      low: 99.9 + i * 0.01,
      close: 100.05 + i * 0.01,
      tickVolume: 10,
      realVolume: null,
      volumeType: "tick" as const,
      provenance: "native" as const,
      isCurrent: false,
      sourceTimestamp: 1_700_000_000 + i * 300,
      normalizedAt: new Date().toISOString(),
    }));
    return {
      timeframe: tf,
      symbol,
      historical,
      current: { ...historical[historical.length - 1]!, isCurrent: true, provenance: "live_aggregate" as const },
      candleCount: historical.length,
      oldestTimestamp: historical[0]!.timestamp,
      newestTimestamp: historical[historical.length - 1]!.timestamp,
      freshness: "LIVE",
      connectionStatus: "CONNECTED",
      validationStatus: "ok" as const,
      sourceProvenance: "HFM_MT5",
      errors: [],
    };
  };
  return {
    ok: true,
    state: "COMPLETED",
    job: {
      jobId: "job-1",
      provider: "HFM_MT5",
      symbolAtStart: symbol,
      selectedSymbolVersion: 1,
      chartTimeframeAtStart: "H4",
      analysisTimeframes: ["H1", "M30", "M15", "M5"],
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: "COMPLETED",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    snapshot: {
      snapshotId: snapId,
      snapshotHash: hash,
      hashVersion: "hfm-analysis-snapshot-v1",
      provider: "HFM_MT5",
      symbol,
      capturedAt: new Date().toISOString(),
      chartTimeframeAtStart: "H4",
      timeframes: {
        H1: mkTf("H1"),
        M30: mkTf("M30"),
        M15: mkTf("M15"),
        M5: mkTf("M5"),
      },
      quote: {
        symbol,
        bid: 100,
        ask: 100.1,
        spread: 0.1,
        brokerTimestamp: Math.floor(Date.now() / 1000),
        receiveTimestamp: new Date().toISOString(),
        freshness: "LIVE",
        acquisition: "SymbolInfoTick",
      },
      dataQuality: {
        status: "VALID",
        errors: [],
        warnings: [],
        approvedForAiReasoning: true,
        policyNote: "test",
      },
      synchronization: {
        status: "VALID",
        symbol,
        timeframesPresent: ["H1", "M30", "M15", "M5"],
        timeframesMissing: [],
        latestQuoteTimestamp: Math.floor(Date.now() / 1000),
        latestCandleByTf: { H1: 1, M30: 1, M15: 1, M5: 1 },
        warnings: [],
        errors: [],
      },
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    },
    chartImages: {},
    timings: { collectMs: 1, normalizeMs: 1, validateMs: 1, syncMs: 1, renderMs: 1, totalMs: 4 },
    diagnostics: [],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

const expectedBase = {
  symbol: "XAUUSD",
  contextId: "ctx",
  snapshotId: "ctx",
  snapshotHash: "hash",
  model: "gpt-6-luna",
};

describe("HFM Analysis Phase 3 — response validation", () => {
  it("accepts valid NO_TRADE payload", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "NO_TRADE" });
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.decision.action).toBe("NO_TRADE");
      expect(v.result.placesOrders).toBe(false);
      expect(v.result.disclaimer).toBe(HFM_REASONING_DISCLAIMER);
      expect(v.result.schemaVersion).toBe(HFM_REASONING_SCHEMA_VERSION);
      expect(v.result.promptVersion).toBe(HFM_REASONING_PROMPT_VERSION);
      expect(v.result.completeness.status).toBe("COMPLETE");
    }
  });

  it("accepts valid BUY with stop below entry when instrument meta present", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "BUY" });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: MOCK_INSTRUMENT,
    });
    expect(v.ok).toBe(true);
  });

  it("forces trusted symbol identity over model-supplied symbol", () => {
    const raw = buildMockValidReasoningPayload(expectedBase);
    raw.symbol = "EURUSD";
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.result.symbol).toBe("XAUUSD");
  });

  it("rejects BUY with stop above entry", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "BUY" });
    (raw.tradePlan as { stopLoss: number }).stopLoss = 200;
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: MOCK_INSTRUMENT,
    });
    expect(v.ok).toBe(false);
  });

  it("coerces NO_TRADE tradePlan direction BUY to NONE", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "NO_TRADE" });
    (raw.tradePlan as { direction: string }).direction = "BUY";
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.result.tradePlan.direction).toBe("NONE");
  });

  it("marks null scenarios as NOT_SUPPORTED without inventing ACTIVE thesis", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "WAITING_FOR_CONFIRMATION" });
    (raw as { scenarios: unknown }).scenarios = null;
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.scenarios.bullish.status).toBe("NOT_SUPPORTED");
      expect(v.result.scenarios.bearish.status).toBe("NOT_SUPPORTED");
      expect(v.result.decision.action).toBe("WAITING_FOR_CONFIRMATION");
    }
  });

  it("coerces lowercase gpt-6-luna enum fields into schema", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "WAITING_FOR_CONFIRMATION" });
    (raw.decision as { action: string; confidenceLabel: string; confidence: unknown }).action = "waiting_for_confirmation";
    (raw.decision as { confidenceLabel: string }).confidenceLabel = "moderate";
    (raw.decision as { confidence: unknown }).confidence = "0.55";
    (raw.marketOverview as Record<string, string>).marketCondition = "ranging";
    (raw.marketOverview as Record<string, string>).overallBias = "mixed";
    (raw.marketOverview as Record<string, string>).timeframeAlignment = "partially aligned";
    (raw.riskAssessment as { riskLevel: string }).riskLevel = "high";
    (raw.scenarios as { bullish: { status: string } }).bullish.status = "possible";
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.decision.action).toBe("WAITING_FOR_CONFIRMATION");
      expect(v.result.decision.confidence).toBe(55);
      expect(v.result.decision.confidenceLabel).toBe("MODERATE");
      expect(v.result.marketOverview.marketCondition).toBe("RANGING");
      expect(v.result.marketOverview.overallBias).toBe("MIXED");
      expect(v.result.marketOverview.timeframeAlignment).toBe("PARTIALLY_ALIGNED");
      expect(v.result.riskAssessment.riskLevel).toBe("HIGH");
      expect(v.result.scenarios.bullish.status).toBe("POSSIBLE");
      expect(v.result.tradePlan.direction).toBe("NONE");
    }
  });
});

describe("Phase 3.1 — missing-data honesty", () => {
  it("marks omitted TF blocks as NOT_PROVIDED (not synthetic NEUTRAL thesis)", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "WAITING_FOR_CONFIRMATION" });
    delete (raw.timeframeAnalysis as Record<string, unknown>).H1;
    delete (raw.timeframeAnalysis as Record<string, unknown>).M5;
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.timeframeAnalysis.H1.sectionStatus).toBe("NOT_PROVIDED");
      expect(v.result.timeframeAnalysis.H1.bias).toBe("NOT_PROVIDED");
      expect(v.result.timeframeAnalysis.H1.observations).toEqual([]);
      expect(v.result.timeframeAnalysis.M5.sectionStatus).toBe("NOT_PROVIDED");
      expect(v.result.timeframeAnalysis.M30.sectionStatus).toBe("PROVIDED");
      expect(v.result.completeness.status).toBe("INCOMPLETE");
      expect(v.result.analysisStatus).toBe("COMPLETED_WITH_GAPS");
      expect(v.result.evidence.missingData.some((x) => x.includes("H1"))).toBe(true);
    }
  });

  it("marks missing riskLevel as NOT_PROVIDED (not MODERATE)", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "NO_TRADE" });
    delete (raw.riskAssessment as { riskLevel?: string }).riskLevel;
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.riskAssessment.sectionStatus).toBe("NOT_PROVIDED");
      expect(v.result.riskAssessment.riskLevel).toBe("NOT_PROVIDED");
      expect(v.result.completeness.missingSections).toContain("riskAssessment");
    }
  });

  it("marks missing market overview as NOT_PROVIDED", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "NO_TRADE" });
    (raw as { marketOverview: unknown }).marketOverview = null;
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.marketOverview.sectionStatus).toBe("NOT_PROVIDED");
      expect(v.result.marketOverview.marketCondition).toBe("NOT_PROVIDED");
      expect(v.result.marketOverview.overallBias).toBe("NOT_PROVIDED");
    }
  });

  it("rejects BUY when a timeframe analysis is missing", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "BUY" });
    delete (raw.timeframeAnalysis as Record<string, unknown>).M15;
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: MOCK_INSTRUMENT,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toMatch(/BUY\/SELL rejected/i);
  });

  it("never promotes WAITING to BUY when sections are missing", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "WAITING_FOR_CONFIRMATION" });
    delete (raw.timeframeAnalysis as Record<string, unknown>).H1;
    (raw as { marketOverview: unknown }).marketOverview = null;
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.decision.action).toBe("WAITING_FOR_CONFIRMATION");
      expect(v.result.tradePlan.direction).toBe("NONE");
    }
  });
});

describe("Phase 3.1 — confidence validation", () => {
  const cases: Array<{ in: unknown; ok: boolean; out?: number }> = [
    { in: 0, ok: true, out: 0 },
    { in: 0.25, ok: true, out: 25 },
    { in: 0.72, ok: true, out: 72 },
    { in: 1, ok: true, out: 100 },
    { in: 1.0, ok: true, out: 100 },
    { in: 72, ok: true, out: 72 },
    { in: 100, ok: true, out: 100 },
    { in: -0.1, ok: false },
    { in: -10, ok: false },
    { in: 100.1, ok: false },
    { in: 101, ok: false },
    { in: Number.NaN, ok: false },
    { in: Number.POSITIVE_INFINITY, ok: false },
    { in: Number.NEGATIVE_INFINITY, ok: false },
    { in: "nope", ok: false },
    { in: null, ok: false },
    { in: undefined, ok: false },
  ];
  for (const c of cases) {
    it(`confidence ${String(c.in)} → ${c.ok ? c.out : "reject"}`, () => {
      const n = normalizeHfmReasoningConfidence(c.in);
      expect(n.ok).toBe(c.ok);
      if (c.ok && n.ok) expect(n.confidence).toBe(c.out);
    });
  }

  it("rejects invalid confidence in full response validation", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "NO_TRADE" });
    (raw.decision as { confidence: number }).confidence = 101;
    const v = validateHfmReasoningModelResponse({ raw, expected: expectedBase });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("INVALID_CONFIDENCE");
  });
});

describe("Phase 3.1 — SELL geometry and price precision", () => {
  it("accepts valid SELL geometry with tick-aligned prices", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "SELL" });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: MOCK_INSTRUMENT,
    });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.result.pricePrecision.verified).toBe(true);
  });

  it("rejects SELL stop below entry", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "SELL" });
    (raw.tradePlan as { stopLoss: number }).stopLoss = 50;
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: MOCK_INSTRUMENT,
    });
    expect(v.ok).toBe(false);
  });

  it("rejects SELL take-profit above entry", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "SELL" });
    (raw.tradePlan as { takeProfitTargets: number[] }).takeProfitTargets = [200];
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: MOCK_INSTRUMENT,
    });
    expect(v.ok).toBe(false);
  });

  it("rejects BUY prices with extra decimal digits", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "BUY" });
    (raw.tradePlan as { entryZone: { low: number; high: number }; stopLoss: number }).entryZone = {
      low: 100.001,
      high: 101,
    };
    (raw.tradePlan as { stopLoss: number }).stopLoss = 99;
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: MOCK_INSTRUMENT,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("INVALID_PRICE_PRECISION");
  });

  it("rejects BUY when instrument metadata missing", () => {
    const raw = buildMockValidReasoningPayload({ ...expectedBase, action: "BUY" });
    const v = validateHfmReasoningModelResponse({
      raw,
      expected: expectedBase,
      instrument: null,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.code).toBe("INSTRUMENT_METADATA_UNAVAILABLE");
  });

  it("rejects wrong-symbol instrument metadata", () => {
    const check = validateTradePlanPricesAgainstInstrument({
      symbol: "XAUUSD",
      instrument: { ...MOCK_INSTRUMENT, symbol: "EURUSD" },
      prices: [{ label: "entryLow", value: 100, required: true }],
    });
    expect(check.ok).toBe(false);
  });

  it("rejects zero and negative prices", () => {
    expect(validateTradePlanPricesAgainstInstrument({
      symbol: "XAUUSD",
      instrument: MOCK_INSTRUMENT,
      prices: [{ label: "entryLow", value: 0, required: true }],
    }).ok).toBe(false);
    expect(validateTradePlanPricesAgainstInstrument({
      symbol: "XAUUSD",
      instrument: MOCK_INSTRUMENT,
      prices: [{ label: "entryLow", value: -1, required: true }],
    }).ok).toBe(false);
  });
});

describe("HFM Analysis Phase 3 — evidence & lock", () => {
  beforeEach(() => {
    __resetReasoningJobStateForTests();
  });

  it("builds evidence with actual candle counts", () => {
    const ctx = makeContext();
    const packed = buildHfmReasoningEvidencePackage({
      context: ctx,
      imageRefs: [],
    });
    expect(packed.candleCounts.H1).toBe(40);
    expect(packed.packageObject.provider).toBe(HFM_ANALYSIS_PROVIDER);
    expect(JSON.stringify(packed.packageObject)).not.toMatch(/sk-/);
  });

  it("enforces single-flight lock", () => {
    expect(tryAcquireReasoningLock()).toBe(true);
    expect(isReasoningLocked()).toBe(true);
    expect(tryAcquireReasoningLock()).toBe(false);
    releaseReasoningLock();
    expect(isReasoningLocked()).toBe(false);
  });
});

describe("HFM Analysis Phase 3 — storage", () => {
  let tmp: string;
  let store: HfmReasoningStorage;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-reason-"));
    store = new HfmReasoningStorage(tmp);
    __setHfmReasoningStorageForTests(store);
    await store.ensureReady();
  });

  afterEach(async () => {
    __setHfmReasoningStorageForTests(null);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("persists and lists analysis records", async () => {
    await store.save({
      analysisId: "a1",
      contextId: "c1",
      snapshotId: "c1",
      snapshotHash: "h",
      symbol: "XAUUSD",
      provider: "HFM_MT5",
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      promptVersion: HFM_REASONING_PROMPT_VERSION,
      schemaVersion: HFM_REASONING_SCHEMA_VERSION,
      model: "gpt-6-luna",
      errorCode: null,
      errorMessage: null,
      dataQualityStatus: "VALID",
      synchronizationStatus: "VALID",
      candleCounts: { H1: 40 },
      imageRefs: [],
      usage: null,
      result: null,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    const loaded = await store.load("a1");
    expect(loaded?.symbol).toBe("XAUUSD");
    const list = await store.list({ symbol: "XAUUSD", limit: 10 });
    expect(list).toHaveLength(1);
  });
});

describe("Phase 3.1 — context gate basics", () => {
  let tmp: string;
  let analysisStore: HfmAnalysisStorage;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-ctx-"));
    analysisStore = new HfmAnalysisStorage(tmp);
    __setHfmAnalysisStorageForTests(analysisStore);
    await analysisStore.ensureReady();
  });

  afterEach(async () => {
    __setHfmAnalysisStorageForTests(null);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("rejects missing context", async () => {
    const gate = await loadAndValidateHfmReasoningContext("does-not-exist");
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.code).toBe("CONTEXT_NOT_FOUND");
  });
});

describe("HFM Analysis Phase 3 — safety markers", () => {
  it("workspace exposes analysis-only safety copy and completeness UI", async () => {
    const ws = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/HfmChartsWorkspace.tsx"),
      "utf8",
    );
    expect(ws).toContain("AI ANALYSIS ONLY — NO BROKER ORDERS ARE PLACED");
    expect(ws).toContain("data-phase3-reason");
    expect(ws).toContain("placesOrders=false");
    expect(ws).toContain("Not provided by AI");
    expect(ws).toContain("data-phase3-completeness");
    expect(ws).not.toMatch(/Place Order|Execute Trade|Auto Trade/i);
  });

  it("api routes exist for reason endpoints", async () => {
    const api = await fs.readFile(
      path.join(process.cwd(), "dev/server/mt5-hfm-analysis-api.ts"),
      "utf8",
    );
    expect(api).toContain("/analysis/reason");
    expect(api).toContain("runHfmAiReasoning");
    expect(api).toContain("assertAdminAccess");
  });
});
