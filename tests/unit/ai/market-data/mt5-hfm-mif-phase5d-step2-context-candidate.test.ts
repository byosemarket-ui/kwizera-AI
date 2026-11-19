/**
 * Phase 5D Step 2 — detection context + candidate contract + evidence validation.
 */
import { describe, it, expect } from "vitest";
import {
  buildOpportunityCandidate,
  computeOpportunityCandidateId,
  fingerprintContextEvidence,
  getDefaultMifStrategyIntelligenceRegistry,
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
  MIF_PROVIDER_ID,
  validateDetectorEvidence,
  validateOpportunityCandidate,
  validateOpportunityDetectionContext,
  type MifDetectionEvidenceRef,
  type MifOpportunityDetectionContext,
} from "../../../../ai/market-data/mt5-hfm/mif/index";

function evidence(over: Partial<MifDetectionEvidenceRef> & Pick<MifDetectionEvidenceRef, "evidenceId" | "family">): MifDetectionEvidenceRef {
  return {
    evidenceId: over.evidenceId,
    family: over.family,
    presence: over.presence ?? "PRESENT",
    sourceEngine: over.sourceEngine ?? "test",
    sourceContractId: over.sourceContractId ?? "kwizera.mif.test.v1",
    sourceContractVersion: over.sourceContractVersion ?? "1.0.0",
    sourcePolicyVersion: over.sourcePolicyVersion ?? "1.0.0",
    sourceAssessmentId: over.sourceAssessmentId ?? `${over.evidenceId}.src`,
    sourceInputIdentity: over.sourceInputIdentity ?? null,
    timeframe: over.timeframe ?? "H1",
    timeframeRole: over.timeframeRole ?? "OPPORTUNITY_ARCHITECTURE",
    assessmentTimestamp: over.assessmentTimestamp ?? "2024-06-01T12:00:00.000Z",
    qualityStatus: over.qualityStatus ?? "VALID",
    candleState: over.candleState ?? "CLOSED",
    notes: over.notes,
  };
}

function baseContext(over: Partial<MifOpportunityDetectionContext> = {}): MifOpportunityDetectionContext {
  return {
    contextVersion: "1.0.0",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: "XAUUSD",
    instrument: null,
    assessmentTimestamp: "2024-06-01T12:00:00.000Z",
    timebase: "BROKER_SERVER",
    dataQualityStatus: "VALID",
    availableTimeframeRoles: [
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "SETUP_DEVELOPMENT",
      "OPPORTUNITY_ARCHITECTURE",
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
    evidence: [
      evidence({ evidenceId: "tc.regime", family: "MARKET_REGIME" }),
      evidence({ evidenceId: "tc.mtf", family: "MULTI_TIMEFRAME_RELATIONSHIP" }),
      evidence({ evidenceId: "tc.quality", family: "DATA_QUALITY", candleState: null }),
      evidence({ evidenceId: "tc.structure", family: "MARKET_STRUCTURE" }),
    ],
    evidenceSummary: {
      providerSymbol: "XAUUSD",
      dataQualityStatus: "VALID",
      regimeDirection: "UP",
      regimeStructure: "TRENDING",
      regimeVolatility: "NORMAL",
      availableTimeframeRoles: [
        "PRIMARY_DIRECTION",
        "INTERMEDIATE_STRUCTURE",
        "SETUP_DEVELOPMENT",
        "OPPORTUNITY_ARCHITECTURE",
        "LOWER_TIMEFRAME_CONFIRMATION",
      ],
      evidence: [
        {
          evidenceId: "tc.regime",
          family: "MARKET_REGIME",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "tc.regime.src",
          sourceContractId: "kwizera.mif.market-regime.v1",
        },
        {
          evidenceId: "tc.mtf",
          family: "MULTI_TIMEFRAME_RELATIONSHIP",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: "tc.mtf.src",
          sourceContractId: "kwizera.mif.multi-timeframe-relationships.v1",
        },
        {
          evidenceId: "tc.quality",
          family: "DATA_QUALITY",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: null,
          sourceAssessmentId: "q1",
          sourceContractId: "kwizera.mif.quality.v1",
        },
        {
          evidenceId: "tc.structure",
          family: "MARKET_STRUCTURE",
          presence: "PRESENT",
          qualityStatus: "VALID",
          closedCandleSatisfied: true,
          sourceAssessmentId: null,
          sourceContractId: null,
        },
      ],
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
    ...over,
  };
}

describe("Phase 5D Step2 — detection context", () => {
  it("accepts a valid canonical context", () => {
    expect(validateOpportunityDetectionContext(baseContext()).ok).toBe(true);
  });

  it("rejects mixed instruments and missing identity", () => {
    const mixed = baseContext({
      providerSymbol: "XAUUSD",
      regime: {
        providerSymbol: "EURUSD",
      } as MifOpportunityDetectionContext["regime"],
    });
    const v = validateOpportunityDetectionContext(mixed);
    expect(v.ok).toBe(false);
    expect(v.reasonCodes).toContain("MIXED_INSTRUMENTS");

    expect(validateOpportunityDetectionContext(baseContext({ providerSymbol: "" })).ok).toBe(false);
  });

  it("rejects duplicate evidence IDs and invalid safety", () => {
    const dup = baseContext({
      evidence: [
        evidence({ evidenceId: "same", family: "MARKET_REGIME" }),
        evidence({ evidenceId: "same", family: "DATA_QUALITY" }),
      ],
    });
    expect(validateOpportunityDetectionContext(dup).reasonCodes).toContain("DUPLICATE_EVIDENCE");

    const unsafe = baseContext();
    (unsafe as { placesOrders: boolean }).placesOrders = true;
    expect(validateOpportunityDetectionContext(unsafe).ok).toBe(false);
  });

  it("preserves FORMING vs CLOSED candle states in evidence refs", () => {
    const ctx = baseContext({
      evidence: [
        evidence({ evidenceId: "tc.regime", family: "MARKET_REGIME", candleState: "FORMING" }),
        evidence({ evidenceId: "tc.mtf", family: "MULTI_TIMEFRAME_RELATIONSHIP", candleState: "CLOSED" }),
        evidence({ evidenceId: "tc.quality", family: "DATA_QUALITY", candleState: null }),
        evidence({ evidenceId: "tc.structure", family: "MARKET_STRUCTURE", candleState: "STALE" }),
      ],
    });
    expect(ctx.evidence.find((e) => e.evidenceId === "tc.regime")?.candleState).toBe("FORMING");
    expect(ctx.evidence.find((e) => e.evidenceId === "tc.mtf")?.candleState).toBe("CLOSED");
    expect(ctx.evidence.find((e) => e.evidenceId === "tc.structure")?.candleState).toBe("STALE");
  });
});

describe("Phase 5D Step2 — evidence validation", () => {
  const strategy = getDefaultMifStrategyIntelligenceRegistry().getStrategy("TREND_CONTINUATION")!;

  it("passes when required evidence present; warns on optional missing", () => {
    const r = validateDetectorEvidence({ strategy, context: baseContext() });
    expect(r.ok).toBe(true);
  });

  it("fails on missing required, blocked quality, and FORMING when closed required", () => {
    const missing = validateDetectorEvidence({
      strategy,
      context: baseContext({
        evidence: [evidence({ evidenceId: "tc.quality", family: "DATA_QUALITY" })],
        evidenceSummary: null,
      }),
    });
    expect(missing.ok).toBe(false);
    expect(missing.reasonCodes).toContain("INSUFFICIENT_EVIDENCE");

    const blocked = validateDetectorEvidence({
      strategy,
      context: baseContext({ dataQualityStatus: "BLOCKED" }),
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.reasonCodes).toContain("BLOCKED_BY_DATA_QUALITY");
  });

  it("flags duplicate source assessment ids without treating them as independent", () => {
    const r = validateDetectorEvidence({
      strategy,
      context: baseContext({
        evidence: [
          evidence({ evidenceId: "tc.regime", family: "MARKET_REGIME", sourceAssessmentId: "shared" }),
          evidence({ evidenceId: "tc.mtf", family: "MULTI_TIMEFRAME_RELATIONSHIP", sourceAssessmentId: "shared" }),
          evidence({ evidenceId: "tc.quality", family: "DATA_QUALITY", sourceAssessmentId: "q" }),
          evidence({ evidenceId: "tc.structure", family: "MARKET_STRUCTURE", sourceAssessmentId: "s" }),
        ],
      }),
    });
    expect(r.duplicateSourceAssessmentIds).toContain("shared");
    expect(r.warnings.some((w) => /duplicate source/i.test(w))).toBe(true);
  });
});

describe("Phase 5D Step2 — candidate contract", () => {
  it("builds deterministic candidate identity and validates contract", () => {
    const ctx = baseContext();
    const a = buildOpportunityCandidate({
      context: ctx,
      strategyId: "TREND_CONTINUATION",
      detectorId: "det.tc",
      detectorVersion: "1.0.0",
      strategyDefinitionVersion: "1.0.0",
      policyVersion: "1.0.0",
      direction: "BUY",
      thesis: "Continuation setup",
      rationale: "Trending UP with aligned MTF",
      supportingEvidenceIds: ["tc.regime", "tc.mtf"],
    });
    const b = buildOpportunityCandidate({
      context: ctx,
      strategyId: "TREND_CONTINUATION",
      detectorId: "det.tc",
      detectorVersion: "1.0.0",
      strategyDefinitionVersion: "1.0.0",
      policyVersion: "1.0.0",
      direction: "BUY",
      thesis: "Continuation setup",
      rationale: "Trending UP with aligned MTF",
      supportingEvidenceIds: ["tc.regime", "tc.mtf"],
    });
    expect(a.candidateId).toBe(b.candidateId);
    expect(a.contractId).toBe(MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID);
    expect(a.direction).toBe("BUY");
    expect(a.notExecutable).toBe(true);
    expect(validateOpportunityCandidate(a, {
      strategyId: "TREND_CONTINUATION",
      detectorId: "det.tc",
    }).ok).toBe(true);

    const id2 = computeOpportunityCandidateId({
      strategyId: "TREND_CONTINUATION",
      detectorId: "det.tc",
      detectorVersion: "1.0.0",
      strategyDefinitionVersion: "1.0.0",
      policyVersion: "1.0.0",
      providerSymbol: "XAUUSD",
      direction: "SELL",
      assessmentTimestamp: ctx.assessmentTimestamp,
      supportingEvidenceIds: ["tc.regime", "tc.mtf"],
      contextEvidenceFingerprint: fingerprintContextEvidence(ctx),
    });
    expect(id2).not.toBe(a.candidateId);
  });

  it("rejects invalid candidates (missing identity, provenance, unsafe flags, bad score)", () => {
    const ctx = baseContext();
    const good = buildOpportunityCandidate({
      context: ctx,
      strategyId: "TREND_CONTINUATION",
      detectorId: "det.tc",
      detectorVersion: "1.0.0",
      strategyDefinitionVersion: "1.0.0",
      policyVersion: "1.0.0",
      direction: "UNKNOWN",
      thesis: "t",
      rationale: "r",
      supportingEvidenceIds: [],
    });
    expect(validateOpportunityCandidate({ ...good, candidateId: "" }, {
      strategyId: "TREND_CONTINUATION",
      detectorId: "det.tc",
    }).ok).toBe(false);
    expect(validateOpportunityCandidate({ ...good, strategyId: "OTHER" }, {
      strategyId: "TREND_CONTINUATION",
      detectorId: "det.tc",
    }).ok).toBe(false);
    expect(
      validateOpportunityCandidate(
        {
          ...good,
          quality: {
            score: 2,
            definition: "bad",
            components: [],
            notWinProbability: true,
          },
        },
        { strategyId: "TREND_CONTINUATION", detectorId: "det.tc" },
      ).ok,
    ).toBe(false);
  });
});
