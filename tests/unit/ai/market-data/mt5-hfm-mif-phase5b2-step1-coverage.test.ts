/**
 * Phase 5B.2 Step 1 — coverage / history sufficiency (no universal min=30).
 */
import { describe, it, expect } from "vitest";
import {
  baseCanonicalCandle,
  assessMifDataIntegrity,
  adaptHfmHistoricalBar,
  MIF_QI_EMPTY_SERIES,
  MIF_QI_COVERAGE_BELOW_REQUIREMENT,
  MIF_QI_COVERAGE_MET,
  MIF_QI_COVERAGE_OBSERVED_RANGE_ONLY,
  MIF_QI_INSUFFICIENT_HISTORY,
  type MifCanonicalCandle,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import type { HfmHistoricalBar } from "../../../../ai/market-data/mt5-hfm/historical-engine";

function candle(over: Partial<MifCanonicalCandle> & { openTimeSec: number }): MifCanonicalCandle {
  const openTimeSec = over.openTimeSec;
  return baseCanonicalCandle({
    providerSymbol: "EURUSD",
    timeframe: "M15",
    openTimeSec,
    closeTimeSec: openTimeSec + 900,
    open: 1.1,
    high: 1.2,
    low: 1.05,
    close: 1.15,
    tickVolume: 2,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: over.candleState ?? "CLOSED",
    priceBasis: "bid",
    timebase: "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: openTimeSec,
    receivedAt: null,
    availableAt: null,
    availabilityStatus: "KNOWN",
    sourceDialect: "hfm.historical-bar",
    sourceProvenance: "test",
    sourceMode: "HISTORICAL",
    sourceDataQuality: "ok",
    validation: { status: "ok", errors: [], warnings: [] },
    instrument: null,
    ...over,
    openTimeSec,
  });
}

describe("Phase 5B.2 Step1 — coverage", () => {
  it("empty series is degraded with EMPTY_SERIES; no universal 30 rule", () => {
    const r = assessMifDataIntegrity({
      candles: [],
      providerSymbol: "EURUSD",
      timeframe: "M15",
    });
    expect(r.coverage.observedCandleCount).toBe(0);
    expect(r.coverage.satisfiesExplicitRequirement).toBeNull();
    expect(r.coverage.requiredMinValidCandles).toBeNull();
    expect(r.findings.some((f) => f.code === MIF_QI_EMPTY_SERIES)).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_COVERAGE_OBSERVED_RANGE_ONLY)).toBe(true);
    expect(r.status).toBe("DEGRADED");
  });

  it("one candle reports descriptive coverage without claiming completeness", () => {
    const r = assessMifDataIntegrity({
      candles: [candle({ openTimeSec: 1_700_000_000 })],
      providerSymbol: "EURUSD",
      timeframe: "M15",
    });
    expect(r.coverage.validCandleCount).toBe(1);
    expect(r.coverage.observedRangeOnly).toBe(true);
    expect(r.coverage.satisfiesExplicitRequirement).toBeNull();
  });

  it("explicit consumer requirement met / unmet", () => {
    const candles = Array.from({ length: 5 }, (_, i) =>
      candle({ openTimeSec: 1_700_000_000 + i * 900 }),
    );
    const met = assessMifDataIntegrity({
      candles,
      providerSymbol: "EURUSD",
      timeframe: "M15",
      coverageRequirement: { consumerId: "charts-display", minValidCandles: 3 },
    });
    expect(met.coverage.satisfiesExplicitRequirement).toBe(true);
    expect(met.findings.some((f) => f.code === MIF_QI_COVERAGE_MET)).toBe(true);

    const unmet = assessMifDataIntegrity({
      candles,
      providerSymbol: "EURUSD",
      timeframe: "M15",
      coverageRequirement: { consumerId: "phase2-ai-reference", minValidCandles: 30 },
    });
    expect(unmet.coverage.satisfiesExplicitRequirement).toBe(false);
    expect(unmet.gapCounters.insufficientHistoryCount).toBe(1);
    expect(unmet.findings.some((f) => f.code === MIF_QI_COVERAGE_BELOW_REQUIREMENT)).toBe(true);
    expect(unmet.findings.some((f) => f.code === MIF_QI_INSUFFICIENT_HISTORY)).toBe(true);
    expect(unmet.status).toBe("DEGRADED");
    // Still must not approve AI via this assessment.
    expect(unmet.doesNotApproveAiReasoning).toBe(true);
  });

  it("invalid candles excluded from valid coverage", () => {
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000 }),
        candle({ openTimeSec: 1_700_000_900, candleState: "INVALID", high: 1, low: 2, open: 1.5, close: 1.5 }),
      ],
      providerSymbol: "EURUSD",
      timeframe: "M15",
    });
    expect(r.coverage.observedCandleCount).toBe(2);
    expect(r.coverage.validCandleCount).toBe(1);
    expect(r.coverage.invalidCandleCount).toBeGreaterThanOrEqual(1);
  });

  it("Phase 5B.1 historical adapter output is assessable", () => {
    const bar: HfmHistoricalBar = {
      time: 1_700_000_000,
      open: 1.1,
      high: 1.2,
      low: 1.05,
      close: 1.15,
      tickVolume: 5,
      realVolume: null,
      spread: null,
      validationStatus: "ok",
      provenance: "native",
    };
    const adapted = adaptHfmHistoricalBar({
      bar,
      symbol: "EURUSD",
      timeframe: "M15",
    });
    expect(adapted.ok).toBe(true);
    if (!adapted.ok) return;
    const r = assessMifDataIntegrity({
      candles: [adapted.value],
      providerSymbol: "EURUSD",
      timeframe: "M15",
    });
    expect(r.coverage.validCandleCount).toBe(1);
    expect(r.providerId).toBe("HFM_MT5");
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });
});
