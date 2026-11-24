/**
 * Phase 09 — Live Data Validation & Research Reliability types.
 */
import type { MifProviderId, MifSafetyFlags } from "../canonical/types.js";
import type { HfmDatasetValidationReport, HfmResearchSourceMode } from "../strategy-research/types.js";
import type { MifStrategyResearchAssessment } from "../strategy-research/types.js";
import type {
  MIF_RESEARCH_RELIABILITY_CONTRACT_ID,
  MIF_RESEARCH_RELIABILITY_CONTRACT_VERSION,
} from "./contracts.js";

export type HfmQuoteReliabilityClass =
  | "LIVE"
  | "FRESH"
  | "STALE"
  | "DELAYED"
  | "MISSING"
  | "INVALID"
  | "RECOVERING";

export type HfmLiveHistoricalCompareStatus =
  | "CONSISTENT"
  | "CONSISTENT_WITH_WARNINGS"
  | "DIVERGENT"
  | "NOT_COMPARABLE"
  | "INSUFFICIENT_DATA"
  | "SOURCE_UNVERIFIED";

export type HfmResearchReliabilityGate =
  | "RESEARCH_ALLOWED"
  | "RESEARCH_ALLOWED_WITH_WARNINGS"
  | "RESEARCH_BLOCKED"
  | "INSUFFICIENT_DATA"
  | "SOURCE_UNVERIFIED";

export type HfmStrategyRobustnessStatus =
  | "STABLE_WITHIN_BASELINE"
  | "DEGRADATION_SUSPECTED"
  | "DEGRADATION_CONFIRMED"
  | "INSUFFICIENT_SAMPLE"
  | "REGIME_SHIFT_DETECTED"
  | "DATA_QUALITY_BLOCKED"
  | "NOT_EVALUABLE";

export type HfmReliabilityAlertCategory =
  | "QUOTE_STALE"
  | "QUOTE_MISSING"
  | "ABNORMAL_SPREAD"
  | "CANDLE_DATA_GAP"
  | "CANDLE_INTEGRITY_FAILURE"
  | "PROVIDER_MISMATCH"
  | "HISTORICAL_LIVE_DIVERGENCE"
  | "RESEARCH_INPUT_BLOCKED"
  | "STRATEGY_DEGRADATION_SUSPECTED"
  | "STRATEGY_DEGRADATION_CONFIRMED"
  | "REGIME_SHIFT_DETECTED"
  | "EVENT_DATA_UNAVAILABLE"
  | "INSUFFICIENT_SAMPLE";

export type HfmReliabilityAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type HfmEvidenceKind = "MEASURED" | "INFERRED" | "ASSUMED" | "UNAVAILABLE";

export interface HfmQuoteSnapshotInput {
  providerId?: string | null;
  symbol: string;
  bid: number | null;
  ask: number | null;
  mid?: number | null;
  spread?: number | null;
  /** Provider/broker quote time (unix sec). */
  providerTimestampSec: number | null;
  /** Local receive time ISO. */
  receivedAt: string | null;
  status?: string | null;
  digits?: number | null;
  point?: number | null;
}

export interface HfmQuoteReliabilityReport {
  symbol: string;
  providerId: MifProviderId;
  classification: HfmQuoteReliabilityClass;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spread: number | null;
  spreadValid: boolean;
  spreadAbnormal: boolean | null;
  providerTimestampSec: number | null;
  receivedAt: string | null;
  validationTimestamp: string;
  ageSec: number | null;
  httpOkIsNotLive: true;
  findings: readonly string[];
  evidenceKind: HfmEvidenceKind;
}

export interface HfmCandleReliabilityReport {
  dataset: HfmDatasetValidationReport;
  reusedPhase08Validator: true;
}

export interface HfmLiveHistoricalDivergence {
  symbol: string;
  timeframe: string;
  timestampSec: number;
  comparedFields: readonly string[];
  difference: number | null;
  tolerance: number | null;
  severity: HfmReliabilityAlertSeverity;
  explanation: string;
  sourceIds: readonly string[];
}

export interface HfmLiveHistoricalCompareReport {
  status: HfmLiveHistoricalCompareStatus;
  symbol: string;
  timeframe: string;
  comparisonWindowStartSec: number | null;
  comparisonWindowEndSec: number | null;
  quoteSourceId: string | null;
  candleSourceId: string | null;
  note: string;
  semanticGuard:
    "live_bid_ask_not_automatically_candle_close; forming_candles_excluded";
  divergences: readonly HfmLiveHistoricalDivergence[];
  evidenceKind: HfmEvidenceKind;
}

export interface HfmResearchInputGateReport {
  gate: HfmResearchReliabilityGate;
  datasetId: string | null;
  strategyId: string | null;
  strategyVersion: string | null;
  sourceMode: HfmResearchSourceMode | null;
  blockReasons: readonly string[];
  warnings: readonly string[];
  relatedResearchRunId: string | null;
  /** New validation record — does not mutate prior research runs. */
  validationRecordId: string;
  evidenceKind: HfmEvidenceKind;
}

export interface HfmStrategyRobustnessReport {
  status: HfmStrategyRobustnessStatus;
  strategyId: string;
  strategyVersion: string;
  symbol: string;
  timeframe: string;
  baselineSampleSize: number;
  recentSampleSize: number;
  baselineExpectancy: number | null;
  recentExpectancy: number | null;
  expectancyChangeFrac: number | null;
  baselineProfitFactor: number | null;
  recentProfitFactor: number | null;
  baselineMaxDrawdown: number | null;
  recentMaxDrawdown: number | null;
  explanation: string;
  criteriaVersion: string;
  evidenceKind: HfmEvidenceKind;
}

export interface HfmRegimeShiftReport {
  status: "REGIME_SHIFT_DETECTED" | "NO_SHIFT" | "INSUFFICIENT_DATA" | "NOT_COMPARABLE";
  historicalRegime: string | null;
  currentRegime: string | null;
  timeframe: string | null;
  evidence: readonly string[];
  sampleLimitations: readonly string[];
  evidenceKind: HfmEvidenceKind;
}

export interface HfmEventReliabilityReport {
  status:
    | "VALID"
    | "INVALID_TIMESTAMP"
    | "RELEVANCE_UNRESOLVED"
    | "BLOCKED_CONFIGURATION_REQUIRED"
    | "FIXTURE_ONLY"
    | "UNAVAILABLE";
  sourceMode: HfmResearchSourceMode | "UNAVAILABLE";
  eventCount: number;
  notes: readonly string[];
  calendarGatesUnchanged: true;
  evidenceKind: HfmEvidenceKind;
}

export interface HfmReliabilityAlert {
  alertId: string;
  category: HfmReliabilityAlertCategory;
  severity: HfmReliabilityAlertSeverity;
  symbol: string | null;
  timeframe: string | null;
  relatedResearchRunId: string | null;
  relatedDatasetId: string | null;
  detectionTimestamp: string;
  explanation: string;
  recommendedInvestigation: string;
  status: "OPEN";
  evidenceRefs: readonly string[];
  isBuySellAlert: false;
}

export interface HfmResearchReliabilityScore {
  /** Evidence completeness 0..1 — NOT win probability / event probability. */
  value: number | null;
  availability: "AVAILABLE" | "INSUFFICIENT_INPUTS" | "NOT_APPLICABLE";
  components: readonly { id: string; contribution: number | null; missing: boolean; note: string }[];
  definition: string;
  isWinProbability: false;
  isEventProbability: false;
  isProbabilityCalibration: false;
  modelVersion: string;
}

export interface MifResearchReliabilityAssessment extends MifSafetyFlags {
  contractId: typeof MIF_RESEARCH_RELIABILITY_CONTRACT_ID;
  contractVersion: typeof MIF_RESEARCH_RELIABILITY_CONTRACT_VERSION;
  scope: "phase09-research-reliability";
  assessmentId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string | null;
  engineId: string;
  engineVersion: string;
  modelVersion: string;
  policyId: string;
  policyVersion: string;
  assessmentTimestamp: string;
  quote: HfmQuoteReliabilityReport | null;
  candles: HfmCandleReliabilityReport | null;
  liveHistoricalCompare: HfmLiveHistoricalCompareReport | null;
  researchGate: HfmResearchInputGateReport | null;
  strategyRobustness: HfmStrategyRobustnessReport | null;
  regimeShift: HfmRegimeShiftReport | null;
  eventReliability: HfmEventReliabilityReport | null;
  reliabilityScore: HfmResearchReliabilityScore;
  alerts: readonly HfmReliabilityAlert[];
  limitations: readonly string[];
  missingInputs: readonly string[];
  capabilityMatrix: HfmResearchReliabilityCapabilityMatrix;
  isWinProbability: false;
  isEventProbability: false;
  isProbabilityCalibration: false;
  continuousReliabilityWorker: "DISABLED_BY_POLICY";
  doesNotConfirmOrInvalidateLifecycleAlone: true;
}

export interface HfmResearchReliabilityCapabilityMatrix {
  liveQuoteValidation: "IMPLEMENTED" | "REUSED_AND_VERIFIED";
  historicalCandleValidation: "REUSED_AND_VERIFIED";
  liveHistoricalCompare: "IMPLEMENTED";
  researchInputGate: "IMPLEMENTED";
  strategyRobustness: "IMPLEMENTED";
  regimeShift: "IMPLEMENTED";
  eventReliability: "IMPLEMENTED";
  continuousWorker: "DISABLED_BY_POLICY";
  brokerExecution: "DISABLED_BY_POLICY";
}

export interface AssessMifResearchReliabilityInput {
  providerSymbol: string;
  timeframe?: string | null;
  quote?: HfmQuoteSnapshotInput | null;
  previousQuote?: HfmQuoteSnapshotInput | null;
  recentSpreads?: readonly number[];
  fixtureBars?: readonly {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    forming?: boolean;
  }[];
  sourceMode?: HfmResearchSourceMode;
  datasetId?: string | null;
  /** Closed candle for compare (last closed historical bar). */
  lastClosedCandle?: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null;
  baselineResearch?: MifStrategyResearchAssessment | null;
  recentResearch?: MifStrategyResearchAssessment | null;
  historicalRegime?: string | null;
  currentRegime?: string | null;
  eventsProvided?: boolean;
  eventSourceMode?: HfmResearchSourceMode | null;
  liveCalendarAllowed?: boolean;
  assessmentTimestamp?: string;
}
