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
import {
  extractSourceBackedPricesFromEvidence,
  type SourceBackedPriceBundle,
} from "./detectors/shared.js";
import type { MifTimeframeRole } from "../strategy-intelligence/types.js";
import type {
  MifOpportunityCandidate,
  MifOpportunityCandidateQuality,
  MifOpportunityCandidateStatus,
  MifOpportunityDetectionContext,
  MifOpportunityDirection,
} from "./types.js";

function hasToken(conditions: readonly string[], key: string): boolean {
  const re = new RegExp(`${key}\\s*=`, "i");
  return conditions.some((c) => re.test(c));
}

function pushUnique(list: string[], token: string): void {
  if (!list.includes(token)) list.push(token);
}

/**
 * Strategy-aware attachment of parseable level tokens from supporting evidence only.
 * Never invents entry/target/invalidation. Enables probability/AI grounding when
 * both target and invalidation exist with sides.
 */
export function attachSourceBackedLevelConditions(input: {
  context: MifOpportunityDetectionContext;
  strategyId: string;
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
  // Supporting ids plus PRESENT SR/range/liquidity families (source-backed objectives).
  const levelEvidenceIds = [
    ...new Set([
      ...input.supportingEvidenceIds,
      ...input.context.evidence
        .filter(
          (e) =>
            e.presence === "PRESENT"
            && e.qualityStatus !== "BLOCKED"
            && e.qualityStatus !== "MISSING"
            && (
              e.family === "SUPPORT_RESISTANCE"
              || e.family === "RANGE_STRUCTURE"
              || e.family === "LIQUIDITY_REFERENCE"
              || e.family === "MARKET_STRUCTURE"
            ),
        )
        .map((e) => e.evidenceId),
    ]),
  ];
  const extracted = extractSourceBackedPricesFromEvidence(
    input.context.evidence,
    levelEvidenceIds,
  );
  const strategyId = String(input.strategyId || "").trim().toUpperCase();
  const direction = input.direction;

  // --- Invalidation (structure / boundary) ---
  if (!hasToken(invalidationConditions, "invalidationPrice")) {
    const mentionsStructureBreak = invalidationConditions.some((c) =>
      /structure_break|structural|swing|failed_structure|accepted_through/i.test(c),
    );
    const mentionsBoundary = invalidationConditions.some((c) =>
      /boundary|support|resistance|zone|range_break|failed_breakout|zone_mitigated/i.test(c),
    );

    let attached: number | null = null;
    let sourceTag = "";
    if (mentionsStructureBreak && extracted.structurePrice != null) {
      attached = extracted.structurePrice;
      sourceTag = "MARKET_STRUCTURE.price";
    } else if ((mentionsBoundary || mentionsStructureBreak) && extracted.boundaryMid != null) {
      attached = extracted.boundaryMid;
      sourceTag = "SUPPORT_RESISTANCE.mid";
    } else if (strategyId === "RANGE" && direction === "BUY" && extracted.rangeLow != null) {
      attached = extracted.rangeLow;
      sourceTag = "RANGE.rangeLow";
    } else if (strategyId === "RANGE" && direction === "SELL" && extracted.rangeHigh != null) {
      attached = extracted.rangeHigh;
      sourceTag = "RANGE.rangeHigh";
    } else if (extracted.structurePrice != null) {
      attached = extracted.structurePrice;
      sourceTag = "MARKET_STRUCTURE.price";
    } else if (extracted.boundaryMid != null) {
      attached = extracted.boundaryMid;
      sourceTag = "SUPPORT_RESISTANCE.mid";
    }

    if (attached != null) {
      pushUnique(invalidationConditions, `invalidationPrice=${attached}`);
      if (direction === "BUY") pushUnique(invalidationConditions, "invalidationSide=BELOW");
      else if (direction === "SELL") pushUnique(invalidationConditions, "invalidationSide=ABOVE");
      knownLimitations.push(
        `Source-backed invalidationPrice attached from ${sourceTag} (${extracted.sources.join(",") || "evidence"}); not invented`,
      );
    }
  }

  // --- Entry / target (methodology-gated) ---
  attachEntryAndTarget({
    strategyId,
    direction,
    extracted,
    invalidationConditions,
    knownLimitations,
  });

  if (
    !hasToken(invalidationConditions, "invalidationPrice")
    && !hasToken(invalidationConditions, "entryPrice")
    && !hasToken(invalidationConditions, "targetPrice")
  ) {
    knownLimitations.push(
      "LEVELS_NOT_PROVIDED: no parseable source-backed mid/price/range levels in supporting evidence",
    );
  } else if (
    !hasToken(invalidationConditions, "targetPrice")
    || !hasToken(invalidationConditions, "invalidationPrice")
  ) {
    knownLimitations.push(
      "LEVELS_PARTIAL: probability requires both source-backed targetPrice and invalidationPrice; missing levels stay unavailable (not invented)",
    );
  }

  return { invalidationConditions, knownLimitations };
}

function attachEntryAndTarget(input: {
  strategyId: string;
  direction: MifOpportunityDirection;
  extracted: SourceBackedPriceBundle;
  invalidationConditions: string[];
  knownLimitations: string[];
}): void {
  const { strategyId, direction, extracted, invalidationConditions, knownLimitations } = input;
  if (direction !== "BUY" && direction !== "SELL") return;

  let entry: number | null = null;
  let entryTag = "";
  let target: number | null = null;
  let targetTag = "";

  switch (strategyId) {
    case "RANGE": {
      // Mean-reversion at documented range bounds: entry at near bound, target at far bound.
      if (direction === "BUY") {
        entry = extracted.rangeLow ?? extracted.supportMid ?? extracted.boundaryMid;
        entryTag = extracted.rangeLow != null
          ? "RANGE.rangeLow"
          : extracted.supportMid != null
            ? "SUPPORT_RESISTANCE.supportMid"
            : "SUPPORT_RESISTANCE.mid";
        target = extracted.rangeHigh ?? extracted.resistanceMid;
        targetTag = extracted.rangeHigh != null
          ? "RANGE.rangeHigh"
          : "SUPPORT_RESISTANCE.resistanceMid";
      } else {
        entry = extracted.rangeHigh ?? extracted.resistanceMid ?? extracted.boundaryMid;
        entryTag = extracted.rangeHigh != null
          ? "RANGE.rangeHigh"
          : extracted.resistanceMid != null
            ? "SUPPORT_RESISTANCE.resistanceMid"
            : "SUPPORT_RESISTANCE.mid";
        target = extracted.rangeLow ?? extracted.supportMid;
        targetTag = extracted.rangeLow != null
          ? "RANGE.rangeLow"
          : "SUPPORT_RESISTANCE.supportMid";
      }
      break;
    }
    case "BREAKOUT":
    case "BREAKOUT_RETEST": {
      // Entry reference = broken/retested boundary mid; target = opposing SR if present.
      entry = extracted.boundaryMid;
      entryTag = "SUPPORT_RESISTANCE.mid";
      if (direction === "BUY") {
        target = extracted.resistanceMid;
        targetTag = "SUPPORT_RESISTANCE.resistanceMid";
      } else {
        target = extracted.supportMid;
        targetTag = "SUPPORT_RESISTANCE.supportMid";
      }
      break;
    }
    case "SUPPLY_DEMAND": {
      entry = extracted.boundaryMid;
      entryTag = "SUPPORT_RESISTANCE.mid";
      if (direction === "BUY") {
        target = extracted.resistanceMid ?? extracted.rangeHigh;
        targetTag = extracted.resistanceMid != null
          ? "SUPPORT_RESISTANCE.resistanceMid"
          : "RANGE.rangeHigh";
      } else {
        target = extracted.supportMid ?? extracted.rangeLow;
        targetTag = extracted.supportMid != null
          ? "SUPPORT_RESISTANCE.supportMid"
          : "RANGE.rangeLow";
      }
      break;
    }
    case "PULLBACK":
    case "TREND_CONTINUATION": {
      // Pullback/continuation: entry only from same-side SR; target from opposing SR/liquidity.
      // Do not fall back to the opposite boundary mid (would invent a wrong-side entry).
      if (direction === "BUY") {
        entry = extracted.supportMid;
        entryTag = "SUPPORT_RESISTANCE.supportMid";
        target = extracted.resistanceMid ?? extracted.liquidityPrice ?? extracted.rangeHigh;
        targetTag = extracted.resistanceMid != null
          ? "SUPPORT_RESISTANCE.resistanceMid"
          : extracted.liquidityPrice != null
            ? "LIQUIDITY_REFERENCE.price"
            : "RANGE.rangeHigh";
      } else {
        entry = extracted.resistanceMid;
        entryTag = "SUPPORT_RESISTANCE.resistanceMid";
        target = extracted.supportMid ?? extracted.liquidityPrice ?? extracted.rangeLow;
        targetTag = extracted.supportMid != null
          ? "SUPPORT_RESISTANCE.supportMid"
          : extracted.liquidityPrice != null
            ? "LIQUIDITY_REFERENCE.price"
            : "RANGE.rangeLow";
      }
      break;
    }
    case "REVERSAL":
    case "LIQUIDITY_SWEEP": {
      // Sweep/reversal reclaim: entry near swept liquidity/structure; target opposing SR.
      entry = extracted.liquidityPrice ?? extracted.structurePrice ?? extracted.boundaryMid;
      entryTag = extracted.liquidityPrice != null
        ? "LIQUIDITY_REFERENCE.price"
        : extracted.structurePrice != null
          ? "MARKET_STRUCTURE.price"
          : "SUPPORT_RESISTANCE.mid";
      if (direction === "BUY") {
        target = extracted.resistanceMid ?? extracted.rangeHigh;
        targetTag = extracted.resistanceMid != null
          ? "SUPPORT_RESISTANCE.resistanceMid"
          : "RANGE.rangeHigh";
      } else {
        target = extracted.supportMid ?? extracted.rangeLow;
        targetTag = extracted.supportMid != null
          ? "SUPPORT_RESISTANCE.supportMid"
          : "RANGE.rangeLow";
      }
      break;
    }
    case "PATTERN_COMPLETION":
    case "MOMENTUM_EXPANSION": {
      // Only attach when clear SR objectives exist — no fabricated measured moves.
      entry = extracted.boundaryMid ?? extracted.structurePrice;
      entryTag = extracted.boundaryMid != null
        ? "SUPPORT_RESISTANCE.mid"
        : "MARKET_STRUCTURE.price";
      if (direction === "BUY") {
        target = extracted.resistanceMid ?? extracted.rangeHigh;
        targetTag = extracted.resistanceMid != null
          ? "SUPPORT_RESISTANCE.resistanceMid"
          : "RANGE.rangeHigh";
      } else {
        target = extracted.supportMid ?? extracted.rangeLow;
        targetTag = extracted.supportMid != null
          ? "SUPPORT_RESISTANCE.supportMid"
          : "RANGE.rangeLow";
      }
      break;
    }
    default:
      return;
  }

  if (entry != null && Number.isFinite(entry) && !hasToken(invalidationConditions, "entryPrice")) {
    pushUnique(invalidationConditions, `entryPrice=${entry}`);
    knownLimitations.push(
      `Source-backed entryPrice attached from ${entryTag}; analytical reference only — not an order price`,
    );
  }
  if (target != null && Number.isFinite(target) && !hasToken(invalidationConditions, "targetPrice")) {
    // Reject target that equals invalidation or entry (non-actionable).
    const inv = extracted.structurePrice ?? extracted.boundaryMid;
    const entryNum = entry;
    if (inv != null && target === inv) {
      knownLimitations.push(
        "TARGET_REJECTED: source target equals invalidation reference; left unavailable",
      );
    } else if (entryNum != null && target === entryNum) {
      knownLimitations.push(
        "TARGET_REJECTED: source target equals entry reference; left unavailable",
      );
    } else {
      pushUnique(invalidationConditions, `targetPrice=${target}`);
      if (direction === "BUY") pushUnique(invalidationConditions, "targetSide=ABOVE");
      else pushUnique(invalidationConditions, "targetSide=BELOW");
      knownLimitations.push(
        `Source-backed targetPrice attached from ${targetTag}; not an invented R:R target`,
      );
    }
  }
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
    strategyId: input.strategyId,
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
