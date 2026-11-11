/**
 * KWIZERA AI STUDIO → FOREX → AUTOMATED TRADING
 * XAU/USD-only active phase isolation (catalog preserved).
 */
import { describe, expect, it } from "vitest";
import {
  STAGE3_ACTIVE_INSTRUMENTS,
  STAGE3_TRACKED_INSTRUMENTS,
  getInstrumentPhaseStatus,
  isStage3ActiveInstrument,
} from "../../../../ai/forex-ai/automated-trading/risk-policy/types.js";
import { buildStage1ReadinessReport } from "../../../../ai/forex-ai/automated-trading/risk-policy/stage1-readiness.js";
import { isInstrumentAllowlisted } from "../../../../ai/forex-ai/automated-trading/simulation-risk/allowlist.js";
import { buildStage1Part3SlippageDemoPlan } from "../../../../ai/forex-ai/automated-trading/risk-policy/stage1-part3-slippage-demo-plan.js";
import { buildOrderProposal } from "../../../../ai/forex-ai/automated-trading/order-proposal/index.js";

describe("Automated Trading XAU-only active phase", () => {
  it("keeps full tracked catalog while activating only XAU/USD", () => {
    expect([...STAGE3_TRACKED_INSTRUMENTS]).toEqual([
      "EUR/USD",
      "GBP/USD",
      "USD/JPY",
      "XAU/USD",
    ]);
    expect([...STAGE3_ACTIVE_INSTRUMENTS]).toEqual(["XAU/USD"]);
    expect(isStage3ActiveInstrument("XAU/USD")).toBe(true);
    expect(isStage3ActiveInstrument("EUR/USD")).toBe(false);
    expect(getInstrumentPhaseStatus("EUR/USD")).toBe("OUT_OF_SCOPE");
    expect(getInstrumentPhaseStatus("XAU/USD")).toBe("ACTIVE");
  });

  it("execution allowlist remains XAU-only", () => {
    expect(isInstrumentAllowlisted("XAU/USD")).toBe(true);
    expect(isInstrumentAllowlisted("EUR/USD")).toBe(false);
    expect(isInstrumentAllowlisted("GBP/USD")).toBe(false);
    expect(isInstrumentAllowlisted("USD/JPY")).toBe(false);
  });

  it("Stage 1 readiness marks non-XAU as OUT_OF_SCOPE and does not require them for completion", () => {
    const report = buildStage1ReadinessReport({
      marketOpen: true,
      acceptedSpreadByInstrument: {
        "XAU/USD": [],
        "EUR/USD": [],
      },
      slippageFillsByInstrument: {},
    });
    expect(report.activePhase.activeInstruments).toEqual(["XAU/USD"]);
    expect(report.activePhase.trackedCatalog).toEqual([...STAGE3_TRACKED_INSTRUMENTS]);
    const eur = report.instruments.find((i) => i.instrument === "EUR/USD");
    const gbp = report.instruments.find((i) => i.instrument === "GBP/USD");
    const jpy = report.instruments.find((i) => i.instrument === "USD/JPY");
    const xau = report.instruments.find((i) => i.instrument === "XAU/USD");
    expect(eur?.phaseStatus).toBe("OUT_OF_SCOPE");
    expect(eur?.overall).toBe("OUT_OF_SCOPE");
    expect(gbp?.overall).toBe("OUT_OF_SCOPE");
    expect(jpy?.overall).toBe("OUT_OF_SCOPE");
    expect(xau?.phaseStatus).toBe("ACTIVE");
    expect(xau?.overall).not.toBe("OUT_OF_SCOPE");
    // Incomplete XAU evidence → phase NOT_RESOLVED, but not because of EUR/GBP/JPY.
    expect(report.stageComplete).toBe(false);
    expect(report.completionCode).toBe("NOT_RESOLVED");
  });

  it("slippage campaign plan is XAU-only and non-submitting", () => {
    const plan = buildStage1Part3SlippageDemoPlan();
    expect(plan.eligibleInstruments).toHaveLength(1);
    expect(plan.eligibleInstruments[0]?.instrument).toBe("XAU/USD");
    expect(plan.placesOrders).toBe(false);
    expect(plan.realDemoFillAuthorizedByThisPlan).toBe(false);
  });

  it("order proposal rejects non-allowlisted instruments (cannot enter AT workflow)", () => {
    const now = Date.parse("2026-11-11T12:00:00.000Z");
    const handoff = {
      acceptedResultId: "res-iso-1",
      analysisId: "an-iso-1",
      instrument: "EUR/USD",
      canonicalDirection: "BUY" as const,
      directionalConfidencePct: 60,
      confidenceType: "ANALYSIS_CONFIDENCE" as const,
      isCalibratedWinProbability: false,
      observationId: "obs-1",
      imageId: "img-1",
      imageHash: "hash-1",
      analyzedAtUtc: new Date(now).toISOString(),
      resultExpiresAtUtc: new Date(now + 3600_000).toISOString(),
      validationStatus: "VALID" as const,
      intakeLifecycle: "ACCEPTED" as const,
      evidenceReferences: {
        reconciliationStatus: "ALIGNED" as const,
        canonicalOutcome: "BUY_CANDIDATE" as const,
        primaryTimeframe: "H1",
        mtfAlignment: "ALIGNED" as const,
      },
      placesOrders: false as const,
      acceptsForExecution: false as const,
      mutatesBroker: false as const,
      note: "TEST_FIXTURE_ISOLATION",
    };
    const proposal = buildOrderProposal({
      handoff,
      entryPrice: 1.1,
      stopLoss: 1.099,
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      equityFresh: true,
      usableMargin: 8_000,
      usedMargin: 0,
      marginFresh: true,
      strategyAllocationPercent: 10,
      individualOrderAllocation: 40,
      allocationCurrency: "USD",
      existingCommittedExposure: 0,
      contract: {
        verified: true,
        pointSize: 0.0001,
        pipCostAccount: 10,
        contractMultiplier: null,
        quantityMin: 1000,
        quantityStep: 1000,
        baseUnitSize: 1000,
      },
      contractFresh: true,
      sdkMinQuantity: 1000,
      marginPerUnitAccount: 1.3,
      exposureAuthoritative: true,
      existingExposure: 0,
      systemMasterOn: true,
      tradingEnabled: true,
      emergencyEntryLock: false,
      nowMs: now,
    });
    expect(proposal.blockers.some((b) => b.code === "INSTRUMENT_NOT_ALLOWLISTED")).toBe(true);
    expect(proposal.lifecycle).toBe("BLOCKED");
  });
});
