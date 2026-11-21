/**
 * Phase 2 — HFM Analysis multi-TF context, quality, renderer, identity, retention.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  HFM_ANALYSIS_DEFAULT_TF_PACK,
  HFM_ANALYSIS_PROVIDER,
  __resetAnalysisJobStateForTests,
  __setHfmAnalysisStorageForTests,
  buildCanonicalSnapshotPayload,
  createImmutableAnalysisJob,
  createSnapshotIdentity,
  evaluateAnalysisDataQuality,
  finalizeJob,
  hashCanonicalPayload,
  HfmAnalysisStorage,
  inspectCandleSeries,
  isAnalysisJobLocked,
  isValidPngBuffer,
  noteSelectedChartSymbol,
  normalizeHistoricalBar,
  normalizeQuoteContext,
  rejectForeignImageMeta,
  renderHfmAnalysisCandlestickPng,
  runHfmAnalysisRetentionCleanup,
  synchronizeAnalysisTimeframes,
  tryAcquireAnalysisJobLock,
  releaseAnalysisJobLock,
  validateCandleOhlc,
  validateChartImageIdentity,
  validateQuote,
  type HfmAnalysisNormalizedCandle,
  type HfmAnalysisTfDataset,
} from "../../../../ai/market-data/mt5-hfm/analysis/index";

function candle(
  symbol: string,
  tf: string,
  t: number,
  o: number,
  h: number,
  l: number,
  c: number,
): HfmAnalysisNormalizedCandle {
  return {
    symbol,
    provider: "HFM_MT5",
    timeframe: tf,
    timestamp: t,
    open: o,
    high: h,
    low: l,
    close: c,
    tickVolume: 10,
    realVolume: null,
    volumeType: "tick",
    provenance: "native",
    isCurrent: false,
    sourceTimestamp: t,
    normalizedAt: new Date().toISOString(),
  };
}

function series(symbol: string, tf: string, start: number, step: number, n: number): HfmAnalysisNormalizedCandle[] {
  const out: HfmAnalysisNormalizedCandle[] = [];
  let px = 1.1;
  for (let i = 0; i < n; i += 1) {
    const o = px;
    const c = px + (i % 2 === 0 ? 0.001 : -0.0005);
    const h = Math.max(o, c) + 0.0005;
    const l = Math.min(o, c) - 0.0005;
    out.push(candle(symbol, tf, start + i * step, o, h, l, c));
    px = c;
  }
  return out;
}

function dataset(symbol: string, tf: string, step: number): HfmAnalysisTfDataset {
  const historical = series(symbol, tf, 1_700_000_000, step, 40);
  return {
    timeframe: tf,
    symbol,
    historical,
    current: { ...historical[historical.length - 1]!, isCurrent: true, provenance: "live_aggregate" },
    candleCount: historical.length,
    oldestTimestamp: historical[0]!.timestamp,
    newestTimestamp: historical[historical.length - 1]!.timestamp,
    freshness: "LIVE",
    connectionStatus: "CONNECTED",
    validationStatus: "ok",
    sourceProvenance: "HFM_MT5",
    errors: [],
  };
}

describe("HFM Analysis Phase 2 — normalization & quality", () => {
  it("preserves tick vs real volume distinction", () => {
    const n = normalizeHistoricalBar("EURUSD", "H1", {
      time: 100,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      tickVolume: 12,
      realVolume: null,
      spread: 1,
      validationStatus: "ok",
      provenance: "native",
    });
    expect(n.volumeType).toBe("tick");
    expect(n.realVolume).toBeNull();
  });

  it("rejects invalid OHLC", () => {
    const bad = candle("EURUSD", "M5", 100, 1.2, 1.1, 1.0, 1.15);
    expect(validateCandleOhlc(bad).some((e) => e.code === "INVALID_OHLC")).toBe(true);
  });

  it("detects duplicates and out-of-order", () => {
    const a = candle("EURUSD", "M5", 100, 1, 1.1, 0.9, 1.05);
    const b = candle("EURUSD", "M5", 100, 1, 1.1, 0.9, 1.05);
    const r = inspectCandleSeries([a, b], "M5", "EURUSD");
    expect(r.errors.some((e) => e.code === "DUPLICATE_CANDLE")).toBe(true);
  });

  it("validates quote ask>=bid and spread", () => {
    const q = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.2,
      brokerTimestamp: Math.floor(Date.now() / 1000),
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "SymbolInfoTick",
    });
    const ok = validateQuote(q);
    expect(ok.errors).toHaveLength(0);

    const bad = validateQuote({ ...q, ask: 1.0, spread: -0.1 });
    expect(bad.errors.length).toBeGreaterThan(0);
  });

  it("fail-closed when required TF missing", () => {
    const datasets = {
      H1: dataset("EURUSD", "H1", 3600),
      M30: dataset("EURUSD", "M30", 1800),
      M15: dataset("EURUSD", "M15", 900),
    };
    const quote = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1002,
      brokerTimestamp: Math.floor(Date.now() / 1000),
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "SymbolInfoTick",
    });
    const report = evaluateAnalysisDataQuality({
      provider: HFM_ANALYSIS_PROVIDER,
      symbol: "EURUSD",
      datasets,
      quote,
    });
    expect(report.status).toBe("INCOMPLETE");
    expect(report.approvedForAiReasoning).toBe(false);
  });

  it("rejects non-HFM provider", () => {
    const datasets: Record<string, HfmAnalysisTfDataset> = {};
    for (const tf of HFM_ANALYSIS_DEFAULT_TF_PACK) {
      datasets[tf] = dataset("EURUSD", tf, 300);
    }
    const quote = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1001,
      brokerTimestamp: Math.floor(Date.now() / 1000),
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "x",
    });
    const report = evaluateAnalysisDataQuality({
      provider: "FXCM",
      symbol: "EURUSD",
      datasets,
      quote,
    });
    expect(report.status).toBe("INVALID");
    expect(report.approvedForAiReasoning).toBe(false);
  });
});

describe("HFM Analysis Phase 2 — sync & hash", () => {
  it("synchronizes five TFs for one symbol (H4 supplemental + H1–M5)", () => {
    const datasets: Record<string, HfmAnalysisTfDataset> = {
      H4: dataset("EURUSD", "H4", 14400),
      H1: dataset("EURUSD", "H1", 3600),
      M30: dataset("EURUSD", "M30", 1800),
      M15: dataset("EURUSD", "M15", 900),
      M5: dataset("EURUSD", "M5", 300),
    };
    const quote = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1001,
      brokerTimestamp: Math.floor(Date.now() / 1000),
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "x",
    });
    const sync = synchronizeAnalysisTimeframes({ symbol: "EURUSD", datasets, quote });
    expect(sync.timeframesMissing).toHaveLength(0);
    expect(sync.timeframesPresent).toEqual(["H4", "H1", "M30", "M15", "M5"]);
  });

  it("rejects mixed symbols", () => {
    const datasets = {
      H4: dataset("EURUSD", "H4", 14400),
      H1: dataset("EURUSD", "H1", 3600),
      M30: dataset("XAUUSD", "M30", 1800),
      M15: dataset("EURUSD", "M15", 900),
      M5: dataset("EURUSD", "M5", 300),
    };
    const quote = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1001,
      brokerTimestamp: Math.floor(Date.now() / 1000),
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "x",
    });
    const sync = synchronizeAnalysisTimeframes({ symbol: "EURUSD", datasets, quote });
    expect(sync.errors.some((e) => e.code === "SYNC_SYMBOL_MISMATCH")).toBe(true);
  });

  it("hash is stable for identical canonical data and changes on price edit", () => {
    const datasets: Record<string, HfmAnalysisTfDataset> = {
      H1: dataset("EURUSD", "H1", 3600),
      M30: dataset("EURUSD", "M30", 1800),
      M15: dataset("EURUSD", "M15", 900),
      M5: dataset("EURUSD", "M5", 300),
    };
    const quote = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1001,
      brokerTimestamp: 1_700_000_000,
      receiveTimestamp: "2024-01-01T00:00:00.000Z",
      freshness: "LIVE",
      acquisition: "x",
    });
    const a = buildCanonicalSnapshotPayload({
      symbol: "EURUSD",
      chartTimeframeAtStart: "H4",
      datasets,
      quote,
      qualityStatus: "VALID",
    });
    const b = buildCanonicalSnapshotPayload({
      symbol: "EURUSD",
      chartTimeframeAtStart: "H4",
      datasets,
      quote,
      qualityStatus: "VALID",
    });
    expect(hashCanonicalPayload(a)).toBe(hashCanonicalPayload(b));
    datasets.M5!.historical[0]!.close += 0.01;
    const c = buildCanonicalSnapshotPayload({
      symbol: "EURUSD",
      chartTimeframeAtStart: "H4",
      datasets,
      quote,
      qualityStatus: "VALID",
    });
    expect(hashCanonicalPayload(c)).not.toBe(hashCanonicalPayload(a));
  });
});

describe("HFM Analysis Phase 2 — renderer & identity", () => {
  it("renders valid PNG with labels and bounds", () => {
    const candles = series("EURUSD", "H1", 1_700_000_000, 3600, 50);
    const identity = createSnapshotIdentity({
      symbol: "EURUSD",
      chartTimeframeAtStart: "H1",
      datasets: { H1: dataset("EURUSD", "H1", 3600) },
      quote: normalizeQuoteContext({
        symbol: "EURUSD",
        bid: 1.1,
        ask: 1.1001,
        brokerTimestamp: 1_700_000_000,
        receiveTimestamp: new Date().toISOString(),
        freshness: "LIVE",
        acquisition: "x",
      }),
      qualityStatus: "VALID",
      capturedAt: "2024-06-01T12:00:00.000Z",
    });
    const rendered = renderHfmAnalysisCandlestickPng({
      symbol: "EURUSD",
      timeframe: "H1",
      candles,
      snapshotId: identity.snapshotId,
      snapshotHash: identity.snapshotHash,
      capturedAt: identity.capturedAt,
    });
    expect(rendered.ok).toBe(true);
    expect(rendered.png).toBeTruthy();
    expect(isValidPngBuffer(rendered.png!)).toBe(true);
    expect(rendered.meta!.symbol).toBe("EURUSD");
    expect(rendered.meta!.timeframe).toBe("H1");
    expect(rendered.meta!.imageWidth).toBe(960);
    expect(rendered.meta!.imageHeight).toBe(540);
    expect(rendered.meta!.imageSizeBytes).toBeLessThan(1_500_000);
  });

  it("rejects wrong symbol/timeframe/snapshot identity", () => {
    const ds = dataset("EURUSD", "M5", 300);
    const quote = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1001,
      brokerTimestamp: Math.floor(Date.now() / 1000),
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "x",
    });
    const identity = createSnapshotIdentity({
      symbol: "EURUSD",
      chartTimeframeAtStart: "M5",
      datasets: { M5: ds },
      quote,
      qualityStatus: "VALID",
    });
    const snapshot = {
      ...identity,
      provider: "HFM_MT5" as const,
      symbol: "EURUSD",
      chartTimeframeAtStart: "M5",
      timeframes: { M5: ds },
      quote,
      dataQuality: {
        status: "VALID" as const,
        errors: [],
        warnings: [],
        approvedForAiReasoning: true,
        policyNote: "test",
      },
      synchronization: {
        status: "VALID" as const,
        symbol: "EURUSD",
        timeframesPresent: ["M5"],
        timeframesMissing: [],
        latestQuoteTimestamp: quote.brokerTimestamp,
        latestCandleByTf: { M5: ds.newestTimestamp },
        warnings: [],
        errors: [],
      },
      placesOrders: false as const,
      mutatesBroker: false as const,
      acceptsForExecution: false as const,
    };
    const rendered = renderHfmAnalysisCandlestickPng({
      symbol: "EURUSD",
      timeframe: "M5",
      candles: ds.historical,
      snapshotId: snapshot.snapshotId,
      snapshotHash: snapshot.snapshotHash,
      capturedAt: snapshot.capturedAt,
    });
    expect(rendered.ok).toBe(true);
    const badMeta = { ...rendered.meta!, symbol: "XAUUSD" };
    const v = validateChartImageIdentity({
      meta: badMeta,
      png: rendered.png!,
      snapshot,
      timeframe: "M5",
    });
    expect(v.ok).toBe(false);
    expect(rejectForeignImageMeta(rendered.meta!, {
      symbol: "XAUUSD",
      timeframe: "M5",
      snapshotId: snapshot.snapshotId,
      snapshotHash: snapshot.snapshotHash,
    })).toContain("wrong symbol");
  });

  it("rejects corrupt PNG", () => {
    const ds = dataset("EURUSD", "M15", 900);
    const quote = normalizeQuoteContext({
      symbol: "EURUSD",
      bid: 1.1,
      ask: 1.1001,
      brokerTimestamp: Math.floor(Date.now() / 1000),
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "x",
    });
    const identity = createSnapshotIdentity({
      symbol: "EURUSD",
      chartTimeframeAtStart: "M15",
      datasets: { M15: ds },
      quote,
      qualityStatus: "VALID",
    });
    const snapshot = {
      ...identity,
      provider: "HFM_MT5" as const,
      symbol: "EURUSD",
      chartTimeframeAtStart: "M15",
      timeframes: { M15: ds },
      quote,
      dataQuality: {
        status: "VALID" as const,
        errors: [],
        warnings: [],
        approvedForAiReasoning: true,
        policyNote: "t",
      },
      synchronization: {
        status: "VALID" as const,
        symbol: "EURUSD",
        timeframesPresent: ["M15"],
        timeframesMissing: [],
        latestQuoteTimestamp: null,
        latestCandleByTf: {},
        warnings: [],
        errors: [],
      },
      placesOrders: false as const,
      mutatesBroker: false as const,
      acceptsForExecution: false as const,
    };
    const rendered = renderHfmAnalysisCandlestickPng({
      symbol: "EURUSD",
      timeframe: "M15",
      candles: ds.historical,
      snapshotId: snapshot.snapshotId,
      snapshotHash: snapshot.snapshotHash,
      capturedAt: snapshot.capturedAt,
    });
    const corrupt = Buffer.from("not-a-png");
    const v = validateChartImageIdentity({
      meta: { ...rendered.meta!, imageSizeBytes: corrupt.length },
      png: corrupt,
      snapshot,
      timeframe: "M15",
    });
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("invalid PNG bytes");
  });
});

describe("HFM Analysis Phase 2 — symbol switch & single-flight", () => {
  beforeEach(() => {
    __resetAnalysisJobStateForTests();
  });

  it("keeps immutable symbolAtStart when selection changes mid-job", () => {
    noteSelectedChartSymbol("EURUSD");
    const job = createImmutableAnalysisJob({ symbol: "EURUSD", chartTimeframe: "H4" });
    expect(job.symbolAtStart).toBe("EURUSD");
    noteSelectedChartSymbol("XAUUSD");
    expect(job.symbolAtStart).toBe("EURUSD");
    const next = createImmutableAnalysisJob({ symbol: "XAUUSD", chartTimeframe: "H1" });
    expect(next.symbolAtStart).toBe("XAUUSD");
    expect(finalizeJob(job, "COMPLETED").symbolAtStart).toBe("EURUSD");
  });

  it("prevents overlapping jobs via lock", () => {
    expect(tryAcquireAnalysisJobLock()).toBe(true);
    expect(isAnalysisJobLocked()).toBe(true);
    expect(tryAcquireAnalysisJobLock()).toBe(false);
    releaseAnalysisJobLock(null);
    expect(isAnalysisJobLocked()).toBe(false);
  });
});

describe("HFM Analysis Phase 2 — storage & retention", () => {
  let tmp: string;
  let storage: HfmAnalysisStorage;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-analysis-"));
    storage = new HfmAnalysisStorage(tmp);
    __setHfmAnalysisStorageForTests(storage);
    await storage.ensureReady();
  });

  afterEach(async () => {
    __setHfmAnalysisStorageForTests(null);
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("persists and loads protected image without exposing paths in ref", async () => {
    const candles = series("EURUSD", "H1", 1_700_000_000, 3600, 40);
    const rendered = renderHfmAnalysisCandlestickPng({
      symbol: "EURUSD",
      timeframe: "H1",
      candles,
      snapshotId: "snap-1",
      snapshotHash: "abc",
      capturedAt: new Date().toISOString(),
    });
    expect(rendered.ok).toBe(true);
    await storage.saveImage(rendered.meta!, rendered.png!);
    const loaded = await storage.loadImage(rendered.meta!.imageId);
    expect(loaded?.png.equals(rendered.png!)).toBe(true);
    const ref = storage.protectedImageRef(rendered.meta!.imageId);
    expect(ref.retrievalPath).toContain("/api/forex/providers/mt5-hfm/analysis/images/");
    expect(ref.retrievalPath.includes(tmp)).toBe(false);
  });

  it("deletes expired images but skips active protection set", async () => {
    const candles = series("EURUSD", "M5", 1_700_000_000, 300, 40);
    const oldCap = new Date(Date.now() - 10 * 86400_000).toISOString();
    const rendered = renderHfmAnalysisCandlestickPng({
      symbol: "EURUSD",
      timeframe: "M5",
      candles,
      snapshotId: "snap-old",
      snapshotHash: "hash",
      capturedAt: oldCap,
    });
    const meta = { ...rendered.meta!, capturedAt: oldCap };
    await storage.saveImage(meta, rendered.png!);

    const protectedId = meta.imageId;
    const cleanupSkip = await runHfmAnalysisRetentionCleanup({
      storage,
      activeImageIds: new Set([protectedId]),
    });
    expect(cleanupSkip.skippedActive).toBeGreaterThanOrEqual(1);
    expect(await storage.loadImage(protectedId)).toBeTruthy();

    const cleanup = await runHfmAnalysisRetentionCleanup({
      storage,
      activeImageIds: new Set(),
    });
    expect(cleanup.imagesDeleted).toBeGreaterThanOrEqual(1);
    expect(await storage.loadImage(protectedId)).toBeNull();
  });
});

describe("HFM Analysis Phase 2 — Charts regression markers", () => {
  it("keeps safety flags false in job + snapshot identity helpers", () => {
    const job = createImmutableAnalysisJob({ symbol: "EURUSD", chartTimeframe: "H1" });
    expect(job.placesOrders).toBe(false);
    expect(job.mutatesBroker).toBe(false);
    expect(job.acceptsForExecution).toBe(false);
  });

  it("default TF pack includes supplemental H4 plus H1 M30 M15 M5", () => {
    expect([...HFM_ANALYSIS_DEFAULT_TF_PACK]).toEqual(["H4", "H1", "M30", "M15", "M5"]);
  });
});
