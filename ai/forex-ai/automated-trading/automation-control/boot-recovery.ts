/**
 * Phase 57.2 — Pure boot-recovery decision for automation control.
 * Never authorizes broker execution. Soft-resume monitoring only when prerequisites pass.
 */
import type {
  AutomationBlockReasonCode,
  AutomationControlPersisted,
  AutomationLifecycleState,
  AutomationRecoveryStatus,
} from "./types.js";
import type { AutomationReadinessResult } from "./readiness.js";

export type AutomationBootRecoveryAction =
  | "NOOP_ENSURE_INVARIANTS"
  | "FORCE_OFF_FROM_STOPPING"
  | "SOFT_RESUME_MONITORING"
  | "BLOCK_AND_ALIGN_MONITOR_STOP"
  | "KEEP_OFF";

export interface AutomationBootRecoveryDecision {
  action: AutomationBootRecoveryAction;
  nextLifecycle: AutomationLifecycleState;
  reasonCode: AutomationBlockReasonCode;
  reasonMessage: string;
  recoveryStatus: AutomationRecoveryStatus;
  monitoringDesired: boolean;
  requestedMode: "ON" | "OFF";
  /** When true, caller should stopMonitoring to avoid split-brain. */
  stopMonitorWorker: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  entryGenerationEnabled: false;
  brokerExecution: "DISABLED";
}

/**
 * Decide how to reconcile persisted automation control after process restart.
 * Soft-resume is allowed only when readiness.ok and the monitor worker is (or can be) aligned.
 */
export function decideAutomationBootRecovery(input: {
  persisted: AutomationControlPersisted;
  readiness: AutomationReadinessResult | null;
  monitorEnabled: boolean;
}): AutomationBootRecoveryDecision {
  const base = {
    placesOrders: false as const,
    acceptsForExecution: false as const,
    entryGenerationEnabled: false as const,
    brokerExecution: "DISABLED" as const,
  };
  const cur = input.persisted;

  if (cur.lifecycle === "STOPPING") {
    return {
      ...base,
      action: "FORCE_OFF_FROM_STOPPING",
      nextLifecycle: "OFF",
      reasonCode: "OPERATOR_STOP",
      reasonMessage: "Recovered STOPPING → OFF after restart.",
      recoveryStatus: "RECOVERED",
      monitoringDesired: false,
      requestedMode: "OFF",
      stopMonitorWorker: true,
    };
  }

  const wantsMonitoring =
    cur.lifecycle === "MONITORING"
    || cur.lifecycle === "STARTING"
    || (cur.requestedMode === "ON" && cur.monitoringDesired)
    || (cur.requestedMode === "ON" && cur.lifecycle === "BLOCKED");

  if (!wantsMonitoring) {
    if (cur.requestedMode === "OFF" && cur.lifecycle === "OFF") {
      return {
        ...base,
        action: "KEEP_OFF",
        nextLifecycle: "OFF",
        reasonCode: cur.reasonCode === "AMBIGUOUS_RECOVERY" ? "AMBIGUOUS_RECOVERY" : "NONE",
        reasonMessage: cur.reasonMessage ?? "Automation OFF after restart.",
        recoveryStatus: cur.reasonCode === "AMBIGUOUS_RECOVERY" ? "AMBIGUOUS_RECOVERY" : "IDLE",
        monitoringDesired: false,
        requestedMode: "OFF",
        stopMonitorWorker: cur.monitoringDesired === true,
      };
    }
    return {
      ...base,
      action: "NOOP_ENSURE_INVARIANTS",
      nextLifecycle: cur.lifecycle === "ERROR" ? "ERROR" : cur.lifecycle,
      reasonCode: cur.reasonCode,
      reasonMessage: cur.reasonMessage ?? "Invariants enforced after restart.",
      recoveryStatus: cur.recoveryStatus ?? "IDLE",
      monitoringDesired: false,
      requestedMode: cur.requestedMode,
      stopMonitorWorker: false,
    };
  }

  // Soft-resume path: only when readiness proven and monitor aligned or startable.
  if (input.readiness?.ok === true) {
    return {
      ...base,
      action: "SOFT_RESUME_MONITORING",
      nextLifecycle: "MONITORING",
      reasonCode: "RECOVERY_SOFT_RESUMED",
      reasonMessage:
        "Process restart recovery — monitoring resumed after readiness revalidation. Broker execution remains DISABLED.",
      recoveryStatus: "RECOVERED",
      monitoringDesired: true,
      requestedMode: "ON",
      stopMonitorWorker: false,
    };
  }

  const reasonCode: AutomationBlockReasonCode =
    input.readiness && !input.readiness.ok
      ? input.readiness.reasonCode
      : "RECOVERY_REQUIRES_START";

  return {
    ...base,
    action: "BLOCK_AND_ALIGN_MONITOR_STOP",
    nextLifecycle: "BLOCKED",
    reasonCode,
    reasonMessage:
      input.readiness?.reasonMessage
      ?? "Process restart — monitoring not resumed. Re-run START AUTO after prerequisites pass. Broker execution remains DISABLED.",
    recoveryStatus:
      reasonCode === "AMBIGUOUS_RECOVERY" ? "AMBIGUOUS_RECOVERY" : "RECOVERY_BLOCKED",
    monitoringDesired: false,
    requestedMode: "ON",
    // Align worker: do not leave monitor running while automation is BLOCKED.
    stopMonitorWorker: true,
  };
}
