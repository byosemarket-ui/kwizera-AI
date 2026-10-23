/**
 * Phase 57.1 — Activation readiness for MONITORING (never authorizes broker execution).
 */
import type { AutomationBlockReasonCode } from "./types.js";

export interface AutomationReadinessInput {
  masterEnable: boolean;
  emergencyEntryLock: boolean;
  placesOrders: boolean;
  acceptsForExecution: boolean;
  forexConnectTradingEnabled: boolean;
  automaticEntryEnabled: boolean;
  automaticReentryEnabled: boolean;
  instrumentConfigured: boolean;
  quoteFresh: boolean | null;
  /** Optional: if false, block start. null = not evaluated (allow with caution → still can start monitor). */
  monitorCanStart: boolean;
}

export interface AutomationReadinessResult {
  ok: boolean;
  reasonCode: AutomationBlockReasonCode;
  reasonMessage: string | null;
  placesOrders: false;
  acceptsForExecution: false;
  brokerExecution: "DISABLED";
  entryGenerationEnabled: false;
}

/**
 * Fail closed. A pass only means market monitoring may start — not broker trading.
 */
export function evaluateAutomationStartReadiness(
  input: AutomationReadinessInput,
): AutomationReadinessResult {
  const base = {
    placesOrders: false as const,
    acceptsForExecution: false as const,
    brokerExecution: "DISABLED" as const,
    entryGenerationEnabled: false as const,
  };

  if (input.masterEnable === true) {
    return {
      ...base,
      ok: false,
      reasonCode: "SAFETY_MASTER_MUST_REMAIN_OFF",
      reasonMessage:
        "Master Trading (broker-execution sense) must remain OFF. Automation START does not enable broker execution.",
    };
  }
  if (input.emergencyEntryLock !== true) {
    return {
      ...base,
      ok: false,
      reasonCode: "SAFETY_EMERGENCY_LOCK_REQUIRED",
      reasonMessage: "Emergency Entry Lock must remain ON.",
    };
  }
  if (input.placesOrders !== false || input.acceptsForExecution !== false) {
    return {
      ...base,
      ok: false,
      reasonCode: "EXECUTION_FORBIDDEN",
      reasonMessage: "placesOrders/acceptsForExecution must remain false.",
    };
  }
  if (input.forexConnectTradingEnabled || input.automaticEntryEnabled || input.automaticReentryEnabled) {
    return {
      ...base,
      ok: false,
      reasonCode: "EXECUTION_FORBIDDEN",
      reasonMessage: "ForexConnect trading and automatic broker entry/re-entry must remain DISABLED.",
    };
  }
  if (!input.instrumentConfigured) {
    return {
      ...base,
      ok: false,
      reasonCode: "INSTRUMENT_NOT_CONFIGURED",
      reasonMessage: "Select and verify an instrument before START AUTO.",
    };
  }
  if (input.quoteFresh === false) {
    return {
      ...base,
      ok: false,
      reasonCode: "QUOTE_NOT_FRESH",
      reasonMessage: "Market quotes are not fresh — monitoring start blocked.",
    };
  }
  if (!input.monitorCanStart) {
    return {
      ...base,
      ok: false,
      reasonCode: "PREREQUISITE_FAILED",
      reasonMessage: "Monitor prerequisites failed.",
    };
  }

  return {
    ...base,
    ok: true,
    reasonCode: "NONE",
    reasonMessage: null,
  };
}
