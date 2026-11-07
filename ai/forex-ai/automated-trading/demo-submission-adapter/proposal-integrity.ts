/**
 * Stage 6 — Stage 5 proposal integrity for the DEMO adapter.
 * Server-side canonical proposal only — client fields are never authoritative.
 */
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import {
  DEMO_ADAPTER_MIN_REWARD_TO_RISK,
  DEMO_ADAPTER_OWNER_MAX_LOTS,
  DEMO_ADAPTER_RISK_MAX_PERCENT,
  DEMO_ADAPTER_RISK_TARGET_PERCENT,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

export interface ProposalIntegrityResult {
  ok: boolean;
  blockers: Array<{ code: string; message: string }>;
  proposalVersion: string | null;
  allocationId: string | null;
}

export function evaluateStage5ProposalIntegrity(input: {
  proposal: AtOrderProposalRecord | null | undefined;
  expectedProposalId?: string | null;
  expectedAccountIdMasked?: string | null;
  expectedHandoffId?: string | null;
  handoffProposalId?: string | null;
  nowMs?: number;
}): ProposalIntegrityResult {
  const blockers: Array<{ code: string; message: string }> = [];
  const p = input.proposal;
  if (!p) {
    return {
      ok: false,
      blockers: [{ code: "PROPOSAL_MISSING", message: "Canonical Stage 5 proposal not found in server store." }],
      proposalVersion: null,
      allocationId: null,
    };
  }

  const proposalVersion = `${p.schemaVersion}|${p.updatedAtUtc}|${p.lifecycle}`;
  const allocationId = p.perOrderRisk?.allocationId ?? null;

  if (input.expectedProposalId && input.expectedProposalId !== p.proposalId) {
    blockers.push({
      code: "PROPOSAL_ID_MISMATCH",
      message: "Requested proposal ID does not match canonical store record.",
    });
  }

  if (p.lifecycle === "EXPIRED") {
    blockers.push({ code: "PROPOSAL_EXPIRED", message: "Proposal lifecycle is EXPIRED." });
  }
  if (p.lifecycle === "SUPERSEDED") {
    blockers.push({ code: "PROPOSAL_SUPERSEDED", message: "Proposal was superseded." });
  }
  if (p.lifecycle !== "PROPOSAL_READY") {
    blockers.push({
      code: "PROPOSAL_NOT_READY",
      message: `Proposal lifecycle is ${p.lifecycle}; PROPOSAL_READY required.`,
    });
  }

  const exp = p.brokerPrep.expiration ? Date.parse(p.brokerPrep.expiration) : NaN;
  const now = input.nowMs ?? Date.now();
  if (Number.isFinite(exp) && now > exp) {
    blockers.push({ code: "PROPOSAL_EXPIRED", message: "Proposal/handoff expiry elapsed." });
  }

  if (p.direction !== "BUY" && p.direction !== "SELL") {
    blockers.push({ code: "INVALID_DIRECTION", message: "Proposal direction missing." });
  }
  if (!finitePositive(p.pricePlan.entryPrice)) {
    blockers.push({ code: "ENTRY_MISSING", message: "Entry price missing on proposal." });
  }
  if (!finitePositive(p.pricePlan.stopLoss)) {
    blockers.push({ code: "STOP_LOSS_MISSING", message: "Stop Loss missing on proposal." });
  }
  if (!finitePositive(p.pricePlan.takeProfit)) {
    blockers.push({ code: "TAKE_PROFIT_MISSING", message: "Take Profit missing on proposal." });
  }

  const qty = p.quantity.normalizedQuantity ?? p.quantity.calculatedQuantity;
  if (!finitePositive(qty)) {
    blockers.push({ code: "QUANTITY_MISSING", message: "Quantity missing on proposal." });
  } else if (qty > DEMO_ADAPTER_OWNER_MAX_LOTS + 1e-12) {
    blockers.push({
      code: "OWNER_MAX_LOT_EXCEEDED",
      message: `Quantity ${qty} exceeds owner max ${DEMO_ADAPTER_OWNER_MAX_LOTS}.`,
    });
  }

  const risk = p.perOrderRisk;
  if (!risk) {
    blockers.push({
      code: "RISK_RECORD_MISSING",
      message: "Stage 5 per-order risk record missing on proposal.",
    });
  } else {
    if (risk.validationResult !== "PASS") {
      blockers.push({
        code: "RISK_VALIDATION_FAILED",
        message: `Per-order risk validation is ${risk.validationResult}.`,
      });
    }
    if (risk.operatingRiskPercent !== DEMO_ADAPTER_RISK_TARGET_PERCENT) {
      blockers.push({
        code: "RISK_TARGET_POLICY_MISMATCH",
        message: `Operating risk ${risk.operatingRiskPercent} ≠ approved default ${DEMO_ADAPTER_RISK_TARGET_PERCENT}.`,
      });
    }
    if (risk.hardMaximumRiskPercent !== DEMO_ADAPTER_RISK_MAX_PERCENT) {
      blockers.push({
        code: "RISK_MAX_POLICY_MISMATCH",
        message: `Hard max ${risk.hardMaximumRiskPercent} ≠ approved ${DEMO_ADAPTER_RISK_MAX_PERCENT}.`,
      });
    }
    if (
      risk.actualModeledMonetaryRisk != null
      && risk.maximumAllowedMonetaryLoss != null
      && risk.actualModeledMonetaryRisk > risk.maximumAllowedMonetaryLoss + 1e-8
    ) {
      blockers.push({
        code: "ORDER_RISK_BUDGET_EXCEEDED",
        message: "Modeled monetary risk exceeds 25% hard maximum.",
      });
    }
    if (
      risk.actualRewardToRiskRatio == null
      || risk.actualRewardToRiskRatio + 1e-9 < DEMO_ADAPTER_MIN_REWARD_TO_RISK
    ) {
      blockers.push({
        code: "TAKE_PROFIT_BELOW_3R",
        message: "Monetary reward-to-risk below required 3R.",
      });
    }
    if (risk.marginVerificationStatus !== "VERIFIED") {
      blockers.push({
        code: "PROPOSED_ORDER_MARGIN_UNVERIFIED",
        message: `Margin verification status is ${risk.marginVerificationStatus ?? "null"}.`,
      });
    }
  }

  if (p.capital.riskValidationStatus !== "PASS") {
    blockers.push({
      code: "CAPITAL_RISK_FAIL",
      message: `Capital riskValidationStatus is ${p.capital.riskValidationStatus}.`,
    });
  }

  const accountRef = p.brokerPrep.accountReference;
  if (input.expectedAccountIdMasked && accountRef && input.expectedAccountIdMasked !== accountRef) {
    blockers.push({
      code: "ACCOUNT_IDENTITY_MISMATCH",
      message: "Proposal account reference does not match expected DEMO account.",
    });
  }

  if (input.expectedHandoffId && input.handoffProposalId && input.handoffProposalId !== p.proposalId) {
    blockers.push({
      code: "HANDOFF_MISMATCH",
      message: "Handoff proposal identity does not match canonical proposal.",
    });
  }

  if (p.placesOrders !== false || p.acceptsForExecution !== false || p.mutatesBroker !== false) {
    blockers.push({
      code: "SAFETY_STAMP_INVALID",
      message: "Proposal safety stamps must remain false.",
    });
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = blockers.filter((b) => {
    if (seen.has(b.code)) return false;
    seen.add(b.code);
    return true;
  });

  return {
    ok: unique.length === 0,
    blockers: unique,
    proposalVersion,
    allocationId,
  };
}
