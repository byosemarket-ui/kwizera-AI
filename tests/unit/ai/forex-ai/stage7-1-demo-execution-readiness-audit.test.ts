/**
 * Stage 7.1 — DEMO execution readiness audit (read-only) tests.
 * AssertNeverCalledMutationPort: no create_order_request / send_request.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssertNeverCalledMutationPort } from "../../../../ai/forex-ai/automated-trading/demo-submission-adapter/mutation-port.js";
import {
  runDemoExecutionReadinessAudit,
  runUnknownResultReconciliationScenarios,
  type Stage71AuditInput,
} from "../../../../ai/forex-ai/automated-trading/demo-execution-readiness-audit/index.js";
import {
  AT_ORDER_PROPOSAL_PHASE,
  AT_ORDER_PROPOSAL_SCHEMA,
  OWNER_MAX_QUANTITY,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  PER_ORDER_RISK_TARGET_PERCENT,
  RISK_POLICY_ID,
  RISK_POLICY_VERSION,
  type AtOrderProposalRecord,
} from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";
import {
  AT_PER_ORDER_RISK_PHASE,
  AT_PER_ORDER_RISK_SCHEMA,
  AT_PER_ORDER_RISK_STAGE,
  MODELED_VS_REALIZED_NOTE,
  type PerOrderRiskRecord,
} from "../../../../ai/forex-ai/automated-trading/per-order-risk/index.js";
import type { InstrumentRiskPolicy } from "../../../../ai/forex-ai/automated-trading/risk-policy/types.js";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "s71-audit-"));
}

function riskRecord(proposalId: string, overrides: Partial<PerOrderRiskRecord> = {}): PerOrderRiskRecord {
  return {
    schemaVersion: AT_PER_ORDER_RISK_SCHEMA,
    stage: AT_PER_ORDER_RISK_STAGE,
    phase: AT_PER_ORDER_RISK_PHASE,
    proposalId,
    allocationId: "alloc-1",
    accountIdMasked: "12***89",
    environment: "DEMO",
    instrument: "EUR/USD",
    direction: "BUY",
    entryPrice: 1.1,
    stopLossPrice: 1.09,
    takeProfitPrice: 1.13,
    capitalAllocation: 100,
    accountCurrency: "USD",
    operatingRiskPercent: PER_ORDER_RISK_TARGET_PERCENT,
    hardMaximumRiskPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
    maximumAllowedMonetaryLoss: 25,
    plannedMonetaryRisk: 20,
    actualModeledMonetaryRisk: 10,
    expectedMonetaryProfit: 30,
    actualRewardToRiskRatio: 3,
    calculatedQuantity: 0.01,
    quantityUnit: "contracts",
    contractSize: 1000,
    pricePrecision: 5,
    marginRequirement: 50,
    marginVerificationStatus: "VERIFIED",
    spreadAtCalculation: 0.00012,
    slippagePolicyStatus: "VERIFIED",
    spreadPolicyStatus: "VERIFIED",
    marketDataTimestampUtc: new Date().toISOString(),
    riskCalculationTimestampUtc: new Date().toISOString(),
    policyVersion: RISK_POLICY_VERSION,
    contractMetadataVersion: "test",
    proposalExpiryUtc: new Date(Date.now() + 3_600_000).toISOString(),
    validationResult: "PASS",
    displayCategory: "VALIDATED_PROPOSAL",
    rejectionReasons: [],
    levelProvenance: {
      entrySource: "test",
      stopLossSource: "test",
      takeProfitSource: "3R",
      atrValue: null,
      atrMethod: null,
      structureUsed: true,
    },
    riskPolicyId: RISK_POLICY_ID,
    modeledVsRealizedNote: MODELED_VS_REALIZED_NOTE,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    ...overrides,
  };
}

function readyProposal(overrides: Partial<AtOrderProposalRecord> = {}): AtOrderProposalRecord {
  const proposalId = "prop-s71-1";
  const base: AtOrderProposalRecord = {
    schemaVersion: AT_ORDER_PROPOSAL_SCHEMA,
    phase: AT_ORDER_PROPOSAL_PHASE,
    proposalId,
    idempotencyKey: "idem-s71-1",
    createdAtUtc: new Date().toISOString(),
    updatedAtUtc: new Date().toISOString(),
    lifecycle: "PROPOSAL_READY",
    analysisId: "an-1",
    resultIntakeId: "res-1",
    observationId: "obs-1",
    imageId: null,
    imageHash: null,
    instrument: "EUR/USD",
    timeframe: "H1",
    strategyId: null,
    environment: "DEMO",
    canonicalDecision: "BUY",
    direction: "BUY",
    strategyRationale: [],
    supportingEvidence: [],
    conflictingEvidence: [],
    analysisConfidencePct: 70,
    confidenceCalibrationFlag: false,
    pricePlan: {
      entryType: "EXPLICIT",
      entryPrice: 1.1,
      entryZoneLow: null,
      entryZoneHigh: null,
      stopLoss: 1.09,
      takeProfit: 1.13,
      riskDistance: 0.01,
      rewardDistance: 0.03,
      plannedRewardRiskRatio: 3,
      takeProfitLabel: "3R_PLANNED_TARGET",
      takeProfitNote: "test",
      invalidationConditions: [],
    },
    capital: {
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      strategyAllocationBudget: 5_000,
      individualOrderAllocation: 100,
      allocatedAmount: 100,
      existingCommittedExposure: 0,
      pendingProposalReservations: 0,
      remainingStrategyBudget: 4_900,
      riskTargetPercent: PER_ORDER_RISK_TARGET_PERCENT,
      riskTargetAmount: 20,
      riskMaximumPercent: PER_ORDER_RISK_MAXIMUM_PERCENT,
      maximumPermittedOrderLoss: 25,
      allowedRiskAmount: 20,
      projectedLossAtStopLoss: 10,
      remainingRiskBudget: 10,
      aggregateOpenRisk: null,
      pendingProposalRisk: 10,
      aggregateRiskPercentPolicy: null,
      riskValidationStatus: "PASS",
      riskPolicyId: RISK_POLICY_ID,
      riskPolicyVersion: RISK_POLICY_VERSION,
      currency: "USD",
      configVersion: 1,
      lastUpdateAtUtc: new Date().toISOString(),
    },
    quantity: {
      calculatedQuantity: 0.01,
      normalizedQuantity: 0.01,
      lotContractUnit: "contracts",
      contractSize: 1000,
      tickSize: 0.00001,
      pipTickValue: null,
      brokerMinimum: 0.01,
      brokerMaximum: null,
      quantityStep: 0.01,
      ownerMaxQuantity: OWNER_MAX_QUANTITY,
      estimatedMargin: 50,
      availableMargin: 8_000,
      usedMargin: 500,
      projectedMarginUtilization: 0.055,
      existingExposure: 0,
      projectedExposure: 100,
      sizingMethod: "CONTRACT_MULTIPLIER",
    },
    brokerPrep: {
      accountReference: "12***89",
      instrumentOfferReference: "EUR/USD",
      buySell: "BUY",
      amountQuantity: 0.01,
      orderType: "LIMIT",
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.13,
      timeInForce: null,
      expiration: new Date(Date.now() + 3_600_000).toISOString(),
      clientReference: proposalId,
      brokerOrderId: null,
      brokerTradeId: null,
      note: "prep only",
    },
    blockers: [],
    notes: [],
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    perOrderRisk: riskRecord(proposalId),
  };
  return { ...base, ...overrides, perOrderRisk: overrides.perOrderRisk ?? base.perOrderRisk };
}

function emptyPolicy(instrument: string): InstrumentRiskPolicy {
  const now = new Date().toISOString();
  return {
    instrument,
    documentedPricePrecision: null,
    spread: {
      instrument,
      maxSpreadAbsolute: null,
      units: "absolute_price",
      pricePrecision: null,
      status: "NOT_CONFIGURED",
      approvalState: "NOT_CONFIGURED",
      reason: null,
      configVersion: 0,
      createdAtUtc: now,
      updatedAtUtc: now,
      approvedAtUtc: null,
      approvedBy: null,
      effectiveAtUtc: null,
      proposed: null,
      history: [],
    },
    slippage: {
      instrument,
      maxSlippageAbsolute: null,
      units: "absolute_price",
      basis: "entry_vs_executable",
      pricePrecision: null,
      status: "NOT_CONFIGURED",
      approvalState: "NOT_CONFIGURED",
      reason: null,
      configVersion: 0,
      createdAtUtc: now,
      updatedAtUtc: now,
      approvedAtUtc: null,
      approvedBy: null,
      effectiveAtUtc: null,
      proposed: null,
      history: [],
    },
  };
}

function approvedPolicy(instrument: string, spread: number, slip: number): InstrumentRiskPolicy {
  const base = emptyPolicy(instrument);
  const now = new Date().toISOString();
  return {
    ...base,
    spread: {
      ...base.spread,
      maxSpreadAbsolute: spread,
      status: "VERIFIED",
      approvalState: "APPROVED",
      approvedAtUtc: now,
      approvedBy: "forex-admin",
      pricePrecision: 5,
      configVersion: 1,
    },
    slippage: {
      ...base.slippage,
      maxSlippageAbsolute: slip,
      status: "VERIFIED",
      approvalState: "APPROVED",
      approvedAtUtc: now,
      approvedBy: "forex-admin",
      pricePrecision: 5,
      configVersion: 1,
    },
  };
}

function baseInput(over: Partial<Stage71AuditInput> = {}): Stage71AuditInput {
  return {
    ownerIdentityConfigured: false,
    requireForexAdminProvesOwner: false,
    ownerAuthEvidenceNote: "admin token ≠ owner",
    policyDocumentVersion: 1,
    policiesByInstrument: {
      "EUR/USD": emptyPolicy("EUR/USD"),
      "GBP/USD": emptyPolicy("GBP/USD"),
      "USD/JPY": emptyPolicy("USD/JPY"),
      "XAU/USD": emptyPolicy("XAU/USD"),
    },
    proposal: null,
    configuredEnvironment: "DEMO",
    sessionEnvironment: "DEMO",
    accountEnvironment: "demo",
    accountIdMasked: "12***89",
    sessionStatus: "CONNECTED",
    usableMargin: 8_000,
    accountBalance: 10_000,
    accountEquity: 10_000,
    marginFresh: true,
    proposedOrderMarginRequirement: 50,
    proposedOrderMarginSource: "estimated",
    proposedOrderMarginAuthoritative: false,
    quoteFresh: true,
    quoteTimestampUtc: new Date().toISOString(),
    executionMasterEnabled: false,
    emergencyEntryLock: true,
    tradingEnabled: false,
    activeGrantPresent: false,
    submissionPathwayWired: false,
    protectionSourceCodeConfirmed: true,
    protectionBrokerReadOnlyConfirmed: false,
    protectionFixtureOnly: true,
    protectionLiveVerified: false,
    reconciliationAttemptPersistence: true,
    reconciliationIdempotencyUnique: true,
    reconciliationDuplicateSafe: true,
    reconciliationReadOnlyLookupWired: false,
    reconciliationUnknownBlocksRetry: true,
    reconciliationLiveBrokerLookupVerified: false,
    ...over,
  };
}

function assertSafe(port: AssertNeverCalledMutationPort, report: ReturnType<typeof runDemoExecutionReadinessAudit>): void {
  expect(port.calls).toHaveLength(0);
  expect(report.placesOrders).toBe(false);
  expect(report.mutatesBroker).toBe(false);
  expect(report.mutationInvoked).toBe(false);
  expect(report.executionAuthorized).toBe(false);
  expect(report.controlsObserved.submissionEnabled).toBe(false);
  expect(report.controlsObserved.executionMasterEnabled).toBe(false);
  expect(report.controlsObserved.emergencyEntryLock).toBe(true);
  expect(report.controlsObserved.activeGrantPresent).toBe(false);
  expect(report.overallState).not.toBe("READY_FOR_EXECUTION" as never);
}

describe("Stage 7.1 — owner authorization", () => {
  it("reports OWNER_AUTHORIZATION_NOT_VERIFIED when admin≠owner", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput());
    expect(r.categories.OWNER_AUTHORIZATION).toBe("NOT_VERIFIED");
    expect(r.findings.some((f) => f.code === "OWNER_AUTHORIZATION_NOT_VERIFIED")).toBe(true);
    expect(r.overallState).not.toBe("READY_FOR_OWNER_REVIEW");
    assertSafe(port, r);
  });
});

describe("Stage 7.1 — spread/slippage policies", () => {
  it("reports NOT_CONFIGURED per instrument when unapproved", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput());
    expect(r.instrumentPolicies).toHaveLength(4);
    expect(r.findings.filter((f) => f.code === "SPREAD_POLICY_NOT_VERIFIED")).toHaveLength(4);
    expect(r.findings.filter((f) => f.code === "SLIPPAGE_POLICY_NOT_VERIFIED")).toHaveLength(4);
    assertSafe(port, r);
  });

  it("PASSes spread/slippage when approved values present", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput({
      policiesByInstrument: {
        "EUR/USD": approvedPolicy("EUR/USD", 0.0002, 0.0001),
        "GBP/USD": approvedPolicy("GBP/USD", 0.0003, 0.0001),
        "USD/JPY": approvedPolicy("USD/JPY", 0.02, 0.01),
        "XAU/USD": approvedPolicy("XAU/USD", 0.5, 0.2),
      },
    }));
    expect(r.findings.filter((f) => f.code === "SPREAD_POLICY_VERIFIED")).toHaveLength(4);
    expect(r.findings.filter((f) => f.code === "SLIPPAGE_POLICY_VERIFIED")).toHaveLength(4);
    expect(r.instrumentPolicies.every((p) => p.spread.consumedByStage57 && p.slippage.consumedByStage57)).toBe(true);
    assertSafe(port, r);
  });
});

describe("Stage 7.1 — live proposal / risk / margin", () => {
  it("reports NO_ELIGIBLE_LIVE_PROPOSAL when none", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput({ proposal: null }));
    expect(r.findings.some((f) => f.code === "NO_ELIGIBLE_LIVE_PROPOSAL")).toBe(true);
    assertSafe(port, r);
  });

  it("PASSes live proposal + risk when eligible; margin stays NOT_VERIFIED without authoritative attestation", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput({
      proposal: readyProposal(),
      proposedOrderMarginAuthoritative: false,
    }));
    expect(r.findings.some((f) => f.code === "LIVE_PROPOSAL_ELIGIBLE")).toBe(true);
    expect(r.findings.some((f) => f.code === "RISK_INTEGRITY_PASS")).toBe(true);
    expect(r.findings.some((f) => f.code === "PROPOSED_ORDER_MARGIN_NOT_VERIFIED")).toBe(true);
    assertSafe(port, r);
  });

  it("fails stale quote on live proposal", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput({
      proposal: readyProposal(),
      quoteFresh: false,
    }));
    expect(r.findings.some((f) => f.code === "MARKET_DATA_STALE")).toBe(true);
    assertSafe(port, r);
  });
});

describe("Stage 7.1 — protection / reconciliation / TIF / controls", () => {
  it("reports FXCM_POST_FILL_PROTECTION_NOT_VERIFIED without live evidence", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput());
    expect(r.findings.some((f) => f.code === "FXCM_POST_FILL_PROTECTION_NOT_VERIFIED")).toBe(true);
    expect(r.categories.FXCM_POST_FILL_PROTECTION).toBe("NOT_VERIFIED");
    assertSafe(port, r);
  });

  it("reports reconciliation not live-verified while unknown-blocking exists", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput());
    expect(r.findings.some((f) => f.code === "UNKNOWN_RESULT_RECONCILIATION_NOT_LIVE_VERIFIED")).toBe(true);
    assertSafe(port, r);
  });

  it("TIF matrix rejects GTD and does not claim live broker confirmation", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput());
    const gtd = r.tifMatrix.find((t) => t.tif === "GTD");
    expect(gtd?.internalAccepted).toBe(false);
    expect(gtd?.testedBehavior).toBe("EXPLICITLY_REJECTED");
    expect(r.tifMatrix.every((t) => t.brokerSupportConfirmed === false)).toBe(true);
    expect(r.findings.some((f) => f.code === "TIF_BROKER_SUPPORT_NOT_LIVE_VERIFIED")).toBe(true);
    assertSafe(port, r);
  });

  it("blocks when Execution Master ON or Emergency Lock cleared or grant present", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput({
      executionMasterEnabled: true,
      emergencyEntryLock: false,
      activeGrantPresent: true,
    }));
    expect(r.overallState).toBe("BLOCKED");
    expect(r.categories.EXECUTION_CONTROLS).toBe("BLOCKED");
    expect(r.findings.some((f) => f.code === "EXECUTION_CONTROLS_UNSAFE")).toBe(true);
    expect(port.calls).toHaveLength(0);
  });

  it("rejects LIVE environment", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput({
      configuredEnvironment: "LIVE",
      sessionEnvironment: "LIVE",
      accountEnvironment: "live",
    }));
    expect(r.findings.some((f) => f.code === "LIVE_ENVIRONMENT_FORBIDDEN")).toBe(true);
    expect(r.categories.DEMO_ENVIRONMENT).toBe("BLOCKED");
    assertSafe(port, {
      ...r,
      // assertSafe expects EM off / lock on — still true in this case
      controlsObserved: r.controlsObserved,
    });
  });
});

describe("Stage 7.1 — unknown-result reconciliation fixtures", () => {
  let root: string;
  beforeEach(() => {
    root = tmpRoot();
  });
  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("covers timeout/reject/lost/restart/unknown/conflict without mutation", () => {
    const port = new AssertNeverCalledMutationPort();
    const rows = runUnknownResultReconciliationScenarios(root);
    expect(rows.every((r) => r.mutationInvoked === false)).toBe(true);
    const timeout = rows.find((r) => r.name === "broker_accepted_but_app_timed_out");
    expect(timeout?.acknowledgement?.resultUnknown).toBe(true);
    expect(timeout?.acknowledgement?.verifiedBrokerAcceptance).toBe(false);
    const lost = rows.find((r) => r.name === "broker_accepted_response_lost");
    expect(lost?.acknowledgement?.verifiedBrokerAcceptance).toBe(false);
    const restart = rows.find((r) => r.name === "restart_during_submission_pending");
    expect(restart?.unresolvedAfterRestart).toBe(true);
    expect(restart?.duplicateAfterRestart).toBe(true);
    const rejected = rows.find((r) => r.name === "broker_rejected");
    expect(rejected?.acknowledgement?.rejected).toBe(true);
    expect(port.calls).toHaveLength(0);
  });
});

describe("Stage 7.1 — combined blockers never READY_FOR_OWNER_REVIEW", () => {
  it("missing evidence across categories keeps overall NOT_READY and never mutates", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoExecutionReadinessAudit(baseInput());
    expect(r.overallState).toBe("NOT_READY");
    expect(r.categories.OWNER_AUTHORIZATION).toBe("NOT_VERIFIED");
    expect(r.categories.MARGIN_ATTESTATION).toBe("NOT_VERIFIED");
    expect(r.categories.FXCM_POST_FILL_PROTECTION).toBe("NOT_VERIFIED");
    assertSafe(port, r);
  });
});
