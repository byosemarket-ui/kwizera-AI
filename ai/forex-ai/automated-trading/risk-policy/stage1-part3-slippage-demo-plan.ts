/**
 * Stage 1 Part 3 — Controlled DEMO slippage-evidence test proposal.
 *
 * Read-only proposal artifact for owner review. Does NOT authorize, grant,
 * or submit any broker order. GBP/USD and USD/JPY are excluded while MMR
 * remains unverified (Part 2).
 */
import { PER_ORDER_RISK_MAXIMUM_PERCENT, PER_ORDER_RISK_TARGET_PERCENT } from "../order-proposal/types.js";

export const STAGE1_PART3_SLIPPAGE_DEMO_PLAN_ID =
  "stage1-part3-controlled-demo-slippage-evidence-v1" as const;

export interface Stage1Part3SlippageDemoInstrumentPlan {
  instrument: "EUR/USD" | "XAU/USD";
  eligible: true;
  reasonEligible: string;
  /** Application lots (risk unit). */
  proposedLots: number;
  /** FXCM integer AMOUNT = baseUnitSize × lots. */
  proposedBrokerAmount: number;
  baseUnitSize: number;
  individualOrderAllocationUsd: number;
  riskTargetPercent: typeof PER_ORDER_RISK_TARGET_PERCENT;
  hardMaxPercent: typeof PER_ORDER_RISK_MAXIMUM_PERCENT;
  allowedRiskAmountUsd: number;
  /** Illustrative entry/SL distance used for sizing proof (owner may revise). */
  illustrativeStopDistancePoints: number;
  estimatedRiskPerLotUsd: number;
  estimatedModeledLossUsd: number;
  estimatedRequiredMarginUsd: number | null;
  mmrPerLotBrokerReported: number;
  spreadPolicyPrerequisite: string;
}

export interface Stage1Part3SlippageDemoPlan {
  planId: typeof STAGE1_PART3_SLIPPAGE_DEMO_PLAN_ID;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  mayCallCreateOrderRequest: false;
  mayCallSendRequest: false;
  realDemoFillAuthorizedByThisPlan: false;
  requiresSeparateExplicitOwnerApproval: true;
  excludedInstruments: Array<{
    instrument: "GBP/USD" | "USD/JPY";
    blocker: "MMR_PER_LOT_UNVERIFIED";
    note: string;
  }>;
  eligibleInstruments: Stage1Part3SlippageDemoInstrumentPlan[];
  orderType: "LIMIT";
  timeInForce: "GTC";
  entryConditions: string[];
  stopLossConditions: string[];
  spreadAndExecutionCostConditions: string[];
  expectedFillEvidenceFields: string[];
  postFillProtectionAndReconciliation: string[];
  cancellationCleanupProcedure: string[];
  failureAndEmergencyLockProcedure: string[];
  minimumFillsPerInstrumentForSlippageDraft: 20;
  note: string;
}

/**
 * Build the Part 3 controlled DEMO slippage proposal (documentation only).
 * Quantities sized so modeled loss ≤ 25% of the individual order allocation.
 */
export function buildStage1Part3SlippageDemoPlan(input?: {
  /** Account usable margin (USD) when known — for documentation only. */
  usableMarginUsd?: number | null;
}): Stage1Part3SlippageDemoPlan {
  const usable = input?.usableMarginUsd ?? null;

  // EUR/USD: 10-pip SL → ~$1/lot risk at pipCost 0.1; alloc $400 → $100 allowed → 100 lots / AMOUNT 100000.
  // Margin est 1.3×100 = $130 ≪ typical DEMO usable.
  const eur: Stage1Part3SlippageDemoInstrumentPlan = {
    instrument: "EUR/USD",
    eligible: true,
    reasonEligible: "Part 2 MMR broker-reported (trading_settings); quantity conversion verified.",
    proposedLots: 1,
    proposedBrokerAmount: 1000,
    baseUnitSize: 1000,
    individualOrderAllocationUsd: 40,
    riskTargetPercent: PER_ORDER_RISK_TARGET_PERCENT,
    hardMaxPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
    allowedRiskAmountUsd: 10, // 25% of 40
    illustrativeStopDistancePoints: 10,
    estimatedRiskPerLotUsd: 1,
    estimatedModeledLossUsd: 1, // 1 lot × $1
    estimatedRequiredMarginUsd: 1.3,
    mmrPerLotBrokerReported: 1.3,
    spreadPolicyPrerequisite: "Owner-approved EUR/USD maxSpreadAbsolute (draft 0.00014) must be VERIFIED first.",
  };

  // XAU/USD: base=1; use 1 contract. With 10-point SL risk≈$0.10/lot; alloc $40 → headroom.
  // Wider stops must be re-checked so 1 lot still ≤ 25% of allocation.
  const xau: Stage1Part3SlippageDemoInstrumentPlan = {
    instrument: "XAU/USD",
    eligible: true,
    reasonEligible: "Part 2 MMR broker-reported (trading_settings); XAU amount=lots (not ounces).",
    proposedLots: 1,
    proposedBrokerAmount: 1,
    baseUnitSize: 1,
    individualOrderAllocationUsd: 40,
    riskTargetPercent: PER_ORDER_RISK_TARGET_PERCENT,
    hardMaxPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
    allowedRiskAmountUsd: 10,
    illustrativeStopDistancePoints: 10,
    estimatedRiskPerLotUsd: 0.1,
    estimatedModeledLossUsd: 0.1,
    estimatedRequiredMarginUsd: 4.42,
    mmrPerLotBrokerReported: 4.42,
    spreadPolicyPrerequisite: "Owner-approved XAU/USD maxSpreadAbsolute (draft 0.30) must be VERIFIED first.",
  };

  return {
    planId: STAGE1_PART3_SLIPPAGE_DEMO_PLAN_ID,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    mayCallCreateOrderRequest: false,
    mayCallSendRequest: false,
    realDemoFillAuthorizedByThisPlan: false,
    requiresSeparateExplicitOwnerApproval: true,
    excludedInstruments: [
      {
        instrument: "GBP/USD",
        blocker: "MMR_PER_LOT_UNVERIFIED",
        note: "TradingSettings get_mmr returns non-positive; Offers MMR absent — keep blocked.",
      },
      {
        instrument: "USD/JPY",
        blocker: "MMR_PER_LOT_UNVERIFIED",
        note: "TradingSettings get_mmr returns non-positive; Offers MMR absent — keep blocked.",
      },
    ],
    eligibleInstruments: [eur, xau],
    orderType: "LIMIT",
    timeInForce: "GTC",
    entryConditions: [
      "Market OPEN and LIVE ForexConnect DEMO session.",
      "Quote fresh; absolute spread ≤ owner-approved instrument maxSpreadAbsolute.",
      "Execution Master remains OFF until owner explicitly enables a Stage 7 controlled grant.",
      "Individual order allocation and 25% risk ceiling computed before request construction.",
    ],
    stopLossConditions: [
      "Explicit stop-loss attached at submission (broker-supported protection path).",
      "Stop distance must keep modeled loss ≤ 25% of this order's allocation at proposed lots.",
      "Never increase quantity to satisfy broker minimum beyond risk-affordable lots.",
    ],
    spreadAndExecutionCostConditions: [
      "Pre-trade spread gate uses owner-approved absolute_price limit only (VERIFIED).",
      "Slippage policy remains NOT_CONFIGURED until ≥20 genuine fills are validated.",
      "Do not treat quote spread observations as slippage evidence.",
    ],
    expectedFillEvidenceFields: [
      "instrument",
      "direction BUY|SELL",
      "referencePrice (submission / intended)",
      "executionPrice (actual fill)",
      "fillTimestampUtc",
      "executionIdentifier / brokerOrderId / tradeId",
      "absoluteSlippage and adverseAbsolute via computeExecutionSlippage",
      "provenance=BROKER_EXECUTION",
    ],
    postFillProtectionAndReconciliation: [
      "Read-only verify SL/TP present and match authorized proposal.",
      "Reconcile fill quantity vs proposed broker AMOUNT.",
      "Persist validated SlippageFillEvidenceRecord only (never invent).",
      "Re-run Stage 1 readiness; do not auto-approve slippage limits.",
    ],
    cancellationCleanupProcedure: [
      "If unfilled: cancel working order via owner-authorized path only.",
      "If filled: owner decides hold vs flatten; no automatic close in Stage 1 Part 3.",
      "Revoke controlled DEMO grant; restore Execution Master OFF + emergency lock ON.",
    ],
    failureAndEmergencyLockProcedure: [
      "Any unexpected broker mutation → emergency entry lock ON immediately.",
      "Set placesOrders/acceptsForExecution remain false outside the grant window.",
      "Record failure in demo-control audit; do not retry without new owner approval.",
      usable == null
        ? "Usable margin must be verified fresh at grant time (currently undocumented in this static plan)."
        : `Documented usable margin snapshot for planning: $${usable} (must be re-verified live).`,
    ],
    minimumFillsPerInstrumentForSlippageDraft: 20,
    note:
      "This document prepares a future owner-reviewed controlled DEMO. "
      + "It does not submit orders, create grants, or approve policies. "
      + "Slippage drafts require ≥20 BROKER_EXECUTION fills per instrument after a separate owner-approved test plan.",
  };
}
