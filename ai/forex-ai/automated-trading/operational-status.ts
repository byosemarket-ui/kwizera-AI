/**
 * Phase 57.4 — Authoritative operational (monitoring) status vs execution prohibition.
 * Never claims broker execution is ready.
 */
import type { AutomationControlPersisted } from "./automation-control/types.js";

export type AtOperationalStatusCode =
  | "MONITORING_ACTIVE"
  | "MONITORING_STARTING"
  | "MONITORING_STOPPING"
  | "MONITORING_OFF"
  | "MONITORING_BLOCKED"
  | "WORKER_STOPPED"
  | "RECOVERY_REQUIRED"
  | "ERROR"
  | "INITIALIZING";

export interface AtOperationalStatus {
  /** Monitoring/ops capability — not broker execution. */
  code: AtOperationalStatusCode;
  /** Operator-facing label for header badge. */
  label: string;
  reasonCode: string | null;
  /** Always execution-forbidden in Phase 57.x. */
  executionStatusLabel: "EXECUTION_FORBIDDEN";
  executionReadiness: "BLOCKED";
  brokerExecution: "DISABLED";
  placesOrders: false;
  acceptsForExecution: false;
}

export function deriveOperationalStatus(input: {
  automation: Pick<
    AutomationControlPersisted,
    "lifecycle" | "requestedMode" | "reasonCode" | "reasonMessage" | "recoveryStatus"
  >;
  monitorEnabled: boolean;
  workerActive: boolean;
  quoteFresh: boolean | null;
  quoteReasonCode?: string | null;
}): AtOperationalStatus {
  const base = {
    executionStatusLabel: "EXECUTION_FORBIDDEN" as const,
    executionReadiness: "BLOCKED" as const,
    brokerExecution: "DISABLED" as const,
    placesOrders: false as const,
    acceptsForExecution: false as const,
  };

  const auto = input.automation;
  const reason = auto.reasonCode && auto.reasonCode !== "NONE" ? auto.reasonCode : null;

  if (auto.lifecycle === "ERROR") {
    return {
      ...base,
      code: "ERROR",
      label: "ERROR",
      reasonCode: reason,
    };
  }

  if (auto.lifecycle === "STARTING") {
    return {
      ...base,
      code: "MONITORING_STARTING",
      label: "MONITORING STARTING",
      reasonCode: reason,
    };
  }

  if (auto.lifecycle === "STOPPING") {
    return {
      ...base,
      code: "MONITORING_STOPPING",
      label: "MONITORING STOPPING",
      reasonCode: reason,
    };
  }

  if (auto.lifecycle === "OFF" || auto.requestedMode === "OFF") {
    return {
      ...base,
      code: "MONITORING_OFF",
      label: "MONITORING OFF",
      reasonCode: reason === "OPERATOR_STOP" ? "OPERATOR_STOP" : reason,
    };
  }

  if (auto.lifecycle === "BLOCKED") {
    const detail = reason ?? "PREREQUISITE_FAILED";
    if (
      auto.recoveryStatus === "AMBIGUOUS_RECOVERY"
      || auto.recoveryStatus === "RECOVERY_BLOCKED"
      || detail === "AMBIGUOUS_RECOVERY"
      || detail === "RECOVERY_REQUIRES_START"
    ) {
      return {
        ...base,
        code: "RECOVERY_REQUIRED",
        label: `RECOVERY REQUIRED — ${detail}`,
        reasonCode: detail,
      };
    }
    return {
      ...base,
      code: "MONITORING_BLOCKED",
      label: `MONITORING BLOCKED — ${detail}`,
      reasonCode: detail,
    };
  }

  // lifecycle MONITORING + requested ON
  if (!input.monitorEnabled || !input.workerActive) {
    return {
      ...base,
      code: "WORKER_STOPPED",
      label: "WORKER STOPPED",
      reasonCode: "WORKER_STOPPED",
    };
  }

  if (input.quoteFresh === false) {
    const q = input.quoteReasonCode ?? "QUOTE_NOT_FRESH";
    return {
      ...base,
      code: "MONITORING_BLOCKED",
      label: `MONITORING BLOCKED — ${q}`,
      reasonCode: q,
    };
  }

  return {
    ...base,
    code: "MONITORING_ACTIVE",
    label: "MONITORING ACTIVE",
    reasonCode: null,
  };
}
