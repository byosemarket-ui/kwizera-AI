/**
 * Stage 7.3 continuation — observation evidence, TIF matrix, XAU lot root cause,
 * unknown-result reconcile, market-open plan, margin RO metadata.
 * Labels: SYNTHETIC / HISTORICAL fixtures — not live broker evidence.
 */
import { describe, expect, it } from "vitest";
import {
  MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION,
  buildTrackedInstrumentsEvidenceReport,
  evaluateSpreadObservationQuality,
  ownerApprovalRequirements,
  type SpreadObservation,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/observation-evidence.js";
import {
  getTifBrokerCapabilityMatrix,
  summarizeTifBrokerGaps,
} from "../../../../ai/forex-ai/automated-trading/controlled-demo-execution/tif-broker-matrix.js";
import { evaluateTimeInForce } from "../../../../ai/forex-ai/automated-trading/controlled-demo-execution/tif.js";
import { getControlledDemoProtectionTestPlan } from "../../../../ai/forex-ai/automated-trading/controlled-demo-execution/protection-demo-test-plan.js";
import { explainXauOwnerLotIncompatibility } from "../../../../ai/forex-ai/automated-trading/order-execution/xau-owner-lot-compatibility.js";
import {
  assessRoMarginMetadata,
  getProposedOrderMarginVerificationPlan,
} from "../../../../ai/forex-ai/automated-trading/order-execution/margin-ro-metadata.js";
import {
  applyReadOnlyBrokerObservation,
  planUnknownResultReconciliation,
} from "../../../../ai/forex-ai/automated-trading/demo-submission-adapter/unknown-result-reconcile.js";
import { parseBrokerAcknowledgementFixture } from "../../../../ai/forex-ai/automated-trading/demo-submission-adapter/acknowledgement.js";
import {
  classifyProposalProvenanceLabel,
  getCanonicalPipelineVerificationPlan,
} from "../../../../ai/forex-ai/automated-trading/analysis/market-open-verification-plan.js";
import {
  AtRiskPolicyStore,
  resetAtRiskPolicyStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/store.js";
import { resolveSpreadLimit } from "../../../../ai/forex-ai/automated-trading/risk-policy/resolve.js";
import { OWNER_MAX_QUANTITY } from "../../../../ai/forex-ai/automated-trading/order-proposal/types.js";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

describe("Stage 7.3 — spread/slippage observation evidence", () => {
  it("rejects CACHED/STALE XAU 0.30 as recommendation evidence", () => {
    const obs: SpreadObservation = {
      instrument: "XAU/USD",
      bid: 2650.0,
      ask: 2650.3,
      spreadAbsolute: 0.3,
      observedAtUtc: new Date().toISOString(),
      provenance: "CACHED",
      source: "weekend_cache",
    };
    const q = evaluateSpreadObservationQuality({ observation: obs, marketOpen: false });
    expect(q.usableForRecommendation).toBe(false);
    expect(q.code).toBe("NON_LIVE_OBSERVATION");
    expect(q.units).toBe("absolute_price");
  });

  it("requires ≥20 LIVE fresh samples before drafting a recommendation", () => {
    const now = Date.now();
    const live: SpreadObservation[] = Array.from({ length: 19 }, (_, i) => ({
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      spreadAbsolute: 0.0002,
      observedAtUtc: new Date(now - i * 1000).toISOString(),
      provenance: "LIVE" as const,
      source: "fixture",
    }));
    const report19 = buildTrackedInstrumentsEvidenceReport({
      observationsByInstrument: { "EUR/USD": live },
      nowMs: now,
      marketOpen: true,
    });
    const eur19 = report19.instruments.find((r) => r.instrument === "EUR/USD")!;
    expect(eur19.usableLiveObservationCount).toBe(19);
    expect(eur19.mayDraftRecommendation).toBe(false);
    expect(eur19.mayApproveFromObservationsAlone).toBe(false);

    live.push({
      instrument: "EUR/USD",
      bid: 1.1,
      ask: 1.1002,
      spreadAbsolute: 0.0002,
      observedAtUtc: new Date(now).toISOString(),
      provenance: "LIVE",
      source: "fixture",
    });
    const report20 = buildTrackedInstrumentsEvidenceReport({
      observationsByInstrument: { "EUR/USD": live },
      nowMs: now,
      marketOpen: true,
    });
    expect(report20.instruments.find((r) => r.instrument === "EUR/USD")!.mayDraftRecommendation).toBe(true);
    expect(MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION).toBe(20);
  });

  it("documents owner approval requirements and fail-closed NOT_CONFIGURED", () => {
    const req = ownerApprovalRequirements();
    expect(req.instruments).toEqual(["EUR/USD", "GBP/USD", "USD/JPY", "XAU/USD"]);
    expect(req.units).toBe("absolute_price");
    expect(req.requireProposeThenOwnerApproveConfirm).toBe(true);
    expect(req.failClosedWhenMissing).toBe(true);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "at-rp-"));
    try {
      resetAtRiskPolicyStoreForTests(path.join(dir, "risk-policy.json"));
      const store = new AtRiskPolicyStore(path.join(dir, "risk-policy.json"));
      for (const inst of req.instruments) {
        const pol = store.getInstrument(inst);
        expect(pol?.spread.status).toBe("NOT_CONFIGURED");
        expect(pol?.slippage.status).toBe("NOT_CONFIGURED");
        const resolved = resolveSpreadLimit({ instrument: inst, store });
        expect(resolved.status).toBe("NOT_CONFIGURED");
      }
    } finally {
      resetAtRiskPolicyStoreForTests();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("marks staleXau030NotApproved on the evidence report", () => {
    const report = buildTrackedInstrumentsEvidenceReport({ marketOpen: false });
    expect(report.staleXau030NotApproved).toBe(true);
    expect(report.instruments.every((r) => r.policyStatus === "NOT_CONFIGURED")).toBe(true);
  });
});

describe("Stage 7.3 — TIF broker matrix", () => {
  it("maps GTC/IOC/FOK/DAY without silent downgrade; rejects GTD; live unconfirmed", () => {
    const matrix = getTifBrokerCapabilityMatrix();
    const byInternal = Object.fromEntries(matrix.map((r) => [r.internal, r]));
    for (const tif of ["IOC", "GTC", "FOK", "DAY"] as const) {
      expect(byInternal[tif].internalAccepted).toBe(true);
      expect(byInternal[tif].silentlyDowngraded).toBe(false);
      expect(byInternal[tif].brokerSupportConfirmed).toBe(false);
      expect(evaluateTimeInForce({ requested: tif }).ok).toBe(true);
    }
    expect(byInternal.GTD.internalAccepted).toBe(false);
    expect(byInternal.GTD.brokerField).toBeNull();
    expect(evaluateTimeInForce({ requested: "GTD" }).ok).toBe(false);
    const gaps = summarizeTifBrokerGaps(matrix);
    expect(gaps.explicitlyRejected).toContain("GTD");
    expect(gaps.allLiveConfirmed).toBe(false);
  });
});

describe("Stage 7.3 — XAU owner 0.01 lot incompatibility root cause", () => {
  it("explains AMOUNT_NOT_INTEGER + OWNER_MAX_BELOW_MIN without raising owner max", () => {
    const r = explainXauOwnerLotIncompatibility({
      baseUnitSize: 1,
      minQuantity: 1,
      mmrPerLot: 4.79,
    });
    expect(r.ownerMaxLots).toBe(OWNER_MAX_QUANTITY);
    expect(r.mayRaiseOwnerMaxLots).toBe(false);
    expect(r.mayInventBaseUnitSize).toBe(false);
    expect(r.rootCauseCodes).toContain("AMOUNT_NOT_INTEGER");
    expect(r.rootCauseCodes).toContain("OWNER_MAX_LOTS_BELOW_BROKER_MIN");
    expect(r.contract.amountConversion.amount).toBeNull();
  });

  it("assessRoMarginMetadata fail-closes non-authoritative / missing mmr", () => {
    const a = assessRoMarginMetadata({
      instrument: "XAU/USD",
      baseUnitSize: 1,
      minQuantity: 1,
      mmrPerLot: null,
      quantityIncrement: 1,
      sourceAuthoritative: false,
      observedAtUtc: null,
    });
    expect(a.mayRaiseOwnerMaxLots).toBe(false);
    expect(a.maySubmitProposedOrderForMarginProbe).toBe(false);
    expect(a.blockers).toContain("RO_SOURCE_NOT_AUTHORITATIVE");
    expect(a.blockers).toContain("MMR_PER_LOT_UNVERIFIED");
    expect(a.xauRootCause?.rootCauseCodes).toContain("AMOUNT_NOT_INTEGER");

    const plan = getProposedOrderMarginVerificationPlan();
    expect(plan.maySubmitOrder).toBe(false);
    expect(plan.mayCallCreateOrderRequest).toBe(false);
  });
});

describe("Stage 7.3 — unknown-result reconciliation (no blind retry)", () => {
  it("plans RO lookup and forbids blind retry on timeout UNKNOWN", () => {
    const ack = parseBrokerAcknowledgementFixture({
      executionAttemptId: "e1",
      proposalId: "p1",
      accountIdMasked: "12***89",
      raw: { timeout: true, resultUnknown: true },
      source: "BROKER_RESPONSE",
    });
    expect(ack.resultUnknown).toBe(true);
    const plan = planUnknownResultReconciliation(ack);
    expect(plan.mayBlindRetrySubmission).toBe(false);
    expect(plan.maySubmitNewOrder).toBe(false);
    expect(plan.mayMutateBroker).toBe(false);
    expect(plan.action).toBe("READ_ONLY_BROKER_LOOKUP");
    expect(plan.requiredLookups).toEqual(expect.arrayContaining(["orders", "trades"]));
  });

  it("applies RO observation without authorizing resubmit", () => {
    const still = applyReadOnlyBrokerObservation({
      prior: { resultUnknown: true, brokerOrderId: null, brokerTradeId: null },
      roOrderFound: false,
      roTradeFound: false,
    });
    expect(still.stillUnknown).toBe(true);
    expect(still.mayBlindRetrySubmission).toBe(false);

    const found = applyReadOnlyBrokerObservation({
      prior: { resultUnknown: true, brokerOrderId: null, brokerTradeId: null },
      roOrderFound: true,
      roTradeFound: false,
      roOrderId: "OID-1",
    });
    expect(found.resolved).toBe(true);
    expect(found.outcome).toBe("FOUND_ORDER");
    expect(found.mayBlindRetrySubmission).toBe(false);
  });
});

describe("Stage 7.3 — market-open plan + proposal provenance", () => {
  it("allows historical pipeline testing and refuses live label for historical PROPOSAL_READY", () => {
    const plan = getCanonicalPipelineVerificationPlan();
    expect(plan.marketClosedIsNotAppFailure).toBe(true);
    expect(plan.mayFabricateProposalReadyAsLive).toBe(false);
    expect(plan.instruments).toHaveLength(4);
    expect(plan.steps.map((s) => s.id)).toContain("proposal_construction");

    const hist = classifyProposalProvenanceLabel({
      dataProvenance: "HISTORICAL",
      lifecycle: "PROPOSAL_READY",
    });
    expect(hist.reportAsLiveProposal).toBe(false);
    expect(hist.label).toContain("HISTORICAL");
  });
});

describe("Stage 7.3 — protection DEMO test plan", () => {
  it("does not authorize a real DEMO fill in this task", () => {
    const plan = getControlledDemoProtectionTestPlan();
    expect(plan.realDemoFillAuthorizedByThisTask).toBe(false);
    expect(plan.mayCallCreateOrderRequest).toBe(false);
    expect(plan.brokerAuthoritativeStepsRequireSeparateApproval.every((s) => s.requiresOwnerApproval)).toBe(true);
  });
});
