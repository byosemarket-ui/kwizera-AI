/**
 * Phase 53.3 — Live monitoring persistence, chart→OpenAI image path, BUY/SELL contract.
 * Code-level checks only — does not claim real FXCM/OpenAI E2E success.
 */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  AUTOMATED_EXECUTION_BANNER,
  AT_CONFIDENCE_LABEL,
  AT_DIRECTIONAL_CONFIDENCE_NOTE,
  AT_MONITOR_PHASE,
  AtMonitorStore,
  AtMonitorWorker,
  AtOpenAiAnalysisEngine,
  parseAtMonitorTimeframe,
  renderAtMarketChartPng,
  resetAtMonitorStoreForTests,
  resetAtMonitorWorkerForTests,
  resetAtOpenAiAnalysisEngineForTests,
  resetAtOpenAiAnalysisStoreForTests,
  scheduledAnalysisDedupeKey,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import { buildOpenAiMultimodalChatJsonBody } from "../../../../ai/forex-ai/snapshot-openai/openai-client.ts";

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
    };
  });
}

function freshVerification() {
  return {
    identityStatus: "ACCOUNT_VERIFIED" as const,
    environmentSelected: "DEMO" as const,
    environmentConnected: "DEMO" as const,
    environmentMatches: true,
    connectionStatus: "CONNECTED",
    environmentEpoch: 1,
    account: {
      accountIdMasked: "••••1234",
      environment: "DEMO" as const,
      accountCurrency: "USD",
      balance: 10000,
      equity: 10000,
      equityDerived: false,
      equityDerivation: null,
      usedMargin: 0,
      usableMargin: 10000,
      fetchedAtUtc: new Date().toISOString(),
      ageMs: 100,
      isFresh: true,
      fields: {
        accountCurrency: true,
        balance: true,
        equity: true,
        usedMargin: true,
        usableMargin: true,
      },
      missingFields: [] as string[],
      snapshotCode: "ok",
    },
    instrument: {
      symbol: "EUR/USD",
      displaySymbol: "EUR/USD",
      provider: "FOREXCONNECT" as const,
      recognized: true,
      level: "ELIGIBLE_FOR_FUTURE_RISK" as const,
      instrumentType: "forex",
      baseAsset: "EUR",
      quoteAsset: "USD",
      pointSize: 0.00001,
      pipCostAccount: null,
      contractMultiplier: null,
      baseUnitSize: null,
      quantityMin: null,
      quantityStep: null,
      quantityUnit: null,
      marginRate: null,
      marginPerLotAccount: null,
      contractVerified: true,
      contractSource: "fc",
      unavailableReason: null,
    },
    market: {
      bid: 1.1001,
      ask: 1.1003,
      spread: 0.0002,
      feedStatus: "LIVE" as const,
      sourceTimestampMs: Date.now(),
      receivedAtMs: Date.now(),
      priceChangeAgeMs: 500,
      receiptAgeMs: 200,
      updateCount: 10,
      marketSession: "ACTIVE" as const,
    },
    readiness: {
      environmentVerified: true,
      accountIdentityVerified: true,
      accountMetadataSufficient: true,
      instrumentMetadataVerified: true,
      marketDataHealthVerified: true,
      riskEngineVerified: false as const,
      executionImplemented: false as const,
      readyForFutureAnalysis: true,
      readyForTrading: false as const,
    },
    blockers: [] as [],
    verifiedAtUtc: new Date().toISOString(),
    placesOrders: false as const,
  };
}

describe("Phase 53.3 persistence & duplicate worker prevention", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p533-"));
    resetAtMonitorStoreForTests();
    resetAtMonitorWorkerForTests();
  });

  afterEach(() => {
    resetAtMonitorWorkerForTests();
    resetAtMonitorStoreForTests();
  });

  it("idempotent Start does not bump config epoch or spawn a second timer", async () => {
    const worker = new AtMonitorWorker({
      storageRoot: tmp,
      autoStart: false,
      loadCandles: async () => sampleCandles(40, 900),
    });
    const a = await worker.start({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
      expectedEnvironmentEpoch: 1,
    });
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    const epoch1 = a.status.config?.configEpoch;
    const b = await worker.start({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
      expectedEnvironmentEpoch: 1,
    });
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.status.config?.configEpoch).toBe(epoch1);
    expect(b.status.config?.enabled).toBe(true);
    worker.dispose();
  });

  it("resumeFromPersistence restores enabled monitoring after simulated restart", async () => {
    const store = new AtMonitorStore(tmp);
    await store.update((s) => ({
      ...s,
      config: {
        enabled: true,
        environment: "DEMO",
        instrument: "EUR/USD",
        timeframe: "15m",
        configEpoch: 3,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
        pollIntervalMs: 20_000,
      },
    }));
    resetAtMonitorStoreForTests();

    const worker = new AtMonitorWorker({
      storageRoot: tmp,
      autoStart: false,
      getSelectedEnvironment: () => "DEMO",
      getVerification: () => freshVerification() as never,
      loadCandles: async () => sampleCandles(40, 900),
    });
    worker.resumeFromPersistence();
    // Allow async bootstrap to land.
    await new Promise((r) => setTimeout(r, 50));
    const status = worker.getPublicStatus();
    expect(status.phase).toBe(AT_MONITOR_PHASE);
    expect(status.config?.enabled).toBe(true);
    expect(status.config?.configEpoch).toBe(3);
    expect(status.requiresBrowserOpen).toBe(false);
    expect(status.chartImageSource).toBe("server-ohlc-render");
    expect(status.health.workerActive).toBe(true);
    expect(["CONNECTING", "MONITORING_LIVE", "WAITING_CANDLE_CLOSE", "STALE_QUOTES", "VERIFICATION_REQUIRED", "DATA_INSUFFICIENT", "ANALYSIS_IN_PROGRESS", "ANALYSIS_SUCCESS"]).toContain(
      status.health.workerState,
    );
    worker.dispose();
  });

  it("resume pauses when selected environment no longer matches persisted config", async () => {
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
    resetAtMonitorStoreForTests();
    const worker = new AtMonitorWorker({
      storageRoot: tmp,
      autoStart: false,
      getSelectedEnvironment: () => "LIVE",
    });
    worker.resumeFromPersistence();
    await new Promise((r) => setTimeout(r, 50));
    const status = worker.getPublicStatus();
    expect(status.health.workerState).toBe("PAUSED_SAFETY");
    expect(status.health.lastBlockerCode).toBe("ENVIRONMENT_MISMATCH");
    expect(status.health.workerActive).toBe(false);
    worker.dispose();
  });

  it("instrument/timeframe change bumps epoch so old dedupe keys cannot collide", async () => {
    const worker = new AtMonitorWorker({ storageRoot: tmp, autoStart: false });
    await worker.start({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
    });
    const changed = await worker.changeInstrumentTimeframe({
      environment: "DEMO",
      instrument: "GBP/USD",
      timeframe: "5m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
    });
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    const keyOld = scheduledAnalysisDedupeKey({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "15m",
      closedCandleOpenSec: 100,
      configEpoch: 1,
    });
    const keyNew = scheduledAnalysisDedupeKey({
      environment: "DEMO",
      instrument: "GBP/USD",
      timeframe: "5m",
      closedCandleOpenSec: 100,
      configEpoch: changed.status.config!.configEpoch,
    });
    expect(keyOld).not.toBe(keyNew);
    worker.dispose();
  });
});

describe("Phase 53.3 chart image + OpenAI inclusion", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p533e-"));
    resetAtOpenAiAnalysisEngineForTests();
    resetAtOpenAiAnalysisStoreForTests();
  });

  afterEach(() => {
    resetAtOpenAiAnalysisEngineForTests();
    resetAtOpenAiAnalysisStoreForTests();
  });

  it("renders OHLC PNG with hash bound to observation metadata", () => {
    const candles = sampleCandles(48, 900);
    const rendered = renderAtMarketChartPng({
      instrument: "EUR/USD",
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: candles.map((c) => ({ ...c, isClosed: true })),
      observationUtc: "2024-06-01T12:00:00.000Z",
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.source).toBe("server-ohlc-render");
    expect(rendered.imageHash).toMatch(/^[a-f0-9]{16,}$/i);
    expect(rendered.png[0]).toBe(0x89);
    expect(rendered.png[1]).toBe(0x50); // PNG magic
  });

  it("multimodal request body embeds image bytes (not URL-only)", () => {
    const body = buildOpenAiMultimodalChatJsonBody({
      model: "gpt-6-luna",
      system: "sys",
      userText: "user",
      images: [{ mimeType: "image/png", base64: "QQQQ" }],
    });
    const messages = body.messages as Array<{ role: string; content: unknown }>;
    const user = messages.find((m) => m.role === "user");
    const parts = user?.content as Array<{ type: string; image_url?: { url: string } }>;
    expect(parts.some((p) => p.type === "image_url" && p.image_url?.url.includes("base64,QQQQ"))).toBe(true);
  });

  it("requireImage blocks when chart bytes missing — no text-only OpenAI call", async () => {
    const chat = vi.fn(async () => ({ ok: true, data: { direction: "BUY" }, model: "gpt-6-luna", code: "OK" }));
    const chatMultimodal = vi.fn(async () => ({
      ok: true,
      data: { direction: "BUY", directionalConfidencePct: 55 },
      model: "gpt-6-luna",
      code: "OK",
    }));
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      chat: chat as never,
      chatMultimodal: chatMultimodal as never,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          model: "gpt-6-luna",
          apiKeyConfigured: true,
        }),
        getApiKey: async () => "sk-test",
      } as never,
      loadCandles: async () => sampleCandles(40, 3600),
    });

    const result = await engine.analyzeWithChart({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      primaryTimeframe: "1h",
      timeframes: ["1h"],
      verification: freshVerification() as never,
      trigger: "scheduled",
      monitorConfigEpoch: 1,
      chartImage: null,
      requireImage: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("IMAGE_UNAVAILABLE");
    expect(chat).not.toHaveBeenCalled();
    expect(chatMultimodal).not.toHaveBeenCalled();
  });

  it("sets includedInOpenAiRequest true only after successful multimodal call", async () => {
    const png = renderAtMarketChartPng({
      instrument: "EUR/USD",
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: sampleCandles(40, 900).map((c) => ({ ...c, isClosed: true })),
      observationUtc: new Date().toISOString(),
    });
    expect(png.ok).toBe(true);
    if (!png.ok) return;

    const chatMultimodal = vi.fn(async () => ({
      ok: true,
      data: {
        direction: "SELL",
        directionalConfidencePct: 62,
        directionalBias: "BEARISH",
        trendState: "DOWNTREND",
        trendStrength: "MODERATE",
        mtfAgreement: "AGREE_BEARISH",
        keyEvidence: ["Lower high"],
        counterEvidence: [],
        structureNotes: [],
        supportLevels: [],
        resistanceLevels: [],
        scenarios: {
          bullish: { summary: "x", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
          bearish: { summary: "y", supportingEvidence: ["LH"], confirmationConditions: [], invalidationConditions: [] },
        },
        dataQuality: "SUFFICIENT",
        limitations: [],
        explanation: "SELL lean — not an order.",
      },
      model: "gpt-6-luna",
      code: "OK",
    }));
    const chat = vi.fn();

    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      chat: chat as never,
      chatMultimodal: chatMultimodal as never,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          model: "gpt-6-luna",
          apiKeyConfigured: true,
        }),
        getApiKey: async () => "sk-test",
      } as never,
      loadCandles: async () => sampleCandles(40, 900),
    });

    const result = await engine.analyzeWithChart({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      primaryTimeframe: "15m",
      timeframes: ["15m"],
      verification: freshVerification() as never,
      trigger: "manual",
      monitorConfigEpoch: 2,
      chartImage: {
        mimeType: "image/png",
        base64: png.png.toString("base64"),
        meta: {
          available: true,
          imageHash: png.imageHash,
          capturedAtUtc: new Date().toISOString(),
          source: png.source,
          note: png.note,
          blocker: null,
          width: png.width,
          height: png.height,
          byteLength: png.byteLength,
          observationUtc: new Date().toISOString(),
        },
      },
      requireImage: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.analysis) return;
    expect(chatMultimodal).toHaveBeenCalledTimes(1);
    expect(chat).not.toHaveBeenCalled();
    const call = chatMultimodal.mock.calls[0]?.[0] as {
      images?: Array<{ base64?: string }>;
    };
    expect(call?.images?.[0]?.base64?.length).toBeGreaterThan(20);
    expect(result.analysis.chartImage?.includedInOpenAiRequest).toBe(true);
    expect(result.analysis.direction).toBe("SELL");
    expect(result.analysis.directionalConfidencePct).toBe(62);
    expect(result.analysis.directionalConfidenceNote).toBe(AT_DIRECTIONAL_CONFIDENCE_NOTE);
    expect(result.analysis.confidenceLabel).toBe(AT_CONFIDENCE_LABEL);
    expect(result.analysis.placesOrders).toBe(false);
  });

  it("rejects non-vision model when image is required", async () => {
    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          model: "gpt-3.5-turbo",
          apiKeyConfigured: true,
        }),
        getApiKey: async () => "sk-test",
      } as never,
    });
    const result = await engine.analyzeWithChart({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "EUR/USD",
      trigger: "scheduled",
      monitorConfigEpoch: 1,
      verification: freshVerification() as never,
      chartImage: {
        mimeType: "image/png",
        base64: "AAAA",
        meta: {
          available: true,
          imageHash: "h",
          capturedAtUtc: new Date().toISOString(),
          source: "server-ohlc-render",
          note: "n",
          blocker: null,
        },
      },
      requireImage: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("MODEL_NOT_VISION_ELIGIBLE");
  });
});

describe("Phase 53.3 static contracts & safety", () => {
  it("keeps H2 unsupported and maps verified FC timeframes only", () => {
    expect(parseAtMonitorTimeframe("H2")).toBeNull();
    expect(parseAtMonitorTimeframe("2h")).toBeNull();
    expect(parseAtMonitorTimeframe("M5")).toBe("5m");
    expect(parseAtMonitorTimeframe("H1")).toBe("1h");
  });

  it("registers monitor APIs, Phase 53.3 banner, no broker order paths, no Local AI", () => {
    expect(AUTOMATED_EXECUTION_BANNER).toMatch(/PHASE 5[34](\.\d+)?/);
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/api/forex/automated-trading/monitor/start");
    expect(api).toContain("/api/forex/automated-trading/monitor/stop");
    expect(api).toContain("/api/forex/automated-trading/monitor/change");
    expect(api).toContain("/api/forex/automated-trading/monitor/analyze-now");
    expect(api).toContain("requireForexAdmin");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).not.toMatch(/placeOrder|submitOrder|createOrder|closePosition/);

    const worker = read("ai/forex-ai/automated-trading/monitoring/worker.ts");
    expect(worker).toContain("requireImage: true");
    expect(worker).toContain("resumeFromPersistence");
    expect(worker).not.toMatch(/getLocalAi|from ["'].*ollama/i);

    const engine = read("ai/forex-ai/automated-trading/analysis/engine.ts");
    expect(engine).toContain("includedInOpenAiRequest");
    expect(engine).toContain("openAiChatMultimodalJson");
    expect(engine).not.toMatch(/getLocalAi|ollama/i);

    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toContain("data-fx-at-monitor");
    expect(page).toMatch(/PHASE 5[34](\.\d+)?/);
    expect(page).toContain("includedInOpenAiRequest");
    expect(page).toContain("data-fx-at-binary-direction");
  });
});
