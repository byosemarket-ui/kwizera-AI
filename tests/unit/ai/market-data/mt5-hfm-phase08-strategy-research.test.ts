/**
 * Phase 08 — Historical Research & Strategy Intelligence (HFM MT5).
 * FIXTURE TESTS — not live historical-provider verification.
 */
import { describe, it, expect } from "vitest";
import {
  MIF_STRATEGY_RESEARCH_CONTRACT_ID,
  MIF_EVIDENCE_FAMILY_CATALOG,
  adaptStrategyResearchToEvidence,
  assessMifStrategyResearch,
  computeStrategyResearchPerformance,
  researchEventPriceWindows,
  resolveStrategyResearchPolicy,
  validateResearchDataset,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import { buildGrossOhlcAssumptions } from "../../../../ai/market-data/mt5-hfm/mif/backtesting/assumptions.js";
import { normalizeSmtEvent } from "../../../../ai/market-data/mt5-hfm/fundamentals/index.js";

function bars(n: number, start = 1_700_000_000): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  forming?: boolean;
}> {
  return Array.from({ length: n }, (_, i) => {
    const open = 100 + i;
    return {
      time: start + i * 3600,
      open,
      high: open + 1,
      low: open - 1,
      close: open + 0.2,
    };
  });
}

function trades(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    direction: (i % 2 === 0 ? "BUY" : "SELL") as "BUY" | "SELL",
    entryPrice: 100 + i,
    exitPrice: 100 + i + 1,
    entryTimeSec: 1_700_000_000 + i * 7200,
    exitTimeSec: 1_700_000_000 + i * 7200 + 3600,
    unitReturn: i % 4 === 0 ? -0.01 : 0.015,
    status: "CLOSED" as const,
    exitReason: "TARGET",
    holdingBars: 2,
    regimeLabel: i < n / 2 ? "TRENDING" : "RANGING",
  }));
}

describe("Phase 08 — dataset validation", () => {
  it("accepts valid OHLC chronology", () => {
    const r = validateResearchDataset({
      datasetId: "d1",
      symbol: "EURUSD",
      timeframe: "H1",
      bars: bars(20),
      sourceMode: "FIXTURE",
      retrievalTimestamp: new Date().toISOString(),
    });
    expect(r.mayProceed).toBe(true);
    expect(r.qualityStatus === "VALID" || r.qualityStatus === "VALID_WITH_WARNINGS").toBe(true);
    expect(r.candleCount).toBe(20);
  });

  it("rejects invalid OHLC and wrong provider", () => {
    const bad = validateResearchDataset({
      datasetId: "d2",
      symbol: "EURUSD",
      timeframe: "H1",
      bars: [{ time: 1, open: 1, high: 0.5, low: 2, close: 1 }],
      sourceMode: "FIXTURE",
      retrievalTimestamp: new Date().toISOString(),
      providerId: "BINANCE",
    });
    expect(bad.mayProceed).toBe(false);
    expect(bad.blockReasons.some((b) => b.includes("WRONG_PROVIDER"))).toBe(true);
  });

  it("excludes forming candles and counts duplicates", () => {
    const b = bars(15);
    b.push({ ...b[5]!, forming: true });
    b.push({ ...b[3]! });
    const r = validateResearchDataset({
      datasetId: "d3",
      symbol: "XAUUSD",
      timeframe: "H1",
      bars: b,
      sourceMode: "SYNTHETIC_TEST_DATA",
      retrievalTimestamp: new Date().toISOString(),
    });
    expect(r.formingCandleCount).toBe(1);
    expect(r.duplicateCount).toBeGreaterThanOrEqual(1);
    expect(r.warnings.some((w) => w.includes("SYNTHETIC"))).toBe(true);
  });

  it("marks insufficient history", () => {
    const r = validateResearchDataset({
      datasetId: "d4",
      symbol: "GBPUSD",
      timeframe: "H1",
      bars: bars(3),
      sourceMode: "FIXTURE",
      retrievalTimestamp: new Date().toISOString(),
    });
    expect(r.qualityStatus).toBe("INSUFFICIENT_HISTORY");
    expect(r.mayProceed).toBe(false);
  });
});

describe("Phase 08 — metrics & ambiguity", () => {
  it("computes win rate excluding ambiguous and never labels as probability", () => {
    const t = [
      ...trades(10),
      {
        direction: "BUY" as const,
        entryPrice: 1,
        exitPrice: null,
        entryTimeSec: 1,
        exitTimeSec: null,
        unitReturn: null,
        status: "AMBIGUOUS" as const,
        exitReason: "BOTH_AMBIGUOUS_SAME_CANDLE",
        holdingBars: null,
      },
    ];
    const p = computeStrategyResearchPerformance(t, 30);
    expect(p.ambiguousTrades).toBe(1);
    expect(p.winRate.isWinProbability).toBe(false);
    expect(p.winRate.isEventProbability).toBe(false);
    expect(p.winRate.availability).toBe("INSUFFICIENT_SAMPLE");
  });
});

describe("Phase 08 — assess orchestrator", () => {
  it("produces RESEARCH_ONLY assessment with cost sensitivity and regime buckets", () => {
    const a = assessMifStrategyResearch({
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      strategyId: "TREND_CONTINUATION",
      fixtureBars: bars(40),
      simulatedTrades: trades(35),
      sourceMode: "FIXTURE",
      multipleComparisonsCount: 5,
    });
    expect(a.contractId).toBe(MIF_STRATEGY_RESEARCH_CONTRACT_ID);
    expect(a.scope).toBe("phase08-strategy-research");
    expect(a.placesOrders).toBe(false);
    expect(a.acceptsForExecution).toBe(false);
    expect(a.isWinProbability).toBe(false);
    expect(a.isProbabilityCalibration).toBe(false);
    expect(a.continuousResearchWorker).toBe("DISABLED_BY_POLICY");
    expect(a.sourceMode).toBe("FIXTURE");
    expect(a.costSensitivity.length).toBeGreaterThan(0);
    expect(a.regimeBreakdown.length).toBeGreaterThan(0);
    expect(a.limitations.some((l) => l.includes("RESEARCH_ONLY"))).toBe(true);
    expect(a.overfittingWarnings.some((w) => w.includes("multiple_comparisons"))).toBe(true);
    expect(a.executionAssumptions).toEqual(
      expect.objectContaining({ sameCandleAmbiguity: expect.stringContaining("AMBIGUOUS") }),
    );
  });

  it("adapts to UMEP without win probability", () => {
    const a = assessMifStrategyResearch({
      providerSymbol: "EURUSD",
      timeframe: "H1",
      strategyId: "PULLBACK",
      fixtureBars: bars(20),
      simulatedTrades: trades(12),
      sourceMode: "FIXTURE",
    });
    const ev = adaptStrategyResearchToEvidence(a);
    expect(ev.score.isWinProbability).toBe(false);
    expect(ev.evidenceType).toBe("STRATEGY_RESEARCH");
    expect(MIF_EVIDENCE_FAMILY_CATALOG.STRATEGY_RESEARCH.availability).toBe("AVAILABLE");
  });

  it("event→price research labels fixture and does not claim causation", () => {
    const b = bars(30);
    const ts = b[15]!.time;
    const e = normalizeSmtEvent(
      {
        ts,
        time: new Date(ts * 1000).toISOString(),
        currency: "USD",
        impact: "high",
        title: "NFP",
        forecast: "180K",
        previous: "150K",
        actual: "200K",
        id: `nfp.${ts}`,
        status: "released",
        moved_from: "",
        period: "2026-11",
        confidence: "sources_agree",
      },
      new Date().toISOString(),
    );
    expect(e).toBeTruthy();
    const windows = researchEventPriceWindows({
      symbol: "XAUUSD",
      events: [e!],
      bars: b,
      sourceMode: "FIXTURE",
    });
    expect(windows.length).toBeGreaterThan(0);
    expect(windows.every((w) => w.causationClaimed === false)).toBe(true);
    expect(windows.every((w) => w.sourceMode === "FIXTURE")).toBe(true);
  });

  it("walk-forward insufficient history remains explicit", () => {
    const a = assessMifStrategyResearch({
      providerSymbol: "USDJPY",
      timeframe: "H1",
      strategyId: "BREAKOUT",
      fixtureBars: bars(20),
      simulatedTrades: trades(5),
      walkForward: {
        available: false,
        status: "INSUFFICIENT_HISTORY",
        note: "INSUFFICIENT_HISTORY",
        development: null,
        validation: null,
        outOfSample: null,
        performanceDegradation: null,
      },
    });
    expect(a.reliabilityStatus).toBe("INSUFFICIENT_SAMPLE");
    expect(a.walkForward.status).toBe("INSUFFICIENT_HISTORY");
  });
});

describe("Phase 08 — safety / reuse guards", () => {
  it("gross OHLC assumptions forbid inventing fills on ambiguity", () => {
    const a = buildGrossOhlcAssumptions();
    expect(String(a.sameCandleAmbiguity)).toMatch(/AMBIGUOUS/i);
    expect(a.costAdjusted).toBe(false);
    expect(a.notBrokerFills).toBe(true);
  });

  it("policy documents look-ahead ban", () => {
    const p = resolveStrategyResearchPolicy();
    expect(p.lookAheadPolicy).toMatch(/future bars/i);
  });

  it("large fixture payloads remain analytically valid (API allows up to 64KiB)", () => {
    // Regression guard for VPS defect: default MIF readJsonBody MAX_BODY=8KiB
    // previously emptied oversize strategy-research POSTs into INVALID_INSTRUMENT.
    const manyBars = Array.from({ length: 80 }, (_, i) => {
      const open = 100 + i;
      return {
        time: 1_700_000_000 + i * 3600,
        open,
        high: open + 1,
        low: open - 1,
        close: open + 0.2,
      };
    });
    const a = assessMifStrategyResearch({
      providerSymbol: "EURUSD",
      timeframe: "H1",
      strategyId: "TREND_CONTINUATION",
      fixtureBars: manyBars,
      simulatedTrades: trades(35),
      sourceMode: "FIXTURE",
    });
    expect(a.dataset.candleCount).toBe(80);
    expect(a.sourceMode).toBe("FIXTURE");
    expect(a.placesOrders).toBe(false);
  });
});
