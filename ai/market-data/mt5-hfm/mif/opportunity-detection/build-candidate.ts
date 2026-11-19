/**
 * Phase 5D Step 2 — helper to assemble a valid candidate with deterministic identity.
 * Does not invent analytical claims — callers supply thesis/rationale/evidence.
 */
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import {
  computeOpportunityCandidateId,
  fingerprintContextEvidence,
} from "./candidate-identity.js";
import {
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION,
} from "./contracts.js";
import type { MifTimeframeRole } from "../strategy-intelligence/types.js";
import type {
  MifOpportunityCandidate,
  MifOpportunityCandidateQuality,
  MifOpportunityCandidateStatus,
  MifOpportunityDetectionContext,
  MifOpportunityDirection,
} from "./types.js";

export interface BuildOpportunityCandidateInput {
  context: MifOpportunityDetectionContext;
  strategyId: string;
  detectorId: string;
  detectorVersion: string;
  strategyDefinitionVersion: string;
  policyVersion: string;
  direction: MifOpportunityDirection;
  status?: MifOpportunityCandidateStatus;
  thesis: string;
  rationale: string;
  supportingEvidenceIds: readonly string[];
  conflictingEvidenceIds?: readonly string[];
  requiredConfirmations?: readonly string[];
  invalidationConditions?: readonly string[];
  knownLimitations?: readonly string[];
  timeframeRoles?: readonly MifTimeframeRole[];
  quality?: MifOpportunityCandidateQuality | null;
  regimeAssessmentId?: string | null;
  mtfAssessmentId?: string | null;
}

export function buildOpportunityCandidate(
  input: BuildOpportunityCandidateInput,
): MifOpportunityCandidate {
  const fp = fingerprintContextEvidence(input.context);
  const candidateId = computeOpportunityCandidateId({
    strategyId: input.strategyId,
    detectorId: input.detectorId,
    detectorVersion: input.detectorVersion,
    strategyDefinitionVersion: input.strategyDefinitionVersion,
    policyVersion: input.policyVersion,
    providerSymbol: input.context.providerSymbol,
    direction: input.direction,
    assessmentTimestamp: input.context.assessmentTimestamp,
    supportingEvidenceIds: input.supportingEvidenceIds,
    contextEvidenceFingerprint: fp,
  });

  return {
    contractId: MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
    contractVersion: MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION,
    candidateId,
    strategyId: input.strategyId,
    detectorId: input.detectorId,
    detectorVersion: input.detectorVersion,
    strategyDefinitionVersion: input.strategyDefinitionVersion,
    policyVersion: input.policyVersion,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: String(input.context.providerSymbol || "").trim().toUpperCase(),
    instrument: input.context.instrument,
    direction: input.direction,
    timeframeRoles: input.timeframeRoles ?? input.context.availableTimeframeRoles,
    assessmentTimestamp: input.context.assessmentTimestamp,
    status: input.status ?? "DETECTED",
    thesis: input.thesis,
    rationale: input.rationale,
    supportingEvidenceIds: [...input.supportingEvidenceIds],
    conflictingEvidenceIds: [...(input.conflictingEvidenceIds ?? [])],
    requiredConfirmations: [...(input.requiredConfirmations ?? [])],
    invalidationConditions: [...(input.invalidationConditions ?? [])],
    knownLimitations: [...(input.knownLimitations ?? [])],
    quality: input.quality ?? null,
    regimeAssessmentId: input.regimeAssessmentId ?? input.context.regime?.assessmentId ?? null,
    mtfAssessmentId: input.mtfAssessmentId ?? input.context.mtfRelationships?.assessmentId ?? null,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalCandidateOnly: true,
    notExecutable: true,
  };
}
