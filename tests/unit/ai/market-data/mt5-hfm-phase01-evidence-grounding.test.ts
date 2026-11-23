/**
 * Phase 01 — evidence ID grounding, truncation priority, candidate balance.
 * Fixtures only; no OpenAI / live market / broker.
 */
import { describe, it, expect } from "vitest";
import {
  adaptDetectionEvidenceRefToEvidence,
  assembleEvidenceFromProduction,
  prioritizeEvidenceItemsForCap,
} from "../../../../ai/market-data/mt5-hfm/mif/market-evidence/index";
import type { MifDetectionEvidenceRef } from "../../../../ai/market-data/mt5-hfm/mif/opportunity-detection/types";
import type { MifProductionIntegrationResult } from "../../../../ai/market-data/mt5-hfm/mif/production-integration/types";
import { buildHfmUnifiedAiAnalysisInput } from "../../../../ai/market-data/mt5-hfm/analysis/reasoning/unified-input";

function makeRef(
  evidenceId: string,
  presence: "PRESENT" | "ABSENT" = "PRESENT",
): MifDetectionEvidenceRef {
  return {
    evidenceId,
    family: "MARKET_REGIME",
    presence,
    sourceEngine: "mif-market-regime",
    sourceContractId: "c",
    sourceContractVersion: "1.0.0",
    sourcePolicyVersion: null,
    sourceAssessmentId: "a1",
    sourceInputIdentity: null,
    timeframe: "H1",
    timeframeRole: "PRIMARY",
    assessmentTimestamp: "2026-01-01T00:00:00.000Z",
    qualityStatus: presence === "ABSENT" ? "MISSING" : "VALID",
    candleState: "CLOSED",
  };
}

describe("Phase 01 evidence grounding", () => {
  it("preserves OD catalog evidenceId for AI allowlist alignment", () => {
    const item = adaptDetectionEvidenceRefToEvidence(makeRef("tc.regime"), {
      providerSymbol: "EURUSD",
      observedAt: "2026-01-01T00:00:00.000Z",
      snapshotId: "snap-1",
    });
    expect(item.evidenceId).toBe("tc.regime");
    expect(item.measurements.find((m) => m.id === "presence")?.value).toBe("PRESENT");
    expect(item.limitations).toContain("productionEvidenceRef");
  });

  it("includes ABSENT refs so missing is not treated as negative", () => {
    const item = adaptDetectionEvidenceRefToEvidence(makeRef("tc.mtf", "ABSENT"), {
      providerSymbol: "EURUSD",
      observedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(item.evidenceId).toBe("tc.mtf");
    expect(item.measurements.find((m) => m.id === "presence")?.value).toBe("ABSENT");
  });

  it("assembleEvidenceFromProduction keeps catalog refs with stable ids", () => {
    const result = {
      requestId: "r1",
      providerSymbol: "EURUSD",
      primaryTimeframe: "H1",
      processingTimestamp: "2026-01-01T00:00:00.000Z",
      engineId: "mif-production",
      engineVersion: "1.0.0",
      analysisStatus: "OK",
      dataQualityStatus: "VALID",
      candidateCount: 0,
      timeframeSnapshots: [],
      detection: { candidates: [] },
      eligibility: [],
      evidenceRefs: [makeRef("tc.regime"), makeRef("tc.structure", "ABSENT")],
      warnings: [],
      persistence: null,
    } as unknown as MifProductionIntegrationResult;

    const pkg = assembleEvidenceFromProduction({
      result,
      analysisId: "a1",
      snapshotId: "snap-1",
      snapshotIdSourceVerified: true,
    });
    const ids = pkg.items.map((i) => i.evidenceId);
    expect(ids).toContain("tc.regime");
    expect(ids).toContain("tc.structure");
  });

  it("prioritizeEvidenceItemsForCap retains cited catalog refs", () => {
    const catalog = adaptDetectionEvidenceRefToEvidence(makeRef("tc.regime"), {
      providerSymbol: "EURUSD",
      observedAt: "2026-01-01T00:00:00.000Z",
    });
    const filler = Array.from({ length: 5 }, (_, i) =>
      adaptDetectionEvidenceRefToEvidence(makeRef(`filler.${i}`), {
        providerSymbol: "EURUSD",
        observedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
    const candidateLike = {
      ...filler[0]!,
      evidenceId: "cand-hash-1",
      supportingEvidenceIds: ["tc.regime"],
      conflictingEvidenceIds: [],
      limitations: [],
    };
    const { kept, droppedIds } = prioritizeEvidenceItemsForCap(
      [catalog, candidateLike, ...filler.slice(1)],
      3,
    );
    expect(kept.some((k) => k.evidenceId === "tc.regime")).toBe(true);
    expect(droppedIds.length).toBeGreaterThan(0);
  });
});

describe("Phase 01 FORMING_EXCLUDED observability", () => {
  it("adapter emits FORMING_EXCLUDED when tip is forming", async () => {
    const { mifCandlesToStructureCandles } = await import(
      "../../../../ai/market-data/mt5-hfm/mif/analysis/adapter/mif-to-structure-candle"
    );
    const closed = {
      providerId: "HFM_MT5",
      providerSymbol: "EURUSD",
      timeframe: "H1",
      openTimeSec: 1000,
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      candleState: "CLOSED",
      timebase: "BROKER_SERVER",
    };
    const forming = { ...closed, openTimeSec: 4600, candleState: "FORMING" };
    const adapted = mifCandlesToStructureCandles({
      candles: [closed as any, forming as any],
      providerSymbol: "EURUSD",
      timeframe: "H1",
      includeForming: false,
    });
    expect(adapted.issues.some((i) => i.code === "FORMING_EXCLUDED")).toBe(true);
    expect(adapted.structureCandles).toHaveLength(1);
  });
});
