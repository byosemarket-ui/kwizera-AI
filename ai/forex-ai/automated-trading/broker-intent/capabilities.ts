/**
 * Phase 57.0 — Explicit broker capability matrix.
 * Healthy connectivity ≠ permission to trade.
 */
import type { BrokerCapability, BrokerCapabilityMatrix } from "./types.js";
import { BROKER_INTENT_PHASE } from "./types.js";

const ALL: readonly BrokerCapability[] = [
  "READ_ONLY_MARKET_DATA",
  "READ_ONLY_ACCOUNT_STATE",
  "READ_ONLY_ORDERS",
  "READ_ONLY_POSITIONS",
  "ORDER_SUBMISSION_DISABLED",
  "ORDER_MODIFICATION_DISABLED",
  "ORDER_CANCELLATION_DISABLED",
  "POSITION_CLOSURE_DISABLED",
  "PROTECTIVE_ORDER_MUTATION_DISABLED",
] as const;

/**
 * Architecture stamp for the current ForexConnect + AT stack.
 * RO capabilities are true when the application path exists; all mutation caps are DISABLED.
 */
export function buildBrokerCapabilityMatrix(): BrokerCapabilityMatrix {
  const capabilities = {} as Record<BrokerCapability, boolean>;
  for (const c of ALL) {
    capabilities[c] =
      c === "READ_ONLY_MARKET_DATA"
      || c === "READ_ONLY_ACCOUNT_STATE"
      || c === "READ_ONLY_ORDERS"
      || c === "READ_ONLY_POSITIONS"
      || c === "ORDER_SUBMISSION_DISABLED"
      || c === "ORDER_MODIFICATION_DISABLED"
      || c === "ORDER_CANCELLATION_DISABLED"
      || c === "POSITION_CLOSURE_DISABLED"
      || c === "PROTECTIVE_ORDER_MUTATION_DISABLED";
  }
  return {
    phase: BROKER_INTENT_PHASE,
    capabilities,
    tradingEnabled: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "FC bridge exposes RO listOrders/listTrades + market data only. Mutation operations are DISABLED and have no application path.",
  };
}

export function isBrokerMutationCapability(cap: BrokerCapability): boolean {
  return (
    cap === "ORDER_SUBMISSION_DISABLED"
    || cap === "ORDER_MODIFICATION_DISABLED"
    || cap === "ORDER_CANCELLATION_DISABLED"
    || cap === "POSITION_CLOSURE_DISABLED"
    || cap === "PROTECTIVE_ORDER_MUTATION_DISABLED"
  );
}
