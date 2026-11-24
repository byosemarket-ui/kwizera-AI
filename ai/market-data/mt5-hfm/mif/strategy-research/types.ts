/**
 * Phase 08 — Historical Research & Strategy Intelligence types.
 */
import type { MifProviderId, MifSafetyFlags } from "../canonical/types.js";
import type { HfmEconomicEvent } from "../../fundamentals/types.js";
import type {
  MIF_STRATEGY_RESEARCH_CONTRACT_ID,
  MIF_STRATEGY_RESEARCH_CONTRACT_VERSION,
} from "./contracts.js";

export type HfmResearchSourceMode =
  | "LIVE_SOURCE"
  | "HISTORICAL_SOURCE"
  | "FIXTURE"
  | "SYNTHETIC_TEST_DATA";

export type HfmDatasetQualityStatus =
  | "VALID"
  | "VALID_WITH_WARNINGS"
  | "INCOMPLETE"
  | "INVALID"
  | "INSUFFICIENT_HISTORY";

export type HfmResearchReliabilityStatus =
  | "RESEARCH_ONLY"
  | "INSUFFICIENT_SAMPLE"
  | "PROVISIONAL"
  | "OUT_OF_SAMPLE_TESTED"
  | "ROBUSTNESS_UNVERIFIED";

export type HfmResearchRunStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "INSUFFICIENT_HISTORY"
  | "INVALID_DATASET"
  | "FAILED"
  | "BLOCKED";

export type HfmMetricAvailability =
  | "AVAILABLE"
  | "INSUFFICIENT_SAMPLE"
  | "UNSUPPORTED"
  | "NOT_APPLICABLE"
  | "ASSUMPTION_BASED";

export interface HfmResearchMetric {
  id: string;
  name: string;
  value: number | null;
  definition: string;
  calculationBasis: string;
  sampleSize: number;
  availability: HfmMetricAvailability;
  limitations: readonly string[];
  /** Explicit: never event probability / next-trade win probability. */
  isWinProbability: false;
  isEventProbability: false;
}

export interface HfmCostAssumption {
  spreadPoints: number;
  slippagePoints: number;
  commissionPerTrade: number;
  swapPerBar: number;
  label: string;
  source: "CONFIGURABLE_ASSUMPTION" | "SOURCE_BACKED";
  note: string;
}

export interface HfmCostSensitivityScenario {
  assumption: HfmCostAssumption;
  adjustedNetReturn: number | null;
  adjustedExpectancy: number | null;
  materialDegradation: boolean | null;
  note: string;
}

export interface HfmDatasetValidationReport {
  datasetId: string;
  symbol: string;
  timeframe: string;
  providerId: MifProviderId;
  sourceMode: HfmResearchSourceMode;
  qualityStatus: HfmDatasetQualityStatus;
  candleCount: number;
  missingCandleCount: number;
  duplicateCount: number;
  formingCandleCount: number;
  invalidOhlcCount: number;
  startTimestamp: string | null;
  endTimestamp: string | null;
  retrievalTimestamp: string;
  contentHash: string | null;
  warnings: readonly string[];
  blockReasons: readonly string[];
  mayProceed: boolean;
}

export interface HfmRegimePerformanceBucket {
  regimeLabel: string;
  tradeCount: number;
  winCount: number;
  lossCount: number;
  winRate: HfmResearchMetric;
  expectancy: HfmResearchMetric;
  maxDrawdown: HfmResearchMetric | null;
  sampleSufficient: boolean;
  note: string;
}

export interface HfmEventPriceWindowResult {
  eventId: string;
  eventTitle: string;
  currency: string;
  scheduledAtUtc: string;
  windowLabel: "BEFORE" | "IMMEDIATE" | "POST" | "EXTENDED_POST";
  windowStartUtc: string;
  windowEndUtc: string;
  priceChangePct: number | null;
  highLowRangePct: number | null;
  observation: "DIRECTLY_OBSERVED" | "STATISTICAL_ASSOCIATION" | "UNAVAILABLE";
  causationClaimed: false;
  sourceMode: HfmResearchSourceMode;
  note: string;
}

export interface HfmWalkForwardSummary {
  available: boolean;
  development: { label: string; sampleSize: number; primaryMetric: number | null } | null;
  validation: { label: string; sampleSize: number; primaryMetric: number | null } | null;
  outOfSample: { label: string; sampleSize: number; primaryMetric: number | null } | null;
  performanceDegradation: number | null;
  status: "OUT_OF_SAMPLE_TESTED" | "INSUFFICIENT_HISTORY" | "NOT_RUN" | "PARTIAL";
  note: string;
}

export interface HfmStrategyResearchPerformance {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  ambiguousTrades: number;
  winRate: HfmResearchMetric;
  netReturn: HfmResearchMetric;
  averageWin: HfmResearchMetric;
  averageLoss: HfmResearchMetric;
  expectancy: HfmResearchMetric;
  profitFactor: HfmResearchMetric;
  maxDrawdown: HfmResearchMetric;
  averageHoldingBars: HfmResearchMetric;
  consecutiveWins: HfmResearchMetric;
  consecutiveLosses: HfmResearchMetric;
  sharpe: HfmResearchMetric;
}

export interface MifStrategyResearchAssessment extends MifSafetyFlags {
  contractId: typeof MIF_STRATEGY_RESEARCH_CONTRACT_ID;
  contractVersion: typeof MIF_STRATEGY_RESEARCH_CONTRACT_VERSION;
  scope: "phase08-strategy-research";
  researchRunId: string;
  inputIdentity: string;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string;
  strategyId: string;
  strategyVersion: string;
  strategyName: string;
  engineId: string;
  engineVersion: string;
  modelVersion: string;
  policyId: string;
  policyVersion: string;
  runTimestamp: string;
  status: HfmResearchRunStatus;
  reliabilityStatus: HfmResearchReliabilityStatus;
  sourceMode: HfmResearchSourceMode;
  dataset: HfmDatasetValidationReport;
  executionAssumptions: Record<string, unknown>;
  costAssumptions: HfmCostAssumption;
  costSensitivity: readonly HfmCostSensitivityScenario[];
  performance: HfmStrategyResearchPerformance;
  regimeBreakdown: readonly HfmRegimePerformanceBucket[];
  walkForward: HfmWalkForwardSummary;
  eventPriceResearch: readonly HfmEventPriceWindowResult[];
  reusedBacktestRunId: string | null;
  supportingEvidence: readonly string[];
  contradictingEvidence: readonly string[];
  missingInputs: readonly string[];
  limitations: readonly string[];
  overfittingWarnings: readonly string[];
  capabilityMatrix: HfmStrategyResearchCapabilityMatrix;
  isWinProbability: false;
  isEventProbability: false;
  isProbabilityCalibration: false;
  doesNotConfirmOrInvalidateLifecycleAlone: true;
  continuousResearchWorker: "DISABLED_BY_POLICY";
}

export interface HfmStrategyResearchCapabilityMatrix {
  datasetValidation: "REUSED_AND_VERIFIED" | "IMPLEMENTED";
  historicalSimulation: "REUSED_AND_VERIFIED" | "IMPLEMENTED";
  walkForward: "REUSED_AND_VERIFIED" | "IMPLEMENTED";
  costSensitivity: "IMPLEMENTED" | "PARTIALLY_IMPLEMENTED";
  regimeBreakdown: "IMPLEMENTED" | "PARTIALLY_IMPLEMENTED" | "UNAVAILABLE";
  eventPriceResearch: "IMPLEMENTED" | "FIXTURE_ONLY" | "NOT_IMPLEMENTED";
  continuousWorker: "DISABLED_BY_POLICY";
  brokerExecution: "DISABLED_BY_POLICY";
}

export interface AssessMifStrategyResearchInput {
  providerSymbol: string;
  timeframe: string;
  strategyId: string;
  strategyVersion?: string;
  datasetId?: string | null;
  /** Fixture OHLC bars for deterministic tests — never presented as live history. */
  fixtureBars?: readonly HfmResearchBarInput[];
  sourceMode?: HfmResearchSourceMode;
  /** Optional closed simulated trades for metric/regime/cost paths (fixture or reconstructed). */
  simulatedTrades?: readonly HfmSimulatedTradeInput[];
  regimeLabelsByTradeIndex?: readonly string[];
  /** Phase 07 events for event→price research (fixture or cache). */
  events?: readonly HfmEconomicEvent[];
  eventSourceMode?: HfmResearchSourceMode;
  walkForward?: Partial<HfmWalkForwardSummary> | null;
  reusedBacktestRunId?: string | null;
  costAssumption?: Partial<HfmCostAssumption> | null;
  costSensitivityGrid?: readonly Partial<HfmCostAssumption>[];
  assessmentTimestamp?: string;
  multipleComparisonsCount?: number;
}

export interface HfmResearchBarInput {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  forming?: boolean;
}

export interface HfmSimulatedTradeInput {
  direction: "BUY" | "SELL";
  entryPrice: number;
  exitPrice: number | null;
  entryTimeSec: number;
  exitTimeSec: number | null;
  unitReturn: number | null;
  status: "CLOSED" | "AMBIGUOUS" | "BREAKEVEN" | "OPEN" | "SKIPPED" | "INSUFFICIENT";
  exitReason: string | null;
  holdingBars: number | null;
  regimeLabel?: string | null;
}
