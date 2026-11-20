/**
 * Phase 5F STEP 4 — Backtesting & walk-forward types.
 */
import type { MifOutcomeEvaluationRecord } from "../production-integration/outcome-evaluation.js";
import type { MifPredictionOutcomeRecord, MifPredictionSnapshot } from "../prediction-outcome/types.js";
import type {
  MIF_BACKTEST_CONTRACT_ID,
  MIF_BACKTEST_CONTRACT_VERSION,
  MIF_BACKTEST_ENGINE_ID,
  MIF_BACKTEST_ENGINE_VERSION,
  MIF_BACKTEST_EXECUTION_MODEL_ID,
  MifBacktestPrimaryMetric,
} from "./contracts.js";

export interface MifBacktestSafetyFlags {
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  analyticalOutcomeOnly: true;
  doesNotApproveAiReasoning: true;
  isNotCalibratedProbability: true;
  costAdjusted: false;
  notExecutable: true;
  executionModel: typeof MIF_BACKTEST_EXECUTION_MODEL_ID;
}

export interface MifBacktestDatasetRef {
  datasetId: string;
  version: number;
  contentHash: string;
  instrument: string;
  timeframe: string;
  status: "COMPLETE" | "INCOMPLETE" | string;
}

export interface MifBacktestCostAvailabilityReport {
  spread: "SOURCE_BACKED" | "PARTIAL" | "CURRENT_METADATA_ONLY" | "UNAVAILABLE" | "NOT_CONSUMED";
  slippage: "UNAVAILABLE";
  commission: "UNAVAILABLE";
  swap: "UNAVAILABLE";
  suitableForCostAdjustedBacktest: false;
  costAdjusted: false;
  note: string;
}

export interface MifBacktestTipPrediction {
  tipOpenTimeSec: number;
  decisionTimeSec: number;
  candidateId: string;
  predictionId: string;
  snapshot: MifPredictionSnapshot;
  outcome: MifPredictionOutcomeRecord | null;
  outcomeError: string | null;
  skippedDuplicate: boolean;
  skippedOverlap: boolean;
}

export interface MifBacktestLedgerTrade {
  predictionId: string;
  tipOpenTimeSec: number;
  direction: string;
  entryPrice: number;
  exitPrice: number | null;
  unitReturn: number | null;
  status: "OPEN" | "CLOSED" | "AMBIGUOUS" | "INSUFFICIENT" | "SKIPPED";
  exitReason: string | null;
}

export interface MifBacktestEquityPoint {
  timeSec: number;
  equity: number;
  peakEquity: number;
  drawdown: number;
}

export interface MifBacktestLedgerSummary {
  policyId: string;
  policyVersion: string;
  implemented: true;
  initialCapital: number;
  riskFraction: number;
  maxPositions: number;
  trades: readonly MifBacktestLedgerTrade[];
  equityCurve: readonly MifBacktestEquityPoint[];
  finalEquity: number;
  peakEquity: number;
  maxDrawdown: number;
  grossExpectancy: number | null;
  profitFactor: number | null;
  closedTradeCount: number;
  skippedOverlapCount: number;
  note: string;
}

export interface MifBacktestMetricValue {
  value: number | null;
  availability: "AVAILABLE" | "INSUFFICIENT_SAMPLE" | "UNSUPPORTED" | "NOT_APPLICABLE";
  sampleCount: number;
  definition: string;
}

export interface MifBacktestAggregateMetrics {
  uniquePredictions: number;
  completeOutcomes: number;
  partialOutcomes: number;
  insufficientOutcomes: number;
  ambiguousCount: number;
  gapAffectedCount: number;
  levelFrequencies: Record<string, number>;
  pathForwardReturnMeanH4: MifBacktestMetricValue;
  pathForwardReturnMeanH8: MifBacktestMetricValue;
  pathForwardReturnMeanH16: MifBacktestMetricValue;
  mfeMeanH8: MifBacktestMetricValue;
  maeMeanH8: MifBacktestMetricValue;
  targetRate: MifBacktestMetricValue;
  sharpe: MifBacktestMetricValue;
  sortino: MifBacktestMetricValue;
}

export interface MifBacktestFoldInterval {
  label: "IS" | "VAL" | "OOS";
  startOpenTimeSec: number;
  endOpenTimeSec: number;
  tipCount: number;
}

export interface MifBacktestExclusion {
  tipOpenTimeSec: number;
  predictionId: string | null;
  reason: string;
}

export type MifBacktestFoldStatus =
  | "COMPLETE"
  | "INSUFFICIENT_SAMPLE"
  | "FAILED"
  | "SKIPPED";

export interface MifBacktestFoldResult {
  foldIndex: number;
  status: MifBacktestFoldStatus;
  failureReason: string | null;
  is: MifBacktestFoldInterval;
  val: MifBacktestFoldInterval | null;
  oos: MifBacktestFoldInterval;
  purgeBars: number;
  embargoBars: number;
  eligibleOosPredictions: number;
  decisiveOosSamples: number;
  minOosSamplesRequired: number;
  exclusions: readonly MifBacktestExclusion[];
  oosMetrics: MifBacktestAggregateMetrics;
  oosLedger: MifBacktestLedgerSummary | null;
  primaryMetric: MifBacktestPrimaryMetric;
  primaryMetricValue: number | null;
}

export interface MifBacktestRunManifest extends MifBacktestSafetyFlags {
  contractId: typeof MIF_BACKTEST_CONTRACT_ID;
  contractVersion: typeof MIF_BACKTEST_CONTRACT_VERSION;
  engineId: typeof MIF_BACKTEST_ENGINE_ID;
  engineVersion: typeof MIF_BACKTEST_ENGINE_VERSION;
  runId: string;
  runHash: string;
  createdAt: string;
  completedAt: string;
  elapsedMs: number;
  mode: "SINGLE_WINDOW" | "WALK_FORWARD";
  dataset: MifBacktestDatasetRef;
  primaryTimeframe: string;
  instrument: string;
  executionModelId: typeof MIF_BACKTEST_EXECUTION_MODEL_ID;
  executionModelVersion: string;
  walkForwardPolicyId: string | null;
  walkForwardPolicyVersion: string | null;
  snapshotPolicyVersion: string;
  evaluatorVersion: string;
  strategyVersionPin: string | null;
  detectorVersionPin: string | null;
  primaryMetric: MifBacktestPrimaryMetric;
  costAvailability: MifBacktestCostAvailabilityReport;
  assumptions: Record<string, unknown>;
  limitations: readonly string[];
  truncatedByMaxCandles: boolean;
  truncatedByMaxSteps: boolean;
  mtfClosureFilterApplied: true;
  tipCount: number;
  predictionCount: number;
  folds: readonly MifBacktestFoldResult[];
  aggregateMetrics: MifBacktestAggregateMetrics;
  ledger: MifBacktestLedgerSummary | null;
  status: "COMPLETE" | "INSUFFICIENT_SAMPLE" | "FAILED" | "PARTIAL";
  failureReason: string | null;
}

export interface MifBacktestRunRecord {
  manifest: MifBacktestRunManifest;
  tips: readonly MifBacktestTipPrediction[];
  levelOutcomes: readonly MifOutcomeEvaluationRecord[];
}
