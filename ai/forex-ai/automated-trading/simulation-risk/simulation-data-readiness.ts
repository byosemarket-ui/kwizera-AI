/**
 * Phase 56.2.7 — Deterministic simulation-data readiness gates.
 * Read-only evaluation. Never enables execution.
 * A connected broker session alone does not imply READY for draft sizing.
 */

export type SimulationDataGateStatus =
  | "READY"
  | "PARTIALLY_READY"
  | "BLOCKED"
  | "STALE"
  | "UNVERIFIED"
  | "UNAVAILABLE";

export interface SimulationDataGate {
  id: string;
  label: string;
  status: SimulationDataGateStatus;
  /** Short reason when not READY. */
  reason: string | null;
  /** Why this gate matters for simulation draft. */
  whyItMatters: string;
  /** Calculations / actions blocked when gate fails. */
  blocks: string[];
  /** What evidence clears the gate. */
  evidenceNeeded: string | null;
  /** Safe to use in monetary risk / quantity sizing. */
  safeForRiskCalc: boolean;
  authoritative: boolean;
  scope: "DEMO" | "LIVE" | "MIXED" | "PUBLIC_DOCS" | "N_A";
}

export interface SimulationDataReadinessResult {
  overall: SimulationDataGateStatus;
  /** True only when every mandatory sizing gate is READY (still never enables execution). */
  readyForSimulationDraft: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  gates: SimulationDataGate[];
  evaluatedAtUtc: string;
  notes: string[];
}

function gate(partial: Omit<SimulationDataGate, "safeForRiskCalc" | "authoritative"> & {
  safeForRiskCalc?: boolean;
  authoritative?: boolean;
}): SimulationDataGate {
  const ready = partial.status === "READY";
  return {
    ...partial,
    safeForRiskCalc: partial.safeForRiskCalc ?? ready,
    authoritative: partial.authoritative ?? ready,
  };
}

export interface SimulationDataReadinessInput {
  environment?: "DEMO" | "LIVE" | null;
  environmentMatches?: boolean | null;
  quoteFresh?: boolean | null;
  quoteReasonCode?: string | null;
  feedStatus?: string | null;
  bid?: number | null;
  ask?: number | null;
  accountVerified?: boolean | null;
  accountCurrency?: string | null;
  equity?: number | null;
  usableMargin?: number | null;
  accountFresh?: boolean | null;
  quantityUnit?: string | null;
  quantityUnitAmbiguous?: boolean | null;
  quantityMin?: number | null;
  quantityStep?: number | null;
  quantityConstraintsVerified?: boolean | null;
  minStopDistanceVerified?: boolean | null;
  minStopNoPositiveMinimum?: boolean | null;
  condDistUnit?: string | null;
  condDistAvailable?: boolean | null;
  conversionRequired?: boolean | null;
  conversionReady?: boolean | null;
  conversionReason?: string | null;
  exposureAuthoritative?: boolean | null;
  exposureStatus?: string | null;
  confirmedZeroExposure?: boolean | null;
  masterEnable?: boolean | null;
  emergencyEntryLock?: boolean | null;
  nowUtc?: string;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Evaluate all simulation-draft data dependencies.
 * Overall is READY only when every mandatory gate is READY.
 */
export function evaluateSimulationDataReadiness(
  input: SimulationDataReadinessInput,
): SimulationDataReadinessResult {
  const notes: string[] = [];
  const scope = input.environment === "LIVE" ? "LIVE" : input.environment === "DEMO" ? "DEMO" : "N_A";
  const gates: SimulationDataGate[] = [];

  // —— Environment ——
  if (input.environmentMatches === false) {
    gates.push(gate({
      id: "environment",
      label: "Environment match",
      status: "BLOCKED",
      reason: "Selected environment does not match connected session.",
      whyItMatters: "Wrong environment would misattribute account and exposure data.",
      blocks: ["all simulation draft validation"],
      evidenceNeeded: "Reconnect or switch so selected env matches session.",
      scope,
    }));
  } else if (input.environment == null) {
    gates.push(gate({
      id: "environment",
      label: "Environment match",
      status: "UNAVAILABLE",
      reason: "Environment not selected.",
      whyItMatters: "DEMO/LIVE scope is required for account and exposure authority.",
      blocks: ["all simulation draft validation"],
      evidenceNeeded: "Select DEMO or LIVE (LIVE remains unauthorized for execution).",
      scope: "N_A",
    }));
  } else {
    gates.push(gate({
      id: "environment",
      label: "Environment match",
      status: "READY",
      reason: null,
      whyItMatters: "DEMO/LIVE scope for account and exposure.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  }

  // —— Market quote ——
  const hasBidAsk = finitePositive(input.bid) && finitePositive(input.ask);
  if (!hasBidAsk) {
    gates.push(gate({
      id: "market_quote",
      label: "XAU/USD quote",
      status: "UNAVAILABLE",
      reason: "Bid/ask missing or non-finite.",
      whyItMatters: "Entry and SL/TP geometry require a live quote.",
      blocks: ["entry derivation", "stop geometry", "quantity sizing", "monetary SL risk"],
      evidenceNeeded: "Fresh ForexConnect Offers bid/ask for XAU/USD.",
      scope,
    }));
  } else if (input.quoteFresh === false || input.feedStatus === "STALE" || input.feedStatus === "DISCONNECTED") {
    const st = input.feedStatus === "DISCONNECTED" ? "UNAVAILABLE" : "STALE";
    gates.push(gate({
      id: "market_quote",
      label: "XAU/USD quote",
      status: st,
      reason: input.quoteReasonCode ?? input.feedStatus ?? "Quote not fresh.",
      whyItMatters: "Stale quotes must not size risk or invent setups.",
      blocks: ["entry derivation", "quantity sizing", "monetary SL risk", "draft VALIDATION_PASSED"],
      evidenceNeeded: "LIVE feed with recent Bid/Ask price changes within freshness threshold.",
      scope,
      safeForRiskCalc: false,
      authoritative: false,
    }));
  } else if (input.quoteFresh === true && hasBidAsk) {
    gates.push(gate({
      id: "market_quote",
      label: "XAU/USD quote",
      status: "READY",
      reason: null,
      whyItMatters: "Entry and geometry from verified quote.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  } else {
    gates.push(gate({
      id: "market_quote",
      label: "XAU/USD quote",
      status: "UNVERIFIED",
      reason: "Quote freshness not evaluated.",
      whyItMatters: "Cannot trust quote without freshness evaluation.",
      blocks: ["entry derivation", "quantity sizing"],
      evidenceNeeded: "Run verification / status freshness evaluation.",
      scope,
    }));
  }

  // —— Account ——
  if (input.accountVerified !== true) {
    gates.push(gate({
      id: "account_identity",
      label: "Account identity",
      status: "BLOCKED",
      reason: "Account identity not verified.",
      whyItMatters: "Equity and margin must belong to the intended DEMO/LIVE account.",
      blocks: ["strategy budget", "margin checks", "quantity sizing"],
      evidenceNeeded: "Successful verify-account with matching environment.",
      scope,
    }));
  } else {
    gates.push(gate({
      id: "account_identity",
      label: "Account identity",
      status: "READY",
      reason: null,
      whyItMatters: "Verified account for equity/margin.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  }

  const ccy = String(input.accountCurrency ?? "").trim().toUpperCase();
  if (!ccy) {
    gates.push(gate({
      id: "account_currency",
      label: "Account currency",
      status: "UNAVAILABLE",
      reason: "Account currency missing — not assumed USD.",
      whyItMatters: "Monetary risk and allocation currency must match or convert.",
      blocks: ["monetary SL risk", "allocation currency", "FX conversion path"],
      evidenceNeeded: "Account snapshot with accountCurrency.",
      scope,
    }));
  } else {
    gates.push(gate({
      id: "account_currency",
      label: "Account currency",
      status: "READY",
      reason: null,
      whyItMatters: "Known account currency for risk units.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  }

  if (!finitePositive(input.equity)) {
    gates.push(gate({
      id: "account_equity",
      label: "Verified equity",
      status: "UNAVAILABLE",
      reason: "Equity missing or non-positive — not treated as zero.",
      whyItMatters: "Strategy budget = equity × allocation %.",
      blocks: ["strategy budget", "remaining allocation", "quantity sizing"],
      evidenceNeeded: "Fresh account snapshot with equity (or verified balance derivation).",
      scope,
    }));
  } else if (input.accountFresh === false) {
    gates.push(gate({
      id: "account_equity",
      label: "Verified equity",
      status: "STALE",
      reason: "Account snapshot is stale.",
      whyItMatters: "Stale equity must not size new allocations.",
      blocks: ["strategy budget", "quantity sizing"],
      evidenceNeeded: "Refresh verify-account within snapshot max age.",
      scope,
    }));
  } else {
    gates.push(gate({
      id: "account_equity",
      label: "Verified equity",
      status: "READY",
      reason: null,
      whyItMatters: "Strategy capital budget input.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  }

  if (!finiteNonNeg(input.usableMargin)) {
    gates.push(gate({
      id: "free_margin",
      label: "Free / usable margin",
      status: "UNAVAILABLE",
      reason: "Usable margin missing — not treated as zero.",
      whyItMatters: "Required margin must fit free margin when margin/unit is verified.",
      blocks: ["margin eligibility", "quantity reduction for margin"],
      evidenceNeeded: "Account snapshot with usableMargin.",
      scope,
    }));
  } else {
    gates.push(gate({
      id: "free_margin",
      label: "Free / usable margin",
      status: "READY",
      reason: null,
      whyItMatters: "Margin headroom for sized quantity.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  }

  // —— Quantity constraints ——
  if (
    input.quantityUnitAmbiguous === true
    || input.quantityUnit !== "contracts"
    || input.quantityConstraintsVerified === false
  ) {
    gates.push(gate({
      id: "quantity_constraints",
      label: "XAU quantity min/step",
      status: input.quantityUnitAmbiguous ? "UNVERIFIED" : "BLOCKED",
      reason: "Quantity unit or min/step not verified contracts.",
      whyItMatters: "Cannot invent ounces/lots or round to an unverified increment.",
      blocks: ["proposed quantity", "monetary SL risk"],
      evidenceNeeded: "Verified BaseUnitSize + MinQuantity (contracts) for XAU/USD.",
      scope,
    }));
  } else if (!finitePositive(input.quantityMin) || !finitePositive(input.quantityStep)) {
    gates.push(gate({
      id: "quantity_constraints",
      label: "XAU quantity min/step",
      status: "UNVERIFIED",
      reason: "quantityMin/quantityStep missing after constraint resolution.",
      whyItMatters: "Floor sizing requires verified min and step.",
      blocks: ["proposed quantity"],
      evidenceNeeded: "TradingSettings MinQuantity + BaseUnitSize.",
      scope,
    }));
  } else {
    gates.push(gate({
      id: "quantity_constraints",
      label: "XAU quantity min/step",
      status: "READY",
      reason: null,
      whyItMatters: "Floor quantity to broker constraints.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  }

  // —— CondDist / min-stop ——
  if (input.minStopDistanceVerified === true || input.minStopNoPositiveMinimum === true) {
    gates.push(gate({
      id: "min_stop",
      label: "Minimum stop / CondDist",
      status: "READY",
      reason: input.minStopNoPositiveMinimum
        ? "CondDist=0 pips — no positive minimum attested."
        : null,
      whyItMatters: "Stop geometry must satisfy account-scoped minimum when present.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  } else if (input.condDistAvailable && String(input.condDistUnit ?? "").toLowerCase() !== "pips") {
    gates.push(gate({
      id: "min_stop",
      label: "Minimum stop / CondDist",
      status: "UNVERIFIED",
      reason: "CondDist present but unit not verified as pips.",
      whyItMatters: "Cannot convert CondDist without verified unit.",
      blocks: ["min-stop geometry gate", "VALIDATION_PASSED when min-stop required"],
      evidenceNeeded: "Documented getCondDist* method with unit=pips + PointSize.",
      scope,
    }));
  } else {
    gates.push(gate({
      id: "min_stop",
      label: "Minimum stop / CondDist",
      status: "UNVERIFIED",
      reason: "Account-scoped CondDist/min-stop not attested (public Enhanced Execution not sufficient).",
      whyItMatters: "Min-stop gate remains fail-closed without account evidence.",
      blocks: ["min-stop geometry gate", "VALIDATION_PASSED when min-stop required"],
      evidenceNeeded: "TradingSettings CondDistStop in pips for this account/instrument.",
      scope,
    }));
  }

  // —— Currency conversion ——
  if (input.conversionRequired === true) {
    if (input.conversionReady === true) {
      gates.push(gate({
        id: "currency_conversion",
        label: "Currency conversion",
        status: "READY",
        reason: null,
        whyItMatters: "Allocation and risk must share account currency.",
        blocks: [],
        evidenceNeeded: null,
        scope,
      }));
    } else {
      gates.push(gate({
        id: "currency_conversion",
        label: "Currency conversion",
        status: "BLOCKED",
        reason: input.conversionReason ?? "Required FX rate missing or stale.",
        whyItMatters: "Non-matching currencies cannot invent rates.",
        blocks: ["monetary SL risk", "order allocation in account ccy"],
        evidenceNeeded: "Fresh ConversionRateSnapshot with explicit direction and source.",
        scope,
      }));
    }
  } else if (ccy && ccy !== "USD") {
    // Allocation UI is labeled USD — if account is non-USD, conversion is required.
    gates.push(gate({
      id: "currency_conversion",
      label: "Currency conversion",
      status: "BLOCKED",
      reason: `Account currency ${ccy} ≠ USD allocation label — conversion required but not supplied.`,
      whyItMatters: "Order Allocation (USD) must convert to account currency.",
      blocks: ["monetary risk", "quantity sizing from USD allocation"],
      evidenceNeeded: "Authoritative USD→account rate snapshot.",
      scope,
    }));
  } else {
    gates.push(gate({
      id: "currency_conversion",
      label: "Currency conversion",
      status: "READY",
      reason: ccy === "USD" ? "Identity conversion (USD account)." : null,
      whyItMatters: "Same-currency identity when applicable.",
      blocks: [],
      evidenceNeeded: null,
      scope,
    }));
  }

  // —— Exposure ——
  if (input.exposureAuthoritative === true) {
    gates.push(gate({
      id: "exposure",
      label: "Orders/Trades exposure",
      status: "READY",
      reason: input.confirmedZeroExposure
        ? "Authoritative empty (NO_ORDERS + NO_TRADES) — not a failed query."
        : null,
      whyItMatters: "Remaining strategy budget needs authoritative open exposure.",
      blocks: [],
      evidenceNeeded: null,
      scope,
      authoritative: true,
    }));
  } else if (input.exposureStatus === "UNAVAILABLE" || input.exposureAuthoritative === false) {
    gates.push(gate({
      id: "exposure",
      label: "Orders/Trades exposure",
      status: "UNAVAILABLE",
      reason:
        `Exposure not authoritative (${input.exposureStatus ?? "unknown"}) — failed/incomplete query is not zero.`,
      whyItMatters: "Cannot treat unknown open risk as empty.",
      blocks: ["remaining strategy budget", "quantity sizing that requires exposure"],
      evidenceNeeded: "Successful ORDERS + TRADES RO with matching account/environment.",
      scope,
      authoritative: false,
      safeForRiskCalc: false,
    }));
  } else {
    gates.push(gate({
      id: "exposure",
      label: "Orders/Trades exposure",
      status: "UNVERIFIED",
      reason: "Exposure reconciliation not evaluated.",
      whyItMatters: "Budget remaining depends on open orders/positions.",
      blocks: ["remaining strategy budget"],
      evidenceNeeded: "Run status with Connected DEMO/LIVE and Orders/Trades RO.",
      scope,
    }));
  }

  // —— Execution locks (informational — must stay closed) ——
  const locksOk = input.masterEnable !== true && input.emergencyEntryLock !== false;
  gates.push(gate({
    id: "execution_locks",
    label: "Execution safety locks",
    status: locksOk ? "READY" : "BLOCKED",
    reason: locksOk
      ? "masterEnable=false; emergencyEntryLock=true; placesOrders remains false."
      : "Unexpected lock state — investigate before any further AT work.",
    whyItMatters: "Simulation must never enable broker execution.",
    blocks: locksOk ? [] : ["all AT operations until locks restored"],
    evidenceNeeded: locksOk ? null : "Restore master OFF and emergency lock ON.",
    scope: "MIXED",
    safeForRiskCalc: locksOk,
    authoritative: true,
  }));

  const mandatoryIds = new Set([
    "environment",
    "market_quote",
    "account_identity",
    "account_currency",
    "account_equity",
    "free_margin",
    "quantity_constraints",
    "min_stop",
    "currency_conversion",
    "exposure",
    "execution_locks",
  ]);

  const mandatory = gates.filter((g) => mandatoryIds.has(g.id));
  const allReady = mandatory.every((g) => g.status === "READY");
  const anyStale = mandatory.some((g) => g.status === "STALE");
  const anyBlocked = mandatory.some((g) => g.status === "BLOCKED" || g.status === "UNAVAILABLE");
  const anyUnverified = mandatory.some((g) => g.status === "UNVERIFIED");

  let overall: SimulationDataGateStatus;
  if (allReady) overall = "READY";
  else if (anyBlocked) overall = "BLOCKED";
  else if (anyStale) overall = "STALE";
  else if (anyUnverified) overall = "PARTIALLY_READY";
  else overall = "PARTIALLY_READY";

  if (overall === "READY") {
    notes.push(
      "All mandatory simulation-data gates READY — draft sizing may proceed; execution remains forbidden.",
    );
  } else {
    notes.push(
      "Simulation draft must fail closed on non-READY gates — do not invent missing broker facts.",
    );
  }

  return {
    overall,
    readyForSimulationDraft: allReady,
    placesOrders: false,
    acceptsForExecution: false,
    gates,
    evaluatedAtUtc: input.nowUtc ?? new Date().toISOString(),
    notes,
  };
}

/** Summarize for public status API (no secrets). */
export function simulationDataReadinessPublicSummary(
  r: SimulationDataReadinessResult,
): Record<string, unknown> {
  return {
    overall: r.overall,
    readyForSimulationDraft: r.readyForSimulationDraft,
    placesOrders: false,
    acceptsForExecution: false,
    gateCount: r.gates.length,
    notReady: r.gates
      .filter((g) => g.status !== "READY")
      .map((g) => ({ id: g.id, status: g.status, reason: g.reason, blocks: g.blocks })),
    evaluatedAtUtc: r.evaluatedAtUtc,
    notes: r.notes,
  };
}
