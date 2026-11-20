/**
 * Phase 5E Step 2 — Evidence + Probability Intelligence types.
 */
import type { MifProviderId, MifSafetyFlags } from "../canonical/types.js";
import type { MifEvidenceContribution } from "../opportunity-ranking/types.js";
import type {
  MIF_EVIDENCE_INTELLIGENCE_CONTRACT_ID,
  MIF_EVIDENCE_INTELLIGENCE_CONTRACT_VERSION,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID,
  MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION,
  MIF_CALIBRATION_CONTRACT_ID,
  MIF_CALIBRATION_CONTRACT_VERSION,
} from "./contracts.js";

/** Documented probability target events — never mix definitions. */
export type MifProbabilityTargetEvent =
  /** P(TARGET_REACHED before INVALIDATION within evaluation horizon). Requires stored levels. */
  | "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON"
  /**
   * Historical frequency of decisive TARGET_REACHED among (TARGET+INVALIDATION) for a cohort.
   * NOT a forward predictive claim; separate from TARGET_REACHED_BEFORE_INVALIDATION.
   */
  | "HISTORICAL_STRATEGY_DECISIVE_FREQUENCY";

export type MifProbabilitySampleStatus =
  | "SUFFICIENT"
  | "INSUFFICIENT_SAMPLE"
  | "INSUFFICIENT_HISTORICAL_COVERAGE"
  | "UNAVAILABLE"
  | "BLOCKED_BY_DATA_QUALITY"
  | "LEVELS_NOT_PROVIDED"
  | "INVALID_LEVEL_RELATIONSHIP";

export type MifCalibrationStatus =
  | "CALIBRATED"
  | "PROVISIONALLY_CALIBRATED"
  | "UNCALIBRATED"
  | "INSUFFICIENT_SAMPLE"
  | "VALIDATION_FAILED"
  | "UNAVAILABLE";

export type MifReliabilityStatus =
  | "HIGH_RELIABILITY"
  | "MODERATE_RELIABILITY"
  | "LOW_RELIABILITY"
  | "INSUFFICIENT_RELIABILITY"
  | "UNAVAILABLE";

export type MifCohortTier = "STRICT" | "BROADER_SIT" | "BROADER_STRATEGY" | "NONE";

export interface MifProbabilityPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  /** Minimum decisive (win+loss) outcomes required for non-null probability. */
  minSampleForProbability: number;
  /** Minimum for provisional calibration label. */
  minSampleForProvisionalCalibration: number;
  /** Minimum for CALIBRATED label. */
  minSampleForCalibration: number;
  /** Wilson CI confidence level (e.g. 0.95). */
  confidenceLevel: number;
  /** Max absolute CI half-width for HIGH_RELIABILITY. */
  highReliabilityMaxHalfWidth: number;
  moderateReliabilityMaxHalfWidth: number;
  /** Default evaluation horizon in bars (must match outcome engine usage; never invent levels). */
  defaultEvaluationHorizonBars: number;
  rationale: Record<string, string>;
}

export interface MifConfidenceInterval {
  method: "WILSON";
  confidenceLevel: number;
  lower: number;
  upper: number;
  halfWidth: number;
}

export interface MifCohortDefinition {
  tier: MifCohortTier;
  selectionMethod: string;
  strategyId: string | null;
  providerSymbol: string | null;
  direction: string | null;
  primaryTimeframe: string | null;
  marketRegime: string | null;
  rankingScoreBand: string | null;
  /** Membership depends only on information available at historical evaluation time. */
  noFutureLeakage: true;
  includedCandidateIds: readonly string[];
  excluded: readonly { candidateId: string; reason: string }[];
  sampleSize: number;
  eligibleResolvedCount: number;
  successCount: number;
  failureCount: number;
  historicalCoverageNote: string;
  outcomeLabelVersion: string;
}

export interface MifEvidenceIntelligenceAssessment extends MifSafetyFlags {
  contractId: typeof MIF_EVIDENCE_INTELLIGENCE_CONTRACT_ID;
  contractVersion: typeof MIF_EVIDENCE_INTELLIGENCE_CONTRACT_VERSION;
  assessmentId: string;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  candidateId: string;
  analysisRunId: string | null;
  providerId: MifProviderId;
  providerSymbol: string;
  strategyId: string;
  direction: string;
  primaryTimeframe: string | null;
  supporting: readonly MifEvidenceContribution[];
  contradicting: readonly MifEvidenceContribution[];
  neutral: readonly MifEvidenceContribution[];
  missing: readonly string[];
  partial: readonly string[];
  blocked: readonly string[];
  deduplicated: readonly MifEvidenceContribution[];
  provenanceRefs: readonly string[];
  explanation: string;
  assessedAt: string;
  inputIdentity: string;
  doesNotApproveAiReasoning: true;
  analyticalEvidenceOnly: true;
  notExecutable: true;
}

export interface MifProbabilityAssessment extends MifSafetyFlags {
  contractId: typeof MIF_PROBABILITY_INTELLIGENCE_CONTRACT_ID;
  contractVersion: typeof MIF_PROBABILITY_INTELLIGENCE_CONTRACT_VERSION;
  assessmentId: string;
  evidenceAssessmentId: string | null;
  rankingRunId: string | null;
  analysisRunId: string | null;
  candidateId: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  strategyId: string;
  direction: string;
  primaryTimeframe: string | null;
  marketRegime: string | null;
  targetEvent: MifProbabilityTargetEvent;
  targetEventDefinition: string;
  /** Nullable — never fabricate. */
  probability: number | null;
  rawEmpiricalFrequency: number | null;
  successCount: number;
  eligibleResolvedDenominator: number;
  excludedObservationCounts: Record<string, number>;
  sampleStatus: MifProbabilitySampleStatus;
  confidenceInterval: MifConfidenceInterval | null;
  cohort: MifCohortDefinition | null;
  evaluationHorizonBars: number | null;
  historicalWindow: { fromIso: string | null; toIso: string | null };
  calibrationStatus: MifCalibrationStatus;
  calibrationMetrics: MifCalibrationMetrics | null;
  reliabilityStatus: MifReliabilityStatus;
  reliabilityNotes: readonly string[];
  limitations: readonly string[];
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  calculatedAt: string;
  inputIdentity: string;
  /** True only for TARGET_REACHED_BEFORE_INVALIDATION when probability is empirically supported. */
  isWinProbability: boolean;
  isGuaranteedOutcome: false;
  isExecutionApproval: false;
  executionReadiness: false;
  isHistoricalFrequencyOnly: boolean;
  isCalibratedPrediction: boolean;
  doesNotApproveAiReasoning: true;
  analyticalProbabilityOnly: true;
  notExecutable: true;
}

export interface MifCalibrationMetrics {
  brierScore: number | null;
  logLoss: number | null;
  expectedCalibrationError: number | null;
  reliabilityBins: readonly {
    binIndex: number;
    predictedMean: number;
    observedFrequency: number;
    count: number;
  }[];
  calibrationSampleCount: number;
  trainingWindow: { fromIso: string | null; toIso: string | null };
  validationWindow: { fromIso: string | null; toIso: string | null };
  notes: readonly string[];
}

export interface MifCalibrationRun extends MifSafetyFlags {
  contractId: typeof MIF_CALIBRATION_CONTRACT_ID;
  contractVersion: typeof MIF_CALIBRATION_CONTRACT_VERSION;
  calibrationRunId: string;
  status: MifCalibrationStatus;
  metrics: MifCalibrationMetrics | null;
  modelVersion: string;
  policyVersion: string;
  datasetIdentity: string;
  calculatedAt: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
}

export interface MifProbabilityBundle {
  evidence: MifEvidenceIntelligenceAssessment;
  probability: MifProbabilityAssessment;
}
