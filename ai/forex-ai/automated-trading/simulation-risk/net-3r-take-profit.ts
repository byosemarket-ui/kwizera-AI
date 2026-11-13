/**
 * Stage 1 — Net 3R Take Profit geometry after verified trading costs.
 *
 * Cost convention (unchanged):
 *   SL_GROSS_EXCLUDES_SPREAD__SPREAD_IS_ENTRY_FRICTION_SUBTRACTED_FROM_TP_REWARD_ONLY
 *   ModeledRisk = gross entry→SL monetary risk (no spread).
 *   GrossTPReward = monetary reward from entry→TP.
 *   NetReward = GrossTPReward − verifiedCosts (spread ± verified commission ± evidence slippage).
 *   Require NetReward / ModeledRisk >= 3.
 *
 * Never widens Stop Loss. Never increases quantity/allocation.
 * Never invents costs. Never fabricates market-structure levels.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import { estimateStopLossRisk } from "./allocation-3r.js";
import { proposeTakeProfit3RPrice } from "./propose-levels.js";
import type { AtSimContractMetaInput } from "./types.js";

export const NET_3R_MINIMUM_RATIO = 3 as const;
export const NET_3R_TP_SOURCE_GROSS = "3R_FROM_VERIFIED_STOP_DISTANCE" as const;
export const NET_3R_TP_SOURCE_COST_ADJUSTED = "NET_3R_AFTER_VERIFIED_COSTS" as const;

export type Net3RTakeProfitSource =
  | typeof NET_3R_TP_SOURCE_GROSS
  | typeof NET_3R_TP_SOURCE_COST_ADJUSTED;

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function roundToDigits(price: number, digits: number | null | undefined): number {
  if (digits == null || !Number.isInteger(digits) || digits < 0) return price;
  const f = 10 ** digits;
  return Math.round(price * f) / f;
}

function alignToTick(price: number, tickSize: number | null | undefined): number {
  if (!finitePositive(tickSize)) return price;
  return Math.round(price / tickSize) * tickSize;
}

/**
 * Invert monetary account cost → absolute price distance using verified contract economics.
 */
export function accountCostToPriceDistance(input: {
  costAccount: number;
  quantityLots: number;
  contract: AtSimContractMetaInput;
}): {
  ok: true;
  priceDistance: number;
  method: "POINT_COST" | "CONTRACT_MULTIPLIER";
} | {
  ok: false;
  code: "INSTRUMENT_METADATA_UNVERIFIED" | "COST_DISTANCE_INVALID";
  message: string;
} {
  const c = input.contract;
  if (!c.verified) {
    return {
      ok: false,
      code: "INSTRUMENT_METADATA_UNVERIFIED",
      message: "Contract metadata unverified — cannot convert cost to price distance.",
    };
  }
  if (!finitePositive(input.quantityLots) || !finiteNonNeg(input.costAccount)) {
    return {
      ok: false,
      code: "COST_DISTANCE_INVALID",
      message: "Quantity/cost invalid for price-distance conversion.",
    };
  }
  if (input.costAccount === 0) {
    return { ok: true, priceDistance: 0, method: "POINT_COST" };
  }

  if (
    finitePositive(c.pointSize)
    && finitePositive(c.pipCostAccount)
  ) {
    const distance = (input.costAccount / (c.pipCostAccount * input.quantityLots)) * c.pointSize;
    if (!(distance >= 0) || !Number.isFinite(distance)) {
      return { ok: false, code: "COST_DISTANCE_INVALID", message: "POINT_COST distance invalid." };
    }
    return { ok: true, priceDistance: distance, method: "POINT_COST" };
  }

  if (finitePositive(c.contractMultiplier)) {
    const distance = input.costAccount / (c.contractMultiplier * input.quantityLots);
    if (!(distance >= 0) || !Number.isFinite(distance)) {
      return {
        ok: false,
        code: "COST_DISTANCE_INVALID",
        message: "CONTRACT_MULTIPLIER distance invalid.",
      };
    }
    return { ok: true, priceDistance: distance, method: "CONTRACT_MULTIPLIER" };
  }

  return {
    ok: false,
    code: "INSTRUMENT_METADATA_UNVERIFIED",
    message: "Neither POINT_COST nor CONTRACT_MULTIPLIER economics verified.",
  };
}

export type ProposeNetAwareTakeProfitResult =
  | {
    ok: true;
    takeProfit: number;
    stopDistance: number;
    rewardDistance: number;
    grossRewardRiskRatio: number;
    netRewardRiskRatio: number | null;
    modeledStopLossRiskAccount: number | null;
    grossTakeProfitRewardAccount: number | null;
    netTakeProfitRewardAccount: number | null;
    verifiedTradingCostsAccount: number;
    takeProfitSource: Net3RTakeProfitSource;
    stopLossUnchanged: true;
    quantityUnchanged: true;
    technicalBoundApplied: boolean;
    note: string;
  }
  | {
    ok: false;
    code:
      | "PROPOSE_TP_ZERO_DISTANCE"
      | "PROPOSE_TP_BUY_SL_GEOMETRY"
      | "PROPOSE_TP_SELL_SL_GEOMETRY"
      | "PROPOSE_TP_BUY_INVALID"
      | "PROPOSE_TP_SELL_INVALID"
      | "TRADING_COST_UNVERIFIED"
      | "TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R"
      | "TP_OUTSIDE_VALID_MARKET_STRUCTURE"
      | "TP_PRICE_INVALID"
      | "NET_REWARD_BELOW_3R"
      | "INSTRUMENT_METADATA_UNVERIFIED"
      | "QUANTITY_INVALID";
    message: string;
    takeProfit: null;
    stopLossUnchanged: true;
    quantityUnchanged: true;
  };

/**
 * Propose TP that satisfies NetReward/ModeledRisk >= 3 after verified costs.
 *
 * - Gross geometric 3R is the minimum technical floor from entry–SL distance.
 * - When verifiedCosts > 0, TP is extended just enough for net 3R (same SL geometry).
 * - Optional technicalRewardDistanceMax: farthest valid market-structure reward distance;
 *   if required distance exceeds it → TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R.
 */
export function proposeTakeProfitNetAware3R(input: {
  direction: AtBinaryDirection;
  entryPrice: number;
  stopLoss: number;
  quantityLots: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
  /** Verified entry friction in account currency (spread ± commission ± slippage). */
  verifiedTradingCostsAccount?: number | null | undefined;
  costsVerified?: boolean | null | undefined;
  digits?: number | null | undefined;
  tickSize?: number | null | undefined;
  /**
   * Optional farthest valid reward distance from market structure (absolute price).
   * BUY: max TP − entry; SELL: entry − min TP. Null = no structure ceiling.
   */
  technicalRewardDistanceMax?: number | null | undefined;
}): ProposeNetAwareTakeProfitResult {
  const gross = proposeTakeProfit3RPrice({
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    digits: input.digits,
  });
  if (!gross.ok) {
    return {
      ok: false,
      code: gross.code as ProposeNetAwareTakeProfitResult extends { ok: false; code: infer C } ? C : never,
      message: gross.message,
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  const claimedCosts = finiteNonNeg(input.verifiedTradingCostsAccount)
    ? input.verifiedTradingCostsAccount!
    : 0;
  // Non-zero claimed costs without verification must not silently become gross-only 3R.
  if (claimedCosts > 0 && input.costsVerified !== true) {
    return {
      ok: false,
      code: "TRADING_COST_UNVERIFIED",
      message: "Non-zero trading costs claimed without costsVerified=true.",
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }
  const costsVerified = input.costsVerified === true && finiteNonNeg(input.verifiedTradingCostsAccount);
  const costs = costsVerified ? claimedCosts : 0;

  // No verified costs → keep exact gross 3R floor (policy minimum).
  if (!costsVerified || costs === 0) {
    let tp = gross.takeProfit;
    tp = alignToTick(tp, input.tickSize);
    tp = roundToDigits(tp, input.digits);
    const rewardDistance = Math.abs(tp - input.entryPrice);
    if (rewardDistance / gross.stopDistance + 1e-9 < NET_3R_MINIMUM_RATIO) {
      return {
        ok: false,
        code: "NET_REWARD_BELOW_3R",
        message: "Normalized gross TP fell below 3R after tick/digit alignment.",
        takeProfit: null,
        stopLossUnchanged: true,
        quantityUnchanged: true,
      };
    }
    if (
      finitePositive(input.technicalRewardDistanceMax)
      && rewardDistance > input.technicalRewardDistanceMax + 1e-12
    ) {
      return {
        ok: false,
        code: "TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R",
        message:
          `Required 3R reward distance ${rewardDistance} exceeds technical maximum `
          + `${input.technicalRewardDistanceMax} — rejecting rather than inventing TP beyond structure.`,
        takeProfit: null,
        stopLossUnchanged: true,
        quantityUnchanged: true,
      };
    }
    return {
      ok: true,
      takeProfit: tp,
      stopDistance: gross.stopDistance,
      rewardDistance,
      grossRewardRiskRatio: rewardDistance / gross.stopDistance,
      netRewardRiskRatio: rewardDistance / gross.stopDistance,
      modeledStopLossRiskAccount: null,
      grossTakeProfitRewardAccount: null,
      netTakeProfitRewardAccount: null,
      verifiedTradingCostsAccount: 0,
      takeProfitSource: NET_3R_TP_SOURCE_GROSS,
      stopLossUnchanged: true,
      quantityUnchanged: true,
      technicalBoundApplied: false,
      note: "No verified trading costs — TP at gross geometric 3R minimum.",
    };
  }

  if (!finitePositive(input.quantityLots)) {
    return {
      ok: false,
      code: "QUANTITY_INVALID",
      message: "Quantity required to size net-3R TP after verified costs.",
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }
  if (!input.contract || input.contract.verified !== true) {
    return {
      ok: false,
      code: "INSTRUMENT_METADATA_UNVERIFIED",
      message: "Verified contract required for cost-adjusted TP.",
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  const slRisk = estimateStopLossRisk({
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    quantity: input.quantityLots,
    contract: input.contract,
  });
  if (!slRisk.ok) {
    return {
      ok: false,
      code: "INSTRUMENT_METADATA_UNVERIFIED",
      message: slRisk.message,
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  // Required gross reward so that (gross − costs) / R >= 3  ⇒  gross >= 3R + costs
  const requiredGrossReward = NET_3R_MINIMUM_RATIO * slRisk.estimatedStopLossRisk + costs;
  const distConv = accountCostToPriceDistance({
    costAccount: requiredGrossReward,
    quantityLots: input.quantityLots,
    contract: input.contract,
  });
  if (!distConv.ok) {
    return {
      ok: false,
      code: distConv.code === "INSTRUMENT_METADATA_UNVERIFIED"
        ? "INSTRUMENT_METADATA_UNVERIFIED"
        : "TRADING_COST_UNVERIFIED",
      message: distConv.message,
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  const minRewardDistance = Math.max(3 * gross.stopDistance, distConv.priceDistance);

  if (
    finitePositive(input.technicalRewardDistanceMax)
    && minRewardDistance > input.technicalRewardDistanceMax + 1e-12
  ) {
    return {
      ok: false,
      code: "TECHNICAL_TARGET_CANNOT_SUPPORT_NET_3R",
      message:
        `Required reward distance ${minRewardDistance} exceeds technical maximum `
        + `${input.technicalRewardDistanceMax} — rejecting rather than inventing TP beyond structure.`,
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  // 3R is a minimum, not a profit ceiling. When valid market structure supports a
  // farther target, use that distance (open-ended within technicalRewardDistanceMax).
  let chosenRewardDistance = minRewardDistance;
  if (
    finitePositive(input.technicalRewardDistanceMax)
    && input.technicalRewardDistanceMax + 1e-12 >= minRewardDistance
  ) {
    chosenRewardDistance = input.technicalRewardDistanceMax;
  }

  let rawTp = input.direction === "BUY"
    ? input.entryPrice + chosenRewardDistance
    : input.entryPrice - chosenRewardDistance;
  rawTp = alignToTick(rawTp, input.tickSize);
  rawTp = roundToDigits(rawTp, input.digits);

  if (input.direction === "BUY" && !(rawTp > input.entryPrice)) {
    return {
      ok: false,
      code: "TP_PRICE_INVALID",
      message: "Cost-adjusted BUY TP is not above entry.",
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }
  if (input.direction === "SELL" && !(rawTp < input.entryPrice)) {
    return {
      ok: false,
      code: "TP_PRICE_INVALID",
      message: "Cost-adjusted SELL TP is not below entry.",
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  const rewardDistance = Math.abs(rawTp - input.entryPrice);
  const tpRisk = estimateStopLossRisk({
    entryPrice: input.entryPrice,
    stopLoss: rawTp,
    quantity: input.quantityLots,
    contract: input.contract,
  });
  if (!tpRisk.ok) {
    return {
      ok: false,
      code: "TRADING_COST_UNVERIFIED",
      message: tpRisk.message,
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  const grossReward = tpRisk.estimatedStopLossRisk;
  const netReward = grossReward - costs;
  const netRatio = slRisk.estimatedStopLossRisk > 0
    ? netReward / slRisk.estimatedStopLossRisk
    : null;

  if (netRatio == null || netRatio + 1e-9 < NET_3R_MINIMUM_RATIO) {
    return {
      ok: false,
      code: "NET_REWARD_BELOW_3R",
      message:
        `Net reward/risk ${netRatio?.toFixed(4) ?? "n/a"} below required ${NET_3R_MINIMUM_RATIO} `
        + `after verified costs ${costs}.`,
      takeProfit: null,
      stopLossUnchanged: true,
      quantityUnchanged: true,
    };
  }

  return {
    ok: true,
    takeProfit: rawTp,
    stopDistance: gross.stopDistance,
    rewardDistance,
    grossRewardRiskRatio: rewardDistance / gross.stopDistance,
    netRewardRiskRatio: netRatio,
    modeledStopLossRiskAccount: slRisk.estimatedStopLossRisk,
    grossTakeProfitRewardAccount: grossReward,
    netTakeProfitRewardAccount: netReward,
    verifiedTradingCostsAccount: costs,
    takeProfitSource: costs > 0 ? NET_3R_TP_SOURCE_COST_ADJUSTED : NET_3R_TP_SOURCE_GROSS,
    stopLossUnchanged: true,
    quantityUnchanged: true,
    technicalBoundApplied: finitePositive(input.technicalRewardDistanceMax),
    note:
      chosenRewardDistance > minRewardDistance + 1e-12
        ? `TP at technical structure distance ${chosenRewardDistance} (net R:R ${netRatio?.toFixed(4)}; `
          + `minimum ${NET_3R_MINIMUM_RATIO}R satisfied; not clipped to exact 3R). SL/qty unchanged.`
        : costs > 0
          ? `TP at net ≥${NET_3R_MINIMUM_RATIO}R minimum after verified costs ${costs}; SL and quantity unchanged.`
          : `TP at gross geometric ${NET_3R_MINIMUM_RATIO}R minimum (open-ended when structure allows more).`,
  };
}
