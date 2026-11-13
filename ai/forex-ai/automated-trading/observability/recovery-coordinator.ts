/**
 * Phase 4 — Safe AT recovery classification.
 * Never disables Emergency Lock, never enables Execution Master, never submits orders.
 */
import { randomUUID } from "node:crypto";
import type { AtRecoveryAction, AtRecoveryClass, AtRecoveryDecision } from "./types.js";
import { AT_RECOVERY_EVENT_SCHEMA } from "./types.js";

export interface ClassifyAtFailureInput {
  code: string | null | undefined;
  message?: string | null;
  quoteFresh?: boolean | null;
  quoteReasonCode?: string | null;
  brokerConnected?: boolean | null;
  systemMasterOn?: boolean | null;
  retryCount?: number;
  maxRetries?: number;
  nowMs?: number;
}

function upper(s: string | null | undefined): string {
  return String(s ?? "").trim().toUpperCase();
}

/**
 * Classify a failure before deciding recovery. Fail closed on unknowns.
 */
export function classifyAtFailure(input: ClassifyAtFailureInput): {
  classification: AtRecoveryClass;
  action: AtRecoveryAction;
  retryAllowed: boolean;
  ownerInterventionRequired: boolean;
  code: string;
  message: string;
  suggestedAction: string;
} {
  const code = upper(input.code) || upper(input.quoteReasonCode) || "UNKNOWN";
  const msg = String(input.message ?? "").slice(0, 240);
  const retryCount = Math.max(0, Math.floor(input.retryCount ?? 0));
  const maxRetries = Math.max(0, Math.floor(input.maxRetries ?? 3));

  if (
    /EXECUTION|DEMO_MUTATION|PLACES_ORDERS|EMERGENCY|MUTATES_BROKER|ACCEPTS_FOR_EXECUTION/.test(code)
  ) {
    return {
      classification: "SAFETY_LOCK",
      action: "KEEP_EXECUTION_BLOCKED",
      retryAllowed: false,
      ownerInterventionRequired: false,
      code: code || "SAFETY_LOCK",
      message: msg || "Safety lock — execution remains blocked.",
      suggestedAction: "Leave Execution Master OFF and Emergency Entry Lock ON. Do not mutate broker.",
    };
  }

  if (
    code === "MARKET_CLOSED"
    || code === "MARKET_INACTIVE"
    || /MARKET_CLOSED|MARKET_INACTIVE/.test(code)
  ) {
    return {
      classification: "MARKET_CLOSED_NO_RETRY_STORM",
      action: "NOOP",
      retryAllowed: false,
      ownerInterventionRequired: false,
      code,
      message: msg || "Market closed/inactive — not a broken provider; avoid reconnect storms.",
      suggestedAction: "Wait for market open. Keep monitoring paused or idle; do not spam OpenAI.",
    };
  }

  if (
    /CREDENTIAL|AUTH|UNAUTHORIZED|BILLING|QUOTA|ALLOCATION_MISSING|INVALID_CONFIG|CORRUPT/.test(code)
  ) {
    return {
      classification: "OWNER_ACTION_REQUIRED",
      action: "REQUEST_OWNER_INTERVENTION",
      retryAllowed: false,
      ownerInterventionRequired: true,
      code,
      message: msg || "Owner action required — automatic recovery is unsafe.",
      suggestedAction: "Fix credentials, billing, allocation, or configuration; then retry via System Master.",
    };
  }

  if (
    input.brokerConnected === false
    || /DISCONNECTED|SIDECAR|PROVIDER_TIMEOUT|NETWORK|ECONN|SESSION/.test(code)
  ) {
    const exhausted = retryCount >= maxRetries;
    return {
      classification: exhausted ? "NON_RECOVERABLE" : "RECOVERABLE_PROVIDER",
      action: exhausted ? "REQUEST_OWNER_INTERVENTION" : "RECONNECT_READONLY",
      retryAllowed: !exhausted,
      ownerInterventionRequired: exhausted,
      code: code || "PROVIDER_DISCONNECTED",
      message: msg || (exhausted
        ? "Provider recovery exhausted."
        : "Temporary provider issue — bounded read-only reconnect allowed."),
      suggestedAction: exhausted
        ? "Inspect ForexConnect sidecar/session; owner intervention required."
        : "Reconnect read-only ForexConnect, revalidate XAU/USD offer and quote freshness.",
    };
  }

  if (
    input.quoteFresh === false
    || /QUOTE_STALE|QUOTE_MISSING|NO_QUOTE|BID_ASK_MISSING|STALE/.test(code)
  ) {
    const exhausted = retryCount >= maxRetries;
    return {
      classification: exhausted ? "OWNER_ACTION_REQUIRED" : "RECOVERABLE_TRANSIENT",
      action: exhausted ? "REQUEST_OWNER_INTERVENTION" : "REVALIDATE_QUOTE",
      retryAllowed: !exhausted,
      ownerInterventionRequired: exhausted,
      code: code || "QUOTE_STALE",
      message: msg || "Quote not fresh — revalidate before analysis.",
      suggestedAction: exhausted
        ? "Confirm XAU/USD subscription and live Offers feed."
        : "Revalidate quote identity/freshness; suppress OpenAI until fresh.",
    };
  }

  if (input.systemMasterOn === false) {
    return {
      classification: "NONE",
      action: "STOP_OWNED_WORKERS",
      retryAllowed: false,
      ownerInterventionRequired: false,
      code: "SYSTEM_MASTER_OFF",
      message: "System Master OFF — stop Automated Trading-owned automated work.",
      suggestedAction: "Keep workers stopped until owner turns System Master ON.",
    };
  }

  if (/RATE_LIMIT|TIMEOUT|TRANSIENT|TEMPORARY/.test(code)) {
    const exhausted = retryCount >= maxRetries;
    return {
      classification: exhausted ? "OWNER_ACTION_REQUIRED" : "RECOVERABLE_TRANSIENT",
      action: exhausted ? "REQUEST_OWNER_INTERVENTION" : "BOUNDED_RETRY",
      retryAllowed: !exhausted,
      ownerInterventionRequired: exhausted,
      code,
      message: msg || "Transient failure — bounded retry only.",
      suggestedAction: exhausted
        ? "Stop retries; inspect OpenAI/provider quotas."
        : "Apply backoff; do not create duplicate workers or sessions.",
    };
  }

  return {
    classification: "NON_RECOVERABLE",
    action: "REQUEST_OWNER_INTERVENTION",
    retryAllowed: false,
    ownerInterventionRequired: true,
    code: code || "UNKNOWN_FAILURE",
    message: msg || "Unclassified failure — fail closed.",
    suggestedAction: "Inspect logs and persistence; do not bypass risk or safety controls.",
  };
}

/** Build a durable recovery decision record. Always keeps execution blocked. */
export function decideAtRecovery(input: ClassifyAtFailureInput): AtRecoveryDecision {
  const classified = classifyAtFailure(input);
  const retryCount = Math.max(0, Math.floor(input.retryCount ?? 0));
  const maxRetries = Math.max(0, Math.floor(input.maxRetries ?? 3));
  return {
    schemaVersion: AT_RECOVERY_EVENT_SCHEMA,
    eventId: randomUUID(),
    classification: classified.classification,
    action: classified.action,
    retryAllowed: classified.retryAllowed,
    maxRetries,
    retryCount,
    code: classified.code,
    message: classified.message,
    ownerInterventionRequired: classified.ownerInterventionRequired,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    keepExecutionBlocked: true,
    suggestedAction: classified.suggestedAction,
    decidedAtUtc: new Date(input.nowMs ?? Date.now()).toISOString(),
  };
}
