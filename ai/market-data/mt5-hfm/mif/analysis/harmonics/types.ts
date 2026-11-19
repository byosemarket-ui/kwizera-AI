/**
 * Phase 5C Step 2 — harmonic pattern types (kwizera.mif.harmonic-patterns.v1).
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type { MifHarmonicReasonCode } from "./codes.js";
import type {
  MIF_HARMONIC_ATR_METHOD_ID,
  MIF_HARMONIC_PATTERNS_CONTRACT_ID,
  MIF_HARMONIC_PATTERNS_CONTRACT_VERSION,
} from "./contracts.js";

export type MifHarmonicPatternType =
  | "GARTLEY"
  | "BAT"
  | "BUTTERFLY"
  | "CRAB"
  | "SHARK";

export type MifHarmonicLifecycle = "FORMING" | "CONFIRMED" | "FAILED" | "INVALIDATED";

export type MifHarmonicAssessmentStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type MifHarmonicOrientation = "BULLISH" | "BEARISH";

export interface MifHarmonicRatioRange {
  /** Inclusive lower bound (null = exact target uses ±exactTol). */
  min: number | null;
  /** Inclusive upper bound (null = exact target uses ±exactTol). */
  max: number | null;
  /** When min/max null, measured must be within exact ± exactTol. */
  exact: number | null;
  exactTol: number;
}

export interface MifHarmonicPatternRatioPolicy {
  patternType: MifHarmonicPatternType;
  abOfXa: MifHarmonicRatioRange;
  bcOfAb: MifHarmonicRatioRange;
  cdOfBc: MifHarmonicRatioRange;
  adOfXa: MifHarmonicRatioRange;
  /** Shark-specific optional XC relationship; ignored for other patterns. */
  cdOfXc?: MifHarmonicRatioRange | null;
}

export interface MifHarmonicPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  atrMethodId: typeof MIF_HARMONIC_ATR_METHOD_ID;
  atrPeriod: number;
  allowedQualityStatusesForConfirmed: readonly MifAnalyticalQualityStatus[];
  allowedQualityStatusesForForming: readonly MifAnalyticalQualityStatus[];
  requireConfirmedSwingsForConfirmed: true;
  minBarsBetweenPivots: number;
  /** Max PRZ width in ATR multiples before marking PRZ as wide/conflicting. */
  maxPrzWidthAtr: number;
  /** Min contributing projections required for a valid PRZ. */
  minPrzProjections: number;
  patternRatios: readonly MifHarmonicPatternRatioPolicy[];
  maxDetections: number;
}

export interface MifHarmonicPolicyValidation {
  ok: boolean;
  errors: string[];
}

export interface MifHarmonicPivotRef {
  role: "X" | "A" | "B" | "C" | "D";
  swingId: string;
  kind: "HIGH" | "LOW";
  price: number;
  timeSec: number;
  index: number;
  status: "CONFIRMED" | "PROVISIONAL";
}

export interface MifHarmonicRatioMeasurement {
  id: "AB_XA" | "BC_AB" | "CD_BC" | "AD_XA" | "CD_XC";
  measured: number;
  expectedMin: number | null;
  expectedMax: number | null;
  expectedExact: number | null;
  deviation: number | null;
  passed: boolean;
}

export interface MifHarmonicPrz {
  low: number | null;
  high: number | null;
  width: number | null;
  widthAtr: number | null;
  contributingProjections: Array<{ id: string; price: number }>;
  convergenceOk: boolean;
  /** Analytical PRZ only — not a reversal guarantee or entry. */
  analyticalReferenceOnly: true;
}

export interface MifHarmonicDetection {
  patternType: MifHarmonicPatternType;
  orientation: MifHarmonicOrientation;
  lifecycle: MifHarmonicLifecycle;
  pivots: MifHarmonicPivotRef[];
  ratios: MifHarmonicRatioMeasurement[];
  allRequiredRatiosPassed: boolean;
  prz: MifHarmonicPrz;
  geometryFit: number;
  detectionIdentity: string;
}

export interface MifHarmonicFinding {
  code: MifHarmonicReasonCode;
  severity: "blocking" | "degraded" | "warning" | "info";
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface MifHarmonicQualityRef {
  sourceKind: "step1-data-integrity" | "step3-unified-quality" | null;
  status: MifAnalyticalQualityStatus;
  inputIdentity: string | null;
  assessmentId: string | null;
}

export interface MifHarmonicDiagnostics {
  overallStatusReason: string;
  confirmedSwingCount: number;
  provisionalSwingCount: number;
  candidateCount: number;
  atrMethodId: string;
  atrValue: number | null;
  atrPeriod: number;
}

export interface MifHarmonicAssessment extends MifSafetyFlags {
  contractId: typeof MIF_HARMONIC_PATTERNS_CONTRACT_ID;
  contractVersion: typeof MIF_HARMONIC_PATTERNS_CONTRACT_VERSION;
  scope: "step2-harmonic-patterns";
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
  status: MifHarmonicAssessmentStatus;
  detections: MifHarmonicDetection[];
  qualityRef: MifHarmonicQualityRef;
  findings: MifHarmonicFinding[];
  warningCodes: MifHarmonicReasonCode[];
  blockingCodes: MifHarmonicReasonCode[];
  diagnostics: MifHarmonicDiagnostics;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalHarmonicInformationOnly: true;
}
