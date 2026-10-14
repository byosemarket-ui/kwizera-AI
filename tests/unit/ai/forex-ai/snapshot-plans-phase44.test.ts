/**
 * Phase 44 — snapshot trade plans, lifecycle, validation, comparison.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  type AnalysisMarketSnapshot,
} from "../../../../ai/market-data/analysis-snapshot/types.ts";
import {
  buildAnalysisSnapshotFingerprintPayload,
  fingerprintAnalysisSnapshotPayload,
} from "../../../../ai/market-data/analysis-snapshot/fingerprint.ts";
import {
  buildSnapshotPlanBundle,
  classifyMarketDirection,
  compareSnapshotPlanBundles,
  computeRiskReward,
  confidenceDisplay,
  evaluatePlanLifecycle,
  validateIntentPrices,
} from "../../../../ai/forex-ai/snapshot-plans/index.ts";
import { buildDeterministicComparison } from "../../../../ai/forex-ai/snapshot-compare/comparison.ts";
import type { LocalSnapshotAnalysisResult } from "../../../../ai/forex-ai/snapshot-local/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function makeSnapshot(overrides?: Partial<AnalysisMarketSnapshot>): AnalysisMarketSnapshot {
  const start = Date.parse("2026-10-14T00:00:00.000Z");
  const candles = Array.from({ length: 40 }, (_, i) => {
    const px = 100 + i * 0.5;
    return {
      time: Math.floor(start / 1000) + i * 15 * 60,
      open: px,
      high: px + 1,
      low: px - 1,
      close: px + 0.2,
      volume: 10,
      isClosed: true,
      resampled: false,
    };
  });
  const draft = {
    schemaVersion: ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
    provider: "BINANCE" as const,
    instrument: {
      providerSymbol: "BTCUSDT",
      canonicalSymbol: "BTCUSDT",
      displaySymbol: "BTCUSDT",
      marketType: "CRYPTO" as const,
    },
    environment: "public",
    priceBasis: "last" as const,
    candleTimeframe: "15m" as const,
    analysisPeriod: "6h" as const,
    requestedRange: {
      startMs: start,
      endMs: start + 6 * 60 * 60_000,
      startUtc: new Date(start).toISOString(),
      endUtc: new Date(start + 6 * 60 * 60_000).toISOString(),
    },
    returnedRange: {
      startMs: candles[0]!.time * 1000,
      endMs: candles[candles.length - 1]!.time * 1000,
      startUtc: new Date(candles[0]!.time * 1000).toISOString(),
      endUtc: new Date(candles[candles.length - 1]!.time * 1000).toISOString(),
    },
    candleCount: candles.length,
    candlesRequestedEstimate: 24,
    candles,
    latestQuote: {
      provider: "BINANCE" as const,
      providerSymbol: "BTCUSDT",
      canonicalSymbol: "BTCUSDT",
      bid: null,
      ask: null,
      mid: null,
      last: candles[candles.length - 1]!.close,
      priceBasis: "last" as const,
      providerEventTimestamp: null,
      providerEventTimestampAvailable: false,
      serverReceiptTimestamp: null,
      ageMs: null,
      freshness: "HISTORICAL_ONLY" as const,
      source: "binance-spot-public",
      environment: "public",
    },
    marketStatus: "HISTORICAL_ONLY",
    freshness: {
      quote: "HISTORICAL_ONLY" as const,
      historicalCoverageRatio: 1,
      formingCandlePresent: false,
    },
    validation: {
      status: "VALID_WITH_WARNINGS" as const,
      checks: [],
      warnings: ["historical-only"],
      errors: [],
    },
    dataGaps: [],
    sourceMetadata: {
      historicalSourceMode: "HISTORICAL",
      seriesNote: null,
      seriesErrorCode: null,
      resampled: false,
      sourceTimeframe: "15m" as const,
    },
    warnings: ["historical-only"],
    evidenceReady: true,
  };
  const base = {
    ...draft,
    snapshotId: "snap-plans-001",
    requestId: "req-plans",
    createdAt: "2026-10-14T00:00:00.000Z",
    contentFingerprint: fingerprintAnalysisSnapshotPayload(
      buildAnalysisSnapshotFingerprintPayload(draft),
    ),
  };
  return { ...base, ...overrides } as AnalysisMarketSnapshot;
}

function analysisLike(partial: Partial<LocalSnapshotAnalysisResult> = {}): LocalSnapshotAnalysisResult {
  return {
    analysisId: "a1",
    schemaVersion: "forex-local-snapshot-analysis-v1",
    snapshotId: "snap-plans-001",
    contentFingerprint: "fp",
    provider: "BINANCE",
    instrument: "BTCUSDT",
    candleTimeframe: "15m",
    analysisPeriod: "6h",
    model: "llama3.2:1b",
    createdAt: "2026-10-14T00:00:00.000Z",
    status: "completed",
    dataQuality: "VALID_WITH_WARNINGS",
    marketBias: "BULLISH",
    marketStructureSummary: "higher highs",
    keyEvidence: ["HH", "HL"],
    bullishScenario: "cont",
    bearishScenario: "fail",
    decision: "WAIT",
    decisionRationale: "wait for pullback",
    invalidationConditions: ["break structure"],
    confidence: null,
    limitations: [],
    evidenceCategories: {
      snapshotMeta: true,
      candles: true,
      quote: true,
      validation: true,
      patterns: false,
      structure: true,
      knowledge: false,
      unavailable: [],
    },
    warnings: [],
    inferenceLatencyMs: 10,
    error: null,
    ...partial,
  } as LocalSnapshotAnalysisResult;
}

describe("Phase 44 direction + confidence", () => {
  it("classifies directions and shows N/A confidence", () => {
    expect(confidenceDisplay(null)).toBe("N/A");
    expect(confidenceDisplay("")).toBe("N/A");
    expect(confidenceDisplay("medium")).toMatch(/model-reported/);

    const uncertain = classifyMarketDirection({
      marketBias: "UNKNOWN",
      decision: "WAIT",
      structure: {
        trendState: "UNKNOWN",
        lastSwingHigh: null,
        lastSwingLow: null,
        events: [],
        zones: [],
        patterns: [],
        warnings: [],
        insufficientHistory: true,
        quoteFreshness: "UNAVAILABLE",
        dataUsable: false,
      },
      keyEvidence: [],
    });
    expect(uncertain.direction).toBe("UNCERTAIN");
  });
});

describe("Phase 44 plan validation + lifecycle", () => {
  it("validates BUY/SELL SL/TP consistency and computes R:R", () => {
    expect(validateIntentPrices({ intent: "BUY", entry: 100, stop: 110, target: 120 })).toContain(
      "BUY stop loss must be below entry.",
    );
    expect(validateIntentPrices({ intent: "SELL", entry: 100, stop: 90, target: 80 })).toContain(
      "SELL stop loss must be above entry.",
    );
    const rr = computeRiskReward({ entry: 100, stop: 95, target: 110 });
    expect(rr.ratio).toBeCloseTo(2);
    expect(computeRiskReward({ entry: null, stop: 1, target: 2 }).unavailableReason).toBeTruthy();
  });

  it("entry-zone touch does not auto-confirm; historical quote blocks SETUP_CONFIRMED", () => {
    const basePlan = {
      intent: "BUY" as const,
      entryZone: {
        lower: 99,
        upper: 101,
        reference: 100,
        rationale: "test",
        unavailableReason: null,
      },
      confirmationRequired: ["bullish rejection"],
    };
    const structure = {
      trendState: "BULLISH" as const,
      lastSwingHigh: 110,
      lastSwingLow: 90,
      events: [],
      zones: [],
      patterns: [],
      warnings: [],
      insufficientHistory: false,
      quoteFreshness: "HISTORICAL_ONLY",
      dataUsable: true,
    };
    const touched = evaluatePlanLifecycle({
      plan: basePlan as never,
      currentPrice: 100,
      structure,
      materialConflict: false,
    });
    expect(touched.lifecycle).toBe("ENTRY_ZONE_REACHED");
    expect(touched.confirmationStatus).toBe("BLOCKED");
    expect(touched.lifecycle).not.toBe("SETUP_CONFIRMED");

    const pending = evaluatePlanLifecycle({
      plan: basePlan as never,
      currentPrice: 100,
      structure: { ...structure, quoteFreshness: "FRESH" },
      materialConflict: false,
    });
    expect(pending.lifecycle).toBe("CONFIRMATION_PENDING");

    const conflict = evaluatePlanLifecycle({
      plan: basePlan as never,
      currentPrice: 100,
      structure: { ...structure, quoteFreshness: "FRESH" },
      materialConflict: true,
      conflictReason: "WAIT / CONFLICT",
    });
    expect(conflict.lifecycle).toBe("WAIT_CONFLICT");
  });
});

describe("Phase 44 plan bundle + compare", () => {
  it("builds pullback and breakout plans for a successful analysis", () => {
    const snap = makeSnapshot();
    const bundle = buildSnapshotPlanBundle({
      analysis: analysisLike({
        snapshotId: snap.snapshotId,
        contentFingerprint: snap.contentFingerprint,
      }),
      snapshot: snap,
      provider: "LOCAL",
    });
    expect(bundle.pullback.planKind).toBe("PULLBACK");
    expect(bundle.breakout.planKind).toBe("BREAKOUT");
    expect(bundle.marketDirection).toMatch(/BULLISH|BEARISH|SIDEWAYS|UNCERTAIN/);
    expect(bundle.confidenceDisplay).toBe("N/A");
    expect(bundle.pullback.snapshotId).toBe(snap.snapshotId);
    expect(bundle.breakout.contentFingerprint).toBe(snap.contentFingerprint);
  });

  it("marks partial compare as incomplete and detects direction conflict", () => {
    const snap = makeSnapshot();
    const local = buildSnapshotPlanBundle({
      analysis: analysisLike({
        snapshotId: snap.snapshotId,
        contentFingerprint: snap.contentFingerprint,
        marketBias: "BULLISH",
      }),
      snapshot: snap,
      provider: "LOCAL",
    });
    const openai = buildSnapshotPlanBundle({
      analysis: analysisLike({
        analysisId: "a2",
        snapshotId: snap.snapshotId,
        contentFingerprint: snap.contentFingerprint,
        marketBias: "BEARISH",
        decision: "SELL",
      }),
      snapshot: snap,
      provider: "OPENAI",
    });

    const partial = compareSnapshotPlanBundles({
      local,
      openai: null,
      localFailed: false,
      openaiFailed: true,
    });
    expect(partial.verdict).toBe("INSUFFICIENT_DATA");
    expect(partial.incomplete).toBe(true);

    const conflict = compareSnapshotPlanBundles({
      local,
      openai,
      localFailed: false,
      openaiFailed: false,
    });
    expect(conflict.directionAgree).toBe(false);
    expect(conflict.verdict).toBe("CONFLICT");
    expect(conflict.waitConflict).toBe(true);
  });

  it("deterministic comparison includes planComparison and incomplete flag", () => {
    const snap = makeSnapshot();
    const localAnalysis = {
      ...analysisLike({
        snapshotId: snap.snapshotId,
        contentFingerprint: snap.contentFingerprint,
      }),
      planBundle: buildSnapshotPlanBundle({
        analysis: analysisLike({
          snapshotId: snap.snapshotId,
          contentFingerprint: snap.contentFingerprint,
        }),
        snapshot: snap,
        provider: "LOCAL",
      }),
    };
    const c = buildDeterministicComparison(
      {
        ok: true,
        code: "OK",
        error: null,
        latencyMs: 1,
        analysis: localAnalysis,
      },
      {
        ok: false,
        code: "OPENAI_NOT_CONFIGURED",
        error: "missing",
        latencyMs: 1,
        analysis: null,
      },
    );
    expect(c.comparisonComplete).toBe(false);
    expect(c.planComparison?.incomplete).toBe(true);
    expect(c.note).toMatch(/incomplete|Partial success/i);
  });
});

describe("Phase 44 wiring contracts", () => {
  it("wires plan modules, UI panels, and CSS", () => {
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const panels = read("desktop/forex/SnapshotAiResultPanels.tsx");
    const css = read("desktop/forex/forex.css");
    const localEngine = read("ai/forex-ai/snapshot-local/engine.ts");
    const openaiEngine = read("ai/forex-ai/snapshot-openai/engine.ts");

    expect(page).toContain("data-forex-ai-phase44");
    expect(page).toContain("SnapshotProviderResultPanel");
    expect(panels).toContain("plan.planKind");
    expect(panels).toContain("bundle.pullback");
    expect(panels).toContain("bundle.breakout");
    expect(panels).toContain("data-ai-trade-plans");
    expect(css).toContain(".fx-ai-plan-card");
    expect(css).toContain(".fx-ai-result-card");
    expect(localEngine).toContain("attachPlanBundleToAnalysis");
    expect(openaiEngine).toContain("attachPlanBundleToAnalysis");
    expect(localEngine).not.toMatch(/placeOrder|executeTrade/i);
  });
});
