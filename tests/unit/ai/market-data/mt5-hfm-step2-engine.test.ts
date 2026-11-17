import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HfmLiveCandleEngine,
  normalizeTickStream,
  isValidHfmTick,
} from "../../../../ai/market-data/mt5-hfm/live-candle-engine";
import { validateAndNormalizeBars } from "../../../../ai/market-data/mt5-hfm/historical-engine";
import { buildHfmChartsAnalysisSnapshot } from "../../../../ai/market-data/mt5-hfm/charts-analysis-contract";
import { MT5_HFM_AGENT_METHODS } from "../../../../ai/market-data/mt5-hfm/agent-protocol";
import { MT5_HFM_SSE_EVENT_TYPES } from "../../../../ai/market-data/mt5-hfm/event-contract";

const root = resolve(__dirname, "../../../..");
function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("STEP 2 HFM market data engine", () => {
  it("Expert source is v1.40 with on-demand CopyRates/CopyTicks and OnTick", () => {
    const mq5 = read("services/mt5-hfm-agent/mql5/KwizeraReadonlySnapshot.mq5");
    expect(mq5).toContain('#property version   "1.40"');
    expect(mq5).toContain("ProcessHistoryRequest");
    expect(mq5).toContain("CopyRates");
    expect(mq5).toContain("CopyTicks");
    expect(mq5).toContain("WriteChartTick");
    expect(mq5).not.toMatch(/OrderSend\s*\(/);
  });

  it("agent protocol allows ticks / quote_watch / chart_tick", () => {
    expect(MT5_HFM_AGENT_METHODS).toContain("demo.ticks");
    expect(MT5_HFM_AGENT_METHODS).toContain("demo.quote_watch");
    expect(MT5_HFM_AGENT_METHODS).toContain("demo.chart_tick");
    const proto = read("services/mt5-hfm-agent/protocol.py");
    expect(proto).toContain('"demo.ticks"');
    const control = read("services/mt5-hfm-agent/mt5_control.py");
    expect(control).toContain("def _ondemand_copyrates");
    expect(control).toContain("def ticks(");
    expect(control).toContain("HISTORY_REQUEST_NAME");
  });

  it("validates OHLC and rejects duplicates / inverted ranges", () => {
    const { bars, rejected } = validateAndNormalizeBars([
      { time: 100, open: 1.1, high: 1.2, low: 1.0, close: 1.15, tickVolume: 3 },
      { time: 100, open: 1.1, high: 1.2, low: 1.0, close: 1.15 },
      { time: 160, open: 1.15, high: 1.1, low: 1.2, close: 1.12 },
      { time: 220, open: 1.12, high: 1.18, low: 1.11, close: 1.16 },
    ]);
    expect(bars.map((b) => b.time)).toEqual([100, 220]);
    expect(rejected).toBe(2);
  });

  it("aggregates bid ticks into M1 candles and finalizes on boundary", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_700_000_000;
    const ev1 = eng.applyTick(
      {
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1002,
        last: null,
        timeSec: t0 + 10,
        timeMsc: (t0 + 10) * 1000,
        receiveMs: Date.now(),
        volume: 1,
        flags: null,
        acquisition: "test",
      },
      "M1",
    );
    expect(ev1.some((e) => e.type === "candle_update")).toBe(true);
    const ev2 = eng.applyTick(
      {
        symbol: "EURUSD",
        bid: 1.12,
        ask: 1.1202,
        last: null,
        timeSec: t0 + 70,
        timeMsc: (t0 + 70) * 1000,
        receiveMs: Date.now(),
        volume: 1,
        flags: null,
        acquisition: "test",
      },
      "M1",
    );
    expect(ev2.some((e) => e.type === "candle_finalized")).toBe(true);
    expect(eng.getForming("EURUSD", "M1")?.open).toBe(1.12);
  });

  it("deduplicates ticks and rejects invalid bid/ask", () => {
    expect(isValidHfmTick({ bid: 1, ask: 0.9, timeSec: 1 })).toBe(false);
    const ticks = normalizeTickStream([
      {
        symbol: "XAUUSD",
        bid: 2000,
        ask: 2000.5,
        last: null,
        timeSec: 10,
        timeMsc: 10000,
        receiveMs: 1,
        volume: null,
        flags: null,
        acquisition: "CopyTicks",
      },
      {
        symbol: "XAUUSD",
        bid: 2000,
        ask: 2000.5,
        last: null,
        timeSec: 10,
        timeMsc: 10000,
        receiveMs: 2,
        volume: null,
        flags: null,
        acquisition: "CopyTicks",
      },
    ]);
    expect(ticks).toHaveLength(1);
  });

  it("analysis contract builder stays read-only HFM_MT5", () => {
    const snap = buildHfmChartsAnalysisSnapshot({
      symbol: "eurusd",
      timeframe: "M15",
      historicalCandles: [{ time: 1, open: 1, high: 2, low: 0.5, close: 1.5, tickVolume: 1, realVolume: null, spread: 1 }],
      freshness: "LIVE",
      validationStatus: "ok",
      sourceProvenance: "mql5_ondemand_copyrates",
    });
    expect(snap.provider).toBe("HFM_MT5");
    expect(snap.placesOrders).toBe(false);
    expect(snap.mutatesBroker).toBe(false);
    expect(snap.acceptsForExecution).toBe(false);
  });

  it("SSE contract includes tick and candle incremental events", () => {
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("tick");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("candle_update");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("candle_finalized");
    expect(MT5_HFM_SSE_EVENT_TYPES).toContain("history_synchronized");
  });

  it("API exposes STEP 2 market routes", () => {
    const api = read("dev/server/mt5-hfm-api.ts");
    expect(api).toContain("/market/ticks");
    expect(api).toContain("/market/quote-watch");
    expect(api).toContain("/market/live-candle");
    expect(api).toContain("/market/analysis-snapshot");
    expect(api).toContain("fetchHfmHistoricalCandles");
  });
});
