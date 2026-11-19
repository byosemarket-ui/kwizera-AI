/**
 * Phase 5D.6 — observational lifecycle updates from subsequent candles.
 * Does not invent entry/SL/TP. Does not interact with brokers.
 * Ambiguous same-candle target+invalidation → OUTCOME_UNKNOWN.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import { getMifOpportunityStorage } from "./persistence/storage.js";
import type { MifCandidateLifecycleState, MifCandidateOutcomeKind } from "./persistence/types.js";

export interface ObserveCandidateInput {
  candidateId: string;
  /** Subsequent closed candles after detection (chronological). */
  closedCandles: readonly MifCanonicalCandle[];
  /**
   * Optional analytical invalidation price from candidate notes/conditions.
   * When absent, only expiry/observation bookkeeping is possible.
   */
  invalidationPrice?: number | null;
  invalidationSide?: "ABOVE" | "BELOW" | null;
  /** Optional analytical target — never fabricated by this module. */
  targetPrice?: number | null;
  targetSide?: "ABOVE" | "BELOW" | null;
  maxAgeBars?: number;
}

function crossed(
  candle: MifCanonicalCandle,
  price: number,
  side: "ABOVE" | "BELOW",
): boolean {
  if (side === "ABOVE") return candle.high >= price;
  return candle.low <= price;
}

/**
 * Observe subsequent market data against a persisted candidate.
 */
export async function observeCandidateAgainstCandles(
  input: ObserveCandidateInput,
): Promise<{
  ok: boolean;
  lifecycleState: MifCandidateLifecycleState | null;
  outcomeKind: MifCandidateOutcomeKind | null;
  error?: string;
}> {
  const store = getMifOpportunityStorage();
  const candidate = await store.getCandidate(input.candidateId);
  if (!candidate) return { ok: false, lifecycleState: null, outcomeKind: null, error: "not_found" };

  const maxAge = input.maxAgeBars ?? 200;
  const candles = input.closedCandles.filter((c) => c.candleState === "CLOSED").slice(0, maxAge);
  if (!candles.length) {
    return {
      ok: true,
      lifecycleState: candidate.lifecycleState,
      outcomeKind: candidate.outcomeKind,
    };
  }

  let invalidationHit: MifCanonicalCandle | null = null;
  let targetHit: MifCanonicalCandle | null = null;

  for (const c of candles) {
    if (
      input.invalidationPrice != null
      && input.invalidationSide
      && crossed(c, input.invalidationPrice, input.invalidationSide)
    ) {
      invalidationHit = c;
    }
    if (
      input.targetPrice != null
      && input.targetSide
      && crossed(c, input.targetPrice, input.targetSide)
    ) {
      targetHit = c;
    }
    if (invalidationHit && targetHit) break;
  }

  if (invalidationHit && targetHit && invalidationHit.openTimeSec === targetHit.openTimeSec) {
    const tr = await store.transitionLifecycle({
      candidateId: input.candidateId,
      toState: "OUTCOME_UNKNOWN",
      reason: "ambiguous_same_candle_target_and_invalidation",
      observationOpenTimeSec: invalidationHit.openTimeSec,
      outcomeKind: "BOTH_AMBIGUOUS_SAME_CANDLE",
      notes: "Cannot establish event order within a single candle OHLC bar",
    });
    return {
      ok: tr.ok,
      lifecycleState: tr.candidate?.lifecycleState ?? null,
      outcomeKind: tr.candidate?.outcomeKind ?? null,
      error: tr.error,
    };
  }

  if (invalidationHit && (!targetHit || invalidationHit.openTimeSec <= targetHit.openTimeSec)) {
    const tr = await store.transitionLifecycle({
      candidateId: input.candidateId,
      toState: "INVALIDATED",
      reason: "invalidation_price_observed",
      observationOpenTimeSec: invalidationHit.openTimeSec,
      outcomeKind: "INVALIDATION_REACHED",
    });
    return {
      ok: tr.ok,
      lifecycleState: tr.candidate?.lifecycleState ?? null,
      outcomeKind: tr.candidate?.outcomeKind ?? null,
      error: tr.error,
    };
  }

  if (targetHit) {
    const tr = await store.transitionLifecycle({
      candidateId: input.candidateId,
      toState: "COMPLETED",
      reason: "target_price_observed",
      observationOpenTimeSec: targetHit.openTimeSec,
      outcomeKind: "TARGET_REACHED",
    });
    return {
      ok: tr.ok,
      lifecycleState: tr.candidate?.lifecycleState ?? null,
      outcomeKind: tr.candidate?.outcomeKind ?? null,
      error: tr.error,
    };
  }

  if (candles.length >= maxAge) {
    const tr = await store.transitionLifecycle({
      candidateId: input.candidateId,
      toState: "EXPIRED",
      reason: "max_observation_age",
      observationOpenTimeSec: candles[candles.length - 1]!.openTimeSec,
      outcomeKind: "EXPIRED_UNRESOLVED",
    });
    return {
      ok: tr.ok,
      lifecycleState: tr.candidate?.lifecycleState ?? null,
      outcomeKind: tr.candidate?.outcomeKind ?? null,
      error: tr.error,
    };
  }

  // Soft progress: DETECTED → ACTIVE when observations exist without resolution
  if (candidate.lifecycleState === "DETECTED" || candidate.lifecycleState === "NEEDS_CONFIRMATION") {
    const tr = await store.transitionLifecycle({
      candidateId: input.candidateId,
      toState: "ACTIVE",
      reason: "observation_window_active",
      observationOpenTimeSec: candles[candles.length - 1]!.openTimeSec,
      outcomeKind: "NONE",
    });
    return {
      ok: tr.ok,
      lifecycleState: tr.candidate?.lifecycleState ?? null,
      outcomeKind: tr.candidate?.outcomeKind ?? null,
      error: tr.error,
    };
  }

  return {
    ok: true,
    lifecycleState: candidate.lifecycleState,
    outcomeKind: candidate.outcomeKind,
  };
}
