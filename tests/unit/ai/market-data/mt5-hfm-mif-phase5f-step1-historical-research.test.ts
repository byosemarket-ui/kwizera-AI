/**
 * Phase 5F STEP 1 — Historical Research Foundation.
 * Fixture / injected-fetch tests. Live HFM verification is separate on VPS.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { HfmHistoricalResult } from "../../../../ai/market-data/mt5-hfm/historical-engine";
import {
  MIF_RESEARCH_MAX_BARS_PER_PAGE,
  MIF_RESEARCH_PROVIDER_ID,
  __setMifHistoricalResearchStorageForTests,
  assertCostAdjustedBacktestAllowed,
  assertNoFutureBarsBeyondTip,
  assessResearchEligibility,
  buildResearchCoverageMatrix,
  buildResearchDatasetManifest,
  classifyResearchCostAvailability,
  classifyTimeframeLayer,
  clipResearchBarsToTip,
  computeResearchDatasetContentHash,
  ingestResearchBars,
  isOperationallyExportableTimeframe,
  isResearchExportExplicitlyEnabled,
  MIF_RESEARCH_COST_SOURCE_EVIDENCE,
  MifHistoricalResearchStorage,
  researchCostCoverageStatus,
  runResearchHistoricalExport,
  sealResearchDataset,
  toStoredResearchBar,
  type MifResearchStoredBar,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;
const STEP = 3600;

function makeBar(
  i: number,
  opts?: { bad?: boolean; spread?: number | null; dupTime?: number },
): {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
  validationStatus: "ok" | "rejected";
  provenance: "native";
} {
  const time = opts?.dupTime ?? T0 + i * STEP;
  if (opts?.bad) {
    return {
      time,
      open: 10,
      high: 9, // invalid OHLC
      low: 8,
      close: 9.5,
      tickVolume: 1,
      realVolume: null,
      spread: 12,
      validationStatus: "ok",
      provenance: "native",
    };
  }
  const close = 2000 + i;
  return {
    time,
    open: close - 0.2,
    high: close + 0.5,
    low: close - 0.5,
    close,
    tickVolume: 10 + i,
    realVolume: null,
    spread: opts?.spread === undefined ? 15 : opts.spread,
    validationStatus: "ok",
    provenance: "native",
  };
}

function mockFetchPages(pages: Array<{ bars: ReturnType<typeof makeBar>[]; hasMore: boolean }>) {
  let call = 0;
  return async (opts: {
    symbol: string;
    timeframe: string;
    limit?: number;
    startPos?: number;
  }): Promise<HfmHistoricalResult> => {
    const page = pages[call] ?? { bars: [], hasMore: false };
    call += 1;
    const limit = Math.min(MIF_RESEARCH_MAX_BARS_PER_PAGE, opts.limit ?? 300);
    const bars = page.bars.slice(0, limit);
    return {
      provider: "HFM_MT5",
      environment: "demo",
      symbol: opts.symbol,
      timeframe: opts.timeframe,
      available: bars.length > 0,
      bars,
      count: bars.length,
      requestedCount: limit,
      hasMore: page.hasMore,
      source: "test_mock",
      freshness: "test",
      oldestTimestamp: bars[0]?.time ?? null,
      newestTimestamp: bars[bars.length - 1]?.time ?? null,
      completeness: "broker",
      errors: [],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  };
}

describe("Phase 5F STEP 1 — historical research foundation", () => {
  let tmp: string;
  let store: MifHistoricalResearchStorage;
  const prevExportEnv = process.env.KWIZERA_MIF_RESEARCH_EXPORT_ENABLED;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-research-"));
    store = new MifHistoricalResearchStorage(tmp);
    __setMifHistoricalResearchStorageForTests(store);
    delete process.env.KWIZERA_MIF_RESEARCH_EXPORT_ENABLED;
  });

  afterEach(() => {
    __setMifHistoricalResearchStorageForTests(null);
    if (prevExportEnv === undefined) delete process.env.KWIZERA_MIF_RESEARCH_EXPORT_ENABLED;
    else process.env.KWIZERA_MIF_RESEARCH_EXPORT_ENABLED = prevExportEnv;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("keeps export OFF by default (no auto-worker)", () => {
    expect(isResearchExportExplicitlyEnabled()).toBe(false);
  });

  it("rejects export when gate is off", async () => {
    const result = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "H1",
      storage: store,
      fetchFn: mockFetchPages([{ bars: [makeBar(0)], hasMore: false }]),
    });
    expect(result.job.status).toBe("FAILED");
    expect(result.job.incompleteReason).toBe("EXPORT_DISABLED");
    expect(result.job.autoWorker).toBe(false);
    expect(result.job.mutatesBroker).toBe(false);
  });

  it("paginates serially with page size ≤ 300 and tracks progress", async () => {
    // CopyRates: page0 = newest window; page1 = older history (lower open times).
    const page0 = Array.from({ length: 300 }, (_, i) => makeBar(50 + i));
    const page1 = Array.from({ length: 50 }, (_, i) => makeBar(i));
    const result = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "H1",
      allowExport: true,
      maxPages: 5,
      maxBars: 1000,
      storage: store,
      fetchFn: mockFetchPages([
        { bars: page0, hasMore: true },
        { bars: page1, hasMore: false },
      ]),
    });
    expect(result.job.pagesFetched).toBe(2);
    expect(result.job.barsAccepted).toBe(350);
    expect(result.job.status).toBe("COMPLETED");
    expect(result.manifest?.status).toBe("COMPLETE");
    expect(result.manifest?.provider).toBe(MIF_RESEARCH_PROVIDER_ID);
    expect(result.manifest?.candleCount).toBe(350);
  });

  it("isolates provider — never accepts non-HFM_MT5", async () => {
    const fetchFn = async (): Promise<HfmHistoricalResult> =>
      ({
        provider: "OTHER" as "HFM_MT5",
        environment: "demo",
        symbol: "EURUSD",
        timeframe: "H1",
        available: true,
        bars: [makeBar(0)],
        count: 1,
        requestedCount: 1,
        hasMore: false,
        source: "bad",
        freshness: null,
        oldestTimestamp: T0,
        newestTimestamp: T0,
        completeness: null,
        errors: [],
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
    const result = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "H1",
      allowExport: true,
      storage: store,
      fetchFn,
    });
    expect(result.job.errors).toContain("PROVIDER_ISOLATION_VIOLATION");
    expect(result.bars.length).toBe(0);
  });

  it("rejects invalid OHLC and duplicate/out-of-order times", () => {
    const first = toStoredResearchBar(makeBar(0))!;
    const ingested = ingestResearchBars(
      [first],
      [makeBar(0, { dupTime: first.time }), makeBar(1, { bad: true }), makeBar(2)],
    );
    expect(ingested.accepted.length).toBe(2);
    expect(ingested.invalidOhlcRejected).toBe(1);
    expect(ingested.duplicateOrOutOfOrderRejected).toBe(1);
  });

  it("preserves chronological order after ingest", () => {
    const ingested = ingestResearchBars([], [makeBar(2), makeBar(0), makeBar(1)]);
    expect(ingested.accepted.map((b) => b.time)).toEqual([T0, T0 + STEP, T0 + 2 * STEP]);
  });

  it("computes deterministic content hashes", () => {
    const bars: MifResearchStoredBar[] = [0, 1, 2].map((i) => toStoredResearchBar(makeBar(i))!);
    const h1 = computeResearchDatasetContentHash({
      provider: "HFM_MT5",
      instrument: "EURUSD",
      timeframe: "H1",
      timebase: "BROKER_SERVER",
      version: 1,
      bars,
    });
    const h2 = computeResearchDatasetContentHash({
      provider: "HFM_MT5",
      instrument: "EURUSD",
      timeframe: "H1",
      timebase: "BROKER_SERVER",
      version: 1,
      bars: [...bars].reverse(),
    });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("persists atomically and refuses overwrite of different immutable version content", async () => {
    const bars = [0, 1, 2].map((i) => toStoredResearchBar(makeBar(i))!);
    const sealed = await sealResearchDataset(store, {
      instrument: "EURUSD",
      timeframe: "H1",
      bars,
      rejectedCandles: 0,
      duplicateOrOutOfOrderRejected: 0,
      invalidOhlcRejected: 0,
      incompleteExportRange: false,
      inclusionRules: {
        providerMustBe: "HFM_MT5",
        timeframeMustBeOperationallyExportable: true,
        rejectInvalidOhlc: true,
        rejectDuplicateOrOutOfOrder: true,
        synthesizeCandles: false,
        interpolateGaps: false,
        repairSilently: false,
        allowOtherProviders: false,
        requestedStartTimeSec: null,
        requestedEndTimeSec: null,
        maxBars: 100,
        maxPages: 2,
      },
      exportProvenance: {
        exportJobId: "job-1",
        pagesFetched: 1,
        lastStartPos: 0,
        nextStartPos: null,
        requestedCountPerPage: 300,
        returnedBarTotal: 3,
        hasMoreAtStop: false,
        incompleteReason: null,
        sourceFreshnessNotes: [],
        fetchErrors: [],
      },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    // Idempotent same content
    const again = await sealResearchDataset(store, {
      instrument: "EURUSD",
      timeframe: "H1",
      bars,
      rejectedCandles: 0,
      duplicateOrOutOfOrderRejected: 0,
      invalidOhlcRejected: 0,
      incompleteExportRange: false,
      inclusionRules: sealed.manifest.inclusionRules,
      exportProvenance: sealed.manifest.exportProvenance,
    });
    expect(again.ok).toBe(true);

    // Different bars → different datasetId (new hash); same version path only conflicts on same id
    const otherBars = [0, 1, 2, 3].map((i) => toStoredResearchBar(makeBar(i))!);
    const other = buildResearchDatasetManifest({
      instrument: "EURUSD",
      timeframe: "H1",
      bars: otherBars,
      rejectedCandles: 0,
      duplicateOrOutOfOrderRejected: 0,
      invalidOhlcRejected: 0,
      incompleteExportRange: false,
      inclusionRules: sealed.manifest.inclusionRules,
      exportProvenance: sealed.manifest.exportProvenance,
    });
    expect(other.datasetId).not.toBe(sealed.manifest.datasetId);

    // Force conflict: write alternate content under same datasetId/version path
    const conflict = await store.persistImmutableDataset({
      manifest: { ...sealed.manifest, contentHash: "deadbeef".repeat(8) },
      bars: otherBars,
    });
    expect(conflict.ok).toBe(false);
    if (!conflict.ok) expect(conflict.code).toBe("DATASET_VERSION_EXISTS");
  });

  it("marks incomplete exports as INCOMPLETE datasets (not COMPLETE)", async () => {
    const page0 = Array.from({ length: 10 }, (_, i) => makeBar(i));
    const result = await runResearchHistoricalExport({
      instrument: "XAUUSD",
      timeframe: "H1",
      allowExport: true,
      maxPages: 10,
      maxBars: 10,
      storage: store,
      fetchFn: mockFetchPages([{ bars: page0, hasMore: true }]),
    });
    expect(result.job.status).toBe("INCOMPLETE");
    expect(result.manifest?.status).toBe("INCOMPLETE");
    expect(result.manifest?.qualitySummary.incompleteExportRange).toBe(true);
    expect(result.job.incompleteReason).toBe("MAX_BARS_REACHED");
  });

  it("marks REQUESTED_START_REACHED exports COMPLETE even when start falls between bars", async () => {
    const page0 = Array.from({ length: 10 }, (_, i) => makeBar(10 + i));
    const page1 = Array.from({ length: 10 }, (_, i) => makeBar(i));
    // Requested start between bar 4 and 5 → page1 oldest is bar0 time <= start.
    const requestedStart = T0 + 4 * STEP + Math.floor(STEP / 2);
    const result = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "H1",
      allowExport: true,
      maxPages: 5,
      requestedStartTimeSec: requestedStart,
      storage: store,
      fetchFn: mockFetchPages([
        { bars: page0, hasMore: true },
        { bars: page1, hasMore: true },
      ]),
    });
    expect(result.job.incompleteReason).toBeNull();
    expect(result.job.status).toBe("COMPLETED");
    expect(result.manifest?.status).toBe("COMPLETE");
    expect(result.manifest?.researchEligibility.suitableForCandleResearch).toBe(true);
    expect(result.manifest?.researchEligibility.suitableForCostAdjustedBacktest).toBe(false);
  });

  it("records MAX_PAGES_REACHED when page budget ends with hasMore", async () => {
    const page0 = Array.from({ length: 5 }, (_, i) => makeBar(5 + i));
    const page1 = Array.from({ length: 5 }, (_, i) => makeBar(i));
    const result = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "H1",
      allowExport: true,
      maxPages: 2,
      maxBars: 1000,
      storage: store,
      fetchFn: mockFetchPages([
        { bars: page0, hasMore: true },
        { bars: page1, hasMore: true },
      ]),
    });
    expect(result.job.status).toBe("INCOMPLETE");
    expect(result.job.incompleteReason).toBe("MAX_PAGES_REACHED");
    expect(result.manifest?.status).toBe("INCOMPLETE");
  });

  it("supports resumable single-page export", async () => {
    // Newest first, then older — matches CopyRates startPos pagination.
    const page0 = Array.from({ length: 5 }, (_, i) => makeBar(5 + i));
    const page1 = Array.from({ length: 5 }, (_, i) => makeBar(i));
    const fetchFn = mockFetchPages([
      { bars: page0, hasMore: true },
      { bars: page1, hasMore: false },
    ]);
    const first = await runResearchHistoricalExport({
      instrument: "GBPUSD",
      timeframe: "M15",
      allowExport: true,
      singlePage: true,
      storage: store,
      fetchFn,
    });
    expect(first.job.status).toBe("INCOMPLETE");
    expect(first.job.pagesFetched).toBe(1);
    expect(first.bars.length).toBe(5);
    expect(first.manifest).toBeNull(); // mid-resume pause does not seal a dataset

    const second = await runResearchHistoricalExport({
      instrument: "GBPUSD",
      timeframe: "M15",
      allowExport: true,
      resumeJobId: first.job.jobId,
      storage: store,
      fetchFn,
    });
    expect(second.job.pagesFetched).toBe(2);
    expect(second.bars.length).toBe(10);
    expect(second.job.status).toBe("COMPLETED");
    expect(second.manifest?.status).toBe("COMPLETE");
  });

  it("classifies PIT metadata as current-observation / unavailable — never historical authority", async () => {
    const bars = [toStoredResearchBar(makeBar(0))!];
    const sealed = await sealResearchDataset(store, {
      instrument: "EURUSD",
      timeframe: "H1",
      bars,
      rejectedCandles: 0,
      duplicateOrOutOfOrderRejected: 0,
      invalidOhlcRejected: 0,
      incompleteExportRange: false,
      catalogRow: {
        providerSymbol: "EURUSD",
        digits: 5,
        tickSize: 0.00001,
        contractSize: 100000,
        sessions: { tradeSessionDays: 5 },
        catalogVersion: "test-cat-1",
      },
      inclusionRules: {
        providerMustBe: "HFM_MT5",
        timeframeMustBeOperationallyExportable: true,
        rejectInvalidOhlc: true,
        rejectDuplicateOrOutOfOrder: true,
        synthesizeCandles: false,
        interpolateGaps: false,
        repairSilently: false,
        allowOtherProviders: false,
        requestedStartTimeSec: null,
        requestedEndTimeSec: null,
        maxBars: 10,
        maxPages: 1,
      },
      exportProvenance: {
        exportJobId: "job-pit",
        pagesFetched: 1,
        lastStartPos: 0,
        nextStartPos: null,
        requestedCountPerPage: 300,
        returnedBarTotal: 1,
        hasMoreAtStop: false,
        incompleteReason: null,
        sourceFreshnessNotes: [],
        fetchErrors: [],
      },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.manifest.pitMetadata.sessions.historicalAuthority).toBe(false);
    expect(sealed.manifest.pitMetadata.sessions.availability).toBe("CURRENT_METADATA_ONLY");
    expect(sealed.manifest.pitMetadata.instrumentSpec.availability).toBe("CURRENT_METADATA_ONLY");
    expect(sealed.manifest.pitMetadata.instrumentSpec.effectiveAt).toBeNull();
    expect(sealed.manifest.qualitySummary.sessionUncertainty).toBe(true);
    expect(sealed.manifest.qualitySummary.metadataUncertainty).toBe(true);
  });

  it("classifies cost availability without inventing slippage/commission/swap", () => {
    const withSpread = [toStoredResearchBar(makeBar(0, { spread: 20 }))!];
    const costs = classifyResearchCostAvailability(withSpread);
    expect(costs.spread.availability).toBe("SOURCE_BACKED");
    expect(costs.slippage.availability).toBe("UNAVAILABLE");
    expect(costs.commission.availability).toBe("UNAVAILABLE");
    expect(costs.swap.availability).toBe("UNAVAILABLE");

    const noSpread = [toStoredResearchBar(makeBar(1, { spread: null }))!];
    expect(classifyResearchCostAvailability(noSpread).spread.availability).toBe("UNAVAILABLE");
  });

  it("clips research bars to tip with no future leakage", () => {
    const bars = [0, 1, 2, 3, 4].map((i) => toStoredResearchBar(makeBar(i))!);
    const tip = T0 + 2 * STEP;
    const clipped = clipResearchBarsToTip(bars, tip);
    expect(clipped.bars.length).toBe(3);
    expect(clipped.futureBarsExcluded).toBe(2);
    expect(clipped.noFutureLeakage).toBe(true);
    expect(assertNoFutureBarsBeyondTip(clipped.bars, tip).ok).toBe(true);
    expect(assertNoFutureBarsBeyondTip(bars, tip).ok).toBe(false);
  });

  it("distinguishes timeframe layers; does not expand verified-live set", () => {
    expect(isOperationallyExportableTimeframe("H1")).toBe(true);
    expect(isOperationallyExportableTimeframe("W1")).toBe(false);
    expect(isOperationallyExportableTimeframe("H2")).toBe(false);
    const w1 = classifyTimeframeLayer("W1");
    expect(w1.codeSupported).toBe(true);
    expect(w1.verifiedLive).toBe(false);
    expect(w1.operationallyExportable).toBe(false);

    return runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "W1",
      allowExport: true,
      storage: store,
      fetchFn: mockFetchPages([{ bars: [makeBar(0)], hasMore: false }]),
    }).then((r) => {
      expect(r.job.status).toBe("FAILED");
      expect(r.job.incompleteReason).toBe("TIMEFRAME_NOT_EXPORTABLE");
    });
  });

  it("lists registry and loads bounded bar pages after seal", async () => {
    const result = await runResearchHistoricalExport({
      instrument: "USDJPY",
      timeframe: "H4",
      allowExport: true,
      storage: store,
      fetchFn: mockFetchPages([
        { bars: Array.from({ length: 20 }, (_, i) => makeBar(i)), hasMore: false },
      ]),
    });
    expect(result.manifest).toBeTruthy();
    const entries = await store.listRegistry();
    expect(entries.some((e) => e.datasetId === result.manifest!.datasetId)).toBe(true);
    const page = await store.getDatasetBars(result.manifest!.datasetId, 1, {
      offset: 5,
      limit: 5,
    });
    expect(page?.total).toBe(20);
    expect(page?.bars.length).toBe(5);
    expect(page?.bars[0]?.time).toBe(T0 + 5 * STEP);

    // Durability under research root (not tmpfs path)
    expect(store.root.replace(/\\/g, "/")).toContain("mt5-hfm/research");
    expect(fs.existsSync(path.join(store.root, "registry.json"))).toBe(true);
  });

  it("survives interrupted write leftover tmp without corrupting final file", async () => {
    const bars = [toStoredResearchBar(makeBar(0))!];
    const sealed = await sealResearchDataset(store, {
      instrument: "EURUSD",
      timeframe: "M5",
      bars,
      rejectedCandles: 0,
      duplicateOrOutOfOrderRejected: 0,
      invalidOhlcRejected: 0,
      incompleteExportRange: false,
      inclusionRules: {
        providerMustBe: "HFM_MT5",
        timeframeMustBeOperationallyExportable: true,
        rejectInvalidOhlc: true,
        rejectDuplicateOrOutOfOrder: true,
        synthesizeCandles: false,
        interpolateGaps: false,
        repairSilently: false,
        allowOtherProviders: false,
        requestedStartTimeSec: null,
        requestedEndTimeSec: null,
        maxBars: 10,
        maxPages: 1,
      },
      exportProvenance: {
        exportJobId: "job-atom",
        pagesFetched: 1,
        lastStartPos: 0,
        nextStartPos: null,
        requestedCountPerPage: 300,
        returnedBarTotal: 1,
        hasMoreAtStop: false,
        incompleteReason: null,
        sourceFreshnessNotes: [],
        fetchErrors: [],
      },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const manifestPath = path.join(
      store.datasetVersionDir(sealed.manifest.datasetId, 1),
      "manifest.json",
    );
    // Simulate crash leftover
    fs.writeFileSync(`${manifestPath}.tmp.999.crash`, "{broken", "utf8");
    const loaded = await store.getDatasetManifest(sealed.manifest.datasetId, 1);
    expect(loaded?.contentHash).toBe(sealed.manifest.contentHash);
    expect(loaded?.placesOrders).toBe(false);
  });

  it("exposes safety flags on manifests and jobs", async () => {
    const result = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "D1",
      allowExport: true,
      storage: store,
      fetchFn: mockFetchPages([{ bars: [makeBar(0), makeBar(1)], hasMore: false }]),
    });
    expect(result.manifest?.placesOrders).toBe(false);
    expect(result.manifest?.mutatesBroker).toBe(false);
    expect(result.manifest?.acceptsForExecution).toBe(false);
    expect(result.manifest?.researchReadOnly).toBe(true);
    expect(result.job.placesOrders).toBe(false);
    expect(result.job.mutatesBroker).toBe(false);
  });

  it("wires research API surface as read-only with export gate and bounded bar page", () => {
    const api = fs.readFileSync(
      path.join(process.cwd(), "dev/server/mt5-hfm-mif-api.ts"),
      "utf8",
    );
    expect(api).toContain("/research/datasets");
    expect(api).toContain("/research/export");
    expect(api).toContain("/research/coverage");
    expect(api).toContain("EXPORT_DISABLED");
    expect(api).toContain("isResearchExportExplicitlyEnabled");
    expect(api).toContain("MIF_RESEARCH_API_MAX_BAR_PAGE");
    expect(api).toContain("autoWorker: false");
    expect(api).toContain("verifyDatasetConsistency");
    expect(api).not.toMatch(/research\/export[\s\S]{0,400}mutatesBroker:\s*true/);
  });

  it("builds coverage matrix distinguishing archived vs exportable layers", async () => {
    await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "H1",
      allowExport: true,
      storage: store,
      fetchFn: mockFetchPages([
        { bars: Array.from({ length: 5 }, (_, i) => makeBar(i)), hasMore: false },
      ]),
    });
    const matrix = await buildResearchCoverageMatrix(store, {
      instruments: ["EURUSD", "GBPUSD"],
      timeframes: ["H1", "W1"],
    });
    expect(matrix.summary.cells).toBe(4);
    const eurusdH1 = matrix.cells.find((c) => c.instrument === "EURUSD" && c.timeframe === "H1");
    expect(eurusdH1?.operationallyExportable).toBe(true);
    expect(eurusdH1?.actuallyArchived).toBe(true);
    expect(eurusdH1?.researchEligible).toBe(true);
    const w1 = matrix.cells.find((c) => c.timeframe === "W1");
    expect(w1?.verifiedLive).toBe(false);
    expect(w1?.operationallyExportable).toBe(false);
  });

  it("exposes research eligibility and forbids cost-adjusted backtest when costs incomplete", async () => {
    const result = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "H1",
      allowExport: true,
      storage: store,
      fetchFn: mockFetchPages([
        { bars: Array.from({ length: 5 }, (_, i) => makeBar(i)), hasMore: false },
      ]),
      catalogRow: {
        providerSymbol: "EURUSD",
        digits: 5,
        tickSize: 0.00001,
        sessions: { tradeSessionDays: 5 },
      },
    });
    expect(result.manifest?.researchEligibility.costCompleteness).toBe("COST_INCOMPLETE");
    expect(result.manifest?.researchEligibility.suitableForCostAdjustedBacktest).toBe(false);
    expect(result.manifest?.researchEligibility.suitableForCandleResearch).toBe(true);
    expect(result.manifest?.researchEligibility.metadataAuthority).toBe("METADATA_LIMITED");
    expect(result.manifest?.pitMetadata.observationCoverage.appliesRetrospectively).toBe(false);
    const guard = assertCostAdjustedBacktestAllowed(result.manifest!.researchEligibility);
    expect(guard.ok).toBe(false);

    const costs = classifyResearchCostAvailability(
      Array.from({ length: 3 }, (_, i) => toStoredResearchBar(makeBar(i))!),
    );
    expect(researchCostCoverageStatus(costs).allowsCostAdjustedResults).toBe(false);
    expect(MIF_RESEARCH_COST_SOURCE_EVIDENCE.findings.slippage.availability).toBe("UNAVAILABLE");
    expect(MIF_RESEARCH_COST_SOURCE_EVIDENCE.nativeHstParser.implemented).toBe(false);
  });

  it("rejects stale/mismatched resume and overlapping pages without looping", async () => {
    const page0 = Array.from({ length: 5 }, (_, i) => makeBar(10 + i));
    const first = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "M30",
      allowExport: true,
      singlePage: true,
      storage: store,
      fetchFn: mockFetchPages([{ bars: page0, hasMore: true }]),
    });
    expect(first.job.status).toBe("INCOMPLETE");

    const mismatch = await runResearchHistoricalExport({
      instrument: "GBPUSD",
      timeframe: "M30",
      allowExport: true,
      resumeJobId: first.job.jobId,
      storage: store,
      fetchFn: mockFetchPages([{ bars: page0, hasMore: false }]),
    });
    expect(mismatch.job.incompleteReason).toBe("RESUME_IDENTITY_MISMATCH");
    // Original job must remain resumable (not overwritten).
    const still = await store.getExportJob(first.job.jobId);
    expect(still?.status).toBe("INCOMPLETE");
    expect(still?.instrument).toBe("EURUSD");

    const missing = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "M30",
      allowExport: true,
      resumeJobId: "export:missing:job",
      storage: store,
      fetchFn: mockFetchPages([{ bars: page0, hasMore: false }]),
    });
    expect(missing.job.incompleteReason).toBe("RESUME_JOB_NOT_FOUND");

    // Overlapping duplicate page after pause (same newest window again)
    const dup = await runResearchHistoricalExport({
      instrument: "EURUSD",
      timeframe: "M30",
      allowExport: true,
      resumeJobId: first.job.jobId,
      storage: store,
      fetchFn: mockFetchPages([{ bars: page0, hasMore: true }]),
    });
    expect(dup.job.incompleteReason).toBe("DUPLICATE_OR_OVERLAPPING_PAGE");
    expect(dup.job.nextStartPos).toBeGreaterThan(first.job.nextStartPos - 1);
  });

  it("marks hard-cap truncation as INCOMPLETE and verifies hash after readback", async () => {
    const page0 = Array.from({ length: 50 }, (_, i) => makeBar(i));
    const result = await runResearchHistoricalExport({
      instrument: "XAUUSD",
      timeframe: "H4",
      allowExport: true,
      maxBars: 20,
      maxPages: 5,
      storage: store,
      fetchFn: mockFetchPages([{ bars: page0, hasMore: true }]),
    });
    expect(result.job.status).toBe("INCOMPLETE");
    expect(result.manifest?.status).toBe("INCOMPLETE");
    expect(result.manifest?.researchEligibility.suitableForCandleResearch).toBe(false);
    expect(result.bars.length).toBe(20);

    const verified = await store.verifyDatasetConsistency(
      result.manifest!.datasetId,
      result.manifest!.version,
    );
    expect(verified.ok).toBe(true);
    if (verified.ok) expect(verified.contentHash).toBe(result.manifest!.contentHash);

    const eligibility = assessResearchEligibility({
      status: result.manifest!.status,
      qualitySummary: result.manifest!.qualitySummary,
      pitMetadata: result.manifest!.pitMetadata,
      candleCount: result.manifest!.candleCount,
    });
    expect(eligibility.exportCompleteness).toBe("INCOMPLETE");
  });

  it("persists forward-looking observation snapshots without retrospective authority", async () => {
    const rel = await store.persistObservationSnapshot({
      instrument: "EURUSD",
      timeframe: "H1",
      catalogRow: {
        providerSymbol: "EURUSD",
        digits: 5,
        sessions: { tradeSessionDays: 5 },
        catalogVersion: "obs-test",
      },
    });
    expect(rel).toContain("metadata/observations/");
    const abs = path.join(store.root, rel);
    expect(fs.existsSync(abs)).toBe(true);
    const doc = JSON.parse(fs.readFileSync(abs, "utf8"));
    expect(doc.appliesRetrospectively).toBe(false);
    expect(doc.historicalAuthority).toBe(false);
    expect(doc.sessions.historicalAuthority).toBe(false);
  });

  it("detects out-of-order page and does not seal COMPLETE", async () => {
    const page0 = Array.from({ length: 3 }, (_, i) => makeBar(i));
    // Second page falsely returns newer bars than archive tip (violates CopyRates older-page rule).
    const badPage = Array.from({ length: 3 }, (_, i) => makeBar(10 + i));
    const result = await runResearchHistoricalExport({
      instrument: "USDJPY",
      timeframe: "M15",
      allowExport: true,
      maxPages: 5,
      storage: store,
      fetchFn: mockFetchPages([
        { bars: page0, hasMore: true },
        { bars: badPage, hasMore: true },
      ]),
    });
    expect(result.job.incompleteReason).toBe("OUT_OF_ORDER_PAGE");
    expect(result.job.status).toBe("INCOMPLETE");
    expect(result.manifest?.status).toBe("INCOMPLETE");
    expect(result.manifest?.researchEligibility.suitableForCandleResearch).toBe(false);
  });
});
