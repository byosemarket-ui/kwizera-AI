/**
 * Phase 3 — HFM AI Reasoning unit tests (mocked OpenAI; no real credentials).
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
} from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/index";
import {
  __setHfmAnalysisStorageForTests,
  HfmAnalysisStorage,
  HFM_ANALYSIS_PROVIDER,
} from "../../../../ai/market-data/mt5-hfm/analysis/index";
import type { HfmAnalysisContextResult } from "../../../../ai/market-data/mt5-hfm/analysis/types";

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

describe("HFM Analysis Phase 3 — response validation", () => {
  it("accepts valid NO_TRADE payload", () => {
    const expected = {
      symbol: "XAUUSD",
      contextId: "ctx",
      snapshotId: "ctx",
      snapshotHash: "hash",
      model: "gpt-6-luna",
    };
    const raw = buildMockValidReasoningPayload({ ...expected, action: "NO_TRADE" });
    const v = validateHfmReasoningModelResponse({ raw, expected });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.decision.action).toBe("NO_TRADE");
      expect(v.result.placesOrders).toBe(false);
      expect(v.result.disclaimer).toBe(HFM_REASONING_DISCLAIMER);
      expect(v.result.schemaVersion).toBe(HFM_REASONING_SCHEMA_VERSION);
      expect(v.result.promptVersion).toBe(HFM_REASONING_PROMPT_VERSION);
    }
  });

  it("accepts valid BUY with stop below entry", () => {
    const expected = {
      symbol: "XAUUSD",
      contextId: "ctx",
      snapshotId: "ctx",
      snapshotHash: "hash",
      model: "gpt-6-luna",
    };
    const raw = buildMockValidReasoningPayload({ ...expected, action: "BUY" });
    const v = validateHfmReasoningModelResponse({ raw, expected });
    expect(v.ok).toBe(true);
  });

  it("forces trusted symbol identity over model-supplied symbol", () => {
    const expected = {
      symbol: "XAUUSD",
      contextId: "ctx",
      snapshotId: "ctx",
      snapshotHash: "hash",
      model: "gpt-6-luna",
    };
    const raw = buildMockValidReasoningPayload(expected);
    raw.symbol = "EURUSD";
    const v = validateHfmReasoningModelResponse({ raw, expected });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.result.symbol).toBe("XAUUSD");
  });

  it("rejects BUY with stop above entry", () => {
    const expected = {
      symbol: "XAUUSD",
      contextId: "ctx",
      snapshotId: "ctx",
      snapshotHash: "hash",
      model: "gpt-6-luna",
    };
    const raw = buildMockValidReasoningPayload({ ...expected, action: "BUY" });
    (raw.tradePlan as { stopLoss: number }).stopLoss = 200;
    const v = validateHfmReasoningModelResponse({ raw, expected });
    expect(v.ok).toBe(false);
  });

  it("coerces NO_TRADE tradePlan direction BUY to NONE", () => {
    const expected = {
      symbol: "XAUUSD",
      contextId: "ctx",
      snapshotId: "ctx",
      snapshotHash: "hash",
      model: "gpt-6-luna",
    };
    const raw = buildMockValidReasoningPayload({ ...expected, action: "NO_TRADE" });
    (raw.tradePlan as { direction: string }).direction = "BUY";
    const v = validateHfmReasoningModelResponse({ raw, expected });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.result.tradePlan.direction).toBe("NONE");
  });

  it("synthesizes scenarios when model returns null/array shapes", () => {
    const expected = {
      symbol: "XAUUSD",
      contextId: "ctx",
      snapshotId: "ctx",
      snapshotHash: "hash",
      model: "gpt-6-luna",
    };
    const raw = buildMockValidReasoningPayload({ ...expected, action: "WAITING_FOR_CONFIRMATION" });
    (raw as { scenarios: unknown }).scenarios = null;
    (raw as { marketOverview: Record<string, unknown> }).marketOverview = {
      condition: "volatile",
      bias: "bearish",
      alignment: "conflicting",
    };
    (raw as { tradePlan: Record<string, unknown> }).tradePlan = {
      dir: "none",
      setup: "waiting",
      explanation: "awaiting M5 confirmation",
    };
    const v = validateHfmReasoningModelResponse({ raw, expected });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.scenarios.bullish.status).toBe("NOT_SUPPORTED");
      expect(v.result.scenarios.bearish.status).toBe("NOT_SUPPORTED");
      expect(v.result.marketOverview.marketCondition).toBe("VOLATILE");
      expect(v.result.marketOverview.overallBias).toBe("BEARISH");
      expect(v.result.marketOverview.timeframeAlignment).toBe("CONFLICTING");
      expect(v.result.tradePlan.direction).toBe("NONE");
      expect(v.result.tradePlan.setupStatus).toBe("WAITING");
    }
  });

  it("coerces lowercase gpt-6-luna enum fields into schema", () => {
    const expected = {
      symbol: "XAUUSD",
      contextId: "ctx",
      snapshotId: "ctx",
      snapshotHash: "hash",
      model: "gpt-6-luna",
    };
    const raw = buildMockValidReasoningPayload({ ...expected, action: "WAITING_FOR_CONFIRMATION" });
    (raw.decision as { action: string; confidenceLabel: string; confidence: unknown }).action = "waiting_for_confirmation";
    (raw.decision as { confidenceLabel: string }).confidenceLabel = "moderate";
    (raw.decision as { confidence: unknown }).confidence = "0.55";
    (raw.marketOverview as Record<string, string>).marketCondition = "ranging";
    (raw.marketOverview as Record<string, string>).overallBias = "mixed";
    (raw.marketOverview as Record<string, string>).timeframeAlignment = "partially aligned";
    (raw.riskAssessment as { riskLevel: string }).riskLevel = "high";
    (raw.scenarios as { bullish: { status: string } }).bullish.status = "possible";
    const v = validateHfmReasoningModelResponse({ raw, expected });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.result.decision.action).toBe("WAITING_FOR_CONFIRMATION");
      expect(v.result.decision.confidence).toBe(55); // 0.55 fraction → 55
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

describe("HFM Analysis Phase 3 — safety markers", () => {
  it("workspace exposes analysis-only safety copy", async () => {
    const ws = await fs.readFile(
      path.join(process.cwd(), "desktop/forex/hfm-dashboard/charts/HfmChartsWorkspace.tsx"),
      "utf8",
    );
    expect(ws).toContain("AI ANALYSIS ONLY — NO BROKER ORDERS ARE PLACED");
    expect(ws).toContain("data-phase3-reason");
    expect(ws).toContain("placesOrders=false");
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
