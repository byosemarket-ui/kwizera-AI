/**
 * Stage 6 — Construct verified FXCM TRUE_MARKET_OPEN request payload.
 * Fields mirror services/forexconnect-sidecar/mutation_demo.py (create_order_request).
 * Construction ≠ submission.
 */
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import type { FxcmTrueMarketOpenPayload } from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export type BuildFxcmPayloadResult =
  | { ok: true; payload: FxcmTrueMarketOpenPayload }
  | { ok: false; code: string; message: string; payload: null };

/**
 * Map Stage 5 proposal → FXCM OM payload.
 * Does not call the broker. amount = round(baseUnitSize × lots) must be positive integer.
 */
export function buildFxcmTrueMarketOpenPayload(input: {
  proposal: AtOrderProposalRecord;
  accountId: string;
  offerId?: string | null;
  symbol?: string | null;
  baseUnitSize?: number | null;
  bid?: number | null;
  ask?: number | null;
  timeInForce?: "IOC" | "GTC" | "FOK" | "DAY" | null;
  gtdExpiryUtc?: string | null;
}): BuildFxcmPayloadResult {
  const p = input.proposal;
  const direction = p.direction;
  if (direction !== "BUY" && direction !== "SELL") {
    return { ok: false, code: "INVALID_DIRECTION", message: "Proposal direction must be BUY or SELL.", payload: null };
  }

  const lots = p.quantity.normalizedQuantity ?? p.quantity.calculatedQuantity;
  if (!finitePositive(lots)) {
    return { ok: false, code: "QUANTITY_MISSING", message: "Proposal quantity missing or invalid.", payload: null };
  }
  const accountId = String(input.accountId || "").trim();
  if (!accountId) {
    return { ok: false, code: "ACCOUNT_IDENTITY_MISSING", message: "Account ID required for FXCM payload.", payload: null };
  }

  const symbol = String(input.symbol || p.instrument || "").trim();
  if (!symbol) {
    return { ok: false, code: "INSTRUMENT_MISSING", message: "Instrument/symbol required.", payload: null };
  }

  const baseUnitSize = input.baseUnitSize ?? p.quantity.contractSize;
  if (!finitePositive(baseUnitSize)) {
    return {
      ok: false,
      code: "CONTRACT_SIZE_UNVERIFIED",
      message: "Verified baseUnitSize/contract size required to compute FXCM AMOUNT.",
      payload: null,
    };
  }

  const rawAmount = Number(baseUnitSize) * Number(lots);
  const amount = Math.round(rawAmount);
  if (!(amount > 0) || Math.abs(rawAmount - amount) > 1e-9) {
    return {
      ok: false,
      code: "INVALID_AMOUNT",
      message: `baseUnitSize(${baseUnitSize}) * lots(${lots}) must yield a positive integer AMOUNT (got ${rawAmount}).`,
      payload: null,
    };
  }

  const stop = p.pricePlan.stopLoss;
  const take = p.pricePlan.takeProfit;
  if (!finitePositive(stop)) {
    return { ok: false, code: "STOP_LOSS_MISSING", message: "Stop Loss required on payload — protection not assumed.", payload: null };
  }
  if (!finitePositive(take)) {
    return { ok: false, code: "TAKE_PROFIT_MISSING", message: "Take Profit required on payload — protection not assumed.", payload: null };
  }

  const bid = finitePositive(input.bid) ? input.bid : null;
  const ask = finitePositive(input.ask) ? input.ask : null;
  const ref = direction === "BUY" ? ask : bid;
  if (ref != null) {
    if (direction === "BUY" && !(stop < ref)) {
      return { ok: false, code: "STOP_LOSS_GEOMETRY_INVALID", message: "BUY stop must be below current ask.", payload: null };
    }
    if (direction === "SELL" && !(stop > ref)) {
      return { ok: false, code: "STOP_LOSS_GEOMETRY_INVALID", message: "SELL stop must be above current bid.", payload: null };
    }
    if (direction === "BUY" && !(take > ref)) {
      return { ok: false, code: "TAKE_PROFIT_GEOMETRY_INVALID", message: "BUY take-profit must be above current ask.", payload: null };
    }
    if (direction === "SELL" && !(take < ref)) {
      return { ok: false, code: "TAKE_PROFIT_GEOMETRY_INVALID", message: "SELL take-profit must be below current bid.", payload: null };
    }
  }

  const tif = input.timeInForce ?? "IOC"; // FXCM OM default per sidecar probe
  if (tif === "GTC" && input.gtdExpiryUtc) {
    return {
      ok: false,
      code: "INVALID_TIF_EXPIRY",
      message: "GTC must not carry GTD expiry.",
      payload: null,
    };
  }
  // GTD not modelled for OM in Stage 6 — fail closed if requested.
  if (String(tif).toUpperCase() === "GTD" || (input.gtdExpiryUtc && tif !== "GTC" && tif !== "IOC" && tif !== "FOK" && tif !== "DAY")) {
    return {
      ok: false,
      code: "UNSUPPORTED_TIF",
      message: "GTD / unsupported TIF not modelled for TRUE_MARKET_OPEN in Stage 6 — fail closed.",
      payload: null,
    };
  }

  const payload: FxcmTrueMarketOpenPayload = {
    orderTypeConstant: "TRUE_MARKET_OPEN",
    accountId,
    buySell: direction,
    amount,
    lots,
    symbol,
    offerId: input.offerId != null ? String(input.offerId) : null,
    rateStop: stop,
    rateLimit: take,
    protectionIncomplete: false,
    timeInForce: tif,
    gtdExpiryUtc: null,
    plannedEntryPrice: p.pricePlan.entryPrice,
    executableBid: bid,
    executableAsk: ask,
    note:
      "Canonical FXCM create_order_request fields for TRUE_MARKET_OPEN with RATE_STOP/RATE_LIMIT. "
      + "Planned entry ≠ guaranteed fill price (market order). Construction only — not submitted in Stage 6.",
  };

  return { ok: true, payload };
}

/** Serialize payload for audit without secrets. */
export function redactFxcmPayloadForAudit(payload: FxcmTrueMarketOpenPayload): Record<string, unknown> {
  return {
    orderTypeConstant: payload.orderTypeConstant,
    accountIdMasked: payload.accountId.length > 4
      ? `${payload.accountId.slice(0, 2)}***${payload.accountId.slice(-2)}`
      : "***",
    buySell: payload.buySell,
    amount: payload.amount,
    lots: payload.lots,
    symbol: payload.symbol,
    offerId: payload.offerId,
    rateStop: payload.rateStop,
    rateLimit: payload.rateLimit,
    protectionIncomplete: payload.protectionIncomplete,
    timeInForce: payload.timeInForce,
    plannedEntryPrice: payload.plannedEntryPrice,
    executableBid: payload.executableBid,
    executableAsk: payload.executableAsk,
  };
}
