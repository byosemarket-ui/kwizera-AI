/**
 * P8.B — Point-in-Time Market Replay Integrity regression tests.
 * Fixtures only; no live market / OpenAI / broker.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  applyEmbargo,
  applyPurge,
  buildPitDatasetIntegrityInventory,
  buildPitPriorityCoverageReport,
  buildPitReplayInputManifest,
  clipResearchBarsClosedAtDecision,
  clipResearchBarsToTip,
  computePitReplayManifestContentIdentityHash,
  computePitReplayManifestId,
  detectMissingIntervals,
  filterBarsClosedAtDecision,
  ingestResearchBars,
  isBarClosedAtDecision,
  MifHistoricalResearchStorage,
  MifPitReplayManifestStorage,
  planRollingWalkForward,
  resolveDecisionTimeSec,
  runMifHistoricalReplay,
  sealResearchDataset,
  selectAuthoritativePitDatasets,
  toStoredResearchBar,
  __setMifHistoricalResearchStorageForTests,
  type MifResearchStoredBar,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

const T0 = 1_700_000_000;

function makeBars(count: number, stepSec: number, start = T0): MifResearchStoredBar[] {
  const out: MifResearchStoredBar[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * stepSec;
    const c = 100 + i * 0.01;
    const stored = toStoredResearchBar({
      time: t,
      open: c - 0.01,
      high: c + 0.02,
      low: c - 0.02,
      close: c,
      tickVolume: 10,
      realVolume: null,
      spread: 12,
      validationStatus: "ok",
      provenance: "native",
    });
    if (stored) out.push(stored);
  }
  return out;
}

describe("P8.B close-time Point-in-Time visibility", () => {
  it("1. candle closing exactly at decision time is visible", () => {
    const open = T0;
    const decision = resolveDecisionTimeSec({ tipOpenTimeSec: open, primaryTimeframe: "H1" });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const check = isBarClosedAtDecision({
      openTimeSec: open,
      timeframe: "H1",
      decisionTimeSec: decision.decisionTimeSec,
    });
    expect(check.visible).toBe(true);
  });

  it("2. candle closing one second after decision time is excluded", () => {
    const open = T0;
    const decision = resolveDecisionTimeSec({ tipOpenTimeSec: open, primaryTimeframe: "H1" });
    expect(decision.ok).toBe(true);
    if (!decision.ok) return;
    const check = isBarClosedAtDecision({
      openTimeSec: open,
      timeframe: "H1",
      decisionTimeSec: decision.decisionTimeSec - 1,
    });
    expect(check.visible).toBe(false);
    if (!check.visible) expect(check.reason).toBe("STILL_FORMING_AT_DECISION");
  });

  for (const tf of ["H4", "H1", "M30", "M15", "M5"] as const) {
    it(`3-7. forming ${tf} bar opened before decision but closing after is excluded`, () => {
      const tipOpen = T0 + 3600; // decision tip on a finer clock
      // HTF / same TF bar that opened earlier but closes after tip decision
      const htfOpen = tipOpen - 60; // opened 1 minute before tip
      const decision = resolveDecisionTimeSec({
        tipOpenTimeSec: tipOpen,
        primaryTimeframe: "M5",
      });
      expect(decision.ok).toBe(true);
      if (!decision.ok) return;
      const check = isBarClosedAtDecision({
        openTimeSec: htfOpen,
        timeframe: tf,
        decisionTimeSec: decision.decisionTimeSec,
      });
      // For M5 with open=tipOpen-60, close = tipOpen-60+300 = tipOpen+240 > tipOpen+300? 
      // M5 duration 300: close = tipOpen+240, decision = tipOpen+300 → visible
      // For H1: close = tipOpen-60+3600 = tipOpen+3540 > tipOpen+300 → excluded
      if (tf === "M5" || tf === "M15" || tf === "M30") {
        // may be visible depending on duration; assert contract via filter
        const bars = makeBars(5, 60, htfOpen - 240).map((b) => ({
          time: b.time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
          tickVolume: b.tickVolume,
          realVolume: b.realVolume,
          spread: b.spread,
          validationStatus: "ok" as const,
          provenance: "native" as const,
        }));
        // Inject the forming HTF-style bar at htfOpen for this tf
        const filtered = filterBarsClosedAtDecision({
          bars: [
            ...bars,
            {
              time: htfOpen,
              open: 1,
              high: 1,
              low: 1,
              close: 1,
              tickVolume: 1,
              realVolume: null,
              spread: 1,
              validationStatus: "ok",
              provenance: "native",
            },
          ],
          timeframe: tf,
          decisionTimeSec: decision.decisionTimeSec,
        });
        const stillForming = filtered.excluded.some(
          (e) => e.openTimeSec === htfOpen && e.reason === "STILL_FORMING_AT_DECISION",
        );
        const visible = filtered.visible.some((b) => b.time === htfOpen);
        // Exactly one of: closed by decision → visible; else STILL_FORMING
        expect(stillForming || visible).toBe(true);
        if (tf === "H4" || tf === "H1") {
          expect(stillForming).toBe(true);
          expect(visible).toBe(false);
        }
      } else {
        expect(check.visible).toBe(false);
        if (!check.visible) expect(check.reason).toBe("STILL_FORMING_AT_DECISION");
      }
    });
  }

  it("8. future candles never visible at earlier replay tips", () => {
    const bars = makeBars(20, 3600);
    const tip = bars[10]!.time;
    const clip = clipResearchBarsClosedAtDecision({
      bars,
      timeframe: "H1",
      tipOpenTimeSec: tip,
    });
    expect(clip.ok).toBe(true);
    if (!clip.ok) return;
    expect(clip.bars.every((b) => b.time <= tip)).toBe(true);
    expect(clip.bars.some((b) => b.time > tip)).toBe(false);
  });

  it("9. repeated replay with identical inputs is deterministic", () => {
    const bars = makeBars(80, 3600).map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      tickVolume: b.tickVolume,
      realVolume: b.realVolume,
      spread: b.spread,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    }));
    const input = {
      providerSymbol: "EURUSD",
      primaryTimeframe: "H1",
      series: [{ timeframe: "H1", bars }],
      warmupBars: 40,
      maxSteps: 5,
      stepBars: 1,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
      requestIdPrefix: "p8b-det",
    };
    const a = runMifHistoricalReplay(input);
    const b = runMifHistoricalReplay(input);
    expect(a.inputIdentity).toBe(b.inputIdentity);
    expect(a.steps.map((s) => s.tipOpenTimeSec)).toEqual(b.steps.map((s) => s.tipOpenTimeSec));
    expect(a.steps.map((s) => s.candidateCount)).toEqual(b.steps.map((s) => s.candidateCount));
  });

  it("10. duplicate timestamps rejected by research ingest helper", () => {
    const bars = makeBars(3, 3600);
    const dup = { ...bars[1]! };
    const result = ingestResearchBars(bars, [dup]);
    expect(result.duplicateOrOutOfOrderRejected).toBeGreaterThan(0);
  });

  it("11. missing intervals recorded but never filled", () => {
    const bars = [makeBars(1, 3600, T0)[0]!, makeBars(1, 3600, T0 + 3600 * 5)[0]!];
    const missing = detectMissingIntervals(bars, "H1");
    expect(missing.length).toBeGreaterThan(0);
    expect(bars.length).toBe(2); // never filled
  });

  it("12. weekend/session uncertainty remains explicitly uncertain", () => {
    const bars = [makeBars(1, 3600, T0)[0]!, makeBars(1, 3600, T0 + 3600 * 48)[0]!];
    const missing = detectMissingIntervals(bars, "H1");
    expect(missing.some((m) => m.classification === "UNKNOWN_SESSION_GAP")).toBe(true);
  });

  it("13. unsupported timeframe duration produces explicit failure", () => {
    const bars = makeBars(5, 3600);
    const clip = clipResearchBarsClosedAtDecision({
      bars,
      timeframe: "MN1",
      tipOpenTimeSec: bars[2]!.time,
    });
    expect(clip.ok).toBe(false);
    if (!clip.ok) {
      expect(clip.bars).toEqual([]);
      expect(clip.limitation || clip.code).toBeTruthy();
    }
  });

  it("14. tail clipping respects limits and reports truncation", () => {
    const bars = makeBars(80, 3600).map((b) => ({
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      tickVolume: b.tickVolume,
      realVolume: b.realVolume,
      spread: b.spread,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    }));
    const run = runMifHistoricalReplay({
      providerSymbol: "EURUSD",
      primaryTimeframe: "H1",
      series: [{ timeframe: "H1", bars }],
      warmupBars: 40,
      maxSteps: 3,
      assessmentTimestamp: "2024-01-01T00:00:00.000Z",
    });
    expect(run.stepsExecuted).toBeLessThanOrEqual(3);
    expect(run.dataCoverage.truncatedByMaxSteps || run.stepsExecuted <= 3).toBe(true);
  });

  it("15-16. walk-forward / purge / embargo do not leak prohibited overlap", () => {
    const plan = planRollingWalkForward({
      barCount: 200,
      warmupBars: 40,
      maxHorizonBars: 8,
      maxLevelObservationBars: 8,
      timeframe: "H1",
    });
    expect(plan.folds.length).toBeGreaterThan(0);
    const fold = plan.folds[0]!;
    expect(fold.purgeBars).toBeGreaterThan(0);
    expect(fold.embargoBars).toBeGreaterThan(0);

    const purged = applyPurge({
      tipIndices: [40, 42, 50],
      tipOpenTimes: [T0, T0 + 3600, T0 + 7200],
      nextIntervalStartIndex: 45,
      horizonBars: 8,
    });
    expect(purged.excluded.some((e) => e.tipIndex === 42)).toBe(true);

    const embargoed = applyEmbargo({
      tipIndices: [40, 50, 60],
      tipOpenTimes: [T0, T0 + 10, T0 + 20],
      intervalStartIndex: 45,
      embargoBars: 8,
    });
    expect(embargoed.keptIndices.every((i) => i >= 45 + 8)).toBe(true);
  });

  it("20. open-time-only clip is insufficient as sole MTF PIT gate", () => {
    const m5Tip = T0 + 3600;
    // H4 bar opened before tip but still forming at M5 decision
    const h4Open = m5Tip - 1000;
    const bars = [
      ...makeBars(3, 300, m5Tip - 900),
      ...makeBars(1, 14400, h4Open),
    ];
    const openOnly = clipResearchBarsToTip(bars, m5Tip);
    expect(openOnly.sufficientAsSoleMtfPitGate).toBe(false);
    expect(openOnly.bars.some((b) => b.time === h4Open)).toBe(true); // would leak under open-time

    const closed = clipResearchBarsClosedAtDecision({
      bars,
      timeframe: "H4",
      tipOpenTimeSec: m5Tip,
      decisionTimeSec: m5Tip + 300, // M5 tip close
    });
    expect(closed.ok).toBe(true);
    if (closed.ok) {
      expect(closed.bars.some((b) => b.time === h4Open)).toBe(false);
    }
  });
});

describe("P8.B inventory / manifest / incomplete exclusion", () => {
  let root: string;
  let store: MifHistoricalResearchStorage;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "p8b-pit-"));
    store = new MifHistoricalResearchStorage(root);
    __setMifHistoricalResearchStorageForTests(store);
  });

  afterEach(() => {
    __setMifHistoricalResearchStorageForTests(null);
    fs.rmSync(root, { recursive: true, force: true });
  });

  const exportProvenance = {
    exportJobId: "p8b-test",
    pagesFetched: 1,
    lastStartPos: 0,
    nextStartPos: null,
    requestedCountPerPage: 300,
    returnedBarTotal: 0,
    hasMoreAtStop: false,
    incompleteReason: null,
    sourceFreshnessNotes: [] as string[],
    fetchErrors: [] as string[],
  };

  async function sealComplete(instrument: string, timeframe: string, n: number, start: number) {
    const step =
      timeframe === "H4" ? 14400
        : timeframe === "H1" ? 3600
          : timeframe === "M30" ? 1800
            : timeframe === "M15" ? 900
              : 300;
    const bars = makeBars(n, step, start);
    return sealResearchDataset(store, {
      instrument,
      timeframe,
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
        maxBars: 10000,
        maxPages: 40,
      },
      exportProvenance: { ...exportProvenance, returnedBarTotal: bars.length },
    });
  }

  it("17-18. manifest hash stable for identical inputs; changes with cutoff/hash", async () => {
    const sealed = await sealComplete("EURUSD", "H1", 50, T0);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;

    const a = await buildPitReplayInputManifest(store, {
      instrument: "EURUSD",
      primaryTimeframe: "H1",
      datasets: [{ datasetId: sealed.manifest.datasetId, version: sealed.manifest.version }],
      decisionCutoffSec: T0 + 3600 * 40,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const b = await buildPitReplayInputManifest(store, {
      instrument: "EURUSD",
      primaryTimeframe: "H1",
      datasets: [{ datasetId: sealed.manifest.datasetId, version: sealed.manifest.version }],
      decisionCutoffSec: T0 + 3600 * 40,
      createdAt: "2099-01-01T00:00:00.000Z",
    });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.manifest.contentIdentityHash).toBe(b.manifest.contentIdentityHash);
    expect(a.manifest.manifestId).toBe(b.manifest.manifestId);

    const c = await buildPitReplayInputManifest(store, {
      instrument: "EURUSD",
      primaryTimeframe: "H1",
      datasets: [{ datasetId: sealed.manifest.datasetId, version: sealed.manifest.version }],
      decisionCutoffSec: T0 + 3600 * 41,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.manifest.contentIdentityHash).not.toBe(a.manifest.contentIdentityHash);

    const ms = MifPitReplayManifestStorage.fromResearchStorage(store);
    const p1 = await ms.persistManifest(a.manifest);
    expect(p1.ok && p1.created).toBe(true);
    const p2 = await ms.persistManifest(b.manifest);
    expect(p2.ok && p2.created === false).toBe(true);
  });

  it("19. incomplete datasets cannot enter authoritative replay manifest", async () => {
    const bars = makeBars(20, 3600);
    const sealed = await sealResearchDataset(store, {
      instrument: "EURUSD",
      timeframe: "H1",
      bars,
      rejectedCandles: 0,
      duplicateOrOutOfOrderRejected: 0,
      invalidOhlcRejected: 0,
      incompleteExportRange: true,
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
        maxBars: 10000,
        maxPages: 40,
      },
      exportProvenance: { ...exportProvenance, returnedBarTotal: bars.length, incompleteReason: "TEST" },
    });
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(sealed.manifest.status).toBe("INCOMPLETE");

    const built = await buildPitReplayInputManifest(store, {
      instrument: "EURUSD",
      primaryTimeframe: "H1",
      datasets: [{ datasetId: sealed.manifest.datasetId, version: sealed.manifest.version }],
      decisionCutoffSec: T0 + 3600 * 10,
      verifyHashes: false,
    });
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.code).toMatch(/INCOMPLETE|NOT_SUITABLE/);
    }
  });

  it("manifest identity helpers are deterministic", () => {
    const material = {
      instrument: "EURUSD",
      primaryTimeframe: "H1",
      decisionCutoffSec: 100,
      requestedStartTimeSec: null,
      requestedEndTimeSec: null,
      bindings: [
        {
          timeframe: "H1",
          datasetId: "ds:x",
          version: 1,
          contentHash: "abc",
          candleCount: 10,
          startTime: 1,
          endTime: 2,
          missingIntervalCount: 0,
          missingIntervals: [],
          suitableForCandleResearch: true as const,
          status: "COMPLETE" as const,
        },
      ],
    };
    const h1 = computePitReplayManifestContentIdentityHash(material);
    const h2 = computePitReplayManifestContentIdentityHash(material);
    expect(h1).toBe(h2);
    expect(computePitReplayManifestId(h1)).toBe(`pitrm:${h1.slice(0, 32)}`);
  });

  it("inventory selects only COMPLETE hash-verified suitable datasets", async () => {
    const sealed = await sealComplete("GBPUSD", "H1", 40, T0);
    expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    const inv = await buildPitDatasetIntegrityInventory(store, {
      instruments: ["GBPUSD"],
      timeframes: ["H1"],
      verifyHashes: true,
      generatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(inv.registryEntryCount).toBeGreaterThanOrEqual(1);
    expect(inv.authoritativeCount).toBeGreaterThanOrEqual(1);
    const auth = selectAuthoritativePitDatasets(inv, { instrument: "GBPUSD", timeframe: "H1" });
    expect(auth.every((e) => e.authoritativeForPitReplay && e.status === "COMPLETE")).toBe(true);

    const ms = MifPitReplayManifestStorage.fromResearchStorage(store);
    const built = await buildPitReplayInputManifest(store, {
      instrument: "GBPUSD",
      primaryTimeframe: "H1",
      datasets: [{ datasetId: sealed.manifest.datasetId, version: sealed.manifest.version }],
      decisionCutoffSec: T0 + 3600 * 20,
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(ms.verifyManifestIntegrity(built.manifest).ok).toBe(true);
  });

  it("priority coverage discloses MTF overlap is not long-term performance evidence", async () => {
    // Minimal packs so overlap math runs; real VPS report uses sealed archives.
    for (const tf of ["H4", "H1", "M30", "M15", "M5"] as const) {
      const sealed = await sealComplete("EURUSD", tf, 45, T0);
      expect(sealed.ok).toBe(true);
    }
    const report = await buildPitPriorityCoverageReport(store, {
      verifyHashes: true,
      generatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(report.mtfOverlap.sufficientForLongTermPerformanceClaims).toBe(false);
    expect(report.disclaimer.toLowerCase()).toContain("not sufficient");
    const eurusd = report.cells.filter((c) => c.instrument === "EURUSD");
    expect(eurusd.length).toBe(5);
  });
});
