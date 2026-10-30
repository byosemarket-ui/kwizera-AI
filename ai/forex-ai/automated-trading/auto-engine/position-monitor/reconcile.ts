/**
 * Phase 4.1 — Reconcile internal lifecycle vs broker RO trades.
 * Never closes or opens positions.
 */

export interface InternalPositionView {
  lifecycleId: string;
  instrument: string;
  tradeId: string | null;
  direction: "BUY" | "SELL" | null;
  lots: number | null;
  protectionStatus: string | null;
  fillConfirmed: boolean;
  blocksAdditionalEntries: boolean;
}

export interface BrokerPositionView {
  tradeId: string;
  instrument: string;
  lots: number | null;
  amount: number | null;
}

export interface PositionReconcileResult {
  ok: boolean;
  code: string;
  blockers: string[];
  blockNewEntries: boolean;
  missingProtectionTradeIds: string[];
  unexpectedBrokerTradeIds: string[];
  missingBrokerTradeIds: string[];
  disconnected: boolean;
  placesOrders: false;
  mutatesBroker: false;
}

export function reconcilePositions(input: {
  brokerConnected: boolean;
  tradesFetchOk: boolean;
  internal: InternalPositionView[];
  broker: BrokerPositionView[] | null;
  allowlistInstruments?: string[] | null;
}): PositionReconcileResult {
  const blockers: string[] = [];
  const missingProtectionTradeIds: string[] = [];
  const unexpectedBrokerTradeIds: string[] = [];
  const missingBrokerTradeIds: string[] = [];

  if (!input.brokerConnected) {
    blockers.push("BROKER_DISCONNECTED");
  }
  if (!input.tradesFetchOk || input.broker == null) {
    blockers.push("TRADES_UNAVAILABLE");
  }

  const allow = (input.allowlistInstruments ?? [])
    .map((s) => String(s).replace(/\s+/g, "").toUpperCase());

  const brokerById = new Map<string, BrokerPositionView>();
  for (const row of input.broker ?? []) {
    if (!row.tradeId) {
      blockers.push("BROKER_TRADE_ID_MISSING");
      continue;
    }
    brokerById.set(String(row.tradeId), row);
  }

  for (const pos of input.internal) {
    if (pos.blocksAdditionalEntries) blockers.push("UNPROTECTED_OR_UNSAFE_INTERNAL");
    if (pos.fillConfirmed && pos.tradeId) {
      if (!brokerById.has(pos.tradeId)) missingBrokerTradeIds.push(pos.tradeId);
      const prot = String(pos.protectionStatus ?? "").toUpperCase();
      if (prot !== "CONFIRMED" && prot !== "ATTACHED" && prot !== "RECONCILED") {
        missingProtectionTradeIds.push(pos.tradeId);
        blockers.push("MISSING_PROTECTION");
      }
    }
  }

  const knownTradeIds = new Set(
    input.internal.map((p) => p.tradeId).filter((x): x is string => Boolean(x)),
  );
  for (const [tradeId, row] of brokerById) {
    const sym = String(row.instrument).replace(/\s+/g, "").toUpperCase();
    if (allow.length > 0 && !allow.includes(sym)) continue;
    if (!knownTradeIds.has(tradeId)) {
      unexpectedBrokerTradeIds.push(tradeId);
      blockers.push("UNEXPECTED_BROKER_POSITION");
    }
  }

  const blockNewEntries = blockers.length > 0;
  return {
    ok: !blockNewEntries,
    code: blockNewEntries ? blockers[0]! : "POSITIONS_RECONCILED",
    blockers: [...new Set(blockers)],
    blockNewEntries,
    missingProtectionTradeIds: [...new Set(missingProtectionTradeIds)],
    unexpectedBrokerTradeIds: [...new Set(unexpectedBrokerTradeIds)],
    missingBrokerTradeIds: [...new Set(missingBrokerTradeIds)],
    disconnected: !input.brokerConnected,
    placesOrders: false,
    mutatesBroker: false,
  };
}
