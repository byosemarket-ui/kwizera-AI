import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HfmChartsWorkspaceStore,
  validateHfmChartDrawing,
  validateHfmChartPreferences,
  validateHfmChartTemplate,
} from "../../../../ai/market-data/mt5-hfm/charts-workspace-store";
import { buildHfmChartsAnalysisSnapshot } from "../../../../ai/market-data/mt5-hfm/charts-analysis-contract";

const root = resolve(__dirname, "../../../..");
function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("STEP 4 charts persistence + analysis contract", () => {
  it("rejects invalid drawings and preserves valid types", () => {
    expect(validateHfmChartDrawing({ id: "x", tool: "hline" })).toBeNull();
    for (const tool of [
      "hline",
      "vline",
      "trendline",
      "rectangle",
      "text",
      "channel",
      "fib_retracement",
      "fib_extension",
    ]) {
      const base = {
        id: `d-${tool}`,
        tool,
        symbol: "EURUSD",
        timeframe: "M15",
        color: "#fff",
        lineWidth: 1,
        lineStyle: "solid",
        visible: true,
      };
      let payload: Record<string, unknown> = { ...base };
      if (tool === "hline") payload = { ...base, price: 1.1 };
      else if (tool === "vline") payload = { ...base, time: 100 };
      else if (tool === "text") payload = { ...base, point: { time: 1, price: 1 }, text: "note" };
      else if (tool === "channel") {
        payload = {
          ...base,
          a: { time: 1, price: 1 },
          b: { time: 2, price: 2 },
          offsetPrice: 0.1,
        };
      } else if (tool === "fib_extension") {
        payload = {
          ...base,
          a: { time: 1, price: 1 },
          b: { time: 2, price: 2 },
          c: { time: 3, price: 1.5 },
        };
      } else {
        payload = { ...base, a: { time: 1, price: 1 }, b: { time: 2, price: 2 } };
      }
      expect(validateHfmChartDrawing(payload)?.tool).toBe(tool);
    }
  });

  it("drawing save is symbol/timeframe isolated and revision-conflict safe", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hfm-s4-"));
    try {
      const store = new HfmChartsWorkspaceStore(dir);
      const a = await store.putDrawingsForScope("XAUUSD", "H4", [
        {
          id: "d1",
          tool: "hline",
          symbol: "XAUUSD",
          timeframe: "H4",
          color: "#8b5cf6",
          lineWidth: 1,
          lineStyle: "solid",
          visible: true,
          price: 1900,
        },
      ]);
      expect(a.conflict).toBe(false);
      await store.putDrawingsForScope("XAUUSD", "M15", [
        {
          id: "d2",
          tool: "vline",
          symbol: "XAUUSD",
          timeframe: "M15",
          color: "#8b5cf6",
          lineWidth: 1,
          lineStyle: "solid",
          visible: true,
          time: 100,
        },
      ]);
      expect(await store.listDrawings("XAUUSD", "H4")).toHaveLength(1);
      expect(await store.listDrawings("XAUUSD", "M15")).toHaveLength(1);
      expect(await store.listDrawings("EURUSD", "H4")).toHaveLength(0);

      const conflict = await store.putDrawingsForScope("XAUUSD", "H4", [], 0);
      expect(conflict.conflict).toBe(true);
      expect(conflict.drawings).toHaveLength(1);

      const ok = await store.putDrawingsForScope("XAUUSD", "H4", [], a.revision);
      expect(ok.conflict).toBe(false);
      expect(ok.drawings).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("templates and preferences persist without market series", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hfm-s4p-"));
    try {
      const store = new HfmChartsWorkspaceStore(dir);
      const tpl = await store.upsertTemplate({
        id: "t1",
        name: "Swing",
        chartType: "candlestick",
        showGrid: true,
        indicators: [{ id: "ema-50", kind: "ema", period: 50, bars: [1, 2] }],
        isDefault: true,
      });
      expect(tpl?.name).toBe("Swing");
      expect(tpl?.indicators[0]).not.toHaveProperty("bars");
      expect((await store.load()).defaultTemplateId).toBe("t1");
      await store.renameTemplate("t1", "Swing v2");
      expect((await store.listTemplates())[0]?.name).toBe("Swing v2");

      const prefs = await store.putPreferences({
        chartType: "ohlc",
        showGrid: false,
        defaultTimeframe: "H1",
        lastSymbol: "EURUSD",
        indicators: [{ id: "rsi", kind: "rsi", period: 14, candles: [] }],
      });
      expect(prefs.conflict).toBe(false);
      expect(prefs.preferences.chartType).toBe("ohlc");
      expect(prefs.preferences.indicators[0]).not.toHaveProperty("candles");
      const conflict = await store.putPreferences(
        { ...prefs.preferences, chartType: "line" },
        0,
      );
      expect(conflict.conflict).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("analysis contract is read-only HFM with independent-timeframe flag", () => {
    const snap = buildHfmChartsAnalysisSnapshot({
      symbol: "xauusd",
      timeframe: "H4",
      historicalCandles: [],
      freshness: "LIVE",
      validationStatus: "ok",
      sourceProvenance: "test",
      bid: 100,
      ask: 100.34,
      connectionStatus: "CONNECTED",
      indicatorValues: [{ id: "rsi-14", name: "RSI", value: 40 }],
    });
    expect(snap.provider).toBe("HFM_MT5");
    expect(snap.placesOrders).toBe(false);
    expect(snap.mutatesBroker).toBe(false);
    expect(snap.acceptsForExecution).toBe(false);
    expect(snap.analysisMayRequestIndependentTimeframe).toBe(true);
    expect(snap.unsupportedTimeframe).toBe(false);
    expect(buildHfmChartsAnalysisSnapshot({
      symbol: "EURUSD",
      timeframe: "H2",
      historicalCandles: [],
      freshness: "WAITING_FOR_DATA",
      validationStatus: "unavailable",
      sourceProvenance: "test",
    }).unsupportedTimeframe).toBe(true);
  });

  it("API exposes preferences route and concurrency hooks", () => {
    const api = read("dev/server/mt5-hfm-api.ts");
    expect(api).toContain("/charts/preferences");
    expect(api).toContain("REVISION_CONFLICT");
    expect(api).toContain("expectedRevision");
    const store = read("ai/market-data/mt5-hfm/charts-workspace-store.ts");
    expect(store).toContain("putPreferences");
    expect(store).toContain("drawingRevisions");
    expect(validateHfmChartPreferences({ chartType: "area", showGrid: true, defaultTimeframe: "M5" })?.chartType).toBe("area");
    expect(validateHfmChartTemplate({ id: "x", name: "y", chartType: "bad" })).toBeNull();
  });
});
