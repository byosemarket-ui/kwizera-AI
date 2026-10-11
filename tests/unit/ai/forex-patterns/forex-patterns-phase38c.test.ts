import { describe, expect, it } from "vitest";
import {
  DEFAULT_PATTERN_PARAMS,
  detectCandlestickPatterns,
  fromUnifiedCandles,
  RULE_VERSION,
  PATTERN_SCHEMA_VERSION,
  type PatternCandle,
  type PatternDetectionInput,
} from "../../../../ai/forex-patterns/index.ts";

const T0 = 1_700_000_000;

function c(
  time: number,
  open: number,
  high: number,
  low: number,
  close: number,
  closed = true,
): PatternCandle {
  return { time, open, high, low, close, isClosed: closed, closed };
}

function baseInput(
  candles: PatternCandle[],
  overrides: Partial<PatternDetectionInput> = {},
): PatternDetectionInput {
  return {
    provider: "BINANCE",
    symbol: "BTCUSDT",
    timeframe: "15m",
    candles,
    includeForming: false,
    ...overrides,
  };
}

function ids(result: ReturnType<typeof detectCandlestickPatterns>): string[] {
  return result.detections.map((d) => d.patternId);
}

describe("Forex Phase 38C — Deterministic Candlestick Pattern Engine", () => {
  it("exposes rule version and schema defaults", () => {
    expect(RULE_VERSION).toBe("candlestick-patterns-v1");
    expect(PATTERN_SCHEMA_VERSION).toBe("forex-candlestick-patterns-v1");
    expect(DEFAULT_PATTERN_PARAMS.dojiBodyMaxRatio).toBe(0.1);
    expect(DEFAULT_PATTERN_PARAMS.hammerBodyMaxRatio).toBe(0.35);
    expect(DEFAULT_PATTERN_PARAMS.hammerLowerWickMinRatio).toBe(2.0);
    expect(DEFAULT_PATTERN_PARAMS.hammerUpperWickMaxRatio).toBe(0.5);
    expect(DEFAULT_PATTERN_PARAMS.engulfingMinBodyRatio).toBe(0.4);
    expect(DEFAULT_PATTERN_PARAMS.starMiddleBodyMaxRatio).toBe(0.35);
    expect(DEFAULT_PATTERN_PARAMS.minRangeEpsilon).toBe(1e-12);
  });

  it("detects Doji (positive)", () => {
    const candles = [c(T0, 100, 101, 99, 100.05)];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).toContain("doji");
    const d = result.detections.find((x) => x.patternId === "doji")!;
    expect(d.direction).toBe("NEUTRAL");
    expect(d.status).toBe("CONFIRMED");
    expect(d.patternFamily).toBe("CANDLESTICK");
    expect(d.ruleVersion).toBe(RULE_VERSION);
    expect(d.evidence.some((e) => e.includes("body/range"))).toBe(true);
  });

  it("detects Hammer (positive)", () => {
    // body near high, long lower wick
    const candles = [c(T0, 100, 100.6, 98, 100.5)];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).toContain("hammer");
    const d = result.detections.find((x) => x.patternId === "hammer")!;
    expect(d.direction).toBe("BULLISH");
    expect(d.status).toBe("CONFIRMED");
  });

  it("detects Shooting Star (positive)", () => {
    const candles = [c(T0, 100.5, 103, 99.9, 100)];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).toContain("shooting_star");
    const d = result.detections.find((x) => x.patternId === "shooting_star")!;
    expect(d.direction).toBe("BEARISH");
    expect(d.status).toBe("CONFIRMED");
  });

  it("detects Bullish Engulfing (positive)", () => {
    const candles = [
      c(T0, 102, 102.5, 99.5, 100),
      c(T0 + 900, 99.5, 103, 99, 102.5),
    ];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).toContain("bullish_engulfing");
    const d = result.detections.find((x) => x.patternId === "bullish_engulfing")!;
    expect(d.direction).toBe("BULLISH");
    expect(d.status).toBe("CONFIRMED");
    expect(d.candleTimes).toEqual([T0, T0 + 900]);
  });

  it("detects Bearish Engulfing (positive)", () => {
    const candles = [
      c(T0, 100, 102.5, 99.5, 102),
      c(T0 + 900, 102.5, 103, 99, 99.5),
    ];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).toContain("bearish_engulfing");
    const d = result.detections.find((x) => x.patternId === "bearish_engulfing")!;
    expect(d.direction).toBe("BEARISH");
    expect(d.status).toBe("CONFIRMED");
  });

  it("detects Morning Star (positive)", () => {
    const candles = [
      c(T0, 105, 105.5, 99.5, 100),
      c(T0 + 900, 100, 100.8, 99.5, 100.2),
      c(T0 + 1800, 100.5, 104, 100, 103.5),
    ];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).toContain("morning_star");
    const d = result.detections.find((x) => x.patternId === "morning_star")!;
    expect(d.direction).toBe("BULLISH");
    expect(d.status).toBe("CONFIRMED");
    expect(d.candleTimes).toHaveLength(3);
  });

  it("detects Evening Star (positive)", () => {
    const candles = [
      c(T0, 100, 105.5, 99.5, 105),
      c(T0 + 900, 105, 105.5, 104.2, 104.8),
      c(T0 + 1800, 104.5, 105, 100, 101.5),
    ];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).toContain("evening_star");
    const d = result.detections.find((x) => x.patternId === "evening_star")!;
    expect(d.direction).toBe("BEARISH");
    expect(d.status).toBe("CONFIRMED");
  });

  it("rejects engulfing when bodies do not engulf", () => {
    const candles = [
      c(T0, 102, 102.5, 99.5, 100), // bearish substantial
      c(T0 + 900, 100.2, 101.5, 100, 101), // bullish but does not engulf
    ];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).not.toContain("bullish_engulfing");
  });

  it("rejects hammer when lower wick is short", () => {
    // small body but short lower wick
    const candles = [c(T0, 100, 100.4, 99.7, 100.3)];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).not.toContain("hammer");
  });

  it("does not match star without 3 candles", () => {
    const candles = [
      c(T0, 105, 105.5, 99.5, 100),
      c(T0 + 900, 100, 100.8, 99.5, 100.2),
    ];
    const result = detectCandlestickPatterns(baseInput(candles));
    expect(ids(result)).not.toContain("morning_star");
    expect(ids(result)).not.toContain("evening_star");
  });

  it("honors dojiBodyMaxRatio threshold boundaries", () => {
    // range=1, body=0.1 → ratio exactly 0.1 → match
    const at = [c(T0, 100, 100.55, 99.55, 100.1)];
    expect(ids(detectCandlestickPatterns(baseInput(at)))).toContain("doji");

    // body=0.11 → ratio 0.11 > 0.1 → no doji
    const over = [c(T0, 100, 100.55, 99.55, 100.11)];
    expect(ids(detectCandlestickPatterns(baseInput(over)))).not.toContain("doji");

    // custom tighter threshold rejects the boundary match
    const tight = detectCandlestickPatterns(
      baseInput(at, { params: { dojiBodyMaxRatio: 0.05 } }),
    );
    expect(ids(tight)).not.toContain("doji");
  });

  it("skips zero-range candles and invalid OHLC", () => {
    const zero = [c(T0, 100, 100, 100, 100)];
    const zeroResult = detectCandlestickPatterns(baseInput(zero));
    expect(zeroResult.detections).toEqual([]);
    expect(zeroResult.analyzedClosedCount).toBe(1);

    const invalid = [
      { time: T0, open: 100, high: 99, low: 98, close: 100 }, // high < open
      c(T0 + 900, 100, 101, 99, 100.05),
    ];
    const bad = detectCandlestickPatterns(baseInput(invalid as PatternCandle[]));
    expect(bad.validation.skippedInvalid).toBeGreaterThanOrEqual(1);
    expect(ids(bad)).toContain("doji");
  });

  it("flags insufficient history with empty detections", () => {
    const result = detectCandlestickPatterns(baseInput([]));
    expect(result.validation.insufficientHistory).toBe(true);
    expect(result.detections).toEqual([]);
    expect(result.note).toMatch(/Insufficient closed candle history/i);
    expect(result.ruleVersion).toBe(RULE_VERSION);
  });

  it("marks forming / incomplete candles as CANDIDATE not CONFIRMED", () => {
    const closedOnly = detectCandlestickPatterns(
      baseInput([c(T0, 100, 101, 99, 100.05, true)]),
    );
    expect(closedOnly.detections.find((d) => d.patternId === "doji")?.status).toBe("CONFIRMED");

    const forming = detectCandlestickPatterns(
      baseInput([c(T0, 100, 101, 99, 100.05, false)], { includeForming: true }),
    );
    expect(forming.detections.find((d) => d.patternId === "doji")?.status).toBe("CANDIDATE");

    const excluded = detectCandlestickPatterns(
      baseInput([c(T0, 100, 101, 99, 100.05, false)], { includeForming: false }),
    );
    expect(excluded.validation.insufficientHistory).toBe(true);
    expect(excluded.formingExcluded).toBe(true);
    expect(excluded.detections).toEqual([]);

    // Morning star: third forming → CANDIDATE
    const starForming = detectCandlestickPatterns(
      baseInput(
        [
          c(T0, 105, 105.5, 99.5, 100, true),
          c(T0 + 900, 100, 100.8, 99.5, 100.2, true),
          c(T0 + 1800, 100.5, 104, 100, 103.5, false),
        ],
        { includeForming: true },
      ),
    );
    const ms = starForming.detections.find((d) => d.patternId === "morning_star");
    expect(ms?.status).toBe("CANDIDATE");
  });

  it("drops duplicate timestamps and sorts out-of-order series", () => {
    const dup = detectCandlestickPatterns(
      baseInput([
        c(T0, 100, 101, 99, 100.05),
        c(T0, 100, 102, 98, 101), // duplicate time — dropped
        c(T0 + 900, 100.5, 103, 99.9, 100),
      ]),
    );
    expect(dup.validation.skippedDuplicates).toBe(1);
    expect(dup.analyzedClosedCount).toBe(2);

    const unordered = detectCandlestickPatterns(
      baseInput([
        c(T0 + 900, 100.5, 103, 99.9, 100),
        c(T0, 100, 101, 99, 100.05),
      ]),
    );
    expect(unordered.validation.warnings.some((w) => /out of order/i.test(w))).toBe(true);
    expect(unordered.analyzedClosedCount).toBe(2);
  });

  it("preserves provider/symbol/timeframe on detections and isolates symbol changes", () => {
    const candles = [c(T0, 100, 101, 99, 100.05)];
    const a = detectCandlestickPatterns(
      baseInput(candles, { provider: "FXCM", symbol: "EUR/USD", timeframe: "1h", priceBasis: "mid" }),
    );
    expect(a.provider).toBe("FXCM");
    expect(a.symbol).toBe("EUR/USD");
    expect(a.timeframe).toBe("1h");
    const d = a.detections[0]!;
    expect(d.provider).toBe("FXCM");
    expect(d.symbol).toBe("EUR/USD");
    expect(d.priceBasis).toBe("mid");

    const b = detectCandlestickPatterns(
      baseInput(candles, { provider: "FXCM", symbol: "GBP/USD", timeframe: "1h" }),
    );
    expect(b.symbol).toBe("GBP/USD");
    expect(b.detections.every((x) => x.symbol === "GBP/USD")).toBe(true);
    expect(a.symbol).not.toBe(b.symbol);
  });

  it("is reproducible for identical inputs", () => {
    const candles = [
      c(T0, 105, 105.5, 99.5, 100),
      c(T0 + 900, 100, 100.8, 99.5, 100.2),
      c(T0 + 1800, 100.5, 104, 100, 103.5),
    ];
    const input = baseInput(candles, { provider: "FOREXCONNECT", symbol: "EUR/USD" });
    const r1 = detectCandlestickPatterns(input);
    const r2 = detectCandlestickPatterns(input);
    expect(r1).toEqual(r2);
  });

  it("maps fromUnifiedCandles helper", () => {
    const mapped = fromUnifiedCandles([
      { time: T0, open: 1, high: 2, low: 0.5, close: 1.5, isClosed: true },
    ]);
    expect(mapped[0]).toMatchObject({ time: T0, open: 1, isClosed: true });
  });

  it("never invents OHLC and keeps schemaVersion", () => {
    const result = detectCandlestickPatterns(baseInput([c(T0, 100, 101, 99, 100.05)]));
    expect(result.schemaVersion).toBe(PATTERN_SCHEMA_VERSION);
    expect(result.note).toMatch(/not a trade signal/i);
    for (const d of result.detections) {
      expect(d.candleTimes.every((t) => Number.isFinite(t))).toBe(true);
    }
  });
});
