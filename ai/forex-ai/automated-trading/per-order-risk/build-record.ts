/**
 * Stage 5 — Build independent auditable per-order risk records from proposals.
 */
import { randomUUID } from "node:crypto";
import type { AtOrderProposalRecord } from "../order-proposal/types.js";
import {
  AT_PER_ORDER_RISK_PHASE,
  AT_PER_ORDER_RISK_SCHEMA,
  AT_PER_ORDER_RISK_STAGE,
  DEFAULT_PER_ORDER_RISK_PERCENT,
  MAX_PER_ORDER_LOSS_PERCENT,
  MODELED_VS_REALIZED_NOTE,
  RISK_POLICY_ID,
  RISK_POLICY_VERSION,
  type PerOrderRiskDisplayCategory,
  type PerOrderRiskLevelProvenance,
  type PerOrderRiskRecord,
  type PerOrderRiskRejection,
  type PerOrderRiskValidationResult,
} from "./types.js";

const WAITING_CODES = new Set([
  "WAITING_FOR_VALID_STOP_LOSS",
  "MISSING_ACCOUNT_EQUITY",
  "STALE_ACCOUNT_EQUITY",
  "MISSING_MARGIN_DATA",
  "STALE_MARGIN_DATA",
  "MISSING_INSTRUMENT_SPEC",
  "STALE_INSTRUMENT_SPEC",
  "MISSING_FX_CONVERSION",
  "STALE_FX_CONVERSION",
  "MARKET_DATA_STALE",
  "ACCOUNT_DATA_STALE",
  "ENTRY_UNAVAILABLE",
  "PROPOSE_ENTRY_QUOTE_STALE",
  "PROPOSE_ENTRY_QUOTE_MISSING",
  "PROPOSE_SL_SUPPORT_MISSING",
  "PROPOSE_SL_RESISTANCE_MISSING",
]);

const INVALID_RISK_CODES = new Set([
  "RISK_LIMIT_EXCEEDED",
  "RISK_TARGET_EXCEEDED",
  "ORDER_RISK_BUDGET_EXCEEDED",
  "TAKE_PROFIT_BELOW_3R",
  "INVALID_SL_GEOMETRY",
  "INVALID_STOP_LOSS",
  "STOP_LOSS_INVALID",
  "STOP_LOSS_MISSING",
  "OWNER_MAX_QUANTITY_EXCEEDED",
  "OWNER_MAX_LOT_EXCEEDED",
  "BROKER_MINIMUM_EXCEEDS_ALLOWED_QUANTITY",
  "CONTRACT_SIZE_UNVERIFIED",
  "POSITION_SIZE_UNVERIFIED",
  "MONETARY_3R_UNVERIFIED",
]);

const EXPIRED_CODES = new Set([
  "HANDOFF_EXPIRED",
  "PROPOSAL_EXPIRED",
]);

export function mapProposalBlockerToRejection(
  code: string,
  message: string,
  ctx: { instrument?: string | null; proposalId?: string | null } = {},
): PerOrderRiskRejection {
  const mapped = mapBlockCode(code);
  return {
    code: mapped,
    message,
    instrument: ctx.instrument ?? null,
    proposalId: ctx.proposalId ?? null,
  };
}

function mapBlockCode(code: string): string {
  switch (code) {
    case "PER_ORDER_ALLOCATION_MISSING":
    case "PER_ORDER_ALLOCATION_INVALID":
    case "ALLOCATION_BUDGET_EXCEEDED":
      return "ORDER_ALLOCATION_UNAVAILABLE";
    case "RISK_LIMIT_EXCEEDED":
    case "RISK_TARGET_EXCEEDED":
      return "ORDER_RISK_BUDGET_EXCEEDED";
    case "INVALID_STOP_LOSS":
      return "STOP_LOSS_MISSING";
    case "INVALID_SL_GEOMETRY":
      return "STOP_LOSS_INVALID";
    case "MISSING_INSTRUMENT_SPEC":
    case "STALE_INSTRUMENT_SPEC":
      return "CONTRACT_SIZE_UNVERIFIED";
    case "OWNER_MAX_QUANTITY_EXCEEDED":
      return "OWNER_MAX_LOT_EXCEEDED";
    case "SIZING_FAILED":
      return "POSITION_SIZE_UNVERIFIED";
    case "MISSING_MARGIN_DATA":
    case "STALE_MARGIN_DATA":
    case "INSUFFICIENT_AVAILABLE_MARGIN":
      return "PROPOSED_ORDER_MARGIN_UNVERIFIED";
    case "STALE_ACCOUNT_EQUITY":
    case "MISSING_ACCOUNT_EQUITY":
      return "ACCOUNT_DATA_STALE";
    case "HANDOFF_EXPIRED":
      return "PROPOSAL_EXPIRED";
    case "HANDOFF_MISSING":
      return "HANDOFF_NOT_READY";
    case "EMERGENCY_LOCK":
      return "EMERGENCY_LOCK";
    case "SYSTEM_MASTER_OFF":
    case "TRADING_DISABLED":
      return "EXECUTION_MASTER_OFF";
    default:
      return code;
  }
}

export function resolveDisplayCategory(
  proposal: AtOrderProposalRecord,
  extraCodes: string[] = [],
): PerOrderRiskDisplayCategory {
  const codes = [
    ...proposal.blockers.map((b) => String(b.code)),
    ...extraCodes,
  ];
  if (proposal.lifecycle === "EXPIRED" || codes.some((c) => EXPIRED_CODES.has(c))) {
    return "EXPIRED_PROPOSAL";
  }
  if (proposal.lifecycle === "PROPOSAL_READY" && codes.length === 0) {
    return "VALIDATED_PROPOSAL";
  }
  if (codes.some((c) => WAITING_CODES.has(c) || c === "WAITING_FOR_VALID_STOP_LOSS")) {
    return "WAITING_FOR_DATA";
  }
  if (
    codes.some((c) => INVALID_RISK_CODES.has(c))
    || proposal.capital.riskValidationStatus === "FAIL"
  ) {
    return "INVALID_RISK";
  }
  return "BLOCKED_PROPOSAL";
}

export function resolveValidationResult(
  proposal: AtOrderProposalRecord,
  monetary3rOk: boolean | null,
): PerOrderRiskValidationResult {
  if (proposal.lifecycle === "PROPOSAL_READY" && monetary3rOk !== false) {
    return "PASS";
  }
  const codes = proposal.blockers.map((b) => String(b.code));
  if (codes.some((c) => WAITING_CODES.has(c) || c === "WAITING_FOR_VALID_STOP_LOSS")) {
    return "WAITING";
  }
  if (proposal.blockers.length > 0 || monetary3rOk === false) {
    return "FAIL";
  }
  return "NOT_EVALUATED";
}

export function buildPerOrderRiskRecord(input: {
  proposal: AtOrderProposalRecord;
  allocationId?: string | null;
  accountIdMasked?: string | null;
  marketDataTimestampUtc?: string | null;
  spreadAtCalculation?: number | null;
  spreadPolicyStatus?: string | null;
  slippagePolicyStatus?: string | null;
  contractMetadataVersion?: string | null;
  expectedMonetaryProfit?: number | null;
  actualRewardToRiskRatio?: number | null;
  monetary3rOk?: boolean | null;
  levelProvenance?: Partial<PerOrderRiskLevelProvenance> | null;
  extraRejections?: PerOrderRiskRejection[];
  nowMs?: number;
}): PerOrderRiskRecord {
  const proposal = input.proposal;
  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  const allocationId = String(input.allocationId || "").trim() || randomUUID();
  const extra = input.extraRejections ?? [];
  const rejectionReasons: PerOrderRiskRejection[] = [
    ...proposal.blockers.map((b) => mapProposalBlockerToRejection(String(b.code), b.message, {
      instrument: proposal.instrument,
      proposalId: proposal.proposalId,
    })),
    ...extra,
  ];
  const displayCategory = resolveDisplayCategory(
    proposal,
    rejectionReasons.map((r) => String(r.code)),
  );
  const validationResult = resolveValidationResult(proposal, input.monetary3rOk ?? null);

  const marginStatus: PerOrderRiskRecord["marginVerificationStatus"] =
    proposal.quantity.estimatedMargin != null
    && Number.isFinite(proposal.quantity.estimatedMargin)
    && proposal.quantity.estimatedMargin >= 0
    && proposal.quantity.availableMargin != null
      ? "VERIFIED"
      : proposal.blockers.some((b) =>
        String(b.code).includes("MARGIN") || String(b.code) === "PROPOSED_ORDER_MARGIN_UNVERIFIED"
      )
        ? "MISSING"
        : "UNVERIFIED";

  return {
    schemaVersion: AT_PER_ORDER_RISK_SCHEMA,
    stage: AT_PER_ORDER_RISK_STAGE,
    phase: AT_PER_ORDER_RISK_PHASE,
    proposalId: proposal.proposalId,
    allocationId,
    accountIdMasked: input.accountIdMasked ?? proposal.brokerPrep.accountReference,
    environment: proposal.environment,
    instrument: proposal.instrument,
    direction: proposal.direction,
    entryPrice: proposal.pricePlan.entryPrice,
    stopLossPrice: proposal.pricePlan.stopLoss,
    takeProfitPrice: proposal.pricePlan.takeProfit,
    capitalAllocation: proposal.capital.riskBasis === "ACCOUNT_BALANCE"
      ? (proposal.capital.riskBaseAmount ?? null)
      : (proposal.capital.allocatedAmount ?? proposal.capital.individualOrderAllocation),
    accountCurrency: proposal.capital.accountCurrency,
    operatingRiskPercent: proposal.capital.riskTargetPercent ?? DEFAULT_PER_ORDER_RISK_PERCENT,
    hardMaximumRiskPercent: proposal.capital.riskMaximumPercent ?? MAX_PER_ORDER_LOSS_PERCENT,
    maximumAllowedMonetaryLoss: proposal.capital.maximumPermittedOrderLoss,
    plannedMonetaryRisk: proposal.capital.allowedRiskAmount ?? proposal.capital.riskTargetAmount,
    actualModeledMonetaryRisk: proposal.capital.projectedLossAtStopLoss,
    expectedMonetaryProfit: input.expectedMonetaryProfit ?? null,
    actualRewardToRiskRatio: input.actualRewardToRiskRatio
      ?? proposal.pricePlan.plannedRewardRiskRatio,
    calculatedQuantity: proposal.quantity.normalizedQuantity ?? proposal.quantity.calculatedQuantity,
    quantityUnit: proposal.quantity.lotContractUnit,
    contractSize: proposal.quantity.contractSize,
    pricePrecision: proposal.quantity.tickSize != null
      ? Math.max(0, Math.round(-Math.log10(proposal.quantity.tickSize)))
      : null,
    marginRequirement: proposal.quantity.estimatedMargin,
    marginVerificationStatus: marginStatus,
    spreadAtCalculation: input.spreadAtCalculation ?? null,
    slippagePolicyStatus: input.slippagePolicyStatus ?? null,
    spreadPolicyStatus: input.spreadPolicyStatus ?? null,
    marketDataTimestampUtc: input.marketDataTimestampUtc ?? null,
    riskCalculationTimestampUtc: nowIso,
    policyVersion: proposal.capital.riskPolicyVersion || RISK_POLICY_VERSION,
    contractMetadataVersion: input.contractMetadataVersion ?? null,
    proposalExpiryUtc: proposal.brokerPrep.expiration,
    validationResult,
    displayCategory,
    rejectionReasons,
    levelProvenance: {
      entrySource: input.levelProvenance?.entrySource ?? null,
      stopLossSource: input.levelProvenance?.stopLossSource ?? null,
      takeProfitSource: input.levelProvenance?.takeProfitSource ?? null,
      atrValue: input.levelProvenance?.atrValue ?? null,
      atrMethod: input.levelProvenance?.atrMethod ?? null,
      structureUsed: input.levelProvenance?.structureUsed === true,
    },
    riskPolicyId: proposal.capital.riskPolicyId || RISK_POLICY_ID,
    modeledVsRealizedNote: MODELED_VS_REALIZED_NOTE,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
  };
}
