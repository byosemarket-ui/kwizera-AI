/**
 * Phase 56.2 — Deterministic simulation-only draft validation.
 * Shared DEMO/LIVE rules. Never submits broker orders. Never invents risk %, ounces, or min-stop.
 */
import { randomUUID } from "node:crypto";
import { allowlistRejectionMessage, isInstrumentAllowlisted } from "./allowlist.js";
import {
  AT_SIM_RISK_BANNER,
  AT_SIM_RISK_PHASE,
  AT_SIM_RISK_POLICY_VERSION,
  AT_SIM_RISK_SCHEMA,
  defaultSimRiskPolicy,
  type AtSimCheckCategory,
  type AtSimCheckStatus,
  type AtSimDraftInput,
  type AtSimDraftOverallStatus,
  type AtSimDraftResult,
  type AtSimReason,
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

  // —— Min stop distance (only when verified) ——
  if (geometryOk && isFinitePositive(entry) && isFinitePositive(sl)) {
    if (contract?.minStopDistanceVerified && isFinitePositive(contract.minStopDistance)) {
      const dist = Math.abs(entry - sl);
      if (dist < contract.minStopDistance) {
        pushCheck(
          checks,
          "MIN_STOP_DISTANCE",
          "DIRECTION_PRICE",
          "FAIL",
          `Stop distance ${dist} is below verified minimum ${contract.minStopDistance}.`,
        );
        geometryOk = false;
      } else {
        pushCheck(
          checks,
          "MIN_STOP_DISTANCE",
          "DIRECTION_PRICE",
          "PASS",
          "Stop distance meets verified broker minimum.",
        );
      }
    } else {
      pushCheck(
        checks,
        "MIN_STOP_DISTANCE_UNVERIFIED",
        "DIRECTION_PRICE",
        "BLOCKED",
        "Broker minimum stop distance is unverified — not invented (Phase 56.1).",
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

  // Exposure (Orders/Trades RO missing in 56.1) ——
  if (!input.exposureDataAuthoritative) {
    pushCheck(
      checks,
      "EXPOSURE_DATA_UNAVAILABLE",
      "QUANTITY_CONTRACT",
      "BLOCKED",
      "Open positions / pending orders are not authoritatively available (Orders/Trades RO missing).",
    );
  } else {
    pushCheck(
      checks,
      "EXPOSURE_DATA",
      "QUANTITY_CONTRACT",
      "PASS",
      `Authoritative exposure: positions=${input.openPositionsCount ?? "—"} pending=${input.pendingOrdersCount ?? "—"}.`,
    );
  }

  // —— Risk budget (OD-04 undecided) ——
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
      "Risk policy mode must be SIMULATION_ONLY in Phase 56.2.",
    );
  }

  if (!riskConfigured || policy.riskBudgetMode === "UNDECIDED") {
    pushCheck(
      checks,
      "BLOCKED_POLICY_UNDECIDED",
      "RISK_BUDGET",
      "BLOCKED",
      "Owner risk percentage/budget is undecided — quantity is not owner-approved risk sizing.",
    );
  } else {
    pushCheck(
      checks,
      "RISK_BUDGET_CONFIGURED",
      "RISK_BUDGET",
      "PASS",
      "Owner risk budget is configured for simulation (still does not authorize execution).",
    );
  }

  // —— Margin estimate ——
  // Without approved risk budget + verified quantity, margin eligibility stays blocked.
  if (!riskConfigured) {
    pushCheck(
      checks,
      "MARGIN_VALIDATION_SKIPPED_POLICY",
      "MARGIN",
      "BLOCKED",
      "Margin eligibility cannot complete without an owner-approved risk budget.",
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

  // Never emit an approved proposed quantity in 56.2 while risk % undecided / units ambiguous.
  const proposedQuantity: number | null = null;
  const proposedQuantityNote =
    "Proposed quantity withheld: owner risk budget undecided and/or contract unit/min-stop/exposure incomplete. "
    + "No ounces or lot sizes were invented.";

  const structuralOk =
    instrumentOk
    && geometryOk
    && (direction === "BUY" || direction === "SELL")
    && isFinitePositive(entry)
    && isFinitePositive(sl)
    && isFinitePositive(tp)
    && !checks.some((c) => c.category === "DIRECTION_PRICE" && c.status === "FAIL")
    && !checks.some((c) => c.category === "INSTRUMENT" && c.status === "FAIL")
    && !checks.some((c) => c.category === "ENVIRONMENT" && c.status === "FAIL");

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
  // Phase 56.2: refuse to silently adopt a default percentage as "approved".
  // Only accept UNDECIDED unless an explicit future owner patch sets mode + value
  // through a separately authorized policy update (not auto-defaulted here).
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
    // Incomplete percentage config → treat as undecided rather than inventing.
    riskBudgetMode = "UNDECIDED";
    riskPercent = null;
  }
  if (riskBudgetMode === "FIXED" && typeof o.riskFixedAmount === "number" && Number.isFinite(o.riskFixedAmount) && o.riskFixedAmount > 0) {
    riskFixedAmount = o.riskFixedAmount;
  } else if (riskBudgetMode === "FIXED") {
    riskBudgetMode = "UNDECIDED";
    riskFixedAmount = null;
  }
  return {
    ...base,
    riskBudgetMode,
    riskPercent,
    riskFixedAmount,
    updatedAtUtc: typeof o.updatedAtUtc === "string" ? o.updatedAtUtc : base.updatedAtUtc,
    updatedBy: o.updatedBy === "admin" ? "admin" : "system",
    note: typeof o.note === "string" && o.note.trim()
      ? o.note.trim().slice(0, 400)
      : base.note,
  };
}
