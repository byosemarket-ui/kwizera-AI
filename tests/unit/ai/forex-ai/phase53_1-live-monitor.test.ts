/**
 * Phase 53.1 — Persistent monitoring, candle-close schedule, server chart, vision gating.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  AT_MONITOR_TIMEFRAMES,
  AtMonitorStore,
  AtMonitorWorker,
  candleCloseTimeSec,
  isCandleClosed,
  latestClosedCandleOpenSec,
  nextCandleCloseUtc,
  parseAtMonitorTimeframe,
  renderAtMarketChartPng,
  resetAtMonitorStoreForTests,
  resetAtMonitorWorkerForTests,
  scheduledAnalysisDedupeKey,
  AUTOMATED_EXECUTION_BANNER,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import { isOpenAiVisionEligibleModel } from "../../../../ai/forex-ai/multi-image-openai/vision-policy.ts";
import { buildOpenAiMultimodalChatJsonBody } from "../../../../ai/forex-ai/snapshot-openai/openai-client.ts";
import { decodePngRgba } from "../../../../ai/creative-workspace/png-pixels.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function sampleCandles(n: number, periodSec: number, base = 1.1) {
  const t0 = Math.floor(Date.now() / 1000) - n * periodSec - periodSec;
  return Array.from({ length: n }, (_, i) => {
    const c = base + i * 0.0001;
    return {
      time: t0 + i * periodSec,
      open: c,
      high: c + 0.0005,
      low: c - 0.0005,
      close: c + 0.0002,
      isClosed: true as const,
    };
  });
}

describe("Phase 53.1 timeframes & scheduling", () => {
  it("supports verified FC timeframes and rejects H2", () => {
    expect(AT_MONITOR_TIMEFRAMES).toEqual(["5m", "15m", "30m", "1h"]);
    expect(parseAtMonitorTimeframe("M15")).toBe("15m");
    expect(parseAtMonitorTimeframe("H1")).toBe("1h");
    expect(parseAtMonitorTimeframe("H2")).toBeNull();
    expect(parseAtMonitorTimeframe("2h")).toBeNull();
  });

  it("computes candle close boundaries and ignores incomplete candles", () => {
    const open = 1_700_000_000; // aligned-ish
    const close = candleCloseTimeSec(open, "5m");
    expect(close - open).toBe(300);
    expect(isCandleClosed(open, "5m", open * 1000 + 100_000)).toBe(false);
    expect(isCandleClosed(open, "5m", close * 1000)).toBe(true);

    const opens = [open, open + 300, open + 600];
    const nowMs = (open + 600 + 100) * 1000; // forming last candle
    const latest = latestClosedCandleOpenSec(opens, "5m", nowMs);
    expect(latest?.openTimeSec).toBe(open + 300);

    const next = nextCandleCloseUtc("1h", Date.parse("2024-01-01T12:30:00Z"));
    expect(next).toBe("2024-01-01T13:00:00.000Z");
  });

  it("dedupes scheduled analyses per closed candle + config epoch", () => {
    const a = scheduledAnalysisDedupeKey({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      closedCandleOpenSec: 100,
      configEpoch: 2,
    });
    const b = scheduledAnalysisDedupeKey({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      closedCandleOpenSec: 100,
      configEpoch: 2,
    });
    const c = scheduledAnalysisDedupeKey({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      closedCandleOpenSec: 100,
      configEpoch: 3,
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("Phase 53.1 chart render & vision request", () => {
  it("renders a server PNG from OHLC and associates image hash", () => {
    const rendered = renderAtMarketChartPng({
      instrument: "EUR/USD",
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: sampleCandles(40, 900),
      observationUtc: "2024-01-01T12:00:00.000Z",
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.source).toBe("server-ohlc-render");
    expect(rendered.mimeType).toBe("image/png");
    expect(rendered.imageHash.length).toBeGreaterThan(8);
    const decoded = decodePngRgba(rendered.png);
    expect(decoded?.width).toBe(rendered.width);
    expect(decoded?.height).toBe(rendered.height);
  });

  it("includes image_url parts in multimodal OpenAI body when vision-eligible", () => {
    expect(isOpenAiVisionEligibleModel("gpt-6-luna")).toBe(true);
    expect(isOpenAiVisionEligibleModel("gpt-3.5-turbo")).toBe(false);
    const body = buildOpenAiMultimodalChatJsonBody({
      model: "gpt-6-luna",
      system: "sys",
      userText: "user",
      images: [{ mimeType: "image/png", base64: "AAAA" }],
    });
    const messages = body.messages as Array<{ role: string; content: unknown }>;
    const user = messages.find((m) => m.role === "user");
    expect(Array.isArray(user?.content)).toBe(true);
    const parts = user?.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(parts.some((p) => p.type === "image_url" && p.image_url?.url.includes("base64,AAAA"))).toBe(true);
  });
});

describe("Phase 53.1 monitor persistence & duplicate prevention", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p531-"));
    resetAtMonitorStoreForTests();
    resetAtMonitorWorkerForTests();
  });

  afterEach(() => {
    resetAtMonitorWorkerForTests();
    resetAtMonitorStoreForTests();
  });

  it("persists enabled config and restores after new store instance", async () => {
    const store = new AtMonitorStore(tmp);
    await store.update((s) => ({
      ...s,
      config: {
        enabled: true,
        environment: "DEMO",
        instrument: "EUR/USD",
        timeframe: "15m",
        configEpoch: 1,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
        pollIntervalMs: 20_000,
      },
    }));
    expect(store.getState().config?.enabled).toBe(true);
    const persistedPath = path.join(tmp, "forex-automated-trading", "monitoring.json");
    expect(fs.existsSync(persistedPath)).toBe(true);
    resetAtMonitorStoreForTests();
    const reloaded = new AtMonitorStore(tmp);
    expect(reloaded.getState().config?.enabled).toBe(true);
    expect(reloaded.getState().config?.instrument).toBe("EUR/USD");
    expect(reloaded.getState().health.workerActive).toBe(false); // never trust persisted active
  });

  it("start/stop and instrument change bump config epoch; only one enabled config", async () => {
    const worker = new AtMonitorWorker({
      storageRoot: tmp,
      autoStart: false,
      loadCandles: async () => sampleCandles(40, 900),
    });
    const started = await worker.start({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
      expectedEnvironmentEpoch: 1,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.status.config?.configEpoch).toBe(1);
    expect(started.status.requiresBrowserOpen).toBe(false);
    expect(started.status.persistsAcrossVpsReboot).toBe("NOT_CLAIMED");

    const changed = await worker.changeInstrumentTimeframe({
      environment: "DEMO",
      instrument: "GBP/USD",
      timeframe: "5m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
      expectedEnvironmentEpoch: 1,
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.status.config?.instrument).toBe("GBP/USD");
    expect(changed.status.config?.timeframe).toBe("5m");
    expect(changed.status.config?.configEpoch).toBeGreaterThan(1);

    const stopped = await worker.stop();
    expect(stopped.config?.enabled).toBe(false);
    expect(stopped.health.workerState).toBe("STOPPED");
    worker.dispose();
  });

  it("rejects environment mismatch and stale epoch", async () => {
    const worker = new AtMonitorWorker({ storageRoot: tmp, autoStart: false });
    const badEnv = await worker.start({
      environment: "LIVE",
      instrument: "EUR/USD",
      timeframe: "15m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
    });
    expect(badEnv.ok).toBe(false);
    if (badEnv.ok) return;
    expect(badEnv.code).toBe("ENVIRONMENT_MISMATCH");

    const stale = await worker.start({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 2,
      expectedEnvironmentEpoch: 1,
    });
    expect(stale.ok).toBe(false);
    if (stale.ok) return;
    expect(stale.code).toBe("STALE_EPOCH");
    worker.dispose();
  });
});

describe("Phase 53.1 static safety contracts", () => {
  it("registers monitor APIs, keeps execution forbidden, and does not use Local AI", () => {
    expect(AUTOMATED_EXECUTION_BANNER).toMatch(/PHASE 5[34](\.\d+)?/);
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/api/forex/automated-trading/monitor/start");
    expect(api).toContain("/api/forex/automated-trading/monitor/stop");
    expect(api).toContain("/api/forex/automated-trading/monitor/analyze-now");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("requireForexAdmin");
    expect(api).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);

    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("data-fx-at-monitor");
    expect(page).toContain("Start");
    expect(page).toMatch(/PHASE 5[34](\.\d+)?/);
    expect(page).not.toMatch(/localStorage\.setItem\([^)]*openai|sk-/i);

    const worker = read("ai/forex-ai/automated-trading/monitoring/worker.ts");
    expect(worker).not.toMatch(/getLocalAi|from ["'].*ollama/i);
    expect(worker).toContain("server-ohlc-render");

    const chartCapture = read("ai/forex-chart-capture/types.ts");
    expect(chartCapture).toContain("requiresBrowserOpen: true");
  });
});
