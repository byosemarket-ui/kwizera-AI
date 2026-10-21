/**
 * Phase 56.2.7 — Simulation data readiness gates + acceptance scenario fixtures.
 * Synthetic fixtures only — not production broker evidence.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  evaluateSimulationDataReadiness,
  validateOrderAllocationAmount,
  sizeOrderQuantityFromAllocation,
  proposeTakeProfit3RPrice,
  validateSimulationDraft,
  defaultSimRiskPolicy,
  type AtSimDraftInput,
  type AtSimContractMetaInput,
} from "../../../../ai/forex-ai/automated-trading/simulation-risk/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

const readyBase = {
  environment: "DEMO" as const,
  environmentMatches: true,
  quoteFresh: true,
  quoteReasonCode: "FRESH",
  feedStatus: "LIVE",
  bid: 4100,
  ask: 4100.3,
  accountVerified: true,
  accountCurrency: "USD",
  equity: 10_000,
  usableMargin: 8_000,
  accountFresh: true,
  quantityUnit: "contracts",
  quantityUnitAmbiguous: false,
  quantityMin: 1,
  quantityStep: 1,
  quantityConstraintsVerified: true,
  minStopDistanceVerified: true,
  minStopNoPositiveMinimum: false,
  condDistUnit: "pips",
  condDistAvailable: true,
  conversionRequired: false,
  conversionReady: true,
  exposureAuthoritative: true,
  exposureStatus: "AUTHORITATIVE_EMPTY",
  confirmedZeroExposure: true,
  masterEnable: false,
  emergencyEntryLock: true,
};

const xauContract: AtSimContractMetaInput = {
  verified: true,
  pointSize: 0.01,
  tickSize: 0.01,
  digits: 2,
  quantityMin: 1,
  quantityStep: 1,
  quantityUnit: "contracts",
  quantityUnitAmbiguous: false,
  contractMultiplier: 1,
  baseUnitSize: 1,
  pipCostAccount: 0.01,
  marginPerLotAccount: 4.79,
  minStopDistance: 0.5,
  minStopDistanceVerified: true,
  source: "synthetic",
  unavailableReason: null,
};

describe("Phase 56.2.7 readiness gates", () => {
  it("Scenario 1 fixture: all mandatory gates READY (synthetic — not prod evidence)", () => {
    const r = evaluateSimulationDataReadiness(readyBase);
    expect(r.overall).toBe("READY");
    expect(r.readyForSimulationDraft).toBe(true);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
  });

  it("Scenario 2: stale quote blocks sizing-related gates", () => {
    const r = evaluateSimulationDataReadiness({
      ...readyBase,
      quoteFresh: false,
      quoteReasonCode: "FEED_NOT_LIVE",
      feedStatus: "STALE",
    });
    expect(r.overall).toBe("STALE");
    expect(r.readyForSimulationDraft).toBe(false);
    const q = r.gates.find((g) => g.id === "market_quote");
    expect(q?.status).toBe("STALE");
    expect(q?.blocks.some((b) => /quantity|SL risk|entry/i.test(b))).toBe(true);
  });

  it("Scenario 3: missing equity / free margin unavailable", () => {
    const r = evaluateSimulationDataReadiness({
      ...readyBase,
      equity: null,
      usableMargin: null,
    });
    expect(r.readyForSimulationDraft).toBe(false);
    expect(r.gates.find((g) => g.id === "account_equity")?.status).toBe("UNAVAILABLE");
    expect(r.gates.find((g) => g.id === "free_margin")?.status).toBe("UNAVAILABLE");
  });

  it("Scenario 4: unverified quantity constraints", () => {
    const r = evaluateSimulationDataReadiness({
      ...readyBase,
      quantityUnitAmbiguous: true,
      quantityUnit: "unknown",
      quantityConstraintsVerified: false,
    });
    expect(r.gates.find((g) => g.id === "quantity_constraints")?.status).toBe("UNVERIFIED");
    expect(r.readyForSimulationDraft).toBe(false);
  });

  it("Scenario 5: non-USD without conversion blocked", () => {
    const r = evaluateSimulationDataReadiness({
      ...readyBase,
      accountCurrency: "EUR",
      conversionRequired: true,
      conversionReady: false,
      conversionReason: "FX_RATE_UNAVAILABLE",
    });
    expect(r.gates.find((g) => g.id === "currency_conversion")?.status).toBe("BLOCKED");
  });

  it("Scenario 6: incomplete exposure is not zero", () => {
    const r = evaluateSimulationDataReadiness({
      ...readyBase,
      exposureAuthoritative: false,
      exposureStatus: "UNAVAILABLE",
      confirmedZeroExposure: false,
    });
    const ex = r.gates.find((g) => g.id === "exposure");
    expect(ex?.status).toBe("UNAVAILABLE");
    expect(ex?.authoritative).toBe(false);
    expect(ex?.reason).toMatch(/not zero/i);
  });

  it("Scenario 7: invalid allocations rejected", () => {
    expect(validateOrderAllocationAmount("").ok).toBe(false);
    expect(validateOrderAllocationAmount(-5).ok).toBe(false);
    expect(validateOrderAllocationAmount(0).ok).toBe(false);
    expect(validateOrderAllocationAmount(Number.NaN).ok).toBe(false);
    expect(validateOrderAllocationAmount(100).ok).toBe(true);
  });

  it("Scenario 8: 25% loss ceiling and 3R with verified inputs", () => {
    const sized = sizeOrderQuantityFromAllocation({
      verifiedEquity: 10_000,
      accountCurrency: "USD",
      strategyAllocationPercent: 50,
      remainingStrategyBudget: 5_000,
      individualOrderAllocation: 200,
      entryPrice: 4100,
      stopLoss: 4080,
      contract: xauContract,
      freeMargin: 8_000,
      exposureAuthoritative: true,
      marginPerUnitAccount: 4.79,
      sdkMinQuantity: 1,
    });
    expect(sized.ok).toBe(true);
    if (!sized.ok) return;
    expect(sized.maxPermittedOrderLoss).toBe(50);
    expect(sized.estimatedStopLossRisk).toBeLessThanOrEqual(50 + 1e-8);
    const tp = proposeTakeProfit3RPrice({
      direction: "BUY",
      entryPrice: 4100,
      stopLoss: 4080,
      digits: 2,
    });
    expect(tp.ok).toBe(true);
    if (tp.ok) expect(tp.takeProfit).toBe(4160);
  });

  it("Scenario 10: execution locks stay closed on readiness result", () => {
    const r = evaluateSimulationDataReadiness(readyBase);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    const locks = r.gates.find((g) => g.id === "execution_locks");
    expect(locks?.status).toBe("READY");
    const bad = evaluateSimulationDataReadiness({
      ...readyBase,
      masterEnable: true,
      emergencyEntryLock: false,
    });
    expect(bad.gates.find((g) => g.id === "execution_locks")?.status).toBe("BLOCKED");
  });

  it("connected session alone is not READY without quote/account/exposure", () => {
    const r = evaluateSimulationDataReadiness({
      environment: "DEMO",
      environmentMatches: true,
      masterEnable: false,
      emergencyEntryLock: true,
    });
    expect(r.readyForSimulationDraft).toBe(false);
    expect(r.overall).not.toBe("READY");
  });
});

describe("Phase 56.2.7 draft validation safety (synthetic)", () => {
  it("validateSimulationDraft never enables execution", () => {
    const input: AtSimDraftInput = {
      environment: "DEMO",
      environmentMeta: {
        requested: "DEMO",
        actualSession: "DEMO",
        matches: true,
        environmentEpoch: 1,
        identityVerified: true,
        liveExecutionAuthorized: false,
      },
      instrument: "XAU/USD",
      direction: "BUY",
      entryPrice: 4100,
      stopLoss: 4080,
      takeProfit: 4160,
      requestedQuantity: 1,
      quote: {
        bid: 4099.9,
        ask: 4100.1,
        entryPrice: 4100,
        entrySource: "synthetic",
        fresh: true,
        freshnessReasonCode: "FRESH",
        quoteAgeMs: 50,
        observedAtUtc: new Date().toISOString(),
      },
      contract: xauContract,
      account: {
        verified: true,
        accountIdMasked: "•••",
        accountCurrency: "USD",
        equity: 10_000,
        balance: 10_000,
        usableMargin: 8_000,
        usedMargin: 0,
        fetchedAtUtc: new Date().toISOString(),
        environment: "DEMO",
        unavailableReason: null,
      },
      sourceDecisionId: "d",
      sourceAnalysisId: "a",
      sourceEvidenceFingerprint: "fp",
      sourceDecidedAtUtc: new Date().toISOString(),
      policy: { ...defaultSimRiskPolicy(), riskBudgetMode: "PERCENTAGE", riskPercent: 0.5 },
      openPositionsCount: 0,
      pendingOrdersCount: 0,
      exposureDataAuthoritative: true,
      allocationPercentage: 18,
      marketEvidenceStrength: "SUFFICIENT",
      profitProtection: null,
      capitalAllocationPercent: 50,
      requestedPerOrderAllocation: 200,
      reservedStrategyBudgetActive: 0,
    };
    const r = validateSimulationDraft(input);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.simulationOnly).toBe(true);
  });

  it("UI and service expose simulation data readiness", () => {
    const page = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(page).toMatch(/Order Allocation \(USD\)/);
    expect(page).toMatch(/placesOrders/);
    const svc = read("ai/forex-ai/automated-trading/service.ts");
    expect(svc).toMatch(/simulationDataReadiness/);
    expect(svc).toMatch(/evaluateSimulationDataReadiness/);
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toMatch(/EXECUTION_FORBIDDEN/);
    expect(api).toMatch(/requireForexAdmin/);
  });
});
