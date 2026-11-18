import { describe, expect, it } from "vitest";
import {
  HfmLiveCandleEngine,
  HFM_VERIFIED_LIVE_TFS,
  isValidHfmTick,
  normalizeTickStream,
  resolveFormingBucket,
  timeframeSeconds,
} from "../../../../ai/market-data/mt5-hfm/live-candle-engine";
import {
  validateHfmChartDrawing,
  validateHfmChartTemplate,
  HfmChartsWorkspaceStore,
} from "../../../../ai/market-data/mt5-hfm/charts-workspace-store";
import {
  aggregateBidSequence,
  applyBidToFormingCandle,
  formatHfmSpread,
  isLiveFormingTimeframe,
} from "../../../../desktop/forex/hfm-dashboard/charts/live-forming";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../../../..");
function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

function tick(symbol: string, bid: number, timeSec: number, ask = bid + 0.2) {
  return {
    symbol,
    bid,
    ask,
    last: null,
    timeSec,
    timeMsc: timeSec * 1000,
    receiveMs: timeSec * 1000,
    volume: null,
    flags: null,
    acquisition: "test" as const,
  };
}

describe("STEP 3 multi-TF live forming candles", () => {
  it("OHLC fixture: open stable, high/low/close update from Bid sequence", () => {
    const forming = aggregateBidSequence([100.0, 100.2, 99.9, 100.1], "H4", 1_700_000_000);
    expect(forming).not.toBeNull();
    expect(forming!.open).toBe(100.0);
    expect(forming!.high).toBe(100.2);
    expect(forming!.low).toBe(99.9);
    expect(forming!.close).toBe(100.1);
  });

  it("aggregates H4 forming from bids without resetting open", () => {
    const eng = new HfmLiveCandleEngine();
    const anchor = 1_700_000_000;
    eng.seedFromHistory("XAUUSD", "H4", [
      { time: anchor, open: 100, high: 100, low: 100, close: 100, tickVolume: 1, realVolume: null, spread: null },
    ]);
    eng.applyTick(tick("XAUUSD", 100.2, anchor + 60), "H4");
    eng.applyTick(tick("XAUUSD", 99.9, anchor + 120), "H4");
    eng.applyTick(tick("XAUUSD", 100.1, anchor + 180), "H4");
    const f = eng.getForming("XAUUSD", "H4");
    expect(f?.time).toBe(anchor);
    expect(f?.open).toBe(100);
    expect(f?.high).toBe(100.2);
    expect(f?.low).toBe(99.9);
    expect(f?.close).toBe(100.1);
  });

  it("finalizes previous bucket and opens new one on H4 boundary", () => {
    const eng = new HfmLiveCandleEngine();
    const anchor = 1_700_000_000;
    eng.seedFromHistory("XAUUSD", "H4", [
      { time: anchor, open: 100, high: 101, low: 99, close: 100.5, tickVolume: 5, realVolume: null, spread: null },
    ]);
    const sec = timeframeSeconds("H4")!;
    const events = eng.applyTick(tick("XAUUSD", 102, anchor + sec + 10), "H4");
    expect(events.some((e) => e.type === "candle_finalized")).toBe(true);
    expect(eng.getForming("XAUUSD", "H4")?.time).toBe(anchor + sec);
    expect(eng.getForming("XAUUSD", "H4")?.open).toBe(102);
  });

  it("covers every verified live timeframe with multi-tick OHLC", () => {
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      const eng = new HfmLiveCandleEngine();
      const t0 = 1_710_000_000;
      eng.seedFromHistory("EURUSD", tf, [
        { time: t0, open: 1.1, high: 1.1, low: 1.1, close: 1.1, tickVolume: 1, realVolume: null, spread: null },
      ]);
      eng.applyTick(tick("EURUSD", 1.12, t0 + 5, 1.1202), tf);
      eng.applyTick(tick("EURUSD", 1.09, t0 + 10, 1.0902), tf);
      eng.applyTick(tick("EURUSD", 1.11, t0 + 15, 1.1102), tf);
      const f = eng.getForming("EURUSD", tf);
      expect(f?.open).toBe(1.1);
      expect(f?.high).toBe(1.12);
      expect(f?.low).toBe(1.09);
      expect(f?.close).toBe(1.11);
    }
  });

  it("isolates symbols and timeframes", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_720_000_000;
    eng.applyTick(tick("EURUSD", 1.1, t0), "M5");
    eng.applyTick(tick("GBPUSD", 1.3, t0), "M5");
    eng.applyTick(tick("EURUSD", 1.2, t0 + 1), "H1");
    expect(eng.getForming("EURUSD", "M5")?.close).toBe(1.1);
    expect(eng.getForming("GBPUSD", "M5")?.close).toBe(1.3);
    expect(eng.getForming("EURUSD", "H1")?.close).toBe(1.2);
  });

  it("rejects invalid / duplicate ticks", () => {
    expect(isValidHfmTick({ bid: 1, ask: 0.5, timeSec: 1 })).toBe(false);
    const eng = new HfmLiveCandleEngine();
    const t = tick("XAUUSD", 2000, 100);
    expect(eng.applyTick(t, "M1").length).toBeGreaterThan(0);
    expect(eng.applyTick(t, "M1")).toEqual([]);
    const norm = normalizeTickStream([t, { ...t, receiveMs: t.receiveMs + 1 }]);
    expect(norm).toHaveLength(1);
  });

  it("broker-aligned bucket uses CopyRates anchor (not UTC floor alone)", () => {
    // H4 broker bar that is not on a UTC 14400 boundary.
    const anchor = 1_700_001_234;
    const bucket = resolveFormingBucket(anchor + 500, "H4", anchor);
    expect(bucket).toBe(anchor);
    expect(isLiveFormingTimeframe("H4")).toBe(true);
    expect(isLiveFormingTimeframe("H2")).toBe(false);
  });

  it("applyTickVerifiedTimeframes updates all verified TFs", () => {
    const eng = new HfmLiveCandleEngine();
    const t0 = 1_730_000_000;
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      eng.seedFromHistory("XAUUSD", tf, [
        { time: t0, open: 1900, high: 1900, low: 1900, close: 1900, tickVolume: 1, realVolume: null, spread: null },
      ]);
    }
    eng.applyTickVerifiedTimeframes(tick("XAUUSD", 1901.5, t0 + 30, 1901.7));
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      expect(eng.getForming("XAUUSD", tf)?.close).toBe(1901.5);
    }
  });

  it("frontend applyBidToFormingCandle mirrors engine OHLC contract", () => {
    let f = applyBidToFormingCandle(null, 100, 1000, "M15", { anchorTime: 900 });
    f = applyBidToFormingCandle(f, 100.2, 1001, "M15", { anchorTime: 900 });
    f = applyBidToFormingCandle(f, 99.9, 1002, "M15", { anchorTime: 900 });
    f = applyBidToFormingCandle(f, 100.1, 1003, "M15", { anchorTime: 900 });
    expect(f?.open).toBe(100);
    expect(f?.high).toBe(100.2);
    expect(f?.low).toBe(99.9);
    expect(f?.close).toBe(100.1);
  });

  it("formats spread without float artifacts", () => {
    expect(formatHfmSpread(0.3400000000001455, 2)).toBe("0.34");
    expect(formatHfmSpread(0.00012, 5)).toBe("0.00012");
  });

  it("hub + frontend no longer gate live candles to M1 only", () => {
    const hub = read("ai/market-data/mt5-hfm/realtime-hub.ts");
    const hook = read("desktop/forex/hfm-dashboard/charts/use-hfm-chart-data.ts");
    expect(hub).toContain("applyTickVerifiedTimeframes");
    expect(hub).not.toMatch(/applyTick\(\s*\{[\s\S]*?\},\s*"M1"\s*\)/);
    expect(hook).toContain("applyBidToFormingCandle");
    expect(hook).not.toContain('timeframe === "M1" && sq.bid');
  });
});

describe("STEP 3 drawings + templates persistence", () => {
  it("validates drawings and rejects corrupt payloads", () => {
    expect(validateHfmChartDrawing(null)).toBeNull();
    expect(
      validateHfmChartDrawing({
        id: "d1",
        tool: "hline",
        symbol: "xauusd",
        timeframe: "h4",
        color: "#fff",
        lineWidth: 2,
        lineStyle: "solid",
        visible: true,
        price: 1900,
      })?.symbol,
    ).toBe("XAUUSD");
    expect(
      validateHfmChartDrawing({
        id: "bad",
        tool: "trendline",
        symbol: "EURUSD",
        timeframe: "M15",
        a: { time: 1 },
      }),
    ).toBeNull();
  });

  it("validates templates without storing candle series", () => {
    const tpl = validateHfmChartTemplate({
      id: "t1",
      name: "Default",
      chartType: "candlestick",
      showGrid: true,
      indicators: [{ kind: "ema", period: 50, bars: [1, 2, 3] }],
    });
    expect(tpl?.name).toBe("Default");
    expect(tpl?.indicators[0]).not.toHaveProperty("bars");
  });

  it("persists drawings and templates to workspace store", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hfm-charts-"));
    try {
      const store = new HfmChartsWorkspaceStore(dir);
      await store.putDrawingsForScope("XAUUSD", "H4", [
        {
          id: "d1",
          tool: "hline",
          symbol: "XAUUSD",
          timeframe: "H4",
          color: "#8b5cf6",
          lineWidth: 1,
          lineStyle: "solid",
          visible: true,
          price: 2000,
        },
      ]);
      const listed = await store.listDrawings("XAUUSD", "H4");
      expect(listed).toHaveLength(1);
      expect(await store.listDrawings("EURUSD", "H4")).toHaveLength(0);

      const tpl = await store.upsertTemplate({
        id: "tpl1",
        name: "Scalp",
        chartType: "ohlc",
        showGrid: false,
        indicators: [{ id: "rsi-14", kind: "rsi", period: 14, visible: true }],
        isDefault: true,
      });
      expect(tpl?.name).toBe("Scalp");
      expect((await store.load()).defaultTemplateId).toBe("tpl1");
      await store.renameTemplate("tpl1", "Scalp v2");
      expect((await store.listTemplates())[0]?.name).toBe("Scalp v2");
      expect(await store.deleteTemplate("tpl1")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("API exposes charts drawings/templates routes", () => {
    const api = read("dev/server/mt5-hfm-api.ts");
    expect(api).toContain("/charts/drawings");
    expect(api).toContain("/charts/templates");
    expect(api).toContain("reconcileWithHistory");
  });
});
