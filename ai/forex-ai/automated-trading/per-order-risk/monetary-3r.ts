/**
 * Stage 5 — Monetary reward-to-risk validation (≥ 3R).
 * Price-distance 3R is necessary but not sufficient; validate monetary profit vs modeled SL risk.
 */
import type { AtBinaryDirection } from "../analysis/direction.js";
import {
  compute3RTarget,
  estimateStopLossRisk,
} from "../simulation-risk/allocation-3r.js";
import type { AtSimContractMetaInput } from "../simulation-risk/types.js";
import { MINIMUM_REWARD_TO_RISK_RATIO } from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export type Monetary3RValidation =
  | {
    ok: true;
    modeledStopLossRisk: number;
    expectedMonetaryProfit: number;
    actualRewardToRiskRatio: number;
    minimumRequiredRatio: typeof MINIMUM_REWARD_TO_RISK_RATIO;
    method: "POINT_COST" | "CONTRACT_MULTIPLIER";
    costsIncluded: false;
    costsNote: string;
  }
  | {
    ok: false;
    code: string;
    message: string;
    modeledStopLossRisk: number | null;
    expectedMonetaryProfit: number | null;
    actualRewardToRiskRatio: number | null;
  };

/**
 * Validate that Take Profit yields ≥ 3× modeled monetary Stop Loss risk for the sized quantity.
 * Transaction costs: only subtracted when costDataVerified + finite estimatedCostsAccount.
 * Otherwise disclose limitation and validate on gross monetary R:R (fail-closed if gross < 3).
 */
export function validateMonetaryRewardToRisk(input: {
  direction: AtBinaryDirection | null | undefined;
  entryPrice: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  quantity: number | null | undefined;
  contract: AtSimContractMetaInput | null | undefined;
  costDataVerified?: boolean | null;
  estimatedCostsAccount?: number | null;
}): Monetary3RValidation {
  const slRisk = estimateStopLossRisk({
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    quantity: input.quantity,
    contract: input.contract,
  });
  if (!slRisk.ok) {
    return {
      ok: false,
      code: slRisk.code === "SL_RISK_CONTRACT_UNVERIFIED"
        ? "CONTRACT_SIZE_UNVERIFIED"
        : "MONETARY_3R_UNVERIFIED",
      message: slRisk.message,
      modeledStopLossRisk: null,
      expectedMonetaryProfit: null,
      actualRewardToRiskRatio: null,
    };
  }

  const tpRisk = estimateStopLossRisk({
    entryPrice: input.entryPrice,
    stopLoss: input.takeProfit,
    quantity: input.quantity,
    contract: input.contract,
  });
  if (!tpRisk.ok || !finitePositive(input.takeProfit)) {
    return {
      ok: false,
      code: "TAKE_PROFIT_BELOW_3R",
      message: tpRisk.ok === false
        ? `Take Profit monetary reward unverified: ${tpRisk.message}`
        : "Take Profit missing — monetary 3R cannot be validated.",
      modeledStopLossRisk: slRisk.estimatedStopLossRisk,
      expectedMonetaryProfit: null,
      actualRewardToRiskRatio: null,
    };
  }

  // Directional geometry of TP vs entry
  const dir = input.direction;
  const entry = input.entryPrice;
  if (dir === "BUY" && finitePositive(entry) && !(input.takeProfit! > entry)) {
    return {
      ok: false,
      code: "TAKE_PROFIT_BELOW_3R",
      message: "BUY Take Profit must be above entry for monetary 3R validation.",
      modeledStopLossRisk: slRisk.estimatedStopLossRisk,
      expectedMonetaryProfit: null,
      actualRewardToRiskRatio: null,
    };
  }
  if (dir === "SELL" && finitePositive(entry) && !(input.takeProfit! < entry)) {
    return {
      ok: false,
      code: "TAKE_PROFIT_BELOW_3R",
      message: "SELL Take Profit must be below entry for monetary 3R validation.",
      modeledStopLossRisk: slRisk.estimatedStopLossRisk,
      expectedMonetaryProfit: null,
      actualRewardToRiskRatio: null,
    };
  }

  let expectedProfit = tpRisk.estimatedStopLossRisk;
  const costsVerified = input.costDataVerified === true
    && typeof input.estimatedCostsAccount === "number"
    && Number.isFinite(input.estimatedCostsAccount)
    && input.estimatedCostsAccount >= 0;
  const costsNote = costsVerified
    ? `Known transaction costs of ${input.estimatedCostsAccount} subtracted from gross TP reward.`
    : "Reliable commission/fee data unavailable — monetary 3R validated on gross reward only (costs not fabricated).";

  if (costsVerified) {
    expectedProfit = expectedProfit - (input.estimatedCostsAccount as number);
  }

  if (!(expectedProfit > 0)) {
    return {
      ok: false,
      code: "TAKE_PROFIT_BELOW_3R",
      message: "Expected monetary profit after known costs is non-positive.",
      modeledStopLossRisk: slRisk.estimatedStopLossRisk,
      expectedMonetaryProfit: expectedProfit,
      actualRewardToRiskRatio: null,
    };
  }

  const ratio = expectedProfit / slRisk.estimatedStopLossRisk;
  if (!(ratio + 1e-9 >= MINIMUM_REWARD_TO_RISK_RATIO)) {
    return {
      ok: false,
      code: "TAKE_PROFIT_BELOW_3R",
      message:
        `Monetary reward/risk ${ratio.toFixed(4)} is below required ${MINIMUM_REWARD_TO_RISK_RATIO}R `
        + `(profit=${expectedProfit}, risk=${slRisk.estimatedStopLossRisk}).`,
      modeledStopLossRisk: slRisk.estimatedStopLossRisk,
      expectedMonetaryProfit: expectedProfit,
      actualRewardToRiskRatio: ratio,
    };
  }

  // Cross-check against existing compute3RTarget for consistency (gross path).
  const target = compute3RTarget({
    direction: dir,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    estimatedStopLossRisk: slRisk.estimatedStopLossRisk,
    priceMove: slRisk.priceMove,
    digits: input.contract?.digits ?? null,
    costDataVerified: costsVerified,
    estimatedCostsAccount: costsVerified ? input.estimatedCostsAccount : null,
  });
  if (target.ok && target.riskRewardRatio != null && target.riskRewardRatio + 1e-9 < MINIMUM_REWARD_TO_RISK_RATIO) {
    return {
      ok: false,
      code: "TAKE_PROFIT_BELOW_3R",
      message: `compute3RTarget R:R ${target.riskRewardRatio} below ${MINIMUM_REWARD_TO_RISK_RATIO}.`,
      modeledStopLossRisk: slRisk.estimatedStopLossRisk,
      expectedMonetaryProfit: expectedProfit,
      actualRewardToRiskRatio: target.riskRewardRatio,
    };
  }

  return {
    ok: true,
    modeledStopLossRisk: slRisk.estimatedStopLossRisk,
    expectedMonetaryProfit: expectedProfit,
    actualRewardToRiskRatio: ratio,
    minimumRequiredRatio: MINIMUM_REWARD_TO_RISK_RATIO,
    method: slRisk.method,
    costsIncluded: false,
    costsNote,
  };
}
