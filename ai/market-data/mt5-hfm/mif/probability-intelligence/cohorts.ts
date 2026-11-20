/**
 * Phase 5E Step 2 — historical cohort selection without future leakage.
 *
 * Membership uses only attributes known at the historical opportunity's evaluation time
 * (strategy, symbol, direction, timeframe roles, createdAt / assessmentTimestamp).
 * Outcome labels are applied AFTER membership for denominator construction — never to
 * select only successful histories.
 */
import type { MifPersistedCandidate } from "../production-integration/persistence/types.js";
import type { MifOutcomeEvaluationRecord } from "../production-integration/outcome-evaluation.js";
import { MIF_OUTCOME_EVALUATION_CONTRACT_VERSION } from "../production-integration/outcome-evaluation.js";
import type { MifCohortDefinition, MifCohortTier, MifProbabilityTargetEvent } from "./types.js";

export interface CohortSubject {
  candidateId: string;
  strategyId: string;
  providerSymbol: string;
  direction: string;
  primaryTimeframe?: string | null;
  marketRegime?: string | null;
  rankingScoreBand?: string | null;
  /** ISO timestamp — cohort peers must have been created at or before this (no future peers). */
  asOfIso: string;
}

export interface SelectCohortInput {
  subject: CohortSubject;
  historicalCandidates: readonly MifPersistedCandidate[];
  evaluations?: readonly MifOutcomeEvaluationRecord[];
  targetEvent: MifProbabilityTargetEvent;
  /** Prefer STRICT; fall back only when sample below min and broader tier allowed. */
  minSample: number;
  allowBroaderFallback?: boolean;
}

function primaryTfOf(c: MifPersistedCandidate): string | null {
  const snap = c.candidateSnapshot as { primaryTimeframe?: string; timeframe?: string } | null;
  return snap?.primaryTimeframe ?? snap?.timeframe ?? c.timeframeRoles?.[0] ?? null;
}

function directionOf(c: MifPersistedCandidate): string {
  return String(c.direction ?? "").toUpperCase();
}

function matchesTier(
  c: MifPersistedCandidate,
  subject: CohortSubject,
  tier: MifCohortTier,
): boolean {
  if (c.candidateId === subject.candidateId) return false; // never include self
  if (c.providerId !== "HFM_MT5") return false;
  if (c.strategyId !== subject.strategyId) return false;
  if (c.providerSymbol.toUpperCase() !== subject.providerSymbol.toUpperCase()) return false;
  // No future leakage: peer createdAt must be <= subject asOf
  if (c.createdAt > subject.asOfIso) return false;

  if (tier === "STRICT" || tier === "BROADER_SIT") {
    if (directionOf(c) !== subject.direction.toUpperCase()) return false;
  }
  if (tier === "STRICT") {
    const tf = primaryTfOf(c);
    if (subject.primaryTimeframe && tf && tf !== subject.primaryTimeframe) return false;
    if (subject.primaryTimeframe && !tf) return false;
  }
  return true;
}

function classifyOutcome(
  c: MifPersistedCandidate,
  evalById: Map<string, MifOutcomeEvaluationRecord>,
): {
  eligible: boolean;
  success: boolean;
  excludeReason?: string;
} {
  const ev = evalById.get(c.candidateId);
  const kind = ev?.outcomeKind ?? c.outcomeKind;
  if (kind === "TARGET_REACHED") return { eligible: true, success: true };
  if (kind === "INVALIDATION_REACHED") return { eligible: true, success: false };
  if (kind === "EXPIRED_UNRESOLVED") {
    return { eligible: false, success: false, excludeReason: "EXPIRED_UNRESOLVED_not_in_binary_denominator" };
  }
  if (kind === "BOTH_AMBIGUOUS_SAME_CANDLE") {
    return { eligible: false, success: false, excludeReason: "BOTH_AMBIGUOUS_SAME_CANDLE" };
  }
  if (kind === "OUTCOME_UNKNOWN") {
    return { eligible: false, success: false, excludeReason: "OUTCOME_UNKNOWN" };
  }
  if (kind === "NONE") {
    return { eligible: false, success: false, excludeReason: "STILL_OPEN_OR_NONE" };
  }
  return { eligible: false, success: false, excludeReason: `unsupported_outcome=${kind}` };
}

function levelsValidForTargetEvent(
  targetEvent: MifProbabilityTargetEvent,
  c: MifPersistedCandidate,
  evalById: Map<string, MifOutcomeEvaluationRecord>,
): boolean {
  if (targetEvent === "HISTORICAL_STRATEGY_DECISIVE_FREQUENCY") {
    // Frequency uses decisive labels; levels preferred but not required on every peer
    // when outcomeKind already resolved via prior evaluation.
    return true;
  }
  // TARGET_REACHED_BEFORE_INVALIDATION requires evaluation with levels present
  const ev = evalById.get(c.candidateId);
  if (!ev) return false;
  const lvl = ev.levels ?? {};
  if (lvl.targetPrice == null || lvl.invalidationPrice == null) return false;
  if (!lvl.targetSide || !lvl.invalidationSide) return false;
  return true;
}

/**
 * Select comparable historical cohort. Tries STRICT first; optional fallback to broader tiers.
 */
export function selectHistoricalCohort(input: SelectCohortInput): MifCohortDefinition {
  const evalById = new Map(
    (input.evaluations ?? []).map((e) => [e.candidateId, e] as const),
  );
  const tiers: MifCohortTier[] = input.allowBroaderFallback !== false
    ? ["STRICT", "BROADER_SIT", "BROADER_STRATEGY"]
    : ["STRICT"];

  let best: MifCohortDefinition | null = null;

  for (const tier of tiers) {
    const included: string[] = [];
    const excluded: { candidateId: string; reason: string }[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const c of input.historicalCandidates) {
      if (!matchesTier(c, input.subject, tier)) {
        if (c.candidateId === input.subject.candidateId) {
          excluded.push({ candidateId: c.candidateId, reason: "self_excluded" });
        } else if (c.createdAt > input.subject.asOfIso) {
          excluded.push({ candidateId: c.candidateId, reason: "future_peer_excluded_no_leakage" });
        } else if (c.strategyId !== input.subject.strategyId) {
          excluded.push({ candidateId: c.candidateId, reason: "strategy_mismatch" });
        } else if (c.providerSymbol.toUpperCase() !== input.subject.providerSymbol.toUpperCase()) {
          excluded.push({ candidateId: c.candidateId, reason: "instrument_mismatch" });
        } else {
          excluded.push({ candidateId: c.candidateId, reason: `tier_${tier}_mismatch` });
        }
        continue;
      }
      if (!levelsValidForTargetEvent(input.targetEvent, c, evalById)) {
        excluded.push({
          candidateId: c.candidateId,
          reason: "levels_not_provided_for_target_event",
        });
        continue;
      }
      const cls = classifyOutcome(c, evalById);
      if (!cls.eligible) {
        excluded.push({
          candidateId: c.candidateId,
          reason: cls.excludeReason ?? "not_eligible_resolved",
        });
        continue;
      }
      included.push(c.candidateId);
      if (cls.success) successCount += 1;
      else failureCount += 1;
    }

    const eligibleResolvedCount = successCount + failureCount;
    const def: MifCohortDefinition = {
      tier,
      selectionMethod: `cohort_hierarchy_${tier}_asOf_createdAt_le_subject`,
      strategyId: input.subject.strategyId,
      providerSymbol: input.subject.providerSymbol.toUpperCase(),
      direction:
        tier === "BROADER_STRATEGY" ? null : input.subject.direction.toUpperCase(),
      primaryTimeframe: tier === "STRICT" ? input.subject.primaryTimeframe ?? null : null,
      marketRegime: input.subject.marketRegime ?? null,
      rankingScoreBand: input.subject.rankingScoreBand ?? null,
      noFutureLeakage: true,
      includedCandidateIds: included.sort(),
      excluded: excluded.slice(0, 500),
      sampleSize: included.length,
      eligibleResolvedCount,
      successCount,
      failureCount,
      historicalCoverageNote:
        `tier=${tier}; eligibleResolved=${eligibleResolvedCount}; peers_asOf<=${input.subject.asOfIso}`,
      outcomeLabelVersion: MIF_OUTCOME_EVALUATION_CONTRACT_VERSION,
    };

    best = def;
    if (eligibleResolvedCount >= input.minSample) break;
  }

  return (
    best ?? {
      tier: "NONE",
      selectionMethod: "empty",
      strategyId: input.subject.strategyId,
      providerSymbol: input.subject.providerSymbol,
      direction: input.subject.direction,
      primaryTimeframe: input.subject.primaryTimeframe ?? null,
      marketRegime: null,
      rankingScoreBand: null,
      noFutureLeakage: true,
      includedCandidateIds: [],
      excluded: [],
      sampleSize: 0,
      eligibleResolvedCount: 0,
      successCount: 0,
      failureCount: 0,
      historicalCoverageNote: "no_historical_peers",
      outcomeLabelVersion: MIF_OUTCOME_EVALUATION_CONTRACT_VERSION,
    }
  );
}
