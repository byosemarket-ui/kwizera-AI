/**
 * Phase 3 — FXCM payload validation + hard execution boundary (no broker mutation).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFxcmTrueMarketOpenPayload } from "../../../../ai/forex-ai/automated-trading/demo-submission-adapter/fxcm-payload.ts";
import { evaluateExecutionBoundary } from "../../../../ai/forex-ai/automated-trading/broker-execution/execution-boundary.ts";
import { validatePhase3PayloadPackage } from "../../../../ai/forex-ai/automated-trading/broker-execution/phase3-payload-validator.ts";
import {
  getAtPhase3PipelineStore,
  resetAtPhase3PipelineStoreForTests,
  runPhase3FromPrecheck,
} from "../../../../ai/forex-ai/automated-trading/phase3-pipeline.ts";
import {
  getAtSystemMasterStore,
  resetAtSystemMasterStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/system-master/index.ts";
import type { AtOrderProposalRecord } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.ts";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-phase3-"));
}

function proposalFixture(over: Partial<AtOrderProposalRecord> = {}): AtOrderProposalRecord {
  return {
    schemaVersion: "at-order-proposal-v1",
    proposalId: "prop-phase3-1",
    lifecycle: "PROPOSAL_READY",
    instrument: "XAU/USD",
    direction: "BUY",
    quantity: {
      // Stage/owner max lots = 0.01. Pair with baseUnitSize so AMOUNT is a positive integer.
      calculatedQuantity: 0.01,
      normalizedQuantity: 0.01,
      quantityUnit: "contracts",
      contractSize: 100,
      roundedDown: true,
    },
    pricePlan: {
      entryPrice: 2650.5,
      stopLoss: 2640,
      takeProfit: 2685,
      entryZoneLow: null,
      entryZoneHigh: null,
    },
    capital: {
      individualOrderAllocation: 40,
      allocatedAmount: 40,
      currency: "USD",
    },
    perOrderRisk: {
      actualModeledMonetaryRisk: 8,
    },
    blockers: [],
    ...over,
  } as unknown as AtOrderProposalRecord;
}

describe("Phase 3 FXCM payload builder + validator", () => {
  it("builds BUY payload with FXCM AMOUNT = baseUnitSize * lots", () => {
    const built = buildFxcmTrueMarketOpenPayload({
      proposal: proposalFixture(),
      accountId: "demo-acct-1",
      offerId: "4001",
      symbol: "XAU/USD",
      baseUnitSize: 100,
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.amount).toBe(1); // 100 * 0.01
    expect(built.payload.lots).toBe(0.01);
    expect(built.payload.buySell).toBe("BUY");
    expect(built.payload.offerId).toBe("4001");
    expect(built.payload.rateStop).toBe(2640);
    expect(built.payload.rateLimit).toBe(2685);
  });

  it("builds SELL payload with correct SL/TP geometry", () => {
    const built = buildFxcmTrueMarketOpenPayload({
      proposal: proposalFixture({
        direction: "SELL",
        pricePlan: {
          entryPrice: 2650,
          stopLoss: 2660,
          takeProfit: 2620,
          entryZoneLow: null,
          entryZoneHigh: null,
        },
      } as Partial<AtOrderProposalRecord>),
      accountId: "demo-acct-1",
      offerId: "4001",
      symbol: "XAU/USD",
      baseUnitSize: 100,
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.payload.buySell).toBe("SELL");
    expect(built.payload.rateStop).toBe(2660);
    expect(built.payload.rateLimit).toBe(2620);
  });

  it("rejects invalid BUY stop above ask", () => {
    const built = buildFxcmTrueMarketOpenPayload({
      proposal: proposalFixture({
        pricePlan: {
          entryPrice: 2650.5,
          stopLoss: 2660,
          takeProfit: 2685,
          entryZoneLow: null,
          entryZoneHigh: null,
        },
      } as Partial<AtOrderProposalRecord>),
      accountId: "demo-acct-1",
      offerId: "4001",
      baseUnitSize: 100,
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.code).toBe("STOP_LOSS_GEOMETRY_INVALID");
  });

  it("blocks XAU when broker min quantity 1 exceeds owner-max lots 0.01 (AMOUNT would be invalid)", () => {
    const built = buildFxcmTrueMarketOpenPayload({
      proposal: proposalFixture({
        quantity: {
          calculatedQuantity: 0.01,
          normalizedQuantity: 0.01,
          quantityUnit: "contracts",
          contractSize: 1,
          roundedDown: true,
        },
      } as Partial<AtOrderProposalRecord>),
      accountId: "demo-acct-1",
      offerId: "4001",
      symbol: "XAU/USD",
      baseUnitSize: 1, // observed XAU baseUnitSize
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.code).toBe("INVALID_AMOUNT");
  });

  it("validates package and stamps EXECUTION_DISABLED without hard-failing validation", () => {
    const proposal = proposalFixture();
    const built = buildFxcmTrueMarketOpenPayload({
      proposal,
      accountId: "demo-acct-1",
      offerId: "4001",
      baseUnitSize: 100,
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const pkg = validatePhase3PayloadPackage({
      proposal,
      payload: built.payload,
      precheckId: "pre-1",
      precheckStatus: "PASSED",
      precheckPassedDomain: true,
      handoffId: "hand-1",
      offerId: "4001",
      baseUnitSize: 100,
      // quantityMin/Step are FXCM AMOUNT (contract) units, not lots.
      quantityMin: 1,
      quantityStep: 1,
      contractFresh: true,
      quoteFresh: true,
      quoteBid: 2650,
      quoteAsk: 2650.5,
      individualOrderAllocation: 40,
      modeledMaxLoss: 8,
    });
    expect(pkg.validationStatus).toBe("PAYLOAD_VALIDATED");
    expect(pkg.blockers).toContain("EXECUTION_DISABLED");
    expect(pkg.quantityUnit).toBe("FXCM_AMOUNT");
    expect(pkg.amount).toBe(1);
  });

  it("compares broker minQuantity to AMOUNT not lots (XAU unit fix)", () => {
    const proposal = proposalFixture();
    const built = buildFxcmTrueMarketOpenPayload({
      proposal,
      accountId: "demo-acct-1",
      offerId: "4001",
      baseUnitSize: 100,
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    // lots=0.01 would falsely fail if compared to minQuantity AMOUNT=1; amount=1 must pass.
    const pkg = validatePhase3PayloadPackage({
      proposal,
      payload: built.payload,
      precheckId: "pre-amt-min",
      precheckStatus: "PASSED",
      precheckPassedDomain: true,
      offerId: "4001",
      baseUnitSize: 100,
      quantityMin: 1,
      quantityStep: 1,
      contractFresh: true,
      quoteFresh: true,
    });
    expect(pkg.validationStatus).toBe("PAYLOAD_VALIDATED");
    expect(pkg.blockers).not.toContain("AMOUNT_BELOW_MIN_QUANTITY");
    expect(pkg.blockers).not.toContain("BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT");
  });

  it("flags AMOUNT below broker minQuantity with owner-limit classification", () => {
    const proposal = proposalFixture();
    const built = buildFxcmTrueMarketOpenPayload({
      proposal,
      accountId: "demo-acct-1",
      offerId: "4001",
      baseUnitSize: 100,
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const pkg = validatePhase3PayloadPackage({
      proposal,
      payload: built.payload,
      precheckId: "pre-below-min",
      precheckStatus: "PASSED",
      precheckPassedDomain: true,
      offerId: "4001",
      baseUnitSize: 100,
      quantityMin: 2, // AMOUNT min above computed amount=1
      quantityStep: 1,
      contractFresh: true,
      quoteFresh: true,
    });
    expect(pkg.validationStatus).toBe("PAYLOAD_INVALID");
    expect(pkg.blockers).toContain("AMOUNT_BELOW_MIN_QUANTITY");
    expect(pkg.blockers).toContain("BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT");
  });

  it("rejects stale quote and expired precheck", () => {
    const proposal = proposalFixture();
    const built = buildFxcmTrueMarketOpenPayload({
      proposal,
      accountId: "demo-acct-1",
      offerId: "4001",
      baseUnitSize: 100,
      bid: 2650,
      ask: 2650.5,
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const pkg = validatePhase3PayloadPackage({
      proposal,
      payload: built.payload,
      precheckId: "pre-stale",
      precheckStatus: "PASSED",
      precheckPassedDomain: true,
      precheckExpiresAtUtc: "2020-01-01T00:00:00.000Z",
      offerId: "4001",
      baseUnitSize: 100,
      contractFresh: true,
      quoteFresh: false,
      nowMs: Date.parse("2026-11-13T00:00:00.000Z"),
    });
    expect(pkg.validationStatus).toBe("PAYLOAD_INVALID");
    expect(pkg.blockers).toContain("QUOTE_STALE");
    expect(pkg.blockers).toContain("PRECHECK_EXPIRED");
  });
});

describe("Phase 3 execution boundary", () => {
  it("always returns EXECUTION_BLOCKED and probes disabled adapter", () => {
    const decision = evaluateExecutionBoundary({
      payloadId: "pay-1",
      handoffId: "hand-1",
      proposalId: "prop-1",
      precheckId: "pre-1",
      analysisId: "an-1",
      instrument: "XAU/USD",
      direction: "BUY",
      executionMasterEnabled: false,
      emergencyEntryLock: true,
      demoMutationAllowed: false,
      activeDemoGrant: false,
    });
    expect(decision.status).toBe("EXECUTION_BLOCKED");
    expect(decision.reasonCode).toBe("EXECUTION_DISABLED_BY_OWNER_POLICY");
    expect(decision.submissionAttempted).toBe(false);
    expect(decision.deferredOrderQueued).toBe(false);
    expect(decision.mutatesBroker).toBe(false);
    expect(decision.mutationProbe.code).toBe("EXECUTION_FORBIDDEN");
    expect(decision.mutationProbe.called).toBe(true);
  });
});

describe("Phase 3 pipeline orchestration", () => {
  let root: string;
  let prevStorage: string | undefined;

  beforeEach(() => {
    root = tmpRoot();
    prevStorage = process.env.KWIZERA_STORAGE_ROOT;
    process.env.KWIZERA_STORAGE_ROOT = root;
    resetAtSystemMasterStoreForTests();
    resetAtPhase3PipelineStoreForTests();
  });

  afterEach(() => {
    resetAtSystemMasterStoreForTests();
    resetAtPhase3PipelineStoreForTests();
    if (prevStorage === undefined) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prevStorage;
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("aborts when System Master is OFF", async () => {
    const master = getAtSystemMasterStore();
    expect(master.get().ownerState).toBe("OFF");
    const store = getAtPhase3PipelineStore();
    const out = await runPhase3FromPrecheck({
      precheckId: "pre-1",
      precheckStatus: "PASSED",
      precheckPassedDomain: true,
      proposalId: "prop-phase3-1",
      analysisGeneration: master.getAnalysisGeneration(),
      store,
      service: {
        getProposal: () => proposalFixture(),
        getAccountIdForPayload: () => "acct",
        getContractMeta: () => ({
          offerId: "4001",
          baseUnitSize: 100,
          quantityMin: 1,
          quantityStep: 1,
          contractSource: "test",
          contractFresh: true,
          symbol: "XAU/USD",
        }),
        getQuote: () => ({ bid: 2650, ask: 2650.5, fresh: true }),
        getSafety: () => ({
          executionMasterEnabled: false,
          emergencyEntryLock: true,
          demoMutationAllowed: false,
          activeDemoGrant: false,
        }),
      },
    });
    expect(out.chain.status).toBe("ABORTED_SYSTEM_OFF");
  });

  it("reaches EXECUTION_BLOCKED with payload ids and never submits", async () => {
    const master = getAtSystemMasterStore();
    await master.forceSet((prev) => ({
      ...prev,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "ON",
    }));
    const store = getAtPhase3PipelineStore();
    const submitSpy = vi.fn();
    const out = await runPhase3FromPrecheck({
      precheckId: "pre-ok-1",
      precheckStatus: "PASSED",
      precheckPassedDomain: true,
      proposalId: "prop-phase3-1",
      handoffId: "hand-ok-1",
      analysisId: "an-ok-1",
      intakeId: "in-ok-1",
      riskDecisionId: "risk-ok-1",
      analysisGeneration: master.getAnalysisGeneration(),
      store,
      service: {
        getProposal: () => proposalFixture(),
        getAccountIdForPayload: () => "acct-demo",
        getContractMeta: () => ({
          offerId: "4001",
          baseUnitSize: 100,
          quantityMin: 1,
          quantityStep: 1,
          contractSource: "FOREXCONNECT",
          contractFresh: true,
          symbol: "XAU/USD",
        }),
        getQuote: () => ({ bid: 2650, ask: 2650.5, fresh: true }),
        getSafety: () => ({
          executionMasterEnabled: false,
          emergencyEntryLock: true,
          demoMutationAllowed: false,
          activeDemoGrant: false,
        }),
      },
    });
    expect(out.chain.status).toBe("EXECUTION_BLOCKED");
    expect(out.chain.payloadId).toBeTruthy();
    expect(out.chain.executionBoundaryDecisionId).toBeTruthy();
    expect(out.chain.submissionAttempted).toBe(false);
    expect(out.chain.mutatesBroker).toBe(false);
    expect(out.boundary?.status).toBe("EXECUTION_BLOCKED");
    expect(out.payloadPackage?.validationStatus).toBe("PAYLOAD_VALIDATED");
    expect(out.payloadPackage?.offerId).toBe("4001");
    expect(submitSpy).not.toHaveBeenCalled();

    const again = await runPhase3FromPrecheck({
      precheckId: "pre-ok-1",
      precheckStatus: "PASSED",
      precheckPassedDomain: true,
      proposalId: "prop-phase3-1",
      analysisGeneration: master.getAnalysisGeneration(),
      store,
      service: {
        getProposal: () => proposalFixture(),
        getAccountIdForPayload: () => "acct-demo",
        getContractMeta: () => ({
          offerId: "4001",
          baseUnitSize: 100,
          quantityMin: 1,
          quantityStep: 1,
          contractSource: "FOREXCONNECT",
          contractFresh: true,
          symbol: "XAU/USD",
        }),
        getQuote: () => ({ bid: 2650, ask: 2650.5, fresh: true }),
        getSafety: () => ({
          executionMasterEnabled: false,
          emergencyEntryLock: true,
          demoMutationAllowed: false,
          activeDemoGrant: false,
        }),
      },
    });
    expect(again.chain.payloadId).toBe(out.chain.payloadId);
    expect(again.chain.executionBoundaryDecisionId).toBe(out.chain.executionBoundaryDecisionId);
  });

  it("rejects failed precheck without building a submit path", async () => {
    const master = getAtSystemMasterStore();
    await master.forceSet((prev) => ({
      ...prev,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "ON",
    }));
    const store = getAtPhase3PipelineStore();
    const out = await runPhase3FromPrecheck({
      precheckId: "pre-fail",
      precheckStatus: "BLOCKED",
      precheckPassedDomain: false,
      proposalId: "prop-phase3-1",
      analysisGeneration: master.getAnalysisGeneration(),
      store,
      service: {
        getProposal: () => proposalFixture(),
        getAccountIdForPayload: () => "acct",
        getContractMeta: () => ({
          offerId: "4001",
          baseUnitSize: 100,
          quantityMin: 1,
          quantityStep: 1,
          contractSource: "test",
          contractFresh: true,
          symbol: "XAU/USD",
        }),
        getQuote: () => ({ bid: 2650, ask: 2650.5, fresh: true }),
        getSafety: () => ({
          executionMasterEnabled: false,
          emergencyEntryLock: true,
          demoMutationAllowed: false,
          activeDemoGrant: false,
        }),
      },
    });
    expect(out.chain.status).toBe("PRECHECK_VALIDATION_FAILED");
    expect(out.chain.payloadId).toBeNull();
    expect(out.boundary).toBeNull();
  });
});
