/**
 * Phase 3 — HFM Data Synchronization & Intelligence Orchestration.
 * Fixture-based; no live market claims. Ranking only — probability batch skipped.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createSnapshotIdentity,
  HfmAnalysisStorage,
  __setHfmAnalysisStorageForTests,
  type HfmAnalysisMultiTfSnapshot,
  type HfmAnalysisNormalizedCandle,
  type HfmAnalysisTfDataset,
} from "../../../../ai/market-data/mt5-hfm/analysis/index";
import {
  MIF_ORCHESTRATION_CONTRACT_ID,
  MIF_ORCHESTRATION_DEADLINE_MS,
  MIF_ORCHESTRATION_TF_PACK,
  __resetOrchestrationLockForTests,
  buildMifSeriesFromChartsSnapshot,
  getMifOdWorkerStatus,
  isOrchestrationLocked,
  releaseOrchestrationLock,
  runChartsIntelligenceOrchestration,
  runHfmIntelligenceOrchestration,
  tryAcquireOrchestrationLock,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;

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
  let px = 2000;
  for (let i = 0; i < n; i += 1) {
    const o = px;
    const c = px + (i % 2 === 0 ? 0.35 : -0.2);
    const h = Math.max(o, c) + 0.4;
    const l = Math.min(o, c) - 0.4;
    out.push(candle(symbol, tf, start + i * step, o, h, l, c));
    px = c;
  }
  return out;
}

const TF_STEP: Record<string, number> = {
  H4: 14400,
  H1: 3600,
  M30: 1800,
  M15: 900,
  M5: 300,
};

function dataset(
  symbol: string,
  tf: string,
  opts?: { forming?: boolean; stale?: boolean; n?: number },
): HfmAnalysisTfDataset {
  const step = TF_STEP[tf] ?? 3600;
  const historical = series(symbol, tf, T0, step, opts?.n ?? 60);
  const tip = historical[historical.length - 1]!;
  return {
    timeframe: tf,
    symbol,
    historical,
    current: opts?.forming === false
      ? null
      : { ...tip, isCurrent: true, provenance: "live_aggregate" },
    candleCount: historical.length,
    oldestTimestamp: historical[0]!.timestamp,
    newestTimestamp: tip.timestamp,
    freshness: opts?.stale ? "STALE" : "LIVE",
    connectionStatus: "CONNECTED",
    validationStatus: "ok",
    sourceProvenance: "HFM_MT5",
    errors: [],
  };
}

function makeSnapshot(opts?: {
  symbol?: string;
  tfs?: string[];
  forming?: boolean;
  omitTf?: string;
  wrongSymbolTf?: string;
  missingIdentity?: boolean;
}): HfmAnalysisMultiTfSnapshot {
  const symbol = opts?.symbol ?? "XAUUSD";
  const tfs = opts?.tfs ?? [...MIF_ORCHESTRATION_TF_PACK];
  const timeframes: Record<string, HfmAnalysisTfDataset> = {};
  for (const tf of tfs) {
    if (opts?.omitTf === tf) continue;
    const sym = opts?.wrongSymbolTf === tf ? "EURUSD" : symbol;
    timeframes[tf] = dataset(sym, tf, { forming: opts?.forming !== false });
  }
  const identity = opts?.missingIdentity
    ? { snapshotId: "", snapshotHash: "", hashVersion: "hfm-analysis-snapshot-v1" }
    : createSnapshotIdentity({
        symbol,
        chartTimeframeAtStart: "H1",
        datasets: timeframes,
        quote: {
          symbol,
          bid: 2000,
          ask: 2000.2,
          spread: 0.2,
          brokerTimestamp: T0 + 100000,
          receiveTimestamp: new Date().toISOString(),
          freshness: "LIVE",
          acquisition: "SymbolInfoTick",
        },
        qualityStatus: "VALID",
      });

  return {
    snapshotId: identity.snapshotId,
    snapshotHash: identity.snapshotHash,
    hashVersion: identity.hashVersion,
    provider: "HFM_MT5",
    symbol,
    capturedAt: new Date().toISOString(),
    chartTimeframeAtStart: "H1",
    timeframes,
    quote: {
      symbol,
      bid: 2000,
      ask: 2000.2,
      spread: 0.2,
      brokerTimestamp: T0 + 100000,
      receiveTimestamp: new Date().toISOString(),
      freshness: "LIVE",
      acquisition: "SymbolInfoTick",
    },
    dataQuality: {
      status: "VALID",
      errors: [],
      warnings: [],
      approvedForAiReasoning: true,
      policyNote: "phase3-test",
    },
    synchronization: {
      status: "VALID",
      symbol,
      timeframesPresent: Object.keys(timeframes),
      timeframesMissing: [],
      latestQuoteTimestamp: T0 + 100000,
      latestCandleByTf: Object.fromEntries(
        Object.entries(timeframes).map(([tf, ds]) => [tf, ds.newestTimestamp]),
      ),
      warnings: [],
      errors: [],
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

describe("Phase 3 — synchronization & candle lifecycle", () => {
  beforeEach(() => {
    __resetOrchestrationLockForTests();
  });

  it("aligns same symbol pack and marks FORMING tip (never CLOSED)", () => {
    const snap = makeSnapshot({ forming: true });
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: MIF_ORCHESTRATION_TF_PACK,
    });
    expect(converted.presentTimeframes).toEqual([...MIF_ORCHESTRATION_TF_PACK]);
    expect(converted.missingTimeframes).toHaveLength(0);
    for (const tf of MIF_ORCHESTRATION_TF_PACK) {
      expect(converted.tipStates[tf]).toBe("FORMING");
      const s = converted.series.find((x) => x.timeframe === tf)!;
      const tip = s.candles[s.candles.length - 1]!;
      expect(tip.candleState).toBe("FORMING");
      expect(tip.candleState).not.toBe("CLOSED");
    }
  });

  it("marks CLOSED tip when no forming current candle", () => {
    const snap = makeSnapshot({ forming: false });
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: ["H1"],
    });
    expect(converted.tipStates.H1).toBe("CLOSED");
    const tip = converted.series[0]!.candles.at(-1)!;
    expect(tip.candleState).toBe("CLOSED");
  });

  it("marks STALE when freshness is stale and no forming tip", () => {
    const snap = makeSnapshot({ forming: false, tfs: ["H1"] });
    snap.timeframes.H1 = dataset("XAUUSD", "H1", { forming: false, stale: true });
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: ["H1"],
    });
    expect(converted.tipStates.H1).toBe("STALE");
    expect(converted.warnings.some((w) => w.startsWith("STALE_TF:H1"))).toBe(true);
  });

  it("does not fabricate missing timeframes", () => {
    const snap = makeSnapshot({ omitTf: "H4" });
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: MIF_ORCHESTRATION_TF_PACK,
    });
    expect(converted.missingTimeframes).toContain("H4");
    expect(converted.tipStates.H4).toBe("MISSING");
    expect(converted.series.every((s) => s.timeframe !== "H4")).toBe(true);
  });

  it("rejects cross-symbol TF data", () => {
    const snap = makeSnapshot({ wrongSymbolTf: "M5" });
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: MIF_ORCHESTRATION_TF_PACK,
    });
    expect(converted.missingTimeframes).toContain("M5");
    expect(converted.warnings.some((w) => w.startsWith("SYMBOL_MISMATCH:M5"))).toBe(true);
  });

  it("dedupes duplicate open times deterministically", () => {
    const snap = makeSnapshot({ tfs: ["M5"], forming: false });
    const ds = snap.timeframes.M5!;
    const dup = { ...ds.historical[10]! };
    ds.historical = [...ds.historical, dup];
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: ["M5"],
    });
    const times = converted.series[0]!.candles.map((c) => c.openTimeSec);
    expect(new Set(times).size).toBe(times.length);
  });

  it("detects out-of-order timestamps", () => {
    const snap = makeSnapshot({ tfs: ["M5"], forming: false });
    const ds = snap.timeframes.M5!;
    const a = ds.historical[5]!;
    const b = ds.historical[6]!;
    ds.historical[5] = { ...b };
    ds.historical[6] = { ...a };
    const converted = buildMifSeriesFromChartsSnapshot({
      snapshot: snap,
      timeframePack: ["M5"],
    });
    expect(converted.warnings).toContain("OUT_OF_ORDER:M5");
  });
});

describe("Phase 3 — orchestration pipeline & fail-open", () => {
  beforeEach(() => {
    __resetOrchestrationLockForTests();
  });

  afterEach(() => {
    __resetOrchestrationLockForTests();
  });

  it("runs ranking-only path with Charts snapshot identity verified", async () => {
    const snap = makeSnapshot();
    const result = await runChartsIntelligenceOrchestration({
      snapshot: snap,
      correlationId: snap.snapshotId,
    });
    expect(result.contractId).toBe(MIF_ORCHESTRATION_CONTRACT_ID);
    expect(result.providerId).toBe("HFM_MT5");
    expect(result.snapshotId).toBe(snap.snapshotId);
    expect(result.snapshotHash).toBe(snap.snapshotHash);
    expect(result.snapshotIdSourceVerified).toBe(true);
    expect(result.correlationId).toBe(snap.snapshotId);
    expect(result.timeframePack).toEqual([...MIF_ORCHESTRATION_TF_PACK]);
    expect(result.completeness.probabilityIncluded).toBe(false);
    expect(result.warnings.some((w) => w.includes("probability_batch_skipped"))).toBe(true);
    expect(result.placesOrders).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
    expect(["COMPLETE", "PARTIAL"]).toContain(result.orchestrationStatus);
    if (result.evidencePackage) {
      expect(result.evidencePackage.snapshotId).toBe(snap.snapshotId);
      expect(result.evidencePackage.snapshotIdSourceVerified).toBe(true);
    }
  });

  it("refuses fabricated snapshot identity", async () => {
    const snap = makeSnapshot({ missingIdentity: true });
    const result = await runHfmIntelligenceOrchestration({ snapshot: snap });
    expect(result.orchestrationStatus).toBe("FAILED");
    expect(result.snapshotIdSourceVerified).toBe(false);
    expect(result.warnings).toContain("MISSING_SNAPSHOT_IDENTITY");
    expect(result.evidencePackage).toBeNull();
  });

  it("returns PARTIAL when H4 missing (not fabricated)", async () => {
    const snap = makeSnapshot({ omitTf: "H4" });
    const result = await runHfmIntelligenceOrchestration({
      snapshot: snap,
      correlationId: "partial-h4",
    });
    expect(result.completeness.missingTimeframes).toContain("H4");
    expect(result.completeness.evidenceTrustedComplete).toBe(false);
    expect(["PARTIAL", "FAILED"]).toContain(result.orchestrationStatus);
    if (result.orchestrationStatus === "PARTIAL" && result.evidencePackage) {
      expect(result.warnings.some((w) => w.includes("EVIDENCE"))).toBe(true);
    }
  });

  it("skips when another orchestration holds the lock", async () => {
    expect(tryAcquireOrchestrationLock("holder-a")).toBe(true);
    const snap = makeSnapshot();
    const result = await runHfmIntelligenceOrchestration({
      snapshot: snap,
      correlationId: "blocked",
    });
    expect(result.orchestrationStatus).toBe("SKIPPED");
    expect(result.warnings).toContain("ORCHESTRATION_ALREADY_RUNNING");
    releaseOrchestrationLock("holder-a");
    expect(isOrchestrationLocked()).toBe(false);
  });

  it("releases lock after failure and timeout path", async () => {
    const snap = makeSnapshot();
    const failed = await runHfmIntelligenceOrchestration({
      snapshot: { ...snap, snapshotId: "", snapshotHash: "" },
    });
    expect(failed.orchestrationStatus).toBe("FAILED");
    expect(isOrchestrationLocked()).toBe(false);

    const timed = await runHfmIntelligenceOrchestration({
      snapshot: snap,
      deadlineMs: 0,
    });
    expect(["PARTIAL", "FAILED", "COMPLETE"]).toContain(timed.orchestrationStatus);
    expect(
      timed.warnings.some((w) => w.startsWith("TIMEOUT"))
      || timed.completeness.notes.includes("TIMEOUT_BEFORE_PIPELINE")
      || timed.completeness.notes.includes("TIMEOUT")
      || timed.orchestrationStatus !== "COMPLETE",
    ).toBe(true);
    expect(isOrchestrationLocked()).toBe(false);
    expect(MIF_ORCHESTRATION_DEADLINE_MS).toBe(10_000);
  });

  it("OD worker remains disabled and safety flags stay false", async () => {
    const worker = getMifOdWorkerStatus();
    expect(worker.enabled).toBe(false);
    const snap = makeSnapshot();
    const result = await runChartsIntelligenceOrchestration({ snapshot: snap });
    expect(result.placesOrders).toBe(false);
    expect(result.mutatesBroker).toBe(false);
    expect(result.acceptsForExecution).toBe(false);
    expect(result.notExecutable).toBe(true);
    expect(getMifOdWorkerStatus().enabled).toBe(false);
  });
});

describe("Phase 3 — evidence persistence", () => {
  let tmp: string;

  beforeEach(async () => {
    __resetOrchestrationLockForTests();
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "hfm-p3-orch-"));
    __setHfmAnalysisStorageForTests(new HfmAnalysisStorage(tmp));
  });

  afterEach(async () => {
    __setHfmAnalysisStorageForTests(null);
    __resetOrchestrationLockForTests();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("write + read-after-write by snapshotId; legacy contexts remain readable", async () => {
    const store = new HfmAnalysisStorage(tmp);
    const snap = makeSnapshot();
    const orch = await runChartsIntelligenceOrchestration({ snapshot: snap });

    await store.saveIntelligenceOrchestration(snap.snapshotId, orch);
    const loaded = await store.loadIntelligenceOrchestration(snap.snapshotId);
    expect(loaded).toBeTruthy();
    expect((loaded as { snapshotId: string }).snapshotId).toBe(snap.snapshotId);
    expect((loaded as { orchestrationStatus: string }).orchestrationStatus).toBe(
      orch.orchestrationStatus,
    );

    // Existing snapshot without intelligence still loads as context-only.
    await store.saveContext({
      ok: true,
      state: "COMPLETED",
      job: {
        jobId: "j1",
        provider: "HFM_MT5",
        symbolAtStart: snap.symbol,
        selectedSymbolVersion: 1,
        chartTimeframeAtStart: "H1",
        analysisTimeframes: [...MIF_ORCHESTRATION_TF_PACK],
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        status: "COMPLETED",
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      },
      snapshot: snap,
      chartImages: {},
      timings: {
        collectMs: 0,
        normalizeMs: 0,
        validateMs: 0,
        syncMs: 0,
        renderMs: 0,
        totalMs: 0,
      },
      diagnostics: [],
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    const ctx = await store.loadContext(snap.snapshotId);
    expect(ctx?.snapshot?.snapshotId).toBe(snap.snapshotId);

    // Duplicate save overwrites deterministically (same path).
    await store.saveIntelligenceOrchestration(snap.snapshotId, {
      ...orch,
      warnings: [...orch.warnings, "duplicate_write"],
    });
    const again = (await store.loadIntelligenceOrchestration(snap.snapshotId)) as {
      warnings: string[];
    };
    expect(again.warnings).toContain("duplicate_write");
  });

  it("failed persistence is visible (empty snapshotId throws)", async () => {
    const store = new HfmAnalysisStorage(tmp);
    await expect(store.saveIntelligenceOrchestration("", { x: 1 })).rejects.toThrow(
      /snapshotId required/,
    );
  });
});
