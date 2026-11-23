import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import type { MifProviderId, MifSafetyFlags } from "../../canonical/types.js";
import type { HfmEconomicEvent, HfmFundamentalsPackage } from "../../../fundamentals/types.js";
import type {
  MIF_EXTERNAL_MARKET_CONTRACT_ID,
  MIF_EXTERNAL_MARKET_CONTRACT_VERSION,
} from "./contracts.js";

export type HfmEventRiskClass =
  | "HIGH_EVENT_RISK"
  | "ELEVATED_EVENT_RISK"
  | "MODERATE_EVENT_RISK"
  | "LOW_EVENT_RISK"
  | "NO_RELEVANT_EVENT"
  | "UNKNOWN_EVENT_RISK";

export type HfmTechnicalFundamentalAlignment =
  | "TECHNICAL_AND_FUNDAMENTAL_ALIGNED_BULLISH"
  | "TECHNICAL_AND_FUNDAMENTAL_ALIGNED_BEARISH"
  | "TECHNICAL_BULLISH_FUNDAMENTAL_BEARISH"
  | "TECHNICAL_BEARISH_FUNDAMENTAL_BULLISH"
  | "FUNDAMENTAL_EVENT_RISK_ELEVATED"
  | "FUNDAMENTAL_CONTEXT_NEUTRAL"
  | "MIXED_EVIDENCE"
  | "INSUFFICIENT_FUNDAMENTAL_DATA";

export type HfmSurpriseDirection =
  | "ABOVE_FORECAST"
  | "BELOW_FORECAST"
  | "IN_LINE"
  | "NOT_COMPARABLE"
  | "MISSING_VALUES";

export type HfmExternalCapabilityStatus =
  | "REUSED_AND_VERIFIED"
  | "IMPLEMENTED"
  | "PARTIALLY_IMPLEMENTED"
  | "FIXTURE_ONLY"
  | "UNAVAILABLE"
  | "BLOCKED_CONFIGURATION_REQUIRED"
  | "BLOCKED_PROVIDER_ACCESS"
  | "NOT_IMPLEMENTED"
  | "DISABLED_BY_POLICY";

export type MifExternalMarketStatus =
  | "VALID"
  | "WARNING"
  | "DEGRADED"
  | "BLOCKED"
  | "INSUFFICIENT_DATA"
  | "NOT_CONFIGURED"
  | "LICENSING_BLOCKED";

export interface MifExternalMarketIntelligencePolicy {
  policyId: string;
  policyVersion: string;
  highRiskWindowMs: number;
  elevatedRiskWindowMs: number;
  moderateRiskWindowMs: number;
  thresholdRationale: {
    highRiskWindowMs: string;
    elevatedRiskWindowMs: string;
    moderateRiskWindowMs: string;
    surprise: string;
    alignment: string;
  };
}

export interface HfmNumericSurprise {
  direction: HfmSurpriseDirection;
  /** Signed actual - forecast when both parse as numbers; else null. */
  delta: number | null;
  unit: string | null;
  comparable: boolean;
  note: string;
  /** Never a win probability or directional trade signal. */
  isDirectionalTradeSignal: false;
}

export interface HfmEventRiskAssessment {
  riskClass: HfmEventRiskClass;
  asOfUtc: string;
  relevantEventIds: string[];
  nearestEventId: string | null;
  nearestEventTitle: string | null;
  nearestScheduledAtUtc: string | null;
  msUntilNearest: number | null;
  explanation: string;
  methodologyVersion: string;
  /** Explicit: risk ≠ guaranteed volatility or direction. */
  doesNotGuaranteeVolatility: true;
  doesNotImplyDirection: true;
}

export interface HfmInstrumentRelevanceRecord {
  symbol: string;
  currency: string;
  relationshipType: "CURRENCY_LEG" | "USD_LEG" | "XAU_USD_CONTEXT" | "UNRESOLVED";
  relevant: boolean;
  rationale: string;
  configVersion: string;
}

export interface HfmExternalCapabilityMatrix {
  economicCalendar: HfmExternalCapabilityStatus;
  economicRelease: HfmExternalCapabilityStatus;
  eventRisk: HfmExternalCapabilityStatus;
  instrumentRelevance: HfmExternalCapabilityStatus;
  surpriseCalculation: HfmExternalCapabilityStatus;
  financialNews: HfmExternalCapabilityStatus;
  newsSentiment: HfmExternalCapabilityStatus;
  centralBankPolicy: HfmExternalCapabilityStatus;
  crossAssetContext: HfmExternalCapabilityStatus;
  technicalFundamentalAlignment: HfmExternalCapabilityStatus;
  continuousIngestionWorker: HfmExternalCapabilityStatus;
}

export interface MifExternalMarketIntelligenceAssessment extends MifSafetyFlags {
  contractId: typeof MIF_EXTERNAL_MARKET_CONTRACT_ID;
  contractVersion: typeof MIF_EXTERNAL_MARKET_CONTRACT_VERSION;
  scope: "phase07-external-market-intelligence";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  instrument: MifCanonicalInstrument | null;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  modelVersion: string;
  assessmentTimestamp: string;
  status: MifExternalMarketStatus;
  calendarAvailability: string;
  calendarFreshness: string;
  calendarProviderId: string | null;
  dataSourceMode: "LIVE_CACHE" | "FIXTURE" | "UNAVAILABLE";
  relevantEvents: HfmEconomicEvent[];
  relevance: HfmInstrumentRelevanceRecord[];
  surprises: Array<{ eventId: string; surprise: HfmNumericSurprise }>;
  eventRisk: HfmEventRiskAssessment;
  technicalFundamentalAlignment: HfmTechnicalFundamentalAlignment;
  technicalBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED" | "UNKNOWN" | null;
  fundamentalBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED" | "UNKNOWN" | null;
  supportingEvidence: string[];
  contradictingEvidence: string[];
  missingInputs: string[];
  limitations: string[];
  capabilityMatrix: HfmExternalCapabilityMatrix;
  fundamentalsPackageId: string | null;
  sourceRefs: {
    fundamentalsPackageId: string | null;
    deepTechnicalAssessmentId: string | null;
    eventIds: string[];
  };
  diagnosticsSummary: string;
  isWinProbability: false;
  isEventProbability: false;
  isCalibratedProbability: false;
  doesNotConfirmOrInvalidateLifecycleAlone: true;
  doesNotApproveExecution: true;
  analyticalFundamentalInformationOnly: true;
  backgroundRefreshEnabled: false;
  financialNewsStatus: "UNAVAILABLE" | "NOT_IMPLEMENTED";
  centralBankLiveFeedStatus: "UNAVAILABLE" | "NOT_IMPLEMENTED";
}

/** Optional technical bias input from Phase 06 (or null). */
export interface HfmTechnicalBiasInput {
  assessmentId?: string | null;
  overallTrendDirection?: "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED" | "UNKNOWN" | null;
  overallRegimeLabel?: string | null;
}

export interface AssessMifExternalMarketIntelligenceInput {
  providerSymbol: string;
  instrument?: MifCanonicalInstrument | null;
  asOfUtc?: string;
  /** Prefer a built package from fundamentals cache or fixtures. */
  fundamentalsPackage?: HfmFundamentalsPackage | null;
  /** Raw events when package unavailable (fixture path). */
  events?: readonly HfmEconomicEvent[] | null;
  technicalBias?: HfmTechnicalBiasInput | null;
  policy?: Partial<MifExternalMarketIntelligencePolicy> | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
  /** Explicit data source mode for honesty in output. */
  dataSourceMode?: "LIVE_CACHE" | "FIXTURE" | "UNAVAILABLE";
  calendarAvailability?: string;
  calendarFreshness?: string;
}
