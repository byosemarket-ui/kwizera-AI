/**
 * Phase 46 — Map plan + positionRisk → FXCM order-ticket field guidance (presentation only).
 */
import type { SnapshotTradePlan } from "../snapshot-plans/types.js";
import type { PositionRiskResult } from "../position-sizing/types.js";
import type { OrderTicketFieldGuidance, OrderTicketGuidance } from "./types.js";

function fmt(n: number | null | undefined, digits = 4): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return n.toFixed(digits);
}

function field(
  fieldId: string,
  label: string,
  proposedValue: string | null,
  support: OrderTicketFieldGuidance["support"],
  why: string,
  verify: string,
  unavailableReason: string | null = null,
): OrderTicketFieldGuidance {
  return { fieldId, label, proposedValue, support, why, verify, unavailableReason };
}

export function buildOrderTicketGuidance(input: {
  plan: SnapshotTradePlan & { positionRisk?: PositionRiskResult | null };
}): OrderTicketGuidance {
  const plan = input.plan;
  const risk = plan.positionRisk ?? null;
  const entry = plan.entryZone.reference ?? plan.entryZone.lower ?? plan.entryZone.upper;
  const stop = plan.stopLoss.price;
  const tp = plan.takeProfit.prices[0] ?? null;
  const fields: OrderTicketFieldGuidance[] = [];

  const directionOk = plan.intent === "BUY" || plan.intent === "SELL";
  fields.push(field(
    "direction",
    "Direction",
    directionOk ? plan.intent : "WAIT",
    directionOk ? "guidance_only" : "unavailable",
    directionOk
      ? `Plan intent is ${plan.intent} from Phase 44 structure rules (not an execution order).`
      : `Plan intent is ${plan.intent} — do not enter a BUY/SELL ticket yet.`,
    "Confirm direction against your own chart reading and account permissions.",
    directionOk ? null : `Intent ${plan.intent} blocks ticket direction.`,
  ));

  const pending = plan.lifecycle === "PLAN_CREATED" || plan.lifecycle === "CONFIRMATION_PENDING"
    || plan.lifecycle === "ENTRY_ZONE_REACHED";
  fields.push(field(
    "orderType",
    "Order type",
    directionOk ? (pending ? "Pending / limit-style entry (review)" : "Market (only after confirmation)") : null,
    directionOk ? "guidance_only" : "unavailable",
    "Order type is guidance only. FXCM ticket type must match whether price is already in the entry zone and confirmation status.",
    "Verify current Bid/Ask and whether a market or pending order matches your broker rules.",
    directionOk ? null : "No actionable direction.",
  ));

  const sizeStr = risk?.positionSize != null
    ? `${risk.positionSize} ${risk.positionSizeUnit}`
    : null;
  fields.push(field(
    "contracts",
    "Contracts / size",
    sizeStr,
    risk?.contract?.verified && sizeStr ? "estimated" : "unavailable",
    sizeStr
      ? "Size from Phase 45 deterministic risk engine (risk budget / step rounding) — not AI prose."
      : "Position size unavailable until verified contract specs and risk settings allow calculation.",
    "Confirm lot/contract/ounce unit matches the FXCM instrument specification.",
    sizeStr ? null : (risk?.blockingReasons[0] ?? risk?.contract?.unavailableReason ?? "Size not calculated."),
  ));

  const entryStr = plan.entryZone.unavailableReason
    ? null
    : entry != null
      ? (plan.entryZone.lower != null && plan.entryZone.upper != null
        && plan.entryZone.lower !== plan.entryZone.upper
        ? `${fmt(plan.entryZone.lower)} – ${fmt(plan.entryZone.upper)}`
        : fmt(entry))
      : null;
  fields.push(field(
    "entry",
    "Entry price / zone",
    entryStr,
    entryStr ? "guidance_only" : "unavailable",
    plan.entryZone.rationale || "Entry derived from Phase 44 structure zones.",
    "Verify the zone against live quotes before placing a pending or market order.",
    plan.entryZone.unavailableReason,
  ));

  fields.push(field(
    "tif",
    "Time in Force / advanced",
    "GTC or session TIF as appropriate for pending entries",
    "guidance_only",
    "TIF is operator choice. Prefer GTC for pending structural zones unless your desk requires day-only.",
    "Confirm FXCM TIF options for this instrument and session.",
    null,
  ));

  const stopDist = entry != null && stop != null ? Math.abs(entry - stop) : null;
  fields.push(field(
    "stopLoss",
    "Stop Loss",
    plan.stopLoss.unavailableReason ? null : fmt(stop),
    stop != null && !plan.stopLoss.unavailableReason ? "guidance_only" : "unavailable",
    [
      plan.stopLoss.rationale || "Structural invalidation / stop from Phase 44 plan.",
      stopDist != null ? `Distance from entry ≈ ${fmt(stopDist, 6)} price units.` : null,
      risk?.netLossAccount != null && risk.accountCurrency
        ? `Estimated monetary risk ≈ ${risk.netLossAccount.toFixed(2)} ${risk.accountCurrency} (Phase 45).`
        : "Monetary risk unavailable until Phase 45 inputs are complete.",
    ].filter(Boolean).join(" "),
    "Confirm SL side relative to BUY/SELL and minimum stop distance on FXCM.",
    plan.stopLoss.unavailableReason,
  ));

  const tpDist = entry != null && tp != null ? Math.abs(tp - entry) : null;
  fields.push(field(
    "takeProfit",
    "Take Profit",
    plan.takeProfit.unavailableReason ? null : (tp != null ? fmt(tp) : null),
    tp != null && !plan.takeProfit.unavailableReason ? "guidance_only" : "unavailable",
    [
      plan.takeProfit.rationale || "Target from Phase 44 plan.",
      tpDist != null ? `Distance from entry ≈ ${fmt(tpDist, 6)} price units.` : null,
      risk?.netProfitAccount != null && risk.accountCurrency
        ? `Estimated monetary reward ≈ ${risk.netProfitAccount.toFixed(2)} ${risk.accountCurrency} (Phase 45).`
        : "Monetary reward unavailable until Phase 45 inputs are complete.",
    ].filter(Boolean).join(" "),
    "Confirm TP does not violate instrument tick size or broker limits.",
    plan.takeProfit.unavailableReason,
  ));

  const rr = risk?.rewardRiskRatio ?? plan.riskReward.ratio;
  fields.push(field(
    "rewardRisk",
    "Risk / Reward",
    rr != null ? rr.toFixed(2) : null,
    rr != null ? (risk?.rewardRiskRatio != null ? "estimated" : "guidance_only") : "unavailable",
    risk?.minRewardRiskRatio != null
      ? `Configured minimum R:R is ${risk.minRewardRiskRatio}. Price-distance R:R may differ from monetary R:R.`
      : "R:R from plan price distances when monetary risk is unavailable.",
    "Compare monetary R:R (preferred) against Admin minimum threshold.",
    rr == null ? (plan.riskReward.unavailableReason ?? "R:R unavailable.") : null,
  ));

  const margin = risk?.margin?.estimatedMarginAccount ?? null;
  fields.push(field(
    "margin",
    "Required margin",
    margin != null && risk?.accountCurrency
      ? `${margin.toFixed(2)} ${risk.accountCurrency}`
      : null,
    margin != null ? "estimated" : "unavailable",
    risk?.margin?.note
      ?? "Margin is estimated only when a verified margin rate exists — not an exact broker quote.",
    "Confirm FXCM usable margin before any order.",
    risk?.margin?.unavailableReason ?? "Margin not verified.",
  ));

  let readiness: OrderTicketGuidance["readiness"] = "BLOCKED";
  let readinessNote = risk?.blockingReasons[0] ?? plan.unsuitableReasons[0] ?? "Plan is not ready.";
  if (plan.intent === "UNSUITABLE") {
    readiness = "UNSUITABLE";
    readinessNote = plan.unsuitableReasons[0] ?? "Plan marked UNSUITABLE.";
  } else if (plan.intent === "WAIT" || plan.confirmationStatus === "PENDING" || plan.confirmationStatus === "NOT_STARTED") {
    readiness = "WAIT_CONFIRMATION";
    readinessNote = plan.confirmationRequired[0]
      ?? plan.lifecycleNote
      ?? "Confirmation required before considering a ticket.";
  } else if (risk?.riskEligible && directionOk && plan.lifecycle === "SETUP_CONFIRMED") {
    readiness = "READY_FOR_REVIEW";
    readinessNote = "Risk-eligible and setup confirmed — still requires human review; not an auto-order.";
  } else if (risk?.riskEligible && directionOk) {
    readiness = "WAIT_CONFIRMATION";
    readinessNote = plan.lifecycleNote || "Size may be calculable, but confirmation/lifecycle gates remain.";
  }

  return {
    schemaVersion: "forex-order-ticket-guidance-v1",
    planKind: plan.planKind,
    planId: plan.planId,
    readiness,
    readinessNote,
    fields,
    disclaimer:
      "Decision-support only. Does not place, modify, or close FXCM orders. "
      + "Verify every field against live broker conditions.",
  };
}
