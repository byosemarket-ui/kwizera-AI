/**
 * Phase 49A — Chart capture metadata, validation, persistence, sessions.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  CAPTURE_MAX_PER_SESSION,
  CAPTURE_MIN_INTERVAL_MS,
  CAPTURE_TIMEFRAME_IDS,
  ChartCaptureStore,
  decodeCaptureImageBase64,
  isCaptureTimeframeId,
  validateCreateCaptureInput,
  validateSessionConfig,
} from "../../../../ai/forex-chart-capture/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

/** Minimal valid 1x1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function freshCaptureBody(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    imageBase64: PNG_1X1.toString("base64"),
    mimeType: "image/png",
    width: 640,
    height: 360,
    capturedAtUtc: now,
    capturedAtLocal: "local-test",
    mode: "MANUAL",
    instrument: { symbol: "XAU/USD", displaySymbol: "XAU/USD", provider: "FOREXCONNECT" },
    timeframe: "1h",
    candleWindow: {
      closedCount: 100,
      formingCount: 1,
      totalCount: 101,
      firstOpenTimeSec: 1,
      lastOpenTimeSec: 101,
    },
    quote: {
      bid: 2650.12,
      ask: null,
      mid: null,
      lastPrice: 2650.12,
      feedHealth: "LIVE",
      lastGenuinePriceChangeAt: now,
      lastGenuinePriceChangeAgeMs: 1200,
    },
    marketSnapshot: { snapshotId: null, contentFingerprint: null },
    ...overrides,
  };
}

describe("Phase 49A chart capture validation", () => {
  it("accepts supported chart timeframes and rejects unsupported ones", () => {
    expect(CAPTURE_TIMEFRAME_IDS).toContain("5m");
    expect(CAPTURE_TIMEFRAME_IDS).toContain("15m");
    expect(CAPTURE_TIMEFRAME_IDS).toContain("1h");
    expect(CAPTURE_TIMEFRAME_IDS).toContain("4h");
    expect(CAPTURE_TIMEFRAME_IDS).not.toContain("2h");
    expect(isCaptureTimeframeId("1h")).toBe(true);
    expect(isCaptureTimeframeId("2h")).toBe(false);
    const bad = validateCreateCaptureInput(freshCaptureBody({ timeframe: "2h" }));
    expect(bad.ok).toBe(false);
  });

  it("requires PNG signature and rejects LIVE without a price", () => {
    const okPng = decodeCaptureImageBase64(PNG_1X1.toString("base64"));
    expect(okPng.ok).toBe(true);
    const badSig = decodeCaptureImageBase64(Buffer.from("not-a-png").toString("base64"));
    expect(badSig.ok).toBe(false);

    const liveNoPrice = validateCreateCaptureInput(freshCaptureBody({
      quote: {
        bid: null,
        ask: null,
        mid: null,
        lastPrice: null,
        feedHealth: "LIVE",
        lastGenuinePriceChangeAt: null,
        lastGenuinePriceChangeAgeMs: null,
      },
    }));
    expect(liveNoPrice.ok).toBe(false);

    const historicalOk = validateCreateCaptureInput(freshCaptureBody({
      quote: {
        bid: null,
        ask: null,
        mid: null,
        lastPrice: 1.1,
        feedHealth: "HISTORICAL",
        lastGenuinePriceChangeAt: null,
        lastGenuinePriceChangeAgeMs: null,
      },
    }));
    expect(historicalOk.ok).toBe(true);
  });

  it("rejects stale or far-future capture timestamps", () => {
    const stale = validateCreateCaptureInput(freshCaptureBody({
      capturedAtUtc: new Date(Date.now() - 20 * 60_000).toISOString(),
    }));
    expect(stale.ok).toBe(false);
    const future = validateCreateCaptureInput(freshCaptureBody({
      capturedAtUtc: new Date(Date.now() + 10 * 60_000).toISOString(),
    }));
    expect(future.ok).toBe(false);
  });

  it("validates session interval, duration, and max captures", () => {
    const ok = validateSessionConfig({
      enabled: true,
      intervalMs: 5 * 60_000,
      durationMs: 30 * 60_000,
      instrumentSymbol: "EUR/USD",
      instrumentDisplaySymbol: "EUR/USD",
      provider: "FOREXCONNECT",
      timeframe: "15m",
      maxCaptures: 12,
    });
    expect(ok.ok).toBe(true);

    const tooFast = validateSessionConfig({
      enabled: true,
      intervalMs: CAPTURE_MIN_INTERVAL_MS - 1,
      durationMs: 30 * 60_000,
      instrumentSymbol: "EUR/USD",
      provider: "FOREXCONNECT",
      timeframe: "15m",
      maxCaptures: 12,
    });
    expect(tooFast.ok).toBe(false);

    const tooMany = validateSessionConfig({
      enabled: true,
      intervalMs: 5 * 60_000,
      durationMs: 30 * 60_000,
      instrumentSymbol: "EUR/USD",
      provider: "FOREXCONNECT",
      timeframe: "15m",
      maxCaptures: CAPTURE_MAX_PER_SESSION + 1,
    });
    expect(tooMany.ok).toBe(false);
  });
});

describe("Phase 49A chart capture store", () => {
  let tmp: string;
  let store: ChartCaptureStore;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-p49a-"));
    store = new ChartCaptureStore(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("persists image+metadata atomically and supports list/get/delete/selection", async () => {
    const validated = validateCreateCaptureInput(freshCaptureBody());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;

    const record = await store.create(validated.value, validated.imageBuffer);
    expect(record.captureId).toBeTruthy();
    expect(record.status).toBe("STORED");
    expect(record.ownershipScope).toBe("studio");
    expect(record.instrument.symbol).toBe("XAU/USD");
    expect(record.image.mimeType).toBe("image/png");
    expect(record.capturedAtUtc).toBe(validated.value.capturedAtUtc);

    const listed = await store.list({ instrument: "XAU/USD", timeframe: "1h" });
    expect(listed.length).toBe(1);
    expect(listed[0].hasImage).toBe(true);

    const image = await store.getImage(record.captureId);
    expect(image?.buffer.equals(validated.imageBuffer)).toBe(true);

    const selected = await store.setSelectedForAi(record.captureId, true);
    expect(selected?.selectedForAi).toBe(true);

    const deleted = await store.delete(record.captureId);
    expect(deleted).toBe(true);
    expect(await store.get(record.captureId)).toBeNull();
    expect(await store.getImage(record.captureId)).toBeNull();
  });

  it("upserts session lifecycle states for pause/resume/stop audit", async () => {
    const now = new Date().toISOString();
    await store.upsertSession({
      sessionId: "sess-1",
      status: "RUNNING",
      config: {
        enabled: true,
        intervalMs: 5 * 60_000,
        durationMs: 30 * 60_000,
        instrumentSymbol: "EUR/USD",
        instrumentDisplaySymbol: "EUR/USD",
        provider: "FOREXCONNECT",
        timeframe: "5m",
        maxCaptures: 6,
      },
      startedAtUtc: now,
      endsAtUtc: new Date(Date.now() + 30 * 60_000).toISOString(),
      pausedAtUtc: null,
      nextCaptureAtUtc: new Date(Date.now() + 5 * 60_000).toISOString(),
      captureCount: 0,
      lastCaptureId: null,
      lastError: null,
      requiresBrowserOpen: true,
      updatedAtUtc: now,
    });
    const got = await store.getSession("sess-1");
    expect(got?.status).toBe("RUNNING");
    expect(got?.requiresBrowserOpen).toBe(true);
  });
});

describe("Phase 49A UI and API wiring contracts", () => {
  it("exposes native takeScreenshot on ForexPriceChart and Capture Chart for AI UI", () => {
    const chart = read("desktop/forex/chart/ForexPriceChart.tsx");
    expect(chart).toContain("takeScreenshot");
    expect(chart).toContain("getVisibleRange");

    const workspace = read("desktop/forex/chart/ForexChartWorkspace.tsx");
    expect(workspace).toContain("ChartCapturePanel");
    expect(workspace).toContain('data-phase-49a="true"');
    expect(workspace).toMatch(/data-phase="37[def]"/);

    const panel = read("desktop/forex/chart/capture/ChartCapturePanel.tsx");
    expect(panel).toContain("Capture Chart for AI");
    expect(panel).toContain("Does not switch timeframe");
    expect(panel).toContain("keep this page open");
    expect(panel).toContain("Select for AI");
    expect(panel.toLowerCase()).not.toContain("/api/forex/ai-analysis");

    const api = read("dev/server/forex-chart-capture-api.ts");
    expect(api).toContain("/api/forex/chart-captures");
    expect(api).toContain("requiresBrowserOpen");
    expect(api).toContain("capturesActiveChartOnly");
    expect(api).toContain('scope: "studio"');
    expect(api).toMatch(/imageSubmissionImplemented:\s*true/);
    expect(api).toContain("requiresExplicitConfirm: true");
    expect(api).toContain("/api/forex/ai-analysis/openai/multi-image");

    const index = read("dev/server/index.ts");
    expect(index).toContain("handleForexChartCaptureApi");

    const css = read("desktop/forex/forex.css");
    expect(css).toContain(".fx-capture-panel");
    expect(css).toContain(".fx-capture-thumb");
  });
});
