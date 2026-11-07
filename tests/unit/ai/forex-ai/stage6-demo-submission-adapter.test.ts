/**
 * Stage 6 — FXCM DEMO submission adapter (non-submitting) tests.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AssertNeverCalledMutationPort,
  buildDryRunAcknowledgement,
  buildFxcmTrueMarketOpenPayload,
  DEMO_ADAPTER_OWNER_MAX_LOTS,
  DEMO_ADAPTER_SUBMISSION_MODE,
  evaluateAuthorizationRequirements,
  evaluateStage5ProposalIntegrity,
  parseBrokerAcknowledgementFixture,
  resetDemoSubmissionAdapterStoreForTests,
  resetDefaultMutationPortForTests,
  runDemoAdapterDryRun,
  verifyDemoEnvironment,
  type PerSubmissionAuthorizationGrant,
} from "../../../../ai/forex-ai/automated-trading/demo-submission-adapter/index.js";
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

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "s6-adapter-"));
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
  const proposalId = "prop-s6-1";
  const base: AtOrderProposalRecord = {
    schemaVersion: AT_ORDER_PROPOSAL_SCHEMA,
    phase: AT_ORDER_PROPOSAL_PHASE,
    proposalId,
    idempotencyKey: "idem-s6-1",
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

describe("Stage 6 — DEMO environment verification", () => {
  it("accepts positively verified DEMO", () => {
    const v = verifyDemoEnvironment({
      configuredEnvironment: "DEMO",
      sessionEnvironment: "DEMO",
      accountEnvironment: "demo",
      accountIdMasked: "12***89",
      expectedAccountIdMasked: "12***89",
      sessionStatus: "CONNECTED",
    });
    expect(v.ok).toBe(true);
    expect(v.positivelyVerifiedDemo).toBe(true);
  });

  it("rejects LIVE immediately", () => {
    const v = verifyDemoEnvironment({
      configuredEnvironment: "LIVE",
      sessionEnvironment: "LIVE",
      accountIdMasked: "12***89",
    });
    expect(v.ok).toBe(false);
    expect(v.code).toBe("LIVE_ENVIRONMENT_FORBIDDEN");
  });

  it("rejects unknown / missing DEMO proof", () => {
    const v = verifyDemoEnvironment({
      configuredEnvironment: "DEMO",
      sessionEnvironment: null,
      accountIdMasked: "12***89",
    });
    expect(v.ok).toBe(false);
    expect(v.code).toBe("DEMO_ENVIRONMENT_NOT_VERIFIED");
  });

  it("rejects account mismatch", () => {
    const v = verifyDemoEnvironment({
      configuredEnvironment: "DEMO",
      sessionEnvironment: "demo",
      accountIdMasked: "aa***11",
      expectedAccountIdMasked: "bb***22",
    });
    expect(v.ok).toBe(false);
    expect(v.code).toBe("ACCOUNT_IDENTITY_MISMATCH");
  });

  it("rejects missing account identity", () => {
    const v = verifyDemoEnvironment({
      configuredEnvironment: "DEMO",
      sessionEnvironment: "demo",
      accountIdMasked: null,
    });
    expect(v.ok).toBe(false);
    expect(v.code).toBe("ACCOUNT_IDENTITY_MISSING");
  });
});

describe("Stage 6 — proposal integrity", () => {
  it("accepts valid Stage 5 PROPOSAL_READY", () => {
    const r = evaluateStage5ProposalIntegrity({ proposal: readyProposal() });
    expect(r.ok).toBe(true);
  });

  it("rejects missing / expired / superseded / risk failures", () => {
    expect(evaluateStage5ProposalIntegrity({ proposal: null }).ok).toBe(false);
    expect(evaluateStage5ProposalIntegrity({
      proposal: readyProposal({ lifecycle: "EXPIRED" }),
    }).ok).toBe(false);
    expect(evaluateStage5ProposalIntegrity({
      proposal: readyProposal({ lifecycle: "SUPERSEDED" }),
    }).ok).toBe(false);
    const badRisk = readyProposal({
      perOrderRisk: riskRecord("prop-s6-1", {
        actualRewardToRiskRatio: 2,
        validationResult: "FAIL",
      }),
      capital: {
        ...readyProposal().capital,
        riskValidationStatus: "FAIL",
      },
    });
    const r = evaluateStage5ProposalIntegrity({ proposal: badRisk });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.code === "TAKE_PROFIT_BELOW_3R")).toBe(true);
  });

  it("rejects quantity above owner max and missing SL/TP", () => {
    const over = readyProposal({
      quantity: { ...readyProposal().quantity, normalizedQuantity: 0.02, calculatedQuantity: 0.02 },
    });
    expect(evaluateStage5ProposalIntegrity({ proposal: over }).blockers.some((b) =>
      b.code === "OWNER_MAX_LOT_EXCEEDED"
    )).toBe(true);

    const noSl = readyProposal({
      pricePlan: { ...readyProposal().pricePlan, stopLoss: null },
    });
    expect(evaluateStage5ProposalIntegrity({ proposal: noSl }).blockers.some((b) =>
      b.code === "STOP_LOSS_MISSING"
    )).toBe(true);
  });
});

describe("Stage 6 — authorization (fail-closed)", () => {
  const grant = (over: Partial<PerSubmissionAuthorizationGrant> = {}): PerSubmissionAuthorizationGrant => ({
    grantId: "g1",
    proposalId: "prop-s6-1",
    proposalVersion: "v1",
    accountIdMasked: "12***89",
    expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
    usedAtUtc: null,
    revokedAtUtc: null,
    activatesMutation: false,
    ...over,
  });

  it("never reports allSatisfied even with a fresh grant", () => {
    const r = evaluateAuthorizationRequirements({
      executionMasterEnabled: true,
      emergencyEntryLock: false,
      tradingEnabled: true,
      freshFinalPrecheckPass: true,
      demoEnvironmentVerified: true,
      perSubmissionGrant: grant(),
      proposalId: "prop-s6-1",
      proposalVersion: "v1",
      accountIdMasked: "12***89",
      priorSuccessfulSubmission: false,
    });
    expect(r.allSatisfied).toBe(false);
    expect(r.missing).toContain("STAGE_6_SUBMISSION_DISABLED");
  });

  it("fails Execution Master OFF / Emergency Lock / trading disabled / missing grant", () => {
    const off = evaluateAuthorizationRequirements({
      executionMasterEnabled: false,
      emergencyEntryLock: true,
      tradingEnabled: false,
      freshFinalPrecheckPass: false,
      demoEnvironmentVerified: false,
      perSubmissionGrant: null,
      proposalId: "prop-s6-1",
      proposalVersion: "v1",
      accountIdMasked: "12***89",
      priorSuccessfulSubmission: false,
    });
    expect(off.missing).toEqual(expect.arrayContaining([
      "EXECUTION_MASTER_OFF",
      "EMERGENCY_LOCK",
      "TRADING_DISABLED",
      "PER_SUBMISSION_AUTHORIZATION_MISSING",
    ]));
  });

  it("rejects expired / reused / wrong proposal / wrong account grants", () => {
    expect(evaluateAuthorizationRequirements({
      executionMasterEnabled: true,
      emergencyEntryLock: false,
      tradingEnabled: true,
      freshFinalPrecheckPass: true,
      demoEnvironmentVerified: true,
      perSubmissionGrant: grant({ expiresAtUtc: new Date(Date.now() - 1000).toISOString() }),
      proposalId: "prop-s6-1",
      proposalVersion: "v1",
      accountIdMasked: "12***89",
      priorSuccessfulSubmission: false,
    }).missing).toContain("AUTHORIZATION_EXPIRED");

    expect(evaluateAuthorizationRequirements({
      executionMasterEnabled: true,
      emergencyEntryLock: false,
      tradingEnabled: true,
      freshFinalPrecheckPass: true,
      demoEnvironmentVerified: true,
      perSubmissionGrant: grant({ usedAtUtc: new Date().toISOString() }),
      proposalId: "prop-s6-1",
      proposalVersion: "v1",
      accountIdMasked: "12***89",
      priorSuccessfulSubmission: false,
    }).missing).toContain("AUTHORIZATION_ALREADY_USED");

    expect(evaluateAuthorizationRequirements({
      executionMasterEnabled: true,
      emergencyEntryLock: false,
      tradingEnabled: true,
      freshFinalPrecheckPass: true,
      demoEnvironmentVerified: true,
      perSubmissionGrant: grant({ proposalId: "other" }),
      proposalId: "prop-s6-1",
      proposalVersion: "v1",
      accountIdMasked: "12***89",
      priorSuccessfulSubmission: false,
    }).missing).toContain("AUTHORIZATION_BOUND_TO_OTHER_PROPOSAL");

    expect(evaluateAuthorizationRequirements({
      executionMasterEnabled: true,
      emergencyEntryLock: false,
      tradingEnabled: true,
      freshFinalPrecheckPass: true,
      demoEnvironmentVerified: true,
      perSubmissionGrant: grant({ accountIdMasked: "zz***99" }),
      proposalId: "prop-s6-1",
      proposalVersion: "v1",
      accountIdMasked: "12***89",
      priorSuccessfulSubmission: false,
    }).missing).toContain("AUTHORIZATION_BOUND_TO_OTHER_ACCOUNT");
  });
});

describe("Stage 6 — FXCM payload construction", () => {
  it("maps BUY TRUE_MARKET_OPEN with RATE_STOP/RATE_LIMIT", () => {
    const r = buildFxcmTrueMarketOpenPayload({
      proposal: readyProposal(),
      accountId: "ACC123",
      baseUnitSize: 1000,
      bid: 1.0999,
      ask: 1.1001,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.orderTypeConstant).toBe("TRUE_MARKET_OPEN");
      expect(r.payload.buySell).toBe("BUY");
      expect(r.payload.amount).toBe(10); // 1000 * 0.01
      expect(r.payload.lots).toBe(DEMO_ADAPTER_OWNER_MAX_LOTS);
      expect(r.payload.rateStop).toBe(1.09);
      expect(r.payload.rateLimit).toBe(1.13);
      expect(r.payload.protectionIncomplete).toBe(false);
      expect(r.payload.timeInForce).toBe("IOC");
    }
  });

  it("maps SELL and rejects invalid geometry / owner max / unverified contract", () => {
    const sell = readyProposal({
      direction: "SELL",
      pricePlan: {
        ...readyProposal().pricePlan,
        stopLoss: 1.11,
        takeProfit: 1.07,
      },
    });
    const ok = buildFxcmTrueMarketOpenPayload({
      proposal: sell,
      accountId: "ACC123",
      baseUnitSize: 1000,
      bid: 1.1,
      ask: 1.1002,
    });
    expect(ok.ok).toBe(true);

    const badGeom = buildFxcmTrueMarketOpenPayload({
      proposal: readyProposal(),
      accountId: "ACC123",
      baseUnitSize: 1000,
      bid: 1.1,
      ask: 1.08, // ask below stop → invalid for BUY SL below ask check: stop 1.09 < ask 1.08? false
    });
    expect(badGeom.ok).toBe(false);

    const noContract = buildFxcmTrueMarketOpenPayload({
      proposal: readyProposal({
        quantity: { ...readyProposal().quantity, contractSize: null },
      }),
      accountId: "ACC123",
      baseUnitSize: null,
    });
    expect(noContract.ok).toBe(false);
    if (!noContract.ok) expect(noContract.code).toBe("CONTRACT_SIZE_UNVERIFIED");
  });
});

describe("Stage 6 — acknowledgement contract", () => {
  it("dry-run ack never verifies acceptance", () => {
    const a = buildDryRunAcknowledgement({
      executionAttemptId: "e1",
      proposalId: "p1",
      accountIdMasked: "12***89",
    });
    expect(a.verifiedBrokerAcceptance).toBe(false);
    expect(a.source).toBe("DRY_RUN");
  });

  it("HTTP ok without order ID is not acceptance", () => {
    const a = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e1",
      proposalId: "p1",
      accountIdMasked: "12***89",
      raw: { ok: true, httpOk: true },
    });
    expect(a.verifiedBrokerAcceptance).toBe(false);
    expect(a.resultUnknown).toBe(true);
  });

  it("timeout → result unknown; rejection fixture rejected", () => {
    const u = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e1",
      proposalId: "p1",
      accountIdMasked: "12***89",
      raw: { timeout: true, resultUnknown: true },
    });
    expect(u.resultUnknown).toBe(true);
    expect(u.verifiedBrokerAcceptance).toBe(false);

    const rej = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e1",
      proposalId: "p1",
      accountIdMasked: "12***89",
      raw: { rejected: true, rejectionReason: "NO" },
    });
    expect(rej.rejected).toBe(true);
    expect(rej.verifiedBrokerAcceptance).toBe(false);
  });

  it("BROKER_RESPONSE with order ID can verify acceptance (fixture path)", () => {
    const a = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e1",
      proposalId: "p1",
      accountIdMasked: "12***89",
      source: "BROKER_RESPONSE",
      raw: { ok: true, httpOk: true, brokerOrderId: "OID-1", tradeId: "TID-1", fillPrice: 1.1002 },
    });
    expect(a.verifiedBrokerAcceptance).toBe(true);
    expect(a.accepted).toBe(true);
    expect(a.brokerOrderId).toBe("OID-1");
  });
});

describe("Stage 6 — dry-run + idempotency + safety", () => {
  let root: string;

  beforeEach(() => {
    root = tmpRoot();
    resetDemoSubmissionAdapterStoreForTests(root);
    resetDefaultMutationPortForTests();
  });

  afterEach(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("dry-run constructs payload and never calls mutation port", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoAdapterDryRun({
      proposal: readyProposal(),
      configuredEnvironment: "DEMO",
      sessionEnvironment: "DEMO",
      accountEnvironment: "demo",
      accountIdMasked: "12***89",
      expectedAccountIdMasked: "12***89",
      sessionStatus: "CONNECTED",
      baseUnitSize: 1000,
      bid: 1.0999,
      ask: 1.1001,
      executionMasterEnabled: false,
      emergencyEntryLock: true,
      tradingEnabled: false,
      mutationPort: port,
      persist: true,
      storageRoot: root,
      idempotencyKey: "dry-1",
    });
    expect(port.calls).toHaveLength(0);
    expect(r.mutationInvoked).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.executionAuthorized).toBe(false);
    expect(r.attempt.submissionMode).toBe(DEMO_ADAPTER_SUBMISSION_MODE);
    expect(r.attempt.acknowledgement?.verifiedBrokerAcceptance).toBe(false);
    expect(r.fxcmPayloadAudit?.orderTypeConstant).toBe("TRUE_MARKET_OPEN");
    expect(r.attempt.blockers.some((b) => b.code === "STAGE_6_SUBMISSION_DISABLED")).toBe(true);
  });

  it("idempotent duplicate dry-run returns same attempt without mutation", () => {
    const port = new AssertNeverCalledMutationPort();
    const input = {
      proposal: readyProposal(),
      configuredEnvironment: "DEMO" as const,
      sessionEnvironment: "DEMO",
      accountEnvironment: "demo",
      accountIdMasked: "12***89",
      expectedAccountIdMasked: "12***89",
      sessionStatus: "CONNECTED",
      baseUnitSize: 1000,
      bid: 1.0999,
      ask: 1.1001,
      mutationPort: port,
      persist: true,
      storageRoot: root,
      idempotencyKey: "dry-dup",
    };
    const a = runDemoAdapterDryRun(input);
    const b = runDemoAdapterDryRun(input);
    expect(b.duplicate).toBe(true);
    expect(b.attempt.executionAttemptId).toBe(a.attempt.executionAttemptId);
    expect(port.calls).toHaveLength(0);
  });

  it("LIVE selection dry-run blocks without mutation", () => {
    const port = new AssertNeverCalledMutationPort();
    const r = runDemoAdapterDryRun({
      proposal: readyProposal(),
      configuredEnvironment: "LIVE",
      sessionEnvironment: "LIVE",
      accountIdMasked: "12***89",
      mutationPort: port,
      persist: false,
    });
    expect(r.attempt.blockers.some((b) => b.code === "LIVE_ENVIRONMENT_FORBIDDEN")).toBe(true);
    expect(port.calls).toHaveLength(0);
  });
});
