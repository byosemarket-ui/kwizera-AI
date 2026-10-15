/**
 * Phase 47A — Morning/Evening Star provenance + ForexConnect contract metadata.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  detectCandlestickPatterns,
  type PatternCandle,
  type PatternDetectionInput,
} from "../../../../ai/forex-patterns/index.ts";
import {
  buildForexAiEvidencePack,
  formatEvidenceForPrompt,
} from "../../../../ai/forex-ai/evidence/index.ts";
import {
  contractSpecFromForexConnectMetadata,
} from "../../../../ai/forex-ai/position-sizing/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

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
    provider: "FOREXCONNECT",
    symbol: "XAU/USD",
    timeframe: "1h",
    candles,
    includeForming: false,
    ...overrides,
  };
}

function ids(result: ReturnType<typeof detectCandlestickPatterns>): string[] {
  return result.detections.map((d) => d.patternId);
}

/** Valid Morning Star triplet. */
function morningStarTriplet(t0: number): PatternCandle[] {
  return [
    c(t0, 105, 105.5, 99.5, 100),
    c(t0 + 3600, 100, 100.8, 99.5, 100.2),
    c(t0 + 7200, 100.5, 104, 100, 103.5),
  ];
}

/** Valid Evening Star triplet. */
function eveningStarTriplet(t0: number): PatternCandle[] {
  return [
    c(t0, 100, 105.5, 99.5, 105),
    c(t0 + 3600, 105, 105.5, 104.2, 104.8),
    c(t0 + 7200, 104.5, 105, 100, 101.5),
  ];
}

describe("Phase 47A — Morning / Evening Star detector fixtures", () => {
  it("detects a valid Morning Star as CONFIRMED on closed candles", () => {
    const result = detectCandlestickPatterns(baseInput(morningStarTriplet(T0)));
    const d = result.detections.find((x) => x.patternId === "morning_star");
    expect(d).toBeTruthy();
    expect(d!.status).toBe("CONFIRMED");
    expect(d!.direction).toBe("BULLISH");
    expect(d!.timeframe).toBe("1h");
    expect(d!.candleEndTime).toBe(T0 + 7200);
    expect(d!.candleTimes).toHaveLength(3);
  });

  it("detects a valid Evening Star as CONFIRMED on closed candles", () => {
    const result = detectCandlestickPatterns(baseInput(eveningStarTriplet(T0)));
    const d = result.detections.find((x) => x.patternId === "evening_star");
    expect(d).toBeTruthy();
    expect(d!.status).toBe("CONFIRMED");
    expect(d!.direction).toBe("BEARISH");
    expect(d!.candleEndTime).toBe(T0 + 7200);
  });

  it("rejects an invalid Morning Star lookalike (third close below midpoint)", () => {
    const candles = [
      c(T0, 105, 105.5, 99.5, 100), // bearish
      c(T0 + 3600, 100, 100.8, 99.5, 100.2), // small
      c(T0 + 7200, 100.1, 101, 99.8, 100.4), // bullish but below first body midpoint (~102.5)
    ];
    expect(ids(detectCandlestickPatterns(baseInput(candles)))).not.toContain("morning_star");
  });

  it("rejects an invalid Evening Star lookalike (third close above midpoint)", () => {
    const candles = [
      c(T0, 100, 105.5, 99.5, 105), // bullish
      c(T0 + 3600, 105, 105.5, 104.2, 104.8),
      c(T0 + 7200, 104.5, 105, 103, 103.8), // bearish but above first midpoint (~102.5)
    ];
    expect(ids(detectCandlestickPatterns(baseInput(candles)))).not.toContain("evening_star");
  });

  it("never reports forming-candle stars as CONFIRMED", () => {
    const candles = [
      ...morningStarTriplet(T0).slice(0, 2),
      c(T0 + 7200, 100.5, 104, 100, 103.5, false),
    ];
    const excluded = detectCandlestickPatterns(baseInput(candles, { includeForming: false }));
    expect(ids(excluded)).not.toContain("morning_star");

    const candidate = detectCandlestickPatterns(baseInput(candles, { includeForming: true }));
    const ms = candidate.detections.find((d) => d.patternId === "morning_star");
    expect(ms?.status).toBe("CANDIDATE");
  });

  it("keeps opposing CONFIRMED stars at different window endings with distinct timestamps", () => {
    // Morning completes at T0+7200; Evening completes later (no duplicate timestamps).
    const eveningStart = T0 + 18000;
    const candles = [
      ...morningStarTriplet(T0),
      c(T0 + 10800, 103.5, 104, 103, 103.8),
      c(T0 + 14400, 103.8, 104.2, 103.5, 104),
      ...eveningStarTriplet(eveningStart),
    ];
    const result = detectCandlestickPatterns(baseInput(candles, {
      params: { scanBars: 20, maxDetections: 20 },
    }));
    const morning = result.detections.find((d) => d.patternId === "morning_star" && d.status === "CONFIRMED");
    const evening = result.detections.find((d) => d.patternId === "evening_star" && d.status === "CONFIRMED");
    expect(morning).toBeTruthy();
    expect(evening).toBeTruthy();
    expect(morning!.candleEndTime).not.toBe(evening!.candleEndTime);
    expect(morning!.candleEndTime).toBe(T0 + 7200);
    expect(evening!.candleEndTime).toBe(eveningStart + 7200);
  });

  it("attributes patterns to the requested timeframe", () => {
    const a = detectCandlestickPatterns(baseInput(morningStarTriplet(T0), { timeframe: "15m" }));
    const b = detectCandlestickPatterns(baseInput(morningStarTriplet(T0), { timeframe: "4h" }));
    expect(a.detections.find((d) => d.patternId === "morning_star")!.timeframe).toBe("15m");
    expect(b.detections.find((d) => d.patternId === "morning_star")!.timeframe).toBe("4h");
  });

  it("skips invalid OHLC near a candidate pattern without inventing fills", () => {
    const candles = [
      { time: T0, open: 105, high: 99, low: 100, close: 100 }, // invalid high < open
      c(T0 + 3600, 100, 100.8, 99.5, 100.2),
      c(T0 + 7200, 100.5, 104, 100, 103.5),
    ];
    const result = detectCandlestickPatterns(baseInput(candles as PatternCandle[]));
    expect(result.validation.skippedInvalid).toBeGreaterThanOrEqual(1);
    expect(ids(result)).not.toContain("morning_star");
  });
});

describe("Phase 47A — OpenAI evidence provenance", () => {
  it("formats pattern end timestamps and opposing-pattern warning", () => {
    const eveningStart = T0 + 18000;
    const candles = [
      ...morningStarTriplet(T0),
      c(T0 + 10800, 103.5, 104, 103, 103.8),
      c(T0 + 14400, 103.8, 104.2, 103.5, 104),
      ...eveningStarTriplet(eveningStart),
    ];
    const pack = buildForexAiEvidencePack({
      provider: "FOREXCONNECT",
      symbol: "XAUUSD",
      timeframe: "1h",
      candles,
      patternResult: detectCandlestickPatterns(baseInput(candles, {
        params: { scanBars: 20, maxDetections: 20 },
      })),
    });
    expect(pack.warnings.some((w) => /Opposing CONFIRMED patterns/i.test(w))).toBe(true);
    const text = formatEvidenceForPrompt(pack, 1200);
    expect(text).toMatch(/Morning Star/);
    expect(text).toMatch(/Evening Star/);
    expect(text).toMatch(/tf=1h/);
    expect(text).toMatch(/end=/);
    expect(text).toMatch(/historical|at-window-end/);
  });
});

describe("Phase 47A — XAU/USD contract metadata", () => {
  it("preserves PointSize+PipCost and BaseUnitSize through contractSpec", () => {
    const pip = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      metadata: {
        pointSize: 0.01,
        pipCost: 0.1,
        baseUnitSize: 1,
        mmrPerLot: 50,
        lotStep: 0.01,
        instrumentTypeLabel: "Bullion",
        quoteAsset: "USD",
      },
      instrumentTypeLabel: "Bullion",
      quoteCurrency: "USD",
    });
    expect(pip.verified).toBe(true);
    expect(pip.convention).toBe("fx_pip_cost_lot");
    expect(pip.pointSize).toBe(0.01);
    expect(pip.pipCostAccount).toBe(0.1);
    expect(pip.baseUnitSize).toBe(1);
    expect(pip.marginPerLotAccount).toBe(50);
    expect(pip.quantityStep).toBe(0.01);
  });

  it("accepts PointSize+BaseUnitSize without PipCost", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      metadata: { pointSize: 0.01, baseUnitSize: 1, quoteAsset: "USD" },
      instrumentTypeLabel: "Bullion",
    });
    expect(spec.verified).toBe(true);
    expect(spec.convention).toBe("fx_base_unit");
  });

  it("lists exact missing fields when incomplete (never invents gold ounces)", () => {
    const onlyPoint = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      metadata: { pointSize: 0.01, instrumentTypeLabel: "Bullion" },
      instrumentTypeLabel: "Bullion",
    });
    expect(onlyPoint.verified).toBe(false);
    expect(onlyPoint.unavailableReason).toMatch(/PointSize/);
    expect(onlyPoint.unavailableReason).toMatch(/need PointSize\+PipCost/i);
    expect(onlyPoint.unavailableReason).toMatch(/never invented/i);
  });

  it("rejects non-finite metadata values", () => {
    const bad = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      metadata: { pointSize: Number.NaN, pipCost: Infinity },
    });
    expect(bad.verified).toBe(false);
  });

  it("does not treat absolute mmrPerLot as a decimal marginRate", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "XAU/USD",
      metadata: {
        pointSize: 0.01,
        pipCost: 0.1,
        mmrPerLot: 75,
        MMR: 75, // legacy key must not become marginRate
      },
    });
    expect(spec.verified).toBe(true);
    expect(spec.marginRate).toBeNull();
    expect(spec.marginPerLotAccount).toBe(75);
  });

  it("wires sidecar TradingSettings fields and enrich metadata fetch", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    const provider = read("ai/market-data/forexconnect/provider.ts");
    const enrich = read("ai/forex-ai/position-sizing/enrich.ts");
    const format = read("ai/forex-ai/evidence/format-evidence.ts");
    const structure = read("ai/forex-ai/snapshot-plans/structure-from-snapshot.ts");
    expect(sidecar).toContain("baseUnitSize");
    expect(sidecar).toContain("mmrPerLot");
    expect(sidecar).toContain("trading_settings_provider");
    expect(sidecar).toContain("get_base_unit_size");
    expect(sidecar).not.toContain("get_cond_dist_entry");
    expect(sidecar).toMatch(/Never map CondDistEntry/);
    expect(provider).toContain("baseUnitSize");
    expect(provider).toContain("mmrPerLot");
    expect(enrich).toContain("resolveForexConnectMetadata");
    expect(enrich).toContain("getMarketDataService");
    expect(format).toContain("at-window-end");
    expect(structure).toContain("completedAt");
  });
});
