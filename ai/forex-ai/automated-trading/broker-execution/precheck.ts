/**
 * Phase 2 — Final pre-execution validator (pure, fail-closed).
 * Never places orders. Never sets acceptsForExecution. Never mutates broker.
 */
import { evaluateProtectiveGeometry } from "../broker-intent/protective-geometry.js";
import { evaluateBrokerQuantityContract } from "../order-execution/broker-quantity-contract.js";
import {
  attestProposedOrderMargin,
  executableMarketPrice,
  measureSlippageAbsolute,
} from "../risk-policy/index.js";
import { validateBidAsk } from "../verification-engine.js";
import {
  AT_BROKER_PRECHECK_DEFAULT_TTL_MS,
  AT_BROKER_PRECHECK_PHASE,
  AT_BROKER_PRECHECK_RESULT_SCHEMA,
  defaultPrecheckRiskLimits,
  OWNER_MAX_LOTS_PRECHECK,
  type AtPrecheckBlockingReason,
  type AtPrecheckCheck,
  type AtPrecheckControlSnapshot,
  type AtPrecheckRiskLimits,
  type AtPreExecutionValidationInput,
  type AtPreExecutionValidationResult,
} from "./precheck-types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function finiteNonNeg(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

function newValidationId(nowMs: number): string {
  return `precheck-${nowMs.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function mergeLimits(partial?: Partial<AtPrecheckRiskLimits> | null): AtPrecheckRiskLimits {
  const base = defaultPrecheckRiskLimits();
  if (!partial) return base;
  return {
    maxLotsPerOrder: finitePositive(partial.maxLotsPerOrder)
      ? Math.min(partial.maxLotsPerOrder, OWNER_MAX_LOTS_PRECHECK)
      : base.maxLotsPerOrder,
    maxTotalExposureLots: finitePositive(partial.maxTotalExposureLots)
      ? Math.min(partial.maxTotalExposureLots, OWNER_MAX_LOTS_PRECHECK)
      : base.maxTotalExposureLots,
    maxOpenPositions: Number.isInteger(partial.maxOpenPositions) && (partial.maxOpenPositions as number) > 0
      ? (partial.maxOpenPositions as number)
      : base.maxOpenPositions,
    maxDailyLossAccount: partial.maxDailyLossAccount === null
      ? null
      : (finitePositive(partial.maxDailyLossAccount) ? partial.maxDailyLossAccount : base.maxDailyLossAccount),
    maxDrawdownFractionOfDayStartEquity: partial.maxDrawdownFractionOfDayStartEquity === null
      ? null
      : (finitePositive(partial.maxDrawdownFractionOfDayStartEquity)
        && (partial.maxDrawdownFractionOfDayStartEquity as number) <= 1
        ? partial.maxDrawdownFractionOfDayStartEquity
        : base.maxDrawdownFractionOfDayStartEquity),
    maxSpreadAbsolute: partial.maxSpreadAbsolute === null
      ? null
      : (finitePositive(partial.maxSpreadAbsolute) ? partial.maxSpreadAbsolute : base.maxSpreadAbsolute),
    maxSlippageAbsolute: partial.maxSlippageAbsolute === null
      ? null
      : (finitePositive(partial.maxSlippageAbsolute) ? partial.maxSlippageAbsolute : base.maxSlippageAbsolute),
    accountMaxAgeMs: finitePositive(partial.accountMaxAgeMs) ? partial.accountMaxAgeMs : base.accountMaxAgeMs,
    quoteMaxAgeMs: finitePositive(partial.quoteMaxAgeMs) ? partial.quoteMaxAgeMs : base.quoteMaxAgeMs,
  };
}

function check(
  id: string,
  category: AtPrecheckCheck["category"],
  verdict: AtPrecheckCheck["verdict"],
  code: string,
  message: string,
  mandatory = true,
): AtPrecheckCheck {
  return { id, category, verdict, code, message, mandatory };
}

/**
 * Pure pre-execution validation.
 * `allowed=true` only when every mandatory check PASSes — still never authorizes submit.
 */
export function runPreExecutionValidation(
  input: AtPreExecutionValidationInput,
): AtPreExecutionValidationResult {
  const nowMs = input.nowMs ?? Date.now();
  const validatedAt = new Date(nowMs).toISOString();
  const ttlMs = input.ttlMs ?? AT_BROKER_PRECHECK_DEFAULT_TTL_MS;
  const expiresAt = new Date(nowMs + Math.max(1_000, ttlMs)).toISOString();
  const validationId = String(input.validationId || "").trim() || newValidationId(nowMs);
  const limits = mergeLimits(input.riskLimits);
  const checks: AtPrecheckCheck[] = [];
  const warnings: string[] = [];

  const handoff = input.handoff;
  const proposal = input.proposal;
  const handoffId = handoff?.provenance?.handoffId
    ?? (typeof input.expectedHandoffId === "string" ? input.expectedHandoffId : null);
  const proposalId = proposal?.proposalId
    ?? handoff?.provenance?.proposalId
    ?? (typeof input.expectedProposalId === "string" ? input.expectedProposalId : null);

  // --- Control snapshot (never invent permissive values) ---
  const controlsMissing = input.controls == null;
  const foundationMissing = input.foundation == null;
  const controlSnapshot: AtPrecheckControlSnapshot = {
    emergencyEntryLock: controlsMissing ? null : input.controls!.emergencyEntryLock,
    masterEnable: controlsMissing ? null : input.controls!.masterEnable,
    automaticEntry: controlsMissing ? null : input.controls!.automaticEntry,
    positionManagement: controlsMissing ? null : (input.controls!.positionManagement ?? null),
    executionMasterEnabled: foundationMissing ? false : input.foundation!.executionMasterEnabled === true,
    armedForSubmission: foundationMissing ? false : input.foundation!.armedForSubmission === true,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    tradingDisabled: true,
    source: controlsMissing || foundationMissing ? "missing" : "authoritative_store",
  };

  // Phase 2 never implements submit — recorded as non-mandatory stamp (does not alone set allowed).
  checks.push(check(
    "phase2_submit",
    "permission",
    "FAIL",
    "PHASE2_SUBMIT_FORBIDDEN",
    "Phase 2 pre-execution validator does not implement order submission. executionAuthorized remains false.",
    false,
  ));
  warnings.push("PHASE2_SUBMIT_FORBIDDEN: validation never authorizes broker submission.");

  // --- Permissions / live safety controls ---
  if (controlsMissing) {
    checks.push(check(
      "controls_present",
      "permission",
      "FAIL",
      "CONTROLS_MISSING",
      "Authoritative trading controls are missing — fail closed.",
    ));
  } else {
    checks.push(check(
      "controls_present",
      "permission",
      "PASS",
      "CONTROLS_PRESENT",
      "Authoritative trading controls were supplied.",
    ));

    if (input.controls!.emergencyEntryLock == null) {
      checks.push(check(
        "emergency_lock",
        "permission",
        "FAIL",
        "CONTROLS_MISSING",
        "emergencyEntryLock is null/unknown — fail closed.",
      ));
    } else if (input.controls!.emergencyEntryLock === true) {
      checks.push(check(
        "emergency_lock",
        "permission",
        "FAIL",
        "EMERGENCY_LOCK",
        "Emergency entry lock is ON — pre-execution eligibility blocked.",
      ));
    } else {
      checks.push(check(
        "emergency_lock",
        "permission",
        "PASS",
        "EMERGENCY_LOCK_OFF",
        "Emergency entry lock is OFF.",
      ));
    }

    // Required safe state for Phase 2: trading master switches remain DISABLED.
    if (input.controls!.masterEnable == null) {
      checks.push(check(
        "master_enable",
        "permission",
        "FAIL",
        "CONTROLS_MISSING",
        "masterEnable is null/unknown — fail closed.",
      ));
    } else if (input.controls!.masterEnable === true) {
      checks.push(check(
        "master_enable",
        "permission",
        "FAIL",
        "MASTER_ENABLE_NOT_SAFE",
        "masterEnable is ON — Trading must remain DISABLED for Phase 2; fail closed.",
      ));
    } else {
      checks.push(check(
        "master_enable",
        "permission",
        "PASS",
        "MASTER_ENABLE_OFF",
        "masterEnable is OFF (Trading DISABLED).",
      ));
    }

    if (input.controls!.automaticEntry == null) {
      checks.push(check(
        "automatic_entry",
        "permission",
        "FAIL",
        "CONTROLS_MISSING",
        "automaticEntry is null/unknown — fail closed.",
      ));
    } else if (input.controls!.automaticEntry === true) {
      checks.push(check(
        "automatic_entry",
        "permission",
        "FAIL",
        "AUTOMATIC_ENTRY_NOT_SAFE",
        "automaticEntry is ON — must remain OFF for Phase 2; fail closed.",
      ));
    } else {
      checks.push(check(
        "automatic_entry",
        "permission",
        "PASS",
        "AUTOMATIC_ENTRY_OFF",
        "automaticEntry is OFF.",
      ));
    }
  }

  if (foundationMissing) {
    checks.push(check(
      "foundation_present",
      "permission",
      "FAIL",
      "FOUNDATION_MISSING",
      "Broker execution foundation snapshot missing — fail closed.",
    ));
  } else {
    const f = input.foundation!;
    if (f.placesOrders !== false || f.acceptsForExecution !== false || f.mutatesBroker !== false) {
      checks.push(check(
        "safety_stamps",
        "permission",
        "FAIL",
        "SAFETY_STAMP_VIOLATION",
        "Safety stamps must remain placesOrders=false, acceptsForExecution=false, mutatesBroker=false.",
      ));
    } else {
      checks.push(check(
        "safety_stamps",
        "permission",
        "PASS",
        "SAFETY_STAMPS_OK",
        "Safety stamps remain false.",
      ));
    }

    // Execution Master OFF is a hard block (and ON is also forbidden in Phase 2).
    if (f.executionMasterEnabled === true) {
      checks.push(check(
        "execution_master",
        "permission",
        "FAIL",
        "EXECUTION_MASTER_ON_FORBIDDEN_PHASE2",
        "Execution Master ON is forbidden in Phase 2 — submission not implemented.",
      ));
    } else {
      checks.push(check(
        "execution_master",
        "permission",
        "FAIL",
        "EXECUTION_MASTER_OFF",
        "Execution Master is OFF — hard execution block (Phase 2).",
      ));
      warnings.push(
        "EXECUTION_MASTER_OFF is an expected hard block until a later owner-approved phase.",
      );
    }

    if (f.armedForSubmission === true) {
      checks.push(check(
        "armed",
        "permission",
        "FAIL",
        "ARMED_FOR_SUBMISSION_FORBIDDEN",
        "armedForSubmission must remain false in Phase 2.",
      ));
    } else {
      checks.push(check(
        "armed",
        "permission",
        "PASS",
        "NOT_ARMED",
        "Submission arming is false.",
      ));
    }
  }

  if (input.environment === "LIVE") {
    checks.push(check(
      "environment",
      "permission",
      "FAIL",
      "LIVE_ENVIRONMENT_FORBIDDEN",
      "LIVE environment is forbidden for this module.",
    ));
  } else {
    checks.push(check(
      "environment",
      "permission",
      "PASS",
      "ENVIRONMENT_DEMO",
      "Environment is DEMO (or non-LIVE).",
    ));
  }

  // --- Handoff integrity ---
  if (!handoff) {
    checks.push(check(
      "handoff_exists",
      "handoff",
      "FAIL",
      "HANDOFF_MISSING",
      "Broker handoff record is missing.",
    ));
  } else {
    checks.push(check(
      "handoff_exists",
      "handoff",
      "PASS",
      "HANDOFF_PRESENT",
      `Handoff ${handoff.provenance.handoffId} present.`,
    ));

    if (handoff.lifecycle === "SUPERSEDED") {
      checks.push(check(
        "handoff_lifecycle",
        "handoff",
        "FAIL",
        "HANDOFF_SUPERSEDED",
        "Handoff has been superseded.",
      ));
    } else if (handoff.lifecycle === "EXPIRED") {
      checks.push(check(
        "handoff_lifecycle",
        "handoff",
        "FAIL",
        "HANDOFF_EXPIRED",
        "Handoff lifecycle is EXPIRED.",
      ));
    } else if (handoff.lifecycle !== "HANDOFF_READY") {
      checks.push(check(
        "handoff_lifecycle",
        "handoff",
        "FAIL",
        "HANDOFF_NOT_READY",
        `Handoff lifecycle is ${handoff.lifecycle}; HANDOFF_READY required.`,
      ));
    } else {
      checks.push(check(
        "handoff_lifecycle",
        "handoff",
        "PASS",
        "HANDOFF_READY",
        "Handoff lifecycle is HANDOFF_READY.",
      ));
      warnings.push("HANDOFF_READY is not execution permission.");
    }

    if (handoff.expiresAtUtc) {
      const exp = Date.parse(handoff.expiresAtUtc);
      if (Number.isFinite(exp) && nowMs > exp) {
        checks.push(check(
          "handoff_expiry",
          "handoff",
          "FAIL",
          "HANDOFF_EXPIRED",
          `Handoff expired at ${handoff.expiresAtUtc}.`,
        ));
      } else {
        checks.push(check(
          "handoff_expiry",
          "handoff",
          "PASS",
          "HANDOFF_NOT_EXPIRED",
          "Handoff expiry not reached.",
        ));
      }
    } else {
      checks.push(check(
        "handoff_expiry",
        "handoff",
        "PASS",
        "HANDOFF_NO_EXPIRY_FIELD",
        "Handoff has no expiresAtUtc — expiry not asserted from that field.",
        false,
      ));
    }

    if (input.expectedHandoffId && handoff.provenance.handoffId !== input.expectedHandoffId) {
      checks.push(check(
        "handoff_id_match",
        "handoff",
        "FAIL",
        "HANDOFF_PROPOSAL_MISMATCH",
        `Expected handoffId ${input.expectedHandoffId} but found ${handoff.provenance.handoffId}.`,
      ));
    }

    if (input.expectedProposalId) {
      if (handoff.provenance.proposalId !== input.expectedProposalId) {
        checks.push(check(
          "handoff_proposal_link",
          "handoff",
          "FAIL",
          "HANDOFF_PROPOSAL_MISMATCH",
          `Handoff proposalId ${handoff.provenance.proposalId} does not match expected ${input.expectedProposalId}.`,
        ));
      } else {
        checks.push(check(
          "handoff_proposal_link",
          "handoff",
          "PASS",
          "HANDOFF_PROPOSAL_LINKED",
          "Handoff belongs to the expected proposal.",
        ));
      }
    }
  }

  // --- Proposal revalidation ---
  if (!proposal) {
    checks.push(check(
      "proposal_exists",
      "proposal",
      "FAIL",
      "PROPOSAL_MISSING",
      "Order proposal record is missing.",
    ));
  } else {
    checks.push(check(
      "proposal_exists",
      "proposal",
      "PASS",
      "PROPOSAL_PRESENT",
      `Proposal ${proposal.proposalId} present.`,
    ));

    if (proposal.lifecycle === "SUPERSEDED") {
      checks.push(check(
        "proposal_lifecycle",
        "proposal",
        "FAIL",
        "PROPOSAL_SUPERSEDED",
        "Proposal has been superseded.",
      ));
    } else if (proposal.lifecycle === "EXPIRED") {
      checks.push(check(
        "proposal_lifecycle",
        "proposal",
        "FAIL",
        "PROPOSAL_EXPIRED",
        "Proposal lifecycle is EXPIRED.",
      ));
    } else if (proposal.lifecycle !== "PROPOSAL_READY") {
      checks.push(check(
        "proposal_lifecycle",
        "proposal",
        "FAIL",
        "PROPOSAL_NOT_READY",
        `Proposal lifecycle is ${proposal.lifecycle}; PROPOSAL_READY required.`,
      ));
    } else {
      checks.push(check(
        "proposal_lifecycle",
        "proposal",
        "PASS",
        "PROPOSAL_READY",
        "Proposal lifecycle is PROPOSAL_READY (proposal-only — not execution authorization).",
      ));
    }

    if (input.expectedProposalId && proposal.proposalId !== input.expectedProposalId) {
      checks.push(check(
        "proposal_id_match",
        "proposal",
        "FAIL",
        "PROPOSAL_MISMATCH",
        `Expected proposalId ${input.expectedProposalId} but found ${proposal.proposalId}.`,
      ));
    }

    if (handoff?.provenance?.proposalId && handoff.provenance.proposalId !== proposal.proposalId) {
      checks.push(check(
        "proposal_handoff_ids",
        "proposal",
        "FAIL",
        "PROPOSAL_MISMATCH",
        "Proposal id does not match handoff.provenance.proposalId.",
      ));
    }

    const hInstr = handoff?.instrument?.symbol ?? handoff?.provenance?.instrument ?? null;
    const pInstr = proposal.instrument;
    if (hInstr && pInstr && String(hInstr).toUpperCase() !== String(pInstr).toUpperCase()) {
      checks.push(check(
        "instrument_match",
        "proposal",
        "FAIL",
        "INSTRUMENT_MISMATCH",
        `Instrument mismatch: handoff=${hInstr} proposal=${pInstr}.`,
      ));
    } else if (hInstr || pInstr) {
      checks.push(check(
        "instrument_match",
        "proposal",
        "PASS",
        "INSTRUMENT_MATCH",
        "Instrument identifiers match (or only one side present).",
      ));
    }

    const hDir = handoff?.directionOrder?.canonicalDecision ?? null;
    const pDir = proposal.canonicalDecision ?? proposal.direction ?? null;
    if (
      (hDir === "BUY" || hDir === "SELL")
      && (pDir === "BUY" || pDir === "SELL")
      && hDir !== pDir
    ) {
      checks.push(check(
        "direction_match",
        "proposal",
        "FAIL",
        "DIRECTION_MISMATCH",
        `Direction mismatch: handoff=${hDir} proposal=${pDir}.`,
      ));
    } else if ((hDir === "BUY" || hDir === "SELL") && (pDir === "BUY" || pDir === "SELL")) {
      checks.push(check(
        "direction_match",
        "proposal",
        "PASS",
        "DIRECTION_MATCH",
        "Direction matches.",
      ));
    }

    const entry = proposal.pricePlan?.entryPrice ?? handoff?.directionOrder?.entryPrice ?? null;
    const stopLoss = proposal.pricePlan?.stopLoss ?? handoff?.directionOrder?.stopLoss ?? null;
    const takeProfit = proposal.pricePlan?.takeProfit ?? handoff?.directionOrder?.takeProfit ?? null;
    const direction = (pDir === "BUY" || pDir === "SELL")
      ? pDir
      : (hDir === "BUY" || hDir === "SELL" ? hDir : null);

    if (!finitePositive(entry)) {
      checks.push(check(
        "entry",
        "proposal",
        "FAIL",
        "INVALID_ENTRY",
        "Entry price missing or invalid.",
      ));
    } else {
      checks.push(check(
        "entry",
        "proposal",
        "PASS",
        "ENTRY_OK",
        `Entry ${entry} present.`,
      ));
    }

    const geometry = evaluateProtectiveGeometry({
      direction,
      entryPrice: entry,
      stopLoss,
      takeProfit,
      requireProtective: true,
      requireThreeR: true,
    });
    if (!finitePositive(stopLoss)) {
      checks.push(check(
        "stop_loss",
        "proposal",
        "FAIL",
        "INVALID_STOP_LOSS",
        "Stop loss missing or invalid.",
      ));
    } else if (geometry.rejections.some((r) => /STOP|GEOMETRY|DIRECTION|ENTRY/i.test(r.code))) {
      const geo = geometry.rejections.find((r) => /STOP|GEOMETRY/i.test(r.code));
      checks.push(check(
        "stop_loss",
        "proposal",
        "FAIL",
        geo?.code === "STOP_LOSS_REQUIRED" ? "INVALID_STOP_LOSS" : "INVALID_SL_GEOMETRY",
        geo?.message ?? "Stop-loss geometry failed.",
      ));
    } else {
      checks.push(check(
        "stop_loss",
        "proposal",
        "PASS",
        "STOP_LOSS_OK",
        "Stop loss present and geometry acceptable.",
      ));
    }

    if (!finitePositive(takeProfit)) {
      checks.push(check(
        "take_profit",
        "proposal",
        "FAIL",
        "INVALID_TAKE_PROFIT",
        "Take profit missing or invalid.",
      ));
    } else if (geometry.rejections.some((r) => /TAKE_PROFIT|REWARD|3R/i.test(r.code))) {
      const geo = geometry.rejections.find((r) => /TAKE_PROFIT|REWARD|3R/i.test(r.code));
      checks.push(check(
        "take_profit",
        "proposal",
        "FAIL",
        /REWARD|3R/i.test(String(geo?.code)) ? "REWARD_RISK_BELOW_3R" : "INVALID_TP_GEOMETRY",
        geo?.message ?? "Take-profit / reward-risk failed.",
      ));
    } else {
      checks.push(check(
        "take_profit",
        "proposal",
        "PASS",
        "TAKE_PROFIT_OK",
        "Take profit present; reward/risk geometry acceptable.",
      ));
    }

    // Stage 3 — TIF / GTD expiry consistency.
    const tif = String(
      proposal.brokerPrep?.timeInForce
      ?? handoff?.directionOrder?.timeInForce
      ?? "",
    ).trim().toUpperCase();
    if (tif === "GTD") {
      const exp = proposal.brokerPrep?.expiration
        ?? handoff?.directionOrder?.expiration
        ?? null;
      const expMs = exp ? Date.parse(String(exp)) : NaN;
      if (!Number.isFinite(expMs)) {
        checks.push(check(
          "tif_expiry",
          "proposal",
          "FAIL",
          "INVALID_GTD_EXPIRY",
          "GTD requires a valid expiration timestamp.",
        ));
      } else if (expMs <= nowMs) {
        checks.push(check(
          "tif_expiry",
          "proposal",
          "FAIL",
          "INVALID_GTD_EXPIRY",
          `GTD expiration ${exp} is in the past.`,
        ));
      } else {
        checks.push(check(
          "tif_expiry",
          "proposal",
          "PASS",
          "GTD_EXPIRY_OK",
          "GTD expiration is in the future.",
        ));
      }
    } else if (tif && tif !== "GTC" && tif !== "IOC" && tif !== "FOK") {
      checks.push(check(
        "tif_expiry",
        "proposal",
        "FAIL",
        "UNSUPPORTED_TIME_IN_FORCE",
        `Unsupported timeInForce=${tif}.`,
      ));
    }

    // Stage 3 — proposal version vs handoff snapshot consistency.
    if (
      handoff?.provenance?.updatedAtUtc
      && proposal.updatedAtUtc
    ) {
      const pMs = Date.parse(proposal.updatedAtUtc);
      const hMs = Date.parse(handoff.provenance.updatedAtUtc);
      if (Number.isFinite(pMs) && Number.isFinite(hMs) && pMs > hMs + 1_000) {
        checks.push(check(
          "proposal_snapshot",
          "proposal",
          "FAIL",
          "STALE_PROPOSAL_SNAPSHOT",
          "Proposal updatedAt is newer than handoff — re-validate handoff against current proposal version.",
        ));
      }
    }

    const qty = proposal.quantity?.normalizedQuantity
      ?? handoff?.directionOrder?.normalizedQuantity
      ?? null;
    if (!finitePositive(qty)) {
      checks.push(check(
        "quantity",
        "risk",
        "FAIL",
        "INVALID_QUANTITY",
        "Normalized quantity missing or invalid.",
      ));
    } else if (qty > OWNER_MAX_LOTS_PRECHECK + 1e-12) {
      checks.push(check(
        "quantity",
        "risk",
        "FAIL",
        "OWNER_MAX_QUANTITY_EXCEEDED",
        `Quantity ${qty} exceeds owner maximum ${OWNER_MAX_LOTS_PRECHECK} lots.`,
      ));
    } else if (qty > limits.maxLotsPerOrder + 1e-12) {
      checks.push(check(
        "quantity",
        "risk",
        "FAIL",
        "OWNER_MAX_QUANTITY_EXCEEDED",
        `Quantity ${qty} exceeds maxLotsPerOrder ${limits.maxLotsPerOrder}.`,
      ));
    } else {
      checks.push(check(
        "quantity",
        "risk",
        "PASS",
        "QUANTITY_WITHIN_OWNER_MAX",
        `Quantity ${qty} ≤ owner max ${OWNER_MAX_LOTS_PRECHECK}.`,
      ));
    }

    const contract = input.instrumentContract;
    if (!contract || contract.contractVerified === false) {
      checks.push(check(
        "qty_contract",
        "risk",
        "FAIL",
        "BROKER_QUANTITY_CONTRACT_FAILED",
        "Instrument contract missing or not verified — quantity contract fail-closed.",
      ));
    } else if (finitePositive(qty)) {
      const qtyContract = evaluateBrokerQuantityContract({
        requestedLots: qty,
        baseUnitSize: contract.baseUnitSize,
        minQuantity: contract.minQuantity,
        mmrPerLot: contract.mmrPerLot,
        maxLotsPerOrder: OWNER_MAX_LOTS_PRECHECK,
      });
      if (qtyContract.ownerMaxBelowBrokerMin) {
        checks.push(check(
          "qty_contract",
          "risk",
          "FAIL",
          "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY",
          "Broker minimum exceeds owner-approved 0.01 lots.",
        ));
      } else if (!qtyContract.amountConversion.ok || !qtyContract.requestedLotsSupported) {
        checks.push(check(
          "qty_contract",
          "risk",
          "FAIL",
          "BROKER_QUANTITY_CONTRACT_FAILED",
          qtyContract.summary || "Broker quantity contract failed.",
        ));
      } else {
        checks.push(check(
          "qty_contract",
          "risk",
          "PASS",
          "BROKER_QUANTITY_CONTRACT_OK",
          qtyContract.summary,
        ));
      }
    }

    const riskPolicy = proposal.capital?.riskPolicyVersion
      ?? handoff?.riskCapital?.riskPolicyVersion
      ?? null;
    if (!riskPolicy) {
      checks.push(check(
        "risk_policy",
        "risk",
        "FAIL",
        "RISK_CONFIG_MISSING",
        "Risk policy version missing on proposal/handoff.",
      ));
    } else {
      checks.push(check(
        "risk_policy",
        "risk",
        "PASS",
        "RISK_POLICY_PRESENT",
        `Risk policy ${riskPolicy} present.`,
      ));
    }

    const allocPct = proposal.capital?.strategyAllocationPercent;
    const orderAlloc = proposal.capital?.individualOrderAllocation
      ?? handoff?.riskCapital?.individualOrderAllocation
      ?? null;
    if (
      allocPct == null
      || !Number.isFinite(allocPct)
      || orderAlloc == null
      || !Number.isFinite(orderAlloc)
      || orderAlloc <= 0
    ) {
      checks.push(check(
        "capital_config",
        "account",
        "FAIL",
        "CAPITAL_NOT_CONFIGURED",
        "Strategy allocation % and individual order allocation must both be configured.",
      ));
    } else {
      checks.push(check(
        "capital_config",
        "account",
        "PASS",
        "CAPITAL_CONFIGURED",
        "Capital allocation configuration present on proposal.",
      ));
    }
  }

  // --- Account / margin ---
  const account = input.account;
  if (!account) {
    checks.push(check(
      "account_present",
      "account",
      "FAIL",
      "MISSING_ACCOUNT_DATA",
      "Account snapshot missing.",
    ));
  } else {
    if (account.isFresh === false) {
      checks.push(check(
        "account_fresh",
        "account",
        "FAIL",
        "STALE_ACCOUNT_DATA",
        "Account data marked stale.",
      ));
    } else if (account.fetchedAtMs != null && Number.isFinite(account.fetchedAtMs)) {
      const age = nowMs - account.fetchedAtMs;
      if (age > limits.accountMaxAgeMs) {
        checks.push(check(
          "account_fresh",
          "account",
          "FAIL",
          "STALE_ACCOUNT_DATA",
          `Account age ${age}ms exceeds ${limits.accountMaxAgeMs}ms.`,
        ));
      } else {
        checks.push(check(
          "account_fresh",
          "account",
          "PASS",
          "ACCOUNT_FRESH",
          "Account data within freshness window.",
        ));
      }
    } else if (account.isFresh === true) {
      checks.push(check(
        "account_fresh",
        "account",
        "PASS",
        "ACCOUNT_FRESH",
        "Account marked fresh by caller.",
      ));
    } else {
      checks.push(check(
        "account_fresh",
        "account",
        "FAIL",
        "STALE_ACCOUNT_DATA",
        "Account freshness unknown — fail closed.",
      ));
    }

    if (!finitePositive(account.equity)) {
      checks.push(check(
        "equity",
        "account",
        "FAIL",
        "INVALID_EQUITY",
        "Equity missing or invalid.",
      ));
    } else {
      checks.push(check(
        "equity",
        "account",
        "PASS",
        "EQUITY_OK",
        `Equity ${account.equity}.`,
      ));
    }

    if (account.balance != null && !finiteNonNeg(account.balance)) {
      checks.push(check(
        "balance",
        "account",
        "FAIL",
        "INVALID_BALANCE",
        "Balance is non-finite.",
      ));
    } else if (account.balance == null) {
      checks.push(check(
        "balance",
        "account",
        "FAIL",
        "MISSING_ACCOUNT_DATA",
        "Balance missing.",
      ));
    } else {
      checks.push(check(
        "balance",
        "account",
        "PASS",
        "BALANCE_OK",
        `Balance ${account.balance}.`,
      ));
    }

    if (account.usableMargin == null || !Number.isFinite(account.usableMargin)) {
      checks.push(check(
        "margin",
        "account",
        "FAIL",
        "MISSING_MARGIN_DATA",
        "Available margin missing.",
      ));
    } else {
      const lots = proposal?.quantity?.normalizedQuantity
        ?? handoff?.directionOrder?.normalizedQuantity
        ?? null;
      const attestation = attestProposedOrderMargin({
        usableMargin: account.usableMargin,
        proposalEstimatedMargin: proposal?.quantity?.estimatedMargin ?? null,
        handoffRequiredMargin: handoff?.riskCapital?.requiredMargin ?? null,
        mmrPerLot: input.instrumentContract?.mmrPerLot ?? null,
        lots,
        contractVerified: input.instrumentContract?.contractVerified === true,
        baseUnitSize: input.instrumentContract?.baseUnitSize ?? null,
      });
      if (attestation.status === "UNAVAILABLE") {
        checks.push(check(
          "margin",
          "account",
          "FAIL",
          "MISSING_MARGIN_DATA",
          attestation.reason ?? "Required margin unknown — cannot attest sufficiency.",
        ));
      } else if (attestation.status === "INVALID") {
        checks.push(check(
          "margin",
          "account",
          "FAIL",
          "MISSING_MARGIN_DATA",
          attestation.reason ?? "Required margin invalid.",
        ));
      } else if (attestation.status === "INSUFFICIENT") {
        checks.push(check(
          "margin",
          "account",
          "FAIL",
          "INSUFFICIENT_AVAILABLE_MARGIN",
          attestation.reason ?? "Usable margin below required.",
        ));
      } else {
        checks.push(check(
          "margin",
          "account",
          "PASS",
          "MARGIN_SUFFICIENT",
          attestation.reason ?? "Available margin covers attested requirement.",
        ));
      }
    }

    // Account identity consistency (proposal vs live snapshot).
    const acctRef = proposal?.brokerPrep?.accountReference ?? null;
    if (acctRef && account.accountIdMasked) {
      const refDigits = String(acctRef).replace(/\D/g, "").slice(-4);
      const liveDigits = String(account.accountIdMasked).replace(/\D/g, "").slice(-4);
      if (refDigits && liveDigits && refDigits !== liveDigits && acctRef !== account.accountIdMasked) {
        checks.push(check(
          "account_identity",
          "account",
          "FAIL",
          "ACCOUNT_IDENTITY_MISMATCH",
          "Proposal accountReference does not match live account identity.",
        ));
      } else {
        checks.push(check(
          "account_identity",
          "account",
          "PASS",
          "ACCOUNT_IDENTITY_OK",
          "Proposal account identity matches live snapshot.",
        ));
      }
    }
  }

  // --- Exposure / daily loss / drawdown / concurrent / duplicate ---
  const exposure = input.exposure;
  if (!exposure || exposure.exposureAuthoritative !== true) {
    checks.push(check(
      "exposure",
      "risk",
      "FAIL",
      "EXPOSURE_UNVERIFIED",
      "Existing exposure is not authoritative — fail closed.",
    ));
  } else {
    const qty = proposal?.quantity?.normalizedQuantity
      ?? handoff?.directionOrder?.normalizedQuantity
      ?? 0;
    if (exposure.openExposureLots == null || !Number.isFinite(exposure.openExposureLots)) {
      checks.push(check(
        "exposure",
        "risk",
        "FAIL",
        "EXPOSURE_UNVERIFIED",
        "Open exposure lots unavailable.",
      ));
    } else if (exposure.openExposureLots + (finitePositive(qty) ? qty : 0) > limits.maxTotalExposureLots + 1e-12) {
      checks.push(check(
        "exposure",
        "risk",
        "FAIL",
        "EXPOSURE_LIMIT_EXCEEDED",
        `Projected exposure exceeds max ${limits.maxTotalExposureLots} lots.`,
      ));
    } else {
      checks.push(check(
        "exposure",
        "risk",
        "PASS",
        "EXPOSURE_OK",
        "Projected exposure within limit.",
      ));
    }
  }

  if (!exposure || exposure.openPositionCount == null || !Number.isFinite(exposure.openPositionCount)) {
    checks.push(check(
      "concurrent",
      "risk",
      "FAIL",
      "CONCURRENT_POSITIONS_UNAVAILABLE",
      "Open position count unavailable — fail closed.",
    ));
  } else if (exposure.openPositionCount >= limits.maxOpenPositions) {
    checks.push(check(
      "concurrent",
      "risk",
      "FAIL",
      "MAX_OPEN_POSITIONS_EXCEEDED",
      `Open positions ${exposure.openPositionCount} ≥ max ${limits.maxOpenPositions}.`,
    ));
  } else {
    checks.push(check(
      "concurrent",
      "risk",
      "PASS",
      "CONCURRENT_OK",
      "Concurrent position count within limit.",
    ));
  }

  if (exposure?.duplicateTradeSuspected === true) {
    checks.push(check(
      "duplicate",
      "risk",
      "FAIL",
      "DUPLICATE_TRADE",
      "Duplicate trade suspected for this instrument/direction.",
    ));
  } else if (exposure?.duplicateTradeSuspected === false) {
    checks.push(check(
      "duplicate",
      "risk",
      "PASS",
      "DUPLICATE_CLEAR",
      "No duplicate trade suspected.",
    ));
  } else {
    checks.push(check(
      "duplicate",
      "risk",
      "FAIL",
      "DUPLICATE_TRADE",
      "Duplicate-trade status unknown — fail closed.",
    ));
  }

  if (limits.maxDailyLossAccount != null) {
    if (exposure?.dayRealizedPnlAccount == null || !Number.isFinite(exposure.dayRealizedPnlAccount)) {
      checks.push(check(
        "daily_loss",
        "risk",
        "FAIL",
        "DAILY_LOSS_UNAVAILABLE",
        "Day realized PnL unavailable — daily-loss gate fail-closed.",
      ));
    } else if (exposure.dayRealizedPnlAccount <= -limits.maxDailyLossAccount) {
      checks.push(check(
        "daily_loss",
        "risk",
        "FAIL",
        "MAX_DAILY_LOSS_EXCEEDED",
        `Day PnL ${exposure.dayRealizedPnlAccount} exceeded max daily loss ${limits.maxDailyLossAccount}.`,
      ));
    } else {
      checks.push(check(
        "daily_loss",
        "risk",
        "PASS",
        "DAILY_LOSS_OK",
        "Daily loss within configured limit.",
      ));
    }
  } else {
    checks.push(check(
      "daily_loss",
      "risk",
      "FAIL",
      "RISK_CONFIG_MISSING",
      "maxDailyLossAccount not configured — fail closed.",
    ));
  }

  if (limits.maxDrawdownFractionOfDayStartEquity != null) {
    const dayStart = exposure?.dayStartEquity;
    const equity = account?.equity;
    if (dayStart == null || !finitePositive(dayStart)) {
      checks.push(check(
        "drawdown",
        "risk",
        "FAIL",
        "DRAWDOWN_UNAVAILABLE",
        "Day-start equity unavailable — drawdown gate fail-closed.",
      ));
    } else if (!finitePositive(equity)) {
      checks.push(check(
        "drawdown",
        "risk",
        "FAIL",
        "DRAWDOWN_UNAVAILABLE",
        "Current equity unavailable for drawdown check.",
      ));
    } else if (equity < dayStart * (1 - limits.maxDrawdownFractionOfDayStartEquity)) {
      checks.push(check(
        "drawdown",
        "risk",
        "FAIL",
        "MAX_DRAWDOWN_EXCEEDED",
        "Equity drawdown from day-start exceeded configured fraction.",
      ));
    } else {
      checks.push(check(
        "drawdown",
        "risk",
        "PASS",
        "DRAWDOWN_OK",
        "Drawdown within configured limit.",
      ));
    }
  } else {
    checks.push(check(
      "drawdown",
      "risk",
      "FAIL",
      "RISK_CONFIG_MISSING",
      "maxDrawdownFractionOfDayStartEquity not configured — fail closed.",
    ));
  }

  // --- Market data / spread ---
  const market = input.market;
  if (!market) {
    checks.push(check(
      "market_present",
      "market",
      "FAIL",
      "STALE_MARKET_DATA",
      "Market snapshot missing.",
    ));
  } else {
    if (market.marketClosed === true || market.tradingEligible === false) {
      checks.push(check(
        "market_session",
        "market",
        "FAIL",
        "MARKET_UNAVAILABLE",
        "Market closed or trading ineligible.",
      ));
    } else if (market.tradingEligible == null && market.marketClosed == null) {
      checks.push(check(
        "market_session",
        "market",
        "FAIL",
        "MARKET_UNAVAILABLE",
        "Market availability unknown — fail closed.",
      ));
    } else {
      checks.push(check(
        "market_session",
        "market",
        "PASS",
        "MARKET_AVAILABLE",
        "Market appears available.",
      ));
    }

    if (market.quoteAgeMs == null || !Number.isFinite(market.quoteAgeMs)) {
      checks.push(check(
        "quote_fresh",
        "market",
        "FAIL",
        "STALE_MARKET_DATA",
        "Quote age unknown — fail closed.",
      ));
    } else if (market.quoteAgeMs > limits.quoteMaxAgeMs) {
      checks.push(check(
        "quote_fresh",
        "market",
        "FAIL",
        "STALE_MARKET_DATA",
        `Quote age ${market.quoteAgeMs}ms exceeds ${limits.quoteMaxAgeMs}ms.`,
      ));
    } else {
      checks.push(check(
        "quote_fresh",
        "market",
        "PASS",
        "QUOTE_FRESH",
        "Quote within freshness window.",
      ));
    }

    const ba = validateBidAsk(market.bid, market.ask);
    const spread = market.spread != null && Number.isFinite(market.spread)
      ? market.spread
      : ba.spread;
    if (!ba.ok || spread == null) {
      checks.push(check(
        "spread_data",
        "spread",
        "FAIL",
        "SPREAD_DATA_UNAVAILABLE",
        ba.reason ?? "Bid/ask/spread unavailable.",
      ));
    } else if (limits.maxSpreadAbsolute == null) {
      checks.push(check(
        "spread_limit",
        "spread",
        "FAIL",
        "SPREAD_LIMIT_NOT_CONFIGURED",
        `Spread ${spread} observed but maxSpreadAbsolute is not configured — fail closed (no invented limit).`,
      ));
      warnings.push("Spread limit is not configured in AT — do not invent thresholds.");
    } else if (spread > limits.maxSpreadAbsolute + 1e-12) {
      checks.push(check(
        "spread_limit",
        "spread",
        "FAIL",
        "EXCESSIVE_SPREAD",
        `Spread ${spread} exceeds configured max ${limits.maxSpreadAbsolute}.`,
      ));
    } else {
      checks.push(check(
        "spread_limit",
        "spread",
        "PASS",
        "SPREAD_OK",
        `Spread ${spread} ≤ max ${limits.maxSpreadAbsolute}.`,
      ));
    }

    // Stage 3 — mandatory slippage policy (entry vs executable market price).
    const entryForSlip = proposal?.pricePlan?.entryPrice
      ?? handoff?.directionOrder?.entryPrice
      ?? null;
    const dirForSlip = (proposal?.canonicalDecision === "BUY" || proposal?.canonicalDecision === "SELL")
      ? proposal.canonicalDecision
      : (handoff?.directionOrder?.canonicalDecision === "BUY"
        || handoff?.directionOrder?.canonicalDecision === "SELL"
        ? handoff.directionOrder.canonicalDecision
        : null);
    if (limits.maxSlippageAbsolute == null) {
      checks.push(check(
        "slippage_limit",
        "spread",
        "FAIL",
        "SLIPPAGE_LIMIT_NOT_CONFIGURED",
        "No authoritative maxSlippageAbsolute configured — fail closed (no invented limit).",
      ));
    } else {
      const exec = executableMarketPrice(dirForSlip, market.bid, market.ask);
      if (!exec.ok) {
        checks.push(check(
          "slippage_limit",
          "spread",
          "FAIL",
          "SLIPPAGE_DATA_UNAVAILABLE",
          exec.reason,
        ));
      } else {
        const measured = measureSlippageAbsolute(entryForSlip, exec.price);
        if (!measured.ok) {
          checks.push(check(
            "slippage_limit",
            "spread",
            "FAIL",
            "SLIPPAGE_DATA_UNAVAILABLE",
            measured.reason,
          ));
        } else if (measured.slippage > limits.maxSlippageAbsolute + 1e-12) {
          checks.push(check(
            "slippage_limit",
            "spread",
            "FAIL",
            "EXCESSIVE_SLIPPAGE",
            `Slippage ${measured.slippage} exceeds max ${limits.maxSlippageAbsolute} `
              + `(|entry−executable|; executable=${exec.price}).`,
          ));
        } else {
          checks.push(check(
            "slippage_limit",
            "spread",
            "PASS",
            "SLIPPAGE_OK",
            `Slippage ${measured.slippage} ≤ max ${limits.maxSlippageAbsolute}.`,
          ));
        }
      }
    }
  }

  // Aggregate
  const blockingReasons: AtPrecheckBlockingReason[] = [];
  let anyIncomplete = false;
  for (const c of checks) {
    if (!c.mandatory) continue;
    if (c.verdict === "FAIL") {
      blockingReasons.push({ code: c.code, message: c.message, checkId: c.id });
    } else if (c.verdict === "INCOMPLETE") {
      anyIncomplete = true;
      blockingReasons.push({ code: c.code, message: c.message, checkId: c.id });
    }
  }

  /**
   * `allowed` requires every mandatory check to PASS.
   * EXECUTION_MASTER_OFF remains a mandatory FAIL → allowed stays false while Master is OFF
   * (hard execution block). executionAuthorized is always false regardless.
   */
  const allowed = blockingReasons.length === 0 && !anyIncomplete;

  const status: AtPreExecutionValidationResult["status"] = allowed
    ? "PASSED"
    : anyIncomplete
      && blockingReasons.every((b) => checks.find((c) => c.id === b.checkId)?.verdict === "INCOMPLETE")
      ? "INCOMPLETE"
      : "BLOCKED";

  /** Domain failures exclude the permanent Execution Master OFF hard-block. */
  const hardDomainFail = blockingReasons.some((b) => b.code !== "EXECUTION_MASTER_OFF");
  const suggestedLifecycle: "AUTHORIZATION_REQUIRED" | "PRECHECK_BLOCKED" =
    hardDomainFail ? "PRECHECK_BLOCKED" : "AUTHORIZATION_REQUIRED";

  const byCat = (cat: AtPrecheckCheck["category"]) => checks.filter((c) => c.category === cat);

  return {
    schemaVersion: AT_BROKER_PRECHECK_RESULT_SCHEMA,
    phase: AT_BROKER_PRECHECK_PHASE,
    validationId,
    proposalId,
    handoffId,
    validatedAt,
    status: allowed ? "PASSED" : status === "PASSED" ? "BLOCKED" : status,
    allowed,
    blockingReasons,
    warnings,
    checks,
    riskChecks: byCat("risk").concat(byCat("spread")),
    accountChecks: byCat("account"),
    permissionChecks: byCat("permission"),
    marketDataChecks: byCat("market"),
    controlSnapshot,
    suggestedLifecycle,
    expiresAt,
    ownerMaxLots: OWNER_MAX_LOTS_PRECHECK,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    brokerExecution: "DISABLED",
    executionAuthorized: false,
    phase2SubmitImplemented: false,
    note:
      "Phase 2 pre-execution validation only. "
      + "allowed=true never means submission is authorized. "
      + "placesOrders=false, acceptsForExecution=false, mutatesBroker=false. "
      + `suggestedLifecycle=${suggestedLifecycle}.`,
  };
}
