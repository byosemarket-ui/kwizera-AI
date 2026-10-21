/**
 * Phase 56.2 / 56.2.2 — Deterministic simulation-only draft validation.
 * Shared DEMO/LIVE rules. Never submits broker orders.
 * Never invents hard max-loss %, XAU ounces, or min-stop.
 * 56.2.2: owner-approved 12–25% allocation (not loss %) + independent 3R analysis.
 */
import { randomUUID } from "node:crypto";
import { allowlistRejectionMessage, isInstrumentAllowlisted } from "./allowlist.js";
import {
  compute3RTarget,
  computeAllocationBudget,
  estimateStopLossRisk,
  shouldForceAllocation,
  validateAllocationPercentage,
} from "./allocation-3r.js";
import {
  allocatePerOrderFromRemaining,
  computeCapitalAllocationBudget,
  evaluatePerOrderLossLimit,
} from "./capital-budget.js";
import { evaluateProfitProtection } from "./profit-protection.js";
import { proposeQuantityFromAllocation } from "./propose-levels.js";
import { sizeOrderQuantityFromAllocation } from "./size-order-quantity.js";
import {
  AT_SIM_RISK_BANNER,
  AT_SIM_RISK_PHASE,
  AT_SIM_RISK_POLICY_VERSION,
  AT_SIM_RISK_SCHEMA,
  defaultSimRiskPolicy,
  type AtSimAllocationAnalysis,
  type AtSimCapitalBudgetAnalysis,
  type AtSimCheckCategory,
  type AtSimCheckStatus,
  type AtSimDraftInput,
  type AtSimDraftOverallStatus,
  type AtSimDraftResult,
  type AtSimReason,
  type AtSimRewardRiskAnalysis,
  type AtSimRiskPolicy,
  type AtSimValidationCheck,
} from "./types.js";

function isFinitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function priceIncrementOk(
  price: number,
  tickSize: number | null,
  pointSize: number | null,
  digits: number | null,
): { ok: boolean; reason: string | null } {
  const step = tickSize ?? pointSize;
  if (step != null && step > 0) {
    const units = price / step;
    const nearest = Math.round(units);
    if (Math.abs(units - nearest) > 1e-8) {
      return { ok: false, reason: `Price ${price} is not aligned to increment ${step}.` };
    }
    return { ok: true, reason: null };
  }
  if (digits != null && Number.isInteger(digits) && digits >= 0) {
    const factor = 10 ** digits;
    const scaled = price * factor;
    if (Math.abs(scaled - Math.round(scaled)) > 1e-6) {
      return { ok: false, reason: `Price ${price} exceeds digits=${digits} precision.` };
    }
    return { ok: true, reason: null };
  }
  return { ok: true, reason: null }; // no verified increment — skip enforcement
}

function pushCheck(
  checks: AtSimValidationCheck[],
  code: string,
  category: AtSimCheckCategory,
  status: AtSimCheckStatus,
  message: string,
): void {
  checks.push({ code, category, status, message });
}

function collectReasons(checks: AtSimValidationCheck[]): AtSimReason[] {
  return checks
    .filter((c) => c.status === "FAIL" || c.status === "BLOCKED")
    .map((c) => ({ code: c.code, message: c.message }));
}

function categoryStatus(
  checks: AtSimValidationCheck[],
  category: AtSimCheckCategory,
): AtSimCheckStatus {
  const subset = checks.filter((c) => c.category === category);
  if (subset.some((c) => c.status === "FAIL")) return "FAIL";
  if (subset.some((c) => c.status === "BLOCKED")) return "BLOCKED";
  if (subset.some((c) => c.status === "PASS")) return "PASS";
  return "SKIPPED";
}

function resolveOverall(
  checks: AtSimValidationCheck[],
  structuralOk: boolean,
): AtSimDraftOverallStatus {
  if (checks.some((c) => c.status === "FAIL")) return "REJECTED_LOCAL";
  const blocked = checks.filter((c) => c.status === "BLOCKED");
  if (blocked.some((c) => c.category === "RISK_BUDGET")) {
    return "BLOCKED_POLICY_UNDECIDED";
  }
  if (blocked.length > 0) return "BLOCKED_INSUFFICIENT_DATA";
  if (!structuralOk) return "REJECTED_LOCAL";
  // All supported required checks passed — still never authorizes execution.
  return "VALIDATION_PASSED";
}

/**
 * Pure simulation validation. Does not touch broker I/O or execution locks.
 */
export function validateSimulationDraft(input: AtSimDraftInput): AtSimDraftResult {
  const createdAtUtc = new Date().toISOString();
  const validatedAtUtc = createdAtUtc;
  const checks: AtSimValidationCheck[] = [];
  const policy = input.policy ?? defaultSimRiskPolicy();

  // —— Safety invariants (always recorded) ——
  pushCheck(
    checks,
    "SIMULATION_ONLY",
    "SAFETY",
    "PASS",
    "Risk engine runs in SIMULATION_ONLY mode — cannot submit broker orders.",
  );
  pushCheck(
    checks,
    "PLACES_ORDERS_FALSE",
    "SAFETY",
    "PASS",
    "placesOrders remains false.",
  );
  pushCheck(
    checks,
    "ACCEPTS_FOR_EXECUTION_FALSE",
    "SAFETY",
    "PASS",
    "acceptsForExecution remains false — a valid draft never authorizes an order.",
  );
  pushCheck(
    checks,
    "LIVE_EXECUTION_UNAUTHORIZED",
    "SAFETY",
    "PASS",
    "LIVE execution is not authorized. LIVE may appear as context only.",
  );

  // —— Environment ——
  const envMeta = input.environmentMeta;
  if (!input.environment || (input.environment !== "DEMO" && input.environment !== "LIVE")) {
    pushCheck(
      checks,
      "ENVIRONMENT_UNKNOWN",
      "ENVIRONMENT",
      "FAIL",
      "Requested environment is missing or invalid.",
    );
  } else if (envMeta.matches === false) {
    pushCheck(
      checks,
      "ENVIRONMENT_MISMATCH",
      "ENVIRONMENT",
      "FAIL",
      `Requested ${envMeta.requested} does not match session ${envMeta.actualSession ?? "UNKNOWN"}.`,
    );
  } else if (envMeta.matches == null && !envMeta.identityVerified) {
    pushCheck(
      checks,
      "ENVIRONMENT_UNVERIFIED",
      "ENVIRONMENT",
      "BLOCKED",
      "Environment identity is not verified — fail-closed for environment-dependent validation.",
    );
  } else {
    pushCheck(
      checks,
      "ENVIRONMENT_CONTEXT",
      "ENVIRONMENT",
      "PASS",
      `Environment context ${input.environment} accepted for simulation (execution still forbidden).`,
    );
  }

  // —— Instrument allowlist ——
  let instrumentOk = false;
  if (!String(input.instrument ?? "").trim()) {
    pushCheck(checks, "INSTRUMENT_MISSING", "INSTRUMENT", "FAIL", "Instrument is required.");
  } else if (!isInstrumentAllowlisted(input.instrument)) {
    pushCheck(
      checks,
      "INSTRUMENT_NOT_ALLOWLISTED",
      "INSTRUMENT",
      "FAIL",
      allowlistRejectionMessage(input.instrument),
    );
  } else {
    instrumentOk = true;
    pushCheck(
      checks,
      "INSTRUMENT_ALLOWLIST",
      "INSTRUMENT",
      "PASS",
      `Instrument ${input.instrument} is on the XAU/USD allowlist (not execution-ready by itself).`,
    );
  }

  // —— Direction ——
  const direction = input.direction;
  if (direction !== "BUY" && direction !== "SELL") {
    pushCheck(
      checks,
      "DIRECTION_MISSING",
      "DIRECTION_PRICE",
      "FAIL",
      "Direction must be BUY or SELL.",
    );
  } else {
    pushCheck(
      checks,
      "DIRECTION_PRESENT",
      "DIRECTION_PRICE",
      "PASS",
      `Direction ${direction} (analytical — not a guaranteed outcome).`,
    );
  }

  // —— Entry / SL / TP presence & finiteness ——
  const entry = input.entryPrice;
  const sl = input.stopLoss;
  const tp = input.takeProfit;

  if (!isFinitePositive(entry)) {
    pushCheck(
      checks,
      "ENTRY_INVALID",
      "DIRECTION_PRICE",
      "FAIL",
      "Entry price must be a finite positive number.",
    );
  }
  if (sl == null) {
    pushCheck(checks, "SL_MISSING", "DIRECTION_PRICE", "FAIL", "Stop Loss is required.");
  } else if (!isFinitePositive(sl)) {
    pushCheck(
      checks,
      "SL_INVALID",
      "DIRECTION_PRICE",
      "FAIL",
      "Stop Loss must be a finite positive number.",
    );
  }
  if (tp == null) {
    pushCheck(checks, "TP_MISSING", "DIRECTION_PRICE", "FAIL", "Take Profit is required.");
  } else if (!isFinitePositive(tp)) {
    pushCheck(
      checks,
      "TP_INVALID",
      "DIRECTION_PRICE",
      "FAIL",
      "Take Profit must be a finite positive number.",
    );
  }

  // —— Geometry ——
  let geometryOk = false;
  if (
    (direction === "BUY" || direction === "SELL")
    && isFinitePositive(entry)
    && isFinitePositive(sl)
    && isFinitePositive(tp)
  ) {
    if (direction === "BUY") {
      if (!(sl < entry)) {
        pushCheck(
          checks,
          "BUY_SL_NOT_BELOW_ENTRY",
          "DIRECTION_PRICE",
          "FAIL",
          `BUY requires SL (${sl}) below entry (${entry}).`,
        );
      } else if (!(tp > entry)) {
        pushCheck(
          checks,
          "BUY_TP_NOT_ABOVE_ENTRY",
          "DIRECTION_PRICE",
          "FAIL",
          `BUY requires TP (${tp}) above entry (${entry}).`,
        );
      } else {
        geometryOk = true;
        pushCheck(
          checks,
          "BUY_GEOMETRY",
          "DIRECTION_PRICE",
          "PASS",
          "BUY geometry valid: SL < entry < TP.",
        );
      }
    } else {
      if (!(sl > entry)) {
        pushCheck(
          checks,
          "SELL_SL_NOT_ABOVE_ENTRY",
          "DIRECTION_PRICE",
          "FAIL",
          `SELL requires SL (${sl}) above entry (${entry}).`,
        );
      } else if (!(tp < entry)) {
        pushCheck(
          checks,
          "SELL_TP_NOT_BELOW_ENTRY",
          "DIRECTION_PRICE",
          "FAIL",
          `SELL requires TP (${tp}) below entry (${entry}).`,
        );
      } else {
        geometryOk = true;
        pushCheck(
          checks,
          "SELL_GEOMETRY",
          "DIRECTION_PRICE",
          "PASS",
          "SELL geometry valid: TP < entry < SL.",
        );
      }
    }
  }

  // —— Price increments (only when verified metadata present) ——
  const contract = input.contract;
  if (geometryOk && contract?.verified) {
    for (const [label, price] of [
      ["entry", entry],
      ["SL", sl],
      ["TP", tp],
    ] as const) {
      if (!isFinitePositive(price)) continue;
      const inc = priceIncrementOk(
        price,
        contract.tickSize,
        contract.pointSize,
        contract.digits,
      );
      if (!inc.ok) {
        pushCheck(
          checks,
          "PRICE_INCREMENT",
          "DIRECTION_PRICE",
          "FAIL",
          `${label}: ${inc.reason}`,
        );
        geometryOk = false;
      }
    }
    if (geometryOk) {
      pushCheck(
        checks,
        "PRICE_INCREMENT",
        "DIRECTION_PRICE",
        "PASS",
        "Entry/SL/TP align to verified price increment (when available).",
      );
    }
  } else if (geometryOk && (!contract || !contract.verified)) {
    pushCheck(
      checks,
      "PRICE_INCREMENT",
      "DIRECTION_PRICE",
      "SKIPPED",
      "Price-increment enforcement skipped — contract metadata not verified.",
    );
  }

  // —— Min stop distance (CondDist pips × PointSize when verified) ——
  if (geometryOk && isFinitePositive(entry) && isFinitePositive(sl)) {
    if (contract?.minStopDistanceVerified && contract.minStopNoPositiveMinimum === true) {
      pushCheck(
        checks,
        "MIN_STOP_DISTANCE",
        "DIRECTION_PRICE",
        "PASS",
        "SDK CondDistStop=0 pips — no positive minimum stop attested for this instrument/account.",
      );
    } else if (contract?.minStopDistanceVerified && isFinitePositive(contract.minStopDistance)) {
      const dist = Math.abs(entry - sl);
      if (dist < contract.minStopDistance) {
        pushCheck(
          checks,
          "MIN_STOP_DISTANCE",
          "DIRECTION_PRICE",
          "FAIL",
          `Stop distance ${dist} (price) is below verified minimum ${contract.minStopDistance} `
            + `(CondDist pips × PointSize`
            + (contract.condDistStopPips != null ? `; CondDist=${contract.condDistStopPips} pips` : "")
            + ").",
        );
        geometryOk = false;
      } else {
        pushCheck(
          checks,
          "MIN_STOP_DISTANCE",
          "DIRECTION_PRICE",
          "PASS",
          "Stop distance meets verified broker minimum (CondDist pips × PointSize).",
        );
      }
    } else {
      pushCheck(
        checks,
        "MIN_STOP_DISTANCE_UNVERIFIED",
        "DIRECTION_PRICE",
        "BLOCKED",
        "Broker minimum stop distance is unverified for this account — not invented. "
          + "Public Enhanced Execution 'no min stop' is not account-attested without CondDist.",
      );
    }
  }

  // —— Quote freshness ——
  const quote = input.quote;
  if (quote.fresh === false) {
    pushCheck(
      checks,
      "QUOTE_STALE",
      "QUOTE",
      "FAIL",
      `Quote is not fresh (${quote.freshnessReasonCode ?? "STALE"}).`,
    );
  } else if (quote.fresh == null) {
    pushCheck(
      checks,
      "QUOTE_FRESHNESS_UNKNOWN",
      "QUOTE",
      "BLOCKED",
      "Quote freshness result is unavailable.",
    );
  } else if (!isFinitePositive(quote.entryPrice ?? entry)) {
    pushCheck(
      checks,
      "QUOTE_ENTRY_MISSING",
      "QUOTE",
      "BLOCKED",
      "Entry is not supported by verified market data.",
    );
  } else {
    pushCheck(
      checks,
      "QUOTE_FRESH",
      "QUOTE",
      "PASS",
      `Quote freshness PASS (${quote.entrySource ?? "provided"}).`,
    );
  }

  // —— Account ——
  const account = input.account;
  if (!account || !account.verified) {
    pushCheck(
      checks,
      "BLOCKED_ACCOUNT_DATA_UNAVAILABLE",
      "ACCOUNT",
      "BLOCKED",
      account?.unavailableReason
        ?? "Authoritative account equity/margin is unavailable for simulation risk.",
    );
  } else {
    if (!isFinitePositive(account.equity) && !isFinitePositive(account.balance)) {
      pushCheck(
        checks,
        "BLOCKED_ACCOUNT_EQUITY_MISSING",
        "ACCOUNT",
        "BLOCKED",
        "Verified account snapshot lacks finite equity/balance.",
      );
    } else {
      pushCheck(
        checks,
        "ACCOUNT_EQUITY_PRESENT",
        "ACCOUNT",
        "PASS",
        "Verified account equity/balance present (masked identity only).",
      );
    }
    if (!isFinitePositive(account.usableMargin) && account.usableMargin !== 0) {
      pushCheck(
        checks,
        "BLOCKED_ACCOUNT_MARGIN_MISSING",
        "ACCOUNT",
        "BLOCKED",
        "Usable margin is missing from the verified account snapshot.",
      );
    } else {
      pushCheck(
        checks,
        "ACCOUNT_MARGIN_PRESENT",
        "ACCOUNT",
        "PASS",
        "Usable margin field present on verified snapshot.",
      );
    }
  }

  // —— Quantity / contract ——
  if (!contract || !contract.verified) {
    pushCheck(
      checks,
      "CONTRACT_METADATA_UNVERIFIED",
      "QUANTITY_CONTRACT",
      "BLOCKED",
      contract?.unavailableReason
        ?? "Instrument contract metadata is not verified — quantity not invented.",
    );
  } else if (contract.quantityUnitAmbiguous || !contract.quantityUnit || contract.quantityUnit === "unknown") {
    pushCheck(
      checks,
      "QUANTITY_UNIT_AMBIGUOUS",
      "QUANTITY_CONTRACT",
      "BLOCKED",
      "Quantity unit is ambiguous or unknown — XAU ounces are not assumed.",
    );
  } else if (!isFinitePositive(contract.quantityStep) && !isFinitePositive(contract.quantityMin)) {
    pushCheck(
      checks,
      "QUANTITY_STEP_MISSING",
      "QUANTITY_CONTRACT",
      "BLOCKED",
      "Minimum quantity / quantity step is missing.",
    );
  } else {
    pushCheck(
      checks,
      "CONTRACT_METADATA",
      "QUANTITY_CONTRACT",
      "PASS",
      `Verified contract fields present (unit=${contract.quantityUnit}).`,
    );
  }

  // Requested quantity alignment (if supplied) — still no approved sizing.
  if (input.requestedQuantity != null) {
    if (!isFinitePositive(input.requestedQuantity)) {
      pushCheck(
        checks,
        "REQUESTED_QUANTITY_INVALID",
        "QUANTITY_CONTRACT",
        "FAIL",
        "Requested quantity must be a finite positive number when supplied.",
      );
    } else if (
      contract?.verified
      && isFinitePositive(contract.quantityStep)
      && !contract.quantityUnitAmbiguous
    ) {
      const step = contract.quantityStep;
      const units = input.requestedQuantity / step;
      if (Math.abs(units - Math.round(units)) > 1e-8) {
        pushCheck(
          checks,
          "REQUESTED_QUANTITY_STEP",
          "QUANTITY_CONTRACT",
          "FAIL",
          `Requested quantity ${input.requestedQuantity} is not aligned to step ${step}.`,
        );
      }
    }
  }

  // Exposure (Phase 56.2.4 — authoritative ORDERS/TRADES RO when both AVAILABLE) ——
  if (!input.exposureDataAuthoritative) {
    pushCheck(
      checks,
      "EXPOSURE_DATA_UNAVAILABLE",
      "QUANTITY_CONTRACT",
      "BLOCKED",
      "Open positions / pending orders are not authoritatively available (Orders/Trades RO incomplete, stale, or failed — not treated as zero).",
    );
  } else {
    const pos = input.openPositionsCount ?? 0;
    const pend = input.pendingOrdersCount ?? 0;
    pushCheck(
      checks,
      "EXPOSURE_DATA",
      "QUANTITY_CONTRACT",
      "PASS",
      pos === 0 && pend === 0
        ? "Authoritative confirmed empty exposure (NO_ORDERS + NO_TRADES)."
        : `Authoritative exposure (orders≠fills): positions=${pos} pending=${pend}.`,
    );
  }

  // —— Strategy capital + per-order 25% loss limit (Phase 56.2.3) ——
  // Legacy riskBudgetMode PERCENTAGE remains optional; owner-approved rule is
  // estimatedStopLossRisk <= 25% of per-order allocation (not % of account).
  const riskConfigured =
    policy.riskBudgetMode === "PERCENTAGE"
    && isFinitePositive(policy.riskPercent)
    || policy.riskBudgetMode === "FIXED"
    && isFinitePositive(policy.riskFixedAmount);

  if (policy.mode !== "SIMULATION_ONLY") {
    pushCheck(
      checks,
      "RISK_MODE_INVALID",
      "RISK_BUDGET",
      "FAIL",
      "Risk policy mode must be SIMULATION_ONLY in Phase 56.2.3.",
    );
  }

  let capitalBudgetAnalysis: AtSimCapitalBudgetAnalysis = {
    capitalAllocationPercent: input.capitalAllocationPercent ?? null,
    capitalAllocationBudget: null,
    reservedActive: Math.max(0, Number(input.reservedStrategyBudgetActive) || 0),
    remainingBudget: null,
    perOrderAllocation: null,
    perOrderLossLimit: null,
    perOrderLossLimitPass: null,
    status: "BLOCKED",
    note: "Strategy capital / per-order allocation not yet resolved.",
  };

  if (input.capitalAllocationPercent == null) {
    pushCheck(
      checks,
      "STRATEGY_ALLOC_PCT_MISSING",
      "RISK_BUDGET",
      "BLOCKED",
      "Strategy capital allocation % unset (1–100). Not auto-filled to 100%.",
    );
    capitalBudgetAnalysis = {
      ...capitalBudgetAnalysis,
      status: "BLOCKED",
      note: "Set strategy capital allocation % in Capital Allocation & Risk Limits.",
    };
  } else {
  const strategyBudget = computeCapitalAllocationBudget(
    account?.verified ? account.equity : null,
    input.capitalAllocationPercent,
  );
  if (!strategyBudget.ok) {
    pushCheck(checks, strategyBudget.code, "RISK_BUDGET", "BLOCKED", strategyBudget.message);
    capitalBudgetAnalysis = {
      ...capitalBudgetAnalysis,
      status: "BLOCKED",
      note: strategyBudget.message,
    };
  } else {
    pushCheck(
      checks,
      "STRATEGY_CAPITAL_BUDGET_COMPUTED",
      "RISK_BUDGET",
      "PASS",
      `Strategy capital budget=${strategyBudget.capitalAllocationBudget} `
        + `(${input.capitalAllocationPercent}% of verified equity; not per-order amount).`,
    );
    const reserved = capitalBudgetAnalysis.reservedActive;
    const perOrder = allocatePerOrderFromRemaining({
      capitalAllocationBudget: strategyBudget.capitalAllocationBudget,
      reservedActive: reserved,
      requestedPerOrderAllocation: input.requestedPerOrderAllocation,
    });
    if (!perOrder.ok) {
      pushCheck(checks, perOrder.code, "RISK_BUDGET", "BLOCKED", perOrder.message);
      capitalBudgetAnalysis = {
        capitalAllocationPercent: input.capitalAllocationPercent,
        capitalAllocationBudget: strategyBudget.capitalAllocationBudget,
        reservedActive: reserved,
        remainingBudget: strategyBudget.capitalAllocationBudget - reserved,
        perOrderAllocation: null,
        perOrderLossLimit: null,
        perOrderLossLimitPass: null,
        status: "BLOCKED",
        note: perOrder.message,
      };
    } else {
      pushCheck(
        checks,
        "PER_ORDER_ALLOCATION_WITHIN_BUDGET",
        "RISK_BUDGET",
        "PASS",
        `Per-order allocation=${perOrder.perOrderAllocation}; remaining after=${perOrder.remainingAfter}.`,
      );
      capitalBudgetAnalysis = {
        capitalAllocationPercent: input.capitalAllocationPercent,
        capitalAllocationBudget: strategyBudget.capitalAllocationBudget,
        reservedActive: reserved,
        remainingBudget: perOrder.remainingAfter,
        perOrderAllocation: perOrder.perOrderAllocation,
        perOrderLossLimit: perOrder.perOrderAllocation * 0.25,
        perOrderLossLimitPass: null,
        status: "PASS",
        note: "Per-order allocation is a slice of remaining strategy budget — not broker margin.",
      };
    }
  }
  }

  // Account-level hard max-loss % remains unset; 25% rule is of per-order allocation only.
  if (!riskConfigured || policy.riskBudgetMode === "UNDECIDED") {
    pushCheck(
      checks,
      "ACCOUNT_HARD_MAX_LOSS_PCT_UNSET",
      "RISK_BUDGET",
      "SKIPPED",
      "No separate account-level hard max-loss % — per-order 25%-of-allocation rule applies when inputs exist.",
    );
  }

  // —— Margin / position allocation (12–25% of equity) ——
  let allocationAnalysis: AtSimAllocationAnalysis = {
    allocationPercentage: null,
    allocationBudget: null,
    equityUsed: null,
    isStopLossRisk: false,
    inApprovedRange: null,
    forcedByWeakEvidence: false,
    status: "SKIPPED",
    note: "Allocation analysis skipped — no allocationPercentage supplied.",
  };

  const evidence = input.marketEvidenceStrength;
  const evidenceAllowsAllocation = shouldForceAllocation(evidence);
  // Stale/weak/contradictory/insufficient → never force an allocation into 12–25%.
  if (
    evidence === "WEAK"
    || evidence === "CONTRADICTORY"
    || evidence === "INSUFFICIENT"
    || evidence === "STALE"
    || quote.fresh === false
  ) {
    pushCheck(
      checks,
      "ALLOCATION_NOT_FORCED_WEAK_EVIDENCE",
      "ALLOCATION",
      "BLOCKED",
      "Weak, stale, or contradictory market evidence — allocation in 12–25% is not forced; no trade invented to consume budget.",
    );
    allocationAnalysis = {
      ...allocationAnalysis,
      status: "BLOCKED",
      note: "Allocation not forced due to weak/stale/contradictory evidence.",
    };
  }

  if (input.allocationPercentage != null) {
    const pctCheck = validateAllocationPercentage(input.allocationPercentage);
    if (!pctCheck.ok) {
      pushCheck(checks, pctCheck.code, "ALLOCATION", "FAIL", pctCheck.message);
      allocationAnalysis = {
        allocationPercentage: typeof input.allocationPercentage === "number" ? input.allocationPercentage : null,
        allocationBudget: null,
        equityUsed: null,
        isStopLossRisk: false,
        inApprovedRange: false,
        forcedByWeakEvidence: false,
        status: "FAIL",
        note: pctCheck.message,
      };
    } else if (!evidenceAllowsAllocation && evidence != null) {
      // Explicit % provided but evidence forbids forcing — report % validity without treating as entry mandate.
      pushCheck(
        checks,
        "ALLOCATION_PCT_IN_RANGE_BUT_EVIDENCE_BLOCKS",
        "ALLOCATION",
        "BLOCKED",
        `Allocation ${pctCheck.allocationPercentage}% is in-range but evidence does not permit forcing an entry.`,
      );
      allocationAnalysis = {
        allocationPercentage: pctCheck.allocationPercentage,
        allocationBudget: null,
        equityUsed: null,
        isStopLossRisk: false,
        inApprovedRange: true,
        forcedByWeakEvidence: false,
        status: "BLOCKED",
        note: "In-range allocation withheld because evidence does not support forcing entry.",
      };
    } else {
      const equity = account?.verified ? account.equity : null;
      const budget = computeAllocationBudget(equity, pctCheck.allocationPercentage);
      if (!budget.ok) {
        pushCheck(checks, budget.code, "ALLOCATION", "BLOCKED", budget.message);
        allocationAnalysis = {
          allocationPercentage: pctCheck.allocationPercentage,
          allocationBudget: null,
          equityUsed: null,
          isStopLossRisk: false,
          inApprovedRange: true,
          forcedByWeakEvidence: false,
          status: "BLOCKED",
          note: budget.message,
        };
      } else {
        pushCheck(
          checks,
          "ALLOCATION_PCT_IN_RANGE",
          "ALLOCATION",
          "PASS",
          `Allocation ${pctCheck.allocationPercentage}% is within owner-approved 12–25% (sizing input, not SL risk).`,
        );
        pushCheck(
          checks,
          "ALLOCATION_BUDGET_COMPUTED",
          "ALLOCATION",
          "PASS",
          `allocationBudget=${budget.allocationBudget} from verified equity (not stop-loss risk).`,
        );
        allocationAnalysis = {
          allocationPercentage: pctCheck.allocationPercentage,
          allocationBudget: budget.allocationBudget,
          equityUsed: budget.equityUsed,
          isStopLossRisk: false,
          inApprovedRange: true,
          forcedByWeakEvidence: false,
          status: "PASS",
          note: "Allocation budget is a margin/position sizing input — not estimated SL risk (R).",
        };
      }
    }
  } else if (allocationAnalysis.status === "SKIPPED") {
    pushCheck(
      checks,
      "ALLOCATION_SKIPPED_NO_INPUT",
      "ALLOCATION",
      "SKIPPED",
      "No allocationPercentage supplied — system must not invent 12–25% solely to fill a draft.",
    );
  }

  // —— Proposed quantity from per-order allocation (25% loss ceiling) ——
  let proposedQuantity: number | null =
    isFinitePositive(input.requestedQuantity) ? input.requestedQuantity : null;
  let proposedQuantityNote: string | null = isFinitePositive(input.requestedQuantity)
    ? `Using requested quantity ${input.requestedQuantity} (${contract?.quantityUnit ?? "unit unverified"}).`
    : null;
  if (proposedQuantity == null) {
    // Phase 56.2.5 — full allocation-aware sizer (fail closed on missing gates).
    const fullSized = sizeOrderQuantityFromAllocation({
      verifiedEquity: account?.equity ?? null,
      accountCurrency: account?.accountCurrency ?? null,
      strategyAllocationPercent: input.capitalAllocationPercent,
      remainingStrategyBudget: capitalBudgetAnalysis.remainingBudget,
      individualOrderAllocation: capitalBudgetAnalysis.perOrderAllocation,
      entryPrice: isFinitePositive(entry) ? entry : null,
      stopLoss: isFinitePositive(sl) ? sl : null,
      contract,
      freeMargin: account?.usableMargin ?? null,
      exposureAuthoritative: input.exposureDataAuthoritative === true,
      marginPerUnitAccount: contract?.marginPerLotAccount ?? null,
      sdkMinQuantity: contract?.quantityMin ?? null,
      legacyLotStep: contract?.quantityStep ?? null,
    });
    if (fullSized.ok) {
      proposedQuantity = fullSized.quantity;
      proposedQuantityNote =
        `Derived from order allocation (25% SL ceiling=$${fullSized.maxPermittedOrderLoss}); `
        + `unit=${fullSized.quantityUnit}; method=${fullSized.method}; `
        + `min=${fullSized.constraints.quantityMin} step=${fullSized.constraints.quantityStep}. `
        + `Not broker margin.`;
    } else {
      // Keep lightweight propose helper available for unit tests / partial drafts, but
      // only accept it when the full sizer failed solely on missing order allocation
      // and the light path also cannot size — otherwise prefer the full fail-closed reason.
      const light = proposeQuantityFromAllocation({
        orderAllocation: capitalBudgetAnalysis.perOrderAllocation,
        entryPrice: isFinitePositive(entry) ? entry : null,
        stopLoss: isFinitePositive(sl) ? sl : null,
        contract,
      });
      proposedQuantityNote = fullSized.message;
      pushCheck(checks, fullSized.code, "QUANTITY_CONTRACT", "BLOCKED", fullSized.message);
      if (
        light.ok
        && fullSized.code === "SIZE_QTY_ORDER_ALLOCATION_INVALID"
        && capitalBudgetAnalysis.perOrderAllocation == null
      ) {
        // No allocation yet — leave quantity null; note already set.
      } else if (!light.ok && light.message && light.message !== fullSized.message) {
        pushCheck(checks, light.code, "QUANTITY_CONTRACT", "BLOCKED", light.message);
      }
    }
  }

  // —— Independent SL risk + 3R (never invent R) ——
  const slRisk = estimateStopLossRisk({
    entryPrice: entry,
    stopLoss: sl,
    quantity: proposedQuantity,
    contract,
  });
  let rewardRiskAnalysis: AtSimRewardRiskAnalysis = {
    estimatedStopLossRisk: null,
    targetReward3R: null,
    theoreticalTakeProfit3R: null,
    riskRewardRatio: null,
    estimatedGrossTarget: null,
    estimatedNetTarget: null,
    estimatedNetTargetStatus: "NOT_VERIFIED",
    estimatedRequiredMargin: null,
    estimatedRequiredMarginStatus: "NOT_VERIFIED",
    status: "BLOCKED",
    note: "Monetary R / 3R unavailable until quantity and contract value-per-move are verified.",
  };

  if (!slRisk.ok) {
    pushCheck(checks, slRisk.code, "REWARD_RISK", "BLOCKED", slRisk.message);
  } else {
    pushCheck(
      checks,
      "ESTIMATED_SL_RISK_COMPUTED",
      "REWARD_RISK",
      "PASS",
      `Estimated SL risk R=${slRisk.estimatedStopLossRisk} (${slRisk.method}) — independent of allocation %.`,
    );
    const threeR = compute3RTarget({
      direction,
      entryPrice: entry,
      stopLoss: sl,
      takeProfit: tp,
      estimatedStopLossRisk: slRisk.estimatedStopLossRisk,
      priceMove: slRisk.priceMove,
      digits: contract?.digits ?? null,
      costDataVerified: false,
      estimatedCostsAccount: null,
    });
    if (!threeR.ok) {
      pushCheck(checks, threeR.code, "REWARD_RISK", "BLOCKED", threeR.message);
      rewardRiskAnalysis = {
        ...rewardRiskAnalysis,
        estimatedStopLossRisk: slRisk.estimatedStopLossRisk,
        status: "BLOCKED",
        note: threeR.message,
      };
    } else {
      pushCheck(
        checks,
        "TARGET_3R_COMPUTED",
        "REWARD_RISK",
        "PASS",
        `targetReward3R=${threeR.targetReward3R}; theoretical TP=${threeR.theoreticalTakeProfit3R}. Net target NOT_VERIFIED (costs).`,
      );
      rewardRiskAnalysis = {
        estimatedStopLossRisk: slRisk.estimatedStopLossRisk,
        targetReward3R: threeR.targetReward3R,
        theoreticalTakeProfit3R: threeR.theoreticalTakeProfit3R,
        riskRewardRatio: threeR.riskRewardRatio,
        estimatedGrossTarget: threeR.estimatedGrossTarget,
        estimatedNetTarget: threeR.estimatedNetTarget,
        estimatedNetTargetStatus: threeR.estimatedNetTargetStatus,
        estimatedRequiredMargin: null,
        estimatedRequiredMarginStatus: "NOT_VERIFIED",
        status: "PASS",
        note: "Gross 3R computed; net target and required margin remain NOT_VERIFIED without verified cost/margin formulas.",
      };
    }

    const lossLimit = evaluatePerOrderLossLimit({
      perOrderAllocation: capitalBudgetAnalysis.perOrderAllocation,
      estimatedStopLossRisk: slRisk.estimatedStopLossRisk,
    });
    if (!lossLimit.ok) {
      pushCheck(checks, lossLimit.code, "RISK_BUDGET", "BLOCKED", lossLimit.message);
      capitalBudgetAnalysis = {
        ...capitalBudgetAnalysis,
        perOrderLossLimit: lossLimit.perOrderLossLimit,
        perOrderLossLimitPass: false,
        status: capitalBudgetAnalysis.perOrderAllocation == null ? capitalBudgetAnalysis.status : "BLOCKED",
        note: lossLimit.message,
      };
    } else if (!lossLimit.pass) {
      pushCheck(checks, lossLimit.code, "RISK_BUDGET", "FAIL", lossLimit.message);
      capitalBudgetAnalysis = {
        ...capitalBudgetAnalysis,
        perOrderLossLimit: lossLimit.perOrderLossLimit,
        perOrderLossLimitPass: false,
        status: "FAIL",
        note: lossLimit.message,
      };
    } else {
      pushCheck(checks, lossLimit.code, "RISK_BUDGET", "PASS", lossLimit.message);
      capitalBudgetAnalysis = {
        ...capitalBudgetAnalysis,
        perOrderLossLimit: lossLimit.perOrderLossLimit,
        perOrderLossLimitPass: true,
        note: lossLimit.message,
      };
    }
  }

  // Required-margin estimate only when verified marginPerLot + quantity exist.
  if (
    isFinitePositive(proposedQuantity)
    && contract?.verified
    && isFinitePositive(contract.marginPerLotAccount)
    && !contract.quantityUnitAmbiguous
  ) {
    const req = proposedQuantity * contract.marginPerLotAccount;
    rewardRiskAnalysis = {
      ...rewardRiskAnalysis,
      estimatedRequiredMargin: req,
      estimatedRequiredMarginStatus: "COMPUTED",
    };
    if (account?.verified && typeof account.usableMargin === "number" && Number.isFinite(account.usableMargin)) {
      if (req > account.usableMargin) {
        pushCheck(
          checks,
          "INSUFFICIENT_AVAILABLE_MARGIN",
          "MARGIN",
          "BLOCKED",
          `Estimated required margin ${req} exceeds usable margin ${account.usableMargin}.`,
        );
      }
    }
  }

  // —— Margin estimate ——
  if (capitalBudgetAnalysis.perOrderAllocation == null) {
    pushCheck(
      checks,
      "MARGIN_VALIDATION_SKIPPED_POLICY",
      "MARGIN",
      "BLOCKED",
      "Full margin eligibility cannot complete without a resolved per-order allocation from strategy capital.",
    );
  } else if (!account?.verified || !isFinitePositive(account.usableMargin) && account.usableMargin !== 0) {
    pushCheck(
      checks,
      "MARGIN_ACCOUNT_UNAVAILABLE",
      "MARGIN",
      "BLOCKED",
      "Cannot validate margin without verified usable margin.",
    );
  } else {
    pushCheck(
      checks,
      "MARGIN_INPUTS_PRESENT",
      "MARGIN",
      "PASS",
      "Margin inputs present for future simulation (no broker margin call issued).",
    );
  }

  // —— Profit protection (simulation only) ——
  let profitProtection = null;
  if (input.profitProtection) {
    const stopDistancePrice =
      isFinitePositive(entry) && isFinitePositive(sl) ? Math.abs(entry - sl) : null;
    profitProtection = evaluateProfitProtection({
      direction: direction === "BUY" || direction === "SELL" ? direction : null,
      originalStopLoss: isFinitePositive(sl) ? sl : null,
      entryPrice: isFinitePositive(entry) ? entry : null,
      currentPrice: input.profitProtection.currentPrice,
      favorableMovePrice: input.profitProtection.favorableMovePrice,
      stopDistancePrice,
      multiTimeframeReversalEvidence: input.profitProtection.multiTimeframeReversalEvidence,
      evidenceContradictory: input.profitProtection.evidenceContradictory,
      evidenceInsufficient: input.profitProtection.evidenceInsufficient,
      proposedMinFavorableR: input.profitProtection.proposedMinFavorableR,
      proposedTightenToBreakEven: input.profitProtection.proposedTightenToBreakEven,
    });
    pushCheck(
      checks,
      "PROFIT_PROTECTION_EVALUATED",
      "PROFIT_PROTECTION",
      profitProtection.state === "PROTECTIVE_ACTION_PROPOSED_SIM" ? "PASS" : "PASS",
      `Profit protection state=${profitProtection.state}; action=${profitProtection.proposedAction}; isBrokerExecution=false.`,
    );
    if (profitProtection.evidenceCodes.includes("PROTECTIVE_SL_WIDEN_REJECTED")) {
      pushCheck(
        checks,
        "PROTECTIVE_SL_WIDEN_REJECTED",
        "PROFIT_PROTECTION",
        "FAIL",
        "Protective Stop Loss proposal would widen risk — rejected.",
      );
    }
  } else {
    pushCheck(
      checks,
      "PROFIT_PROTECTION_SKIPPED",
      "PROFIT_PROTECTION",
      "SKIPPED",
      "No profit-protection context supplied for this draft validation.",
    );
  }

  const structuralOk =
    instrumentOk
    && geometryOk
    && (direction === "BUY" || direction === "SELL")
    && isFinitePositive(entry)
    && isFinitePositive(sl)
    && isFinitePositive(tp)
    && !checks.some((c) => c.category === "DIRECTION_PRICE" && c.status === "FAIL")
    && !checks.some((c) => c.category === "INSTRUMENT" && c.status === "FAIL")
    && !checks.some((c) => c.category === "ENVIRONMENT" && c.status === "FAIL")
    && !checks.some((c) => c.category === "ALLOCATION" && c.status === "FAIL");

  if (structuralOk) {
    pushCheck(
      checks,
      "STRUCTURAL_OK",
      "STRUCTURAL",
      "PASS",
      "Structural SL/TP/direction/instrument checks passed (eligibility may still be blocked).",
    );
  } else {
    pushCheck(
      checks,
      "STRUCTURAL_INCOMPLETE",
      "STRUCTURAL",
      checks.some((c) => c.status === "FAIL") ? "FAIL" : "BLOCKED",
      "Structural validation incomplete or failed.",
    );
  }

  const overallStatus = resolveOverall(checks, structuralOk);
  const reasons = collectReasons(checks);
  const explanations = reasons.map((r) => r.message);

  const eligibilityStatus: AtSimDraftResult["eligibilityStatus"] =
    overallStatus === "REJECTED_LOCAL"
      ? "REJECTED"
      : overallStatus === "VALIDATION_PASSED"
        ? "SIMULATION_ANALYSIS_ONLY"
        : "BLOCKED";

  return {
    schemaVersion: AT_SIM_RISK_SCHEMA,
    phase: AT_SIM_RISK_PHASE,
    draftId: randomUUID(),
    createdAtUtc,
    validatedAtUtc,
    overallStatus,
    environment: input.environment,
    instrument: String(input.instrument ?? ""),
    direction: direction === "BUY" || direction === "SELL" ? direction : null,
    entryPrice: isFinitePositive(entry) ? entry : null,
    stopLoss: isFinitePositive(sl) ? sl : null,
    takeProfit: isFinitePositive(tp) ? tp : null,
    proposedQuantity,
    proposedQuantityNote,
    structuralOk,
    instrumentStatus: categoryStatus(checks, "INSTRUMENT"),
    quoteFreshnessStatus: categoryStatus(checks, "QUOTE"),
    slTpStatus: categoryStatus(checks, "DIRECTION_PRICE"),
    accountStatus: categoryStatus(checks, "ACCOUNT"),
    quantityContractStatus: categoryStatus(checks, "QUANTITY_CONTRACT"),
    riskBudgetStatus: categoryStatus(checks, "RISK_BUDGET"),
    marginStatus: categoryStatus(checks, "MARGIN"),
    checks,
    reasons,
    explanations,
    sourceDecisionId: input.sourceDecisionId,
    sourceAnalysisId: input.sourceAnalysisId,
    sourceEvidenceFingerprint: input.sourceEvidenceFingerprint,
    riskPolicyVersion: AT_SIM_RISK_POLICY_VERSION,
    riskPolicyMode: "SIMULATION_ONLY",
    riskPercentConfigured: riskConfigured,
    allocationAnalysis,
    rewardRiskAnalysis,
    capitalBudgetAnalysis,
    profitProtection,
    eligibilityStatus,
    banner: AT_SIM_RISK_BANNER,
    simulationOnly: true,
    placesOrders: false,
    acceptsForExecution: false,
  };
}

export function normalizeSimRiskPolicy(raw: unknown): AtSimRiskPolicy {
  const base = defaultSimRiskPolicy();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  // Refuse to silently invent a hard max-loss % as "approved".
  const mode = o.riskBudgetMode;
  let riskBudgetMode = base.riskBudgetMode;
  let riskPercent: number | null = null;
  let riskFixedAmount: number | null = null;
  if (mode === "UNDECIDED" || mode === "PERCENTAGE" || mode === "FIXED") {
    riskBudgetMode = mode;
  }
  if (riskBudgetMode === "PERCENTAGE" && typeof o.riskPercent === "number" && Number.isFinite(o.riskPercent) && o.riskPercent > 0) {
    riskPercent = o.riskPercent;
  } else if (riskBudgetMode === "PERCENTAGE") {
    riskBudgetMode = "UNDECIDED";
    riskPercent = null;
  }
  if (riskBudgetMode === "FIXED" && typeof o.riskFixedAmount === "number" && Number.isFinite(o.riskFixedAmount) && o.riskFixedAmount > 0) {
    riskFixedAmount = o.riskFixedAmount;
  } else if (riskBudgetMode === "FIXED") {
    riskBudgetMode = "UNDECIDED";
    riskFixedAmount = null;
  }
  // Allocation band is owner-approved at 12–25; do not silently widen/narrow.
  const allocationPolicyMode =
    o.allocationPolicyMode === "UNSET" ? "UNSET" : "PERCENTAGE_RANGE";
  return {
    ...base,
    riskBudgetMode,
    riskPercent,
    riskFixedAmount,
    allocationPolicyMode,
    allocationPercentMin: 12,
    allocationPercentMax: 25,
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : base.updatedAtUtc,
    updatedBy: o.updatedBy === "admin" ? "admin" : "system",
    note: typeof o.note === "string" && o.note.trim()
      ? o.note.trim().slice(0, 400)
      : base.note,
  };
}
