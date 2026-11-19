/**
 * Phase 5C Step 1C — unified chart-analysis types (kwizera.mif.chart-analysis.v1).
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type { MifFibonacciAssessment } from "../fibonacci/types.js";
import type {
  MifChartPatternAssessment,
  MifChartPatternLifecycle,
  MifChartPatternType,
} from "../patterns/types.js";
import type { MifUnifiedChartAnalysisReasonCode } from "./codes.js";
import type {
  MIF_CHART_ANALYSIS_CONTRACT_ID,
  MIF_CHART_ANALYSIS_CONTRACT_VERSION,
} from "./contracts.js";

export type MifUnifiedChartAnalysisStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

/**
 * Status aggregation precedence (strictest wins):
 * BLOCKED > DEGRADED > INSUFFICIENT_DATA > WARNING > VALID
 */
export const MIF_UCA_STATUS_PRECEDENCE: readonly MifUnifiedChartAnalysisStatus[] = [
  "BLOCKED",
  "DEGRADED",
  "INSUFFICIENT_DATA",
  "WARNING",
  "VALID",
] as const;

export type MifConfluenceNormalizationMethod = "atr_or_mid_price";

export type MifConfluenceGrade =
  | "NONE"
  | "WEAK"
  | "MODERATE"
  | "STRONG"
  | "UNSCORED"
  | "INCOMPATIBLE";

export interface MifUnifiedChartAnalysisPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  acceptedPatternContractId: string;
  acceptedPatternContractVersion: string;
  acceptedFibonacciContractId: string;
  acceptedFibonacciContractVersion: string;
  /** Require matching qualityRef.inputIdentity when both present. */
  requireMatchingQualityInputIdentity: boolean;
  confluenceNormalizationMethod: MifConfluenceNormalizationMethod;
  /**
   * Alignment when abs(patternPrice - fibPrice) <=
   * max(confluenceTolRel * mid, confluenceTolAtrMult * atrWhenAvailable).
   * Versioned initial values — not universal market laws.
   */
  confluenceTolRel: number;
  confluenceTolAtrMult: number;
  /** Grade thresholds (counts / ratios) — explainable, not trade probabilities. */
  strongMinHits: number;
  strongMinAlignmentRatio: number;
  moderateMinHits: number;
  /** Quality statuses that permit VALID unified outcome when sources are otherwise ok. */
  allowedQualityStatusesForValid: readonly MifAnalyticalQualityStatus[];
  correlationMethodId: string;
  correlationMethodVersion: string;
}

export interface MifUnifiedChartAnalysisPolicyValidation {
  ok: boolean;
  errors: string[];
}

export interface MifPatternReferencePrice {
  detectionIdentity: string;
  patternType: MifChartPatternType;
  lifecycle: MifChartPatternLifecycle;
  referenceKind:
    | "NECKLINE"
    | "UPPER_BOUNDARY"
    | "LOWER_BOUNDARY";
  price: number | null;
  evaluatedAtTimeSec: number | null;
  available: boolean;
  unavailableReason: string | null;
}

export interface MifPatternFibRelationship {
  relationshipId: string;
  patternReference: MifPatternReferencePrice;
  fibonacciRatio: number;
  fibonacciLevelKind: "retracement" | "extension";
  fibonacciPrice: number;
  absoluteDistance: number | null;
  normalizedDistance: number | null;
  normalizationBasis: "atr" | "mid_price" | "unavailable";
  withinTolerance: boolean;
  precisionOk: boolean | null;
  tickAligned: boolean | null;
  patternAssessmentIdentity: string;
  fibonacciAssessmentIdentity: string;
}

export interface MifConfluenceComponents {
  comparisonCount: number;
  withinToleranceCount: number;
  unavailableReferenceCount: number;
  alignmentRatio: number | null;
  meanNormalizedDistanceAmongHits: number | null;
  qualityStatus: MifAnalyticalQualityStatus;
  precisionOkRatio: number | null;
  tickAlignedRatio: number | null;
}

export interface MifConfluenceAssessment {
  grade: MifConfluenceGrade;
  components: MifConfluenceComponents;
  /** Explicit policy-driven explanation — not a win probability. */
  explanation: string;
  analyticalReferenceOnly: true;
}

export interface MifUnifiedSourceRefs {
  pattern: {
    assessmentId: string;
    inputIdentity: string;
    status: MifChartPatternAssessment["status"];
    contractId: string;
    contractVersion: string;
  } | null;
  fibonacci: {
    assessmentId: string;
    inputIdentity: string;
    status: MifFibonacciAssessment["status"];
    contractId: string;
    contractVersion: string;
  } | null;
  quality: {
    sourceKind: "step1-data-integrity" | "step3-unified-quality" | "derived" | null;
    status: MifAnalyticalQualityStatus;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
}

export interface MifUnifiedChartAnalysisFinding {
  code: MifUnifiedChartAnalysisReasonCode;
  severity: "blocking" | "degraded" | "warning" | "info";
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface MifUnifiedChartAnalysisDiagnostics {
  overallStatusReason: string;
  compatible: boolean;
  relationshipCount: number;
  withinToleranceCount: number;
  atrUsed: number | null;
  referenceTimeSec: number | null;
  statusPrecedenceApplied: string;
}

export interface MifUnifiedChartAnalysisAssessment extends MifSafetyFlags {
  contractId: typeof MIF_CHART_ANALYSIS_CONTRACT_ID;
  contractVersion: typeof MIF_CHART_ANALYSIS_CONTRACT_VERSION;
  scope: "step1c-unified-chart-analysis";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policyId: string | null;
  policyVersion: string | null;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifUnifiedChartAnalysisStatus;
  /** References only — original assessments are not copied or mutated. */
  sourceRefs: MifUnifiedSourceRefs;
  relationships: MifPatternFibRelationship[];
  confluence: MifConfluenceAssessment;
  /** Pattern lifecycles preserved from source detections (not rewritten). */
  preservedPatternLifecycles: Array<{
    detectionIdentity: string;
    patternType: MifChartPatternType;
    lifecycle: MifChartPatternLifecycle;
  }>;
  findings: MifUnifiedChartAnalysisFinding[];
  warningCodes: MifUnifiedChartAnalysisReasonCode[];
  blockingCodes: MifUnifiedChartAnalysisReasonCode[];
  diagnostics: MifUnifiedChartAnalysisDiagnostics;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalIntegrationOnly: true;
}
