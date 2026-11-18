/**
 * Phase 5B.2 Step 1 — gap classification & session uncertainty.
 */
import { describe, it, expect } from "vitest";
import {
  baseCanonicalCandle,
  assessMifDataIntegrity,
  countCandidateOpensBetween,
  MIF_QI_POSSIBLE_GAP,
  MIF_QI_UNKNOWN_SESSION_GAP,
  MIF_QI_CONFIRMED_MISSING,
  MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR,
  MIF_QI_DURATION_UNSUPPORTED,
  MIF_QI_GAP_DETECTION_SKIPPED,
  type MifCanonicalCandle,
  type MifExpectedIntervalAuthority,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function candle(over: Partial<MifCanonicalCandle> & { openTimeSec: number }): MifCanonicalCandle {
  const openTimeSec = over.openTimeSec;
  const tf = over.timeframe ?? "H1";
  const step = tf.toUpperCase() === "H1" ? 3600 : tf.toUpperCase() === "M5" ? 300 : 3600;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: tf,
    openTimeSec,
    closeTimeSec: over.closeTimeSec !== undefined ? over.closeTimeSec : openTimeSec + step,
    open: over.open ?? 100,
    high: over.high ?? 101,
    low: over.low ?? 99,
    close: over.close ?? 100.5,
    tickVolume: null,
    realVolume: null,
    collapsedVolume: null,
    volumeType: "none",
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

describe("Phase 5B.2 Step1 — gap math helpers", () => {
  it("countCandidateOpensBetween does not count endpoints", () => {
    expect(countCandidateOpensBetween(1000, 1000 + 3600, 3600)).toBe(0);
    expect(countCandidateOpensBetween(1000, 1000 + 7200, 3600)).toBe(1);
    expect(countCandidateOpensBetween(1000, 1000 + 14400, 3600)).toBe(3);
  });
});

describe("Phase 5B.2 Step1 — gap classification", () => {
  it("continuous candles: no possible/confirmed missing", () => {
    const base = 1_700_000_000;
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: base }),
        candle({ openTimeSec: base + 3600 }),
        candle({ openTimeSec: base + 7200 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
    expect(r.gapCounters.possibleMissingCount).toBe(0);
    expect(r.gapCounters.unknownSessionGapCount).toBe(0);
    expect(r.findings.some((f) => f.code === MIF_QI_POSSIBLE_GAP)).toBe(false);
  });

  it("one possible missing interval is POSSIBLE_GAP, never confirmed without authority", () => {
    const base = 1_700_000_000;
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: base }),
        candle({ openTimeSec: base + 7200 }), // skip one H1
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
    expect(r.gapCounters.possibleMissingCount).toBe(1);
    expect(r.findings.some((f) => f.code === MIF_QI_POSSIBLE_GAP)).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_CONFIRMED_MISSING)).toBe(false);
    expect(r.status === "WARNING" || r.status === "VALID").toBe(true);
    expect(r.status).not.toBe("BLOCKED");
  });

  it("multiple possible missing intervals accumulate without double-counting endpoints", () => {
    const base = 1_700_000_000;
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: base }),
        candle({ openTimeSec: base + 3600 * 4 }), // 3 missing
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
    expect(r.gapCounters.possibleMissingCount).toBe(3);
  });

  it("large gap classified as UNKNOWN_SESSION_GAP, not confirmed missing", () => {
    const base = 1_700_000_000;
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: base }),
        candle({ openTimeSec: base + 86_400 }), // 24h
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
    expect(r.gapCounters.unknownSessionGapCount).toBeGreaterThan(0);
    expect(r.findings.some((f) => f.code === MIF_QI_UNKNOWN_SESSION_GAP)).toBe(true);
    expect(r.uncertaintyCodes).toContain(MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR);
  });

  it("MN1 / no fixed duration: gap detection skipped, duration unsupported", () => {
    const r = assessMifDataIntegrity({
      candles: [
        candle({
          openTimeSec: 1_700_000_000,
          timeframe: "MN1",
          closeTimeSec: null,
        }),
        candle({
          openTimeSec: 1_702_500_000,
          timeframe: "MN1",
          closeTimeSec: null,
        }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "MN1",
    });
    expect(r.findings.some((f) => f.code === MIF_QI_DURATION_UNSUPPORTED)).toBe(true);
    expect(r.findings.some((f) => f.code === MIF_QI_GAP_DETECTION_SKIPPED)).toBe(true);
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
  });

  it("FORMING candles are not gap-chained as closed history", () => {
    const base = 1_700_000_000;
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: base, candleState: "CLOSED" }),
        candle({ openTimeSec: base + 7200, candleState: "FORMING" }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    // Only one CLOSED → no pairwise gap between two CLOSED bars.
    expect(r.gapCounters.possibleMissingCount).toBe(0);
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
  });

  it("authoritative expected opens can yield CONFIRMED_MISSING", () => {
    const base = 1_700_000_000;
    const authority: MifExpectedIntervalAuthority = {
      authorityId: "test-schedule",
      authorityVersion: "1",
      isExpectedOpen: (_s, _tf, open) => open === base + 3600,
    };
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: base }),
        candle({ openTimeSec: base + 7200 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      expectedIntervalAuthority: authority,
    });
    expect(r.gapCounters.confirmedMissingCount).toBe(1);
    expect(r.findings.some((f) => f.code === MIF_QI_CONFIRMED_MISSING)).toBe(true);
    // With authority attached, NO_AUTHORITATIVE_SESSION_CALENDAR should not appear.
    expect(r.findings.some((f) => f.code === MIF_QI_NO_AUTHORITATIVE_SESSION_CALENDAR)).toBe(
      false,
    );
  });

  it("does not invent confirmed missing across overlapping invalid series only", () => {
    const base = 1_700_000_000;
    const r = assessMifDataIntegrity({
      candles: [
        candle({ openTimeSec: base, closeTimeSec: base + 3600 }),
        candle({ openTimeSec: base + 1800, closeTimeSec: base + 5400 }),
      ],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(r.gapCounters.confirmedMissingCount).toBe(0);
    expect(r.status).toBe("BLOCKED"); // overlap
  });
});
