/**
 * Phase 5C Step 1B — chart pattern assessment types (kwizera.mif.chart-patterns.v1).
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type { MifChartPatternReasonCode } from "./codes.js";
import type {
  MIF_CHART_PATTERNS_ATR_METHOD_ID,
  MIF_CHART_PATTERNS_CONTRACT_ID,
  MIF_CHART_PATTERNS_CONTRACT_VERSION,
} from "./contracts.js";

export type MifChartPatternType =
  | "DOUBLE_TOP"
  | "DOUBLE_BOTTOM"
  | "HEAD_AND_SHOULDERS"
  | "INVERSE_HEAD_AND_SHOULDERS"
  | "ASCENDING_TRIANGLE"
  | "DESCENDING_TRIANGLE"
  | "SYMMETRICAL_TRIANGLE";

export type MifChartPatternLifecycle =
  | "FORMING"
  | "CONFIRMED"
  | "FAILED"
  | "INVALIDATED";

export type MifChartPatternAssessmentStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type MifChartPatternBreakoutDirection = "BULLISH" | "BEARISH" | "NONE";

export interface MifChartPatternPolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  allowedQualityStatusesForConfirmed: readonly MifAnalyticalQualityStatus[];
  /** Statuses that allow FORMING geometry assessment (never upgrades quality). */
  allowedQualityStatusesForForming: readonly MifAnalyticalQualityStatus[];
  requireConfirmedSwingsForConfirmed: true;
  allowProvisionalSwingsForForming: boolean;
  atrMethodId: typeof MIF_CHART_PATTERNS_ATR_METHOD_ID;
  atrPeriod: number;
  /** |p1-p2| <= max(peakEqualityTolRel * mid, peakEqualityTolAtrMult * ATR). */
  peakEqualityTolRel: number;
  peakEqualityTolAtrMult: number;
  /** Min (avgPeak - trough) / avgPeak for double top/bottom depth. */
  minRetraceOfSpan: number;
  minBarsBetweenPivots: number;
  /** Head must exceed shoulders by max(rel*mid, atrMult*ATR). */
  minHeadProminenceRel: number;
  minHeadProminenceAtrMult: number;
  shoulderSymmetryTolRel: number;
  shoulderSymmetryTolAtrMult: number;
  /** Max |neckline slope| * priceScale / ATR (dimensionless slope bound). */
  maxNecklineSlopeAtrPerBar: number;
  triangleMinTouchesPerBoundary: number;
  /** Max mean absolute residual / ATR for pivot-only boundary fit. */
  triangleMaxResidualAtr: number;
  /** Min |upperSlope - lowerSlope| for convergence (price per bar). */
  triangleMinConvergencePerBar: number;
  /** Flat boundary: |slope| <= flatSlopeAtrMult * ATR / bar. */
  triangleFlatSlopeAtrMult: number;
  breakoutBufferRel: number;
  breakoutBufferAtrMult: number;
  /** Bars after breakout to watch for failure (close back through boundary). */
  failureWindowBars: number;
  candleStatePolicy: "closed_only_confirm";
  maxDetections: number;
}

export interface MifChartPatternPolicyValidation {
  ok: boolean;
  errors: string[];
}

export interface MifChartPatternPivotRef {
  role: string;
  swingId: string;
  kind: "HIGH" | "LOW";
  price: number;
  timeSec: number;
  index: number;
  status: "CONFIRMED" | "PROVISIONAL";
}

export interface MifChartPatternBoundary {
  kind: "horizontal" | "sloped";
  priceAtStart: number;
  timeSecStart: number;
  priceAtEnd: number;
  timeSecEnd: number;
  /** Price change per second (0 for horizontal). */
  slopePerSec: number;
  label: string;
}

export interface MifChartPatternConfidenceComponents {
  geometryFit: number;
  depthOrProminence: number;
  symmetryOrTouches: number;
  qualityGate: number;
  breakoutClarity: number;
  /** Explainable composite in [0,1] — not a trade-win probability. */
  composite: number;
}

export interface MifChartPatternConfirmationEvidence {
  met: boolean;
  direction: MifChartPatternBreakoutDirection;
  candleOpenTimeSec: number | null;
  candleClose: number | null;
  candleState: "CLOSED" | "FORMING" | null;
  boundaryPriceAtBreak: number | null;
  bufferUsed: number | null;
}

export interface MifChartPatternRetestEvidence {
  observed: boolean;
  candleOpenTimeSec: number | null;
  advisoryOnly: true;
}

export interface MifChartPatternDetection {
  patternType: MifChartPatternType;
  lifecycle: MifChartPatternLifecycle;
  pivots: MifChartPatternPivotRef[];
  neckline: MifChartPatternBoundary | null;
  upperBoundary: MifChartPatternBoundary | null;
  lowerBoundary: MifChartPatternBoundary | null;
  measurements: Record<string, number | boolean | string | null>;
  confidenceComponents: MifChartPatternConfidenceComponents;
  confirmation: MifChartPatternConfirmationEvidence;
  retest: MifChartPatternRetestEvidence;
  invalidationCriteria: string;
  failureCriteria: string;
  detectionIdentity: string;
}

export interface MifChartPatternFinding {
  code: MifChartPatternReasonCode;
  severity: "blocking" | "degraded" | "warning" | "info";
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface MifChartPatternQualityRef {
  sourceKind: "step1-data-integrity" | "step3-unified-quality" | null;
  status: MifAnalyticalQualityStatus;
  inputIdentity: string | null;
  assessmentId: string | null;
}

export interface MifChartPatternDiagnostics {
  overallStatusReason: string;
  confirmedSwingCount: number;
  provisionalSwingCount: number;
  candidateCount: number;
  atrMethodId: string;
  atrValue: number | null;
  atrPeriod: number;
}

export interface MifChartPatternAssessment extends MifSafetyFlags {
  contractId: typeof MIF_CHART_PATTERNS_CONTRACT_ID;
  contractVersion: typeof MIF_CHART_PATTERNS_CONTRACT_VERSION;
  scope: "step1b-chart-patterns";
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
  status: MifChartPatternAssessmentStatus;
  detections: MifChartPatternDetection[];
  qualityRef: MifChartPatternQualityRef;
  findings: MifChartPatternFinding[];
  warningCodes: MifChartPatternReasonCode[];
  blockingCodes: MifChartPatternReasonCode[];
  diagnostics: MifChartPatternDiagnostics;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalPatternInformationOnly: true;
}
