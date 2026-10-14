/**
 * Deterministic validation of entry / SL / TP consistency.
 */
import type { SnapshotPlanIntent, SnapshotTradePlan } from "./types.js";

export function computeRiskReward(input: {
  entry: number | null;
  stop: number | null;
  target: number | null;
}): { ratio: number | null; risk: number | null; reward: number | null; unavailableReason: string | null } {
  const { entry, stop, target } = input;
  if (entry == null || stop == null || target == null) {
    return {
      ratio: null,
      risk: null,
      reward: null,
      unavailableReason: "Risk/reward requires finite entry, stop, and target prices.",
    };
  }
  if (![entry, stop, target].every((n) => Number.isFinite(n))) {
    return {
      ratio: null,
      risk: null,
      reward: null,
      unavailableReason: "Non-finite price in risk/reward inputs.",
    };
  }
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  if (!(risk > 0)) {
    return {
      ratio: null,
      risk: null,
      reward: null,
      unavailableReason: "Zero risk distance — cannot compute R:R.",
    };
  }
  const ratio = reward / risk;
  if (!Number.isFinite(ratio) || ratio < 0) {
    return {
      ratio: null,
      risk,
      reward,
      unavailableReason: "Risk/reward ratio is not a finite non-negative number.",
    };
  }
  return { ratio, risk, reward, unavailableReason: null };
}

export function validateIntentPrices(input: {
  intent: SnapshotPlanIntent;
  entry: number | null;
  stop: number | null;
  target: number | null;
}): string[] {
  const issues: string[] = [];
  if (input.intent !== "BUY" && input.intent !== "SELL") return issues;
  if (input.entry == null || input.stop == null) return issues;

  if (input.intent === "BUY") {
    if (input.stop >= input.entry) {
      issues.push("BUY stop loss must be below entry.");
    }
    if (input.target != null && input.target <= input.entry) {
      issues.push("BUY take profit must be above entry.");
    }
  }
  if (input.intent === "SELL") {
    if (input.stop <= input.entry) {
      issues.push("SELL stop loss must be above entry.");
    }
    if (input.target != null && input.target >= input.entry) {
      issues.push("SELL take profit must be below entry.");
    }
  }
  return issues;
}

export function sanitizePlanConsistency(plan: SnapshotTradePlan): SnapshotTradePlan {
  const issues = validateIntentPrices({
    intent: plan.intent,
    entry: plan.entryZone.reference,
    stop: plan.stopLoss.price,
    target: plan.takeProfit.prices[0] ?? null,
  });
  if (!issues.length) return plan;
  return {
    ...plan,
    intent: "UNSUITABLE",
    unsuitableReasons: [...plan.unsuitableReasons, ...issues],
    lifecycle: plan.lifecycle === "SETUP_CONFIRMED" ? "CONFIRMATION_PENDING" : plan.lifecycle,
    lifecycleNote:
      `${plan.lifecycleNote} Price consistency failed validation — setup cannot be confirmed.`,
    confirmationStatus: "BLOCKED",
    riskReward: {
      ratio: null,
      risk: null,
      reward: null,
      unavailableReason: issues[0] ?? "Price consistency validation failed.",
    },
  };
}
