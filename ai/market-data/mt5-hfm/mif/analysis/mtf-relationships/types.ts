/**
 * Phase 5C Step 3 — multi-timeframe relationships types
 * (kwizera.mif.multi-timeframe-relationships.v1).
 *
 * Disagreement is preserved — never forced into artificial alignment.
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifCandleState, MifProviderId, MifSafetyFlags, MifTimebase } from "../../canonical/types.js";
import type { MifFibonacciAssessment } from "../fibonacci/types.js";
import type { MifHarmonicAssessment } from "../harmonics/types.js";
import type { MifChartPatternAssessment } from "../patterns/types.js";
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type { MifMarketRegimeAssessment } from "../regime/types.js";
import type { MifUnifiedChartAnalysisAssessment } from "../unified/types.js";
import type { MifMtfRelationshipsReasonCode } from "./codes.js";
import type {
  MIF_MTF_RELATIONSHIPS_CONTRACT_ID,
  MIF_MTF_RELATIONSHIPS_CONTRACT_VERSION,
} from "./contracts.js";

export type MifMtfBand = "HIGHER" | "INTERMEDIATE" | "LOWER";

export type MifMtfDirectionalRelation =
  | "ALIGNMENT"
  | "PARTIAL_ALIGNMENT"
  | "CONFLICT"
  | "COUNTERTREND_PULLBACK"
  | "POTENTIAL_REVERSAL"
  | "TRANSITION"
  | "INSUFFICIENT_DATA"
  | "UNKNOWN";

export type MifMtfAssessmentStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type MifMtfDirection = "UP" | "DOWN" | "NEUTRAL" | "UNKNOWN";

export interface MifMtfHierarchyBand {
  band: MifMtfBand;
  timeframes: readonly string[];
}

export interface MifMtfRelationshipsPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  /** Full supported hierarchy in coarsest→finest order. */
  hierarchy: readonly string[];
  bands: readonly MifMtfHierarchyBand[];
  /** Required for completeness (missing → reduces completeness / may block if policy says). */
  requiredTimeframes: readonly string[];
  /** Optional — missing must not block. */
  optionalTimeframes: readonly string[];
  missingRequiredBlocks: boolean;
  /** Max absolute assessment-timestamp skew across sources (ms). null = measure only. */
  maxAssessmentSkewMs: number | null;
  /** Weight components for explainable alignment score (sum need not be 1; normalized). */
  weightHigher: number;
  weightIntermediate: number;
  weightLower: number;
  /** Allowed source quality statuses to treat as usable evidence. */
  usableSourceStatuses: readonly string[];
}

export interface MifMtfRelationshipsPolicyValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Per-timeframe analytical sources — referenced, never mutated.
 * At least one source assessment should be present for a usable context.
 */
export interface MifMtfTimeframeSources {
  timeframe: string;
  providerSymbol: string;
  regime?: MifMarketRegimeAssessment | null;
  harmonic?: MifHarmonicAssessment | null;
  fibonacci?: MifFibonacciAssessment | null;
  chartPatterns?: MifChartPatternAssessment | null;
  unified?: MifUnifiedChartAnalysisAssessment | null;
  /** Explicit tip candle state when known (CLOSED/FORMING/STALE/MISSING). */
  tipCandleState?: MifCandleState | null;
  tipTimebase?: MifTimebase | null;
  tipOpenTimeSec?: number | null;
  qualityStatus?: MifAnalyticalQualityStatus | null;
}

export interface MifMtfSourceRefs {
  regimeAssessmentId: string | null;
  regimeInputIdentity: string | null;
  harmonicAssessmentId: string | null;
  fibonacciAssessmentId: string | null;
  chartPatternsAssessmentId: string | null;
  unifiedAssessmentId: string | null;
}

export interface MifMtfNormalizedContext {
  timeframe: string;
  band: MifMtfBand | "UNSUPPORTED";
  available: boolean;
  direction: MifMtfDirection;
  structure: string | null;
  volatility: string | null;
  regimeComposite: string | null;
  patternDirections: string[];
  harmonicOrientations: string[];
  fibonacciPresent: boolean;
  unifiedStatus: string | null;
  qualityStatus: MifAnalyticalQualityStatus | "MISSING";
  tipCandleState: MifCandleState | null;
  tipTimebase: MifTimebase | null;
  tipOpenTimeSec: number | null;
  sourceRefs: MifMtfSourceRefs;
  /** Observed vs derived vs unavailable. */
  evidenceKind: "OBSERVED" | "DERIVED" | "UNAVAILABLE";
  limitations: string[];
}

export interface MifMtfBandSummary {
  band: MifMtfBand;
  timeframesPresent: string[];
  timeframesMissing: string[];
  consensusDirection: MifMtfDirection;
  consensusStructure: string | null;
  agreement: "AGREE" | "PARTIAL" | "CONFLICT" | "INSUFFICIENT";
  notes: string[];
}

export interface MifMtfDirectionalAnalysis {
  relation: MifMtfDirectionalRelation;
  higherDirection: MifMtfDirection;
  intermediateDirection: MifMtfDirection;
  lowerDirection: MifMtfDirection;
  explanation: string;
  supportingTimeframes: string[];
  opposingTimeframes: string[];
}

export interface MifMtfPatternRelationship {
  status:
    | "AGREE"
    | "PARTIAL"
    | "CONFLICT"
    | "INSUFFICIENT"
    | "NONE";
  higherPatternDirs: string[];
  lowerPatternDirs: string[];
  harmonicOrientationsByTf: Record<string, string[]>;
  formingVsConfirmed: { forming: number; confirmed: number };
  explanation: string;
  /** Explainable component counts — not a win probability. */
  alignmentComponentScore: number | null;
}

export interface MifMtfRegimeRelationship {
  status: "ALIGNED" | "PARTIAL" | "CONFLICT" | "TRANSITION" | "INSUFFICIENT";
  higherRegime: string | null;
  intermediateRegime: string | null;
  lowerRegime: string | null;
  volatilitySpread: string | null;
  explanation: string;
}

export interface MifMtfConflictAnalysis {
  hasConflict: boolean;
  conflictKind:
    | "NONE"
    | "DIRECTIONAL"
    | "REGIME"
    | "PATTERN"
    | "MIXED"
    | "INSUFFICIENT";
  pullbackCompatible: boolean;
  transitionCompatible: boolean;
  agreeingTimeframes: string[];
  disagreeingTimeframes: string[];
  explanation: string;
}

export interface MifMtfCompleteness {
  suppliedTimeframes: string[];
  missingRequired: string[];
  missingOptional: string[];
  unsupportedInputs: string[];
  coverageRatio: number;
  /** Coverage ≠ analytical confidence. */
  coverageIsNotConfidence: true;
}

export interface MifMtfFinding {
  code: MifMtfRelationshipsReasonCode;
  severity: "blocking" | "degraded" | "warning" | "info";
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface MifMtfDiagnostics {
  overallStatusReason: string;
  bandCount: number;
  contextCount: number;
  usableContextCount: number;
}

export interface MifMtfRelationshipsAssessment extends MifSafetyFlags {
  contractId: typeof MIF_MTF_RELATIONSHIPS_CONTRACT_ID;
  contractVersion: typeof MIF_MTF_RELATIONSHIPS_CONTRACT_VERSION;
  scope: "step3-multi-timeframe-relationships";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  instrument: MifCanonicalInstrument | null;
  policyId: string | null;
  policyVersion: string | null;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifMtfAssessmentStatus;
  contexts: MifMtfNormalizedContext[];
  higherSummary: MifMtfBandSummary;
  intermediateSummary: MifMtfBandSummary;
  lowerSummary: MifMtfBandSummary;
  directional: MifMtfDirectionalAnalysis;
  patternRelationships: MifMtfPatternRelationship;
  regimeRelationships: MifMtfRegimeRelationship;
  conflicts: MifMtfConflictAnalysis;
  completeness: MifMtfCompleteness;
  /**
   * Weighted directional alignment score in [0,1] when computable.
   * Documented components only — NOT a trade win probability.
   */
  alignmentScore: number | null;
  alignmentScoreDefinition: string;
  findings: MifMtfFinding[];
  warningCodes: MifMtfRelationshipsReasonCode[];
  blockingCodes: MifMtfRelationshipsReasonCode[];
  diagnostics: MifMtfDiagnostics;
  diagnosticsSummary: string;
  explanation: string;
  doesNotApproveAiReasoning: true;
  analyticalMtfInformationOnly: true;
}
