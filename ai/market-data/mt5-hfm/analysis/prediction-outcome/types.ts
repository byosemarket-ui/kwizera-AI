/**
 * P8.C — Charts prediction outcome evaluation types.
 */
import type { MifOutcomeEvaluationRecord } from "../../mif/production-integration/outcome-evaluation.js";
import type {
  MifPredictionOutcomeRecord,
  MifPredictionPathOutcome,
  MifPredictionSnapshot,
} from "../../mif/prediction-outcome/types.js";
import type {
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
} from "./contracts.js";

export interface HfmChartsEntryZone {
  low: number;
  high: number;
}

export type HfmChartsEntryTriggerStatus = "TRIGGERED" | "UNTRIGGERED";

export type HfmChartsPredictionResultKind =
  | "UNTRIGGERED"
  | "TARGET_REACHED"
  | "INVALIDATION_REACHED"
  | "BOTH_AMBIGUOUS_SAME_CANDLE"
  | "EXPIRED_UNRESOLVED"
  | "STILL_ACTIVE"
  | "NO_OBSERVATION_WINDOW"
  | "INSUFFICIENT_HISTORICAL_EVIDENCE"
  | "LEVELS_NOT_PROVIDED"
  | "AMBIGUOUS_OUTCOME"
  | "REJECTED";

export interface HfmChartsEntryTriggerRecord {
  policyId: string;
  policyVersion: string;
  status: HfmChartsEntryTriggerStatus;
  entryZone: HfmChartsEntryZone;
  entryZoneSource: "REQUEST_OVERRIDE" | "SNAPSHOT_STRUCTURED_ENTRY_POINT";
  touchRule: string;
  activationOpenTimeSec: number;
  /** First CLOSED candle after activation that intersects the entry zone. */
  triggerOpenTimeSec: number | null;
  triggerCloseTimeSec: number | null;
  triggerReferencePrice: number | null;
  /** Conservative: trigger candle is never used for TP/SL ordering. */
  triggerCandleExcludedFromLevelEval: true;
  barsScannedForTrigger: number;
  reason: string | null;
}

export interface HfmChartsPredictionEvaluationProvenance {
  predictionId: string;
  snapshotHash: string;
  analysisRunId: string | null;
  sourceAnalysisIdentity: string | null;
  scenarioId: string | null;
  setupFingerprint: string | null;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  symbol: string;
  timeframe: string;
  direction: string;
  /** Canonical 0–100 analytical confidence, or null when unavailable. */
  analyticalConfidence: number | null;
  /** P8.E F1 — original reasoning confidence value before normalization. */
  rawAnalyticalConfidence?: number | string | null;
  /** P8.E F1 — scale classification from normalizer. */
  confidenceScale?: "zero" | "fraction" | "percent" | "invalid" | null;
  /** P8.E F1 — production uses REASONING_STORE | UNAVAILABLE only. */
  confidenceSource?: "REASONING_STORE" | "UNAVAILABLE" | "TEST_OVERRIDE" | null;
  /** P8.E F1 — analysisId used for reasoning join. */
  confidenceAnalysisId?: string | null;
  /** P8.E F1 — operational normalize timestamp (not part of immutable equality). */
  confidenceNormalizedAt?: string | null;
  /** P8.E F1 — non-probability semantics stamp. */
  confidenceSemantics?: "NON_PROBABILITY_ANALYTICAL_SCORE";
  /** P8.E F1 — why confidence is unavailable / excluded from calibration. */
  confidenceUnavailableReason?:
    | "MISSING_ANALYSIS_RUN_ID"
    | "REASONING_RECORD_NOT_FOUND"
    | "REASONING_ANALYSIS_ID_MISMATCH"
    | "CONFIDENCE_MISSING"
    | "CONFIDENCE_INVALID"
    | "TEST_OVERRIDE_INVALID"
    | null;
  pitManifestId: string;
  pitManifestContentIdentityHash: string;
  datasetId: string;
  datasetVersion: number;
  datasetContentHash: string;
  candleRangeHash: string;
  evaluatorVersion: typeof HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION;
  entryTriggerPolicyVersion: string;
  signedRPolicyVersion: string;
}

export interface HfmChartsPredictionEvaluationRecord {
  contractId: typeof HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID;
  contractVersion: typeof HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION;
  evaluatorId: typeof HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_ID;
  evaluatorVersion: typeof HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION;
  evaluationId: string;
  predictionId: string;
  snapshotHash: string;
  resultKind: HfmChartsPredictionResultKind;
  entryTrigger: HfmChartsEntryTriggerRecord;
  /** Direction-aware signed R; null when non-decisive or ambiguous. */
  realizedSignedRMultiple: number | null;
  signedRDefinition: string;
  signedRPolicyVersion: string;
  /** Canonical risk level for P8.C. */
  invalidationPrice: number | null;
  entryPrice: number | null;
  targetPrice: number | null;
  exitPrice: number | null;
  mae: number | null;
  mfe: number | null;
  observationCandleCount: number;
  evaluationStartOpenTimeSec: number | null;
  evaluationEndOpenTimeSec: number | null;
  provenance: HfmChartsPredictionEvaluationProvenance;
  levelOutcome: MifOutcomeEvaluationRecord | null;
  pathOutcome: MifPredictionPathOutcome | null;
  /** Optional embedded MIF outcome (P8.C evaluator version); never rewrites 1.0.0 records. */
  mifOutcome: MifPredictionOutcomeRecord | null;
  computationTimestamp: string;
  analyticalOhlcOnly: true;
  notBrokerAccountPnl: true;
  isNotCalibratedProbability: true;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  notExecutable: true;
}

export interface HfmChartsDecisiveWinRate {
  numerator: number;
  denominator: number;
  /** TARGET_REACHED / (TARGET_REACHED + INVALIDATION_REACHED); null when denominator = 0. */
  winRate: number | null;
  unavailableReason: string | null;
}

export interface HfmChartsPredictionPerformanceSummary {
  contractId: typeof HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID;
  contractVersion: typeof HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION;
  policyId: string;
  policyVersion: string;
  summaryId: string;
  totalCompletedAnalyses: number | null;
  eligibleDirectionalPredictions: number;
  triggered: number;
  untriggered: number;
  expiredUnresolved: number;
  targetReached: number;
  invalidationReached: number;
  ambiguousSameCandle: number;
  stillActive: number;
  noObservationWindow: number;
  noTradeSkipped: number | null;
  waitingSkipped: number | null;
  decisiveWinRate: HfmChartsDecisiveWinRate;
  maeSampleCount: number;
  mfeSampleCount: number;
  maeMean: number | null;
  mfeMean: number | null;
  note: string;
  computedAt: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  isNotCalibratedProbability: true;
  notBrokerAccountPnl: true;
}

export interface HfmChartsEvaluatePredictionInput {
  predictionId: string;
  datasetId: string;
  datasetVersion?: number;
  expectedContentHash?: string | null;
  /** Optional entry-zone override from Charts tradePlan.entryZone. */
  entryZone?: HfmChartsEntryZone | null;
  /** Optional lineage enrichment (not required for evaluation correctness). */
  scenarioId?: string | null;
  setupFingerprint?: string | null;
  evidencePackageId?: string | null;
  scenarioPackageId?: string | null;
  /**
   * @deprecated Production API ignores this. Use testOnly* fields in unit tests only.
   */
  analyticalConfidence?: number | null;
  /**
   * Test-only. When true, uses testOnlyAnalyticalConfidenceOverride instead of
   * reasoning-store resolution. Production API must never set this.
   */
  testOnlyAllowConfidenceOverride?: boolean;
  /** Test-only override value; ignored unless testOnlyAllowConfidenceOverride is true. */
  testOnlyAnalyticalConfidenceOverride?: number | null;
  horizons?: readonly number[];
  maxAgeBars?: number;
  persist?: boolean;
  /** Injected snapshot for tests. */
  snapshot?: MifPredictionSnapshot | null;
  /** Injected reasoning storage for tests. */
  reasoningStorage?: unknown;
  evaluationTimestamp?: string;
}
