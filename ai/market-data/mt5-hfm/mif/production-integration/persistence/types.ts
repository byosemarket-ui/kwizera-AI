/**
 * Phase 5D.6 — durable opportunity persistence records (JSON-file store).
 * No broker credentials. Analytical only.
 */
import type { MifProductionIntegrationResult } from "../types.js";
import type { MifOpportunityCandidate, MifDetectionOutcome } from "../../opportunity-detection/types.js";

export type MifCandidateLifecycleState =
  | "DETECTED"
  | "ACTIVE"
  | "NEEDS_CONFIRMATION"
  | "CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "COMPLETED"
  | "OUTCOME_UNKNOWN"
  | "REJECTED"
  | "INVALID";

export type MifCandidateOutcomeKind =
  | "NONE"
  | "INVALIDATION_REACHED"
  | "TARGET_REACHED"
  | "BOTH_AMBIGUOUS_SAME_CANDLE"
  | "EXPIRED_UNRESOLVED"
  | "OUTCOME_UNKNOWN";

export interface MifPersistedAnalysisRun {
  schemaVersion: "1.0.0";
  runId: string;
  requestId: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  requestedTimeframes: readonly string[];
  resolvedTimeframes: readonly string[];
  primaryTimeframe: string;
  marketDataTimestamp: string | null;
  analysisStartedAt: string;
  analysisCompletedAt: string;
  processingDurationMs: number;
  dataFreshness: string | null;
  dataQualityStatus: string;
  analysisStatus: string;
  candidateCount: number;
  contractId: string;
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  mtfRelation: string | null;
  warnings: readonly string[];
  errors: readonly string[];
  failureCodes: readonly string[];
  evidenceQualitySummary: Record<string, unknown> | null;
  /** Compact eligibility statuses only. */
  eligibility: readonly { strategyId: string; status: string }[];
  detectorOutcomes: readonly {
    strategyId: string;
    detectorId: string | null;
    status: string;
  }[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  /** Full result retained for audit (no secrets). */
  resultSnapshot: MifProductionIntegrationResult;
}

export interface MifPersistedLifecycleEvent {
  eventId: string;
  runId: string;
  candidateId: string;
  fromState: MifCandidateLifecycleState | null;
  toState: MifCandidateLifecycleState;
  reason: string;
  observationOpenTimeSec: number | null;
  observedAt: string;
  outcomeKind: MifCandidateOutcomeKind | null;
  notes: string;
}

export interface MifPersistedCandidate {
  schemaVersion: "1.0.0";
  candidateId: string;
  runId: string;
  strategyId: string;
  detectorId: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  direction: string;
  detectionStatus: string;
  lifecycleState: MifCandidateLifecycleState;
  timeframeRoles: readonly string[];
  assessmentTimestamp: string;
  createdAt: string;
  updatedAt: string;
  supportingEvidenceIds: readonly string[];
  conflictingEvidenceIds: readonly string[];
  requiredConfirmations: readonly string[];
  invalidationConditions: readonly string[];
  dataQualityStatus: string;
  mtfRelation: string | null;
  thesis: string;
  rationale: string;
  outcomeKind: MifCandidateOutcomeKind;
  /** Original candidate payload (immutable snapshot). */
  candidateSnapshot: MifOpportunityCandidate;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  notExecutable: true;
}

export interface MifCandidateListFilter {
  providerSymbol?: string;
  strategyId?: string;
  direction?: string;
  lifecycleState?: MifCandidateLifecycleState;
  fromIso?: string;
  toIso?: string;
  limit?: number;
  offset?: number;
}

export type { MifDetectionOutcome };
