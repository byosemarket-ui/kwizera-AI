/**
 * Phase 4.18F.3 — Indicators, structure intel, signal validation, evidence wiring.
 */
import { describe, expect, it } from "vitest";
import {
  __indicatorTestUtils,
  buildTechnicalIntelligence,
  computeIndicatorSuite,
  classifyMarketCondition,
  validateStrategySignal,
  buildStructureIntel,
} from "../../../../ai/forex-ai/automated-trading/technical-intelligence/index.js";
import { atrAt, evaluateSmaCrossoverStrategy } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/evaluate.js";
import { SMA_CROSSOVER_RULES, type StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import {
  buildMarketEvidenceBundle,
  marketEvidenceForModelPrompt,
} from "../../../../ai/forex-ai/automated-trading/analysis/market-evidence-builder.js";

/** Recent closed-candle series so freshness stays FRESH under F.3 stale thresholds. */
function risingCandles(n: number, start = 100, step = 0.5): StrategyCandle[] {
  const out: StrategyCandle[] = [];
  let px = start;
  const nowSec = Math.floor(Date.now() / 1000);
  const t0 = nowSec - n * 900;
  for (let i = 0; i < n; i++) {
    const open = px;
    const close = px + step;
    out.push({
      time: t0 + i * 900,
      open,
      high: Math.max(open, close) + 0.2,
      low: Math.min(open, close) - 0.2,
      close,
      closed: true,
    });
    px = close;
  }
  return out;
}

function fallingCandles(n: number, start = 200, step = 0.5): StrategyCandle[] {
  return risingCandles(n, start, -step);
}

function flatCandles(n: number, px = 150): StrategyCandle[] {
  const out: StrategyCandle[] = [];
  const nowSec = Math.floor(Date.now() / 1000);
  const t0 = nowSec - n * 900;
  for (let i = 0; i < n; i++) {
    out.push({
      time: t0 + i * 900,
      open: px,
      high: px + 0.1,
      low: px - 0.1,
      close: px,
      closed: true,
    });
  }
  return out;
}

describe("F.3 indicator engine", () => {
  it("computes SMA/EMA with documented methods", () => {
    const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(__indicatorTestUtils.smaAt(closes, 3, 8)).toBe(8); // (7+8+9)/3
    const ema = __indicatorTestUtils.emaSeries(closes, 3);
    expect(ema[2]).toBe(2); // SMA seed (1+2+3)/3
    expect(ema[3]).toBeCloseTo(3, 8); // 4*0.5 + 2*0.5
  });

  it("computes Wilder RSI(14) and rejects short history", () => {
    const suiteShort = computeIndicatorSuite({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: risingCandles(10),
    });
    expect(suiteShort.rsi.rsi14.quality).toBe("INSUFFICIENT_DATA");
    expect(suiteShort.rsi.rsi14.value).toBeNull();

    const suite = computeIndicatorSuite({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: risingCandles(40),
    });
    expect(suite.rsi.rsi14.quality).toBe("VALID");
    expect(suite.rsi.rsi14.value).toBeGreaterThan(50);
    expect(suite.placesOrders).toBe(false);
    expect(suite.mutatesBroker).toBe(false);
  });

  it("computes MACD and Bollinger with quality metadata", () => {
    const suite = computeIndicatorSuite({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles: risingCandles(60),
    });
    expect(suite.macd.macd.quality).toBe("VALID");
    expect(suite.macd.signal.quality).toBe("VALID");
    expect(suite.bollinger.middle.quality).toBe("VALID");
    expect(suite.bollinger.upper.value!).toBeGreaterThan(suite.bollinger.middle.value!);
    expect(suite.bollinger.lower.value!).toBeLessThan(suite.bollinger.middle.value!);
  });

  it("preserves ATR as SMA_OF_TR matching strategy atrAt", () => {
    const candles = risingCandles(40);
    const suite = computeIndicatorSuite({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles,
    });
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);
    const expected = atrAt(highs, lows, closes, 14, candles.length - 1);
    expect(suite.atr.method).toBe("SMA_OF_TR");
    expect(suite.atr.atr.value).toBeCloseTo(expected!, 10);
  });

  it("marks ADX insufficient when history is short", () => {
    const suite = computeIndicatorSuite({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: risingCandles(20),
    });
    expect(suite.adx.adx.quality).toBe("INSUFFICIENT_DATA");
  });

  it("computes ADX when history is sufficient", () => {
    const suite = computeIndicatorSuite({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: risingCandles(80),
    });
    expect(suite.adx.adx.quality).toBe("VALID");
    expect(suite.adx.adx.value).toBeGreaterThan(0);
    expect(suite.adx.plusDi.value).not.toBeNull();
  });

  it("rejects invalid OHLC", () => {
    const bad: StrategyCandle[] = [
      { time: 1, open: 1, high: 0.5, low: 2, close: 1, closed: true },
    ];
    const suite = computeIndicatorSuite({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: bad,
    });
    expect(suite.closedCandleCount).toBe(0);
    expect(suite.movingAverages.sma9.quality).toBe("INVALID_INPUT");
  });

  it("does not use forming candle", () => {
    const candles = risingCandles(40);
    candles[candles.length - 1]!.closed = false;
    candles[candles.length - 1]!.close = 9999;
    const suite = computeIndicatorSuite({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles,
    });
    expect(suite.closedCandleCount).toBe(39);
    expect(suite.movingAverages.sma9.value).not.toBeNull();
  });
});

describe("F.3 market structure intel", () => {
  it("reports INSUFFICIENT_DATA for short history", () => {
    const s = buildStructureIntel({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: risingCandles(5),
    });
    expect(s.quality).toBe("INSUFFICIENT_DATA");
    expect(s.events).toEqual([]);
  });

  it("produces structure from longer history without inventing order blocks", () => {
    const s = buildStructureIntel({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles: risingCandles(80),
    });
    expect(["BULLISH", "BEARISH", "RANGE", "UNKNOWN"]).toContain(s.trendState);
    expect(s.method).toContain("market-structure");
    expect(s.note.toLowerCase()).not.toContain("order block");
  });
});

describe("F.3 signal validation", () => {
  it("keeps strategy NO_TRADE authority — indicators cannot force BUY", () => {
    const candles = flatCandles(60);
    const intel = buildTechnicalIntelligence({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles,
      strategyDirection: "NO_TRADE",
      strategyCode: "NO_CROSS",
      quoteFresh: true,
      nowMs: Date.now(),
    });
    expect(intel.signalValidation.outcome).toBe("NO_TRADE");
    expect(intel.signalValidation.placesOrders).toBe(false);
    expect(intel.signalValidation.acceptsForExecution).toBe(false);
    expect(intel.signalValidation.mutatesBroker).toBe(false);
    expect(intel.signalValidation.isCalibratedWinProbability).toBe(false);
    expect(intel.signalValidation.confidenceType).toBe("ANALYSIS_CONFIDENCE");
  });

  it("marks CONFLICT when structure opposes BUY candidate", () => {
    const candles = risingCandles(60);
    const suite = computeIndicatorSuite({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles,
      nowMs: Date.now(),
    });
    const structure = {
      trendState: "BEARISH",
      confirmedSwings: 4,
      provisionalSwings: 0,
      classifications: [],
      events: [{ type: "CHOCH", direction: "BEARISH", status: "CONFIRMED", level: 1, breakCandleTime: 1 }],
      zones: [],
      rangeHigh: 2,
      rangeLow: 1,
      method: "market-structure-v1",
      quality: "VALID" as const,
      note: "test",
    };
    const condition = classifyMarketCondition({ suite, structure, nowMs: Date.now() });
    // Force non-stale for conflict-path assertion (freshness tested separately).
    condition.stale = false;
    const v = validateStrategySignal({
      instrument: "EUR/USD",
      timeframe: "15m",
      strategyDirection: "BUY",
      strategyCode: "CROSS_UP",
      suite,
      condition,
      structure,
      quoteFresh: true,
      nowMs: Date.now(),
    });
    expect(v.outcome).toBe("CONFLICT");
    expect(v.rejectionReasons.length).toBeGreaterThan(0);
  });

  it("returns STALE_DATA when quote is not fresh", () => {
    const candles = risingCandles(60);
    const intel = buildTechnicalIntelligence({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles,
      strategyDirection: "BUY",
      strategyCode: "CROSS_UP",
      quoteFresh: false,
    });
    expect(intel.signalValidation.outcome).toBe("STALE_DATA");
  });

  it("returns INSUFFICIENT_DATA for short history", () => {
    const intel = buildTechnicalIntelligence({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: risingCandles(10),
      strategyDirection: "BUY",
      strategyCode: "CROSS_UP",
    });
    expect(intel.signalValidation.outcome).toBe("INSUFFICIENT_DATA");
  });
});

describe("F.3 strategy regression", () => {
  it("does not change SMA crossover numerical ATR behavior", () => {
    const candles = risingCandles(40);
    const ev = evaluateSmaCrossoverStrategy({ candles, pointSize: 0.01 });
    expect(ev.strategyId).toBe(SMA_CROSSOVER_RULES.strategyId);
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    const closes = candles.map((c) => c.close);
    expect(ev.atr).toBeCloseTo(atrAt(highs, lows, closes, 14, candles.length - 1)!, 10);
  });
});

describe("F.3 market evidence + OpenAI serialization", () => {
  it("embeds technical intelligence and serializes for model prompt", () => {
    const candles = risingCandles(80);
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": candles, "1h": risingCandles(80, 100, 0.2) },
      quote: {
        instrument: "EUR/USD",
        bid: 140,
        ask: 140.1,
        quoteFresh: true,
        freshnessReasonCode: null,
        effectivePriceChangeAgeMs: 1000,
        evaluatedAtUtc: new Date().toISOString(),
        snapshotFingerprint: "fp",
      },
      pointSize: 0.0001,
    });
    expect(bundle.evidenceVersion).toMatch(/^4\.18F\./);

    expect(bundle.technicalIntelligence).not.toBeNull();
    expect(bundle.technicalIntelligence!.indicators.atr.method).toBe("SMA_OF_TR");
    expect(bundle.technicalIntelligence!.signalValidation.placesOrders).toBe(false);
    expect(bundle.placesOrders).toBe(false);

    const prompt = marketEvidenceForModelPrompt(bundle);
    expect(prompt.technicalIntelligence).toBeTruthy();
    const ti = prompt.technicalIntelligence as Record<string, unknown>;
    expect(ti.atr).toBeTruthy();
    expect(ti.rsi).toBeTruthy();
    expect(ti.macd).toBeTruthy();
    expect(ti.bollinger).toBeTruthy();
    expect(ti.adx).toBeTruthy();
    expect(ti.structure).toBeTruthy();
    expect(ti.signalValidation).toBeTruthy();
    expect(prompt.placesOrders).toBe(false);
    expect(prompt.mutatesBroker).toBe(false);
  });

  it("isolates instruments/timeframes", () => {
    const eur = buildTechnicalIntelligence({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: risingCandles(50),
      strategyDirection: "NO_TRADE",
      strategyCode: "X",
    });
    const xau = buildTechnicalIntelligence({
      instrument: "XAU/USD",
      timeframe: "1h",
      candles: fallingCandles(50, 2000, 1),
      strategyDirection: "NO_TRADE",
      strategyCode: "X",
    });
    expect(eur.indicators.instrument).toBe("EUR/USD");
    expect(eur.indicators.timeframe).toBe("15m");
    expect(xau.indicators.instrument).toBe("XAU/USD");
    expect(xau.indicators.timeframe).toBe("1h");
    expect(eur.indicators.movingAverages.sma9.value).not.toEqual(xau.indicators.movingAverages.sma9.value);
  });
});
