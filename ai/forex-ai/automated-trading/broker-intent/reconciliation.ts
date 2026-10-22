/**
 * Phase 57.0 — Read-only intent vs broker observation reconciliation.
 * Never submits, amends, cancels, or closes. Never invents fills or IDs.
 */
import type {
  BrokerIntentRecord,
  BrokerReconcileResult,
  BrokerRoObservation,
} from "./types.js";

/**
 * Compare a persisted intent with RO broker observations.
 * Acknowledgment ≠ fill. Local SL/TP ≠ protection. Intent ≠ position.
 */
export function reconcileBrokerIntentWithRoObservation(input: {
  intent: BrokerIntentRecord | null;
  observation: BrokerRoObservation;
}): BrokerReconcileResult {
  const obs = input.observation;
  if (obs.placesOrders !== false || obs.mutatesBroker !== false) {
    return {
      intentId: input.intent?.intentId ?? null,
      outcome: "EXECUTION_FORBIDDEN",
      message: "Observation payload violates placesOrders/mutatesBroker=false invariants.",
      inferredFill: false,
      inferredProtection: false,
      placesOrders: false,
      mutatesBroker: false,
      detail: "reject_unsafe_observation",
    };
  }

  if (!input.intent) {
    return {
      intentId: null,
      outcome: "NO_INTENT",
      message: "No persisted broker intent to reconcile.",
      inferredFill: false,
      inferredProtection: false,
      placesOrders: false,
      mutatesBroker: false,
      detail: "no_intent",
    };
  }

  const intent = input.intent;

  // This phase never has broker IDs on intents — local intent only.
  if (intent.brokerOrderId != null || intent.brokerDealId != null || intent.brokerPositionId != null) {
    return {
      intentId: intent.intentId,
      outcome: "RECONCILIATION_MISMATCH",
      message:
        "Intent unexpectedly carries broker IDs without an authorized execution phase — mismatch.",
      inferredFill: false,
      inferredProtection: false,
      placesOrders: false,
      mutatesBroker: false,
      detail: "unexpected_broker_ids_on_intent",
    };
  }

  // Presence of RO open orders/positions must never be attributed to this intent.
  if (
    (obs.openOrdersCount != null && obs.openOrdersCount > 0)
    || (obs.openPositionsCount != null && obs.openPositionsCount > 0)
  ) {
    return {
      intentId: intent.intentId,
      outcome: "UNKNOWN_BROKER_OUTCOME",
      message:
        "Broker shows open orders/positions, but this intent was never submitted — outcome unknown; do not attribute fills.",
      inferredFill: false,
      inferredProtection: false,
      placesOrders: false,
      mutatesBroker: false,
      detail: "broker_exposure_unrelated_to_unsent_intent",
    };
  }

  if (intent.protectiveStatus === "LOCAL_CALCULATED_ONLY") {
    // Explicit: local SL/TP is not protection evidence.
    void intent;
  }

  return {
    intentId: intent.intentId,
    outcome: "INTENT_ONLY_NO_BROKER_EVIDENCE",
    message:
      "Intent exists locally only. No broker order/deal/position evidence. Not a fill. Protection unverified.",
    inferredFill: false,
    inferredProtection: false,
    placesOrders: false,
    mutatesBroker: false,
    detail: `state=${intent.state};protective=${intent.protectiveStatus}`,
  };
}

/**
 * Deduplicate RO observed IDs without inventing missing ones.
 */
export function dedupeObservedIds(ids: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Explicit: an order acknowledgment event must never be treated as a fill.
 */
export function interpretOrderAcknowledgment(_ack: {
  brokerOrderId?: string | null;
  status?: string | null;
}): {
  isFill: false;
  isPartialFill: false;
  outcome: "BROKER_ACK_NOT_FILL";
  placesOrders: false;
  mutatesBroker: false;
} {
  return {
    isFill: false,
    isPartialFill: false,
    outcome: "BROKER_ACK_NOT_FILL",
    placesOrders: false,
    mutatesBroker: false,
  };
}
