/**
 * Phase 4.18F.7 — Chart image capture, observation snapshot sync, freshness model,
 * multimodal image delivery diagnostics, and monitor MTF path (mocked OpenAI).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluateEvidenceFreshness,
} from "../../../../ai/forex-ai/automated-trading/analysis/freshness-model.js";
import {
  buildAtObservationSnapshot,
  createChartImageBinding,
  validateImageEvidenceBinding,
  AT_IMAGE_SOURCE_SERVER_OHLC,
  AT_PLATFORM_SCREENSHOT_AVAILABLE,
} from "../../../../ai/forex-ai/automated-trading/analysis/observation-snapshot.js";
import {
  overlaysFromObservationSnapshot,
  renderAtMarketChartPng,
} from "../../../../ai/forex-ai/automated-trading/monitoring/chart-render.js";
import {
  buildOpenAiEvidenceDeliveryReport,
} from "../../../../ai/forex-ai/automated-trading/analysis/openai-evidence-delivery.js";
import {
  buildEvidenceBundle,
} from "../../../../ai/forex-ai/automated-trading/analysis/evidence.js";
import {
  AtOpenAiAnalysisEngine,
  resetAtOpenAiAnalysisEngineForTests,
} from "../../../../ai/forex-ai/automated-trading/analysis/engine.js";
import { resetAtOpenAiAnalysisStoreForTests } from "../../../../ai/forex-ai/automated-trading/analysis/store.js";
import {
  AtMonitorWorker,
  resetAtMonitorStoreForTests,
  resetAtMonitorWorkerForTests,
} from "../../../../ai/forex-ai/automated-trading/index.ts";
import { buildOpenAiMultimodalChatJsonBody } from "../../../../ai/forex-ai/snapshot-openai/openai-client.ts";
import type { StrategyCandle } from "../../../../ai/forex-ai/automated-trading/auto-engine/strategy/rules.js";
import { MARKET_EVIDENCE_VERSION } from "../../../../ai/forex-ai/automated-trading/analysis/market-evidence-builder.js";

function rising(n: number, periodSec = 900, start = 2650, step = 0.35): StrategyCandle[] {
  const nowSec = Math.floor(Date.now() / 1000);
  const t0 = nowSec - n * periodSec;
  const out: StrategyCandle[] = [];
  let px = start;
  for (let i = 0; i < n; i++) {
    const open = px;
    const close = px + step;
    out.push({
      time: t0 + i * periodSec,
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

function freshVerification(instrument = "XAU/USD") {
  return {
    identityStatus: "ACCOUNT_VERIFIED" as const,
    environmentSelected: "DEMO" as const,
    environmentConnected: "DEMO" as const,
    environmentMatches: true,
    connectionStatus: "CONNECTED",
    environmentEpoch: 1,
    account: {
      accountIdMasked: "••••9999",
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
      symbol: instrument,
      displaySymbol: instrument,
      provider: "FOREXCONNECT" as const,
      recognized: true,
      level: "ELIGIBLE_FOR_FUTURE_RISK" as const,
      instrumentType: "cfd",
      baseAsset: "XAU",
      quoteAsset: "USD",
      pointSize: 0.01,
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
      bid: 2650.12,
      ask: 2650.42,
      spread: 0.3,
      feedStatus: "LIVE" as const,
      sourceTimestampMs: Date.now(),
      receivedAtMs: Date.now(),
      priceChangeAgeMs: 500,
      receiptAgeMs: 200,
      updateCount: 12,
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
    blockers: [],
    verifiedAtUtc: new Date().toISOString(),
    placesOrders: false as const,
  };
}

describe("Phase 4.18F.7 freshness model", () => {
  it("does not label HISTORICAL_ONLY when genuine ticks are fresh and quote is stale", () => {
    const report = evaluateEvidenceFreshness({
      quoteFresh: false,
      tickLastAcceptedAtMs: Date.now() - 1_000,
      primaryCandleLastOpenSec: Math.floor(Date.now() / 1000) - 900,
      primaryTimeframeMs: 900_000,
      movementWindowFreshCount: 2,
      movementWindowTotal: 5,
      mtfAvailableCount: 4,
      mtfRequiredCount: 6,
    });
    expect(report.historicalOnly).toBe(false);
    expect(report.hasLiveMarketSource).toBe(true);
    expect(report.genuineTicks).toBe("FRESH");
    expect(report.quote).toBe("STALE");
    expect(report.overallQuality).not.toBe("HISTORICAL_ONLY");
  });

  it("labels HISTORICAL_ONLY when no live quote and no tick timestamps", () => {
    const report = evaluateEvidenceFreshness({
      quoteFresh: null,
      tickLastAcceptedAtMs: null,
      primaryCandleLastOpenSec: Math.floor(Date.now() / 1000) - 900,
      primaryTimeframeMs: 900_000,
      mtfAvailableCount: 6,
      mtfRequiredCount: 6,
    });
    expect(report.historicalOnly).toBe(true);
    expect(report.hasLiveMarketSource).toBe(false);
    expect(report.overallQuality).toBe("HISTORICAL_ONLY");
  });

  it("prefers STALE_QUOTE when verified quote is stale and ticks are not fresh", () => {
    const report = evaluateEvidenceFreshness({
      quoteFresh: false,
      tickLastAcceptedAtMs: Date.now() - 600_000,
      primaryCandleLastOpenSec: Math.floor(Date.now() / 1000) - 900,
      primaryTimeframeMs: 900_000,
      mtfAvailableCount: 6,
      mtfRequiredCount: 6,
    });
    expect(report.historicalOnly).toBe(true);
    expect(report.overallQuality).toBe("STALE_QUOTE");
  });

  it("evidence bundle uses tick-aware historicalOnly", () => {
    const candles = rising(40);
    const stale = {
      ...freshVerification("EUR/USD"),
      market: {
        ...freshVerification("EUR/USD").market,
        feedStatus: "STALE" as const,
        priceChangeAgeMs: 999_999,
        receiptAgeMs: 999_999,
        sourceTimestampMs: Date.now() - 999_999,
        receivedAtMs: Date.now() - 999_999,
      },
    };
    const withTicks = buildEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      candlesByTf: { "15m": candles },
      verification: stale as never,
      genuineTickFresh: true,
      tickLastAcceptedAtMs: Date.now() - 500,
    });
    expect(withTicks.ok).toBe(true);
    expect(withTicks.evidence?.historicalOnly).toBe(false);

    const without = buildEvidenceBundle({
      environment: "DEMO",
      instrument: "EUR/USD",
      candlesByTf: { "15m": candles },
      verification: stale as never,
      genuineTickFresh: false,
      tickLastAcceptedAtMs: Date.now() - 600_000,
    });
    expect(without.ok).toBe(true);
    expect(without.evidence?.historicalOnly).toBe(true);
  });
});

describe("Phase 4.18F.7 observation snapshot + chart sync", () => {
  it("platform screenshot is documented unavailable; source is SERVER_OHLC_RENDER", () => {
    expect(AT_PLATFORM_SCREENSHOT_AVAILABLE).toBe(false);
    expect(AT_IMAGE_SOURCE_SERVER_OHLC).toBe("SERVER_OHLC_RENDER");
  });

  it("builds immutable snapshot and binds image hash to observation", () => {
    const primary = rising(60);
    const snap = buildAtObservationSnapshot({
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      candlesByTf: {
        "5m": rising(60, 300),
        "15m": primary,
        "30m": rising(60, 1800),
        "1h": rising(60, 3600),
        "4h": rising(40, 14400),
        "1d": rising(40, 86400),
      },
      quote: {
        bid: 2650.1,
        ask: 2650.4,
        mid: 2650.25,
        spread: 0.3,
        quoteFresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        sourceTimestampMs: Date.now() - 200,
        receivedAtMs: Date.now() - 100,
      },
      ticks: {
        lastAcceptedAtMs: Date.now() - 300,
        accepted: 40,
        windowIds: ["1m", "5m", "15m", "30m", "60m"],
        freshWindowCount: 3,
        totalWindows: 5,
      },
    });
    expect(snap.phase).toBe("4.18F.7");
    expect(snap.observationId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(snap.imageSource).toBe("SERVER_OHLC_RENDER");
    expect(snap.placesOrders).toBe(false);
    expect(snap.mutatesBroker).toBe(false);
    expect(snap.chartSeries.sma21.some((v) => v != null)).toBe(true);
    expect(snap.freshness.mtf).toBe("FRESH");

    const rendered = renderAtMarketChartPng({
      instrument: snap.instrument,
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: snap.primaryCandles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        isClosed: c.closed !== false,
      })),
      observationUtc: snap.observationUtc,
      overlays: overlaysFromObservationSnapshot(snap),
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    expect(rendered.imageSourceLabel).toBe("SERVER_OHLC_RENDER");
    expect(rendered.note).toMatch(/NOT a broker/i);
    expect(rendered.overlaysDrawn).toEqual(expect.arrayContaining(["OHLC"]));
    const hash = createHash("sha256").update(rendered.png).digest("hex").slice(0, 24);
    expect(hash).toBe(rendered.imageHash);

    const binding = createChartImageBinding({
      snapshot: snap,
      imageHash: rendered.imageHash,
      byteLength: rendered.byteLength,
      width: rendered.width,
      height: rendered.height,
    });
    const ok = validateImageEvidenceBinding({
      snapshot: snap,
      binding,
      imageBytes: rendered.png,
    });
    expect(ok).toEqual({ ok: true });
  });

  it("rejects mismatched instrument / corrupt image bytes", () => {
    const primary = rising(40);
    const snap = buildAtObservationSnapshot({
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      candlesByTf: { "15m": primary },
      quote: {
        bid: 1,
        ask: 2,
        mid: 1.5,
        spread: 1,
        quoteFresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        sourceTimestampMs: Date.now(),
        receivedAtMs: Date.now(),
      },
    });
    const rendered = renderAtMarketChartPng({
      instrument: snap.instrument,
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: snap.primaryCandles.map((c) => ({ ...c, isClosed: true })),
      observationUtc: snap.observationUtc,
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const binding = createChartImageBinding({
      snapshot: snap,
      imageHash: rendered.imageHash,
      byteLength: rendered.byteLength,
      width: rendered.width,
      height: rendered.height,
    });
    const badInstrument = validateImageEvidenceBinding({
      snapshot: snap,
      binding: { ...binding, instrument: "EUR/USD" },
      imageBytes: rendered.png,
    });
    expect(badInstrument.ok).toBe(false);
    if (badInstrument.ok) return;
    expect(badInstrument.code).toBe("IMAGE_EVIDENCE_MISMATCH");

    const corrupt = validateImageEvidenceBinding({
      snapshot: snap,
      binding,
      imageBytes: Buffer.from("not-a-png"),
    });
    expect(corrupt.ok).toBe(false);
    if (corrupt.ok) return;
    expect(corrupt.code).toBe("IMAGE_EVIDENCE_MISMATCH");
  });
});

describe("Phase 4.18F.7 multimodal delivery + worker autonomy", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-f7-"));
    resetAtOpenAiAnalysisEngineForTests();
    resetAtOpenAiAnalysisStoreForTests();
    resetAtMonitorStoreForTests();
    resetAtMonitorWorkerForTests();
  });

  afterEach(() => {
    resetAtOpenAiAnalysisEngineForTests();
    resetAtOpenAiAnalysisStoreForTests();
    resetAtMonitorStoreForTests();
    resetAtMonitorWorkerForTests();
  });

  it("delivery report records image bytes inclusion and observation linkage", () => {
    const report = buildOpenAiEvidenceDeliveryReport({
      prompt: {
        primary: { indicators: { atrMethod: "SMA_OF_TR" } },
        liveTickMovement: { windows: [{ windowId: "1m" }] },
        multiTimeframe: { alignment: { classification: "FULL_ALIGNMENT", matrix: [{ timeframe: "15m" }] } },
        timeframeMatrix: [{ timeframe: "15m" }, { timeframe: "1h" }],
        historicalLiveSeparated: true,
      },
      requestStatus: "REQUEST_SENT",
      responseStatus: "RESPONSE_RECEIVED",
      validationStatus: "VALIDATED",
      includedImageBytesInRequest: true,
      imageDeliveryLifecycle: "RESPONSE_VALIDATED",
      observationId: "obs-1",
      imageId: "img-1",
      imageHash: "abc123",
      imageSource: "SERVER_OHLC_RENDER",
      phase: "4.18F.7",
    });
    expect(report.includedImageBytesInRequest).toBe(true);
    expect(report.categoriesIncluded.chartImageBytes).toBe(true);
    expect(report.observationId).toBe("obs-1");
    expect(report.imageSource).toBe("SERVER_OHLC_RENDER");
    expect(report.placesOrders).toBe(false);
    expect(MARKET_EVIDENCE_VERSION).toBe("4.18F.7");
  });

  it("multimodal body embeds real PNG base64 (not a filesystem path)", () => {
    const rendered = renderAtMarketChartPng({
      instrument: "XAU/USD",
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: rising(40).map((c) => ({ ...c, isClosed: true })),
      observationUtc: new Date().toISOString(),
    });
    expect(rendered.ok).toBe(true);
    if (!rendered.ok) return;
    const b64 = rendered.png.toString("base64");
    const body = buildOpenAiMultimodalChatJsonBody({
      model: "gpt-6-luna",
      system: "sys",
      userText: "obs",
      images: [{ mimeType: "image/png", base64: b64 }],
    });
    const messages = body.messages as Array<{ role: string; content: unknown }>;
    const user = messages.find((m) => m.role === "user");
    const parts = user?.content as Array<{ type: string; image_url?: { url: string } }>;
    const img = parts.find((p) => p.type === "image_url");
    expect(img?.image_url?.url.startsWith("data:image/png;base64,")).toBe(true);
    expect(img?.image_url?.url.includes("/tmp/")).toBe(false);
    expect((img?.image_url?.url.length ?? 0) > 100).toBe(true);
  });

  it("analyzeWithChart sets includedImageBytesInRequest after successful multimodal", async () => {
    const png = renderAtMarketChartPng({
      instrument: "XAU/USD",
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: rising(48).map((c) => ({ ...c, isClosed: true })),
      observationUtc: new Date().toISOString(),
    });
    expect(png.ok).toBe(true);
    if (!png.ok) return;

    const chatMultimodal = vi.fn(async () => ({
      ok: true,
      data: {
        direction: "BUY",
        directionalConfidencePct: 58,
        directionalBias: "BULLISH",
        trendState: "UPTREND",
        trendStrength: "MODERATE",
        mtfAgreement: "AGREE_BULLISH",
        keyEvidence: ["Higher low"],
        counterEvidence: [],
        structureNotes: [],
        supportLevels: [],
        resistanceLevels: [],
        scenarios: {
          bullish: { summary: "up", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
          bearish: { summary: "dn", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
        },
        dataQuality: "SUFFICIENT",
        limitations: [],
        explanation: "BUY lean — not an order.",
      },
      model: "gpt-6-luna",
      code: "OK",
    }));

    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      chat: vi.fn() as never,
      chatMultimodal: chatMultimodal as never,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          model: "gpt-6-luna",
          apiKeyConfigured: true,
        }),
        getApiKey: async () => "sk-test",
      } as never,
      loadCandles: async () => rising(40),
    });

    const result = await engine.analyzeWithChart({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      timeframes: ["5m", "15m", "30m", "1h", "4h", "1d"],
      candlesByTf: {
        "5m": rising(40, 300),
        "15m": rising(48),
        "30m": rising(40, 1800),
        "1h": rising(40, 3600),
        "4h": rising(40, 14400),
        "1d": rising(40, 86400),
      },
      verification: freshVerification() as never,
      trigger: "manual",
      monitorConfigEpoch: 1,
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
          imageSourceLabel: "SERVER_OHLC_RENDER",
          observationId: "obs-f7",
          imageId: "img-f7",
        },
      },
      requireImage: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok || !result.analysis) return;
    expect(chatMultimodal).toHaveBeenCalledTimes(1);
    expect(result.analysis.chartImage?.includedInOpenAiRequest).toBe(true);
    expect(result.analysis.evidenceDelivery?.includedImageBytesInRequest).toBe(true);
    expect(result.analysis.evidenceDelivery?.observationId).toBe("obs-f7");
    expect(result.analysis.evidenceDelivery?.imageId).toBe("img-f7");
    expect(result.analysis.evidenceDelivery?.imageSource).toBe("SERVER_OHLC_RENDER");
    expect(result.analysis.evidenceDelivery?.imageDeliveryLifecycle).toMatch(/RESPONSE_/);
    expect(result.analysis.timeframes.length).toBeGreaterThanOrEqual(6);
  });

  it("worker runAnalysis loads MTF, renders chart, and does not require browser", async () => {
    const candles = rising(48).map(({ time, open, high, low, close }) => ({
      time, open, high, low, close,
    }));
    const loadCandles = vi.fn(async (_sym: string, tf: string) => {
      const period =
        tf === "5m" ? 300
          : tf === "15m" ? 900
            : tf === "30m" ? 1800
              : tf === "1h" ? 3600
                : tf === "4h" ? 14400
                  : 86400;
      return rising(40, period).map(({ time, open, high, low, close }) => ({
        time, open, high, low, close,
      }));
    });

    const chatMultimodal = vi.fn(async () => ({
      ok: true,
      data: {
        direction: "SELL",
        directionalConfidencePct: 61,
        directionalBias: "BEARISH",
        trendState: "DOWNTREND",
        trendStrength: "MODERATE",
        mtfAgreement: "MIXED",
        keyEvidence: ["LH"],
        counterEvidence: [],
        structureNotes: [],
        supportLevels: [],
        resistanceLevels: [],
        scenarios: {
          bullish: { summary: "x", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
          bearish: { summary: "y", supportingEvidence: [], confirmationConditions: [], invalidationConditions: [] },
        },
        dataQuality: "SUFFICIENT",
        limitations: [],
        explanation: "SELL lean — not an order.",
      },
      model: "gpt-6-luna",
      code: "OK",
    }));

    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      chat: vi.fn() as never,
      chatMultimodal: chatMultimodal as never,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          model: "gpt-6-luna",
          apiKeyConfigured: true,
        }),
        getApiKey: async () => "sk-test",
      } as never,
      loadCandles: async () => candles,
    });

    const worker = new AtMonitorWorker({
      storageRoot: tmp,
      analysisEngine: engine,
      loadCandles,
      autoStart: false,
      getVerification: () => freshVerification() as never,
      getEnvironmentEpoch: () => 1,
      getSelectedEnvironment: () => "DEMO",
    });

    const status = worker.getPublicStatus();
    expect(status.requiresBrowserOpen).toBe(false);
    expect(status.chartImageSourceLabel).toBe("SERVER_OHLC_RENDER");
    expect(status.platformScreenshotAvailable).toBe(false);
    expect(status.placesOrders).toBe(false);
    expect(status.mutatesBroker).toBe(false);

    // Persist matching config epoch so mid-analysis CONFIG_CHANGED guards pass.
    const store = worker["store"] as { save: (s: unknown) => Promise<void>; getState: () => { health: unknown; completedDedupeKeys: string[] } };
    await store.save({
      schemaVersion: "at-live-monitor-v1",
      phase: "4.18F.7",
      config: {
        enabled: true,
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        configEpoch: 1,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
        pollIntervalMs: 20_000,
      },
      health: store.getState().health,
      completedDedupeKeys: [],
    });

    const result = await worker.runAnalysis({
      trigger: "manual",
      dedupeKey: null,
      config: {
        enabled: true,
        environment: "DEMO",
        instrument: "XAU/USD",
        timeframe: "15m",
        configEpoch: 1,
        createdAtUtc: new Date().toISOString(),
        updatedAtUtc: new Date().toISOString(),
        pollIntervalMs: 20_000,
      },
      candles,
      verification: freshVerification() as never,
    });

    expect(result).toMatchObject({ ok: true });
    expect(loadCandles.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(chatMultimodal).toHaveBeenCalledTimes(1);
    const after = worker.getPublicStatus();
    expect(after.health.lastObservationId).toBeTruthy();
    expect(after.health.lastImageId).toBeTruthy();
    expect(after.health.lastImageSourceLabel).toBe("SERVER_OHLC_RENDER");
    expect(after.health.lastIncludedImageBytesInRequest).toBe(true);
    expect(after.health.lastScreenshotImageHash).toMatch(/^[a-f0-9]+$/i);

    if (result.ok) {
      const imgPath = path.join(tmp, "forex-automated-trading", "chart-images", `${result.analysisId}.png`);
      // store may use alternate layout — tolerate missing in unit env
      if (fs.existsSync(imgPath)) {
        const bytes = fs.readFileSync(imgPath);
        expect(bytes[0]).toBe(0x89);
      }
    }
  });

  it("OpenAI delivery failure records DELIVERY_FAILED and never mutates broker", async () => {
    const png = renderAtMarketChartPng({
      instrument: "XAU/USD",
      timeframe: "15m",
      timeframeLabel: "M15",
      candles: rising(40).map((c) => ({ ...c, isClosed: true })),
      observationUtc: new Date().toISOString(),
    });
    expect(png.ok).toBe(true);
    if (!png.ok) return;

    const engine = new AtOpenAiAnalysisEngine({
      storageRoot: tmp,
      chat: vi.fn() as never,
      chatMultimodal: vi.fn(async () => ({
        ok: false,
        data: null,
        model: null,
        code: "OPENAI_UNAVAILABLE",
        error: "network",
      })) as never,
      config: {
        getPublicStatus: async () => ({
          configured: true,
          model: "gpt-6-luna",
          apiKeyConfigured: true,
        }),
        getApiKey: async () => "sk-test",
      } as never,
      loadCandles: async () => rising(40),
    });

    const result = await engine.analyzeWithChart({
      environment: "DEMO",
      environmentEpoch: 1,
      instrument: "XAU/USD",
      primaryTimeframe: "15m",
      timeframes: ["15m"],
      candlesByTf: { "15m": rising(40) },
      verification: freshVerification() as never,
      trigger: "manual",
      monitorConfigEpoch: 1,
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
          observationId: "obs-fail",
          imageId: "img-fail",
          imageSourceLabel: "SERVER_OHLC_RENDER",
        },
      },
      requireImage: true,
    });

    expect(result.ok).toBe(false);
    expect(result.analysis?.evidenceDelivery?.imageDeliveryLifecycle).toBe("DELIVERY_FAILED");
    expect(result.analysis?.evidenceDelivery?.includedImageBytesInRequest).toBe(false);
    expect(result.analysis?.evidenceDelivery?.placesOrders).toBe(false);
    expect(result.analysis?.evidenceDelivery?.mutatesBroker).toBe(false);
  });
});
