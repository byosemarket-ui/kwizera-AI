/**
 * Phase 5D.5 — HFM_MT5 → canonical → MIF → OD production integration tests.
 * Fixture-based; does not claim live market candidates.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { HfmHistoricalBar } from "../../../../ai/market-data/mt5-hfm/historical-engine";
import {
  adaptHfmHistoricalBars,
  MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
  MIF_PROVIDER_ID,
  resolveAvailableTimeframeRoles,
  runMifHfmOpportunityPipelineFromSeries,
  isSupportedProductionTimeframe,
  getDefaultMifOpportunityDetectorRegistry,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;

function barsForTf(tf: string, n = 80): HfmHistoricalBar[] {
  const step =
    tf === "H4" ? 14400
      : tf === "H1" ? 3600
        : tf === "M30" ? 1800
          : tf === "M15" ? 900
            : 300;
  const out: HfmHistoricalBar[] = [];
  for (let i = 0; i < n; i++) {
    const base = 2000 + i * 0.35;
    const bump = i % 7 === 3 ? 1.8 : i % 7 === 6 ? -0.9 : 0;
    const close = base + bump;
    const open = close - 0.15;
    const high = Math.max(open, close) + 0.4;
    const low = Math.min(open, close) - 0.4;
    out.push({
      time: T0 + i * step,
      open,
      high,
      low,
      close,
      tickVolume: 10 + i,
      realVolume: null,
      spread: 2,
      validationStatus: "ok",
      provenance: "native",
    });
  }
  return out;
}

function multiTfSeries(tfs: string[] = ["H4", "H1", "M30", "M15", "M5"]) {
  return tfs.map((timeframe) => ({
    timeframe,
    bars: barsForTf(timeframe),
    freshness: "LIVE",
    source: "HFM_MT5",
    newestTimestampSec: T0 + 79 * 3600,
  }));
}

describe("Phase 5D.5 — adapter / mapping", () => {
  it("maps HFM bars to canonical CLOSED candles with HFM_MT5 identity", () => {
    const bars = barsForTf("H1", 5);
    const { candles, failures } = adaptHfmHistoricalBars(bars, {
      symbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(failures).toHaveLength(0);
    expect(candles).toHaveLength(5);
    expect(candles.every((c) => c.candleState === "CLOSED")).toBe(true);
    expect(candles.every((c) => c.providerSymbol === "XAUUSD")).toBe(true);
    expect(candles.every((c) => c.timeframe === "H1")).toBe(true);
    expect(candles.every((c) => c.sourceDialect === "hfm.historical-bar")).toBe(true);
  });

  it("rejects invalid OHLC at adapter boundary", () => {
    const bad: HfmHistoricalBar[] = [
      {
        time: T0,
        open: 1,
        high: 0.5,
        low: 2,
        close: 1,
        tickVolume: 1,
        realVolume: null,
        spread: null,
        validationStatus: "ok",
        provenance: "native",
      },
    ];
    const { candles, failures } = adaptHfmHistoricalBars(bad, {
      symbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(candles.length + failures.length).toBe(1);
    // Either rejected by adapter or marked invalid — never silently corrected.
    if (failures.length) {
      expect(failures[0]!.code).toMatch(/OHLC|INVALID/i);
    } else {
      expect(candles[0]!.candleState === "INVALID" || candles[0]!.validation.status !== "ok").toBe(true);
    }
  });

  it("resolves timeframe roles and rejects unsupported TF", () => {
    expect(isSupportedProductionTimeframe("H1")).toBe(true);
    expect(isSupportedProductionTimeframe("XYZ")).toBe(false);
    const roles = resolveAvailableTimeframeRoles(["H4", "H1", "M15"]);
    expect(roles).toContain("PRIMARY_DIRECTION");
    expect(roles).toContain("INTERMEDIATE_STRUCTURE");
    expect(roles).toContain("OPPORTUNITY_FORMATION");
  });
});

describe("Phase 5D.5 — pipeline validation / failures", () => {
  it("rejects wrong provider", () => {
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerId: "FXCM",
      providerSymbol: "XAUUSD",
      series: multiTfSeries(["H1"]),
    });
    expect(r.analysisStatus).toBe("FAILED_VALIDATION");
    expect(r.failureCodes).toContain("WRONG_PROVIDER");
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.candidateCount).toBe(0);
  });

  it("rejects missing symbol", () => {
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerSymbol: "  ",
      series: [],
    });
    expect(r.failureCodes).toContain("INVALID_INSTRUMENT");
  });

  it("rejects unsupported timeframe", () => {
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerSymbol: "XAUUSD",
      timeframes: ["H7"],
      series: [{ timeframe: "H7", bars: barsForTf("H1") }],
    });
    expect(r.failureCodes).toContain("INVALID_TIMEFRAME");
  });

  it("fails upstream on empty candles without fabricating success", () => {
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerSymbol: "XAUUSD",
      timeframes: ["H1"],
      series: [{ timeframe: "H1", bars: [] }],
    });
    expect(r.analysisStatus).toBe("FAILED_UPSTREAM_DATA");
    expect(r.failureCodes).toContain("MISSING_CANDLES");
    expect(r.detection).toBeNull();
  });

  it("rejects instrument mismatch in pre-adapted candles", () => {
    const adapted = adaptHfmHistoricalBars(barsForTf("H1", 20), {
      symbol: "EURUSD",
      timeframe: "H1",
    });
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerSymbol: "XAUUSD",
      timeframes: ["H1"],
      series: [{ timeframe: "H1", bars: barsForTf("H1", 20), candles: adapted.candles }],
    });
    expect(r.failureCodes).toContain("INSTRUMENT_MISMATCH");
    expect(r.analysisStatus).toBe("FAILED_UPSTREAM_DATA");
  });

  it("applies stale candle gate when configured", () => {
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerSymbol: "XAUUSD",
      timeframes: ["H1"],
      series: multiTfSeries(["H1"]),
      assessmentTimestamp: "2099-01-01T00:00:00.000Z",
      maxCandleAgeSec: 3600,
    });
    expect(r.failureCodes).toContain("STALE_CANDLES");
  });
});

describe("Phase 5D.5 — end-to-end fixture pipeline", () => {
  it("runs full path: adapt → quality → assessments → eligibility → 10 detectors → output", () => {
    const r = runMifHfmOpportunityPipelineFromSeries(
      {
        requestId: "test-5d5-e2e",
        providerSymbol: "XAUUSD",
        timeframes: ["H4", "H1", "M30", "M15", "M5"],
        primaryTimeframe: "H1",
        series: multiTfSeries(),
        assessmentTimestamp: "2024-01-15T12:00:00.000Z",
      },
      { includeDebugContext: true },
    );

    expect(r.contractId).toBe(MIF_PRODUCTION_INTEGRATION_CONTRACT_ID);
    expect(r.providerId).toBe(MIF_PROVIDER_ID);
    expect(r.requestId).toBe("test-5d5-e2e");
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.doesNotApproveAiReasoning).toBe(true);
    expect(r.notExecutable).toBe(true);

    expect(r.resolvedTimeframes.length).toBeGreaterThanOrEqual(3);
    expect(r.timeframeSnapshots.length).toBe(5);
    expect(r.contextSummary?.hasRegime).toBe(true);
    expect(r.contextSummary?.hasMtf).toBe(true);
    expect(r.detection).not.toBeNull();

    const det = getDefaultMifOpportunityDetectorRegistry().diagnostics();
    expect(det.detectorCount).toBe(10);
    expect(r.detection!.outcomes).toHaveLength(10);
    expect(r.detection!.strategyCoverage).toHaveLength(10);
    expect(r.detection!.doesNotRankOpportunities).toBe(true);

    // Empty candidates are valid; do not claim live market opportunity.
    expect(typeof r.candidateCount).toBe("number");
    expect(r.candidateCount).toBe(r.detection!.candidates.length);

    expect([
      "OK",
      "OK_EMPTY_CANDIDATES",
      "INSUFFICIENT_EVIDENCE",
      "PARTIAL_DEGRADED",
    ]).toContain(r.analysisStatus);

    expect(r.eligibility).toHaveLength(10);
    for (const e of r.eligibility) {
      expect([
        "ELIGIBLE_FOR_DETECTION",
        "INELIGIBLE",
        "INSUFFICIENT_EVIDENCE",
        "BLOCKED_BY_DATA_QUALITY",
        "DISABLED",
        "DEPRECATED",
        "DRAFT",
      ]).toContain(e.status);
    }

    // Evidence refs projected for catalog IDs
    expect(r._debugContext!.evidence.length).toBeGreaterThan(10);
    expect(r._debugContext!.evidence.some((e) => e.evidenceId === "tc.quality")).toBe(true);
    expect(r._debugContext!.providerId).toBe("HFM_MT5");
  });

  it("preserves detector failure isolation contract via orchestrator", () => {
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerSymbol: "XAUUSD",
      series: multiTfSeries(["H4", "H1", "M15"]),
      assessmentTimestamp: "2024-01-15T12:00:00.000Z",
    });
    expect(r.detection).not.toBeNull();
    // All 10 outcomes present even when some INELIGIBLE / NO_CANDIDATE
    expect(r.detection!.outcomes).toHaveLength(10);
    expect(r.detection!.outcomes.every((o) => o.placesOrders === false)).toBe(true);
  });

  it("serializes public result without credentials", () => {
    const r = runMifHfmOpportunityPipelineFromSeries({
      providerSymbol: "XAUUSD",
      series: multiTfSeries(["H1", "H4", "M15"]),
    });
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/password/i);
    expect(json).not.toMatch(/access[_-]?token/i);
    expect(json).toContain("HFM_MT5");
  });
});

describe("Phase 5D.5 — API surface wiring", () => {
  it("registers admin MIF opportunity-detection route in server sources", () => {
    const api = readFileSync(
      path.join(process.cwd(), "dev/server/mt5-hfm-mif-api.ts"),
      "utf8",
    );
    const index = readFileSync(path.join(process.cwd(), "dev/server/index.ts"), "utf8");
    expect(api).toContain("/api/forex/providers/mt5-hfm/mif/opportunity-detection");
    expect(api).toContain("assertAdminAccess");
    expect(api).toContain("runMifHfmOpportunityPipelineLive");
    expect(api).toContain("placesOrders: false");
    expect(api).not.toMatch(/order\.send|placeOrder|submitOrder/i);
    expect(index).toContain("handleMt5HfmMifApi");
  });
});
