/**
 * Phase 5E Step 2 — Probability Estimation Engine.
 *
 * Target A: TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON
 *   p̂ = successes / eligible resolved (TARGET vs INVALIDATION only).
 *   Requires stored levels on historical evaluations. Never invents levels.
 *
 * Target B: HISTORICAL_STRATEGY_DECISIVE_FREQUENCY
 *   Same empirical ratio for a strategy cohort, labeled as historical frequency
 *   (isWinProbability=false) — not a forward predictive claim.
 *
 * No Bayesian smoothing. Insufficient sample → probability=null.
 */
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifOpportunityCandidate } from "../opportunity-detection/types.js";
import type { MifPersistedCandidate } from "../production-integration/persistence/types.js";
import type { MifOutcomeEvaluationRecord } from "../production-integration/outcome-evaluation.js";
import { extractLevelsFromCandidateNotes } from "../production-integration/outcome-evaluation.js";
import {
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_ENGINE_ID,
  MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
} from "./contracts.js";
import { selectHistoricalCohort } from "./cohorts.js";
import { resolveProbabilityPolicy } from "./policies.js";
import { assessProbabilityReliability } from "./reliability.js";
import { wilsonConfidenceInterval } from "./wilson.js";
import type {
  MifCalibrationStatus,
  MifProbabilityAssessment,
  MifProbabilityPolicy,
  MifProbabilitySampleStatus,
  MifProbabilityTargetEvent,
} from "./types.js";

const TARGET_DEFS: Record<MifProbabilityTargetEvent, string> = {
  TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON:
    "P(TARGET_REACHED before INVALIDATION_REACHED within evaluationHorizonBars), "
    + "among historically comparable opportunities with stored target+invalidation levels. "
    + "Expired/ambiguous/unknown/open excluded from denominator.",
  HISTORICAL_STRATEGY_DECISIVE_FREQUENCY:
    "Historical frequency of TARGET_REACHED among decisive (TARGET+INVALIDATION) outcomes "
    + "in a comparable cohort. NOT a predictive win probability; separate statistical question.",
};

export interface EstimateProbabilityInput {
  candidate: MifOpportunityCandidate;
  historicalCandidates: readonly MifPersistedCandidate[];
  evaluations?: readonly MifOutcomeEvaluationRecord[];
  targetEvent?: MifProbabilityTargetEvent;
  analysisRunId?: string | null;
  rankingRunId?: string | null;
  evidenceAssessmentId?: string | null;
  primaryTimeframe?: string | null;
  marketRegime?: string | null;
  rankingScoreBand?: string | null;
  dataQualityStatus?: string | null;
  evaluationHorizonBars?: number | null;
  historicalWindow?: { fromIso?: string | null; toIso?: string | null };
  calibrationStatus?: MifCalibrationStatus;
  asOfIso?: string;
  policy?: Partial<MifProbabilityPolicy> | null;
  calculatedAt?: string;
  assessmentId?: string | null;
  allowBroaderFallback?: boolean;
}

function subjectLevelsUsable(candidate: MifOpportunityCandidate): {
  ok: boolean;
  status?: MifProbabilitySampleStatus;
  limitation?: string;
} {
  const extracted = extractLevelsFromCandidateNotes({
    thesis: candidate.thesis,
    rationale: candidate.rationale,
    invalidationConditions: candidate.invalidationConditions,
  });
  if (
    extracted.targetPrice == null
    || extracted.invalidationPrice == null
    || !extracted.targetSide
    || !extracted.invalidationSide
  ) {
    return {
      ok: false,
      status: "LEVELS_NOT_PROVIDED",
      limitation:
        "Candidate lacks stored/parseable target+invalidation levels; "
        + "TARGET_REACHED_BEFORE_INVALIDATION probability is UNAVAILABLE (levels never invented).",
    };
  }
  // Directional relationship sanity
  if (extracted.targetPrice === extracted.invalidationPrice) {
    return {
      ok: false,
      status: "INVALID_LEVEL_RELATIONSHIP",
      limitation: "targetPrice equals invalidationPrice",
    };
  }
  return { ok: true };
}

export function estimateOpportunityProbability(
  input: EstimateProbabilityInput,
): MifProbabilityAssessment {
  const policy = resolveProbabilityPolicy(input.policy);
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();
  const cand = input.candidate;
  const targetEvent: MifProbabilityTargetEvent =
    input.targetEvent ?? "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON";
  const horizon = input.evaluationHorizonBars ?? policy.defaultEvaluationHorizonBars;
  const asOfIso = input.asOfIso ?? cand.assessmentTimestamp ?? calculatedAt;
  const limitations: string[] = [];
  const excludedObservationCounts: Record<string, number> = {};

  let sampleStatus: MifProbabilitySampleStatus = "SUFFICIENT";
  let probability: number | null = null;
  let rawEmpiricalFrequency: number | null = null;
  let successCount = 0;
  let denom = 0;
  let ci = null;
  let cohort = null;
  let isWinProbability = false;
  let isHistoricalFrequencyOnly = false;

  if (
    input.dataQualityStatus === "BLOCKED"
    || input.dataQualityStatus === "MISSING"
  ) {
    sampleStatus = "BLOCKED_BY_DATA_QUALITY";
    limitations.push(`dataQualityStatus=${input.dataQualityStatus}`);
  } else if (targetEvent === "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON") {
    const lvl = subjectLevelsUsable(cand);
    if (!lvl.ok) {
      sampleStatus = lvl.status ?? "UNAVAILABLE";
      if (lvl.limitation) limitations.push(lvl.limitation);
    }
  }

  if (sampleStatus === "SUFFICIENT") {
    // Filter historical window without looking at outcomes for membership first
    let hist = [...input.historicalCandidates];
    if (input.historicalWindow?.fromIso) {
      const before = hist.length;
      hist = hist.filter((c) => c.createdAt >= input.historicalWindow!.fromIso!);
      excludedObservationCounts.window_before =
        (excludedObservationCounts.window_before ?? 0) + (before - hist.length);
    }
    if (input.historicalWindow?.toIso) {
      const before = hist.length;
      hist = hist.filter((c) => c.createdAt <= input.historicalWindow!.toIso!);
      excludedObservationCounts.window_after =
        (excludedObservationCounts.window_after ?? 0) + (before - hist.length);
    }

    cohort = selectHistoricalCohort({
      subject: {
        candidateId: cand.candidateId,
        strategyId: String(cand.strategyId),
        providerSymbol: cand.providerSymbol,
        direction: String(cand.direction),
        primaryTimeframe: input.primaryTimeframe ?? null,
        marketRegime: input.marketRegime ?? null,
        rankingScoreBand: input.rankingScoreBand ?? null,
        asOfIso,
      },
      historicalCandidates: hist,
      evaluations: input.evaluations,
      targetEvent,
      minSample: policy.minSampleForProbability,
      allowBroaderFallback: input.allowBroaderFallback !== false,
    });

    successCount = cohort.successCount;
    denom = cohort.eligibleResolvedCount;
    for (const ex of cohort.excluded) {
      const key = ex.reason.split("=")[0] ?? ex.reason;
      excludedObservationCounts[key] = (excludedObservationCounts[key] ?? 0) + 1;
    }

    if (denom === 0) {
      sampleStatus = "INSUFFICIENT_HISTORICAL_COVERAGE";
      limitations.push("zero_eligible_resolved_outcomes_in_cohort");
    } else if (denom < policy.minSampleForProbability) {
      sampleStatus = "INSUFFICIENT_SAMPLE";
      rawEmpiricalFrequency = successCount / denom;
      ci = wilsonConfidenceInterval(successCount, denom, policy.confidenceLevel);
      limitations.push(
        `n=${denom}<minSample=${policy.minSampleForProbability}; probability=null (raw frequency retained separately)`,
      );
    } else {
      rawEmpiricalFrequency = successCount / denom;
      probability = rawEmpiricalFrequency;
      ci = wilsonConfidenceInterval(successCount, denom, policy.confidenceLevel);
      sampleStatus = "SUFFICIENT";
      if (targetEvent === "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON") {
        isWinProbability = true;
      } else {
        isHistoricalFrequencyOnly = true;
        limitations.push(
          "HISTORICAL_STRATEGY_DECISIVE_FREQUENCY is not a forward predictive win probability",
        );
      }
    }
  }

  const calibrationStatus: MifCalibrationStatus = input.calibrationStatus ?? "UNCALIBRATED";
  if (!input.calibrationStatus) {
    limitations.push(
      "No timestamped historical probability predictions available for OOS calibration; status=UNCALIBRATED",
    );
  }

  const reliability = assessProbabilityReliability({
    sampleStatus,
    eligibleResolvedDenominator: denom,
    confidenceInterval: ci,
    calibrationStatus,
    dataQualityStatus: input.dataQualityStatus,
    cohortTier: cohort?.tier ?? null,
    policy,
  });

  const inputIdentity = createHash("sha256")
    .update(
      stableSerialize({
        candidateId: cand.candidateId,
        targetEvent,
        cohort: cohort
          ? {
              tier: cohort.tier,
              included: cohort.includedCandidateIds,
              success: cohort.successCount,
              fail: cohort.failureCount,
            }
          : null,
        policyVersion: policy.policyVersion,
        engineVersion: MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
        horizon,
      }),
    )
    .digest("hex");

  return {
    contractId: MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
    contractVersion: MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION,
    assessmentId: input.assessmentId || `prob:${randomUUID()}`,
    evidenceAssessmentId: input.evidenceAssessmentId ?? null,
    rankingRunId: input.rankingRunId ?? null,
    analysisRunId: input.analysisRunId ?? null,
    candidateId: cand.candidateId,
    providerId: "HFM_MT5",
    providerSymbol: cand.providerSymbol,
    strategyId: String(cand.strategyId),
    direction: String(cand.direction),
    primaryTimeframe: input.primaryTimeframe ?? null,
    marketRegime: input.marketRegime ?? null,
    targetEvent,
    targetEventDefinition: TARGET_DEFS[targetEvent],
    probability,
    rawEmpiricalFrequency,
    successCount,
    eligibleResolvedDenominator: denom,
    excludedObservationCounts,
    sampleStatus,
    confidenceInterval: ci,
    cohort,
    evaluationHorizonBars: horizon,
    historicalWindow: {
      fromIso: input.historicalWindow?.fromIso ?? null,
      toIso: input.historicalWindow?.toIso ?? null,
    },
    calibrationStatus,
    calibrationMetrics: null,
    reliabilityStatus: reliability.status,
    reliabilityNotes: reliability.notes,
    limitations,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    engineId: MIF_PROBABILITY_INTELLIGENCE_ENGINE_ID,
    engineVersion: MIF_PROBABILITY_INTELLIGENCE_ENGINE_VERSION,
    calculatedAt,
    inputIdentity,
    isWinProbability,
    isGuaranteedOutcome: false,
    isExecutionApproval: false,
    executionReadiness: false,
    isHistoricalFrequencyOnly,
    isCalibratedPrediction: false,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalProbabilityOnly: true,
    notExecutable: true,
  };
}
