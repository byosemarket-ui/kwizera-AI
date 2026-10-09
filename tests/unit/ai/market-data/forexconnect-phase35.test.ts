/**
 * Phase 35 — ForexConnect live quotes + forming candles (mocked; not live SDK proof).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  applyFcBidPriceToCandles,
  fcCandleBucketStartSec,
  fcCandlePriceFromQuote,
  FOREXCONNECT_STALE_MS,
  formingCandleOf,
  historicalToFcLiveCandle,
  mergeHistoricalWithFcLiveCandles,
  normalizeFcOfferQuote,
} from "../../../../ai/market-data/forexconnect/live-candle-sync.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

const identity = {
  marketType: "FOREX" as const,
  providerSymbol: "EUR/USD",
  canonicalSymbol: "EURUSD",
  timeframe: "1h" as const,
};

describe("Phase 35 quote normalization", () => {
  it("normalizes bid/ask and derives mid only when both valid", () => {
    const q = normalizeFcOfferQuote({
      providerSymbol: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      offerId: "1",
    });
    expect(q).not.toBeNull();
    expect(q!.candlePrice).toBe(1.1);
    expect(q!.mid).toBeCloseTo(1.1001, 5);
    expect(fcCandlePriceFromQuote(null)).toBeNull();
    expect(fcCandlePriceFromQuote(0)).toBeNull();
  });

  it("preserves provider identity and rejects empty symbols", () => {
    expect(normalizeFcOfferQuote({ bid: 1 })).toBeNull();
    const q = normalizeFcOfferQuote({ instrument: "GBP/USD", bid: 1.25, ask: 1.2501 });
    expect(q!.canonicalSymbol).toBe("GBPUSD");
    expect(q!.providerSymbol).toBe("GBP/USD");
  });
});

describe("Phase 35 forming candle aggregation", () => {
  it("updates OHLC in the same bucket and opens a new bucket on boundary", () => {
    const t0 = Date.parse("2026-01-01T12:00:00Z");
    const bucket = fcCandleBucketStartSec(t0, "1h");
    let series = applyFcBidPriceToCandles([], 1.10, t0, identity, t0).candles;
    expect(series).toHaveLength(1);
    expect(series[0]!.time).toBe(bucket);
    series = applyFcBidPriceToCandles(series, 1.12, t0 + 60_000, identity, t0 + 60_000).candles;
    expect(series).toHaveLength(1);
    expect(series[0]!.high).toBe(1.12);
    expect(series[0]!.low).toBe(1.10);
    expect(series[0]!.close).toBe(1.12);
    expect(series[0]!.priceBasis).toBe("bid");

    const nextHour = t0 + 3_600_000;
    series = applyFcBidPriceToCandles(series, 1.13, nextHour, identity, nextHour).candles;
    expect(series).toHaveLength(2);
    expect(series[0]!.closed).toBe(true);
    expect(series[1]!.open).toBe(1.13);
    expect(formingCandleOf(series)?.time).toBe(fcCandleBucketStartSec(nextHour, "1h"));
  });

  it("ignores out-of-order ticks and closed-candle mutations", () => {
    const t0 = Date.parse("2026-01-01T12:00:00Z");
    let series = applyFcBidPriceToCandles([], 1.1, t0, identity, t0).candles;
    series = series.map((c) => ({ ...c, closed: true }));
    const ignored = applyFcBidPriceToCandles(series, 1.2, t0 + 1000, identity, t0 + 1000);
    expect(ignored.applied).toBe(false);
    expect(ignored.reason).toBe("closed_candle_immutable");

    const open = applyFcBidPriceToCandles([], 1.1, t0 + 3_600_000, identity, t0 + 3_600_000).candles;
    const ooo = applyFcBidPriceToCandles(open, 1.0, t0, identity, t0);
    expect(ooo.applied).toBe(false);
    expect(ooo.reason).toBe("out_of_order_bucket");
  });

  it("merges historical baseline with live forming without inventing gaps", () => {
    const t0 = Date.parse("2026-01-01T11:00:00Z") / 1000;
    const hist = [historicalToFcLiveCandle({
      time: t0,
      open: 1.0,
      high: 1.1,
      low: 0.9,
      close: 1.05,
      volume: null,
      closed: true,
      priceBasis: "bid",
    }, identity)];
    const liveOpenMs = Date.parse("2026-01-01T12:00:00Z");
    const live = applyFcBidPriceToCandles([], 1.2, liveOpenMs, identity, liveOpenMs).candles;
    const merged = mergeHistoricalWithFcLiveCandles(hist, live, liveOpenMs + 1000, "1h");
    expect(merged).toHaveLength(2);
    expect(merged[0]!.closed).toBe(true);
    expect(merged[1]!.close).toBe(1.2);
  });

  it("documents stale threshold", () => {
    expect(FOREXCONNECT_STALE_MS).toBe(15_000);
  });
});

describe("Phase 35 files and routes", () => {
  it("wires Offers subscribe path and Admin live controls", () => {
    const sidecar = read("services/forexconnect-sidecar/server.py");
    const api = read("dev/server/forexconnect-api.ts");
    const page = read("desktop/forex-admin/ForexAdminForexConnectPage.tsx");
    const charts = read("desktop/forex/market-data/use-unified-candles.ts");
    expect(sidecar).toContain("subscribe_table_updates");
    expect(sidecar).toContain("/subscribe");
    expect(sidecar).toContain("/stream/status");
    expect(api).toContain("/api/forex/providers/forexconnect/subscribe");
    expect(api).toContain("/api/forex/providers/forexconnect/stream/status");
    expect(page).toContain("Test live subscribe");
    expect(charts).toContain('nextProvider === "FXCM" || nextProvider === "FOREXCONNECT"');
    expect(sidecar).not.toContain("place_order");
  });
});
