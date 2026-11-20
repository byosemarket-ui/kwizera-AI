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
import { extractSourceBackedPricesFromEvidence } from "./detectors/shared.js";
import type { MifTimeframeRole } from "../strategy-intelligence/types.js";
import type {
  MifOpportunityCandidate,
  MifOpportunityCandidateQuality,
  MifOpportunityCandidateStatus,
  MifOpportunityDetectionContext,
  MifOpportunityDirection,
} from "./types.js";

/**
 * Attach parseable level tokens sourced only from supporting evidence notes.
 * Never invents entry/target/invalidation. Enables probability/AI grounding.
 */
export function attachSourceBackedLevelConditions(input: {
  context: MifOpportunityDetectionContext;
  supportingEvidenceIds: readonly string[];
  invalidationConditions: readonly string[];
  knownLimitations: readonly string[];
  direction: MifOpportunityDirection;
}): {
  invalidationConditions: string[];
  knownLimitations: string[];
} {
  const invalidationConditions = [...input.invalidationConditions];
  const knownLimitations = [...input.knownLimitations];
  const hasInvPrice = invalidationConditions.some((c) => /invalidationPrice\s*=/i.test(c));
  if (hasInvPrice) {
    return { invalidationConditions, knownLimitations };
  }

  const extracted = extractSourceBackedPricesFromEvidence(
    input.context.evidence,
    input.supportingEvidenceIds,
  );
  const mentionsStructureBreak = invalidationConditions.some((c) =>
    /structure_break|structural|swing/i.test(c),
  );
  const mentionsBoundary = invalidationConditions.some((c) =>
    /boundary|support|resistance|zone/i.test(c),
  );

  let attached: number | null = null;
  let sourceTag = "";
  if (mentionsStructureBreak && extracted.structurePrice != null) {
    attached = extracted.structurePrice;
    sourceTag = "MARKET_STRUCTURE.price";
  } else if ((mentionsBoundary || mentionsStructureBreak) && extracted.boundaryMid != null) {
    attached = extracted.boundaryMid;
    sourceTag = "SUPPORT_RESISTANCE.mid";
  } else if (extracted.structurePrice != null) {
    attached = extracted.structurePrice;
    sourceTag = "MARKET_STRUCTURE.price";
  } else if (extracted.boundaryMid != null) {
    attached = extracted.boundaryMid;
    sourceTag = "SUPPORT_RESISTANCE.mid";
  }

  if (attached == null) {
    knownLimitations.push("LEVELS_NOT_PROVIDED: no parseable source-backed mid/price in supporting evidence");
    return { invalidationConditions, knownLimitations };
  }

  invalidationConditions.push(`invalidationPrice=${attached}`);
  // Directional invalidation side when direction is known (structure reclaim / boundary reclaim)
  if (input.direction === "BUY") {
    invalidationConditions.push("invalidationSide=BELOW");
  } else if (input.direction === "SELL") {
    invalidationConditions.push("invalidationSide=ABOVE");
  }
  knownLimitations.push(
    `Source-backed invalidationPrice attached from ${sourceTag} (${extracted.sources.join(",") || "evidence"}); not invented`,
  );
  return { invalidationConditions, knownLimitations };
}

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

  const leveled = attachSourceBackedLevelConditions({
    context: input.context,
    supportingEvidenceIds: input.supportingEvidenceIds,
    invalidationConditions: input.invalidationConditions ?? [],
    knownLimitations: input.knownLimitations ?? [],
    direction: input.direction,
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
    invalidationConditions: leveled.invalidationConditions,
    knownLimitations: leveled.knownLimitations,
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
