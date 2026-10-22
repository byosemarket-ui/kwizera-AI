/**
 * Phase 56.4.2 — Stable, actionable rejection reasons for simulation drafts.
 * Maps existing engine check codes onto operator-facing categories without inventing broker facts.
 */
import type { AtSimReason, AtSimValidationCheck } from "./types.js";

export type RejectionClass =
  | "transient_market_data"
  | "user_input"
  | "provider_limitation"
  | "safety_restriction"
  | "budget_or_risk"
  | "metadata_gap";

export interface ActionableRejection {
  code: string;
  message: string;
  affected: string;
  classification: RejectionClass;
  correctiveAction: string | null;
}

const ALIASES: Record<string, string> = {
  QUOTE_STALE: "QUOTE_STALE",
  QUOTE_FRESHNESS_UNKNOWN: "QUOTE_MISSING",
  QUOTE_ENTRY_MISSING: "ENTRY_PRICE_INVALID",
  PROPOSE_ENTRY_QUOTE_STALE: "QUOTE_STALE",
  PROPOSE_ENTRY_QUOTE_MISSING: "QUOTE_MISSING",
  FEED_NOT_LIVE: "FEED_NOT_LIVE",
  QUOTE_INVALID: "QUOTE_INVALID",
  QUOTE_MISSING: "QUOTE_MISSING",
  STOP_LOSS_REQUIRED: "STOP_LOSS_MISSING",
  TAKE_PROFIT_REQUIRED: "TAKE_PROFIT_MISSING",
  SL_GEOMETRY_INVALID: "STOP_LOSS_INVALID",
  TP_GEOMETRY_INVALID: "TAKE_PROFIT_INVALID",
  TP_NOT_3R: "TP_NOT_3R",
  MIN_STOP_DISTANCE_UNVERIFIED: "MIN_STOP_DISTANCE_UNVERIFIED",
  MIN_STOP_DISTANCE: "MIN_STOP_DISTANCE_VIOLATION",
  QUANTITY_UNIT_AMBIGUOUS: "QUANTITY_METADATA_UNVERIFIED",
  QTY_CONSTRAINTS_UNIT_AMBIGUOUS: "QUANTITY_METADATA_UNVERIFIED",
  SIZE_QTY_BELOW_MIN: "QUANTITY_BELOW_MINIMUM",
  SIZE_QTY_STEP_INVALID: "QUANTITY_STEP_INVALID",
  FX_RATE_UNAVAILABLE: "CONVERSION_RATE_UNAVAILABLE",
  FX_RATE_STALE: "CONVERSION_RATE_STALE",
  PER_ORDER_ALLOCATION_EXCEEDS_REMAINING: "ALLOCATION_BUDGET_EXCEEDED",
  ORDER_ALLOCATION_EXCEEDS_REMAINING: "ALLOCATION_BUDGET_EXCEEDED",
  MARGIN_INSUFFICIENT: "INSUFFICIENT_FREE_MARGIN",
  BLOCKED_MARGIN_DATA_UNAVAILABLE: "INSUFFICIENT_FREE_MARGIN",
  PER_ORDER_LOSS_LIMIT_EXCEEDED: "STOP_LOSS_RISK_LIMIT_EXCEEDED",
  BLOCKED_ACCOUNT_EQUITY_MISSING: "ACCOUNT_EQUITY_UNVERIFIED",
  BLOCKED_ACCOUNT_DATA_UNAVAILABLE: "ACCOUNT_EQUITY_UNVERIFIED",
  EXECUTION_FORBIDDEN: "SIMULATION_ONLY_EXECUTION_LOCKED",
  SAFETY_MASTER_ENABLE: "SIMULATION_ONLY_EXECUTION_LOCKED",
  SAFETY_EMERGENCY_LOCK: "SIMULATION_ONLY_EXECUTION_LOCKED",
};

const META: Record<string, Omit<ActionableRejection, "code" | "message">> = {
  QUOTE_MISSING: {
    affected: "market quote",
    classification: "transient_market_data",
    correctiveAction: "Subscribe to the instrument and wait for a LIVE Bid/Ask price change, then re-validate.",
  },
  QUOTE_STALE: {
    affected: "market quote freshness",
    classification: "transient_market_data",
    correctiveAction: "Re-validate immediately while Offers price-change age is within the freshness window.",
  },
  FEED_NOT_LIVE: {
    affected: "live feed state",
    classification: "transient_market_data",
    correctiveAction: "Ensure an intended subscription is active and the stream reports LIVE.",
  },
  QUOTE_INVALID: {
    affected: "bid/ask geometry",
    classification: "transient_market_data",
    correctiveAction: "Wait for a consistent Offers quote (ask ≥ bid) and re-validate.",
  },
  ENTRY_PRICE_INVALID: {
    affected: "entry price",
    classification: "user_input",
    correctiveAction: "Provide a finite entry from a fresh quote (BUY=ask, SELL=bid) or allow derivation.",
  },
  STOP_LOSS_MISSING: {
    affected: "stop loss",
    classification: "user_input",
    correctiveAction: "Supply a Stop Loss or ensure analysis support/resistance levels are available.",
  },
  STOP_LOSS_INVALID: {
    affected: "stop loss geometry",
    classification: "user_input",
    correctiveAction: "BUY SL must be below entry; SELL SL must be above entry.",
  },
  TAKE_PROFIT_MISSING: {
    affected: "take profit",
    classification: "user_input",
    correctiveAction: "Supply Take Profit or allow 3R derivation from a verified stop distance.",
  },
  TAKE_PROFIT_INVALID: {
    affected: "take profit geometry",
    classification: "user_input",
    correctiveAction: "BUY TP must be above entry; SELL TP must be below entry.",
  },
  TP_NOT_3R: {
    affected: "take profit 3R policy",
    classification: "user_input",
    correctiveAction: "Set TP to entry ± 3×|entry−SL| per direction after rounding to tick size.",
  },
  MIN_STOP_DISTANCE_UNVERIFIED: {
    affected: "CondDist / min-stop metadata",
    classification: "metadata_gap",
    correctiveAction: "Obtain account-scoped CondDist in pips via TradingSettings before sizing stops.",
  },
  MIN_STOP_DISTANCE_VIOLATION: {
    affected: "stop distance vs broker minimum",
    classification: "user_input",
    correctiveAction: "Widen the stop beyond the verified CondDist×PointSize minimum.",
  },
  QUANTITY_METADATA_UNVERIFIED: {
    affected: "quantity unit / contract metadata",
    classification: "metadata_gap",
    correctiveAction: "Refresh instrument TradingSettings (BaseUnitSize, MinQuantity, ContractMultiplier).",
  },
  QUANTITY_BELOW_MINIMUM: {
    affected: "proposed quantity",
    classification: "budget_or_risk",
    correctiveAction: "Increase order allocation or reduce stop distance so floor quantity meets MinQuantity.",
  },
  QUANTITY_STEP_INVALID: {
    affected: "quantity step",
    classification: "budget_or_risk",
    correctiveAction: "Size quantity as a multiple of verified BaseUnitSize.",
  },
  CONVERSION_RATE_UNAVAILABLE: {
    affected: "FX conversion",
    classification: "metadata_gap",
    correctiveAction: "Provide a fresh Offers conversion path for account currency, or use a USD account.",
  },
  CONVERSION_RATE_STALE: {
    affected: "FX conversion freshness",
    classification: "transient_market_data",
    correctiveAction: "Refresh Offers mid for the conversion pair and re-validate.",
  },
  ALLOCATION_BUDGET_EXCEEDED: {
    affected: "order allocation vs strategy budget",
    classification: "budget_or_risk",
    correctiveAction: "Lower Order Allocation or raise Strategy allocation % (1–100%) within remaining budget.",
  },
  INSUFFICIENT_FREE_MARGIN: {
    affected: "free margin / margin metadata",
    classification: "budget_or_risk",
    correctiveAction: "Reduce quantity/allocation or refresh verified usable margin.",
  },
  STOP_LOSS_RISK_LIMIT_EXCEEDED: {
    affected: "estimated SL loss vs 25% of order allocation",
    classification: "budget_or_risk",
    correctiveAction: "Reduce quantity, tighten stop, or increase this order’s allocation.",
  },
  ACCOUNT_EQUITY_UNVERIFIED: {
    affected: "account equity",
    classification: "metadata_gap",
    correctiveAction: "Run Verify-Account on the matching DEMO/LIVE session.",
  },
  SIMULATION_ONLY_EXECUTION_LOCKED: {
    affected: "execution safety locks",
    classification: "safety_restriction",
    correctiveAction:
      "Expected in this phase — Master OFF, Emergency ON, placesOrders=false. Do not unlock for Scenario 1.",
  },
};

export function normalizeRejectionCode(code: string): string {
  const raw = String(code ?? "").trim();
  if (!raw) return "REJECTED_LOCAL";
  if (ALIASES[raw]) return ALIASES[raw];
  if (META[raw]) return raw;
  // Heuristic maps for common engine patterns
  if (/QUOTE.*STALE|AGE_EXCEEDED|PROPOSE_ENTRY_QUOTE_STALE/i.test(raw)) return "QUOTE_STALE";
  if (/FEED_NOT_LIVE|NO_QUOTE/i.test(raw)) return "FEED_NOT_LIVE";
  if (/STOP.?LOSS.*MISS|SL_REQUIRED|PROPOSE_SL_/i.test(raw)) return "STOP_LOSS_MISSING";
  if (/TAKE.?PROFIT.*MISS|TP_REQUIRED/i.test(raw)) return "TAKE_PROFIT_MISSING";
  if (/3R|REWARD_RISK/i.test(raw)) return "TP_NOT_3R";
  if (/ALLOCATION|REMAINING.*BUDGET|EXCEEDS_REMAINING/i.test(raw)) return "ALLOCATION_BUDGET_EXCEEDED";
  if (/LOSS_LIMIT|25%/i.test(raw)) return "STOP_LOSS_RISK_LIMIT_EXCEEDED";
  if (/MARGIN/i.test(raw)) return "INSUFFICIENT_FREE_MARGIN";
  if (/CONVERSION|FX_RATE/i.test(raw)) return "CONVERSION_RATE_UNAVAILABLE";
  if (/QUANTITY|QTY_/i.test(raw)) return "QUANTITY_METADATA_UNVERIFIED";
  if (/EXECUTION|MASTER|EMERGENCY|placesOrders/i.test(raw)) return "SIMULATION_ONLY_EXECUTION_LOCKED";
  return raw;
}

export function buildActionableRejection(
  code: string,
  message: string,
): ActionableRejection {
  const normalized = normalizeRejectionCode(code);
  const meta = META[normalized] ?? {
    affected: "draft validation",
    classification: "user_input" as RejectionClass,
    correctiveAction: "Correct the failing input and re-validate against a fresh LIVE quote.",
  };
  return {
    code: normalized,
    message: message || normalized,
    ...meta,
  };
}

/** Enrich engine reasons with stable codes + corrective actions (no secrets). */
export function enrichDraftRejectionReasons(
  checks: AtSimValidationCheck[],
  reasons: AtSimReason[],
): ActionableRejection[] {
  const failing = [
    ...checks.filter((c) => c.status === "FAIL" || c.status === "BLOCKED"),
    ...reasons.map((r) => ({ code: r.code, message: r.message, status: "FAIL" as const, category: "STRUCTURAL" as const })),
  ];
  const out: ActionableRejection[] = [];
  const seen = new Set<string>();
  for (const item of failing) {
    const a = buildActionableRejection(item.code, item.message);
    if (seen.has(a.code)) continue;
    seen.add(a.code);
    out.push(a);
  }
  return out;
}
