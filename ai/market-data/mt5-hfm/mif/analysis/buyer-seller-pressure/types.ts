import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type {
  MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID,
  MIF_BUYER_SELLER_PRESSURE_CONTRACT_VERSION,
} from "./contracts.js";

/** Honest data capability / calculation basis. */
export type HfmPressureDataClassification =
  | "DIRECTLY_MEASURED"
  | "INFERRED_FROM_TICK_ACTIVITY"
  | "INFERRED_FROM_CANDLE_STRUCTURE"
  | "PROXY_ESTIMATE"
  | "UNAVAILABLE"
  | "INSUFFICIENT_DATA";

export type MifBuyerSellerPressureStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA"
  | "PROVISIONAL";

export type HfmPressureDominantSide =
  | "BUYERS_DOMINANT"
  | "SELLERS_DOMINANT"
  | "BALANCED"
  | "MIXED"
  | "INSUFFICIENT_EVIDENCE";

export type HfmDominanceStrength =
  | "STRONG"
  | "WEAK"
  | "NONE"
  | "UNAVAILABLE";

export type HfmPressureTrend =
  | "STRENGTHENING"
  | "WEAKENING"
  | "STABLE"
  | "REVERSING"
  | "UNAVAILABLE";

export type HfmPressureChange =
  | "INCREASING_BUYER"
  | "INCREASING_SELLER"
  | "DECREASING_IMBALANCE"
  | "RAPID_SHIFT"
  | "STABLE"
  | "UNAVAILABLE";

export type HfmAbsorptionAssessment =
  | "POSSIBLE_ABSORPTION"
  | "NO_ABSORPTION_SIGNAL"
  | "UNAVAILABLE"
  | "INSUFFICIENT_EVIDENCE";

export type HfmExhaustionAssessment =
  | "BUYING_PRESSURE_STRENGTHENING"
  | "BUYING_PRESSURE_WEAKENING"
  | "SELLING_PRESSURE_STRENGTHENING"
  | "SELLING_PRESSURE_WEAKENING"
  | "POSSIBLE_BUYER_EXHAUSTION"
  | "POSSIBLE_SELLER_EXHAUSTION"
  | "NO_CLEAR_EXHAUSTION"
  | "INSUFFICIENT_EVIDENCE";

export type HfmPricePressureRelationship =
  | "PRICE_PRESSURE_ALIGNED"
  | "PRICE_PRESSURE_DIVERGENCE"
  | "PRICE_MOVEMENT_UNCONFIRMED"
  | "PRESSURE_WITHOUT_PRICE_PROGRESS"
  | "MIXED_EVIDENCE"
  | "INSUFFICIENT_DATA";

export type HfmPressureEvidenceQuality =
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INSUFFICIENT_DATA";

export type HfmPressurePersistence =
  | "SUSTAINED"
  | "TEMPORARY_SPIKE"
  | "INSUFFICIENT_HISTORY"
  | "UNAVAILABLE";

export interface MifBuyerSellerPressurePolicy {
  policyId: string;
  policyVersion: string;
  atrPeriod: number;
  minClosedCandles: number;
  persistenceBars: number;
  imbalanceDominanceMin: number;
  imbalanceStrongMin: number;
  sustainedAgreeMin: number;
  absorptionMaxBodyAtr: number;
  absorptionMinTickRatio: number;
  thresholdRationale: {
    imbalanceDominanceMin: string;
    imbalanceStrongMin: string;
    sustainedAgreeMin: string;
    absorptionMaxBodyAtr: string;
  };
}

/**
 * Per-bar candle-structure proxy scores in [0, 100].
 * NOT win probability. NOT aggressor volume.
 */
export interface HfmCandlePressureBarMetrics {
  openTimeSec: number;
  candleState: "CLOSED" | "FORMING" | "UNKNOWN";
  body: number;
  range: number;
  closeLocation: number | null;
  buyingPressureScore: number;
  sellingPressureScore: number;
  /** (buy - sell) / 100 → [-1, 1] */
  pressureImbalance: number;
  tickVolume: number | null;
  atr: number | null;
  bodyAtr: number | null;
}

export interface MifBuyerSellerPressureAssessment extends MifSafetyFlags {
  contractId: typeof MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID;
  contractVersion: typeof MIF_BUYER_SELLER_PRESSURE_CONTRACT_VERSION;
  scope: "phase05-buyer-seller-pressure";
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
  modelVersion: string;
  assessmentTimestamp: string;
  observationStartSec: number | null;
  observationEndSec: number | null;
  status: MifBuyerSellerPressureStatus;
  /** Tip must be CLOSED for non-provisional conclusions. */
  provisional: boolean;
  dataClassification: HfmPressureDataClassification;
  /** Primary classification for the numeric scores (almost always candle-structure). */
  scoreClassification: HfmPressureDataClassification;
  tickActivityClassification: HfmPressureDataClassification;
  aggressorSideAvailable: false;
  orderBookAvailable: false;
  buyingPressureScore: number | null;
  sellingPressureScore: number | null;
  pressureImbalance: number | null;
  dominantSide: HfmPressureDominantSide;
  dominanceStrength: HfmDominanceStrength;
  pressureTrend: HfmPressureTrend;
  pressureChange: HfmPressureChange;
  persistence: HfmPressurePersistence;
  absorptionAssessment: HfmAbsorptionAssessment;
  exhaustionAssessment: HfmExhaustionAssessment;
  pricePressureRelationship: HfmPricePressureRelationship;
  evidenceQuality: HfmPressureEvidenceQuality;
  tipMetrics: HfmCandlePressureBarMetrics | null;
  persistenceWindow: HfmCandlePressureBarMetrics[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingInputs: string[];
  limitations: string[];
  qualityRef: {
    sourceKind: string | null;
    status: string;
    inputIdentity: string | null;
    assessmentId: string | null;
  };
  calculationParameters: {
    atrPeriod: number;
    persistenceBars: number;
    imbalanceDominanceMin: number;
    imbalanceStrongMin: number;
    sustainedAgreeMin: number;
  };
  diagnosticsSummary: string;
  /** Explicit semantic safeguards. */
  isWinProbability: false;
  isEventProbability: false;
  isCalibratedProbability: false;
  doesNotClaimInstitutionalOrderFlow: true;
  doesNotClaimTrueAggressorVolume: true;
  analyticalPressureInformationOnly: true;
  doesNotConfirmOrInvalidateLifecycleAlone: true;
}

export interface HfmPressureTimeframeSummary {
  timeframe: string;
  available: boolean;
  stale: boolean;
  dominantSide: HfmPressureDominantSide;
  pressureImbalance: number | null;
  evidenceQuality: HfmPressureEvidenceQuality;
  dataClassification: HfmPressureDataClassification;
  assessmentId: string | null;
}

export type HfmMtfPressureAlignment =
  | "ALIGNED"
  | "CONFLICTING"
  | "PARTIAL"
  | "INSUFFICIENT_DATA";

export interface HfmMultiTimeframePressureContext {
  providerId: MifProviderId;
  providerSymbol: string;
  assessedAt: string;
  frames: HfmPressureTimeframeSummary[];
  alignment: HfmMtfPressureAlignment;
  higherTimeframeBias: HfmPressureDominantSide;
  lowerTimeframeBias: HfmPressureDominantSide;
  notes: string[];
  doesNotAverageConflictingFrames: true;
}
