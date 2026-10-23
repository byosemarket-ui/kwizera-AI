/**
 * Phase 57.1/57.3 — Activation readiness for MONITORING (never authorizes broker execution).
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
  /** Canonical freshness reason from evaluateVerificationQuoteFreshness (diagnostics). */
  quoteFreshnessReasonCode?: string | null;
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
 * Map quote-freshness diagnostics onto stable automation block codes.
 * Never invents freshness — only remaps already-failed evaluations.
 */
export function mapQuoteFreshnessReasonToAutomationCode(
  reason: string | null | undefined,
): AutomationBlockReasonCode {
  const r = String(reason ?? "");
  switch (r) {
    case "VERIFICATION_MISSING":
    case "BID_ASK_MISSING":
    case "NO_QUOTE_UPDATES":
      return "QUOTE_MISSING";
    case "VERIFICATION_TIMESTAMP_INVALID":
    case "PRICE_CHANGE_AGE_UNKNOWN":
      return "QUOTE_TIMESTAMP_INVALID";
    case "VERIFICATION_TIMESTAMP_FUTURE":
    case "SOURCE_TIMESTAMP_FUTURE":
      return "QUOTE_FUTURE_TIMESTAMP";
    case "FEED_NOT_LIVE":
      return "FEED_DISCONNECTED";
    case "SUBSCRIBING":
      return "SUBSCRIPTION_NOT_CONFIRMED";
    case "HEARTBEAT_ONLY_NO_PRICE_CHANGE":
    case "QUOTE_AGE_EXCEEDED":
    case "SOURCE_TIMESTAMP_TOO_OLD":
    case "BID_ASK_INVALID":
    case "INSTRUMENT_MISMATCH":
      return "QUOTE_NOT_FRESH";
    default:
      return "QUOTE_NOT_FRESH";
  }
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
    const mapped = mapQuoteFreshnessReasonToAutomationCode(input.quoteFreshnessReasonCode);
    const detail = input.quoteFreshnessReasonCode
      ? ` (${input.quoteFreshnessReasonCode})`
      : "";
    return {
      ...base,
      ok: false,
      reasonCode: mapped,
      reasonMessage: `Market quotes are not fresh — monitoring start blocked${detail}.`,
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
