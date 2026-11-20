/**
 * Phase 5D.6/5D.7 — observational lifecycle updates from subsequent candles.
 * Uses deterministic outcome-evaluation engine. Does not invent entry/SL/TP.
 * Does not interact with brokers.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import {
  evaluateOpportunityOutcome,
  extractLevelsFromCandidateNotes,
  type MifOutcomeEvaluationRecord,
  type MifOutcomeLevelSpec,
} from "./outcome-evaluation.js";
import { getMifOpportunityStorage } from "./persistence/storage.js";
import type { MifCandidateLifecycleState, MifCandidateOutcomeKind } from "./persistence/types.js";

export interface ObserveCandidateInput {
  candidateId: string;
  /** Subsequent closed candles after detection (chronological preferred). */
  closedCandles: readonly MifCanonicalCandle[];
  /**
   * Optional analytical invalidation price from candidate notes/conditions.
   * When absent, levels are extracted from the persisted snapshot when present.
   * Never fabricated.
   */
  invalidationPrice?: number | null;
  invalidationSide?: "ABOVE" | "BELOW" | null;
  /** Optional analytical target — never fabricated by this module. */
  targetPrice?: number | null;
  targetSide?: "ABOVE" | "BELOW" | null;
  entryPrice?: number | null;
  maxAgeBars?: number;
  /** Override activation time; default = tip openTimeSec from candidate snapshot if present. */
  activationOpenTimeSec?: number | null;
  persistEvaluation?: boolean;
}

function mapLifecycle(
  resultKind: MifOutcomeEvaluationRecord["resultKind"],
): { toState: MifCandidateLifecycleState; outcomeKind: MifCandidateOutcomeKind } | null {
  switch (resultKind) {
    case "BOTH_AMBIGUOUS_SAME_CANDLE":
    case "AMBIGUOUS_OUTCOME":
      return { toState: "OUTCOME_UNKNOWN", outcomeKind: "BOTH_AMBIGUOUS_SAME_CANDLE" };
    case "INVALIDATION_REACHED":
      return { toState: "INVALIDATED", outcomeKind: "INVALIDATION_REACHED" };
    case "TARGET_REACHED":
      return { toState: "COMPLETED", outcomeKind: "TARGET_REACHED" };
    case "EXPIRED_UNRESOLVED":
      return { toState: "EXPIRED", outcomeKind: "EXPIRED_UNRESOLVED" };
    case "STILL_ACTIVE":
      return { toState: "ACTIVE", outcomeKind: "NONE" };
    default:
      return null;
  }
}

/**
 * Observe subsequent market data against a persisted candidate.
 * Temporally correct via evaluateOpportunityOutcome.
 */
export async function observeCandidateAgainstCandles(
  input: ObserveCandidateInput,
): Promise<{
  ok: boolean;
  lifecycleState: MifCandidateLifecycleState | null;
  outcomeKind: MifCandidateOutcomeKind | null;
  evaluation: MifOutcomeEvaluationRecord | null;
  error?: string;
}> {
  const store = getMifOpportunityStorage();
  const candidate = await store.getCandidate(input.candidateId);
  if (!candidate) {
    return {
      ok: false,
      lifecycleState: null,
      outcomeKind: null,
      evaluation: null,
      error: "not_found",
    };
  }

  const extracted = extractLevelsFromCandidateNotes({
    invalidationConditions: candidate.invalidationConditions,
    requiredConfirmations: candidate.requiredConfirmations,
    thesis: candidate.thesis,
    rationale: candidate.rationale,
  });

  const levels: MifOutcomeLevelSpec = {
    targetPrice: input.targetPrice ?? extracted.targetPrice,
    targetSide: input.targetSide ?? extracted.targetSide,
    invalidationPrice: input.invalidationPrice ?? extracted.invalidationPrice,
    invalidationSide: input.invalidationSide ?? extracted.invalidationSide,
    entryPrice: input.entryPrice ?? extracted.entryPrice,
  };

  const snap = candidate.candidateSnapshot as {
    tipOpenTimeSec?: number;
    openTimeSec?: number;
    assessmentTimestamp?: string;
  } | undefined;

  let activation =
    input.activationOpenTimeSec
    ?? snap?.tipOpenTimeSec
    ?? snap?.openTimeSec
    ?? null;

  if (activation == null && candidate.assessmentTimestamp) {
    const ms = Date.parse(candidate.assessmentTimestamp);
    if (Number.isFinite(ms)) activation = Math.floor(ms / 1000) - 1;
  }
  if (activation == null) {
    // Fail-safe: use earliest observation - 1 so first bar can evaluate if levels exist,
    // but prefer explicit activation. Without any time anchor, report insufficient.
    const first = input.closedCandles
      .filter((c) => c.candleState === "CLOSED")
      .sort((a, b) => a.openTimeSec - b.openTimeSec)[0];
    if (!first) {
      return {
        ok: true,
        lifecycleState: candidate.lifecycleState,
        outcomeKind: candidate.outcomeKind,
        evaluation: null,
      };
    }
    activation = first.openTimeSec - 1;
  }

  const evaluation = evaluateOpportunityOutcome({
    candidateId: input.candidateId,
    opportunitySnapshotRef: candidate.candidateId,
    activationOpenTimeSec: activation,
    levels,
    closedCandles: input.closedCandles,
    maxAgeBars: input.maxAgeBars,
  });

  if (input.persistEvaluation !== false) {
    await store.persistOutcomeEvaluation(evaluation);
  }

  const mapped = mapLifecycle(evaluation.resultKind);
  if (!mapped) {
    return {
      ok: true,
      lifecycleState: candidate.lifecycleState,
      outcomeKind: candidate.outcomeKind,
      evaluation,
    };
  }

  // Soft STILL_ACTIVE only advances DETECTED/NEEDS_CONFIRMATION → ACTIVE
  if (
    evaluation.resultKind === "STILL_ACTIVE"
    && candidate.lifecycleState !== "DETECTED"
    && candidate.lifecycleState !== "NEEDS_CONFIRMATION"
  ) {
    return {
      ok: true,
      lifecycleState: candidate.lifecycleState,
      outcomeKind: candidate.outcomeKind,
      evaluation,
    };
  }

  const reason =
    evaluation.resultKind === "BOTH_AMBIGUOUS_SAME_CANDLE"
      ? "ambiguous_same_candle_target_and_invalidation"
      : evaluation.resultKind === "INVALIDATION_REACHED"
        ? "invalidation_price_observed"
        : evaluation.resultKind === "TARGET_REACHED"
          ? "target_price_observed"
          : evaluation.resultKind === "EXPIRED_UNRESOLVED"
            ? "max_observation_age"
            : "observation_window_active";

  const tr = await store.transitionLifecycle({
    candidateId: input.candidateId,
    toState: mapped.toState,
    reason,
    observationOpenTimeSec: evaluation.resolvedOpenTimeSec,
    outcomeKind: mapped.outcomeKind,
    notes: evaluation.ambiguityReason ?? evaluation.exclusionReason ?? evaluation.evaluationId,
  });

  return {
    ok: tr.ok,
    lifecycleState: tr.candidate?.lifecycleState ?? null,
    outcomeKind: tr.candidate?.outcomeKind ?? null,
    evaluation,
    error: tr.error,
  };
}
