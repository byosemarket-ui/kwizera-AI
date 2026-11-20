/**
 * Phase 5E Step 2 — combined Evidence + Probability assessment orchestrator.
 */
import type { MifOpportunityCandidate, MifDetectionEvidenceRef } from "../opportunity-detection/types.js";
import type { MifPersistedCandidate } from "../production-integration/persistence/types.js";
import type { MifOutcomeEvaluationRecord } from "../production-integration/outcome-evaluation.js";
import { assessEvidenceIntelligence } from "./evidence-intelligence.js";
import { estimateOpportunityProbability } from "./estimate-probability.js";
import type {
  MifCalibrationStatus,
  MifProbabilityBundle,
  MifProbabilityPolicy,
  MifProbabilityTargetEvent,
} from "./types.js";

export interface AssessProbabilityIntelligenceInput {
  candidate: MifOpportunityCandidate;
  evidence: readonly MifDetectionEvidenceRef[];
  historicalCandidates?: readonly MifPersistedCandidate[];
  evaluations?: readonly MifOutcomeEvaluationRecord[];
  targetEvent?: MifProbabilityTargetEvent;
  analysisRunId?: string | null;
  rankingRunId?: string | null;
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
  allowBroaderFallback?: boolean;
}

/**
 * Run Evidence Intelligence then Probability Estimation for one candidate.
 * Pure relative to inputs; does not mutate candidate/evidence.
 */
export function assessProbabilityIntelligence(
  input: AssessProbabilityIntelligenceInput,
): MifProbabilityBundle {
  const calculatedAt = input.calculatedAt ?? new Date().toISOString();
  const evidence = assessEvidenceIntelligence({
    candidate: input.candidate,
    evidence: input.evidence,
    analysisRunId: input.analysisRunId,
    primaryTimeframe: input.primaryTimeframe,
    assessedAt: calculatedAt,
  });

  const probability = estimateOpportunityProbability({
    candidate: input.candidate,
    historicalCandidates: input.historicalCandidates ?? [],
    evaluations: input.evaluations,
    targetEvent: input.targetEvent,
    analysisRunId: input.analysisRunId,
    rankingRunId: input.rankingRunId,
    evidenceAssessmentId: evidence.assessmentId,
    primaryTimeframe: input.primaryTimeframe,
    marketRegime: input.marketRegime,
    rankingScoreBand: input.rankingScoreBand,
    dataQualityStatus: input.dataQualityStatus,
    evaluationHorizonBars: input.evaluationHorizonBars,
    historicalWindow: input.historicalWindow,
    calibrationStatus: input.calibrationStatus,
    asOfIso: input.asOfIso,
    policy: input.policy,
    calculatedAt,
    allowBroaderFallback: input.allowBroaderFallback,
  });

  return { evidence, probability };
}

/**
 * Assess all candidates in a detection/ranking set (bounded).
 */
export function assessProbabilityIntelligenceBatch(
  input: Omit<AssessProbabilityIntelligenceInput, "candidate"> & {
    candidates: readonly MifOpportunityCandidate[];
    maxCandidates?: number;
  },
): MifProbabilityBundle[] {
  const max = Math.min(50, Math.max(1, input.maxCandidates ?? 20));
  const out: MifProbabilityBundle[] = [];
  for (const candidate of input.candidates.slice(0, max)) {
    out.push(
      assessProbabilityIntelligence({
        ...input,
        candidate,
      }),
    );
  }
  return out;
}
