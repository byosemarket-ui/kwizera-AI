/**
 * Phase 5B.2 Step 1 — OHLC, chronology, duplicates, determinism.
 */
import { describe, it, expect } from "vitest";
import {
  baseCanonicalCandle,
  assessMifDataIntegrity,
  computeStep1InputIdentity,
  MIF_QUALITY_CONTRACT_ID,
  MIF_QUALITY_STEP1_ENGINE_VERSION,
  MIF_QI_INVALID_OHLC,
  MIF_QI_OUT_OF_ORDER,
  MIF_QI_DUPLICATE_OPEN,
  MIF_QI_CONFLICTING_CANDLE,
  MIF_QI_OVERLAPPING_INTERVAL,
  MIF_QI_UNSUPPORTED_CANDLE_STATE,
  MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR,
  type MifCanonicalCandle,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function candle(over: Partial<MifCanonicalCandle> & { openTimeSec: number }): MifCanonicalCandle {
  const open = over.open ?? 100;
  const high = over.high ?? 101;
  const low = over.low ?? 99;
  const close = over.close ?? 100.5;
  const tf = over.timeframe ?? "H1";
  const openTimeSec = over.openTimeSec;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: tf,
    openTimeSec,
    closeTimeSec: over.closeTimeSec !== undefined ? over.closeTimeSec : openTimeSec + 3600,
    open,
    high,
    low,
    close,
    tickVolume: 1,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "tick",
    spread: null,
    candleState: over.candleState ?? "CLOSED",
    priceBasis: "bid",
    timebase: over.timebase ?? "BROKER_SERVER",
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

describe("Phase 5B.2 Step1 — OHLC integrity", () => {
  it("accepts a valid CLOSED candle", () => {
    const r = assessMifDataIntegrity({
      candles: [candle({ openTimeSec: 1_700_000_000 })],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(r.contractId).toBe(MIF_QUALITY_CONTRACT_ID);
    expect(r.scope).toBe("step1-data-integrity");
    expect(r.doesNotApproveAiReasoning).toBe(true);
    expect(r.notUnifiedOverallAssessment).toBe(true);
    expect(r.placesOrders).toBe(false);
    expect(r.blockingCodes).not.toContain(MIF_QI_INVALID_OHLC);
    expect(r.uncertaintyCodes).toContain(MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR);
  });

  it("rejects NaN and Infinity prices", () => {
    const nanC = candle({ openTimeSec: 1_700_000_000, open: Number.NaN });
    const infC = candle({ openTimeSec: 1_700_003_600, high: Number.POSITIVE_INFINITY });
    const r = assessMifDataIntegrity({
      candles: [nanC, infC],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.findings.some((f) => f.code === MIF_QI_INVALID_OHLC)).toBe(true);
  });

  it("rejects high < open / close and high < low", () => {
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000, open: 10, high: 9, low: 8, close: 9.5 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.findings.filter((f) => f.code === MIF_QI_INVALID_OHLC).length).toBeGreaterThan(0);
  });

  it("rejects low above open/close", () => {
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000, open: 10, high: 12, low: 11, close: 10.5 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.status).toBe("BLOCKED");
  });

  it("does not coerce malformed non-number via silent repair — FORMING remains FORMING", () => {
    const r = assessMifDataIntegrity({
      candles: [candle({ openTimeSec: 1_700_000_000, candleState: "FORMING" })],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.findings.some((f) => f.candleState === "FORMING")).toBe(false);
    // FORMING is structurally usable; not treated as CLOSED for gap chaining only.
    expect(r.status === "VALID" || r.status === "WARNING").toBe(true);
    expect(r.coverage.validCandleCount).toBe(1);
  });

  it("marks INVALID candle state as blocking", () => {
    const r = assessMifDataIntegrity({
      candles: [candle({ openTimeSec: 1_700_000_000, candleState: "INVALID" })],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.findings.some((f) => f.code === MIF_QI_UNSUPPORTED_CANDLE_STATE)).toBe(true);
  });

  it("does not apply universal positive-price rule (zero geometry-valid candle)", () => {
    // Canonical contract does not require price > 0; zero with valid geometry is not INVALID_OHLC.
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000, open: 0, high: 0, low: 0, close: 0 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.findings.some((f) => f.code === MIF_QI_INVALID_OHLC)).toBe(false);
  });
});

describe("Phase 5B.2 Step1 — chronology & duplicates", () => {
  it("accepts chronological sequence", () => {
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000 }),
        candle({ openTimeSec: 1_700_003_600 }),
        candle({ openTimeSec: 1_700_007_200 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.orderingValid).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_OUT_OF_ORDER)).toBe(false);
  });

  it("detects reversed order without sorting away the defect", () => {
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_003_600 }),
        candle({ openTimeSec: 1_700_000_000 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.orderingValid).toBe(false);
    expect(r.status).toBe("BLOCKED");
    expect(r.findings.some((f) => f.code === MIF_QI_OUT_OF_ORDER)).toBe(true);
  });

  it("detects duplicate open and conflicting candles", () => {
    const dup = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000 }),
        candle({ openTimeSec: 1_700_000_000 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(dup.status).toBe("BLOCKED");
    expect(dup.findings.some((f) => f.code === MIF_QI_DUPLICATE_OPEN)).toBe(true);

    const conflict = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000, close: 100.5 }),
        candle({ openTimeSec: 1_700_000_000, close: 100.9 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(conflict.findings.some((f) => f.code === MIF_QI_CONFLICTING_CANDLE)).toBe(true);
  });

  it("detects overlapping intervals", () => {
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: 1_700_000_000, closeTimeSec: 1_700_003_600 }),
        candle({ openTimeSec: 1_700_001_800, closeTimeSec: 1_700_005_400 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.findings.some((f) => f.code === MIF_QI_OVERLAPPING_INTERVAL)).toBe(true);
  });
});

describe("Phase 5B.2 Step1 — determinism", () => {
  it("identical input yields identical inputIdentity; wall-clock excluded", () => {
    const candles = [
      candle({ openTimeSec: 1_700_000_000 }),
      candle({ openTimeSec: 1_700_003_600 }),
    ];
    const a = assessMifDataIntegrity({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      assessmentId: "run-a",
    });
    const b = assessMifDataIntegrity({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2025-06-01T12:00:00.000Z",
      assessmentId: "run-b",
    });
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.status).toBe(b.status);
    expect(a.gapCounters).toEqual(b.gapCounters);
  });

  it("different candles or engine/policy versions change identity", () => {
    const base = {
      candles: [candle({ openTimeSec: 1_700_000_000 })],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      engineId: "mif-quality-step1-integrity",
      engineVersion: MIF_QUALITY_STEP1_ENGINE_VERSION,
      policyId: "mif-quality-step1-hard-integrity",
      policyVersion: "1.0.0",
      contractId: MIF_QUALITY_CONTRACT_ID,
      contractVersion: "1.0.0",
    };
    const id1 = computeStep1InputIdentity(base);
    const id2 = computeStep1InputIdentity({
      ...base,
      candles: [candle({ openTimeSec: 1_700_000_000, close: 101 })],
    });
    const id3 = computeStep1InputIdentity({
      ...base,
      engineVersion: "9.9.9",
    });
    const id4 = computeStep1InputIdentity({
      ...base,
      policyVersion: "2.0.0",
    });
    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1).not.toBe(id4);
  });
});
