/**
 * Stage 5 — Automatic Entry / Stop Loss / Take Profit level derivation.
 * Reuses simulation-risk propose-levels. Never invents fixed pip distances.
 * ATR is used only when verified ATR exists (technical evidence), never as a silent guess.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import {
  proposeEntryFromQuote,
  proposeSimLevels,
  proposeStopFromAnalysisLevels,
  proposeTakeProfit3RPrice,
  type AnalysisPriceLevelLite,
} from "../simulation-risk/propose-levels.js";

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
 * Protective SL from verified ATR when structure levels are unavailable.
 * Distance = ATR × multiplier (default 1.0). Not invented when ATR missing/invalid.
 */
export function proposeStopFromVerifiedAtr(input: {
  direction: AtBinaryDirection;
  entryPrice: number;
  atrValue: number | null | undefined;
  atrMethod?: string | null;
  atrMultiplier?: number | null;
  digits?: number | null;
}): { ok: true; stopLoss: number; source: string } | { ok: false; code: string; message: string } {
  if (!finitePositive(input.atrValue)) {
    return {
      ok: false,
      code: "WAITING_FOR_VALID_STOP_LOSS",
      message: "No verified ATR — Stop Loss not invented without structure or ATR evidence.",
    };
  }
  const mult =
    typeof input.atrMultiplier === "number"
    && Number.isFinite(input.atrMultiplier)
    && input.atrMultiplier > 0
      ? input.atrMultiplier
      : 1;
  const distance = input.atrValue * mult;
  if (!(distance > 0)) {
    return {
      ok: false,
      code: "WAITING_FOR_VALID_STOP_LOSS",
      message: "ATR-derived stop distance is non-positive — Stop Loss not invented.",
    };
  }
  const raw = input.direction === "BUY"
    ? input.entryPrice - distance
    : input.entryPrice + distance;
  if (!(raw > 0)) {
    return {
      ok: false,
      code: "STOP_LOSS_INVALID",
      message: "ATR-derived Stop Loss is non-positive.",
    };
  }
  const stopLoss = roundToDigits(raw, input.digits);
  if (input.direction === "BUY" && !(stopLoss < input.entryPrice)) {
    return {
      ok: false,
      code: "STOP_LOSS_INVALID",
      message: "ATR BUY Stop Loss must be below entry.",
    };
  }
  if (input.direction === "SELL" && !(stopLoss > input.entryPrice)) {
    return {
      ok: false,
      code: "STOP_LOSS_INVALID",
      message: "ATR SELL Stop Loss must be above entry.",
    };
  }
  const method = String(input.atrMethod ?? "ATR").trim() || "ATR";
  return {
    ok: true,
    stopLoss,
    source: `verified-atr-${method}-x${mult}`,
  };
}

export type AutoLevelsResult =
  | {
    ok: true;
    direction: AtBinaryDirection;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    stopDistance: number;
    entrySource: string;
    stopLossSource: string;
    takeProfitSource: string;
    structureUsed: boolean;
    atrValue: number | null;
    atrMethod: string | null;
  }
  | {
    ok: false;
    code: string;
    message: string;
    direction: AtBinaryDirection | null;
    entryPrice: number | null;
    stopLoss: number | null;
    takeProfit: number | null;
    waitingForValidStopLoss: boolean;
  };

/**
 * Derive Entry/SL/TP automatically for Stage 5 proposal preparation.
 * Priority: explicit overrides → quote entry → structure SL → ATR SL → fail closed.
 * TP always from verified Entry–SL distance × 3 (price geometry; monetary 3R validated later).
 */
export function deriveAutomaticOrderLevels(input: {
  direction: AtBinaryDirection | null | undefined;
  bid: number | null | undefined;
  ask: number | null | undefined;
  mid: number | null | undefined;
  quoteFresh: boolean | null | undefined;
  supportLevels: AnalysisPriceLevelLite[] | null | undefined;
  resistanceLevels: AnalysisPriceLevelLite[] | null | undefined;
  atrValue?: number | null;
  atrMethod?: string | null;
  atrMultiplier?: number | null;
  digits?: number | null;
  entryOverride?: number | null;
  stopLossOverride?: number | null;
  takeProfitOverride?: number | null;
}): AutoLevelsResult {
  const dir = input.direction;
  if (dir !== "BUY" && dir !== "SELL") {
    return {
      ok: false,
      code: "DIRECTION_MISSING",
      message: "Eligible BUY or SELL required — levels not invented.",
      direction: null,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      waitingForValidStopLoss: false,
    };
  }

  // Prefer full structure path when possible.
  const structured = proposeSimLevels({
    direction: dir,
    bid: input.bid,
    ask: input.ask,
    mid: input.mid,
    quoteFresh: input.quoteFresh,
    supportLevels: input.supportLevels,
    resistanceLevels: input.resistanceLevels,
    digits: input.digits,
    entryOverride: input.entryOverride,
    stopLossOverride: input.stopLossOverride,
    takeProfitOverride: input.takeProfitOverride,
  });

  if (structured.ok) {
    return {
      ok: true,
      direction: structured.direction,
      entryPrice: structured.entryPrice,
      stopLoss: structured.stopLoss,
      takeProfit: structured.takeProfit,
      stopDistance: structured.stopDistance,
      entrySource: structured.entrySource,
      stopLossSource: structured.stopLossSource,
      takeProfitSource: structured.takeProfitSource,
      structureUsed: !String(structured.stopLossSource).startsWith("explicit"),
      atrValue: finitePositive(input.atrValue) ? input.atrValue : null,
      atrMethod: input.atrMethod ?? null,
    };
  }

  // Structure failed — try ATR SL if entry can be resolved and SL not overridden.
  let entryPrice: number | null = null;
  let entrySource = "unresolved";
  if (finitePositive(input.entryOverride)) {
    entryPrice = input.entryOverride;
    entrySource = "explicit-override";
  } else {
    const e = proposeEntryFromQuote({
      direction: dir,
      bid: input.bid,
      ask: input.ask,
      mid: input.mid,
      quoteFresh: input.quoteFresh,
    });
    if (e.ok) {
      entryPrice = e.entryPrice;
      entrySource = e.source;
    }
  }

  if (entryPrice == null) {
    return {
      ok: false,
      code: structured.code.startsWith("PROPOSE_ENTRY") ? structured.code : "ENTRY_UNAVAILABLE",
      message: structured.message,
      direction: dir,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      waitingForValidStopLoss: false,
    };
  }

  if (finitePositive(input.stopLossOverride)) {
    const tp = finitePositive(input.takeProfitOverride)
      ? { ok: true as const, takeProfit: input.takeProfitOverride, stopDistance: Math.abs(entryPrice - input.stopLossOverride) }
      : proposeTakeProfit3RPrice({
        direction: dir,
        entryPrice,
        stopLoss: input.stopLossOverride,
        digits: input.digits,
      });
    if (!tp.ok) {
      return {
        ok: false,
        code: tp.code,
        message: tp.message,
        direction: dir,
        entryPrice,
        stopLoss: input.stopLossOverride,
        takeProfit: null,
        waitingForValidStopLoss: false,
      };
    }
    return {
      ok: true,
      direction: dir,
      entryPrice,
      stopLoss: input.stopLossOverride,
      takeProfit: tp.takeProfit,
      stopDistance: tp.stopDistance,
      entrySource,
      stopLossSource: "explicit-override",
      takeProfitSource: finitePositive(input.takeProfitOverride)
        ? "explicit-override"
        : "3R_FROM_VERIFIED_STOP_DISTANCE",
      structureUsed: false,
      atrValue: finitePositive(input.atrValue) ? input.atrValue : null,
      atrMethod: input.atrMethod ?? null,
    };
  }

  // Retry structure with resolved entry (already tried via proposeSimLevels).
  const structureRetry = proposeStopFromAnalysisLevels({
    direction: dir,
    entryPrice,
    supportLevels: input.supportLevels,
    resistanceLevels: input.resistanceLevels,
  });
  if (structureRetry.ok) {
    const tp = proposeTakeProfit3RPrice({
      direction: dir,
      entryPrice,
      stopLoss: structureRetry.stopLoss,
      digits: input.digits,
    });
    if (!tp.ok) {
      return {
        ok: false,
        code: tp.code,
        message: tp.message,
        direction: dir,
        entryPrice,
        stopLoss: structureRetry.stopLoss,
        takeProfit: null,
        waitingForValidStopLoss: false,
      };
    }
    return {
      ok: true,
      direction: dir,
      entryPrice,
      stopLoss: structureRetry.stopLoss,
      takeProfit: tp.takeProfit,
      stopDistance: tp.stopDistance,
      entrySource,
      stopLossSource: structureRetry.source,
      takeProfitSource: "3R_FROM_VERIFIED_STOP_DISTANCE",
      structureUsed: true,
      atrValue: finitePositive(input.atrValue) ? input.atrValue : null,
      atrMethod: input.atrMethod ?? null,
    };
  }

  const atrStop = proposeStopFromVerifiedAtr({
    direction: dir,
    entryPrice,
    atrValue: input.atrValue,
    atrMethod: input.atrMethod,
    atrMultiplier: input.atrMultiplier,
    digits: input.digits,
  });
  if (!atrStop.ok) {
    return {
      ok: false,
      code: atrStop.code === "WAITING_FOR_VALID_STOP_LOSS"
        ? "WAITING_FOR_VALID_STOP_LOSS"
        : atrStop.code,
      message:
        `${structureRetry.message} ${atrStop.message}`.trim(),
      direction: dir,
      entryPrice,
      stopLoss: null,
      takeProfit: null,
      waitingForValidStopLoss: true,
    };
  }

  const tp = proposeTakeProfit3RPrice({
    direction: dir,
    entryPrice,
    stopLoss: atrStop.stopLoss,
    digits: input.digits,
  });
  if (!tp.ok) {
    return {
      ok: false,
      code: tp.code,
      message: tp.message,
      direction: dir,
      entryPrice,
      stopLoss: atrStop.stopLoss,
      takeProfit: null,
      waitingForValidStopLoss: false,
    };
  }

  return {
    ok: true,
    direction: dir,
    entryPrice,
    stopLoss: atrStop.stopLoss,
    takeProfit: tp.takeProfit,
    stopDistance: tp.stopDistance,
    entrySource,
    stopLossSource: atrStop.source,
    takeProfitSource: "3R_FROM_VERIFIED_STOP_DISTANCE",
    structureUsed: false,
    atrValue: finitePositive(input.atrValue) ? input.atrValue : null,
    atrMethod: input.atrMethod ?? null,
  };
}
