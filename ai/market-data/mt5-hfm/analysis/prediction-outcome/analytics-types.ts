/**
 * P8.D — Performance Analytics types (read-only reporting).
 */
import type {
  HFM_CHARTS_CONFIDENCE_BUCKETS,
  HFM_CHARTS_POPULATION_MODES,
  HFM_CHARTS_TIME_BASIS,
} from "./contracts.js";
import type { HfmChartsDecisiveWinRate } from "./types.js";

export type HfmChartsTimeBasis = (typeof HFM_CHARTS_TIME_BASIS)[number];
export type HfmChartsPopulationMode = (typeof HFM_CHARTS_POPULATION_MODES)[number];
export type HfmChartsConfidenceBucket = (typeof HFM_CHARTS_CONFIDENCE_BUCKETS)[number];

export interface HfmChartsAnalyticsFilters {
  timeBasis: HfmChartsTimeBasis;
  populationMode: HfmChartsPopulationMode;
  startUtc: string | null;
  endUtc: string | null;
  symbol: string | null;
  timeframe: string | null;
  direction: string | null;
  evaluatorVersion: string | null;
  signedRPolicyVersion: string | null;
  confidenceBucket: HfmChartsConfidenceBucket | null;
}

export interface HfmChartsRateMetric {
  numerator: number;
  denominator: number;
  rate: number | null;
  unavailableReason: string | null;
}

export interface HfmChartsDistributionStats {
  count: number;
  mean: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  unavailable: number;
}

export interface HfmChartsSignedRStats extends HfmChartsDistributionStats {
  evaluatorVersion: string | null;
  signedRPolicyVersion: string | null;
  positive: number;
  negative: number;
  zero: number;
}

export interface HfmChartsBreakdownRow {
  key: string;
  observationCount: number;
  triggered: number;
  untriggered: number;
  targetReached: number;
  invalidationReached: number;
  ambiguousSameCandle: number;
  decisiveWinRate: HfmChartsDecisiveWinRate;
  triggerRate: HfmChartsRateMetric;
  signedRMean: number | null;
  signedRCount: number;
  maeMean: number | null;
  mfeMean: number | null;
  evaluatorVersion: string | null;
  signedRPolicyVersion: string | null;
  sampleWarning: "INSUFFICIENT_SAMPLE" | null;
  pitManifestId?: string | null;
  datasetId?: string | null;
  datasetContentHash?: string | null;
}

export interface HfmChartsOutcomeDistribution {
  TARGET_REACHED: number;
  INVALIDATION_REACHED: number;
  BOTH_AMBIGUOUS_SAME_CANDLE: number;
  UNTRIGGERED: number;
  EXPIRED_UNRESOLVED: number;
  STILL_ACTIVE: number;
  NO_OBSERVATION_WINDOW: number;
  OTHER: number;
}

export interface HfmChartsReasoningPopulationCounts {
  authority: "REASONING_STORE" | "UNAVAILABLE";
  unavailableReason: string | null;
  scanned: number;
  completed: number;
  failed: number;
  rejected: number;
  buy: number;
  sell: number;
  noTrade: number;
  waiting: number;
  withPredictionLinkage: number;
  withoutPredictionLinkage: number;
  timeBasis: "reasoning.createdAt";
}

export interface HfmChartsPerformanceAnalyticsReport {
  schemaVersion: string;
  contractId: string;
  contractVersion: string;
  policyId: string;
  policyVersion: string;
  summaryId: string;
  generatedAt: string;
  filters: HfmChartsAnalyticsFilters;
  populationMode: HfmChartsPopulationMode;
  timeBasis: HfmChartsTimeBasis;
  population: {
    rawEvaluationRecords: number;
    selectedEvaluations: number;
    excludedByFilter: number;
    excludedMissingTimestamp: number;
    eligibleDirectional: number;
    triggered: number;
    untriggered: number;
    evaluated: number;
  };
  trigger: HfmChartsRateMetric;
  winRate: HfmChartsDecisiveWinRate;
  outcomeDistribution: HfmChartsOutcomeDistribution;
  /** Backward-compatible P8.C flat fields. */
  eligibleDirectionalPredictions: number;
  triggered: number;
  untriggered: number;
  expiredUnresolved: number;
  targetReached: number;
  invalidationReached: number;
  ambiguousSameCandle: number;
  stillActive: number;
  noObservationWindow: number;
  decisiveWinRate: HfmChartsDecisiveWinRate;
  signedR: HfmChartsSignedRStats;
  mae: HfmChartsDistributionStats;
  mfe: HfmChartsDistributionStats;
  maeSampleCount: number;
  mfeSampleCount: number;
  maeMean: number | null;
  mfeMean: number | null;
  breakdowns: {
    symbol: HfmChartsBreakdownRow[];
    timeframe: HfmChartsBreakdownRow[];
    direction: HfmChartsBreakdownRow[];
    setupFingerprint: HfmChartsBreakdownRow[];
    analyticalConfidence: HfmChartsBreakdownRow[];
    pitManifest?: HfmChartsBreakdownRow[];
  };
  analyticalConfidenceLabel: string;
  reasoningCounts: HfmChartsReasoningPopulationCounts;
  warnings: string[];
  note: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  isNotCalibratedProbability: true;
  notBrokerAccountPnl: true;
  scheduledWorker: false;
  totalCompletedAnalyses: number | null;
  noTradeSkipped: number | null;
  waitingSkipped: number | null;
}
