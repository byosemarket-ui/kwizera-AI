/**
 * Phase 5E Step 1 — Opportunity Ranking & Scoring types.
 */
import type { MifProviderId, MifSafetyFlags } from "../canonical/types.js";
import type { MifEvidenceFamily, MifStrategyId } from "../strategy-intelligence/types.js";
import type { MifOpportunityDirection, MifOpportunityCandidateStatus } from "../opportunity-detection/types.js";
import type {
  MIF_OPPORTUNITY_RANKING_CONTRACT_ID,
  MIF_OPPORTUNITY_RANKING_CONTRACT_VERSION,
} from "./contracts.js";

/** Analytical setup-quality bands — NEVER win probability. */
export type MifRankingScoreBand =
  | "VERY_STRONG"
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "INSUFFICIENT_EVIDENCE"
  | "BLOCKED";

export type MifRankingEligibility =
  | "ELIGIBLE_FOR_RANK"
  | "RESTRICTED_PARTIAL"
  | "INSUFFICIENT_EVIDENCE"
  | "BLOCKED"
  | "INVALID"
  | "INCOMPATIBLE_COMPARISON";

export type MifScoreComponentId =
  | "DATA_QUALITY"
  | "EVIDENCE_COMPLETENESS"
  | "ANALYTICAL_EVIDENCE"
  | "MARKET_STRUCTURE_ALIGNMENT"
  | "MOMENTUM_DISPLACEMENT"
  | "MULTI_TIMEFRAME_AGREEMENT"
  | "STRATEGY_SETUP_QUALITY"
  | "CONFLICT_PENALTY";

export type MifEvidencePolarity =
  | "BULLISH_SUPPORT"
  | "BEARISH_SUPPORT"
  | "CONFLICTING"
  | "NEUTRAL"
  | "UNKNOWN"
  | "MISSING"
  | "PARTIAL"
  | "BLOCKED"
  | "UNAVAILABLE";

export interface MifRankingPolicyWeights {
  dataQuality: number;
  evidenceCompleteness: number;
  analyticalEvidence: number;
  marketStructureAlignment: number;
  momentumDisplacement: number;
  multiTimeframeAgreement: number;
  strategySetupQuality: number;
}

export interface MifRankingPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  /** Positive component weights — must sum to 1.0 ± 1e-9. */
  weights: MifRankingPolicyWeights;
  weightRationale: Record<keyof MifRankingPolicyWeights, string>;
  /** Max points subtracted for contradictions (0–30). */
  maxConflictPenalty: number;
  bandThresholds: {
    veryStrong: number;
    strong: number;
    moderate: number;
    weak: number;
  };
  /** Families treated as correlated for double-count prevention. */
  correlatedFamilyGroups: readonly (readonly MifEvidenceFamily[])[];
  scoreScaleMin: 0;
  scoreScaleMax: 100;
}

export interface MifScoreComponentResult {
  componentId: MifScoreComponentId;
  score: number | null;
  weight: number;
  weightedContribution: number | null;
  availability: "AVAILABLE" | "NOT_APPLICABLE" | "INSUFFICIENT" | "BLOCKED";
  inputs: readonly string[];
  missing: readonly string[];
  partial: readonly string[];
  provenanceKeys: readonly string[];
  explanation: string;
}

export interface MifEvidenceContribution {
  evidenceId: string;
  family: MifEvidenceFamily;
  polarity: MifEvidencePolarity;
  provenanceKey: string;
  qualityStatus: string;
  candleState: string | null;
  notes: string;
  /** True when this contribution was de-duplicated within a correlated group. */
  deduplicated: boolean;
}

export interface MifRankedOpportunity extends MifSafetyFlags {
  contractId: typeof MIF_OPPORTUNITY_RANKING_CONTRACT_ID;
  contractVersion: typeof MIF_OPPORTUNITY_RANKING_CONTRACT_VERSION;
  rankingRunId: string;
  candidateId: string;
  analysisRunId: string | null;
  providerId: MifProviderId;
  providerSymbol: string;
  strategyId: MifStrategyId | string;
  direction: MifOpportunityDirection;
  timeframeRoles: readonly string[];
  primaryTimeframe: string | null;
  originalStatus: MifOpportunityCandidateStatus | string;
  lifecycleState: string | null;
  rankingEligibility: MifRankingEligibility;
  overallScore: number | null;
  scoreBand: MifRankingScoreBand;
  rankPosition: number | null;
  /** Null when not eligible for ordinary reliable rank. */
  reliableRank: boolean;
  componentScores: readonly MifScoreComponentResult[];
  positiveContributions: readonly MifEvidenceContribution[];
  negativeContributions: readonly MifEvidenceContribution[];
  missingEvidence: readonly string[];
  partialEvidence: readonly string[];
  contradictions: readonly string[];
  qualityRestrictions: readonly string[];
  evidenceProvenanceRefs: readonly string[];
  scoringExplanation: string;
  rankingExplanation: string;
  assessmentTimestamp: string;
  rankedAt: string;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  isWinProbability: false;
  isExecutionApproval: false;
  executionReadiness: false;
  doesNotApproveAiReasoning: true;
  analyticalRankingOnly: true;
  notExecutable: true;
}

export interface MifOpportunityRankingRun extends MifSafetyFlags {
  contractId: typeof MIF_OPPORTUNITY_RANKING_CONTRACT_ID;
  contractVersion: typeof MIF_OPPORTUNITY_RANKING_CONTRACT_VERSION;
  schemaVersion: "1.0.0";
  rankingRunId: string;
  analysisRunId: string | null;
  providerId: "HFM_MT5";
  providerSymbol: string | null;
  primaryTimeframe: string | null;
  strategyFilter: string | null;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  inputIdentity: string;
  startedAt: string;
  completedAt: string;
  candidateCount: number;
  rankedCount: number;
  blockedCount: number;
  insufficientCount: number;
  rankings: readonly MifRankedOpportunity[];
  comparisonPolicy: string;
  reproducibility: {
    identicalInputsYieldEquivalentOutputs: true;
    policyVersionRecorded: true;
  };
  isWinProbability: false;
  isExecutionApproval: false;
  executionReadiness: false;
  doesNotApproveAiReasoning: true;
  analyticalRankingOnly: true;
  notExecutable: true;
}
