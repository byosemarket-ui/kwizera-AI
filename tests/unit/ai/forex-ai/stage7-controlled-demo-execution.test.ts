/**
 * Stage 7 — Controlled DEMO execution readiness / grant / protection tests.
 * AssertNeverCalledMutationPort: no create_order_request / send_request / mutation.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AssertNeverCalledMutationPort } from "../../../../ai/forex-ai/automated-trading/demo-submission-adapter/mutation-port.js";
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
import {
  createStage7AttemptRecord,
  evaluateControlledDemoReadiness,
  evaluateTimeInForce,
  getControlledDemoExecutionStore,
  getControlledDemoPublicStatus,
  issueControlledDemoGrant,
  issueStage7Grant,
  resetControlledDemoExecutionStoreForTests,
  revokeStage7Grant,
  runControlledDemoReadiness,
  verifyPostFillProtection,
  type Stage7ExecutionGrant,
  type Stage7ProposalSnapshot,
  type Stage7ReadinessInput,
} from "../../../../ai/forex-ai/automated-trading/controlled-demo-execution/index.js";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "s7-ctrl-"));
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
  const proposalId = "prop-s7-1";
  const base: AtOrderProposalRecord = {
    schemaVersion: AT_ORDER_PROPOSAL_SCHEMA,
    phase: AT_ORDER_PROPOSAL_PHASE,
    proposalId,
    idempotencyKey: "idem-s7-1",
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

function technicalReadyInput(
  over: Partial<Stage7ReadinessInput> = {},
): Stage7ReadinessInput {
  return {
    proposal: readyProposal(),
    configuredEnvironment: "DEMO",
    sessionEnvironment: "DEMO",
    accountEnvironment: "demo",
    accountIdMasked: "12***89",
    expectedAccountIdMasked: "12***89",
    sessionStatus: "CONNECTED",
    connectionHealthy: true,
    bid: 1.0999,
    ask: 1.1001,
    quoteFresh: true,
    quoteAgeMs: 500,
    baseUnitSize: 1000,
    spreadPolicyStatus: "VERIFIED",
    slippagePolicyStatus: "VERIFIED",
    usableMargin: 8_000,
    marginFresh: true,
    // Stage 7 production posture for development: EM OFF, lock ON
    executionMasterEnabled: false,
    emergencyEntryLock: true,
    tradingEnabled: false,
    activeGrant: null,
    unresolvedAttemptExists: false,
    conflictingActiveExecution: false,
    requestedTimeInForce: "IOC",
    ...over,
  };
}

function assertNoMutation(port: AssertNeverCalledMutationPort): void {
  expect(port.calls).toHaveLength(0);
}

function snapshotFrom(report: ReturnType<typeof evaluateControlledDemoReadiness>): Stage7ProposalSnapshot {
  expect(report.snapshot).toBeTruthy();
  return report.snapshot!;
}

describe("Stage 7 — environment gates", () => {
  let port: AssertNeverCalledMutationPort;

  beforeEach(() => {
    port = new AssertNeverCalledMutationPort();
  });

  afterEach(() => {
    assertNoMutation(port);
  });

  it("verified DEMO passes environment gate (technical can pass with EM OFF)", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput());
    expect(r.gates.demoEnvironment.pass).toBe(true);
    expect(r.technicalPass).toBe(true);
    expect(r.displayState).toBe("READY_FOR_OWNER_REVIEW");
    expect(r.controlsPass).toBe(false);
    expect(r.allGatesPass).toBe(false);
    expect(r.submissionEnabled).toBe(false);
    expect(r.mutatesBroker).toBe(false);
    expect(r.blockers.some((b) => b.code === "STAGE_7_MUTATION_DISABLED")).toBe(true);
    expect(r.blockers.some((b) => b.code === "EXECUTION_MASTER_OFF")).toBe(true);
    expect(r.blockers.some((b) => b.code === "EMERGENCY_LOCK")).toBe(true);
    void port;
  });

  it("LIVE environment rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      configuredEnvironment: "LIVE",
      sessionEnvironment: "LIVE",
      accountEnvironment: "live",
    }));
    expect(r.gates.demoEnvironment.pass).toBe(false);
    expect(r.blockers.some((b) => b.code === "LIVE_ENVIRONMENT_FORBIDDEN")).toBe(true);
    expect(r.technicalPass).toBe(false);
    expect(r.displayState).toBe("NOT_READY");
    void port;
  });

  it("UNKNOWN / missing session DEMO rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      sessionEnvironment: null,
    }));
    expect(r.blockers.some((b) => b.code === "DEMO_ENVIRONMENT_NOT_VERIFIED")).toBe(true);
    void port;
  });

  it("conflicting environment signals rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      configuredEnvironment: "DEMO",
      sessionEnvironment: "DEMO",
      accountEnvironment: "live",
    }));
    expect(r.gates.demoEnvironment.pass).toBe(false);
    void port;
  });

  it("client-supplied DEMO label cannot override missing server evidence", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      sessionEnvironment: null,
      clientClaimedEnvironment: "DEMO",
    }));
    expect(r.gates.demoEnvironment.pass).toBe(false);
    expect(r.blockers.some((b) => b.code === "DEMO_ENVIRONMENT_NOT_VERIFIED")).toBe(true);
    void port;
  });
});

describe("Stage 7 — proposal and risk gates", () => {
  let port: AssertNeverCalledMutationPort;
  beforeEach(() => {
    port = new AssertNeverCalledMutationPort();
  });
  afterEach(() => assertNoMutation(port));

  it("expired proposal rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      proposal: readyProposal({ lifecycle: "EXPIRED" }),
    }));
    expect(r.technicalPass).toBe(false);
    expect(r.displayState).toBe("NOT_READY");
    void port;
  });

  it("wrong account rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      expectedAccountIdMasked: "zz***99",
    }));
    expect(r.gates.demoEnvironment.pass).toBe(false);
    expect(r.blockers.some((b) => b.code === "ACCOUNT_IDENTITY_MISMATCH")).toBe(true);
    void port;
  });

  it("invalid allocation identity rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      proposal: readyProposal({
        perOrderRisk: riskRecord("prop-s7-1", { allocationId: "" }),
      }),
    }));
    expect(r.blockers.some((b) => b.code === "ALLOCATION_IDENTITY_INVALID")).toBe(true);
    expect(r.technicalPass).toBe(false);
    void port;
  });

  it("operating risk above approved per-order target rejected", () => {
    // STAGE7_RISK_TARGET_PERCENT tracks PER_ORDER_RISK_TARGET_PERCENT (25%).
    // Reason code name retains OPERATING_RISK_ABOVE_20PCT for audit compatibility.
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      proposal: readyProposal({
        perOrderRisk: riskRecord("prop-s7-1", {
          actualModeledMonetaryRisk: 26,
          capitalAllocation: 100,
          validationResult: "PASS",
        }),
      }),
    }));
    expect(r.blockers.some((b) => b.code === "OPERATING_RISK_ABOVE_20PCT")).toBe(true);
    void port;
  });

  it("modeled loss above 25% hard max rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      proposal: readyProposal({
        perOrderRisk: riskRecord("prop-s7-1", {
          actualModeledMonetaryRisk: 26,
          maximumAllowedMonetaryLoss: 25,
          capitalAllocation: 100,
          operatingRiskPercent: 26,
        }),
      }),
    }));
    expect(r.blockers.some((b) =>
      b.code === "ORDER_RISK_BUDGET_EXCEEDED" || b.code === "OPERATING_RISK_ABOVE_20PCT"
    )).toBe(true);
    void port;
  });

  it("Take Profit below 3R rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      proposal: readyProposal({
        perOrderRisk: riskRecord("prop-s7-1", {
          actualRewardToRiskRatio: 2.5,
          expectedMonetaryProfit: 25,
          validationResult: "FAIL",
        }),
        capital: {
          ...readyProposal().capital,
          riskValidationStatus: "FAIL",
        },
      }),
    }));
    expect(r.blockers.some((b) => b.code === "TAKE_PROFIT_BELOW_3R")).toBe(true);
    void port;
  });

  it("quantity above 0.01 lots rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      proposal: readyProposal({
        quantity: {
          ...readyProposal().quantity,
          normalizedQuantity: 0.02,
          calculatedQuantity: 0.02,
        },
      }),
    }));
    expect(r.blockers.some((b) => b.code === "OWNER_MAX_LOT_EXCEEDED")).toBe(true);
    void port;
  });

  it("invalid contract size rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      baseUnitSize: null,
      proposal: readyProposal({
        quantity: { ...readyProposal().quantity, contractSize: null },
      }),
    }));
    expect(r.blockers.some((b) => b.code === "CONTRACT_SIZE_UNVERIFIED")).toBe(true);
    void port;
  });

  it("missing margin attestation rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      proposal: readyProposal({
        perOrderRisk: riskRecord("prop-s7-1", { marginVerificationStatus: "UNVERIFIED" }),
      }),
    }));
    expect(r.blockers.some((b) => b.code === "PROPOSED_ORDER_MARGIN_UNVERIFIED")).toBe(true);
    void port;
  });

  it("unapproved spread/slippage rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      spreadPolicyStatus: "PENDING",
      slippagePolicyStatus: "PENDING",
    }));
    expect(r.blockers.some((b) => b.code === "SPREAD_LIMIT_NOT_CONFIGURED")).toBe(true);
    expect(r.blockers.some((b) => b.code === "SLIPPAGE_LIMIT_NOT_CONFIGURED")).toBe(true);
    void port;
  });

  it("stale quote rejected", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput({
      quoteFresh: false,
      quoteAgeMs: 60_000,
    }));
    expect(r.blockers.some((b) => b.code === "MARKET_DATA_STALE")).toBe(true);
    void port;
  });
});

describe("Stage 7 — authorization / grant", () => {
  let root: string;
  let port: AssertNeverCalledMutationPort;

  beforeEach(() => {
    root = tmpRoot();
    resetControlledDemoExecutionStoreForTests(root);
    port = new AssertNeverCalledMutationPort();
  });

  afterEach(() => {
    assertNoMutation(port);
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("missing owner authorization rejected on readiness", () => {
    const r = evaluateControlledDemoReadiness(technicalReadyInput());
    expect(r.authorizationPass).toBe(false);
    expect(r.blockers.some((b) => b.code === "PER_SUBMISSION_AUTHORIZATION_MISSING")).toBe(true);
  });

  it("confirm=false rejected; exact echo required for issue", () => {
    const readiness = evaluateControlledDemoReadiness(technicalReadyInput());
    expect(readiness.technicalPass).toBe(true);
    const denied = issueControlledDemoGrant({
      readiness,
      actor: "forex-admin",
      confirm: false,
      confirmed: {
        proposalId: readiness.snapshot!.proposalId,
        proposalVersion: readiness.snapshot!.proposalVersion,
        instrument: "EUR/USD",
        direction: "BUY",
        quantity: 0.01,
        entryPrice: 1.1,
        stopLoss: 1.09,
        takeProfit: 1.13,
        timeInForce: "IOC",
        accountIdMasked: "12***89",
      },
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe("CONFIRMATION_REQUIRED");

    const mismatch = issueControlledDemoGrant({
      readiness,
      actor: "forex-admin",
      confirm: true,
      confirmed: {
        proposalId: readiness.snapshot!.proposalId,
        proposalVersion: readiness.snapshot!.proposalVersion,
        instrument: "EUR/USD",
        direction: "BUY",
        quantity: 0.01,
        entryPrice: 1.1,
        stopLoss: 1.09,
        takeProfit: 1.13,
        timeInForce: "IOC",
        accountIdMasked: "OTHER",
      },
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe("CONFIRM_ACCOUNT_MISMATCH");
  });

  it("issues short-lived grant with activatesMutation=false", () => {
    const readiness = evaluateControlledDemoReadiness(technicalReadyInput());
    const snap = snapshotFrom(readiness);
    const issued = issueStage7Grant({
      readiness,
      actor: "forex-admin",
      confirm: true,
      confirmed: {
        proposalId: snap.proposalId,
        proposalVersion: snap.proposalVersion,
        instrument: snap.instrument!,
        direction: snap.direction!,
        quantity: snap.quantity!,
        entryPrice: snap.entryPrice!,
        stopLoss: snap.stopLoss!,
        takeProfit: snap.takeProfit!,
        timeInForce: snap.timeInForce!,
        accountIdMasked: snap.accountIdMasked!,
      },
      storageRoot: root,
    });
    expect(issued.ok).toBe(true);
    if (issued.ok) {
      expect(issued.grant.activatesMutation).toBe(false);
      expect(issued.grant.environment).toBe("DEMO");
      expect(issued.grant.idempotencyKey).toContain(snap.proposalId);
    }
  });

  it("expired / reused / other-proposal / other-account grants rejected", () => {
    const readiness = evaluateControlledDemoReadiness(technicalReadyInput());
    const snap = snapshotFrom(readiness);
    const baseGrant = (over: Partial<Stage7ExecutionGrant> = {}): Stage7ExecutionGrant => ({
      grantId: "g-test",
      schemaVersion: "at-controlled-demo-execution-v1",
      stage: "STAGE_7_CONTROLLED_DEMO_EXECUTION",
      createdAtUtc: new Date().toISOString(),
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      createdBy: "forex-admin",
      proposalId: snap.proposalId,
      proposalVersion: snap.proposalVersion,
      riskRecordId: snap.riskRecordId!,
      allocationId: snap.allocationId!,
      accountIdMasked: "12***89",
      environment: "DEMO",
      instrument: "EUR/USD",
      direction: "BUY",
      quantity: 0.01,
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.13,
      timeInForce: "IOC",
      idempotencyKey: "k1",
      snapshot: snap,
      usedAtUtc: null,
      revokedAtUtc: null,
      activatesMutation: false,
      confirmAcknowledged: true,
      note: "test",
      ...over,
    });

    expect(evaluateControlledDemoReadiness(technicalReadyInput({
      activeGrant: baseGrant({ expiresAtUtc: new Date(Date.now() - 1_000).toISOString() }),
    })).blockers.some((b) => b.code === "AUTHORIZATION_EXPIRED")).toBe(true);

    expect(evaluateControlledDemoReadiness(technicalReadyInput({
      activeGrant: baseGrant({ usedAtUtc: new Date().toISOString() }),
    })).blockers.some((b) => b.code === "AUTHORIZATION_ALREADY_USED")).toBe(true);

    expect(evaluateControlledDemoReadiness(technicalReadyInput({
      activeGrant: baseGrant({ proposalId: "other-prop" }),
    })).blockers.some((b) => b.code === "AUTHORIZATION_BOUND_TO_OTHER_PROPOSAL")).toBe(true);

    expect(evaluateControlledDemoReadiness(technicalReadyInput({
      activeGrant: baseGrant({ accountIdMasked: "zz***99" }),
    })).blockers.some((b) => b.code === "AUTHORIZATION_BOUND_TO_OTHER_ACCOUNT")).toBe(true);
  });

  it("proposal version change invalidates grant", () => {
    const readiness = evaluateControlledDemoReadiness(technicalReadyInput());
    const snap = snapshotFrom(readiness);
    const grant: Stage7ExecutionGrant = {
      grantId: "g-ver",
      schemaVersion: "at-controlled-demo-execution-v1",
      stage: "STAGE_7_CONTROLLED_DEMO_EXECUTION",
      createdAtUtc: new Date().toISOString(),
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
      createdBy: "forex-admin",
      proposalId: snap.proposalId,
      proposalVersion: "stale-version",
      riskRecordId: snap.riskRecordId!,
      allocationId: snap.allocationId!,
      accountIdMasked: "12***89",
      environment: "DEMO",
      instrument: "EUR/USD",
      direction: "BUY",
      quantity: 0.01,
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.13,
      timeInForce: "IOC",
      idempotencyKey: "k-ver",
      snapshot: snap,
      usedAtUtc: null,
      revokedAtUtc: null,
      activatesMutation: false,
      confirmAcknowledged: true,
      note: "test",
    };
    const r = evaluateControlledDemoReadiness(technicalReadyInput({ activeGrant: grant }));
    expect(r.blockers.some((b) => b.code === "AUTHORIZATION_PROPOSAL_VERSION_MISMATCH")).toBe(true);
  });

  it("revoke clears active grant", () => {
    const readiness = evaluateControlledDemoReadiness(technicalReadyInput());
    const snap = snapshotFrom(readiness);
    const issued = issueStage7Grant({
      readiness,
      actor: "owner",
      confirm: true,
      confirmed: {
        proposalId: snap.proposalId,
        proposalVersion: snap.proposalVersion,
        instrument: snap.instrument!,
        direction: snap.direction!,
        quantity: snap.quantity!,
        entryPrice: snap.entryPrice!,
        stopLoss: snap.stopLoss!,
        takeProfit: snap.takeProfit!,
        timeInForce: snap.timeInForce!,
        accountIdMasked: snap.accountIdMasked!,
      },
      storageRoot: root,
    });
    expect(issued.ok).toBe(true);
    const revoked = revokeStage7Grant({ actor: "owner", storageRoot: root });
    expect(revoked.ok).toBe(true);
  });
});

describe("Stage 7 — idempotency / UNKNOWN / controls", () => {
  let root: string;
  let port: AssertNeverCalledMutationPort;

  beforeEach(() => {
    root = tmpRoot();
    resetControlledDemoExecutionStoreForTests(root);
    port = new AssertNeverCalledMutationPort();
  });

  afterEach(() => {
    assertNoMutation(port);
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it("duplicate idempotency key returns same attempt; never mutates", () => {
    const readiness = runControlledDemoReadiness({
      ...technicalReadyInput(),
      storageRoot: root,
      actor: "test",
    });
    const a = createStage7AttemptRecord({
      readiness,
      idempotencyKey: "idem-s7-dup",
      storageRoot: root,
      mutationPort: port,
    });
    const b = createStage7AttemptRecord({
      readiness,
      idempotencyKey: "idem-s7-dup",
      storageRoot: root,
      mutationPort: port,
    });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.attempt.attemptId).toBe(a.attempt.attemptId);
    expect(a.mutationInvoked).toBe(false);
    expect(b.mutationInvoked).toBe(false);
    expect(a.attempt.mutatesBroker).toBe(false);
    expect(a.attempt.verifiedBrokerAcceptance).toBe(false);
    assertNoMutation(port);
  });

  it("UNKNOWN unresolved attempt blocks new readiness", () => {
    const readiness = runControlledDemoReadiness({
      ...technicalReadyInput(),
      storageRoot: root,
    });
    const created = createStage7AttemptRecord({
      readiness,
      idempotencyKey: "idem-unknown",
      storageRoot: root,
      mutationPort: port,
    });
    const store = getControlledDemoExecutionStore(root);
    const unknown = {
      ...created.attempt,
      state: "UNKNOWN" as const,
      displayState: "UNKNOWN" as const,
      attemptId: "attempt-unknown-forced",
      idempotencyKey: "idem-unknown-forced",
    };
    store.upsertAttempt(unknown);
    expect(store.hasUnresolvedAttemptForProposal("prop-s7-1")).toBe(true);

    const blocked = evaluateControlledDemoReadiness(technicalReadyInput({
      unresolvedAttemptExists: true,
    }));
    expect(blocked.blockers.some((b) => b.code === "UNRESOLVED_SUBMISSION_EXISTS")).toBe(true);
    expect(blocked.technicalPass).toBe(false);
  });

  it("public status keeps EM OFF / lock ON stamps and submission disabled", () => {
    const status = getControlledDemoPublicStatus({
      storageRoot: root,
      controlsObserved: {
        executionMasterEnabled: false,
        emergencyEntryLock: true,
        tradingEnabled: false,
        automaticEntry: false,
        selectedEnvironment: "DEMO",
      },
    });
    expect(status.submissionEnabled).toBe(false);
    expect(status.mutatesBroker).toBe(false);
    expect(status.executionAuthorized).toBe(false);
    expect(status.mutationPortWired).toBe(false);
    expect(status.controlsObserved.executionMasterEnabled).toBe(false);
    expect(status.controlsObserved.emergencyEntryLock).toBe(true);
  });
});

describe("Stage 7 — post-fill protection", () => {
  let port: AssertNeverCalledMutationPort;
  beforeEach(() => {
    port = new AssertNeverCalledMutationPort();
  });
  afterEach(() => assertNoMutation(port));

  function snap(): Stage7ProposalSnapshot {
    return {
      proposalId: "prop-s7-1",
      proposalVersion: "v1",
      riskRecordId: "rr1",
      allocationId: "alloc-1",
      accountIdMasked: "12***89",
      instrument: "EUR/USD",
      direction: "BUY",
      quantity: 0.01,
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.13,
      timeInForce: "IOC",
      capitalAllocation: 100,
      operatingRiskPercent: 10,
      modeledMonetaryRisk: 10,
      rewardToRisk: 3,
    };
  }

  it("verified protection requires authoritative evidence + SL/TP", () => {
    const ok = verifyPostFillProtection({
      snapshot: snap(),
      tradeId: "T-1",
      brokerOrderId: "O-1",
      fillPrice: 1.1002,
      fillQuantity: 0.01,
      brokerStop: 1.09,
      brokerTakeProfit: 1.13,
      actualModeledMonetaryRisk: 10,
      expectedMonetaryProfit: 30,
      maximumAllowedMonetaryLoss: 25,
      authoritative: true,
    });
    expect(ok.status).toBe("VERIFIED");
    expect(ok.stopVerified).toBe(true);
    expect(ok.takeProfitVerified).toBe(true);
    void port;
  });

  it("non-authoritative evidence cannot be PROTECTED", () => {
    const r = verifyPostFillProtection({
      snapshot: snap(),
      tradeId: "T-1",
      brokerOrderId: "O-1",
      fillPrice: 1.1002,
      fillQuantity: 0.01,
      brokerStop: 1.09,
      brokerTakeProfit: 1.13,
      actualModeledMonetaryRisk: 10,
      expectedMonetaryProfit: 30,
      maximumAllowedMonetaryLoss: 25,
      authoritative: false,
    });
    expect(r.status).toBe("FAILED");
    expect(r.blockers.some((b) => b.code === "PROTECTION_EVIDENCE_NOT_AUTHORITATIVE")).toBe(true);
    void port;
  });

  it("missing Stop Loss is critical failure", () => {
    const r = verifyPostFillProtection({
      snapshot: snap(),
      tradeId: "T-1",
      brokerOrderId: "O-1",
      fillPrice: 1.1,
      fillQuantity: 0.01,
      brokerStop: null,
      brokerTakeProfit: 1.13,
      actualModeledMonetaryRisk: 10,
      expectedMonetaryProfit: 30,
      maximumAllowedMonetaryLoss: 25,
      authoritative: true,
    });
    expect(r.status).toBe("FAILED");
    expect(r.blockers.some((b) => b.code === "STOP_LOSS_MISSING_ON_BROKER")).toBe(true);
    void port;
  });

  it("missing Take Profit is critical failure", () => {
    const r = verifyPostFillProtection({
      snapshot: snap(),
      tradeId: "T-1",
      brokerOrderId: "O-1",
      fillPrice: 1.1,
      fillQuantity: 0.01,
      brokerStop: 1.09,
      brokerTakeProfit: null,
      actualModeledMonetaryRisk: 10,
      expectedMonetaryProfit: 30,
      maximumAllowedMonetaryLoss: 25,
      authoritative: true,
    });
    expect(r.status).toBe("FAILED");
    expect(r.blockers.some((b) => b.code === "TAKE_PROFIT_MISSING_ON_BROKER")).toBe(true);
    void port;
  });

  it("incorrect fill quantity rejected; fill risk re-verified", () => {
    const qty = verifyPostFillProtection({
      snapshot: snap(),
      tradeId: "T-1",
      brokerOrderId: "O-1",
      fillPrice: 1.1,
      fillQuantity: 0.02,
      brokerStop: 1.09,
      brokerTakeProfit: 1.13,
      actualModeledMonetaryRisk: 10,
      expectedMonetaryProfit: 30,
      maximumAllowedMonetaryLoss: 25,
      authoritative: true,
    });
    expect(qty.blockers.some((b) => b.code === "FILL_QUANTITY_MISMATCH")).toBe(true);

    const risk = verifyPostFillProtection({
      snapshot: snap(),
      tradeId: "T-1",
      brokerOrderId: "O-1",
      fillPrice: 1.105,
      fillQuantity: 0.01,
      brokerStop: 1.09,
      brokerTakeProfit: 1.13,
      actualModeledMonetaryRisk: 30,
      expectedMonetaryProfit: 20,
      maximumAllowedMonetaryLoss: 25,
      authoritative: true,
    });
    expect(risk.blockers.some((b) => b.code === "POST_FILL_RISK_EXCEEDS_25PCT")).toBe(true);
    expect(risk.blockers.some((b) => b.code === "POST_FILL_BELOW_3R")).toBe(true);
    void port;
  });
});

describe("Stage 7 — Time In Force", () => {
  let port: AssertNeverCalledMutationPort;
  beforeEach(() => {
    port = new AssertNeverCalledMutationPort();
  });
  afterEach(() => assertNoMutation(port));

  it("supports GTC / IOC / FOK / DAY", () => {
    expect(evaluateTimeInForce({ requested: "GTC" }).ok).toBe(true);
    expect(evaluateTimeInForce({ requested: "IOC" }).ok).toBe(true);
    expect(evaluateTimeInForce({ requested: "FOK" }).ok).toBe(true);
    expect(evaluateTimeInForce({ requested: "DAY" }).ok).toBe(true);
    void port;
  });

  it("rejects GTD without silent fallback", () => {
    const r = evaluateTimeInForce({ requested: "GTD" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.blockers[0]?.code).toBe("UNSUPPORTED_TIF_GTD");
      expect(r.blockers[0]?.message).toMatch(/Never silently converted/i);
    }
    const readiness = evaluateControlledDemoReadiness(technicalReadyInput({
      requestedTimeInForce: "GTD",
    }));
    expect(readiness.blockers.some((b) => b.code === "UNSUPPORTED_TIF_GTD")).toBe(true);
    expect(readiness.gtdSupported).toBe(false);
    void port;
  });
});

describe("Stage 7 — critical safety invariant", () => {
  it("every readiness path keeps mutation disabled and never calls mutation port", () => {
    const port = new AssertNeverCalledMutationPort();
    const cases: Stage7ReadinessInput[] = [
      technicalReadyInput(),
      technicalReadyInput({ configuredEnvironment: "LIVE", sessionEnvironment: "LIVE" }),
      technicalReadyInput({
        executionMasterEnabled: true,
        emergencyEntryLock: false,
        tradingEnabled: true,
      }),
      technicalReadyInput({ unresolvedAttemptExists: true }),
    ];
    for (const c of cases) {
      const r = evaluateControlledDemoReadiness(c);
      expect(r.submissionEnabled).toBe(false);
      expect(r.mutatesBroker).toBe(false);
      expect(r.executionAuthorized).toBe(false);
      expect(r.allGatesPass).toBe(false);
      expect(r.blockers.some((b) => b.code === "STAGE_7_MUTATION_DISABLED")).toBe(true);
    }
    // Controls must remain OFF/ON for Stage 7 development posture in technicalReadyInput
    const posture = evaluateControlledDemoReadiness(technicalReadyInput());
    expect(posture.gates.executionMaster.pass).toBe(false);
    expect(posture.gates.emergencyLock.pass).toBe(false);
    assertNoMutation(port);
  });
});
