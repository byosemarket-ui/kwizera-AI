/**
 * Phase 5F STEP 5 Phase C — WF-aware calibration types.
 */
import type { MifSafetyFlags } from "../canonical/types.js";
import type { MifBacktestFoldResult } from "../backtesting/types.js";
import type {
  MIF_WF_CALIBRATION_CONTRACT_ID,
  MIF_WF_CALIBRATION_CONTRACT_VERSION,
} from "./contracts.js";

export type MifWfCalibrationStatus =
  | "UNFROZEN"
  | "NOT_CALIBRATED"
  | "INSUFFICIENT_DATA"
  | "PROVISIONAL_EVALUATION"
  | "CALIBRATION_EVALUATED"
  | "CALIBRATED"
  | "REJECTED_TEMPORAL_LEAKAGE"
  | "INCOMPATIBLE_TARGET_EVENT"
  | "INVALID_PROVENANCE";

export type MifWfFoldRole = "IS" | "VAL" | "OOS" | "PURGE_EXCLUDED" | "EMBARGO_EXCLUDED" | "OUTSIDE";

export type MifWfExclusionReason =
  | "NO_FREEZE"
  | "LIMITED_PROVENANCE"
  | "MISSING_PREDICTION_ID"
  | "NO_DECISIVE_OUTCOME"
  | "AMBIGUOUS_OUTCOME"
  | "EXPIRED_OUTCOME"
  | "MISSING_LEVELS"
  | "UNSUPPORTED_DIRECTION"
  | "INCOMPATIBLE_TARGET_EVENT"
  | "INVALID_TIMESTAMPS"
  | "TEMPORAL_LEAKAGE"
  | "DUPLICATE_PREDICTION"
  | "SUPERSEDED_REVISION"
  | "HORIZON_CROSSES_OOS_BOUNDARY"
  | "OUTCOME_IN_TRAINING_WINDOW"
  | "MISSING_FOLD_BOUNDARIES"
  | "WRONG_PROVIDER"
  | "INCOMPLETE_OUTCOME"
  | "PURGE_EXCLUDED"
  | "EMBARGO_EXCLUDED"
  | "OTHER";

export interface MifWfCalibrationObservation {
  freezeId: string;
  assessmentId: string;
  predictionId: string;
  candidateId: string;
  probability: number;
  predictedAt: string;
  resolvedAt: string;
  outcome: 0 | 1;
  levelResultKind: "TARGET_REACHED" | "INVALIDATION_REACHED";
  tipOpenTimeSec: number | null;
  foldIndex: number;
  foldRole: MifWfFoldRole;
  provenanceTrust: "HIGH" | "LIMITED";
  evaluationHorizonBars: number | null;
  sourceDatasetId: string | null;
  sourceContentHash: string | null;
}

export interface MifWfExcludedObservation {
  freezeId: string | null;
  assessmentId: string | null;
  predictionId: string | null;
  reason: MifWfExclusionReason;
  detail: string;
}

export interface MifWfReliabilityBin {
  binIndex: number;
  predictedMean: number;
  observedFrequency: number;
  count: number;
}

export interface MifWfCalibrationMetrics {
  brierScore: number | null;
  logLoss: number | null;
  expectedCalibrationError: number | null;
  maximumCalibrationError: number | null;
  mceSuppressedReason: string | null;
  reliabilityBins: readonly MifWfReliabilityBin[];
  sampleCount: number;
  positiveCount: number;
  negativeCount: number;
  classBalance: { positiveRate: number | null; negativeRate: number | null };
  binningPolicyId: string;
  binningPolicyVersion: string;
  logLossEps: number;
  notes: readonly string[];
}

export interface MifWfFoldCalibrationResult {
  foldIndex: number;
  status: MifWfCalibrationStatus;
  fold: Pick<
    MifBacktestFoldResult,
    "is" | "val" | "oos" | "purgeBars" | "embargoBars" | "status"
  >;
  trainingInterval: {
    fromOpenTimeSec: number;
    toOpenTimeSec: number;
    fromIso: string;
    toIso: string;
  };
  evaluationInterval: {
    fromOpenTimeSec: number;
    toOpenTimeSec: number;
    fromIso: string;
    toIso: string;
  };
  includedCount: number;
  excludedCount: number;
  metrics: MifWfCalibrationMetrics | null;
  reasons: readonly string[];
}

export interface MifWfCalibrationRun extends MifSafetyFlags {
  contractId: typeof MIF_WF_CALIBRATION_CONTRACT_ID;
  contractVersion: typeof MIF_WF_CALIBRATION_CONTRACT_VERSION;
  runId: string;
  runHash: string;
  engineId: string;
  engineVersion: string;
  createdAt: string;
  backtestRunId: string;
  backtestRunHash: string;
  datasetId: string | null;
  datasetContentHash: string | null;
  mode: "WALK_FORWARD" | "SINGLE_WINDOW";
  status: MifWfCalibrationStatus;
  statusReasons: readonly string[];
  targetEvent: string;
  provisionalThreshold: number;
  calibratedThreshold: number;
  totalEligibleObservations: number;
  totalExcluded: number;
  exclusionBreakdown: Record<string, number>;
  folds: readonly MifWfFoldCalibrationResult[];
  /** Metrics aggregated over OOS-eligible observations only (never used for fitting). */
  oosAggregateMetrics: MifWfCalibrationMetrics | null;
  modelFitPerformed: false;
  walkForwardCalibrated: boolean;
  midSplitScaffoldingNotUsed: true;
  isNotCalibratedProbability: true;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  notExecutable: true;
}

export interface MifWfCalibrationEvidenceDoc {
  runId: string;
  included: readonly MifWfCalibrationObservation[];
  excluded: readonly MifWfExcludedObservation[];
}
