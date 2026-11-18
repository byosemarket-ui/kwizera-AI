/**
 * Phase 5C Step 1A — MIF → structure-candle adapter.
 */
import { describe, it, expect } from "vitest";
import {
  baseCanonicalCandle,
  mifCandlesToStructureCandles,
  type MifCanonicalCandle,
} from "../../../../ai/market-data/mt5-hfm/mif/index";
import {
  DEFAULT_STRUCTURE_PARAMS,
  detectSwings,
} from "../../../../ai/forex-structure/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function candle(
  index: number,
  over: Partial<MifCanonicalCandle> & { high?: number; low?: number; candleState?: MifCanonicalCandle["candleState"] } = {},
): MifCanonicalCandle {
  const openTimeSec = T0 + index * STEP;
  const high = over.high ?? 101;
  const low = over.low ?? 99;
  const mid = (high + low) / 2;
  return baseCanonicalCandle({
    providerSymbol: "XAUUSD",
    timeframe: "H1",
    openTimeSec,
    closeTimeSec: openTimeSec + STEP,
    open: mid,
    high,
    low,
    close: mid,
    tickVolume: 1,
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
    high,
    low,
  });
}

describe("Phase 5C Step1A — MIF structure adapter", () => {
  it("converts valid CLOSED candles without mutating input", () => {
    const candles = [candle(0), candle(1), candle(2)];
    const frozen = candles.map((c) => ({ ...c }));
    const result = mifCandlesToStructureCandles({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(result.ok).toBe(true);
    expect(result.blocking).toBe(false);
    expect(result.providerId).toBe("HFM_MT5");
    expect(result.structureCandles).toHaveLength(3);
    expect(result.closedCount).toBe(3);
    expect(result.structureCandles[0]!.time).toBe(T0);
    expect(result.structureCandles[0]!.isClosed).toBe(true);
    expect(candles).toEqual(frozen);
  });

  it("excludes FORMING by default and includes when requested", () => {
    const candles = [candle(0), candle(1, { candleState: "FORMING", high: 102, low: 100 })];
    const closedOnly = mifCandlesToStructureCandles({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(closedOnly.structureCandles).toHaveLength(1);
    expect(closedOnly.closedCount).toBe(1);

    const withForming = mifCandlesToStructureCandles({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      includeForming: true,
    });
    expect(withForming.structureCandles).toHaveLength(2);
    expect(withForming.closedCount).toBe(1);
    expect(withForming.structureCandles[1]!.isClosed).toBe(false);
  });

  it("reports INVALID_OHLC and skips without silent repair", () => {
    const bad = candle(0, { high: 90, low: 100 });
    const result = mifCandlesToStructureCandles({
      candles: [bad, candle(1)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(result.issues.some((i) => i.code === "INVALID_OHLC")).toBe(true);
    expect(result.structureCandles).toHaveLength(1);
  });

  it("reports DUPLICATE_OPEN_TIME and keeps first", () => {
    const a = candle(0);
    const dup = candle(0, { high: 110, low: 108 });
    const result = mifCandlesToStructureCandles({
      candles: [a, dup],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(result.issues.some((i) => i.code === "DUPLICATE_OPEN_TIME")).toBe(true);
    expect(result.structureCandles).toHaveLength(1);
    expect(result.structureCandles[0]!.high).toBe(a.high);
  });

  it("blocks OUT_OF_ORDER input without reordering", () => {
    const result = mifCandlesToStructureCandles({
      candles: [candle(2), candle(1)],
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(result.blocking).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.structureCandles).toHaveLength(0);
    expect(result.issues.some((i) => i.code === "OUT_OF_ORDER")).toBe(true);
  });

  it("preserves HFM_MT5 provenance and feeds the real swing engine", () => {
    const levels = [
      { h: 102, l: 98 },
      { h: 101, l: 97 },
      { h: 100, l: 90 },
      { h: 103, l: 94 },
      { h: 104, l: 95 },
      { h: 110, l: 100 },
      { h: 108, l: 99 },
      { h: 107, l: 98 },
    ];
    const candles = levels.map((row, i) => candle(i, { high: row.h, low: row.l }));
    const adapted = mifCandlesToStructureCandles({
      candles,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
    });
    expect(adapted.providerId).toBe("HFM_MT5");
    const swings = detectSwings(
      adapted.structureCandles,
      adapted.closedCount,
      DEFAULT_STRUCTURE_PARAMS,
      false,
    );
    expect(swings.some((s) => s.status === "CONFIRMED")).toBe(true);
  });
});
