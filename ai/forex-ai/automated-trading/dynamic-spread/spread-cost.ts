/**
 * Per-order spread cost in account currency.
 * Reuses the same POINT_COST / CONTRACT_MULTIPLIER economics as estimateStopLossRisk.
 * Never invents pip values, multipliers, or conversion rates.
 */
import { estimateStopLossRisk } from "../simulation-risk/allocation-3r.js";
import type { AtSimContractMetaInput } from "../simulation-risk/types.js";
import {
  DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION,
  type DynamicSpreadCostBreakdown,
  type DynamicSpreadNetRewardResult,
  type DynamicSpreadStopLossImpact,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

/**
 * Convert an absolute price distance into account-currency cost for `quantityLots`
 * using verified contract economics (same methods as SL risk).
 */
export function priceDistanceToAccountCost(input: {
  priceDistance: number | null | undefined;
  quantityLots: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
}): {
  ok: true;
  costAccount: number;
  method: "POINT_COST" | "CONTRACT_MULTIPLIER";
} | {
  ok: false;
  code: "INSTRUMENT_METADATA_UNVERIFIED" | "SPREAD_COST_UNVERIFIED" | "QUANTITY_INVALID";
  message: string;
} {
  if (!finitePositive(input.quantityLots)) {
    return { ok: false, code: "QUANTITY_INVALID", message: "Quantity lots missing or invalid." };
  }
  if (!input.contract || input.contract.verified !== true) {
    return {
      ok: false,
      code: "INSTRUMENT_METADATA_UNVERIFIED",
      message: "Contract metadata not verified — spread cost not invented.",
    };
  }
  if (!finitePositive(input.priceDistance)) {
    return {
      ok: false,
      code: "SPREAD_COST_UNVERIFIED",
      message: "Price distance missing — cannot compute spread cost.",
    };
  }

  // Reuse SL estimator by treating distance as entry→syntheticStop.
  // Entry must exceed distance so stop stays positive (XAU spreads can be ≥1.0 absolute).
  const entry = Math.max(10, input.priceDistance * 2 + 1);
  const stop = entry - input.priceDistance;
  const est = estimateStopLossRisk({
    entryPrice: entry,
    stopLoss: stop,
    quantity: input.quantityLots,
    contract: input.contract,
  });
  if (!est.ok) {
    return {
      ok: false,
      code: "INSTRUMENT_METADATA_UNVERIFIED",
      message: est.message,
    };
  }
  return {
    ok: true,
    costAccount: est.estimatedStopLossRisk,
    method: est.method,
  };
}

export function buildSpreadCostBreakdown(input: {
  spreadAbsolute: number | null;
  quantityLots: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
  accountCurrency?: string | null;
  commissionAccount?: number | null;
  commissionVerified?: boolean | null;
  slippageEstimateAccount?: number | null;
  slippageEvidenceAvailable?: boolean | null;
}): {
  breakdown: DynamicSpreadCostBreakdown;
  verified: boolean;
  failCode: "SPREAD_COST_UNVERIFIED" | "INSTRUMENT_METADATA_UNVERIFIED" | "QUANTITY_INVALID" | null;
} {
  const commissionVerified = input.commissionVerified === true
    && finiteNonNeg(input.commissionAccount);
  const slippageOk = input.slippageEvidenceAvailable === true
    && finiteNonNeg(input.slippageEstimateAccount);

  if (!finitePositive(input.spreadAbsolute)) {
    return {
      verified: false,
      failCode: "SPREAD_COST_UNVERIFIED",
      breakdown: {
        spreadAbsolute: null,
        spreadCostAccount: null,
        commissionAccount: commissionVerified ? input.commissionAccount! : null,
        slippageEstimateAccount: slippageOk ? input.slippageEstimateAccount! : null,
        totalEntryFrictionAccount: null,
        method: null,
        commissionStatus: commissionVerified ? "VERIFIED" : "NOT_VERIFIED",
        slippageStatus: slippageOk ? "EVIDENCE_AVAILABLE" : "UNAVAILABLE",
        currency: input.accountCurrency ?? null,
        note: "Spread absolute missing — entry friction not computed.",
      },
    };
  }

  const dist = priceDistanceToAccountCost({
    priceDistance: input.spreadAbsolute,
    quantityLots: input.quantityLots,
    contract: input.contract,
  });
  if (!dist.ok) {
    return {
      verified: false,
      failCode: dist.code,
      breakdown: {
        spreadAbsolute: input.spreadAbsolute,
        spreadCostAccount: null,
        commissionAccount: commissionVerified ? input.commissionAccount! : null,
        slippageEstimateAccount: slippageOk ? input.slippageEstimateAccount! : null,
        totalEntryFrictionAccount: null,
        method: null,
        commissionStatus: commissionVerified ? "VERIFIED" : "NOT_VERIFIED",
        slippageStatus: slippageOk ? "EVIDENCE_AVAILABLE" : "UNAVAILABLE",
        currency: input.accountCurrency ?? null,
        note: dist.message,
      },
    };
  }

  const commission = commissionVerified ? input.commissionAccount! : 0;
  const slippage = slippageOk ? input.slippageEstimateAccount! : 0;
  const total = dist.costAccount + commission + slippage;

  return {
    verified: true,
    failCode: null,
    breakdown: {
      spreadAbsolute: input.spreadAbsolute,
      spreadCostAccount: dist.costAccount,
      commissionAccount: commissionVerified ? input.commissionAccount! : null,
      slippageEstimateAccount: slippageOk ? input.slippageEstimateAccount! : null,
      totalEntryFrictionAccount: total,
      method: dist.method,
      commissionStatus: commissionVerified ? "VERIFIED" : "NOT_VERIFIED",
      slippageStatus: slippageOk ? "EVIDENCE_AVAILABLE" : "UNAVAILABLE",
      currency: input.accountCurrency ?? null,
      note:
        "Full (ask−bid) converted via verified contract economics. "
        + "Commission included only when verified; slippage only when evidence-backed. "
        + `Convention=${DYNAMIC_SPREAD_COST_ACCOUNTING_CONVENTION}.`,
    },
  };
}

export function buildStopLossImpact(input: {
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  quantityLots: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
  orderAllocationAccount: number | null | undefined;
}): DynamicSpreadStopLossImpact {
  const allocation = finitePositive(input.orderAllocationAccount)
    ? input.orderAllocationAccount
    : null;
  const allowed = allocation != null ? allocation * 0.25 : null;
  const sl = estimateStopLossRisk({
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    quantity: input.quantityLots,
    contract: input.contract,
  });
  if (!sl.ok) {
    return {
      modeledStopLossRiskAccount: null,
      spreadIncludedInStopLossRisk: false,
      orderAllocationAccount: allocation,
      allowedRiskAmountAccount: allowed,
      riskTargetFraction: 0.25,
      riskHardMaxFraction: 0.25,
      withinPerOrderRiskBudget: null,
      note: `SL risk unverified: ${sl.message}. Spread is never folded into SL risk.`,
    };
  }
  const within = allowed != null
    ? sl.estimatedStopLossRisk <= allowed + 1e-9
    : null;
  return {
    modeledStopLossRiskAccount: sl.estimatedStopLossRisk,
    spreadIncludedInStopLossRisk: false,
    orderAllocationAccount: allocation,
    allowedRiskAmountAccount: allowed,
    riskTargetFraction: 0.25,
    riskHardMaxFraction: 0.25,
    withinPerOrderRiskBudget: within,
    note:
      "Modeled SL risk uses entry−SL distance only (25% target = 25% hard max of THIS order allocation). "
      + "Spread cost is separate entry friction — not double-counted into SL risk.",
  };
}

export function buildNetRewardResult(input: {
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  quantityLots: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
  totalEntryFrictionAccount: number | null | undefined;
  costsVerified: boolean;
}): DynamicSpreadNetRewardResult {
  const sl = estimateStopLossRisk({
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    quantity: input.quantityLots,
    contract: input.contract,
  });
  const tp = estimateStopLossRisk({
    entryPrice: input.entryPrice,
    stopLoss: input.takeProfit,
    quantity: input.quantityLots,
    contract: input.contract,
  });
  if (!sl.ok || !tp.ok) {
    return {
      modeledStopLossRiskAccount: sl.ok ? sl.estimatedStopLossRisk : null,
      grossTakeProfitRewardAccount: tp.ok ? tp.estimatedStopLossRisk : null,
      netTakeProfitRewardAccount: null,
      rewardToRiskRatio: null,
      minimumRequiredRatio: 3,
      meetsMinimum: null,
      costsSubtractedFromReward: false,
      note: "Monetary reward/risk unverified — 3R not fabricated.",
    };
  }
  const gross = tp.estimatedStopLossRisk;
  const friction = input.costsVerified && finiteNonNeg(input.totalEntryFrictionAccount)
    ? input.totalEntryFrictionAccount
    : 0;
  const costsSubtracted = input.costsVerified && finiteNonNeg(input.totalEntryFrictionAccount);
  const net = gross - friction;
  const ratio = sl.estimatedStopLossRisk > 0 ? net / sl.estimatedStopLossRisk : null;
  const meets = ratio != null ? ratio + 1e-12 >= 3 : null;
  return {
    modeledStopLossRiskAccount: sl.estimatedStopLossRisk,
    grossTakeProfitRewardAccount: gross,
    netTakeProfitRewardAccount: net,
    rewardToRiskRatio: ratio,
    minimumRequiredRatio: 3,
    meetsMinimum: meets,
    costsSubtractedFromReward: costsSubtracted,
    note: costsSubtracted
      ? "Net reward = gross TP monetary reward − verified entry friction (spread±commission±slippage). SL risk unchanged."
      : "Costs not fully verified — validating gross TP reward vs SL risk (fail-closed if < 3R).",
  };
}
