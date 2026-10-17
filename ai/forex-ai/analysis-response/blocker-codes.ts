/**
 * Phase 50D — Stable blocker codes for ticket / risk / structure gaps.
 * Maps free-text reasons to distinct codes so the UI never collapses unrelated failures.
 */

export type ForexTicketBlockerCode =
  | "SL_NO_STRUCTURE_OR_INTENT"
  | "SL_PRICE_INVALID"
  | "SL_BUY_NOT_BELOW_ENTRY"
  | "SL_SELL_NOT_ABOVE_ENTRY"
  | "TP_NO_STRUCTURE_OR_INTENT"
  | "TP_BUY_NOT_ABOVE_ENTRY"
  | "TP_SELL_NOT_BELOW_ENTRY"
  | "ENTRY_NO_SWINGS"
  | "ENTRY_WAIT_DIRECTION"
  | "ENTRY_UNSUITABLE"
  | "ENTRY_PULLBACK_SIDEWAYS"
  | "ENTRY_BREAKOUT_UNCERTAIN"
  | "ENTRY_PRICE_INVALID"
  | "CONTRACT_NO_PROVIDER_META"
  | "CONTRACT_FC_INCOMPLETE"
  | "CONTRACT_BINANCE_NO_STEP"
  | "CONTRACT_BINANCE_NO_MIN"
  | "CONTRACT_UNVERIFIED"
  | "SIZE_NOT_CALCULATED"
  | "SIZE_BUDGET_BELOW_MIN"
  | "SIZE_STEP_MISSING"
  | "SIZE_UNIT_LOSS_FAIL"
  | "RR_NEED_ENTRY_STOP_TARGET"
  | "RR_ZERO_RISK"
  | "RR_NON_FINITE"
  | "RR_UNAVAILABLE_GENERIC"
  | "RR_BELOW_MIN"
  | "RR_MISSING_FOR_MIN"
  | "FXCM_MAP_CONFLICT"
  | "FXCM_MAP_UNRESOLVED"
  | "FXCM_TICKET_INELIGIBLE"
  | "FXCM_PROVIDER_ISOLATION"
  | "RISK_MANUAL_EQUITY_MISSING"
  | "RISK_MANUAL_BALANCE_MISSING"
  | "RISK_FIXED_AMOUNT_INVALID"
  | "RISK_PERCENT_INVALID"
  | "RISK_ACCOUNT_CCY_MISSING"
  | "RISK_FXCM_SNAPSHOT_STALE"
  | "RISK_FXCM_CCY_UNAVAILABLE"
  | "RISK_SIDE_REQUIRED"
  | "RISK_PLAN_WAIT"
  | "RISK_PLAN_UNSUITABLE"
  | "RISK_LIFECYCLE_BLOCK"
  | "RISK_CONVERSION_UNAVAILABLE"
  | "RISK_MARGIN_REQUIRED"
  | "RISK_ALLOC_CCY_MISMATCH"
  | "RISK_ALLOC_MARGIN_EXCEEDS"
  | "DATA_HISTORICAL_ONLY"
  | "CONFIRM_BLOCKED_HISTORICAL"
  | "STRUCTURE_INSUFFICIENT_CANDLES"
  | "STRUCTURE_DATA_NOT_USABLE"
  | "UNKNOWN_BLOCKER";

const RULES: Array<{ code: ForexTicketBlockerCode; test: RegExp; explanation: string }> = [
  {
    code: "SL_NO_STRUCTURE_OR_INTENT",
    test: /Stop loss not derived — missing swing structure/i,
    explanation: "Stop Loss needs swing structure and a directional entry-plan intent (BUY/SELL).",
  },
  {
    code: "SL_BUY_NOT_BELOW_ENTRY",
    test: /BUY stop loss must be below entry/i,
    explanation: "BUY Stop Loss must sit below entry.",
  },
  {
    code: "SL_SELL_NOT_ABOVE_ENTRY",
    test: /SELL stop loss must be above entry/i,
    explanation: "SELL Stop Loss must sit above entry.",
  },
  {
    code: "SL_PRICE_INVALID",
    test: /Stop loss is missing or invalid/i,
    explanation: "Stop Loss price is missing or non-finite.",
  },
  {
    code: "TP_NO_STRUCTURE_OR_INTENT",
    test: /Take profit not derived — missing swing structure/i,
    explanation: "Take Profit needs swing structure and a directional entry-plan intent.",
  },
  {
    code: "TP_BUY_NOT_ABOVE_ENTRY",
    test: /BUY take profit must be above entry/i,
    explanation: "BUY Take Profit must sit above entry.",
  },
  {
    code: "TP_SELL_NOT_BELOW_ENTRY",
    test: /SELL take profit must be below entry/i,
    explanation: "SELL Take Profit must sit below entry.",
  },
  {
    code: "ENTRY_NO_SWINGS",
    test: /Entry zone unavailable — confirmed swing high\/low/i,
    explanation: "No confirmed swing high/low in detector evidence — entry zone cannot be derived.",
  },
  {
    code: "ENTRY_WAIT_DIRECTION",
    test: /WAIT — market direction\/evidence does not support a directional entry/i,
    explanation: "Entry-plan intent is WAIT — directional entry zone not supported (direction BUY/SELL may still exist).",
  },
  {
    code: "ENTRY_UNSUITABLE",
    test: /Plan unsuitable — analysis failed or evidence insufficient/i,
    explanation: "Entry plan marked UNSUITABLE — evidence insufficient for a trade setup.",
  },
  {
    code: "ENTRY_PULLBACK_SIDEWAYS",
    test: /Pullback entry zone not derived for SIDEWAYS/i,
    explanation: "Pullback zone not derived for SIDEWAYS/UNCERTAIN structure.",
  },
  {
    code: "ENTRY_BREAKOUT_UNCERTAIN",
    test: /Breakout zone unavailable — direction UNCERTAIN/i,
    explanation: "Breakout zone unavailable while market direction is UNCERTAIN.",
  },
  {
    code: "ENTRY_PRICE_INVALID",
    test: /Entry price is missing or invalid/i,
    explanation: "Entry price missing or non-finite.",
  },
  {
    code: "CONTRACT_NO_PROVIDER_META",
    test: /No verified contract metadata for provider/i,
    explanation: "Provider-specific contract metadata was not loaded — quantity cannot be calculated.",
  },
  {
    code: "CONTRACT_FC_INCOMPLETE",
    test: /Verified contract sizing fields are incomplete/i,
    explanation: "ForexConnect/FXCM contract sizing fields are incomplete.",
  },
  {
    code: "CONTRACT_BINANCE_NO_STEP",
    test: /Missing verified LOT_SIZE stepSize/i,
    explanation: "Binance LOT_SIZE stepSize missing — quantity step unknown.",
  },
  {
    code: "CONTRACT_BINANCE_NO_MIN",
    test: /Missing verified LOT_SIZE minQty/i,
    explanation: "Binance LOT_SIZE minQty missing — minimum quantity unknown.",
  },
  {
    code: "CONTRACT_UNVERIFIED",
    test: /Contract specification is not verified/i,
    explanation: "Contract specification is not verified for this instrument.",
  },
  {
    code: "SIZE_BUDGET_BELOW_MIN",
    test: /Risk budget cannot fund the instrument minimum quantity/i,
    explanation: "Risk budget cannot fund the instrument minimum quantity step.",
  },
  {
    code: "SIZE_STEP_MISSING",
    test: /Quantity step is missing/i,
    explanation: "Quantity step missing — cannot normalize a tradable size.",
  },
  {
    code: "SIZE_UNIT_LOSS_FAIL",
    test: /Cannot compute per-unit stop loss|unitLoss/i,
    explanation: "Per-unit stop-loss monetary value could not be computed.",
  },
  {
    code: "SIZE_NOT_CALCULATED",
    test: /Size not calculated|Units unavailable until size is calculated/i,
    explanation: "Position size was not calculated — upstream inputs incomplete.",
  },
  {
    code: "RR_NEED_ENTRY_STOP_TARGET",
    test: /Risk\/reward requires finite entry, stop, and target/i,
    explanation: "R:R needs finite entry, stop, and target prices.",
  },
  {
    code: "RR_ZERO_RISK",
    test: /Zero risk distance/i,
    explanation: "Zero risk distance — R:R undefined.",
  },
  {
    code: "RR_NON_FINITE",
    test: /Risk\/reward ratio is not a finite|Non-finite price/i,
    explanation: "R:R is non-finite or prices are non-finite.",
  },
  {
    code: "RR_BELOW_MIN",
    test: /Reward-to-risk .+ is below minimum/i,
    explanation: "Computed R:R is below the configured Admin minimum.",
  },
  {
    code: "RR_MISSING_FOR_MIN",
    test: /Reward-to-risk ratio unavailable — cannot satisfy minimum/i,
    explanation: "R:R unavailable — cannot satisfy minimum R:R gate.",
  },
  {
    code: "RR_UNAVAILABLE_GENERIC",
    test: /^R:R unavailable/i,
    explanation: "Risk/reward unavailable.",
  },
  {
    code: "FXCM_MAP_CONFLICT",
    test: /FXCM symbol mapping is in conflict/i,
    explanation: "FXCM symbol mapping is in conflict.",
  },
  {
    code: "FXCM_MAP_UNRESOLVED",
    test: /FXCM symbol mapping is unresolved/i,
    explanation: "FXCM symbol mapping is unresolved.",
  },
  {
    code: "FXCM_TICKET_INELIGIBLE",
    test: /BROKER INSTRUMENT NOT VERIFIED|FXCM TICKET INELIGIBLE/i,
    explanation: "Instrument is not verified as FXCM-tradable — FXCM ticket fields stay ineligible.",
  },
  {
    code: "FXCM_PROVIDER_ISOLATION",
    test: /Binance analysis is isolated from FXCM|not an FXCM-tradable/i,
    explanation: "Analysis provider is not FXCM — contract/quantity rules are not inferred across brokers.",
  },
  {
    code: "RISK_MANUAL_EQUITY_MISSING",
    test: /Manual equity is missing or invalid/i,
    explanation: "Manual equity missing or invalid in risk settings.",
  },
  {
    code: "RISK_MANUAL_BALANCE_MISSING",
    test: /Manual balance is missing or invalid/i,
    explanation: "Manual balance missing or invalid in risk settings.",
  },
  {
    code: "RISK_FIXED_AMOUNT_INVALID",
    test: /Fixed risk amount is missing or invalid/i,
    explanation: "Fixed risk amount missing or invalid.",
  },
  {
    code: "RISK_PERCENT_INVALID",
    test: /Risk percent must be in/i,
    explanation: "Risk percent must be in (0, 100].",
  },
  {
    code: "RISK_ACCOUNT_CCY_MISSING",
    test: /Account currency is not configured/i,
    explanation: "Account currency not configured in Forex Admin risk settings.",
  },
  {
    code: "RISK_FXCM_SNAPSHOT_STALE",
    test: /FXCM account snapshot is not fresh/i,
    explanation: "FXCM account snapshot is stale.",
  },
  {
    code: "RISK_FXCM_CCY_UNAVAILABLE",
    test: /FXCM account currency \(BASE_CRNCY\) is unavailable/i,
    explanation: "FXCM account currency unavailable from snapshot.",
  },
  {
    code: "RISK_SIDE_REQUIRED",
    test: /Side must be BUY or SELL for monetary risk sizing/i,
    explanation: "Risk sizing needs BUY/SELL entry-plan intent (directional lean alone is not enough).",
  },
  {
    code: "RISK_PLAN_WAIT",
    test: /Plan intent is WAIT — not risk-eligible/i,
    explanation: "Entry-plan intent WAIT blocks risk eligibility (directional BUY/SELL may still display).",
  },
  {
    code: "RISK_PLAN_UNSUITABLE",
    test: /Plan is UNSUITABLE — risk sizing cannot make it eligible/i,
    explanation: "Entry plan UNSUITABLE — risk sizing cannot make it eligible.",
  },
  {
    code: "RISK_LIFECYCLE_BLOCK",
    test: /Plan lifecycle .+ blocks risk eligibility/i,
    explanation: "Plan lifecycle blocks risk eligibility.",
  },
  {
    code: "RISK_CONVERSION_UNAVAILABLE",
    test: /Currency conversion unavailable/i,
    explanation: "Currency conversion unavailable for monetary sizing.",
  },
  {
    code: "RISK_MARGIN_REQUIRED",
    test: /Margin required for eligibility but unavailable/i,
    explanation: "Margin required for eligibility but unavailable.",
  },
  {
    code: "RISK_ALLOC_CCY_MISMATCH",
    test: /Trade allocation currency .+ differs from account currency/i,
    explanation: "Trade allocation currency differs from account currency.",
  },
  {
    code: "RISK_ALLOC_MARGIN_EXCEEDS",
    test: /Estimated margin .+ exceeds allocated trade capital/i,
    explanation: "Estimated margin exceeds allocated trade capital.",
  },
  {
    code: "DATA_HISTORICAL_ONLY",
    test: /HISTORICAL_ONLY/i,
    explanation: "Data is HISTORICAL_ONLY — not a live entry signal.",
  },
  {
    code: "CONFIRM_BLOCKED_HISTORICAL",
    test: /Quote is HISTORICAL_ONLY — analytical plans may be created/i,
    explanation: "SETUP CONFIRMED blocked while quote is HISTORICAL_ONLY.",
  },
  {
    code: "STRUCTURE_INSUFFICIENT_CANDLES",
    test: /Insufficient closed candles for structure\/pattern detectors/i,
    explanation: "Insufficient closed candles for structure/pattern detectors.",
  },
  {
    code: "STRUCTURE_DATA_NOT_USABLE",
    test: /Instrument data not fully usable for trade planning/i,
    explanation: "Instrument data not fully usable for trade planning.",
  },
];

export interface ClassifiedBlocker {
  code: ForexTicketBlockerCode;
  reason: string;
  explanation: string;
}

export function classifyTicketBlocker(reason: string | null | undefined): ClassifiedBlocker | null {
  if (!reason || !String(reason).trim()) return null;
  const text = String(reason).trim();
  for (const rule of RULES) {
    if (rule.test.test(text)) {
      return { code: rule.code, reason: text, explanation: rule.explanation };
    }
  }
  return {
    code: "UNKNOWN_BLOCKER",
    reason: text,
    explanation: text,
  };
}

export function classifyTicketBlockers(reasons: Array<string | null | undefined>): ClassifiedBlocker[] {
  const out: ClassifiedBlocker[] = [];
  const seen = new Set<string>();
  for (const r of reasons) {
    const c = classifyTicketBlocker(r);
    if (!c) continue;
    const key = `${c.code}:${c.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Prefer structure / mapping / contract codes over generic sizing noise. */
export function primaryBlockerCode(reasons: Array<string | null | undefined>): ClassifiedBlocker | null {
  const classified = classifyTicketBlockers(reasons);
  if (!classified.length) return null;
  const prefer = classified.find((c) =>
    /STRUCTURE_|ENTRY_|SL_|TP_|CONTRACT_|FXCM_|DATA_|CONFIRM_/.test(c.code)
    && c.code !== "RISK_SIDE_REQUIRED"
  );
  return prefer ?? classified.find((c) => c.code !== "RISK_SIDE_REQUIRED") ?? classified[0]!;
}

export function formatBlockerForUi(blocker: ClassifiedBlocker): string {
  return `${blocker.code}: ${blocker.explanation}`;
}
