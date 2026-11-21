/**
 * Phase 5F STEP 5 Phase B — Research Results foundation tests (local only).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  MIF_RESEARCH_LABEL_COST_UNAVAILABLE,
  MIF_RESEARCH_LABEL_DESCRIPTIVE,
  MIF_RESEARCH_LABEL_NOT_CALIBRATED,
  MIF_RESEARCH_RESULTS_CONTRACT_ID,
  __setMifHistoricalResearchStorageForTests,
  __setMifProbabilityFreezeStorageForTests,
  __setMifResearchResultsStorageForTests,
  aggregateResearchResults,
  buildResearchCalibrationStatus,
  getMifHistoricalResearchStorage,
  getMifProbabilityFreezeStorage,
  getMifResearchResultsStorage,
} from "../../../../ai/market-data/mt5-hfm/mif/index.js";

describe("Phase 5F STEP 5 Phase B — research calibration status", () => {
  it("reports NOT_CALIBRATED without freezes; never claims WF-calibrated", () => {
    const s = buildResearchCalibrationStatus({
      frozenAssessmentCount: 0,
      highTrustFreezeCount: 0,
      decisiveFrozenPairCount: 0,
      scaffoldingCalibrationRunCount: 1,
    });
    expect(s.status).toBe("NOT_CALIBRATED");
    expect(s.walkForwardCalibrated).toBe(false);
    expect(s.midSplitScaffoldingNotWfCalibrated).toBe(true);
    expect(s.reliabilityClaimsAllowed).toBe(false);
    expect(s.fabricatedProbabilities).toBe(false);
    expect(s.provisionalThreshold).toBe(30);
    expect(s.calibratedThreshold).toBe(100);
    expect(s.reasons.some((r) => /mid_split/.test(r))).toBe(true);
    expect(s.reasons.some((r) => /no_oos_fitting/.test(r))).toBe(true);
  });

  it("reports INSUFFICIENT_DATA when freezes exist but pairs < 30", () => {
    const s = buildResearchCalibrationStatus({
      frozenAssessmentCount: 5,
      highTrustFreezeCount: 5,
      decisiveFrozenPairCount: 5,
      scaffoldingCalibrationRunCount: 0,
    });
    expect(s.status).toBe("INSUFFICIENT_DATA");
    expect(s.claimLabels).toContain(MIF_RESEARCH_LABEL_NOT_CALIBRATED);
  });

  it("still NOT_CALIBRATED above provisional threshold in Phase B (no model claim)", () => {
    const s = buildResearchCalibrationStatus({
      frozenAssessmentCount: 40,
      highTrustFreezeCount: 40,
      decisiveFrozenPairCount: 40,
      scaffoldingCalibrationRunCount: 0,
    });
    expect(s.status).toBe("NOT_CALIBRATED");
    expect(s.reasons.some((r) => /blocks_calibrated_claim/.test(r))).toBe(true);
  });
});

describe("Phase 5F STEP 5 Phase B — research results aggregation", () => {
  const tmpDirs: string[] = [];
  const prevStorageRoot = process.env.KWIZERA_STORAGE_ROOT;
  afterEach(() => {
    __setMifHistoricalResearchStorageForTests(null);
    __setMifProbabilityFreezeStorageForTests(null);
    __setMifResearchResultsStorageForTests(null);
    if (prevStorageRoot === undefined) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorageRoot;
    for (const d of tmpDirs.splice(0)) {
      try {
        fs.rmSync(d, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  it("aggregates deterministically and marks descriptive/uncalibrated", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mif-rr-"));
    tmpDirs.push(root);
    process.env.KWIZERA_STORAGE_ROOT = root;
    const research = getMifHistoricalResearchStorage(root);
    __setMifHistoricalResearchStorageForTests(research);
    // Empty stores — still produces a valid summary.
    const a = await aggregateResearchResults({
      storageRoot: root,
      generatedAt: "2024-01-01T00:00:00.000Z",
    });
    const b = await aggregateResearchResults({
      storageRoot: root,
      generatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(a.contractId).toBe(MIF_RESEARCH_RESULTS_CONTRACT_ID);
    expect(a.summaryId).toBe(b.summaryId);
    expect(a.summaryHash).toBe(b.summaryHash);
    expect(a.outcomeDistribution.descriptiveOnly).toBe(true);
    expect(a.isNotCalibratedProbability).toBe(true);
    expect(a.costAdjusted).toBe(false);
    expect(a.calibration.walkForwardCalibrated).toBe(false);
    expect(a.claimLabels).toContain(MIF_RESEARCH_LABEL_DESCRIPTIVE);
    expect(a.claimLabels).toContain(MIF_RESEARCH_LABEL_NOT_CALIBRATED);
    expect(a.claimLabels).toContain(MIF_RESEARCH_LABEL_COST_UNAVAILABLE);
    expect(a.linkage.missingLinks.length).toBeGreaterThan(0);
    expect(a.placesOrders).toBe(false);
    expect(a.mutatesBroker).toBe(false);
    expect(a.acceptsForExecution).toBe(false);

    const store = getMifResearchResultsStorage(root);
    const p1 = await store.persistSummary(a);
    const p2 = await store.persistSummary(a);
    expect(p1).toEqual({ ok: true, created: true });
    expect(p2).toEqual({ ok: true, created: false });
  });

  it("applies bounded symbol filter without inventing links", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mif-rr-f-"));
    tmpDirs.push(root);
    const summary = await aggregateResearchResults({
      storageRoot: root,
      filters: { symbol: "EURUSD", timeframe: "M15" },
      generatedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(summary.filters.symbol).toBe("EURUSD");
    expect(summary.filters.timeframe).toBe("M15");
    expect(summary.calibration.status).toBe("NOT_CALIBRATED");
    expect(
      summary.linkage.missingLinks.includes(
        "prediction_snapshots_do_not_store_analogueId_or_searchId",
      ),
    ).toBe(true);
  });
});
