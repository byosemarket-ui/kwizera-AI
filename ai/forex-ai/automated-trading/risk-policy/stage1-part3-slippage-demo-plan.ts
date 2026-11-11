/**
 * Stage 1 Part 3 — Controlled DEMO slippage-evidence plan.
 *
 * KWIZERA AI STUDIO → FOREX → AUTOMATED TRADING → XAU/USD (active phase).
 * Read-only proposal artifact for owner review. Does NOT authorize, grant,
 * or submit any broker order.
 */
import { PER_ORDER_RISK_MAXIMUM_PERCENT, PER_ORDER_RISK_TARGET_PERCENT } from "../order-proposal/types.js";
import { STAGE3_ACTIVE_INSTRUMENTS } from "./types.js";

export const STAGE1_PART3_SLIPPAGE_DEMO_PLAN_ID =
  "stage1-part3-controlled-demo-slippage-evidence-xau-v1" as const;

export interface Stage1Part3SlippageDemoInstrumentPlan {
  instrument: "XAU/USD";
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
  fxcmOfferId: "4001";
  spreadPolicyPrerequisite: string;
}

export interface Stage1Part3SlippageDemoPlan {
  planId: typeof STAGE1_PART3_SLIPPAGE_DEMO_PLAN_ID;
  module: "KWIZERA_AI_STUDIO_FOREX_AUTOMATED_TRADING";
  activePhaseInstruments: readonly string[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  mayCallCreateOrderRequest: false;
  mayCallSendRequest: false;
  realDemoFillAuthorizedByThisPlan: false;
  requiresSeparateExplicitOwnerApproval: true;
  excludedInstruments: Array<{
    instrument: "EUR/USD" | "GBP/USD" | "USD/JPY";
    blocker: "PHASE_OUT_OF_SCOPE" | "MMR_PER_LOT_UNVERIFIED";
    note: string;
  }>;
  eligibleInstruments: Stage1Part3SlippageDemoInstrumentPlan[];
  orderType: "LIMIT";
  timeInForce: "GTC";
  fillCampaign: {
    minimumFillsPerInstrument: 20;
    singleOrderProducesAtMostOneFillEvidenceRecord: true;
    requiresSeparateOwnerAuthorizedCycles: true;
    limitGtcMayNeverFill: true;
    measurementFormula: {
      absoluteSlippage: string;
      buyAdverse: string;
      sellAdverse: string;
      units: "absolute_price";
      provenanceRequired: "BROKER_EXECUTION";
      syntheticFixturesForbiddenAsProductionEvidence: true;
    };
    abortConditions: string[];
    risksAndLimitations: string[];
    recommendedOwnerReviewPoints: string[];
  };
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
 * Build the XAU/USD-only controlled DEMO slippage proposal (documentation only).
 * Quantities sized so modeled loss ≤ 25% of the individual order allocation.
 *
 * XAU risk math (illustrative): pipCost≈$0.01/lot, 10-point SL → ≈$0.10 modeled loss at 1 lot.
 */
export function buildStage1Part3SlippageDemoPlan(input?: {
  /** Account usable margin (USD) when known — for documentation only. */
  usableMarginUsd?: number | null;
  /** Live broker-reported MMR when known — never invent. */
  xauMmrPerLot?: number | null;
}): Stage1Part3SlippageDemoPlan {
  const usable = input?.usableMarginUsd ?? null;
  const mmr = typeof input?.xauMmrPerLot === "number" && Number.isFinite(input.xauMmrPerLot) && input.xauMmrPerLot > 0
    ? input.xauMmrPerLot
    : 4.42;

  const xau: Stage1Part3SlippageDemoInstrumentPlan = {
    instrument: "XAU/USD",
    eligible: true,
    reasonEligible:
      "ACTIVE Automated Trading phase instrument. MMR broker-reported via trading_settings; "
      + "FXCM offerId 4001; amount=lots (baseUnitSize=1).",
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
    estimatedRequiredMarginUsd: mmr,
    mmrPerLotBrokerReported: mmr,
    fxcmOfferId: "4001",
    spreadPolicyPrerequisite:
      "XAU/USD per-trade economic feasibility must PASS (DYNAMIC_PER_TRADE). "
        + "Fixed maxSpreadAbsolute is optional emergency only — historical 0.30 is not required.",
  };

  return {
    planId: STAGE1_PART3_SLIPPAGE_DEMO_PLAN_ID,
    module: "KWIZERA_AI_STUDIO_FOREX_AUTOMATED_TRADING",
    activePhaseInstruments: [...STAGE3_ACTIVE_INSTRUMENTS],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    mayCallCreateOrderRequest: false,
    mayCallSendRequest: false,
    realDemoFillAuthorizedByThisPlan: false,
    requiresSeparateExplicitOwnerApproval: true,
    excludedInstruments: [
      {
        instrument: "EUR/USD",
        blocker: "PHASE_OUT_OF_SCOPE",
        note: "Preserved in catalog; OUT_OF_SCOPE for XAU-only Automated Trading phase.",
      },
      {
        instrument: "GBP/USD",
        blocker: "MMR_PER_LOT_UNVERIFIED",
        note: "OUT_OF_SCOPE this phase; MMR remains unverified (−1.0 on RO paths).",
      },
      {
        instrument: "USD/JPY",
        blocker: "MMR_PER_LOT_UNVERIFIED",
        note: "OUT_OF_SCOPE this phase; MMR remains unverified (−1.0 on RO paths).",
      },
    ],
    eligibleInstruments: [xau],
    orderType: "LIMIT",
    timeInForce: "GTC",
    fillCampaign: {
      minimumFillsPerInstrument: 20,
      singleOrderProducesAtMostOneFillEvidenceRecord: true,
      requiresSeparateOwnerAuthorizedCycles: true,
      limitGtcMayNeverFill: true,
      measurementFormula: {
        absoluteSlippage: "abs(executionPrice - referencePrice)",
        buyAdverse: "max(0, executionPrice - referencePrice)",
        sellAdverse: "max(0, referencePrice - executionPrice)",
        units: "absolute_price",
        provenanceRequired: "BROKER_EXECUTION",
        syntheticFixturesForbiddenAsProductionEvidence: true,
      },
      abortConditions: [
        "Unexpected broker mutation outside grant window",
        "Emergency lock engaged",
        "Execution Master unexpectedly ON without owner grant",
        "Usable margin or XAU MMR attestation fails at grant time",
        "Spread exceeds owner-approved XAU absolute limit at submission",
        "Partial fill without complete price/id fields",
        "Instrument identity ≠ XAU/USD (offerId 4001)",
      ],
      risksAndLimitations: [
        "DEMO fills are not LIVE economic outcomes; they measure venue behavior only.",
        "LIMIT/GTC may never fill — sample count can stall without owner strategy change.",
        "A 20-fill sample may still be non-representative across sessions/volatility regimes.",
        "This plan does not authorize orders, grants, or policy approvals.",
        "XAU/USD is the only eligible instrument in this Automated Trading phase.",
      ],
      recommendedOwnerReviewPoints: [
        "Confirm DYNAMIC_PER_TRADE economic feasibility is the primary XAU eligibility rule; "
          + "optional legacy ceiling may remain PENDING as historical record.",
        "Confirm whether MARKET/IOC near touch is allowed for fill evidence (separate owner decision).",
        "Budget ≥20 distinct owner-authorized fill cycles for XAU/USD if LIMIT/GTC is retained.",
        "Each cycle must capture referencePrice, executionPrice, timestamps, and broker IDs.",
        "Flatten or cancel between cycles; never leave unmanaged DEMO exposure overnight without owner intent.",
        "Do not expand the campaign to EUR/GBP/JPY during this phase.",
      ],
    },
    entryConditions: [
      "Market OPEN and LIVE ForexConnect DEMO session.",
      "Instrument identity XAU/USD (FXCM offerId 4001) verified.",
      "Quote fresh; per-trade economics PASS (spread cost absorbable within 25% budget + net ≥3R).",
      "Execution Master remains OFF until owner explicitly enables a Stage 7 controlled grant.",
      "Individual order allocation and 25% risk ceiling computed before request construction.",
    ],
    stopLossConditions: [
      "Explicit stop-loss attached at submission (broker-supported protection path).",
      "Stop distance must keep modeled loss ≤ 25% of this order's allocation at proposed lots.",
      "Never increase quantity to satisfy broker minimum beyond risk-affordable lots.",
      "Net reward/risk after verified spread friction must remain ≥ 3R.",
    ],
    spreadAndExecutionCostConditions: [
      "Pre-trade spread gate uses owner-approved XAU absolute_price limit only (VERIFIED).",
      "Dynamic Spread Intelligence remains ACCEPT/REJECT; legacy ceiling is optional emergency only.",
      "Slippage policy remains NOT_CONFIGURED until ≥20 genuine XAU BROKER_EXECUTION fills are validated.",
      "Do not treat quote spread observations as slippage evidence.",
    ],
    expectedFillEvidenceFields: [
      "instrument=XAU/USD",
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
      "Reconcile fill quantity vs proposed broker AMOUNT (baseUnitSize×lots).",
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
      "XAU/USD-only DEMO slippage campaign specification for Forex → Automated Trading. "
      + "It does not submit orders, create grants, or approve policies. "
      + "Slippage drafts require ≥20 BROKER_EXECUTION fills after a separate owner-approved test plan. "
      + "LIMIT/GTC alone is not a complete 20-fill acquisition strategy.",
  };
}
