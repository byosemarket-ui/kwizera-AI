/**
 * Classify read-only FXCM Orders/Trades snapshots into XAU/USD exposure evidence.
 * Fail-closed: disconnected, stale, incomplete, or unidentifiable rows → UNKNOWN (never "flat").
 */
import {
  reconcileBrokerExposure,
  type BrokerRoTableSnapshot,
} from "../simulation-risk/exposure-reconciliation.js";
import type {
  XauBrokerEvidence,
  XauBrokerPositionRow,
  XauPendingOrderRow,
  XauPositionOwnership,
} from "./types.js";

export interface ClassifyXauExposureInput {
  trades: BrokerRoTableSnapshot | null | undefined;
  orders: BrokerRoTableSnapshot | null | undefined;
  closedTrades?: BrokerRoTableSnapshot | null;
  /** Verified XAU/USD symbol (e.g. "XAU/USD"). */
  symbol: string;
  /** Verified FXCM OfferID for XAU/USD — rows may carry the OfferID instead of a symbol. */
  offerId: string | null | undefined;
  trackedTradeIds?: readonly string[];
  trackedOrderIds?: readonly string[];
  accountBindingHash?: string | null;
  nowMs?: number;
  maxAgeMs?: number;
}

type RowMatch = "XAU" | "OTHER" | "UNIDENTIFIED";

function compact(s: unknown): string {
  return String(s ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function matchRow(row: Record<string, unknown>, symbol: string, offerId: string | null): RowMatch {
  const target = compact(symbol);
  const candidates = [row.instrument, row.symbol, row.offerId].map(compact).filter(Boolean);
  if (candidates.length === 0) return "UNIDENTIFIED";
  if (candidates.some((c) => c === target)) return "XAU";
  const numeric = candidates.filter((c) => /^\d+$/.test(c));
  if (offerId && numeric.some((c) => c === compact(offerId))) return "XAU";
  const symbolic = candidates.filter((c) => !/^\d+$/.test(c));
  if (symbolic.length > 0) return "OTHER";
  // Only numeric OfferIDs: identifiable as "other" only when the XAU OfferID is verified.
  return offerId ? "OTHER" : "UNIDENTIFIED";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function ownershipOf(
  ids: Array<string | null>,
  trackedTrades: ReadonlySet<string>,
  trackedOrders: ReadonlySet<string>,
): XauPositionOwnership {
  for (const id of ids) {
    if (id && (trackedTrades.has(id) || trackedOrders.has(id))) return "AUTOMATED";
  }
  return "EXTERNAL";
}

export function classifyXauBrokerExposure(input: ClassifyXauExposureInput): XauBrokerEvidence {
  const nowMs = input.nowMs ?? Date.now();
  const observedAtUtc = new Date(nowMs).toISOString();
  const offerId = str(input.offerId);
  const trackedTrades = new Set(input.trackedTradeIds ?? []);
  const trackedOrders = new Set(input.trackedOrderIds ?? []);
  const base = {
    observedAtUtc,
    accountBindingHash: input.accountBindingHash ?? null,
    readOnly: true as const,
  };

  const gate = reconcileBrokerExposure({
    instrument: input.symbol,
    environment: "XAU_POSITION_LOCK",
    openWorkingOrders: input.orders ?? null,
    openPositions: input.trades ?? null,
    maxAgeMs: input.maxAgeMs ?? 60_000,
    nowMs,
  });
  if (!gate.authoritative) {
    return {
      ...base,
      status: "UNKNOWN",
      fetchedAtUtc: gate.fetchedAtUtc,
      freshnessMs: gate.freshnessMs,
      positions: [],
      pendingOrders: [],
      unidentifiedRows: 0,
      closedTradeIds: [],
      reasonCodes: gate.blockers.length ? gate.blockers : ["BROKER_STATE_UNKNOWN"],
    };
  }

  const tradeRows = Array.isArray(input.trades?.trades) ? input.trades!.trades! : [];
  const orderRows = Array.isArray(input.orders?.orders) ? input.orders!.orders! : [];
  let unidentified = 0;
  const positions: XauBrokerPositionRow[] = [];
  const pendingOrders: XauPendingOrderRow[] = [];

  for (const row of tradeRows) {
    const m = matchRow(row, input.symbol, offerId);
    if (m === "UNIDENTIFIED") unidentified += 1;
    if (m !== "XAU") continue;
    const tradeId = str(row.tradeId);
    const orderId = str(row.orderId);
    positions.push({
      tradeId,
      orderId,
      instrument: str(row.instrument),
      offerId: str(row.offerId),
      side: str(row.side ?? row.buySell),
      amount: num(row.amount),
      openRate: num(row.openRate),
      currentPrice: num(row.currentPrice),
      floatingPl: num(row.floatingPl ?? row.grossPl),
      stopLoss: num(row.stopLoss),
      takeProfit: num(row.takeProfit),
      usedMargin: num(row.usedMargin),
      openTime: str(row.openTime),
      ownership: ownershipOf([tradeId, orderId], trackedTrades, trackedOrders),
    });
  }
  for (const row of orderRows) {
    const m = matchRow(row, input.symbol, offerId);
    if (m === "UNIDENTIFIED") unidentified += 1;
    if (m !== "XAU") continue;
    const orderId = str(row.orderId);
    pendingOrders.push({
      orderId,
      instrument: str(row.instrument),
      side: str(row.side ?? row.buySell),
      amount: num(row.amount),
      rate: num(row.rate),
      status: str(row.status),
      ownership: ownershipOf([orderId], trackedTrades, trackedOrders),
    });
  }

  const closedRows = Array.isArray(input.closedTrades?.trades) ? input.closedTrades!.trades! : [];
  const closedTradeIds = closedRows
    .map((r) => str(r.tradeId))
    .filter((id): id is string => Boolean(id));

  const reasonCodes: string[] = [];
  if (unidentified > 0) reasonCodes.push("ROW_INSTRUMENT_UNIDENTIFIED");
  if (positions.some((p) => p.ownership === "AUTOMATED")) reasonCodes.push("XAU_POSITION_ALREADY_OPEN");
  if (positions.some((p) => p.ownership !== "AUTOMATED")) reasonCodes.push("EXTERNAL_XAU_POSITION_PRESENT");
  if (pendingOrders.length > 0) reasonCodes.push("XAU_PENDING_ORDER_PRESENT");

  const status = unidentified > 0
    ? "UNKNOWN"
    : positions.length > 0 || pendingOrders.length > 0
      ? "OCCUPIED"
      : "CONFIRMED_FLAT";

  return {
    ...base,
    status,
    fetchedAtUtc: gate.fetchedAtUtc,
    freshnessMs: gate.freshnessMs,
    positions,
    pendingOrders,
    unidentifiedRows: unidentified,
    closedTradeIds,
    reasonCodes: status === "CONFIRMED_FLAT" ? ["BROKER_CONFIRMED_NO_XAU_EXPOSURE"] : reasonCodes,
  };
}
