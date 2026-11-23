import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifCandleState, MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { MifBuyerSellerPressureAssessment } from "../buyer-seller-pressure/types.js";
import type { MifFibonacciAssessment } from "../fibonacci/types.js";
import type { MifHarmonicAssessment } from "../harmonics/types.js";
import type { MifLiquidityReferenceAssessment } from "../liquidity-reference/types.js";
import type { MifMarketStructureAssessment } from "../market-structure/types.js";
import type { MifMomentumAssessment } from "../momentum/types.js";
import type { MifMtfRelationshipsAssessment } from "../mtf-relationships/types.js";
import type { MifChartPatternAssessment } from "../patterns/types.js";
import type { MifPriceDisplacementAssessment } from "../price-displacement/types.js";
import type { MifMarketRegimeAssessment } from "../regime/types.js";
import type { MifSupportResistanceAssessment } from "../support-resistance/types.js";
import type { MifUnifiedChartAnalysisAssessment } from "../unified/types.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import type {
  MIF_DEEP_TECHNICAL_CONTRACT_ID,
  MIF_DEEP_TECHNICAL_CONTRACT_VERSION,
} from "./contracts.js";

/** Phase 06 §3 — normalized candle observation status. */
export type HfmDeepTechnicalCandleStatus =
  | "CLOSED_CANDLE"
  | "FORMING_CANDLE"
  | "STALE_DATA"
  | "MISSING_DATA"
  | "INVALID_TIMESTAMP"
  | "INCOMPLETE_HISTORY";

/** Phase 06 §5 — trend/regime presentation (mapped from existing engines). */
export type HfmDeepTechnicalTrendRegime =
  | "STRONG_BULLISH_TREND"
  | "BULLISH_TREND"
  | "WEAK_BULLISH_TREND"
  | "STRONG_BEARISH_TREND"
  | "BEARISH_TREND"
  | "WEAK_BEARISH_TREND"
  | "RANGE_BOUND"
  | "TRANSITIONAL"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "INSUFFICIENT_DATA";

export type HfmDeepTechnicalTrendDirection =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL"
  | "MIXED"
  | "UNKNOWN";

export type HfmDeepTechnicalTrendStrength =
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "NONE"
  | "UNAVAILABLE";

/** Phase 06 §11 — MTF alignment (does not average conflicting frames). */
export type HfmDeepTechnicalMtfAlignment =
  | "FULL_BULLISH_ALIGNMENT"
  | "FULL_BEARISH_ALIGNMENT"
  | "HIGHER_TIMEFRAME_BULLISH_LOWER_TIMEFRAME_BEARISH"
  | "HIGHER_TIMEFRAME_BEARISH_LOWER_TIMEFRAME_BULLISH"
  | "PARTIAL_BULLISH_ALIGNMENT"
  | "PARTIAL_BEARISH_ALIGNMENT"
  | "RANGE_CONFLICT"
  | "MIXED_TIMEFRAME_EVIDENCE"
  | "INSUFFICIENT_TIMEFRAME_DATA";

export type HfmTechnicalConfluenceGrade =
  | "STRONG"
  | "MODERATE"
  | "WEAK"
  | "NONE"
  | "CONFLICTING"
  | "INSUFFICIENT_DATA"
  | "UNSCORED";

export type HfmDeepTechnicalEvidenceQuality =
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "INSUFFICIENT_DATA";

export type MifDeepTechnicalStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA"
  | "PROVISIONAL";

export type HfmCapabilityStatus =
  | "REUSED_AND_VERIFIED"
  | "IMPLEMENTED"
  | "PARTIALLY_IMPLEMENTED"
  | "INFERRED_ONLY"
  | "INSUFFICIENT_DATA"
  | "NOT_IMPLEMENTED"
  | "UNAVAILABLE"
  | "BLOCKED";

export interface MifDeepTechnicalIntelligencePolicy {
  policyId: string;
  policyVersion: string;
  minMtfFrames: number;
  weightStructure: number;
  weightRegime: number;
  weightMtf: number;
  weightLevels: number;
  weightPatterns: number;
  weightMomentum: number;
  weightPressure: number;
  confluenceStrongMin: number;
  confluenceModerateMin: number;
  thresholdRationale: {
    confluenceStrongMin: string;
    confluenceModerateMin: string;
    pressureWeight: string;
    doubleCountGuard: string;
  };
}

/** Per-timeframe composed snapshot — references existing assessments only. */
export interface HfmDeepTechnicalTimeframeSnapshot {
  timeframe: string;
  available: boolean;
  stale: boolean;
  tipCandleState: MifCandleState | null;
  candleStatus: HfmDeepTechnicalCandleStatus;
  dataQuality: string;
  trendDirection: HfmDeepTechnicalTrendDirection;
  trendStrength: HfmDeepTechnicalTrendStrength;
  regimeLabel: HfmDeepTechnicalTrendRegime;
  structureBias: string | null;
  structureAssessmentId: string | null;
  supportResistanceAssessmentId: string | null;
  liquidityAssessmentId: string | null;
  momentumAssessmentId: string | null;
  fibonacciAssessmentId: string | null;
  chartPatternAssessmentId: string | null;
  harmonicAssessmentId: string | null;
  unifiedAssessmentId: string | null;
  pressureAssessmentId: string | null;
  pressureDominantSide: string | null;
  pressureDataClassification: string | null;
  candlestickPatternIds: string[];
  supportingNotes: string[];
  conflictingNotes: string[];
  missingInputs: string[];
  limitations: string[];
}

export interface HfmTechnicalConfluenceFamilyVote {
  family: string;
  direction: HfmDeepTechnicalTrendDirection;
  weight: number;
  contribution: number;
  inputDependencyGroup: string;
  counted: boolean;
  skipReason: string | null;
  sourceAssessmentIds: string[];
}

export interface HfmTechnicalConfluenceAssessment {
  grade: HfmTechnicalConfluenceGrade;
  /** Signed [-1, 1] directional score — NOT probability. */
  directionalScore: number | null;
  bullishContribution: number;
  bearishContribution: number;
  families: HfmTechnicalConfluenceFamilyVote[];
  sharedInputDependencies: string[];
  explanation: string;
  isWinProbability: false;
  isEventProbability: false;
  isCalibratedProbability: false;
  analyticalReferenceOnly: true;
}

export interface HfmDeepTechnicalCapabilityMatrix {
  marketStructure: HfmCapabilityStatus;
  trendRegime: HfmCapabilityStatus;
  supportResistance: HfmCapabilityStatus;
  supplyDemandZones: HfmCapabilityStatus;
  liquidity: HfmCapabilityStatus;
  fibonacci: HfmCapabilityStatus;
  candlestickPatterns: HfmCapabilityStatus;
  chartPatterns: HfmCapabilityStatus;
  harmonicPatterns: HfmCapabilityStatus;
  elliottWave: HfmCapabilityStatus;
  momentumRocRsi: HfmCapabilityStatus;
  momentumMacdAdxBb: HfmCapabilityStatus;
  buyerSellerPressure: HfmCapabilityStatus;
  multiTimeframeAlignment: HfmCapabilityStatus;
  technicalConfluence: HfmCapabilityStatus;
}

export interface HfmDeepTechnicalMtfContext {
  alignment: HfmDeepTechnicalMtfAlignment;
  higherTimeframeBias: HfmDeepTechnicalTrendDirection;
  intermediateTimeframeBias: HfmDeepTechnicalTrendDirection;
  lowerTimeframeBias: HfmDeepTechnicalTrendDirection;
  mtfEngineRelation: string | null;
  mtfAssessmentId: string | null;
  framesEvaluated: string[];
  framesMissing: string[];
  conflictingTimeframes: string[];
  notes: string[];
  doesNotAverageConflictingFrames: true;
}

/** Input bundle per timeframe — pre-computed by existing engines. */
export interface HfmDeepTechnicalTimeframeBundle {
  timeframe: string;
  tipCandleState?: MifCandleState | null;
  integrity?: MifStep1DataIntegrityAssessment | null;
  marketStructure?: MifMarketStructureAssessment | null;
  supportResistance?: MifSupportResistanceAssessment | null;
  liquidityReference?: MifLiquidityReferenceAssessment | null;
  momentum?: MifMomentumAssessment | null;
  priceDisplacement?: MifPriceDisplacementAssessment | null;
  buyerSellerPressure?: MifBuyerSellerPressureAssessment | null;
  regime?: MifMarketRegimeAssessment | null;
  fibonacci?: MifFibonacciAssessment | null;
  chartPatterns?: MifChartPatternAssessment | null;
  harmonic?: MifHarmonicAssessment | null;
  unified?: MifUnifiedChartAnalysisAssessment | null;
  /** Optional Phase 06 candlestick wrapper detections (pattern ids). */
  candlestickPatternIds?: readonly string[] | null;
}

export interface MifDeepTechnicalIntelligenceAssessment extends MifSafetyFlags {
  contractId: typeof MIF_DEEP_TECHNICAL_CONTRACT_ID;
  contractVersion: typeof MIF_DEEP_TECHNICAL_CONTRACT_VERSION;
  scope: "phase06-deep-technical-intelligence";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  primaryTimeframe: string;
  instrument: MifCanonicalInstrument | null;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  modelVersion: string;
  assessmentTimestamp: string;
  status: MifDeepTechnicalStatus;
  provisional: boolean;
  overallTrendDirection: HfmDeepTechnicalTrendDirection;
  overallTrendStrength: HfmDeepTechnicalTrendStrength;
  overallRegimeLabel: HfmDeepTechnicalTrendRegime;
  primarySnapshot: HfmDeepTechnicalTimeframeSnapshot | null;
  timeframeSnapshots: HfmDeepTechnicalTimeframeSnapshot[];
  mtf: HfmDeepTechnicalMtfContext;
  confluence: HfmTechnicalConfluenceAssessment;
  capabilityMatrix: HfmDeepTechnicalCapabilityMatrix;
  evidenceQuality: HfmDeepTechnicalEvidenceQuality;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingInputs: string[];
  limitations: string[];
  sourceRefs: {
    mtfAssessmentId: string | null;
    primaryStructureId: string | null;
    primaryRegimeId: string | null;
    primaryPressureId: string | null;
    primaryUnifiedId: string | null;
  };
  diagnosticsSummary: string;
  isWinProbability: false;
  isEventProbability: false;
  isCalibratedProbability: false;
  doesNotConfirmOrInvalidateLifecycleAlone: true;
  elliottWaveStatus: "NOT_IMPLEMENTED";
  macdAdxBollingerStatus: "NOT_IMPLEMENTED";
  analyticalTechnicalInformationOnly: true;
}
