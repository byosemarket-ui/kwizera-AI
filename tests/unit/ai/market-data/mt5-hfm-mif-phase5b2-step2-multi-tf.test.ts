/**
 * Phase 5B.2 Step 2 — multi-timeframe quality + forming/closed policies.
 */
import { describe, it, expect } from "vitest";
import {
  assessMifMultiTimeframeQuality,
  baseCanonicalCandle,
  MIF_QI_REQUIRED_TIMEFRAME_MISSING,
  MIF_QI_OPTIONAL_TIMEFRAME_MISSING,
  MIF_QI_TIMEFRAME_EMPTY,
  MIF_QI_CANDLE_STATE_POLICY_VIOLATION,
  MIF_QI_MTF_SKEW_MEASURED,
  MIF_QI_MTF_SKEW_THRESHOLD_UNSET,
  MIF_QI_MTF_SKEW_EXCEEDED,
  MIF_QI_TIMEBASE_MIXED,
  MIF_QI_TIMEFRAME_UNSUPPORTED,
  type MifCanonicalCandle,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function candle(
  over: Partial<MifCanonicalCandle> & { openTimeSec: number; timeframe: string },
): MifCanonicalCandle {
  const step =
    over.timeframe === "M5"
      ? 300
      : over.timeframe === "M15"
        ? 900
        : over.timeframe === "H1"
          ? 3600
          : 3600;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: over.timeframe,
    openTimeSec: over.openTimeSec,
    closeTimeSec: over.closeTimeSec !== undefined ? over.closeTimeSec : over.openTimeSec + step,
    open: 100,
    high: 101,
    low: 99,
    close: 100.5,
    tickVolume: 1,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: over.candleState ?? "CLOSED",
    priceBasis: "bid",
    timebase: over.timebase ?? "BROKER_SERVER",
    timezoneOffsetSec: null,
    brokerTimestampSec: over.openTimeSec,
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
  });
}

describe("Phase 5B.2 Step2 — multi-timeframe presence", () => {
  it("required present; optional missing is informational; empty required blocks", () => {
    const base = 1_700_000_000;
    const ok = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        H1: [candle({ openTimeSec: base, timeframe: "H1" })],
        M15: [candle({ openTimeSec: base, timeframe: "M15" })],
      },
      requirement: {
        consumerId: "charts",
        requiredTimeframes: ["H1", "M15"],
        optionalTimeframes: ["M5"],
        candleStatePolicy: { mode: "closed_only" },
      },
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(ok.requiredMissing).toEqual([]);
    expect(ok.optionalMissing).toContain("M5");
    expect(ok.findings.some((f) => f.code === MIF_QI_OPTIONAL_TIMEFRAME_MISSING)).toBe(true);
    expect(ok.doesNotApproveAiReasoning).toBe(true);

    const missing = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: { H1: [candle({ openTimeSec: base, timeframe: "H1" })] },
      requirement: {
        consumerId: "charts",
        requiredTimeframes: ["H1", "M15"],
        candleStatePolicy: { mode: "closed_only" },
      },
    });
    expect(missing.status).toBe("BLOCKED");
    expect(missing.findings.some((f) => f.code === MIF_QI_REQUIRED_TIMEFRAME_MISSING)).toBe(true);

    const empty = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: { H1: [], M15: [candle({ openTimeSec: base, timeframe: "M15" })] },
      requirement: {
        consumerId: "charts",
        requiredTimeframes: ["H1", "M15"],
        candleStatePolicy: { mode: "closed_only" },
      },
    });
    expect(empty.findings.some((f) => f.code === MIF_QI_TIMEFRAME_EMPTY)).toBe(true);
  });

  it("does not require all eight timeframes globally", () => {
    const r = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        H1: [candle({ openTimeSec: 1_700_000_000, timeframe: "H1" })],
      },
      requirement: {
        consumerId: "narrow",
        requiredTimeframes: ["H1"],
        candleStatePolicy: { mode: "closed_only" },
      },
    });
    expect(r.requiredMissing).toEqual([]);
    expect(r.status === "VALID" || r.status === "WARNING").toBe(true);
  });

  it("flags unsupported fixed-duration mapping (e.g. MN1)", () => {
    const r = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        MN1: [
          candle({
            openTimeSec: 1_700_000_000,
            timeframe: "MN1",
            closeTimeSec: null,
          }),
        ],
      },
      requirement: {
        consumerId: "mn1-consumer",
        requiredTimeframes: ["MN1"],
        candleStatePolicy: { mode: "closed_only" },
      },
    });
    expect(r.findings.some((f) => f.code === MIF_QI_TIMEFRAME_UNSUPPORTED)).toBe(true);
  });
});

describe("Phase 5B.2 Step2 — forming/closed policy", () => {
  it("CLOSED-only rejects FORMING; allow_forming accepts FORMING", () => {
    const series = {
      H1: [candle({ openTimeSec: 1_700_000_000, timeframe: "H1", candleState: "FORMING" })],
    };
    const closedOnly = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: series,
      requirement: {
        consumerId: "hist",
        requiredTimeframes: ["H1"],
        candleStatePolicy: { mode: "closed_only" },
      },
    });
    expect(closedOnly.status).toBe("BLOCKED");
    expect(closedOnly.findings.some((f) => f.code === MIF_QI_CANDLE_STATE_POLICY_VIOLATION)).toBe(
      true,
    );

    const allow = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: series,
      requirement: {
        consumerId: "live",
        requiredTimeframes: ["H1"],
        candleStatePolicy: { mode: "allow_forming" },
      },
    });
    expect(allow.findings.some((f) => f.code === MIF_QI_CANDLE_STATE_POLICY_VIOLATION)).toBe(false);
  });

  it("STALE/INVALID tip violate closed_only", () => {
    for (const state of ["STALE", "INVALID", "MISSING"] as const) {
      const r = assessMifMultiTimeframeQuality({
        providerSymbol: "XAUUSD",
        seriesByTimeframe: {
          H1: [candle({ openTimeSec: 1_700_000_000, timeframe: "H1", candleState: state })],
        },
        requirement: {
          consumerId: "hist",
          requiredTimeframes: ["H1"],
          candleStatePolicy: { mode: "closed_only" },
        },
      });
      expect(r.findings.some((f) => f.code === MIF_QI_CANDLE_STATE_POLICY_VIOLATION)).toBe(true);
    }
  });
});

describe("Phase 5B.2 Step2 — skew & clock domains", () => {
  it("measures skew without inventing a threshold; consumer threshold can fail", () => {
    const measured = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        H1: [candle({ openTimeSec: 1_700_000_000, timeframe: "H1" })],
        M15: [candle({ openTimeSec: 1_700_000_000 + 1800, timeframe: "M15" })],
      },
      requirement: {
        consumerId: "no-threshold",
        requiredTimeframes: ["H1", "M15"],
        candleStatePolicy: { mode: "closed_only" },
        maxTipSkewSec: null,
      },
    });
    expect(measured.measuredSkewSec).toBe(1800);
    expect(measured.findings.some((f) => f.code === MIF_QI_MTF_SKEW_MEASURED)).toBe(true);
    expect(measured.findings.some((f) => f.code === MIF_QI_MTF_SKEW_THRESHOLD_UNSET)).toBe(true);
    expect(measured.findings.some((f) => f.code === MIF_QI_MTF_SKEW_EXCEEDED)).toBe(false);

    const exceeded = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        H1: [candle({ openTimeSec: 1_700_000_000, timeframe: "H1" })],
        M15: [candle({ openTimeSec: 1_700_000_000 + 1800, timeframe: "M15" })],
      },
      requirement: {
        consumerId: "tight",
        requiredTimeframes: ["H1", "M15"],
        candleStatePolicy: { mode: "closed_only" },
        maxTipSkewSec: 60,
      },
    });
    expect(exceeded.findings.some((f) => f.code === MIF_QI_MTF_SKEW_EXCEEDED)).toBe(true);
    expect(exceeded.status).toBe("DEGRADED");
  });

  it("refuses mixed clock domains", () => {
    const r = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        H1: [candle({ openTimeSec: 1_700_000_000, timeframe: "H1", timebase: "BROKER_SERVER" })],
        M15: [candle({ openTimeSec: 1_700_000_000, timeframe: "M15", timebase: "UTC" })],
      },
      requirement: {
        consumerId: "mixed",
        requiredTimeframes: ["H1", "M15"],
        candleStatePolicy: { mode: "closed_only" },
      },
    });
    expect(r.alignment).toBe("incomparable");
    expect(r.findings.some((f) => f.code === MIF_QI_TIMEBASE_MIXED)).toBe(true);
    expect(r.status).toBe("BLOCKED");
  });

  it("deterministic identity ignores assessmentTimestamp", () => {
    const series = {
      H1: [candle({ openTimeSec: 1_700_000_000, timeframe: "H1" })],
    };
    const req = {
      consumerId: "det",
      requiredTimeframes: ["H1"] as const,
      candleStatePolicy: { mode: "closed_only" as const },
    };
    const a = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: series,
      requirement: req,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    const b = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: series,
      requirement: req,
      assessmentTimestamp: "2025-01-01T00:00:00.000Z",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);

    const c = assessMifMultiTimeframeQuality({
      providerSymbol: "XAUUSD",
      seriesByTimeframe: {
        H1: [candle({ openTimeSec: 1_700_003_600, timeframe: "H1" })],
      },
      requirement: req,
    });
    expect(c.inputIdentity).not.toBe(a.inputIdentity);
  });
});
