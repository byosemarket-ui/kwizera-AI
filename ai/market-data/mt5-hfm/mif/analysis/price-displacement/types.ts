import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type {
  MIF_PRICE_DISPLACEMENT_CONTRACT_ID,
  MIF_PRICE_DISPLACEMENT_CONTRACT_VERSION,
} from "./contracts.js";

/**
 * Assessment-level status (data/quality gate).
 * Distinct from displacementKind (analytical conclusion).
 */
export type MifPriceDisplacementStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA"
  | "PROVISIONAL";

/**
 * Explicit displacement conclusion.
 * FORMING is provisional and must never be treated as confirmed.
 */
export type MifPriceDisplacementKind =
  | "BULLISH_DISPLACEMENT"
  | "BEARISH_DISPLACEMENT"
  | "NO_DISPLACEMENT"
  | "FORMING"
  | "INSUFFICIENT_DATA"
  | "BLOCKED_BY_QUALITY"
  | "INVALID";

export type MifDisplacementDirection = "UP" | "DOWN" | "NONE" | "UNKNOWN";

export interface MifPriceDisplacementPolicy {
  policyId: string;
  policyVersion: string;
  atrMethodId: string;
  atrPeriod: number;
  minClosedCandles: number;
  minBodyAtr: number;
  minTrueRangeAtr: number;
  minCloseLocation: number;
  structuralBreakBufferAtr: number;
  /** Documented rationale strings for auditability. */
  thresholdRationale: {
    minBodyAtr: string;
    minTrueRangeAtr: string;
    minCloseLocation: string;
    structuralBreakBufferAtr: string;
  };
}

export interface MifPriceDisplacementMetrics {
  openTimeSec: number;
  closeTimeSec: number;
  candleState: "CLOSED" | "FORMING" | "UNKNOWN";
  open: number;
  high: number;
  low: number;
  close: number;
  body: number;
  trueRange: number;
  atr: number | null;
  bodyAtr: number | null;
  trueRangeAtr: number | null;
  /** Close location in [0,1]; null if range is zero. */
  closeLocation: number | null;
  direction: MifDisplacementDirection;
  /** Tip candle meets body+TR+close-location magnitude gates (not structural alone). */
  strongCandle: boolean;
  /** Close beyond a validated structural boundary by buffer (requires structure ref). */
  structuralBreak: boolean;
  structuralBoundaryPrice: number | null;
  structuralBoundarySide: "SUPPORT" | "RESISTANCE" | "UNKNOWN" | null;
  structuralBoundaryRefId: string | null;
  lookbackBars: number;
  atrPeriod: number;
  atrMethodId: string;
}

export interface MifPriceDisplacementAssessment extends MifSafetyFlags {
  contractId: typeof MIF_PRICE_DISPLACEMENT_CONTRACT_ID;
  contractVersion: typeof MIF_PRICE_DISPLACEMENT_CONTRACT_VERSION;
  scope: "phase5d7-price-displacement";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string;
  instrument: MifCanonicalInstrument | null;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  assessmentTimestamp: string;
  status: MifPriceDisplacementStatus;
  displacementKind: MifPriceDisplacementKind;
  /** True only for CLOSED tip with confirmed BULLISH/BEARISH displacement. */
  confirmed: boolean;
  /** True when tip is FORMING — observations are provisional. */
  provisional: boolean;
  /**
   * Genuine structural displacement = strongCandle AND structuralBreak.
   * A large candle alone never implies structural breakout.
   */
  structuralDisplacement: boolean;
  metrics: MifPriceDisplacementMetrics | null;
  qualityRef: {
    sourceKind: string | null;
    status: string;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
  calculationParameters: {
    atrPeriod: number;
    atrMethodId: string;
    minBodyAtr: number;
    minTrueRangeAtr: number;
    minCloseLocation: number;
    structuralBreakBufferAtr: number;
  };
  diagnosticsSummary: string;
  doesNotApproveAiReasoning: true;
  analyticalDisplacementInformationOnly: true;
  /** Explicit: candle OHLC alone cannot prove institutional order flow. */
  doesNotClaimInstitutionalOrderFlow: true;
}
