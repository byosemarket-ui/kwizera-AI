/**
 * Final Phase 5B–5E audit remediations:
 * - integrity WARNING finding codes exposed in snapshots/diagnostics
 * - source-backed invalidationPrice attached from evidence mid/price (never invented)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildOpportunityCandidate,
  attachSourceBackedLevelConditions,
  noteNumeric,
  extractSourceBackedPricesFromEvidence,
  extractLevelsFromCandidateNotes,
  runMifHfmOpportunityPipelineFromSeriesPersisted,
  __setMifOpportunityStorageForTests,
  MifOpportunityStorage,
  assessMifDataIntegrity,
  type MifOpportunityDetectionContext,
  type MifDetectionEvidenceRef,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function bars(n = 80) {
  const T0 = 1_700_000_000;
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = 2000 + i * 0.35;
    out.push({
      time: T0 + i * 3600,
      open: c - 0.1,
      high: c + 0.4,
      low: c - 0.4,
      close: c,
      tickVolume: 10,
      realVolume: null,
      spread: 2,
      validationStatus: "ok" as const,
      provenance: "native" as const,
    });
  }
  return out;
}

describe("Final audit — integrity WARNING diagnostics", () => {
  it("emits NO_AUTHORITATIVE_SESSION_CALENDAR warning without authority", () => {
    const candles = bars(40).map((b, i) => ({
      providerId: "HFM_MT5" as const,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      openTimeSec: b.time,
      closeTimeSec: b.time + 3600,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      tickVolume: b.tickVolume,
      realVolume: null as number | null,
      spread: 2,
      candleState: "CLOSED" as const,
      timebase: "BROKER_SERVER" as const,
      validationStatus: "ok" as const,
      provenance: "native" as const,
      identity: `c${i}`,
    }));
    // Minimal canonical shape may differ — use pipeline path instead if adapt required.
    void candles;
    const a = assessMifDataIntegrity({
      candles: [] as never,
      providerSymbol: "XAUUSD",
      timeframe: "H1",
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
    });
    // Empty series still carries session calendar warning when no authority.
    expect(a.findings.some((f) => f.code === "NO_AUTHORITATIVE_SESSION_CALENDAR")).toBe(true);
    expect(a.status === "WARNING" || a.status === "BLOCKED" || a.status === "DEGRADED").toBe(true);
  });

  it("pipeline snapshots expose integrityFindingCodes and dataQualityDiagnostics", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mif-audit-qi-"));
    process.env.KWIZERA_STORAGE_ROOT = tmp;
    __setMifOpportunityStorageForTests(new MifOpportunityStorage(tmp));
    try {
      const r = await runMifHfmOpportunityPipelineFromSeriesPersisted({
        providerSymbol: "XAUUSD",
        primaryTimeframe: "H1",
        timeframes: ["H1"],
        series: [{ timeframe: "H1", bars: bars(80) }],
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        maxCandleAgeSec: null,
      });
      expect(r.dataQualityDiagnostics).toBeTruthy();
      expect(r.timeframeSnapshots[0]?.integrityFindingCodes?.length).toBeGreaterThan(0);
      expect(
        r.timeframeSnapshots[0]?.integrityFindingCodes?.includes("NO_AUTHORITATIVE_SESSION_CALENDAR"),
      ).toBe(true);
      expect(r.dataQualityDiagnostics?.sessionCalendarAuthorityMissing).toBe(true);
      expect(r.dataQualityDiagnostics?.explanation).toMatch(/NO_AUTHORITATIVE_SESSION_CALENDAR|dataQualityStatus/);
    } finally {
      __setMifOpportunityStorageForTests(null);
      delete process.env.KWIZERA_STORAGE_ROOT;
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("Final audit — source-backed levels", () => {
  it("parses decimal mid/price from evidence notes", () => {
    expect(noteNumeric("boundaryId=z; mid=3514.2; kind=SUPPORT", "mid")).toBe(3514.2);
    expect(noteNumeric("bias=BEARISH; price=3594.92", "price")).toBe(3594.92);
    expect(noteNumeric("no numbers", "mid")).toBeNull();
  });

  it("attaches invalidationPrice from structure evidence without inventing target", () => {
    const evidence: MifDetectionEvidenceRef[] = [
      {
        evidenceId: "tc.structure",
        family: "MARKET_STRUCTURE",
        presence: "PRESENT",
        sourceEngine: "market-structure",
        sourceContractId: null,
        sourceContractVersion: null,
        sourcePolicyVersion: null,
        sourceAssessmentId: null,
        sourceInputIdentity: null,
        timeframe: "H1",
        timeframeRole: "INTERMEDIATE",
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        qualityStatus: "WARNING",
        candleState: "CLOSED",
        notes: "bias=BEARISH; price=3594.92; swingState=CONFIRMED",
      },
    ];
    const ctx = {
      evidence,
      providerSymbol: "XAUUSD",
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      availableTimeframeRoles: ["INTERMEDIATE"],
      instrument: null,
      regime: null,
      mtfRelationships: null,
    } as unknown as MifOpportunityDetectionContext;

    const leveled = attachSourceBackedLevelConditions({
      context: ctx,
      strategyId: "TREND_CONTINUATION",
      supportingEvidenceIds: ["tc.structure"],
      invalidationConditions: ["tc.structure_break"],
      knownLimitations: [],
      direction: "SELL",
    });
    expect(leveled.invalidationConditions.some((c) => c === "invalidationPrice=3594.92")).toBe(true);
    expect(leveled.invalidationConditions.some((c) => c === "invalidationSide=ABOVE")).toBe(true);
    const extracted = extractLevelsFromCandidateNotes({
      invalidationConditions: leveled.invalidationConditions,
    });
    expect(extracted.invalidationPrice).toBe(3594.92);
    // No opposing SR/liquidity in fixture → target stays unavailable (not invented).
    expect(extracted.targetPrice).toBeNull();
  });


  it("does not invent levels when evidence has no mid/price", () => {
    const evidence: MifDetectionEvidenceRef[] = [
      {
        evidenceId: "tc.structure",
        family: "MARKET_STRUCTURE",
        presence: "PRESENT",
        sourceEngine: "market-structure",
        sourceContractId: null,
        sourceContractVersion: null,
        sourcePolicyVersion: null,
        sourceAssessmentId: null,
        sourceInputIdentity: null,
        timeframe: "H1",
        timeframeRole: "INTERMEDIATE",
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        qualityStatus: "WARNING",
        candleState: "CLOSED",
        notes: "bias=BEARISH; swingState=CONFIRMED",
      },
    ];
    const extracted = extractSourceBackedPricesFromEvidence(evidence, ["tc.structure"]);
    expect(extracted.boundaryMid).toBeNull();
    expect(extracted.structurePrice).toBeNull();
  });

  it("buildOpportunityCandidate includes source-backed invalidationPrice when evidence has mid", () => {
    const evidence: MifDetectionEvidenceRef[] = [
      {
        evidenceId: "bo.boundary",
        family: "SUPPORT_RESISTANCE",
        presence: "PRESENT",
        sourceEngine: "sr",
        sourceContractId: null,
        sourceContractVersion: null,
        sourcePolicyVersion: null,
        sourceAssessmentId: null,
        sourceInputIdentity: null,
        timeframe: "H1",
        timeframeRole: "INTERMEDIATE",
        assessmentTimestamp: "2024-06-01T00:00:00.000Z",
        qualityStatus: "WARNING",
        candleState: "CLOSED",
        notes: "kind=SUPPORT; mid=3514.2; lifecycle=ACTIVE",
      },
    ];
    const ctx = {
      contextVersion: "v",
      providerId: "HFM_MT5",
      providerSymbol: "XAUUSD",
      instrument: null,
      assessmentTimestamp: "2024-06-01T00:00:00.000Z",
      timebase: null,
      dataQualityStatus: "WARNING",
      availableTimeframeRoles: ["INTERMEDIATE"],
      evidence,
      doesNotApproveAiReasoning: true,
      analyticalDetectionContextOnly: true,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    } as unknown as MifOpportunityDetectionContext;

    const c = buildOpportunityCandidate({
      context: ctx,
      strategyId: "BREAKOUT",
      detectorId: "mif.detector.breakout",
      detectorVersion: "1.0.0",
      strategyDefinitionVersion: "1.0.0",
      policyVersion: "1.0.0",
      direction: "SELL",
      thesis: "test",
      rationale: "test",
      supportingEvidenceIds: ["bo.boundary"],
      invalidationConditions: ["boundary_reclaim"],
    });
    expect(c.invalidationConditions.some((x) => x === "invalidationPrice=3514.2")).toBe(true);
    expect(c.placesOrders).toBe(false);
  });
});
