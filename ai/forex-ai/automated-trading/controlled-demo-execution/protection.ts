/**
 * Stage 7 — Post-fill Stop Loss / Take Profit protection verification.
 * Uses fixtures / read-only snapshots only in this stage — no broker mutation.
 */
import {
  STAGE7_MIN_REWARD_TO_RISK,
  STAGE7_RISK_MAX_PERCENT,
  type Stage7Blocker,
  type Stage7ProtectionResult,
  type Stage7ProposalSnapshot,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Verify protection against an authoritative (or fixture) trade snapshot.
 * Missing SL/TP → PROTECTION_FAILED critical.
 */
export function verifyPostFillProtection(input: {
  snapshot: Stage7ProposalSnapshot;
  tradeId: string | null | undefined;
  brokerOrderId: string | null | undefined;
  fillPrice: number | null | undefined;
  fillQuantity: number | null | undefined;
  brokerStop: number | null | undefined;
  brokerTakeProfit: number | null | undefined;
  /** Modeled monetary risk at fill using verified contract math (caller-supplied). */
  actualModeledMonetaryRisk: number | null | undefined;
  expectedMonetaryProfit: number | null | undefined;
  maximumAllowedMonetaryLoss: number | null | undefined;
  authoritative: boolean;
}): Stage7ProtectionResult {
  const blockers: Stage7Blocker[] = [];

  if (!input.authoritative) {
    blockers.push({
      code: "PROTECTION_EVIDENCE_NOT_AUTHORITATIVE",
      message: "Protection cannot be marked verified without authoritative broker evidence.",
      category: "PROTECTION",
    });
  }
  if (!String(input.tradeId || "").trim()) {
    blockers.push({
      code: "TRADE_IDENTITY_MISSING",
      message: "Broker trade identity missing after fill.",
      category: "PROTECTION",
    });
  }
  if (!finitePositive(input.fillPrice)) {
    blockers.push({
      code: "FILL_PRICE_MISSING",
      message: "Actual fill price missing.",
      category: "PROTECTION",
    });
  }
  if (!finitePositive(input.fillQuantity)) {
    blockers.push({
      code: "FILL_QUANTITY_MISSING",
      message: "Actual fill quantity missing.",
      category: "PROTECTION",
    });
  } else if (
    input.snapshot.quantity != null
    && Math.abs(input.fillQuantity - input.snapshot.quantity) > 1e-8
  ) {
    blockers.push({
      code: "FILL_QUANTITY_MISMATCH",
      message: `Fill quantity ${input.fillQuantity} does not match authorized ${input.snapshot.quantity}.`,
      category: "PROTECTION",
    });
  }

  const stopVerified = finitePositive(input.brokerStop)
    && input.snapshot.stopLoss != null
    && Math.abs(input.brokerStop - input.snapshot.stopLoss) < 1e-6;
  const tpVerified = finitePositive(input.brokerTakeProfit)
    && input.snapshot.takeProfit != null
    && Math.abs(input.brokerTakeProfit - input.snapshot.takeProfit) < 1e-6;

  if (!finitePositive(input.brokerStop)) {
    blockers.push({
      code: "STOP_LOSS_MISSING_ON_BROKER",
      message: "Critical: Stop Loss missing or unverified on broker trade.",
      category: "PROTECTION",
    });
  } else if (!stopVerified) {
    blockers.push({
      code: "STOP_LOSS_MISMATCH",
      message: "Broker Stop Loss does not match authorized proposal Stop Loss.",
      category: "PROTECTION",
    });
  }

  if (!finitePositive(input.brokerTakeProfit)) {
    blockers.push({
      code: "TAKE_PROFIT_MISSING_ON_BROKER",
      message: "Critical: Take Profit missing or unverified on broker trade.",
      category: "PROTECTION",
    });
  } else if (!tpVerified) {
    blockers.push({
      code: "TAKE_PROFIT_MISMATCH",
      message: "Broker Take Profit does not match authorized proposal Take Profit.",
      category: "PROTECTION",
    });
  }

  let monetaryOk = false;
  if (
    finitePositive(input.actualModeledMonetaryRisk)
    && finitePositive(input.maximumAllowedMonetaryLoss)
  ) {
    monetaryOk = input.actualModeledMonetaryRisk
      <= input.maximumAllowedMonetaryLoss + 1e-8;
    if (!monetaryOk) {
      blockers.push({
        code: "POST_FILL_RISK_EXCEEDS_25PCT",
        message:
          `Post-fill modeled risk ${input.actualModeledMonetaryRisk} exceeds hard max `
          + `${input.maximumAllowedMonetaryLoss} (${STAGE7_RISK_MAX_PERCENT}%).`,
        category: "PROTECTION",
      });
    }
  } else {
    blockers.push({
      code: "POST_FILL_RISK_UNVERIFIED",
      message: "Post-fill monetary risk could not be verified.",
      category: "PROTECTION",
    });
  }

  let rrOk = false;
  if (
    finitePositive(input.expectedMonetaryProfit)
    && finitePositive(input.actualModeledMonetaryRisk)
  ) {
    const ratio = input.expectedMonetaryProfit / input.actualModeledMonetaryRisk;
    rrOk = ratio + 1e-9 >= STAGE7_MIN_REWARD_TO_RISK;
    if (!rrOk) {
      blockers.push({
        code: "POST_FILL_BELOW_3R",
        message: `Post-fill reward/risk ${ratio.toFixed(4)} below ${STAGE7_MIN_REWARD_TO_RISK}R.`,
        category: "PROTECTION",
      });
    }
  } else {
    blockers.push({
      code: "POST_FILL_3R_UNVERIFIED",
      message: "Post-fill 3R could not be verified.",
      category: "PROTECTION",
    });
  }

  const failed = blockers.length > 0 || !stopVerified || !tpVerified || !monetaryOk || !rrOk;
  if (failed) {
    return {
      status: "FAILED",
      tradeId: input.tradeId ? String(input.tradeId) : null,
      brokerOrderId: input.brokerOrderId ? String(input.brokerOrderId) : null,
      fillPrice: finitePositive(input.fillPrice) ? input.fillPrice : null,
      fillQuantity: finitePositive(input.fillQuantity) ? input.fillQuantity : null,
      stopVerified,
      takeProfitVerified: tpVerified,
      monetaryRiskWithinLimit: monetaryOk,
      rewardToRiskOk: rrOk,
      blockers,
      note:
        "PROTECTION_FAILED — position must not be reported as PROTECTED. "
        + "Stage 7 does not auto-close or send compensating orders.",
    };
  }

  return {
    status: "VERIFIED",
    tradeId: String(input.tradeId),
    brokerOrderId: input.brokerOrderId ? String(input.brokerOrderId) : null,
    fillPrice: input.fillPrice!,
    fillQuantity: input.fillQuantity!,
    stopVerified: true,
    takeProfitVerified: true,
    monetaryRiskWithinLimit: true,
    rewardToRiskOk: true,
    blockers: [],
    note: "Authoritative broker evidence confirms Stop Loss, Take Profit, risk, and ≥3R.",
  };
}
