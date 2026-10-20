/**
 * Phase 56.2.4 — Derive simulation Entry/SL/TP/quantity from verified quote + analysis levels.
 * Never invents stop distances, ounces, or prices without evidence.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import type { AtSimContractMetaInput } from "./types.js";

export interface AnalysisPriceLevelLite {
  price: number | null | undefined;
}

export type ProposeLevelsResult =
  | {
    ok: true;
    direction: AtBinaryDirection;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    stopDistance: number;
    entrySource: string;
    stopLossSource: string;
    takeProfitSource: "3R_FROM_VERIFIED_STOP_DISTANCE";
  }
  | {
    ok: false;
    code: string;
    message: string;
    direction: AtBinaryDirection | null;
    entryPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
  };

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function roundToDigits(price: number, digits: number | null | undefined): number {
  if (typeof digits === "number" && Number.isFinite(digits) && digits >= 0 && digits <= 12) {
    const f = 10 ** Math.floor(digits);
    return Math.round(price * f) / f;
  }
  return price;
}

/**
 * Entry from verified quote: BUY uses ask (or mid), SELL uses bid (or mid).
 */
export function proposeEntryFromQuote(input: {
  direction: AtBinaryDirection | null | undefined;
  bid: number | null | undefined;
  ask: number | null | undefined;
  mid: number | null | undefined;
  quoteFresh: boolean | null | undefined;
}): { ok: true; entryPrice: number; source: string } | { ok: false; code: string; message: string } {
  const dir = input.direction;
  if (dir !== "BUY" && dir !== "SELL") {
    return { ok: false, code: "PROPOSE_ENTRY_DIRECTION_MISSING", message: "Direction missing — cannot propose entry." };
  }
  if (input.quoteFresh === false) {
    return {
      ok: false,
      code: "PROPOSE_ENTRY_QUOTE_STALE",
      message: "Quote is not fresh — entry not proposed from stale market data.",
    };
  }
  if (dir === "BUY") {
    if (finitePositive(input.ask)) return { ok: true, entryPrice: input.ask, source: "verification-ask" };
    if (finitePositive(input.mid)) return { ok: true, entryPrice: input.mid, source: "verification-mid" };
  } else {
    if (finitePositive(input.bid)) return { ok: true, entryPrice: input.bid, source: "verification-bid" };
    if (finitePositive(input.mid)) return { ok: true, entryPrice: input.mid, source: "verification-mid" };
  }
  return {
    ok: false,
    code: "PROPOSE_ENTRY_QUOTE_MISSING",
    message: "Verified bid/ask/mid unavailable — entry not invented.",
  };
}

/**
 * Pick protective SL from analysis support (BUY) or resistance (SELL).
 * Never invents a fixed pip distance.
 */
export function proposeStopFromAnalysisLevels(input: {
  direction: AtBinaryDirection;
  entryPrice: number;
  supportLevels: AnalysisPriceLevelLite[] | null | undefined;
  resistanceLevels: AnalysisPriceLevelLite[] | null | undefined;
}): { ok: true; stopLoss: number; source: string } | { ok: false; code: string; message: string } {
  const entry = input.entryPrice;
  if (input.direction === "BUY") {
    const below = (input.supportLevels ?? [])
      .map((l) => l.price)
      .filter((p): p is number => finitePositive(p) && p < entry)
      .sort((a, b) => b - a);
    if (!below.length) {
      return {
        ok: false,
        code: "PROPOSE_SL_SUPPORT_MISSING",
        message: "No verified analysis support level below entry — Stop Loss not invented.",
      };
    }
    return { ok: true, stopLoss: below[0], source: "analysis-support-nearest-below-entry" };
  }
  const above = (input.resistanceLevels ?? [])
    .map((l) => l.price)
    .filter((p): p is number => finitePositive(p) && p > entry)
    .sort((a, b) => a - b);
  if (!above.length) {
    return {
      ok: false,
      code: "PROPOSE_SL_RESISTANCE_MISSING",
      message: "No verified analysis resistance level above entry — Stop Loss not invented.",
    };
  }
  return { ok: true, stopLoss: above[0], source: "analysis-resistance-nearest-above-entry" };
}

/** Price-only 3R TP from verified entry/SL geometry (no monetary R required). */
export function proposeTakeProfit3RPrice(input: {
  direction: AtBinaryDirection;
  entryPrice: number;
  stopLoss: number;
  digits: number | null | undefined;
}): { ok: true; takeProfit: number; stopDistance: number } | { ok: false; code: string; message: string } {
  const move = Math.abs(input.entryPrice - input.stopLoss);
  if (!(move > 0)) {
    return { ok: false, code: "PROPOSE_TP_ZERO_DISTANCE", message: "Stop distance is zero — 3R TP not defined." };
  }
  if (input.direction === "BUY" && !(input.stopLoss < input.entryPrice)) {
    return { ok: false, code: "PROPOSE_TP_BUY_SL_GEOMETRY", message: "BUY Stop Loss must be below entry." };
  }
  if (input.direction === "SELL" && !(input.stopLoss > input.entryPrice)) {
    return { ok: false, code: "PROPOSE_TP_SELL_SL_GEOMETRY", message: "SELL Stop Loss must be above entry." };
  }
  const raw = input.direction === "BUY"
    ? input.entryPrice + 3 * move
    : input.entryPrice - 3 * move;
  const takeProfit = roundToDigits(raw, input.digits);
  if (input.direction === "BUY" && !(takeProfit > input.entryPrice)) {
    return { ok: false, code: "PROPOSE_TP_BUY_INVALID", message: "Computed BUY 3R TP is not above entry." };
  }
  if (input.direction === "SELL" && !(takeProfit < input.entryPrice)) {
    return { ok: false, code: "PROPOSE_TP_SELL_INVALID", message: "Computed SELL 3R TP is not below entry." };
  }
  return { ok: true, takeProfit, stopDistance: move };
}

export function proposeSimLevels(input: {
  direction: AtBinaryDirection | null | undefined;
  bid: number | null | undefined;
  ask: number | null | undefined;
  mid: number | null | undefined;
  quoteFresh: boolean | null | undefined;
  supportLevels: AnalysisPriceLevelLite[] | null | undefined;
  resistanceLevels: AnalysisPriceLevelLite[] | null | undefined;
  digits: number | null | undefined;
  /** Optional explicit overrides (tests / loaded draft) — still validated. */
  entryOverride?: number | null;
  stopLossOverride?: number | null;
  takeProfitOverride?: number | null;
}): ProposeLevelsResult {
  const dir = input.direction;
  if (dir !== "BUY" && dir !== "SELL") {
    return {
      ok: false,
      code: "PROPOSE_DIRECTION_MISSING",
      message: "No BUY/SELL direction from analysis/decision — setup not fabricated.",
      direction: null,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
    };
  }

  let entryPrice: number;
  let entrySource: string;
  if (finitePositive(input.entryOverride)) {
    entryPrice = input.entryOverride;
    entrySource = "explicit-override";
  } else {
    const e = proposeEntryFromQuote(input);
    if (!e.ok) {
      return {
        ok: false,
        code: e.code,
        message: e.message,
        direction: dir,
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
      };
    }
    entryPrice = e.entryPrice;
    entrySource = e.source;
  }

  let stopLoss: number;
  let stopLossSource: string;
  if (finitePositive(input.stopLossOverride)) {
    stopLoss = input.stopLossOverride;
    stopLossSource = "explicit-override";
  } else {
    const s = proposeStopFromAnalysisLevels({
      direction: dir,
      entryPrice,
      supportLevels: input.supportLevels,
      resistanceLevels: input.resistanceLevels,
    });
    if (!s.ok) {
      return {
        ok: false,
        code: s.code,
        message: s.message,
        direction: dir,
        entryPrice,
        stopLoss: null,
        takeProfit: null,
      };
    }
    stopLoss = s.stopLoss;
    stopLossSource = s.source;
  }

  if (finitePositive(input.takeProfitOverride)) {
    const move = Math.abs(entryPrice - stopLoss);
    return {
      ok: true,
      direction: dir,
      entryPrice,
      stopLoss,
      takeProfit: input.takeProfitOverride,
      stopDistance: move,
      entrySource,
      stopLossSource,
      takeProfitSource: "3R_FROM_VERIFIED_STOP_DISTANCE",
    };
  }

  const tp = proposeTakeProfit3RPrice({
    direction: dir,
    entryPrice,
    stopLoss,
    digits: input.digits,
  });
  if (!tp.ok) {
    return {
      ok: false,
      code: tp.code,
      message: tp.message,
      direction: dir,
      entryPrice,
      stopLoss,
      takeProfit: null,
    };
  }

  return {
    ok: true,
    direction: dir,
    entryPrice,
    stopLoss,
    takeProfit: tp.takeProfit,
    stopDistance: tp.stopDistance,
    entrySource,
    stopLossSource,
    takeProfitSource: "3R_FROM_VERIFIED_STOP_DISTANCE",
  };
}

export type ProposeQuantityResult =
  | {
    ok: true;
    quantity: number;
    estimatedStopLossRisk: number;
    riskPerUnit: number;
    maxPermittedLoss: number;
    method: "POINT_COST" | "CONTRACT_MULTIPLIER";
    quantityUnit: string;
  }
  | { ok: false; quantity: null; code: string; message: string };

/**
 * Size quantity so estimated SL risk ≤ 25% of order allocation, using verified contract fields.
 */
export function proposeQuantityFromAllocation(input: {
  orderAllocation: number | null | undefined;
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
}): ProposeQuantityResult {
  const alloc = input.orderAllocation;
  if (typeof alloc !== "number" || !Number.isFinite(alloc) || alloc <= 0) {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_ALLOCATION_INVALID",
      message: "Order allocation must be a finite positive amount.",
    };
  }
  const c = input.contract;
  if (!c?.verified) {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_CONTRACT_UNVERIFIED",
      message: "Contract metadata unverified — quantity not invented.",
    };
  }
  if (c.quantityUnitAmbiguous || !c.quantityUnit || c.quantityUnit === "unknown") {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_UNIT_AMBIGUOUS",
      message: "Quantity unit ambiguous — quantity and monetary SL risk blocked.",
    };
  }
  const entry = input.entryPrice;
  const sl = input.stopLoss;
  if (!finitePositive(entry) || !finitePositive(sl)) {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_PRICES_MISSING",
      message: "Entry/SL required to size quantity from allocation risk ceiling.",
    };
  }
  const move = Math.abs(entry - sl);
  if (!(move > 0)) {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_ZERO_DISTANCE",
      message: "Stop distance is zero — cannot size quantity.",
    };
  }

  let riskPerUnit: number | null = null;
  let method: "POINT_COST" | "CONTRACT_MULTIPLIER" | null = null;
  if (
    typeof c.pipCostAccount === "number"
    && Number.isFinite(c.pipCostAccount)
    && c.pipCostAccount > 0
    && typeof c.pointSize === "number"
    && Number.isFinite(c.pointSize)
    && c.pointSize > 0
  ) {
    riskPerUnit = (move / c.pointSize) * c.pipCostAccount;
    method = "POINT_COST";
  } else if (
    typeof c.contractMultiplier === "number"
    && Number.isFinite(c.contractMultiplier)
    && c.contractMultiplier > 0
  ) {
    riskPerUnit = move * c.contractMultiplier;
    method = "CONTRACT_MULTIPLIER";
  }
  if (riskPerUnit == null || !(riskPerUnit > 0) || method == null) {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_VALUE_PER_MOVE_UNVERIFIED",
      message: "No verified pip/point cost or contract multiplier — quantity not invented.",
    };
  }

  const maxPermittedLoss = alloc * 0.25;
  const rawQty = maxPermittedLoss / riskPerUnit;
  const step =
    typeof c.quantityStep === "number" && Number.isFinite(c.quantityStep) && c.quantityStep > 0
      ? c.quantityStep
      : 1;
  const minQ =
    typeof c.quantityMin === "number" && Number.isFinite(c.quantityMin) && c.quantityMin > 0
      ? c.quantityMin
      : step;
  // Floor to step so estimated risk never exceeds the 25% ceiling due to rounding up.
  let quantity = Math.floor(rawQty / step) * step;
  if (quantity + 1e-12 < minQ) {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_BELOW_MIN",
      message:
        `Allocation risk ceiling $${maxPermittedLoss} cannot fund minimum quantity ${minQ} `
        + `(risk/unit=${riskPerUnit}).`,
    };
  }
  // Normalize float noise
  quantity = Math.round(quantity / step) * step;
  const estimatedStopLossRisk = riskPerUnit * quantity;
  if (estimatedStopLossRisk > maxPermittedLoss + 1e-8) {
    return {
      ok: false,
      quantity: null,
      code: "PROPOSE_QTY_EXCEEDS_LOSS_LIMIT",
      message: "Sized quantity would exceed 25% per-order loss limit — blocked.",
    };
  }
  return {
    ok: true,
    quantity,
    estimatedStopLossRisk,
    riskPerUnit,
    maxPermittedLoss,
    method,
    quantityUnit: c.quantityUnit,
  };
}

/** Validate order allocation USD input (UI / API). */
export function validateOrderAllocationAmount(
  raw: unknown,
): { ok: true; amount: number } | { ok: false; code: string; message: string } {
  if (raw == null || raw === "") {
    return { ok: false, code: "ORDER_ALLOCATION_MISSING", message: "Order allocation is required." };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    return { ok: false, code: "ORDER_ALLOCATION_INVALID", message: "Order allocation must be a finite number." };
  }
  if (n <= 0) {
    return { ok: false, code: "ORDER_ALLOCATION_NON_POSITIVE", message: "Order allocation must be greater than zero." };
  }
  return { ok: true, amount: n };
}
