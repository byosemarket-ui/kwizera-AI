/**
 * Phase 4.18E — Historical movement + market evidence builder + MTF isolation.
 */
import { describe, expect, it } from "vitest";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import {
  classifyCandleGeometry,
  selectClosedMovementCandles,
  summarizeHistoricalMovement,
} from "../../../../ai/forex-ai/automated-trading/analysis/historical-movement.js";
import {
  AT_HISTORY_LOOKBACK_LIMIT,
  buildMarketEvidenceBundle,
  buildPerTimeframeEvidence,
  marketEvidenceForModelPrompt,
} from "../../../../ai/forex-ai/automated-trading/analysis/market-evidence-builder.js";

function makeTrendCandles(n: number, start = 100): StrategyCandle[] {
  const out: StrategyCandle[] = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const drift = i < n - 5 ? 0.05 : 0.9;
    const open = px;
    const close = px + drift;
    out.push({
      time: 1_700_000_000 + i * 900,
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

describe("Phase 4.18E historical movement", () => {
  it("drops forming candle and classifies geometry", () => {
    const rows = makeTrendCandles(10);
    rows.push({
      time: 1_700_000_000 + 10 * 900,
      open: 110,
      high: 111,
      low: 109,
      close: 110.5,
      closed: false,
    });
    const closed = selectClosedMovementCandles(rows);
    expect(closed.length).toBe(10);
    const g = classifyCandleGeometry(closed[closed.length - 1]!);
    expect(g?.direction).toBe("BULLISH");
  });

  it("summarizes consecutive movement without inventing data", () => {
    const summary = summarizeHistoricalMovement({
      instrument: "EUR/USD",
      timeframe: "15m",
      candles: makeTrendCandles(40, 1.1),
    });
    expect(summary.provenance).toBe("DETERMINISTIC_COMPUTED");
    expect(summary.closedCount).toBeGreaterThan(0);
    expect(summary.netReturnPct).not.toBeNull();
    expect(summary.structureHints.bias).not.toBeUndefined();
  });

  it("returns UNKNOWN acceleration with short history", () => {
    const summary = summarizeHistoricalMovement({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles: makeTrendCandles(6),
    });
    expect(summary.recentAcceleration).toBe("UNKNOWN");
  });
});

describe("Phase 4.18E market evidence builder", () => {
  it("builds per-timeframe evidence with SMA_OF_TR and structure", () => {
    const per = buildPerTimeframeEvidence({
      instrument: "XAU/USD",
      timeframe: "15m",
      candles: makeTrendCandles(40),
      pointSize: 0.01,
    });
    expect(per.available).toBe(true);
    expect(per.indicators?.atrMethod).toBe("SMA_OF_TR");
    expect(per.movement?.instrument).toBe("XAU/USD");
    expect(per.structure?.provenance).toBe("DETERMINISTIC_COMPUTED");
  });

  it("isolates instruments and discloses unavailable volume/order book", () => {
    const eur = makeTrendCandles(40, 1.08);
    const xau = makeTrendCandles(40, 2600);
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      candlesByTf: {
        "15m": eur,
        "1h": eur.slice(0, 35),
      },
      quote: {
        instrument: "EUR/USD",
        bid: 1.08,
        ask: 1.0802,
        quoteFresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        effectivePriceChangeAgeMs: 200,
        snapshotFingerprint: "e",
        evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
      },
      pointSize: 0.00001,
    });
    expect(bundle.identity.instrument).toBe("EUR/USD");
    expect(bundle.historical.primary?.instrument).toBe("EUR/USD");
    expect(bundle.instrumentMeta.volume.value).toBeNull();
    expect(bundle.instrumentMeta.volume.status).toBe("UNAVAILABLE");
    expect(bundle.instrumentMeta.orderBook.status).toBe("UNAVAILABLE");
    expect(bundle.instrumentMeta.economicCalendar.status).toBe("UNAVAILABLE");
    expect(bundle.placesOrders).toBe(false);
    expect(bundle.quality.missing).toContain("tick_volume");
    // Ensure XAU candles were not included
    expect(xau[0]!.close).not.toBe(eur[0]!.close);
    expect(AT_HISTORY_LOOKBACK_LIMIT).toBe(300);
  });

  it("marks MTF insufficient when only primary has bias", () => {
    const candles = makeTrendCandles(10);
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": candles },
      quote: {
        instrument: "XAU/USD",
        bid: 2650,
        ask: 2651,
        quoteFresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        effectivePriceChangeAgeMs: 100,
        snapshotFingerprint: "x",
        evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
      },
      pointSize: 0.01,
    });
    expect(["INSUFFICIENT", "UNKNOWN"]).toContain(bundle.multiTimeframe.agreement);
  });

  it("model prompt does not invent unavailable fields", () => {
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": makeTrendCandles(40) },
      quote: {
        instrument: "XAU/USD",
        bid: 2650,
        ask: 2651,
        quoteFresh: false,
        freshnessReasonCode: "HEARTBEAT_ONLY_NO_PRICE_CHANGE",
        effectivePriceChangeAgeMs: null,
        snapshotFingerprint: null,
        evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
      },
      pointSize: 0.01,
    });
    const prompt = marketEvidenceForModelPrompt(bundle);
    expect(prompt.instrumentMeta).toMatchObject({
      volume: null,
      orderBook: null,
      economicCalendar: null,
    });
    expect(String(prompt.analysisAuthorityNote)).toMatch(/advisory/i);
  });

  it("timeframe arrays stay isolated in bundle", () => {
    const m15 = makeTrendCandles(40, 100);
    const h1 = makeTrendCandles(40, 200);
    const bundle = buildMarketEvidenceBundle({
      environment: "DEMO",
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": m15, "1h": h1 },
      quote: {
        instrument: "XAU/USD",
        bid: 2650,
        ask: 2651,
        quoteFresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        effectivePriceChangeAgeMs: 50,
        snapshotFingerprint: "z",
        evaluatedAtUtc: "2026-11-01T12:00:00.000Z",
      },
      pointSize: 0.01,
    });
    const p15 = bundle.historical.byTimeframe.find((t) => t.timeframe === "15m");
    const p1h = bundle.historical.byTimeframe.find((t) => t.timeframe === "1h");
    expect(p15?.movement?.firstOpenSec).not.toBeNull();
    expect(p1h?.movement?.netReturnPct).not.toEqual(p15?.movement?.netReturnPct);
  });
});
