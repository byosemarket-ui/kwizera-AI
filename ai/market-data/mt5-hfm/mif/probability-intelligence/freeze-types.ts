/**
 * Phase 5F STEP 5 Phase B — probability freeze types.
 */
import type { MifSafetyFlags } from "../canonical/types.js";
import type {
  MIF_PROBABILITY_FREEZE_CONTRACT_ID,
  MIF_PROBABILITY_FREEZE_CONTRACT_VERSION,
  MIF_PROBABILITY_FREEZE_SCALE,
} from "./freeze-contracts.js";
import type {
  MifCalibrationStatus,
  MifProbabilityAssessment,
  MifProbabilityTargetEvent,
} from "./types.js";

/** Assessment linkage without a valid freeze. */
export type MifProbabilityFreezeLifecycle =
  | "FROZEN"
  | "UNFROZEN"
  | "NOT_CALIBRATED";

/**
 * Phase B never claims calibrated models from freezes alone.
 * Research Results / status use these claims only.
 */
export type MifFreezeCalibrationClaim = "NOT_CALIBRATED" | "INSUFFICIENT_DATA";

/**
 * How predictedAt was established. WF calibration requires HIGH trust.
 * ASSESSMENT_CALCULATED_AT alone is LIMITED — may be assigned after the fact.
 */
export type MifPredictionTimeProvenanceKind =
  | "EXPLICIT_PREDICTION_AVAILABLE_AT"
  | "SNAPSHOT_ACTIVATION"
  | "ASSESSMENT_CALCULATED_AT_LIMITED";

export type MifProvenanceTrust = "HIGH" | "LIMITED";

export interface MifProbabilityFreezeRecord extends MifSafetyFlags {
  contractId: typeof MIF_PROBABILITY_FREEZE_CONTRACT_ID;
  contractVersion: typeof MIF_PROBABILITY_FREEZE_CONTRACT_VERSION;
  /** Deterministic immutable identity for this freeze content. */
  freezeId: string;
  freezeHash: string;
  revisionOrdinal: number;
  /** Prior freezeId when this is an explicit correction revision. */
  supersedesFreezeId: string | null;
  revisionReason: string | null;
  assessmentId: string;
  /** Optional link; never invented when absent. */
  predictionId: string | null;
  candidateId: string;
  analysisRunId: string | null;
  /** Frozen probability in [0,1]. */
  probability: number;
  probabilityScale: typeof MIF_PROBABILITY_FREEZE_SCALE;
  /**
   * Trusted prediction-time timestamp (never wall-clock now).
   * Source depends on predictionTimeProvenance.
   */
  predictedAt: string;
  /** Raw assessment.calculatedAt retained for audit (may differ from predictedAt). */
  assessmentCalculatedAt: string;
  predictionTimeProvenance: MifPredictionTimeProvenanceKind;
  provenanceTrust: MifProvenanceTrust;
  /** Snapshot activation ISO when SNAPSHOT_ACTIVATION provenance was used. */
  snapshotActivationAt: string | null;
  /** When the freeze record was persisted (metadata only). */
  frozenAt: string;
  targetEvent: MifProbabilityTargetEvent;
  targetEventDefinition: string;
  policyId: string;
  policyVersion: string;
  engineId: string;
  engineVersion: string;
  assessmentEngineVersion: string;
  assessmentPolicyVersion: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  direction: string;
  primaryTimeframe: string | null;
  evaluationHorizonBars: number | null;
  sourceDatasetId: string | null;
  sourceDatasetVersion: number | null;
  sourceContentHash: string | null;
  /** Snapshot of assessment calibrationStatus at freeze time (informational). */
  calibrationStatusAtFreeze: MifCalibrationStatus;
  freezeStatus: "FROZEN";
  /** Always NOT_CALIBRATED for Phase B freezes. */
  calibrationClaim: "NOT_CALIBRATED";
  isCalibratedProbability: false;
  isWalkForwardCalibrated: false;
  inputIdentity: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  analyticalFreezeOnly: true;
  notExecutable: true;
}

export interface MifProbabilityFreezeBuildInput {
  assessment: MifProbabilityAssessment;
  /** Optional prediction link — never invented. */
  predictionId?: string | null;
  /**
   * Explicit time the probability was available to the system.
   * Preferred provenance — never invented; never replaced with now.
   */
  predictionAvailableAt?: string | null;
  /**
   * Snapshot activation timestamp (ISO). When provided with predictionId,
   * establishes HIGH-trust SNAPSHOT_ACTIVATION provenance if assessment.calculatedAt
   * does not post-date activation.
   */
  snapshotActivationAt?: string | null;
  /**
   * If the outcome is already resolved, must be strictly after predictedAt.
   * Omit when outcome not yet resolved.
   */
  outcomeResolvedAt?: string | null;
  sourceDatasetId?: string | null;
  sourceDatasetVersion?: number | null;
  sourceContentHash?: string | null;
  /** Metadata timestamp for freeze persistence; does NOT replace predictedAt. */
  frozenAt?: string;
  revisionOrdinal?: number;
  supersedesFreezeId?: string | null;
  revisionReason?: string | null;
}

export type MifProbabilityFreezeBuildResult =
  | { ok: true; freeze: MifProbabilityFreezeRecord }
  | { ok: false; code: string; message: string };

export interface MifAssessmentFreezeStatus {
  assessmentId: string;
  lifecycle: MifProbabilityFreezeLifecycle;
  freezeId: string | null;
  predictionId: string | null;
  calibrationClaim: MifFreezeCalibrationClaim;
  reasons: readonly string[];
}
