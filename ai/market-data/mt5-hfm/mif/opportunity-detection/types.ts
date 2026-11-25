/**
 * Phase 5D Step 2 — Opportunity Detection Framework types.
 * Framework only — does not invent opportunities or execute trades.
 */
import type { MifCanonicalInstrument } from "../canonical/instrument.js";
import type { MifCandleState, MifProviderId, MifSafetyFlags, MifTimebase } from "../canonical/types.js";
import type { MifFibonacciAssessment } from "../analysis/fibonacci/types.js";
import type { MifHarmonicAssessment } from "../analysis/harmonics/types.js";
import type { MifMtfRelationshipsAssessment } from "../analysis/mtf-relationships/types.js";
import type { MifChartPatternAssessment } from "../analysis/patterns/types.js";
import type { MifMarketRegimeAssessment } from "../analysis/regime/types.js";
import type { MifUnifiedChartAnalysisAssessment } from "../analysis/unified/types.js";
import type {
  MifEvidenceFamily,
  MifEvidencePresence,
  MifStrategyEligibilityResult,
  MifStrategyEvidenceSummary,
  MifStrategyId,
  MifTimeframeRole,
} from "../strategy-intelligence/types.js";
import type { MifOpportunityDetectionReasonCode } from "./codes.js";
import type {
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID,
  MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_ID,
  MIF_OPPORTUNITY_DETECTION_CONTRACT_VERSION,
} from "./contracts.js";

export type MifDetectorAvailabilityStatus = "ACTIVE" | "DISABLED" | "UNAVAILABLE";

export type MifDetectionOutcomeStatus =
  | "CANDIDATE_PRODUCED"
  | "NO_CANDIDATE"
  | "INELIGIBLE"
  | "INSUFFICIENT_EVIDENCE"
  | "BLOCKED_BY_DATA_QUALITY"
  | "DETECTOR_DISABLED"
  | "DETECTOR_NOT_REGISTERED"
  | "INVALID_CONTEXT"
  | "DETECTOR_ERROR";

export type MifOpportunityDirection = "BUY" | "SELL" | "NEUTRAL" | "UNKNOWN";

export type MifOpportunityCandidateStatus =
  | "DETECTED"
  | "NEEDS_CONFIRMATION"
  | "INVALID"
  | "REJECTED";

/** Optional structured measurement attached to a production evidence ref (UMEP path). */
export interface MifDetectionEvidenceMeasurement {
  id: string;
  name: string;
  value: number | string | boolean | null;
  unit: string | null;
  note: string | null;
}

/** Optional source-backed level attached to a production evidence ref (UMEP path). */
export interface MifDetectionEvidenceLevel {
  id: string;
  kind: string;
  price: number | null;
  side: "HIGH" | "LOW" | "MID" | "ZONE" | "OTHER" | null;
  note: string | null;
}

export interface MifDetectionEvidenceRef {
  evidenceId: string;
  family: MifEvidenceFamily;
  presence: MifEvidencePresence;
  sourceEngine: string | null;
  sourceContractId: string | null;
  sourceContractVersion: string | null;
  sourcePolicyVersion: string | null;
  sourceAssessmentId: string | null;
  sourceInputIdentity: string | null;
  timeframe: string | null;
  timeframeRole: MifTimeframeRole | null;
  assessmentTimestamp: string | null;
  qualityStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING" | "UNKNOWN";
  candleState: MifCandleState | null;
  notes?: string;
  /** Structured numerics / provenance — preferred over notes-only for AI delivery. */
  measurements?: readonly MifDetectionEvidenceMeasurement[];
  /** Source-backed prices for scenario/AI grounding. */
  levels?: readonly MifDetectionEvidenceLevel[];
}

export interface MifOpportunityDetectionContext extends MifSafetyFlags {
  contextVersion: string;
  providerId: MifProviderId;
  providerSymbol: string;
  instrument: MifCanonicalInstrument | null;
  assessmentTimestamp: string;
  timebase: MifTimebase | null;
  dataQualityStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING";
  availableTimeframeRoles: readonly MifTimeframeRole[];
  evidence: readonly MifDetectionEvidenceRef[];
  /** Optional Phase 5C assessment references — never mutated. */
  regime?: MifMarketRegimeAssessment | null;
  harmonic?: MifHarmonicAssessment | null;
  fibonacci?: MifFibonacciAssessment | null;
  chartPatterns?: MifChartPatternAssessment | null;
  unified?: MifUnifiedChartAnalysisAssessment | null;
  mtfRelationships?: MifMtfRelationshipsAssessment | null;
  /** Pre-built eligibility summary; when omitted, derived from evidence. */
  evidenceSummary?: MifStrategyEvidenceSummary | null;
  doesNotApproveAiReasoning: true;
  analyticalDetectionContextOnly: true;
}

export interface MifOpportunityCandidateQualityComponent {
  componentId: string;
  value: number;
  weight: number;
  notes: string;
}

/**
 * Optional explainable quality score — NOT a win probability.
 * score = Σ(component.value * component.weight) / Σ(weight), clamped [0,1].
 */
export interface MifOpportunityCandidateQuality {
  score: number | null;
  definition: string;
  components: readonly MifOpportunityCandidateQualityComponent[];
  notWinProbability: true;
}

export interface MifOpportunityCandidate extends MifSafetyFlags {
  contractId: typeof MIF_OPPORTUNITY_CANDIDATE_CONTRACT_ID;
  contractVersion: typeof MIF_OPPORTUNITY_CANDIDATE_CONTRACT_VERSION;
  candidateId: string;
  strategyId: MifStrategyId | string;
  detectorId: string;
  detectorVersion: string;
  strategyDefinitionVersion: string;
  policyVersion: string;
  providerId: MifProviderId;
  providerSymbol: string;
  instrument: MifCanonicalInstrument | null;
  direction: MifOpportunityDirection;
  timeframeRoles: readonly MifTimeframeRole[];
  assessmentTimestamp: string;
  status: MifOpportunityCandidateStatus;
  thesis: string;
  rationale: string;
  supportingEvidenceIds: readonly string[];
  conflictingEvidenceIds: readonly string[];
  requiredConfirmations: readonly string[];
  invalidationConditions: readonly string[];
  knownLimitations: readonly string[];
  quality: MifOpportunityCandidateQuality | null;
  regimeAssessmentId: string | null;
  mtfAssessmentId: string | null;
  doesNotApproveAiReasoning: true;
  analyticalCandidateOnly: true;
  notExecutable: true;
}

export interface MifEvidenceValidationResult {
  ok: boolean;
  missingRequired: string[];
  failed: string[];
  warnings: string[];
  duplicateSourceAssessmentIds: string[];
  reasonCodes: MifOpportunityDetectionReasonCode[];
  explanation: string;
}

export interface MifDetectionOutcome extends MifSafetyFlags {
  strategyId: MifStrategyId | string;
  detectorId: string | null;
  detectorVersion: string | null;
  status: MifDetectionOutcomeStatus;
  evaluationTimestamp: string;
  eligibility: MifStrategyEligibilityResult | null;
  evidenceValidation: MifEvidenceValidationResult | null;
  candidate: MifOpportunityCandidate | null;
  reasonCodes: MifOpportunityDetectionReasonCode[];
  warnings: string[];
  diagnostics: string;
  doesNotApproveAiReasoning: true;
  analyticalOutcomeOnly: true;
}

export interface MifOpportunityDetectorDefinition {
  detectorId: string;
  strategyId: MifStrategyId;
  detectorVersion: string;
  policyVersion: string;
  availabilityStatus: MifDetectorAvailabilityStatus;
  supportedTimeframeRoles: readonly MifTimeframeRole[];
  /** When null/empty, any HFM_MT5 symbol in context is acceptable. */
  supportedSymbols: readonly string[] | null;
  notes: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
}

export interface MifOpportunityDetector extends MifOpportunityDetectorDefinition {
  /**
   * Pure evaluation. Must not mutate context.
   * Returns candidate or null (NO_CANDIDATE) — framework wraps into DetectionOutcome.
   */
  evaluate(context: MifOpportunityDetectionContext): {
    candidate: MifOpportunityCandidate | null;
    warnings?: string[];
    diagnostics?: string;
  };
}

export interface MifOpportunityDetectionRunResult extends MifSafetyFlags {
  contractId: typeof MIF_OPPORTUNITY_DETECTION_CONTRACT_ID;
  contractVersion: typeof MIF_OPPORTUNITY_DETECTION_CONTRACT_VERSION;
  engineId: string;
  engineVersion: string;
  policyId: string;
  policyVersion: string;
  assessmentTimestamp: string;
  providerSymbol: string;
  outcomes: MifDetectionOutcome[];
  candidates: MifOpportunityCandidate[];
  strategyCoverage: Array<{
    strategyId: MifStrategyId;
    strategyActive: boolean;
    detectorRegistered: boolean;
    detectorIds: string[];
  }>;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalDetectionOnly: true;
  doesNotRankOpportunities: true;
}
