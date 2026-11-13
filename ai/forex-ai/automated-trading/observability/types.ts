/**
 * Phase 4 — AT observability types (boot, health, recovery, correlation).
 * Never authorizes broker execution.
 */

export const AT_PHASE4_OBSERVABILITY_SCHEMA = "at-phase4-observability-v1" as const;
export const AT_BOOT_AUDIT_SCHEMA = "at-boot-audit-v1" as const;
export const AT_RECOVERY_EVENT_SCHEMA = "at-recovery-event-v1" as const;

export type AtHealthState =
  | "HEALTHY"
  | "STARTING"
  | "STOPPING"
  | "STOPPED"
  | "DISABLED"
  | "BLOCKED"
  | "DEGRADED"
  | "DISCONNECTED"
  | "STALE"
  | "RECOVERING"
  | "FAILED"
  | "UNKNOWN";

export type AtRecoveryClass =
  | "RECOVERABLE_TRANSIENT"
  | "RECOVERABLE_PROVIDER"
  | "MARKET_CLOSED_NO_RETRY_STORM"
  | "OWNER_ACTION_REQUIRED"
  | "SAFETY_LOCK"
  | "NON_RECOVERABLE"
  | "NONE";

export type AtRecoveryAction =
  | "NOOP"
  | "BOUNDED_RETRY"
  | "REVALIDATE_QUOTE"
  | "RECONNECT_READONLY"
  | "STOP_OWNED_WORKERS"
  | "REQUEST_OWNER_INTERVENTION"
  | "KEEP_EXECUTION_BLOCKED";

export type AtModuleHealthId =
  | "gateway"
  | "storage"
  | "system_master"
  | "forexconnect_sidecar"
  | "forexconnect_session"
  | "xau_offer"
  | "quote_freshness"
  | "candle_service"
  | "scheduler"
  | "monitoring_worker"
  | "openai_provider"
  | "analysis_engine"
  | "result_intake"
  | "proposal_engine"
  | "risk_engine"
  | "precheck"
  | "payload_builder"
  | "handoff"
  | "execution_boundary";

export interface AtModuleHealthRow {
  id: AtModuleHealthId;
  label: string;
  state: AtHealthState;
  ready: boolean;
  live: boolean;
  detail: string;
  code: string | null;
  updatedAtUtc: string | null;
}

export interface AtObservabilityAlert {
  id: string;
  component: AtModuleHealthId | "pipeline" | "boot" | "recovery";
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  code: string;
  message: string;
  suggestedAction: string;
  correlationId: string | null;
  atUtc: string;
  placesOrders: false;
  mutatesBroker: false;
}

export interface AtCorrelationChain {
  schemaVersion: typeof AT_PHASE4_OBSERVABILITY_SCHEMA;
  bootId: string | null;
  systemMasterTransitionId: string | null;
  analysisGeneration: number | null;
  workerRunId: string | null;
  schedulerRunId: string | null;
  marketSnapshotId: string | null;
  analysisId: string | null;
  intakeId: string | null;
  proposalId: string | null;
  riskDecisionId: string | null;
  precheckId: string | null;
  payloadId: string | null;
  handoffId: string | null;
  executionBoundaryDecisionId: string | null;
  phase2Status: string | null;
  phase3Status: string | null;
  boundaryStatus: "EXECUTION_BLOCKED" | null;
  boundaryReason: string | null;
  instrument: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface AtBootAuditRecord {
  schemaVersion: typeof AT_BOOT_AUDIT_SCHEMA;
  bootId: string;
  startedAtUtc: string;
  completedAtUtc: string | null;
  status: "STARTED" | "COMPLETED" | "FAILED" | "COMPLETED_WITH_WARNINGS";
  systemMasterOwnerState: "ON" | "OFF" | "UNKNOWN";
  analysisScheduleResumed: boolean;
  monitorEnabled: boolean;
  blockers: string[];
  steps: Array<{
    step: string;
    ok: boolean;
    code: string | null;
    detail: string;
    atUtc: string;
  }>;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface AtRecoveryDecision {
  schemaVersion: typeof AT_RECOVERY_EVENT_SCHEMA;
  eventId: string;
  classification: AtRecoveryClass;
  action: AtRecoveryAction;
  retryAllowed: boolean;
  maxRetries: number;
  retryCount: number;
  code: string;
  message: string;
  ownerInterventionRequired: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  keepExecutionBlocked: true;
  suggestedAction: string;
  decidedAtUtc: string;
}

export interface AtPhase4ObservabilityPublic {
  schemaVersion: typeof AT_PHASE4_OBSERVABILITY_SCHEMA;
  boot: {
    bootId: string | null;
    status: AtBootAuditRecord["status"] | null;
    startedAtUtc: string | null;
    completedAtUtc: string | null;
    analysisScheduleResumed: boolean | null;
    note: string | null;
  };
  recovery: {
    lastDecision: AtRecoveryDecision | null;
    recoveryStatus: string | null;
  };
  modules: AtModuleHealthRow[];
  alerts: AtObservabilityAlert[];
  correlation: AtCorrelationChain;
  /** XAU owner-lot vs FXCM AMOUNT readiness (never raises owner limits). */
  xauAmountCompatibility?: {
    classification: string;
    code: string;
    message: string;
    amount: number | null;
    minLotsFromBroker: number | null;
    placesOrders: false;
    mutatesBroker: false;
  } | null;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  brokerExecution: "DISABLED";
  note: string;
}
