/**
 * Phase 5F STEP 3 — Prediction Outcome types.
 */
import type { MifOutcomeEvaluationRecord } from "../production-integration/outcome-evaluation.js";
import type {
  MIF_PREDICTION_DIRECTIONS,
  MIF_PREDICTION_ENTRY_REFERENCE_KINDS,
  MIF_PREDICTION_HORIZON_COMPLETENESS,
  MIF_PREDICTION_LEVEL_PARSE_PROVENANCE,
  MIF_PREDICTION_MARKET_SOURCE_MODES,
  MIF_PREDICTION_OUTCOME_CONTRACT_ID,
  MIF_PREDICTION_OUTCOME_CONTRACT_VERSION,
  MIF_PREDICTION_OUTCOME_ENGINE_ID,
  MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
  MIF_PREDICTION_SNAPSHOT_POLICY_ID,
  MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
} from "./contracts.js";

export type MifPredictionDirection = (typeof MIF_PREDICTION_DIRECTIONS)[number];
export type MifPredictionMarketSourceMode =
  (typeof MIF_PREDICTION_MARKET_SOURCE_MODES)[number];
export type MifPredictionHorizonCompleteness =
  (typeof MIF_PREDICTION_HORIZON_COMPLETENESS)[number];
export type MifPredictionEntryReferenceKind =
  (typeof MIF_PREDICTION_ENTRY_REFERENCE_KINDS)[number];
export type MifPredictionLevelParseProvenance =
  (typeof MIF_PREDICTION_LEVEL_PARSE_PROVENANCE)[number];

export interface MifPredictionSafetyFlags {
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  analyticalOutcomeOnly: true;
  doesNotApproveAiReasoning: true;
  isNotCalibratedProbability: true;
  notExecutable: true;
}

export interface MifPredictionLevelRef {
  price: number | null;
  side: "ABOVE" | "BELOW" | null;
  present: boolean;
}

export interface MifPredictionLevels {
  entry: MifPredictionLevelRef;
  target: MifPredictionLevelRef;
  invalidation: MifPredictionLevelRef;
  parseProvenance: MifPredictionLevelParseProvenance;
  /** Original evidence strings preserved; never discarded when parsing. */
  originalEvidence: readonly string[];
}

export interface MifPredictionHistoricalProvenance {
  mode: "HISTORICAL_ARCHIVE";
  providerId: "HFM_MT5";
  datasetId: string;
  datasetVersion: number;
  contentHash: string;
}

export interface MifPredictionLiveProvenance {
  mode: "LIVE_COPYRATES";
  providerId: "HFM_MT5";
  sourceProvenance: string;
  snapshotId: string | null;
  sequenceId: string | null;
  sourceMode: string | null;
}

export type MifPredictionMarketProvenance =
  | MifPredictionHistoricalProvenance
  | MifPredictionLiveProvenance
  | {
      mode: "UNBOUND";
      providerId: "HFM_MT5";
      note: string;
    };

export interface MifPredictionReferenceCandleIdentity {
  openTimeSec: number;
  close: number | null;
  timeframe: string;
  providerSymbol: string;
}

/**
 * Immutable prediction identity boundary.
 * candidateId alone is NOT unique across reasoning runs.
 */
export interface MifPredictionSnapshot extends MifPredictionSafetyFlags {
  contractId: typeof MIF_PREDICTION_OUTCOME_CONTRACT_ID;
  contractVersion: typeof MIF_PREDICTION_OUTCOME_CONTRACT_VERSION;
  snapshotPolicyId: typeof MIF_PREDICTION_SNAPSHOT_POLICY_ID;
  snapshotPolicyVersion: typeof MIF_PREDICTION_SNAPSHOT_POLICY_VERSION;
  predictionId: string;
  snapshotHash: string;
  candidateId: string;
  reasoningRunId: string | null;
  evaluationId: string | null;
  analysisRunId: string | null;
  createdAt: string;
  activationTimestamp: string | null;
  activationOpenTimeSec: number;
  instrument: string;
  timeframe: string;
  direction: MifPredictionDirection;
  levels: MifPredictionLevels;
  modelVersion: string | null;
  strategyVersion: string | null;
  strategyId: string | null;
  detectorId: string | null;
  sourceAnalysisIdentity: string | null;
  marketProvenance: MifPredictionMarketProvenance;
  referenceCandle: MifPredictionReferenceCandleIdentity | null;
  /** When true, activation close may be used as entry if structured entry missing. */
  allowActivationCloseAsEntry: true;
  status: "FROZEN" | "INVALID_INSUFFICIENT";
  invalidReason: string | null;
}

export interface MifPredictionPathHorizonMetric {
  requestedHorizon: number;
  availableCandles: number;
  requiredCandles: number;
  completeness: MifPredictionHorizonCompleteness;
  forwardReturn: number | null;
  mfe: number | null;
  mae: number | null;
  lastObservedOpenTimeSec: number | null;
  gapFlags: readonly string[];
  entryReferenceKind: MifPredictionEntryReferenceKind;
  entryPrice: number | null;
  evaluationRange: {
    firstOpenTimeSec: number | null;
    lastOpenTimeSec: number | null;
    barCount: number;
  };
  resultStatus: MifPredictionHorizonCompleteness;
}

export interface MifPredictionPathOutcome {
  policyId: string;
  policyVersion: string;
  direction: MifPredictionDirection;
  entryReferenceKind: MifPredictionEntryReferenceKind;
  entryPrice: number | null;
  activationClose: number | null;
  horizons: readonly MifPredictionPathHorizonMetric[];
  observationWindow: {
    activationOpenTimeSec: number;
    firstFutureOpenTimeSec: number | null;
    lastFutureOpenTimeSec: number | null;
    futureBarCount: number;
  };
  gapDetected: boolean;
  gapFlags: readonly string[];
  unsupportedReason: string | null;
}

export interface MifPredictionDataQuality {
  closedOnly: true;
  activationExcluded: true;
  gapDetected: boolean;
  gapFlags: readonly string[];
  duplicateBarsRejected: number;
  outOfOrderRejected: number;
  formingRejected: number;
  staleRejected: number;
  closureUnverifiedRejected: number;
  missingIntervals: readonly string[];
  tipClipped: boolean;
  futureBarsExcluded: number;
}

export interface MifPredictionOutcomeRecord extends MifPredictionSafetyFlags {
  contractId: typeof MIF_PREDICTION_OUTCOME_CONTRACT_ID;
  contractVersion: typeof MIF_PREDICTION_OUTCOME_CONTRACT_VERSION;
  engineId: typeof MIF_PREDICTION_OUTCOME_ENGINE_ID;
  engineVersion: typeof MIF_PREDICTION_OUTCOME_ENGINE_VERSION;
  outcomeId: string;
  predictionId: string;
  snapshotHash: string;
  policyVersion: string;
  evaluatorVersion: string;
  marketSourceMode: MifPredictionMarketSourceMode;
  marketProvenance: MifPredictionMarketProvenance;
  evaluatedCandleRange: {
    firstOpenTimeSec: number | null;
    lastOpenTimeSec: number | null;
    barCount: number;
  };
  candleRangeHash: string;
  requestedHorizons: readonly number[];
  pathOutcome: MifPredictionPathOutcome;
  /** Distinct from path metrics — level-based 5D.7 evaluation. */
  levelOutcome: MifOutcomeEvaluationRecord;
  dataQuality: MifPredictionDataQuality;
  completeness: "COMPLETE" | "PARTIAL" | "INSUFFICIENT";
  computationTimestamp: string;
  revisionOrdinal: number;
}

export interface MifPredictionPerformanceWarnings {
  historicalPitMetadataLimited: true;
  historicalTransactionCostsIncomplete: true;
  resultsNotCostAdjusted: true;
  historicalCoverageShallow: true;
  doesNotGuaranteeFuturePerformance: true;
  isNotCalibratedProbability: true;
}

export interface MifPredictionDistributionStats {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  stdev: number | null;
}

export interface MifPredictionPerformanceGroupKey {
  instrument: string | null;
  timeframe: string | null;
  direction: MifPredictionDirection | null;
  horizon: number | null;
  modelVersion: string | null;
  strategyVersion: string | null;
  marketSourceMode: MifPredictionMarketSourceMode | null;
  outcomeStatus: string | null;
  dateFromIso: string | null;
  dateToIso: string | null;
}

export interface MifPredictionPerformanceSummary extends MifPredictionSafetyFlags {
  contractId: typeof MIF_PREDICTION_OUTCOME_CONTRACT_ID;
  contractVersion: typeof MIF_PREDICTION_OUTCOME_CONTRACT_VERSION;
  policyId: string;
  policyVersion: string;
  summaryId: string;
  groupKey: MifPredictionPerformanceGroupKey;
  totalUniquePredictions: number;
  completeOutcomes: number;
  partialOutcomes: number;
  insufficientOutcomes: number;
  missingLevelCount: number;
  ambiguousTargetInvalidationCount: number;
  gapAffectedCount: number;
  unsupportedDirectionCount: number;
  levelOutcomeFrequencies: Record<string, number>;
  pathDistributions: {
    horizon: number;
    forwardReturn: MifPredictionDistributionStats;
    mfe: MifPredictionDistributionStats;
    mae: MifPredictionDistributionStats;
    completeHorizonCount: number;
    partialHorizonCount: number;
    insufficientHorizonCount: number;
  }[];
  warnings: MifPredictionPerformanceWarnings;
  computedAt: string;
  note: string;
}

export interface MifPredictionSnapshotBuildInput {
  candidateId: string;
  reasoningRunId?: string | null;
  evaluationId?: string | null;
  analysisRunId?: string | null;
  /** Authoritative activation candle open time. Required. */
  activationOpenTimeSec?: number | null;
  activationTimestamp?: string | null;
  instrument: string;
  timeframe: string;
  direction?: string | null;
  /** Optional structured levels (preferred over note parsing). */
  entryPrice?: number | null;
  entrySide?: "ABOVE" | "BELOW" | null;
  targetPrice?: number | null;
  targetSide?: "ABOVE" | "BELOW" | null;
  invalidationPrice?: number | null;
  invalidationSide?: "ABOVE" | "BELOW" | null;
  /** Legacy note strings for parse-at-boundary. */
  invalidationConditions?: readonly string[] | null;
  requiredConfirmations?: readonly string[] | null;
  thesis?: string | null;
  rationale?: string | null;
  modelVersion?: string | null;
  strategyVersion?: string | null;
  strategyId?: string | null;
  detectorId?: string | null;
  sourceAnalysisIdentity?: string | null;
  marketProvenance?: MifPredictionMarketProvenance | null;
  referenceCandle?: MifPredictionReferenceCandleIdentity | null;
  createdAt?: string;
}
