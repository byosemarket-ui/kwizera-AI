/**
 * Phase 5C Step 2 — market regime types (kwizera.mif.market-regime.v1).
 * Direction, structure, and volatility are separate dimensions — not mutually exclusive labels.
 */
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifAnalyticalQualityStatus } from "../quality/assessment-quality-gate.js";
import type { MifMarketRegimeReasonCode } from "./codes.js";
import type {
  MIF_MARKET_REGIME_ATR_METHOD_ID,
  MIF_MARKET_REGIME_CONTRACT_ID,
  MIF_MARKET_REGIME_CONTRACT_VERSION,
} from "./contracts.js";

export type MifRegimeDirection = "UP" | "DOWN" | "NEUTRAL" | "UNKNOWN";
export type MifRegimeStructure =
  | "TRENDING"
  | "RANGING"
  | "BREAKOUT"
  | "TRANSITION"
  | "UNSTABLE"
  | "UNKNOWN";
export type MifRegimeVolatility = "LOW" | "NORMAL" | "HIGH" | "EXTREME" | "UNKNOWN";

/** Composite label for convenience — never replaces dimensional fields. */
export type MifRegimeCompositeLabel =
  | "TRENDING_UP"
  | "TRENDING_DOWN"
  | "RANGING"
  | "BREAKOUT"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "UNSTABLE"
  | "TRANSITION"
  | "INSUFFICIENT_DATA";

export type MifBreakoutState = "NONE" | "POTENTIAL" | "CONFIRMED" | "FAILED";

export type MifMarketRegimeAssessmentStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export interface MifMarketRegimePolicy {
  policyId: string;
  policyVersion: string;
  providerId: MifProviderId;
  atrMethodId: typeof MIF_MARKET_REGIME_ATR_METHOD_ID;
  atrPeriod: number;
  /** Lookback closed bars for displacement / range. */
  lookbackBars: number;
  /** Min confirmed swings required for structure. */
  minConfirmedSwings: number;
  /** HH/HL or LH/LL consecutive pairs for trend. */
  minTrendSwingPairs: number;
  /** Displacement / ATR threshold for directional trend. */
  minTrendDisplacementAtr: number;
  /** Max displacement / ATR to remain ranging. */
  maxRangeDisplacementAtr: number;
  /** Range width / ATR band for ranging. */
  minRangeWidthAtr: number;
  maxRangeWidthAtr: number;
  /** Breakout: close beyond prior range by this ATR multiple. */
  breakoutBufferAtr: number;
  /** Closed bars of follow-through for confirmed breakout. */
  breakoutConfirmBars: number;
  /** Failed breakout window. */
  breakoutFailBars: number;
  /** Volatility vs baseline ATR percentile thresholds (fraction of baseline). */
  volLowMax: number;
  volNormalMax: number;
  volHighMax: number;
  /** Baseline ATR lookback (closed bars) for relative vol. */
  atrBaselineLookback: number;
  /** Hysteresis: min consecutive closed assessments to switch structure. */
  structurePersistBars: number;
  allowedQualityStatuses: readonly MifAnalyticalQualityStatus[];
}

export interface MifMarketRegimePolicyValidation {
  ok: boolean;
  errors: string[];
}

export interface MifTrendEvidence {
  higherHighs: number;
  higherLows: number;
  lowerHighs: number;
  lowerLows: number;
  displacement: number | null;
  displacementAtr: number | null;
  persistenceBars: number;
  directionHint: MifRegimeDirection;
}

export interface MifRangeEvidence {
  high: number | null;
  low: number | null;
  width: number | null;
  widthAtr: number | null;
  containmentRatio: number | null;
  displacementAtr: number | null;
}

export interface MifBreakoutEvidence {
  state: MifBreakoutState;
  direction: MifRegimeDirection;
  boundary: number | null;
  breakCandleOpenTimeSec: number | null;
  displacementAtr: number | null;
  followThroughBars: number;
}

export interface MifVolatilityEvidence {
  atr: number | null;
  atrBaseline: number | null;
  atrRatio: number | null;
  classification: MifRegimeVolatility;
}

export interface MifRegimeTransitionInfo {
  previousStructure: MifRegimeStructure | null;
  previousDirection: MifRegimeDirection | null;
  changed: boolean;
  hysteresisHeld: boolean;
  reason: string;
}

export interface MifMarketRegimeFinding {
  code: MifMarketRegimeReasonCode;
  severity: "blocking" | "degraded" | "warning" | "info";
  message: string;
  evidence?: Record<string, string | number | boolean | null>;
}

export interface MifMarketRegimeQualityRef {
  sourceKind: "step1-data-integrity" | "step3-unified-quality" | null;
  status: MifAnalyticalQualityStatus;
  inputIdentity: string | null;
  assessmentId: string | null;
}

export interface MifMarketRegimeDiagnostics {
  overallStatusReason: string;
  closedBarCount: number;
  confirmedSwingCount: number;
  atrMethodId: string;
  atrValue: number | null;
  atrPeriod: number;
}

export interface MifMarketRegimeAssessment extends MifSafetyFlags {
  contractId: typeof MIF_MARKET_REGIME_CONTRACT_ID;
  contractVersion: typeof MIF_MARKET_REGIME_CONTRACT_VERSION;
  scope: "step2-market-regime";
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
  status: MifMarketRegimeAssessmentStatus;
  direction: MifRegimeDirection;
  structure: MifRegimeStructure;
  volatility: MifRegimeVolatility;
  compositeLabel: MifRegimeCompositeLabel;
  trendEvidence: MifTrendEvidence;
  rangeEvidence: MifRangeEvidence;
  breakoutEvidence: MifBreakoutEvidence;
  volatilityEvidence: MifVolatilityEvidence;
  transition: MifRegimeTransitionInfo;
  qualityRef: MifMarketRegimeQualityRef;
  findings: MifMarketRegimeFinding[];
  warningCodes: MifMarketRegimeReasonCode[];
  blockingCodes: MifMarketRegimeReasonCode[];
  diagnostics: MifMarketRegimeDiagnostics;
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalRegimeInformationOnly: true;
}
