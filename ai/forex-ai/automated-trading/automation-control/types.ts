/**
 * Phase 57.1 — Master automation START/STOP control (server-authoritative).
 * Requested automation mode ≠ broker execution permission.
 * Broker execution remains DISABLED regardless of requestedMode.
 */
export const AT_AUTOMATION_CONTROL_SCHEMA = "at-automation-control-v1" as const;
export const AT_AUTOMATION_CONTROL_PHASE = "57.1" as const;

export type AutomationRequestedMode = "ON" | "OFF";

export type AutomationLifecycleState =
  | "OFF"
  | "STARTING"
  | "MONITORING"
  | "STOPPING"
  | "BLOCKED"
  | "ERROR";

export type AutomationBlockReasonCode =
  | "NONE"
  | "UNAUTHORIZED"
  | "SAFETY_MASTER_MUST_REMAIN_OFF"
  | "SAFETY_EMERGENCY_LOCK_REQUIRED"
  | "EXECUTION_FORBIDDEN"
  | "INSTRUMENT_NOT_CONFIGURED"
  | "MONITOR_START_FAILED"
  | "QUOTE_NOT_FRESH"
  | "QUOTE_MISSING"
  | "QUOTE_TIMESTAMP_INVALID"
  | "QUOTE_OUT_OF_ORDER"
  | "QUOTE_FUTURE_TIMESTAMP"
  | "FEED_DISCONNECTED"
  | "SUBSCRIPTION_NOT_CONFIRMED"
  | "PERSISTENCE_FAILED"
  | "STALE_STATE_VERSION"
  | "AMBIGUOUS_RECOVERY"
  | "OPERATOR_STOP"
  | "PREREQUISITE_FAILED"
  | "RECOVERY_SOFT_RESUMED"
  | "RECOVERY_REQUIRES_START";

/** Phase 57.2 — recovery outcome distinct from monitoring/execution BLOCKED. */
export type AutomationRecoveryStatus =
  | "IDLE"
  | "RECOVERED"
  | "RECOVERY_PENDING"
  | "AMBIGUOUS_RECOVERY"
  | "RECOVERY_BLOCKED";

export interface AutomationControlPersisted {
  schemaVersion: typeof AT_AUTOMATION_CONTROL_SCHEMA;
  phase: typeof AT_AUTOMATION_CONTROL_PHASE;
  /** Compare-and-set / stale UI detection. */
  stateVersion: number;
  requestedMode: AutomationRequestedMode;
  lifecycle: AutomationLifecycleState;
  reasonCode: AutomationBlockReasonCode;
  reasonMessage: string | null;
  lastChangedAtUtc: string;
  lastOperatorHint: string;
  /** Always false in Phase 57.1 — no automatic broker entries. */
  entryGenerationEnabled: false;
  placesOrders: false;
  acceptsForExecution: false;
  brokerExecution: "DISABLED";
  monitoringDesired: boolean;
  lastMonitoringAtUtc: string | null;
  /** Phase 57.2 — last recovery classification (not broker execution). */
  recoveryStatus: AutomationRecoveryStatus;
}

export interface AutomationControlPublicStatus {
  phase: typeof AT_AUTOMATION_CONTROL_PHASE;
  stateVersion: number;
  requestedMode: AutomationRequestedMode;
  lifecycle: AutomationLifecycleState;
  reasonCode: AutomationBlockReasonCode;
  reasonMessage: string | null;
  lastChangedAtUtc: string;
  lastOperatorHint: string;
  /** Explicit separation for UI. */
  automationRequested: boolean;
  marketMonitoring: "ACTIVE" | "INACTIVE" | "STARTING" | "STOPPING" | "BLOCKED" | "ERROR";
  /** Distinct from marketMonitoring BLOCKED — always execution-forbidden in this product phase. */
  brokerExecution: "DISABLED";
  executionReadiness: "BLOCKED";
  executionStatusLabel: "EXECUTION_FORBIDDEN";
  recoveryStatus: AutomationRecoveryStatus;
  entryGenerationEnabled: false;
  placesOrders: false;
  acceptsForExecution: false;
  emergencyEntryLockExpected: true;
  masterEnableExpected: false;
  note: string;
}

export function defaultAutomationControlPersisted(): AutomationControlPersisted {
  const now = new Date().toISOString();
  return {
    schemaVersion: AT_AUTOMATION_CONTROL_SCHEMA,
    phase: AT_AUTOMATION_CONTROL_PHASE,
    stateVersion: 1,
    requestedMode: "OFF",
    lifecycle: "OFF",
    reasonCode: "NONE",
    reasonMessage: null,
    lastChangedAtUtc: now,
    lastOperatorHint: "system",
    entryGenerationEnabled: false,
    placesOrders: false,
    acceptsForExecution: false,
    brokerExecution: "DISABLED",
    monitoringDesired: false,
    lastMonitoringAtUtc: null,
    recoveryStatus: "IDLE",
  };
}

export function toAutomationPublicStatus(
  p: AutomationControlPersisted,
): AutomationControlPublicStatus {
  const marketMonitoring: AutomationControlPublicStatus["marketMonitoring"] =
    p.lifecycle === "MONITORING"
      ? "ACTIVE"
      : p.lifecycle === "STARTING"
        ? "STARTING"
        : p.lifecycle === "STOPPING"
          ? "STOPPING"
          : p.lifecycle === "BLOCKED"
            ? "BLOCKED"
            : p.lifecycle === "ERROR"
              ? "ERROR"
              : "INACTIVE";

  return {
    phase: AT_AUTOMATION_CONTROL_PHASE,
    stateVersion: p.stateVersion,
    requestedMode: p.requestedMode,
    lifecycle: p.lifecycle,
    reasonCode: p.reasonCode,
    reasonMessage: p.reasonMessage,
    lastChangedAtUtc: p.lastChangedAtUtc,
    lastOperatorHint: p.lastOperatorHint,
    automationRequested: p.requestedMode === "ON",
    marketMonitoring,
    brokerExecution: "DISABLED",
    executionReadiness: "BLOCKED",
    executionStatusLabel: "EXECUTION_FORBIDDEN",
    recoveryStatus: p.recoveryStatus ?? "IDLE",
    entryGenerationEnabled: false,
    placesOrders: false,
    acceptsForExecution: false,
    emergencyEntryLockExpected: true,
    masterEnableExpected: false,
    note:
      "Automation START/STOP controls market monitoring & analysis scheduling only. Broker execution remains DISABLED (EXECUTION_FORBIDDEN). placesOrders=false.",
  };
}
