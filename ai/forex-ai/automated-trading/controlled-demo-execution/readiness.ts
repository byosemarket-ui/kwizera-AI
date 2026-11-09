/**
 * Stage 7 — Controlled execution readiness coordinator (25 gates).
 * Fail-closed. Never enables mutation.
 */
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import { verifyDemoEnvironment } from "../demo-submission-adapter/demo-environment.js";
import { evaluateStage5ProposalIntegrity } from "../demo-submission-adapter/proposal-integrity.js";
import { buildFxcmTrueMarketOpenPayload } from "../demo-submission-adapter/fxcm-payload.js";
import { evaluateTimeInForce } from "./tif.js";
import type { Stage7ExecutionGrant } from "./types.js";
import {
  AT_CONTROLLED_DEMO_PHASE,
  AT_CONTROLLED_DEMO_SCHEMA,
  AT_CONTROLLED_DEMO_STAGE,
  STAGE7_MIN_REWARD_TO_RISK,
  STAGE7_OWNER_MAX_LOTS,
  STAGE7_RISK_MAX_PERCENT,
  STAGE7_RISK_TARGET_PERCENT,
  STAGE7_SUPPORTED_TIF,
  type Stage7Blocker,
  type Stage7DisplayState,
  type Stage7ProposalSnapshot,
  type Stage7ReadinessReport,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function gate(
  name: string,
  pass: boolean,
  code: string | null,
  detail: string,
): { pass: boolean; code: string | null; detail: string } {
  return { pass, code: pass ? null : code, detail };
}

function push(
  blockers: Stage7Blocker[],
  code: string,
  message: string,
  category: Stage7Blocker["category"],
): void {
  if (!blockers.some((b) => b.code === code)) {
    blockers.push({ code, message, category });
  }
}

export interface Stage7ReadinessInput {
  proposal: AtOrderProposalRecord | null;
  expectedProposalId?: string | null;
  configuredEnvironment: "DEMO" | "LIVE";
  sessionEnvironment: string | null;
  accountEnvironment?: string | null;
  accountIdMasked: string | null;
  expectedAccountIdMasked?: string | null;
  sessionStatus?: string | null;
  connectionHealthy?: boolean | null;
  bid?: number | null;
  ask?: number | null;
  quoteFresh?: boolean | null;
  quoteAgeMs?: number | null;
  maxQuoteAgeMs?: number | null;
  baseUnitSize?: number | null;
  offerId?: string | null;
  spreadPolicyStatus?: string | null;
  slippagePolicyStatus?: string | null;
  usableMargin?: number | null;
  marginFresh?: boolean | null;
  executionMasterEnabled: boolean;
  emergencyEntryLock: boolean;
  tradingEnabled: boolean;
  /** Stage 7.2 — distinct owner capability must be configured server-side. */
  ownerIdentityConfigured?: boolean | null;
  activeGrant: Stage7ExecutionGrant | null;
  unresolvedAttemptExists: boolean;
  conflictingActiveExecution: boolean;
  requestedTimeInForce?: string | null;
  clientClaimedEnvironment?: string | null;
  nowMs?: number;
}

export function evaluateControlledDemoReadiness(
  input: Stage7ReadinessInput,
): Stage7ReadinessReport {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const blockers: Stage7Blocker[] = [];
  const gates: Stage7ReadinessReport["gates"] = {};

  // Always record Stage 7 mutation disable as safety (not a "technical" fail for review UI).
  const stage7MutationDisabled = true;

  // 1. Broker connection
  const connOk = input.connectionHealthy === true || input.sessionStatus === "CONNECTED";
  gates.brokerConnection = gate(
    "brokerConnection",
    connOk,
    "BROKER_CONNECTION_UNHEALTHY",
    connOk ? "Broker connection healthy/CONNECTED." : "Broker connection not healthy.",
  );
  if (!connOk) push(blockers, "BROKER_CONNECTION_UNHEALTHY", gates.brokerConnection.detail, "TECHNICAL");

  // 2–3. DEMO + account
  const env = verifyDemoEnvironment({
    configuredEnvironment: input.configuredEnvironment,
    sessionEnvironment: input.sessionEnvironment,
    accountEnvironment: input.accountEnvironment,
    accountIdMasked: input.accountIdMasked,
    expectedAccountIdMasked: input.expectedAccountIdMasked ?? input.accountIdMasked,
    sessionStatus: input.sessionStatus,
    clientClaimedEnvironment: input.clientClaimedEnvironment,
  });
  gates.demoEnvironment = gate(
    "demoEnvironment",
    env.positivelyVerifiedDemo,
    env.code,
    env.message,
  );
  if (!env.positivelyVerifiedDemo) {
    push(blockers, env.code, env.message, env.code.includes("LIVE") ? "SAFETY" : "TECHNICAL");
  }

  // 4–8. Proposal integrity (includes risk PASS, allocation, 20/25, 3R, 0.01, margin on risk record)
  const integrity = evaluateStage5ProposalIntegrity({
    proposal: input.proposal,
    expectedProposalId: input.expectedProposalId,
    expectedAccountIdMasked: input.expectedAccountIdMasked ?? input.accountIdMasked,
    nowMs,
  });
  gates.proposalIntegrity = gate(
    "proposalIntegrity",
    integrity.ok,
    integrity.blockers[0]?.code ?? "PROPOSAL_INVALID",
    integrity.ok ? "Stage 5 proposal integrity PASS." : integrity.blockers.map((b) => b.code).join(","),
  );
  for (const b of integrity.blockers) {
    push(blockers, b.code, b.message, "TECHNICAL");
  }

  const p = input.proposal;
  const risk = p?.perOrderRisk ?? null;

  // Per-order allocation identity
  const allocationIdOk = Boolean(risk?.allocationId && String(risk.allocationId).trim());
  gates.allocationIdentity = gate(
    "allocationIdentity",
    allocationIdOk,
    "ALLOCATION_IDENTITY_INVALID",
    allocationIdOk
      ? `Allocation identity ${risk!.allocationId} present.`
      : "Per-order allocation identity missing or empty.",
  );
  if (!allocationIdOk) {
    push(blockers, "ALLOCATION_IDENTITY_INVALID", gates.allocationIdentity.detail, "TECHNICAL");
  }

  // Explicit operating risk ≤ approved per-order target % of allocation (actual modeled)
  let operatingRiskOk = false;
  if (risk && finitePositive(risk.capitalAllocation) && risk.actualModeledMonetaryRisk != null) {
    const pct = (risk.actualModeledMonetaryRisk / risk.capitalAllocation) * 100;
    operatingRiskOk = pct <= STAGE7_RISK_TARGET_PERCENT + 1e-9;
    gates.operatingRiskPercent = gate(
      "operatingRiskPercent",
      operatingRiskOk,
      "OPERATING_RISK_ABOVE_20PCT",
      `Modeled risk ${pct.toFixed(4)}% of allocation (target ≤ ${STAGE7_RISK_TARGET_PERCENT}%).`,
    );
    if (!operatingRiskOk) {
      push(blockers, "OPERATING_RISK_ABOVE_20PCT", gates.operatingRiskPercent.detail, "TECHNICAL");
    }
  } else {
    gates.operatingRiskPercent = gate(
      "operatingRiskPercent",
      false,
      "OPERATING_RISK_UNVERIFIED",
      "Cannot verify operating risk percent.",
    );
    push(blockers, "OPERATING_RISK_UNVERIFIED", gates.operatingRiskPercent.detail, "TECHNICAL");
  }

  // Hard max 25%
  let hardMaxOk = false;
  if (risk && risk.actualModeledMonetaryRisk != null && risk.maximumAllowedMonetaryLoss != null) {
    hardMaxOk = risk.actualModeledMonetaryRisk <= risk.maximumAllowedMonetaryLoss + 1e-8;
    gates.hardMaxLoss = gate(
      "hardMaxLoss",
      hardMaxOk,
      "ORDER_RISK_BUDGET_EXCEEDED",
      hardMaxOk
        ? `Modeled loss within ${STAGE7_RISK_MAX_PERCENT}% hard max.`
        : "Modeled loss exceeds 25% hard maximum.",
    );
    if (!hardMaxOk) push(blockers, "ORDER_RISK_BUDGET_EXCEEDED", gates.hardMaxLoss.detail, "TECHNICAL");
  } else {
    gates.hardMaxLoss = gate("hardMaxLoss", false, "HARD_MAX_UNVERIFIED", "Hard max loss unverified.");
    push(blockers, "HARD_MAX_UNVERIFIED", gates.hardMaxLoss.detail, "TECHNICAL");
  }

  // 3R
  const rrOk = risk?.actualRewardToRiskRatio != null
    && risk.actualRewardToRiskRatio + 1e-9 >= STAGE7_MIN_REWARD_TO_RISK;
  gates.rewardToRisk = gate(
    "rewardToRisk",
    rrOk,
    "TAKE_PROFIT_BELOW_3R",
    rrOk ? `R:R ≥ ${STAGE7_MIN_REWARD_TO_RISK}.` : "Take Profit below 3R.",
  );
  if (!rrOk) push(blockers, "TAKE_PROFIT_BELOW_3R", gates.rewardToRisk.detail, "TECHNICAL");

  // Quantity / contract / owner max via payload builder
  let payloadOk = false;
  if (p && env.positivelyVerifiedDemo) {
    const acct = String(p.brokerPrep.accountReference || input.accountIdMasked || "").trim();
    const built = buildFxcmTrueMarketOpenPayload({
      proposal: p,
      accountId: acct,
      offerId: input.offerId,
      symbol: p.instrument,
      baseUnitSize: input.baseUnitSize ?? p.quantity.contractSize,
      bid: input.bid,
      ask: input.ask,
    });
    payloadOk = built.ok;
    gates.contractQuantity = gate(
      "contractQuantity",
      built.ok,
      built.ok ? null : built.code,
      built.ok
        ? `FXCM AMOUNT=${built.payload.amount} lots=${built.payload.lots} (owner max ${STAGE7_OWNER_MAX_LOTS}).`
        : built.message,
    );
    if (!built.ok) push(blockers, built.code, built.message, "TECHNICAL");
  } else {
    gates.contractQuantity = gate(
      "contractQuantity",
      false,
      "CONTRACT_QUANTITY_UNVERIFIED",
      "Cannot build FXCM payload without DEMO + proposal.",
    );
    push(blockers, "CONTRACT_QUANTITY_UNVERIFIED", gates.contractQuantity.detail, "TECHNICAL");
  }

  // Spread / slippage approved
  const spreadOk = input.spreadPolicyStatus === "VERIFIED";
  gates.spreadPolicy = gate(
    "spreadPolicy",
    spreadOk,
    "SPREAD_LIMIT_NOT_CONFIGURED",
    spreadOk ? "Spread policy VERIFIED." : `Spread policy status=${input.spreadPolicyStatus ?? "null"}.`,
  );
  if (!spreadOk) push(blockers, "SPREAD_LIMIT_NOT_CONFIGURED", gates.spreadPolicy.detail, "TECHNICAL");

  const slipOk = input.slippagePolicyStatus === "VERIFIED";
  gates.slippagePolicy = gate(
    "slippagePolicy",
    slipOk,
    "SLIPPAGE_LIMIT_NOT_CONFIGURED",
    slipOk ? "Slippage policy VERIFIED." : `Slippage policy status=${input.slippagePolicyStatus ?? "null"}.`,
  );
  if (!slipOk) push(blockers, "SLIPPAGE_LIMIT_NOT_CONFIGURED", gates.slippagePolicy.detail, "TECHNICAL");

  // Quote freshness + executable side
  const maxAge = input.maxQuoteAgeMs ?? 15_000;
  const quoteOk = input.quoteFresh === true
    && finitePositive(input.bid)
    && finitePositive(input.ask)
    && (input.quoteAgeMs == null || input.quoteAgeMs <= maxAge);
  gates.quoteFreshness = gate(
    "quoteFreshness",
    quoteOk,
    "MARKET_DATA_STALE",
    quoteOk ? "Quote fresh with valid bid/ask." : "Quote stale/missing or not executable-side valid.",
  );
  if (!quoteOk) push(blockers, "MARKET_DATA_STALE", gates.quoteFreshness.detail, "TECHNICAL");

  // Margin
  const marginVerified = risk?.marginVerificationStatus === "VERIFIED"
    && input.marginFresh !== false
    && finitePositive(input.usableMargin)
    && (risk.marginRequirement == null || input.usableMargin! + 1e-9 >= risk.marginRequirement);
  gates.margin = gate(
    "margin",
    marginVerified,
    "PROPOSED_ORDER_MARGIN_UNVERIFIED",
    marginVerified
      ? "Proposed-order margin verified; usable margin sufficient."
      : "Margin attestation missing/stale or usable margin insufficient.",
  );
  if (!marginVerified) {
    push(blockers, "PROPOSED_ORDER_MARGIN_UNVERIFIED", gates.margin.detail, "TECHNICAL");
  }

  // Protection can be verified after fill — requires both SL and TP on proposal (attached RATE_STOP/LIMIT)
  const protectionCapable = finitePositive(p?.pricePlan.stopLoss) && finitePositive(p?.pricePlan.takeProfit);
  gates.postFillProtectionCapable = gate(
    "postFillProtectionCapable",
    protectionCapable,
    "PROTECTION_NOT_ATTACHABLE",
    protectionCapable
      ? "SL and TP present for OM RATE_STOP/RATE_LIMIT attach + post-fill verify."
      : "Cannot verify post-fill protection without both Stop Loss and Take Profit.",
  );
  if (!protectionCapable) {
    push(blockers, "PROTECTION_NOT_ATTACHABLE", gates.postFillProtectionCapable.detail, "PROTECTION");
  }

  // TIF
  const tifEval = evaluateTimeInForce({ requested: input.requestedTimeInForce ?? "IOC" });
  gates.timeInForce = gate(
    "timeInForce",
    tifEval.ok,
    tifEval.ok ? null : tifEval.blockers[0]?.code ?? "UNSUPPORTED_TIF",
    tifEval.ok ? `TIF=${tifEval.tif} verified.` : tifEval.blockers.map((b) => b.message).join(" "),
  );
  if (!tifEval.ok) {
    for (const b of tifEval.blockers) push(blockers, b.code, b.message, b.category);
  }

  // Unresolved / duplicate attempts
  gates.noUnresolvedAttempt = gate(
    "noUnresolvedAttempt",
    !input.unresolvedAttemptExists,
    "UNRESOLVED_SUBMISSION_EXISTS",
    input.unresolvedAttemptExists
      ? "Unresolved submission attempt exists — blocked pending reconciliation."
      : "No unresolved submission attempt.",
  );
  if (input.unresolvedAttemptExists) {
    push(blockers, "UNRESOLVED_SUBMISSION_EXISTS", gates.noUnresolvedAttempt.detail, "SAFETY");
  }

  gates.noConflictingExecution = gate(
    "noConflictingExecution",
    !input.conflictingActiveExecution,
    "CONFLICTING_ACTIVE_EXECUTION",
    input.conflictingActiveExecution
      ? "Conflicting active execution exists."
      : "No conflicting active execution.",
  );
  if (input.conflictingActiveExecution) {
    push(blockers, "CONFLICTING_ACTIVE_EXECUTION", gates.noConflictingExecution.detail, "SAFETY");
  }

  // Stage 7.2 — owner capability configured (distinct from Forex Admin)
  const ownerConfigured = input.ownerIdentityConfigured === true;
  gates.ownerAuthorization = gate(
    "ownerAuthorization",
    ownerConfigured,
    "OWNER_AUTHORIZATION_NOT_CONFIGURED",
    ownerConfigured
      ? "Distinct system-owner capability is configured server-side."
      : "System-owner identity not configured or not distinct from Admin — Stage 7 readiness blocked.",
  );
  if (!ownerConfigured) {
    push(
      blockers,
      "OWNER_AUTHORIZATION_NOT_CONFIGURED",
      gates.ownerAuthorization.detail,
      "AUTHORIZATION",
    );
  }

  // Controls
  const emOk = input.executionMasterEnabled === true;
  gates.executionMaster = gate(
    "executionMaster",
    emOk,
    "EXECUTION_MASTER_OFF",
    emOk ? "Execution Master ON." : "Execution Master OFF.",
  );
  if (!emOk) push(blockers, "EXECUTION_MASTER_OFF", gates.executionMaster.detail, "CONTROL");

  const lockCleared = input.emergencyEntryLock === false;
  gates.emergencyLock = gate(
    "emergencyLock",
    lockCleared,
    "EMERGENCY_LOCK",
    lockCleared ? "Emergency Lock cleared." : "Emergency Lock ON.",
  );
  if (!lockCleared) push(blockers, "EMERGENCY_LOCK", gates.emergencyLock.detail, "CONTROL");

  const tradingOk = input.tradingEnabled === true;
  gates.tradingEnabled = gate(
    "tradingEnabled",
    tradingOk,
    "TRADING_DISABLED",
    tradingOk ? "Trading enabled." : "Trading disabled (masterEnable=false).",
  );
  if (!tradingOk) push(blockers, "TRADING_DISABLED", gates.tradingEnabled.detail, "CONTROL");

  // One-time grant
  const grant = input.activeGrant;
  let grantOk = false;
  if (!grant) {
    gates.oneTimeGrant = gate(
      "oneTimeGrant",
      false,
      "PER_SUBMISSION_AUTHORIZATION_MISSING",
      "No valid one-time execution grant.",
    );
    push(blockers, "PER_SUBMISSION_AUTHORIZATION_MISSING", gates.oneTimeGrant.detail, "AUTHORIZATION");
  } else {
    const grantBlockers: string[] = [];
    if (grant.activatesMutation !== false) grantBlockers.push("AUTHORIZATION_INVALID");
    if (p && grant.proposalId !== p.proposalId) grantBlockers.push("AUTHORIZATION_BOUND_TO_OTHER_PROPOSAL");
    if (integrity.proposalVersion && grant.proposalVersion !== integrity.proposalVersion) {
      grantBlockers.push("AUTHORIZATION_PROPOSAL_VERSION_MISMATCH");
    }
    if (!input.accountIdMasked || grant.accountIdMasked !== input.accountIdMasked) {
      grantBlockers.push("AUTHORIZATION_BOUND_TO_OTHER_ACCOUNT");
    }
    const exp = Date.parse(grant.expiresAtUtc);
    if (!Number.isFinite(exp) || nowMs > exp) grantBlockers.push("AUTHORIZATION_EXPIRED");
    if (grant.usedAtUtc) grantBlockers.push("AUTHORIZATION_ALREADY_USED");
    if (grant.revokedAtUtc) grantBlockers.push("AUTHORIZATION_REVOKED");
    grantOk = grantBlockers.length === 0;
    gates.oneTimeGrant = gate(
      "oneTimeGrant",
      grantOk,
      grantBlockers[0] ?? null,
      grantOk ? `Grant ${grant.grantId} valid.` : grantBlockers.join(","),
    );
    for (const c of grantBlockers) push(blockers, c, `Grant invalid: ${c}`, "AUTHORIZATION");
  }

  // Stage 7 hard disable of mutation (always present for audit; keeps allGatesPass false for submission)
  push(blockers, "STAGE_7_MUTATION_DISABLED", "Stage 7 keeps broker mutation DISABLED — no create_order_request/send_request.", "SAFETY");
  gates.stage7MutationDisabled = gate(
    "stage7MutationDisabled",
    false,
    "STAGE_7_MUTATION_DISABLED",
    "Mutation intentionally disabled for Stage 7 development/verification.",
  );

  const technicalCodes = new Set(
    blockers.filter((b) => b.category === "TECHNICAL" || b.category === "PROTECTION" || b.category === "SAFETY")
      .filter((b) => b.code !== "STAGE_7_MUTATION_DISABLED")
      .map((b) => b.code),
  );
  // Unresolved/conflict are SAFETY but block technical readiness for review
  const technicalPass = ![...technicalCodes].some((c) =>
    c !== "STAGE_7_MUTATION_DISABLED"
  ) && connOk && env.positivelyVerifiedDemo && integrity.ok && operatingRiskOk && hardMaxOk
    && rrOk && payloadOk && spreadOk && slipOk && quoteOk && marginVerified && protectionCapable
    && tifEval.ok && !input.unresolvedAttemptExists && !input.conflictingActiveExecution;

  // Recompute technicalPass more carefully from gates excluding controls/auth/stage7 disable
  const technicalGateNames = [
    "brokerConnection",
    "demoEnvironment",
    "proposalIntegrity",
    "allocationIdentity",
    "operatingRiskPercent",
    "hardMaxLoss",
    "rewardToRisk",
    "contractQuantity",
    "spreadPolicy",
    "slippagePolicy",
    "quoteFreshness",
    "margin",
    "postFillProtectionCapable",
    "timeInForce",
    "noUnresolvedAttempt",
    "noConflictingExecution",
  ];
  const technicalPassFinal = technicalGateNames.every((n) => gates[n]?.pass === true);
  const controlsPass = emOk && lockCleared && tradingOk;
  const authorizationPass = grantOk && ownerConfigured;
  // allGatesPass for actual submission would need mutation enabled — always false in Stage 7
  const allGatesPass = false;

  let displayState: Stage7DisplayState = "NOT_READY";
  if (technicalPassFinal && !controlsPass) {
    displayState = "READY_FOR_OWNER_REVIEW";
  } else if (technicalPassFinal && controlsPass && !authorizationPass) {
    displayState = "READY_FOR_OWNER_REVIEW";
  } else if (technicalPassFinal && controlsPass && authorizationPass) {
    // Owner authorized but Stage 7 still cannot submit
    displayState = "OWNER_AUTHORIZED";
  } else {
    displayState = "NOT_READY";
  }

  const snapshot: Stage7ProposalSnapshot | null = p
    ? {
      proposalId: p.proposalId,
      proposalVersion: integrity.proposalVersion ?? `${p.schemaVersion}|${p.updatedAtUtc}`,
      riskRecordId: risk ? `${p.proposalId}:${risk.allocationId}` : null,
      allocationId: risk?.allocationId ?? integrity.allocationId,
      accountIdMasked: p.brokerPrep.accountReference ?? input.accountIdMasked,
      instrument: p.instrument,
      direction: p.direction,
      quantity: p.quantity.normalizedQuantity ?? p.quantity.calculatedQuantity,
      entryPrice: p.pricePlan.entryPrice,
      stopLoss: p.pricePlan.stopLoss,
      takeProfit: p.pricePlan.takeProfit,
      timeInForce: tifEval.ok ? tifEval.tif : null,
      capitalAllocation: risk?.capitalAllocation ?? p.capital.allocatedAmount,
      operatingRiskPercent: risk?.operatingRiskPercent ?? null,
      modeledMonetaryRisk: risk?.actualModeledMonetaryRisk ?? null,
      rewardToRisk: risk?.actualRewardToRiskRatio ?? null,
    }
    : null;

  void stage7MutationDisabled;
  void technicalPass;

  return {
    schemaVersion: AT_CONTROLLED_DEMO_SCHEMA,
    stage: AT_CONTROLLED_DEMO_STAGE,
    phase: AT_CONTROLLED_DEMO_PHASE,
    evaluatedAtUtc: nowIso,
    displayState,
    technicalPass: technicalPassFinal,
    controlsPass,
    authorizationPass,
    allGatesPass,
    blockers,
    snapshot,
    gates,
    supportedTimeInForce: STAGE7_SUPPORTED_TIF,
    gtdSupported: false,
    submissionEnabled: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    note:
      "Stage 7 readiness coordinator. OWNER_AUTHORIZED does not enable broker mutation. "
      + "STAGE_7_MUTATION_DISABLED remains in force until a separate explicit owner submission authorization stage.",
  };
}
