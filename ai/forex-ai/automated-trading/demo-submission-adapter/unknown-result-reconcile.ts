/**
 * Stage 7.3 — Safe unknown-result reconciliation decisioning.
 * Read-only broker lookup planning only. Never retries submission. Never mutates broker.
 */
import type { BrokerAcknowledgementContract } from "./types.js";

export type UnknownReconcileAction =
  | "NO_ACTION_CONCLUSIVE"
  | "READ_ONLY_BROKER_LOOKUP"
  | "PERSIST_UNKNOWN_BLOCK"
  | "OWNER_REVIEW_REQUIRED";

export interface UnknownResultReconcilePlan {
  resultUnknown: boolean;
  verifiedBrokerAcceptance: false | true;
  mayBlindRetrySubmission: false;
  maySubmitNewOrder: false;
  mayMutateBroker: false;
  action: UnknownReconcileAction;
  requiredLookups: Array<"orders" | "trades" | "closed_trades">;
  persistenceRequired: boolean;
  note: string;
}

/**
 * Decide the next safe step for an acknowledgement that may be UNKNOWN.
 * Never recommends create_order_request / send_request / blind retry.
 */
export function planUnknownResultReconciliation(
  ack: Pick<
    BrokerAcknowledgementContract,
    "resultUnknown" | "verifiedBrokerAcceptance" | "accepted" | "rejected" | "brokerOrderId" | "brokerTradeId"
  >,
): UnknownResultReconcilePlan {
  if (ack.rejected === true && ack.resultUnknown !== true) {
    return {
      resultUnknown: false,
      verifiedBrokerAcceptance: false,
      mayBlindRetrySubmission: false,
      maySubmitNewOrder: false,
      mayMutateBroker: false,
      action: "NO_ACTION_CONCLUSIVE",
      requiredLookups: [],
      persistenceRequired: true,
      note: "Explicit broker rejection is conclusive — persist, do not retry as unknown.",
    };
  }

  if (ack.verifiedBrokerAcceptance === true && ack.accepted === true && ack.resultUnknown !== true) {
    return {
      resultUnknown: false,
      verifiedBrokerAcceptance: true,
      mayBlindRetrySubmission: false,
      maySubmitNewOrder: false,
      mayMutateBroker: false,
      action: "NO_ACTION_CONCLUSIVE",
      requiredLookups: ack.brokerTradeId ? ["trades"] : ["orders", "trades"],
      persistenceRequired: true,
      note: "Authoritative acceptance already verified — RO protection/position lookup only; no resubmit.",
    };
  }

  if (ack.resultUnknown === true || (!ack.accepted && !ack.rejected)) {
    return {
      resultUnknown: true,
      verifiedBrokerAcceptance: false,
      mayBlindRetrySubmission: false,
      maySubmitNewOrder: false,
      mayMutateBroker: false,
      action: "READ_ONLY_BROKER_LOOKUP",
      requiredLookups: ["orders", "trades", "closed_trades"],
      persistenceRequired: true,
      note:
        "UNKNOWN outcome — persist RECONCILIATION_REQUIRED, perform read-only orders/trades lookup, "
        + "never blind-retry submission. Live DEMO lookup requires separate owner approval.",
    };
  }

  return {
    resultUnknown: false,
    verifiedBrokerAcceptance: false,
    mayBlindRetrySubmission: false,
    maySubmitNewOrder: false,
    mayMutateBroker: false,
    action: "OWNER_REVIEW_REQUIRED",
    requiredLookups: ["orders", "trades"],
    persistenceRequired: true,
    note: "Ambiguous acknowledgement shape — owner review; no mutation.",
  };
}

/**
 * Apply a read-only broker observation to an UNKNOWN acknowledgement (pure).
 * Does not call the broker. Caller supplies RO snapshot fields.
 */
export function applyReadOnlyBrokerObservation(input: {
  prior: Pick<BrokerAcknowledgementContract, "resultUnknown" | "brokerOrderId" | "brokerTradeId">;
  roOrderFound: boolean;
  roTradeFound: boolean;
  roOrderId?: string | null;
  roTradeId?: string | null;
  roRejected?: boolean;
}): {
  resolved: boolean;
  stillUnknown: boolean;
  mayBlindRetrySubmission: false;
  outcome: "FOUND_ORDER" | "FOUND_TRADE" | "FOUND_REJECT" | "STILL_UNKNOWN";
  note: string;
} {
  if (input.roRejected === true) {
    return {
      resolved: true,
      stillUnknown: false,
      mayBlindRetrySubmission: false,
      outcome: "FOUND_REJECT",
      note: "RO observation shows reject — conclusive; do not resubmit.",
    };
  }
  if (input.roTradeFound) {
    return {
      resolved: true,
      stillUnknown: false,
      mayBlindRetrySubmission: false,
      outcome: "FOUND_TRADE",
      note: `RO trade found id=${input.roTradeId ?? input.prior.brokerTradeId ?? "known"} — reconcile fill/protection; no resubmit.`,
    };
  }
  if (input.roOrderFound) {
    return {
      resolved: true,
      stillUnknown: false,
      mayBlindRetrySubmission: false,
      outcome: "FOUND_ORDER",
      note: `RO order found id=${input.roOrderId ?? input.prior.brokerOrderId ?? "known"} — await fill via RO; no resubmit.`,
    };
  }
  return {
    resolved: false,
    stillUnknown: true,
    mayBlindRetrySubmission: false,
    outcome: "STILL_UNKNOWN",
    note: "RO lookup found neither order nor trade — remain blocked UNKNOWN; owner review; never blind-retry.",
  };
}
