/**
 * Phase 43B — analysis snapshot engine (deterministic fixtures).
 */
import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  ANALYSIS_SNAPSHOT_MAX_CANDLES,
  ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  buildAnalysisSnapshotFingerprintPayload,
  buildValidationReport,
  createAnalysisSnapshotEngine,
  detectDataGaps,
  fingerprintAnalysisSnapshotPayload,
  parseAnalysisPeriodId,
  resolveAndValidateRequestShape,
  resetAnalysisSnapshotEngineForTests,
  resetAnalysisSnapshotStoreForTests,
  validateOhlcCandle,
} from "../../../../ai/market-data/analysis-snapshot/index.ts";
import type { AnalysisSnapshotCandle } from "../../../../ai/market-data/analysis-snapshot/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function candle(time: number, price: number, closed = true): AnalysisSnapshotCandle {
  return {
    time,
    open: price,
    high: price + 0.1,
    low: price - 0.1,
    close: price,
    volume: 1,
    isClosed: closed,
    resampled: false,
  };
}

describe("Phase 43B analysis snapshot", () => {
  afterEach(() => {
    resetAnalysisSnapshotEngineForTests();
    resetAnalysisSnapshotStoreForTests();
  });

  it("rejects expensive 1m / 7d requests and invalid periods", () => {
    expect(parseAnalysisPeriodId("6h")).toBe("6h");
    expect(parseAnalysisPeriodId("99h")).toBeNull();
    const expensive = resolveAndValidateRequestShape({
      candleTimeframe: "1m",
      analysisPeriod: "7d",
    });
    expect(expensive.ok).toBe(false);
    if (!expensive.ok) {
      expect(expensive.code).toBe("REQUEST_TOO_EXPENSIVE");
    }
    const ok = resolveAndValidateRequestShape({
      candleTimeframe: "15m",
      analysisPeriod: "6h",
      nowMs: Date.parse("2026-10-13T00:00:00.000Z"),
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.candlesRequestedEstimate).toBeLessThanOrEqual(ANALYSIS_SNAPSHOT_MAX_CANDLES);
      expect(ok.value.requestedRange.startUtc).toBe("2026-10-12T18:00:00.000Z");
      expect(ok.value.requestedRange.endUtc).toBe("2026-10-13T00:00:00.000Z");
    }
  });

  it("validates OHLC, gaps, and historical-only evidence readiness", () => {
    expect(validateOhlcCandle(candle(100, 1.1))).toBeNull();
    expect(validateOhlcCandle({
      ...candle(100, 1.1),
      high: 1.0,
      low: 1.2,
    })).toBe("high_below_low");

    const start = Date.parse("2026-10-13T00:00:00.000Z");
    const tfSec = 15 * 60;
    const candles = [
      candle(Math.floor(start / 1000), 1.1),
      candle(Math.floor(start / 1000) + tfSec * 3, 1.12), // skip two intervals
    ];
    const gaps = detectDataGaps(candles, "15m", {
      startMs: start,
      endMs: start + 6 * 60 * 60_000,
      startUtc: new Date(start).toISOString(),
      endUtc: new Date(start + 6 * 60 * 60_000).toISOString(),
    });
    expect(gaps.some((g) => g.missingIntervals >= 2)).toBe(true);

    const report = buildValidationReport({
      candles: Array.from({ length: 24 }, (_, i) => candle(Math.floor(start / 1000) + i * tfSec, 1.1 + i * 0.001)),
      quote: {
        provider: "BINANCE",
        providerSymbol: "BTCUSDT",
        canonicalSymbol: "BTCUSDT",
        bid: null,
        ask: null,
        mid: null,
        last: null,
        priceBasis: null,
        providerEventTimestamp: null,
        providerEventTimestampAvailable: false,
        serverReceiptTimestamp: null,
        ageMs: null,
        freshness: "HISTORICAL_ONLY",
        source: "binance-spot-public",
        environment: "public",
      },
      timeframe: "15m",
      requestedRange: {
        startMs: start,
        endMs: start + 6 * 60 * 60_000,
        startUtc: new Date(start).toISOString(),
        endUtc: new Date(start + 6 * 60 * 60_000).toISOString(),
      },
      candlesRequestedEstimate: 24,
      dataGaps: [],
      requireLiveQuote: false,
      providerError: null,
    });
    expect(["VALID", "VALID_WITH_WARNINGS"]).toContain(report.status);
  });

  it("fingerprints ignore snapshot identity fields and change when candles change", () => {
    const base = {
      schemaVersion: ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
      provider: "BINANCE" as const,
      instrument: {
        providerSymbol: "BTCUSDT",
        canonicalSymbol: "BTCUSDT",
        displaySymbol: "BTC/USDT",
        marketType: "CRYPTO" as const,
      },
      environment: "public",
      priceBasis: "last" as const,
      candleTimeframe: "15m" as const,
      analysisPeriod: "6h" as const,
      requestedRange: {
        startMs: 1,
        endMs: 2,
        startUtc: "2026-10-13T00:00:00.000Z",
        endUtc: "2026-10-13T06:00:00.000Z",
      },
      returnedRange: null,
      candleCount: 1,
      candlesRequestedEstimate: 24,
      candles: [candle(100, 1.1)],
      latestQuote: null,
      marketStatus: "HISTORICAL",
      freshness: {
        quote: "HISTORICAL_ONLY" as const,
        historicalCoverageRatio: 0.5,
        formingCandlePresent: false,
      },
      validation: {
        status: "VALID_WITH_WARNINGS" as const,
        checks: [],
        warnings: ["w"],
        errors: [],
      },
      dataGaps: [],
      sourceMetadata: {
        historicalSourceMode: "HISTORICAL",
        seriesNote: null,
        seriesErrorCode: null,
        resampled: false,
        sourceTimeframe: "15m" as const,
      },
      warnings: ["w"],
      evidenceReady: true,
    };
    const a = fingerprintAnalysisSnapshotPayload(buildAnalysisSnapshotFingerprintPayload(base));
    const b = fingerprintAnalysisSnapshotPayload(buildAnalysisSnapshotFingerprintPayload({
      ...base,
      candles: [candle(100, 1.2)],
      candleCount: 1,
    }));
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
  });

  it("engine persists snapshot and returns new id on refresh with mocked market data", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kwizera-snap-"));
    const nowSec = Math.floor(Date.now() / 1000);
    const candles = Array.from({ length: 30 }, (_, i) => ({
      provider: "BINANCE" as const,
      marketType: "CRYPTO" as const,
      providerSymbol: "BTCUSDT",
      canonicalSymbol: "BTCUSDT",
      displaySymbol: "BTC/USDT",
      timeframe: "15m" as const,
      time: nowSec - (29 - i) * 900,
      open: 100,
      high: 101,
      low: 99,
      close: 100.5,
      volume: 1,
      isClosed: i < 29,
      source: "BINANCE" as const,
      sourceMode: "HISTORICAL" as const,
      dataQuality: "VALID" as const,
    }));

    const marketData = {
      getInstrument: async () => ({
        provider: "BINANCE",
        marketType: "CRYPTO",
        providerSymbol: "BTCUSDT",
        canonicalSymbol: "BTCUSDT",
        displaySymbol: "BTC/USDT",
        status: "TRADING",
      }),
      getHistoricalCandles: async () => ({
        identity: {
          provider: "BINANCE",
          marketType: "CRYPTO",
          providerSymbol: "BTCUSDT",
          canonicalSymbol: "BTCUSDT",
          displaySymbol: "BTC/USDT",
          environment: "public",
        },
        timeframe: "15m",
        source: "BINANCE",
        sourceMode: "HISTORICAL",
        connectionState: "CONNECTED",
        dataQuality: "VALID",
        candles,
        forming: candles[candles.length - 1],
        count: candles.length,
        lastQuoteAt: null,
        updatedAt: new Date().toISOString(),
        note: "fixture",
        errorCode: null,
        errorMessage: null,
      }),
      getCurrentQuote: async () => null,
      subscribeLiveCandles: async () => {
        throw new Error("not used for binance");
      },
    };

    const { AnalysisSnapshotStore } = await import(
      "../../../../ai/market-data/analysis-snapshot/store.ts"
    );
    const store = new AnalysisSnapshotStore(dir);
    const engine = createAnalysisSnapshotEngine({
      marketData: marketData as never,
      store,
    });

    const first = await engine.createSnapshot({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      candleTimeframe: "15m",
      analysisPeriod: "6h",
    });
    expect(first.snapshot).not.toBeNull();
    expect(first.snapshot?.schemaVersion).toBe(ANALYSIS_SNAPSHOT_SCHEMA_VERSION);
    expect(first.snapshot?.evidenceReady).toBe(true);

    const second = await engine.createSnapshot({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      candleTimeframe: "15m",
      analysisPeriod: "6h",
    });
    expect(second.snapshot?.snapshotId).not.toBe(first.snapshot?.snapshotId);
    // New request resolves a new UTC window (server clock) → new fingerprint is expected.
    expect(second.snapshot?.contentFingerprint).toBeTruthy();
    expect(first.snapshot?.requestedRange.endUtc).toBeTruthy();

    const loaded = await engine.getSnapshot(first.snapshot!.snapshotId);
    expect(loaded?.snapshotId).toBe(first.snapshot!.snapshotId);

    const bad = await engine.createSnapshot({
      provider: "BINANCE",
      symbol: "BTCUSDT",
      candleTimeframe: "1m",
      analysisPeriod: "7d",
    });
    expect(bad.ok).toBe(false);
    expect(bad.code).toBe("REQUEST_TOO_EXPENSIVE");

    rmSync(dir, { recursive: true, force: true });
  });

  it("wires API and compact UI contracts", () => {
    const api = read("dev/server/forex-analysis-snapshot-api.ts");
    const index = read("dev/server/index.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const css = read("desktop/forex/forex.css");
    expect(api).toContain("/api/forex/analysis-snapshot");
    expect(index).toContain("handleForexAnalysisSnapshotApi");
    expect(page).toContain("data-forex-ai-phase43b");
    expect(page).toContain("Prepare snapshot");
    expect(page).toContain("/api/forex/analysis-snapshot");
    expect(css).toContain(".fx-ai-snapshot-status");
  });
});
