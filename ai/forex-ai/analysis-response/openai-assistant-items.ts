/**
 * Phase 46B — Nine numbered OpenAI assistant guidance items (presentation mapping only).
 * Monetary values come from Phase 45 positionRisk — never invented.
 */
import type { SnapshotTradePlan } from "../snapshot-plans/types.js";
import type { PositionRiskResult } from "../position-sizing/types.js";
import type { FieldSupportLevel } from "./types.js";

export const OPENAI_ASSISTANT_ITEMS_SCHEMA = "forex-openai-assistant-items-v1";

export type OpenAiAssistantItemTone =
  | "direction"
  | "contracts"
  | "units"
  | "advanced"
  | "tif"
  | "stop"
  | "takeprofit"
  | "risk"
  | "action";

export interface OpenAiAssistantGuidanceItem {
  number: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  tone: OpenAiAssistantItemTone;
  title: string;
  /** Primary value shown next to the title (or "Not determined" / WAIT). */
  value: string;
  ticketField: string;
  support: FieldSupportLevel;
  why: string;
  verify: string;
  unavailableReason: string | null;
}

export interface OpenAiAssistantGuidanceBundle {
  schemaVersion: typeof OPENAI_ASSISTANT_ITEMS_SCHEMA;
  planKind: string;
  planId: string;
  readiness: string;
  readinessNote: string;
  items: OpenAiAssistantGuidanceItem[];
  finalSummary: {
    directionOrWait: string;
    confirmationStatus: string;
    riskEligible: boolean | null;
    reason: string;
    verifyNext: string;
    tone: "ready" | "wait" | "blocked" | "unsuitable";
  };
  disclaimer: string;
}

type PlanWithRisk = SnapshotTradePlan & { positionRisk?: PositionRiskResult | null };

function fmtPrice(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  if (Math.abs(n) >= 100) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function money(n: number | null | undefined, ccy: string | null | undefined): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `${n.toFixed(2)}${ccy ? ` ${ccy}` : ""}`;
}

function item(
  number: OpenAiAssistantGuidanceItem["number"],
  tone: OpenAiAssistantItemTone,
  title: string,
  value: string,
  ticketField: string,
  support: FieldSupportLevel,
  why: string,
  verify: string,
  unavailableReason: string | null = null,
): OpenAiAssistantGuidanceItem {
  return { number, tone, title, value, ticketField, support, why, verify, unavailableReason };
}

/** Prefer risk-eligible plan; else actionable intent; else pullback for display. */
export function selectPrimaryPlanForAssistant(input: {
  pullback: PlanWithRisk;
  breakout: PlanWithRisk;
}): PlanWithRisk {
  const { pullback, breakout } = input;
  if (pullback.positionRisk?.riskEligible) return pullback;
  if (breakout.positionRisk?.riskEligible) return breakout;
  const actionable = (p: PlanWithRisk) => p.intent === "BUY" || p.intent === "SELL";
  if (actionable(pullback) && !actionable(breakout)) return pullback;
  if (actionable(breakout) && !actionable(pullback)) return breakout;
  return pullback;
}

export function buildOpenAiAssistantGuidanceItems(input: {
  plan: PlanWithRisk;
  marketDirection?: string | null;
  supportingEvidence?: string[];
  contradictingEvidence?: string[];
  tradeAllocation?: { amount: number; currency: string } | null;
}): OpenAiAssistantGuidanceBundle {
  const plan = input.plan;
  const risk = plan.positionRisk ?? null;
  const entry = plan.entryZone.reference ?? plan.entryZone.lower ?? plan.entryZone.upper;
  const stop = plan.stopLoss.price;
  const tp = plan.takeProfit.prices[0] ?? null;
  const ccy = risk?.accountCurrency ?? null;
  const directionOk = plan.intent === "BUY" || plan.intent === "SELL";
  const marketDir = input.marketDirection ?? plan.marketDirection;

  const supportBits = (input.supportingEvidence ?? []).slice(0, 2).join(" · ");
  const contraBits = (input.contradictingEvidence ?? []).slice(0, 1).join(" · ");

  let directionValue = "WAIT / UNCERTAIN";
  let directionSupport: FieldSupportLevel = "unavailable";
  if (directionOk) {
    directionValue = `${plan.intent} / ${marketDir || plan.intent}`;
    directionSupport = "guidance_only";
  } else if (plan.intent === "WAIT" || plan.intent === "UNSUITABLE") {
    directionValue = plan.intent === "UNSUITABLE" ? "WAIT / UNSUITABLE" : "WAIT / UNCERTAIN";
  }

  const items: OpenAiAssistantGuidanceItem[] = [];

  items.push(item(
    1,
    "direction",
    "Market Direction",
    directionValue,
    "BUY / SELL decision",
    directionSupport,
    [
      directionOk
        ? `Validated plan intent is ${plan.intent} (${plan.planKind}).`
        : `Plan intent is ${plan.intent} — do not enter BUY/SELL on the ticket yet.`,
      supportBits ? `Supporting: ${supportBits}` : null,
      contraBits ? `Contradicting: ${contraBits}` : null,
      "A model-generated direction alone does not authorize a trade.",
    ].filter(Boolean).join(" "),
    "Confirm direction against your chart and account permissions before touching BUY/SELL.",
    directionOk ? null : `Intent ${plan.intent} blocks ticket direction.`,
  ));

  const sizeStr = risk?.positionSize != null
    ? `${risk.positionSize} ${risk.positionSizeUnit}`
    : null;
  items.push(item(
    2,
    "contracts",
    "Contracts",
    sizeStr ?? "unavailable",
    "CONTRACTS quantity",
    risk?.contract?.verified && sizeStr ? "estimated" : "unavailable",
    sizeStr
      ? [
        "Quantity from Phase 45 risk engine (risk budget, SL distance, verified contract step).",
        input.tradeAllocation
          ? `Trade allocation ${input.tradeAllocation.amount} ${input.tradeAllocation.currency} is capital set aside — not the acceptable loss.`
          : "No trade allocation was submitted with this run.",
      ].join(" ")
      : "Contract quantity unavailable until verified specs and risk settings allow calculation.",
    "Verify the CONTRACTS field matches the FXCM instrument lot/contract rules.",
    sizeStr ? null : (risk?.blockingReasons[0] ?? risk?.contract?.unavailableReason ?? "Size not calculated."),
  ));

  const unit = String(
    risk?.positionSizeUnit
    ?? risk?.contract?.quantityUnit
    ?? "unknown",
  ).toLowerCase();
  const isOunce = unit.includes("ounce");
  const unitLabel = isOunce ? "Ounces" : "Instrument units";
  const unitValue = risk?.positionSize != null && risk.contract?.verified
    ? `${risk.positionSize} ${risk.positionSizeUnit}`
    : "unavailable";
  items.push(item(
    3,
    "units",
    unitLabel,
    unitValue,
    isOunce ? "OUNCES" : "Size / units",
    risk?.contract?.verified && risk.positionSize != null ? "estimated" : "unavailable",
    risk?.contract?.verified && risk.positionSize != null
      ? `Unit display follows verified contract convention (${risk.contract.convention}). Not a universal ounce multiplier.`
      : "Unit conversion unavailable without verified contract multiplier / quantity unit.",
    "Confirm the unit label on the FXCM ticket matches this instrument (lots, ounces, base units, etc.).",
    risk?.contract?.verified ? null : (risk?.contract?.unavailableReason ?? "Contract metadata unverified."),
  ));

  const pending = plan.lifecycle === "PLAN_CREATED"
    || plan.lifecycle === "CONFIRMATION_PENDING"
    || plan.lifecycle === "ENTRY_ZONE_REACHED";
  const orderValue = !directionOk
    ? "Not determined"
    : pending
      ? "Pending / limit-style entry (review)"
      : "Market only after confirmation";
  items.push(item(
    4,
    "advanced",
    "Advanced / Order settings",
    orderValue,
    "MARKET / ENTRY · ADVANCED",
    directionOk ? "guidance_only" : "unavailable",
    directionOk
      ? "Enable Advanced to set Stop and Limit. Order type depends on whether price is already in the entry zone and confirmation status."
      : "Order type not determined while direction is WAIT/UNSUITABLE.",
    "Verify MARKET vs ENTRY tabs and Advanced toggle against live Bid/Ask.",
    directionOk ? null : "No actionable direction.",
  ));

  items.push(item(
    5,
    "tif",
    "Time in Force",
    directionOk ? "Not determined — choose GTC or session TIF for pending entries" : "Not determined",
    "TIME IN FORCE",
    "guidance_only",
    "TIF is an operator choice. Prefer GTC for pending structural zones unless your desk requires day-only. No automatic GTC prescription.",
    "Confirm FXCM TIF options for this instrument and session.",
    null,
  ));

  const stopDist = entry != null && stop != null ? Math.abs(entry - stop) : null;
  const stopMoney = money(risk?.netLossAccount, ccy);
  items.push(item(
    6,
    "stop",
    "Stop Loss",
    plan.stopLoss.unavailableReason ? "unavailable" : (fmtPrice(stop) ?? "unavailable"),
    "STOP · AT PRICE",
    stop != null && !plan.stopLoss.unavailableReason ? "guidance_only" : "unavailable",
    [
      plan.stopLoss.rationale || "Structural invalidation / stop from Phase 44 plan.",
      stopDist != null ? `Distance from entry ≈ ${fmtPrice(stopDist)} price units.` : null,
      stopMoney
        ? `Estimated monetary risk ≈ ${stopMoney} (Phase 45).`
        : "Monetary risk unavailable until Phase 45 inputs are complete.",
      plan.confirmationRequired[0] ? `Confirmation still required: ${plan.confirmationRequired[0]}` : null,
    ].filter(Boolean).join(" "),
    "Confirm STOP side relative to BUY/SELL and minimum stop distance on FXCM.",
    plan.stopLoss.unavailableReason,
  ));

  const tpDist = entry != null && tp != null ? Math.abs(tp - entry) : null;
  const tpMoney = money(risk?.netProfitAccount, ccy);
  items.push(item(
    7,
    "takeprofit",
    "Take Profit",
    plan.takeProfit.unavailableReason ? "unavailable" : (fmtPrice(tp) ?? "unavailable"),
    "LIMIT · AT PRICE",
    tp != null && !plan.takeProfit.unavailableReason ? "guidance_only" : "unavailable",
    [
      plan.takeProfit.rationale || "Target from Phase 44 plan.",
      tpDist != null ? `Distance from entry ≈ ${fmtPrice(tpDist)} price units.` : null,
      tpMoney
        ? `Estimated monetary reward ≈ ${tpMoney} (Phase 45).`
        : "Monetary reward unavailable until Phase 45 inputs are complete.",
    ].filter(Boolean).join(" "),
    "Confirm LIMIT / take-profit does not violate tick size or broker limits.",
    plan.takeProfit.unavailableReason,
  ));

  const rr = risk?.rewardRiskRatio ?? plan.riskReward.ratio;
  const allocNote = input.tradeAllocation
    ? `Allocated capital ${input.tradeAllocation.amount} ${input.tradeAllocation.currency}`
    : risk?.tradeAllocationAmount != null
      ? `Allocated capital ${risk.tradeAllocationAmount} ${risk.tradeAllocationCurrency ?? ""}`.trim()
      : "Allocated capital not submitted";
  const marginStr = risk?.margin?.estimatedMarginAccount != null && ccy
    ? `${risk.margin.estimatedMarginAccount.toFixed(2)} ${ccy}`
    : null;
  items.push(item(
    8,
    "risk",
    "Risk / Reward & financial requirements",
    rr != null ? `R:R ${rr.toFixed(2)}` : "unavailable",
    "Risk summary · margin · costs",
    rr != null ? (risk?.rewardRiskRatio != null ? "estimated" : "guidance_only") : "unavailable",
    [
      risk?.minRewardRiskRatio != null ? `Configured minimum R:R ${risk.minRewardRiskRatio}.` : null,
      allocNote + " (not the acceptable loss).",
      stopMoney ? `Est. SL loss ${stopMoney}.` : "Est. SL loss unavailable.",
      tpMoney ? `Est. TP reward ${tpMoney}.` : "Est. TP reward unavailable.",
      marginStr ? `Est. margin ~${marginStr}.` : (risk?.margin?.unavailableReason ?? "Margin unavailable."),
      risk?.costs?.unavailableReason
        ? `Costs: ${risk.costs.unavailableReason}`
        : risk?.costs?.totalCostsAccount != null && ccy
          ? `Known costs ≈ ${risk.costs.totalCostsAccount.toFixed(2)} ${ccy}.`
          : "Transaction costs not fully verified.",
    ].filter(Boolean).join(" "),
    "Compare monetary R:R against Admin minimum; confirm usable margin on FXCM.",
    rr == null ? (plan.riskReward.unavailableReason ?? "R:R unavailable.") : null,
  ));

  let actionValue = "WAIT — do not submit";
  let actionSupport: FieldSupportLevel = "guidance_only";
  if (plan.intent === "UNSUITABLE") {
    actionValue = "Do not proceed — plan UNSUITABLE";
    actionSupport = "unavailable";
  } else if (!directionOk || plan.confirmationStatus === "PENDING" || plan.confirmationStatus === "NOT_STARTED") {
    actionValue = "WAIT for confirmation";
  } else if (risk && !risk.riskEligible) {
    actionValue = "Blocked — risk ineligible";
    actionSupport = "unavailable";
  } else if (risk?.riskEligible && plan.lifecycle === "SETUP_CONFIRMED") {
    actionValue = "READY FOR HUMAN REVIEW only";
  } else {
    actionValue = "Continue monitoring";
  }

  items.push(item(
    9,
    "action",
    "Final action & readiness",
    actionValue,
    "BUY/SELL submit button (manual)",
    actionSupport,
    [
      plan.lifecycleNote || `Lifecycle ${plan.lifecycle}.`,
      risk?.blockingReasons[0] ?? plan.unsuitableReasons[0] ?? null,
      plan.invalidationConditions[0]
        ? `Primary invalidation: ${plan.invalidationConditions[0]}`
        : null,
      "Do not press BUY/SELL solely because the AI produced a plan.",
    ].filter(Boolean).join(" "),
    "Verify position size, SL/TP, margin, and confirmation before any manual ticket submit.",
    risk?.blockingReasons[0] ?? plan.unsuitableReasons[0] ?? null,
  ));

  let summaryTone: OpenAiAssistantGuidanceBundle["finalSummary"]["tone"] = "wait";
  if (plan.intent === "UNSUITABLE") summaryTone = "unsuitable";
  else if (risk && !risk.riskEligible) summaryTone = "blocked";
  else if (risk?.riskEligible && directionOk && plan.lifecycle === "SETUP_CONFIRMED") summaryTone = "ready";

  return {
    schemaVersion: OPENAI_ASSISTANT_ITEMS_SCHEMA,
    planKind: plan.planKind,
    planId: plan.planId,
    readiness: items[8]?.value ?? "WAIT",
    readinessNote: plan.lifecycleNote,
    items,
    finalSummary: {
      directionOrWait: directionValue,
      confirmationStatus: plan.confirmationStatus,
      riskEligible: risk ? risk.riskEligible : null,
      reason:
        risk?.blockingReasons[0]
        ?? plan.unsuitableReasons[0]
        ?? plan.confirmationRequired[0]
        ?? plan.lifecycleNote
        ?? "Validated plan and risk state drive this conclusion.",
      verifyNext:
        "Verify every mapped FXCM field against live quotes, contract specs, and Admin risk settings before any manual order.",
      tone: summaryTone,
    },
    disclaimer:
      "Decision-support only. Does not place, modify, or close FXCM orders. "
      + "Field mappings are instructional — the ticket is not auto-filled.",
  };
}
