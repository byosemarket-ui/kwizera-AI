/**
 * Phase 5D.6 — Evidence Quality Assessment.
 * Separates data quality, completeness, analytical confidence, MTF agreement.
 * Does NOT invent win probabilities. Execution readiness always false.
 */
import type { MifOpportunityDetectionContext, MifOpportunityCandidate } from "../opportunity-detection/types.js";
import type { MifStrategyEligibilityResult } from "../strategy-intelligence/types.js";

export type MifEvidenceQualityBand = "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "INSUFFICIENT_EVIDENCE";

export interface MifEvidenceQualityAssessment {
  contractId: "kwizera.mif.evidence-quality.v1";
  contractVersion: "1.0.0";
  assessmentTimestamp: string;
  dataQuality: MifEvidenceQualityBand;
  evidenceCompleteness: MifEvidenceQualityBand;
  analyticalConfidence: MifEvidenceQualityBand;
  patternOrSetupQuality: MifEvidenceQualityBand;
  directionalAgreement: MifEvidenceQualityBand;
  mtfAgreement: MifEvidenceQualityBand;
  /** Always false — never execution-ready from this module. */
  executionReadiness: false;
  requiredEvidenceIds: readonly string[];
  availableEvidenceIds: readonly string[];
  missingEvidenceIds: readonly string[];
  staleEvidenceIds: readonly string[];
  conflictingEvidenceIds: readonly string[];
  partialSourceFamilies: readonly string[];
  projectionDerivedFamilies: readonly string[];
  overallBand: MifEvidenceQualityBand;
  analysisImpact: "ALLOW" | "PARTIAL_DEGRADED" | "FORCE_NEEDS_CONFIRMATION" | "BLOCK_CANDIDATES" | "FAIL_ANALYSIS";
  explanation: string;
  notWinProbability: true;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
}

export interface MifCandidateQualityImpact {
  candidateId: string;
  suggestedStatus: "DETECTED" | "NEEDS_CONFIRMATION" | "INVALID" | "REJECTED";
  reasons: readonly string[];
}

function bandFromDataQuality(q: string): MifEvidenceQualityBand {
  switch (q) {
    case "VALID":
      return "VALID";
    case "WARNING":
      return "WARNING";
    case "DEGRADED":
      return "DEGRADED";
    case "BLOCKED":
    case "MISSING":
      return "BLOCKED";
    default:
      return "WARNING";
  }
}

export function assessMifEvidenceQuality(input: {
  context: MifOpportunityDetectionContext;
  eligibility: readonly MifStrategyEligibilityResult[];
  candidates?: readonly MifOpportunityCandidate[];
  assessmentTimestamp?: string;
}): MifEvidenceQualityAssessment {
  const ctx = input.context;
  const ts = input.assessmentTimestamp ?? ctx.assessmentTimestamp;
  const required = new Set<string>();
  const missing = new Set<string>();
  for (const e of input.eligibility) {
    for (const m of e.missing ?? []) required.add(m.evidenceId);
    for (const m of e.missing ?? []) missing.add(m.evidenceId);
    for (const s of e.satisfied ?? []) required.add(s.evidenceId);
  }

  const available = ctx.evidence
    .filter((e) => e.presence === "PRESENT")
    .map((e) => e.evidenceId);
  const availableSet = new Set(available);
  for (const id of available) required.add(id);

  const stale = ctx.evidence
    .filter((e) => e.candleState === "STALE" || /stale=TRUE/i.test(e.notes ?? ""))
    .map((e) => e.evidenceId);

  const conflicting = new Set<string>();
  for (const c of input.candidates ?? []) {
    for (const id of c.conflictingEvidenceIds) conflicting.add(id);
  }
  if (ctx.mtfRelationships?.conflicts?.hasConflict) {
    const mtfEv = ctx.evidence.find((e) => e.family === "MULTI_TIMEFRAME_RELATIONSHIP");
    if (mtfEv) conflicting.add(mtfEv.evidenceId);
  }

  const partialSourceFamilies: string[] = [];
  const projectionDerivedFamilies: string[] = [];
  for (const e of ctx.evidence) {
    if (/PARTIAL/i.test(e.notes ?? "")) {
      if (!partialSourceFamilies.includes(e.family)) partialSourceFamilies.push(e.family);
    }
    if (/projection from regime/i.test(e.notes ?? "")) {
      if (!projectionDerivedFamilies.includes(e.family)) projectionDerivedFamilies.push(e.family);
    }
  }

  const dataQuality = bandFromDataQuality(ctx.dataQualityStatus);
  const missingRequiredCount = [...missing].filter((id) => !id.startsWith("role:")).length;
  let evidenceCompleteness: MifEvidenceQualityBand = "VALID";
  if (missingRequiredCount > 0) evidenceCompleteness = "INSUFFICIENT_EVIDENCE";
  else if (partialSourceFamilies.length) evidenceCompleteness = "WARNING";

  let mtfAgreement: MifEvidenceQualityBand = "VALID";
  const rel = ctx.mtfRelationships?.directional?.relation;
  if (!rel || rel === "INSUFFICIENT_DATA" || rel === "UNKNOWN") mtfAgreement = "INSUFFICIENT_EVIDENCE";
  else if (rel === "CONFLICT" || rel === "POTENTIAL_REVERSAL") mtfAgreement = "DEGRADED";
  else if (rel === "PARTIAL_ALIGNMENT" || rel === "TRANSITION") mtfAgreement = "WARNING";

  let directionalAgreement: MifEvidenceQualityBand = "VALID";
  if (ctx.regime?.direction === "UNKNOWN") directionalAgreement = "INSUFFICIENT_EVIDENCE";
  else if (conflicting.size) directionalAgreement = "WARNING";

  let analyticalConfidence: MifEvidenceQualityBand = "VALID";
  if (dataQuality === "BLOCKED") analyticalConfidence = "BLOCKED";
  else if (evidenceCompleteness === "INSUFFICIENT_EVIDENCE") analyticalConfidence = "INSUFFICIENT_EVIDENCE";
  else if (dataQuality === "DEGRADED" || mtfAgreement === "DEGRADED") analyticalConfidence = "DEGRADED";
  else if (
    dataQuality === "WARNING"
    || evidenceCompleteness === "WARNING"
    || mtfAgreement === "WARNING"
    || partialSourceFamilies.length > 0
  ) {
    analyticalConfidence = "WARNING";
  }

  const patternOrSetupQuality = analyticalConfidence;

  let overallBand = analyticalConfidence;
  let analysisImpact: MifEvidenceQualityAssessment["analysisImpact"] = "ALLOW";
  if (dataQuality === "BLOCKED") {
    overallBand = "BLOCKED";
    analysisImpact = "FAIL_ANALYSIS";
  } else if (evidenceCompleteness === "INSUFFICIENT_EVIDENCE" && (input.candidates?.length ?? 0) === 0) {
    overallBand = "INSUFFICIENT_EVIDENCE";
    analysisImpact = "ALLOW";
  } else if (overallBand === "DEGRADED") {
    analysisImpact = "FORCE_NEEDS_CONFIRMATION";
  } else if (overallBand === "WARNING" || partialSourceFamilies.length) {
    analysisImpact = "PARTIAL_DEGRADED";
  }

  const explanation = [
    `dataQuality=${dataQuality}`,
    `completeness=${evidenceCompleteness}`,
    `mtf=${mtfAgreement}`,
    `partialFamilies=${partialSourceFamilies.join(",") || "none"}`,
    `impact=${analysisImpact}`,
  ].join("; ");

  return {
    contractId: "kwizera.mif.evidence-quality.v1",
    contractVersion: "1.0.0",
    assessmentTimestamp: ts,
    dataQuality,
    evidenceCompleteness,
    analyticalConfidence,
    patternOrSetupQuality,
    directionalAgreement,
    mtfAgreement,
    executionReadiness: false,
    requiredEvidenceIds: [...required],
    availableEvidenceIds: available.filter((id) => availableSet.has(id)),
    missingEvidenceIds: [...missing],
    staleEvidenceIds: stale,
    conflictingEvidenceIds: [...conflicting],
    partialSourceFamilies,
    projectionDerivedFamilies,
    overallBand,
    analysisImpact,
    explanation,
    notWinProbability: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
  };
}

/**
 * Apply evidence-quality impact rules to candidate statuses (pure; does not mutate inputs).
 */
export function applyEvidenceQualityToCandidates(
  candidates: readonly MifOpportunityCandidate[],
  quality: MifEvidenceQualityAssessment,
): { candidates: MifOpportunityCandidate[]; impacts: MifCandidateQualityImpact[] } {
  if (quality.analysisImpact === "BLOCK_CANDIDATES" || quality.analysisImpact === "FAIL_ANALYSIS") {
    return {
      candidates: [],
      impacts: candidates.map((c) => ({
        candidateId: c.candidateId,
        suggestedStatus: "REJECTED",
        reasons: [quality.explanation, "blocked_by_evidence_quality"],
      })),
    };
  }

  const impacts: MifCandidateQualityImpact[] = [];
  const out: MifOpportunityCandidate[] = candidates.map((c) => {
    const reasons: string[] = [];
    let status = c.status;
    if (quality.analysisImpact === "FORCE_NEEDS_CONFIRMATION" && status === "DETECTED") {
      status = "NEEDS_CONFIRMATION";
      reasons.push("DEGRADED evidence quality forces NEEDS_CONFIRMATION");
    }
    if (quality.analysisImpact === "PARTIAL_DEGRADED" && status === "DETECTED") {
      status = "NEEDS_CONFIRMATION";
      reasons.push("PARTIAL/WARNING evidence quality prevents full DETECTED confirmation");
    }
    if (c.requiredConfirmations.length && status === "DETECTED") {
      // Required confirmations unmet → keep NEEDS_CONFIRMATION if already set by detector
    }
    impacts.push({
      candidateId: c.candidateId,
      suggestedStatus: status === "INVALID" || status === "REJECTED" ? status : status,
      reasons: reasons.length ? reasons : ["no_status_change"],
    });
    if (status === c.status) return c;
    return { ...c, status };
  });
  return { candidates: out, impacts };
}
