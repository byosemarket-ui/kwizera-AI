/**
 * Phase 5D Step 2 — deterministic candidate identity (excludes wall-clock).
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifOpportunityCandidate, MifOpportunityDetectionContext } from "./types.js";

export function computeOpportunityCandidateId(input: {
  strategyId: string;
  detectorId: string;
  detectorVersion: string;
  strategyDefinitionVersion: string;
  policyVersion: string;
  providerSymbol: string;
  direction: string;
  assessmentTimestamp: string;
  supportingEvidenceIds: readonly string[];
  contextEvidenceFingerprint: string;
}): string {
  const payload = {
    strategyId: input.strategyId,
    detectorId: input.detectorId,
    detectorVersion: input.detectorVersion,
    strategyDefinitionVersion: input.strategyDefinitionVersion,
    policyVersion: input.policyVersion,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    direction: input.direction,
    assessmentTimestamp: input.assessmentTimestamp,
    supportingEvidenceIds: [...input.supportingEvidenceIds].sort(),
    contextEvidenceFingerprint: input.contextEvidenceFingerprint,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function fingerprintContextEvidence(ctx: MifOpportunityDetectionContext): string {
  const payload = {
    providerSymbol: String(ctx.providerSymbol || "").trim().toUpperCase(),
    assessmentTimestamp: ctx.assessmentTimestamp,
    dataQualityStatus: ctx.dataQualityStatus,
    evidence: ctx.evidence.map((e) => ({
      evidenceId: e.evidenceId,
      family: e.family,
      presence: e.presence,
      sourceAssessmentId: e.sourceAssessmentId,
      qualityStatus: e.qualityStatus,
    })),
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function validateOpportunityCandidate(
  candidate: MifOpportunityCandidate | null | undefined,
  expected: { strategyId: string; detectorId: string },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!candidate) return { ok: false, errors: ["candidate missing"] };
  if (!candidate.candidateId?.trim()) errors.push("candidateId missing");
  if (candidate.strategyId !== expected.strategyId) errors.push("strategyId mismatch");
  if (candidate.detectorId !== expected.detectorId) errors.push("detectorId mismatch");
  if (!candidate.detectorVersion?.trim()) errors.push("detectorVersion missing");
  if (!candidate.strategyDefinitionVersion?.trim()) errors.push("strategyDefinitionVersion missing");
  if (!candidate.policyVersion?.trim()) errors.push("policyVersion missing");
  if (!candidate.providerSymbol?.trim()) errors.push("providerSymbol missing");
  if (!candidate.thesis?.trim()) errors.push("thesis missing");
  if (!candidate.rationale?.trim()) errors.push("rationale missing");
  if (candidate.placesOrders !== false) errors.push("placesOrders must be false");
  if (candidate.acceptsForExecution !== false) errors.push("acceptsForExecution must be false");
  if (candidate.doesNotApproveAiReasoning !== true) errors.push("doesNotApproveAiReasoning must be true");
  if (candidate.analyticalCandidateOnly !== true) errors.push("analyticalCandidateOnly must be true");
  if (candidate.notExecutable !== true) errors.push("notExecutable must be true");
  if (candidate.quality && candidate.quality.notWinProbability !== true) {
    errors.push("quality.notWinProbability must be true");
  }
  if (candidate.quality?.score != null) {
    if (!(candidate.quality.score >= 0 && candidate.quality.score <= 1)) {
      errors.push("quality.score must be in [0,1] when present");
    }
  }
  return { ok: errors.length === 0, errors };
}
