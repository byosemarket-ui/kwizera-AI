/**
 * Phase 56.2 — Simulation-only risk engine & XAU/USD draft validation.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import {
  AT_ALLOWED_PROVIDER_SYMBOL,
  AT_SIM_RISK_BANNER,
  defaultSimRiskPolicy,
  isInstrumentAllowlisted,
  normalizeInstrumentForAllowlist,
  resetAtSimRiskEngineForTests,
  resetAtSimRiskStoreForTests,
  validateSimulationDraft,
  getAtSimRiskEngine,
  type AtSimDraftInput,
  type AtSimRiskPolicy,
} from "../../../../ai/forex-ai/automated-trading/index.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function basePolicy(over: Partial<AtSimRiskPolicy> = {}): AtSimRiskPolicy {
  return { ...defaultSimRiskPolicy(), ...over };
}

function baseInput(over: Partial<AtSimDraftInput> = {}): AtSimDraftInput {
  return {
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
    takeProfit: 4140,
    requestedQuantity: null,
    quote: {
      bid: 4099.9,
      ask: 4100.1,
      entryPrice: 4100,
      entrySource: "test",
      fresh: true,
      freshnessReasonCode: "FRESH",
      quoteAgeMs: 100,
      observedAtUtc: new Date().toISOString(),
    },
    contract: {
      verified: true,
      pointSize: 0.01,
      tickSize: 0.01,
      digits: 2,
      quantityMin: 1,
      quantityStep: 1,
      quantityUnit: "lots",
      quantityUnitAmbiguous: false,
      contractMultiplier: 1,
      baseUnitSize: 1,
      pipCostAccount: 0.01,
      marginPerLotAccount: 4.79,
      minStopDistance: 0.5,
      minStopDistanceVerified: true,
      source: "test",
      unavailableReason: null,
    },
    account: {
      verified: true,
      accountIdMasked: "12••••34",
      accountCurrency: "USD",
      equity: 10_000,
      balance: 10_000,
      usableMargin: 8_000,
      usedMargin: 0,
      fetchedAtUtc: new Date().toISOString(),
      environment: "DEMO",
      unavailableReason: null,
    },
    sourceDecisionId: "dec-1",
    sourceAnalysisId: "an-1",
    sourceEvidenceFingerprint: "fp-test",
    sourceDecidedAtUtc: new Date().toISOString(),
    policy: basePolicy({ riskBudgetMode: "UNDECIDED", riskPercent: null }),
    openPositionsCount: 0,
    pendingOrdersCount: 0,
    exposureDataAuthoritative: true,
    allocationPercentage: null,
    marketEvidenceStrength: "SUFFICIENT",
    profitProtection: null,
    ...over,
  };
}

describe("Phase 56.2 allowlist", () => {
  it("accepts XAU/USD and XAUUSD forms only", () => {
    expect(isInstrumentAllowlisted("XAU/USD")).toBe(true);
    expect(isInstrumentAllowlisted("xauusd")).toBe(true);
    expect(isInstrumentAllowlisted("XAU-USD")).toBe(true);
    expect(isInstrumentAllowlisted("EUR/USD")).toBe(false);
    expect(isInstrumentAllowlisted("")).toBe(false);
    expect(normalizeInstrumentForAllowlist("XAU/USD")).toBe("XAUUSD");
    expect(AT_ALLOWED_PROVIDER_SYMBOL).toBe("XAU/USD");
  });
});

describe("Phase 56.2 BUY/SELL geometry", () => {
  it("passes valid BUY geometry structurally", () => {
    const r = validateSimulationDraft(baseInput({ direction: "BUY" }));
    expect(r.structuralOk).toBe(true);
    expect(r.slTpStatus).not.toBe("FAIL");
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.simulationOnly).toBe(true);
    expect(r.banner).toBe(AT_SIM_RISK_BANNER);
  });

  it("passes valid SELL geometry structurally", () => {
    const r = validateSimulationDraft(
      baseInput({
        direction: "SELL",
        entryPrice: 4100,
        stopLoss: 4120,
        takeProfit: 4060,
      }),
    );
    expect(r.structuralOk).toBe(true);
    expect(r.checks.some((c) => c.code === "SELL_GEOMETRY" && c.status === "PASS")).toBe(true);
  });

  it("rejects reversed SL/TP for BUY", () => {
    const r = validateSimulationDraft(
      baseInput({ direction: "BUY", stopLoss: 4120, takeProfit: 4080 }),
    );
    expect(r.overallStatus).toBe("REJECTED_LOCAL");
    expect(r.reasons.some((x) => x.code === "BUY_SL_NOT_BELOW_ENTRY")).toBe(true);
  });

  it("rejects missing SL and TP", () => {
    const missingSl = validateSimulationDraft(baseInput({ stopLoss: null }));
    expect(missingSl.reasons.some((x) => x.code === "SL_MISSING")).toBe(true);
    const missingTp = validateSimulationDraft(baseInput({ takeProfit: null }));
    expect(missingTp.reasons.some((x) => x.code === "TP_MISSING")).toBe(true);
  });

  it("rejects zero, negative, NaN, infinite prices", () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = validateSimulationDraft(baseInput({ entryPrice: bad }));
      expect(r.overallStatus).toBe("REJECTED_LOCAL");
      expect(r.reasons.some((x) => x.code === "ENTRY_INVALID")).toBe(true);
    }
  });

  it("rejects unsupported instrument from AI", () => {
    const r = validateSimulationDraft(baseInput({ instrument: "EUR/USD" }));
    expect(r.overallStatus).toBe("REJECTED_LOCAL");
    expect(r.reasons.some((x) => x.code === "INSTRUMENT_NOT_ALLOWLISTED")).toBe(true);
  });

  it("fails stale quote", () => {
    const r = validateSimulationDraft(
      baseInput({
        quote: {
          bid: 4100,
          ask: 4100.1,
          entryPrice: 4100,
          entrySource: "test",
          fresh: false,
          freshnessReasonCode: "STALE",
          quoteAgeMs: 60_000,
          observedAtUtc: new Date().toISOString(),
        },
      }),
    );
    expect(r.overallStatus).toBe("REJECTED_LOCAL");
    expect(r.reasons.some((x) => x.code === "QUOTE_STALE")).toBe(true);
  });

  it("enforces price increment when verified", () => {
    const r = validateSimulationDraft(
      baseInput({
        entryPrice: 4100.005,
        stopLoss: 4080,
        takeProfit: 4140,
      }),
    );
    expect(r.reasons.some((x) => x.code === "PRICE_INCREMENT")).toBe(true);
  });
});

describe("Phase 56.2 risk and quantity fail-closed", () => {
  it("blocks when risk percentage undecided", () => {
    const r = validateSimulationDraft(baseInput());
    expect(r.overallStatus).toBe("BLOCKED_POLICY_UNDECIDED");
    expect(r.riskBudgetStatus).toBe("BLOCKED");
    expect(r.proposedQuantity).toBeNull();
    expect(r.riskPercentConfigured).toBe(false);
  });

  it("blocks missing equity / margin", () => {
    const r = validateSimulationDraft(
      baseInput({
        account: {
          verified: false,
          accountIdMasked: null,
          accountCurrency: null,
          equity: null,
          balance: null,
          usableMargin: null,
          usedMargin: null,
          fetchedAtUtc: null,
          environment: "DEMO",
          unavailableReason: "test",
        },
      }),
    );
    expect(r.accountStatus).toBe("BLOCKED");
    expect(r.reasons.some((x) => x.code === "BLOCKED_ACCOUNT_DATA_UNAVAILABLE")).toBe(true);
  });

  it("blocks ambiguous quantity units (no invented ounces)", () => {
    const r = validateSimulationDraft(
      baseInput({
        contract: {
          verified: true,
          pointSize: 0.01,
          tickSize: 0.01,
          digits: 2,
          quantityMin: 1,
          quantityStep: 1,
          quantityUnit: "unknown",
          quantityUnitAmbiguous: true,
          contractMultiplier: 1,
          baseUnitSize: 1,
          pipCostAccount: 0.01,
          marginPerLotAccount: 4.79,
          minStopDistance: null,
          minStopDistanceVerified: false,
          source: "test",
          unavailableReason: "ounces unproven",
        },
      }),
    );
    expect(r.reasons.some((x) => x.code === "QUANTITY_UNIT_AMBIGUOUS")).toBe(true);
    expect(r.proposedQuantity).toBeNull();
  });

  it("blocks unverified minimum stop distance", () => {
    const r = validateSimulationDraft(
      baseInput({
        contract: {
          verified: true,
          pointSize: 0.01,
          tickSize: 0.01,
          digits: 2,
          quantityMin: 1,
          quantityStep: 1,
          quantityUnit: "lots",
          quantityUnitAmbiguous: false,
          contractMultiplier: 1,
          baseUnitSize: 1,
          pipCostAccount: 0.01,
          marginPerLotAccount: 4.79,
          minStopDistance: null,
          minStopDistanceVerified: false,
          source: "test",
          unavailableReason: null,
        },
      }),
    );
    expect(r.reasons.some((x) => x.code === "MIN_STOP_DISTANCE_UNVERIFIED")).toBe(true);
  });

  it("does not emit owner-approved quantity even when risk % hypothetically set without full gates", () => {
    const r = validateSimulationDraft(
      baseInput({
        policy: basePolicy({
          riskBudgetMode: "PERCENTAGE",
          riskPercent: 1,
        }),
        contract: {
          verified: true,
          pointSize: 0.01,
          tickSize: 0.01,
          digits: 2,
          quantityMin: 1,
          quantityStep: 1,
          quantityUnit: "unknown",
          quantityUnitAmbiguous: true,
          contractMultiplier: 1,
          baseUnitSize: 1,
          pipCostAccount: null,
          marginPerLotAccount: null,
          minStopDistance: 0.5,
          minStopDistanceVerified: true,
          source: "test",
          unavailableReason: null,
        },
      }),
    );
    expect(r.proposedQuantity).toBeNull();
    expect(String(r.proposedQuantityNote)).toMatch(/withheld|undecided|ambiguous|incomplete/i);
  });
});

describe("Phase 56.2 environment and safety", () => {
  it("supports DEMO and LIVE context without enabling LIVE execution", () => {
    const demo = validateSimulationDraft(baseInput({ environment: "DEMO" }));
    expect(demo.environment).toBe("DEMO");
    expect(demo.acceptsForExecution).toBe(false);

    const live = validateSimulationDraft(
      baseInput({
        environment: "LIVE",
        environmentMeta: {
          requested: "LIVE",
          actualSession: "LIVE",
          matches: true,
          environmentEpoch: 2,
          identityVerified: true,
          liveExecutionAuthorized: false,
        },
        account: {
          verified: true,
          accountIdMasked: "99••••01",
          accountCurrency: "USD",
          equity: 1,
          balance: 1,
          usableMargin: 1,
          usedMargin: 0,
          fetchedAtUtc: new Date().toISOString(),
          environment: "LIVE",
          unavailableReason: null,
        },
      }),
    );
    expect(live.environment).toBe("LIVE");
    expect(live.acceptsForExecution).toBe(false);
    expect(live.placesOrders).toBe(false);
    expect(live.checks.some((c) => c.code === "LIVE_EXECUTION_UNAUTHORIZED")).toBe(true);
  });

  it("fails mismatched environment", () => {
    const r = validateSimulationDraft(
      baseInput({
        environmentMeta: {
          requested: "DEMO",
          actualSession: "LIVE",
          matches: false,
          environmentEpoch: 1,
          identityVerified: true,
          liveExecutionAuthorized: false,
        },
      }),
    );
    expect(r.overallStatus).toBe("REJECTED_LOCAL");
    expect(r.reasons.some((x) => x.code === "ENVIRONMENT_MISMATCH")).toBe(true);
  });

  it("reaches VALIDATION_PASSED only with full verified inputs and configured risk", () => {
    const r = validateSimulationDraft(
      baseInput({
        policy: basePolicy({ riskBudgetMode: "PERCENTAGE", riskPercent: 0.5 }),
        // 56.2.2: monetary R/3R requires a quantity — still does not invent proposedQuantity.
        requestedQuantity: 1,
        allocationPercentage: 18,
        marketEvidenceStrength: "SUFFICIENT",
      }),
    );
    expect(r.overallStatus).toBe("VALIDATION_PASSED");
    expect(r.acceptsForExecution).toBe(false);
    expect(r.placesOrders).toBe(false);
    expect(r.proposedQuantity).toBeNull();
    expect(r.rewardRiskAnalysis.estimatedStopLossRisk).not.toBeNull();
  });
});

describe("Phase 56.2 persistence engine", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-sim-56-2-"));
    resetAtSimRiskEngineForTests();
    resetAtSimRiskStoreForTests();
  });
  afterEach(() => {
    resetAtSimRiskEngineForTests();
    resetAtSimRiskStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("persists draft with simulationOnly flags", async () => {
    const engine = getAtSimRiskEngine(tmp);
    const draft = await engine.validateAndPersist(baseInput());
    expect(draft.draftId).toBeTruthy();
    expect(engine.getLatest()?.draftId).toBe(draft.draftId);
    expect(engine.publicStatus().simulationOnly).toBe(true);
    expect(engine.publicStatus().placesOrders).toBe(false);
    expect(engine.publicStatus().acceptsForExecution).toBe(false);
    expect(engine.publicStatus().allowlist).toContain("XAU/USD");
  });
});

describe("Phase 56.2 source safety invariants", () => {
  it("API and UI keep execution forbidden and have no submit controls", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toMatch(/simulation-risk\/validate/);
    expect(api).toMatch(/simulationOnly:\s*true/);
    expect(api).toMatch(/EXECUTION_FORBIDDEN/);
    expect(api).not.toMatch(/createOrder|submitOrder|placesOrders:\s*true/);

    const ui = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(ui).toMatch(/data-fx-at-sim-risk/);
    expect(ui).toMatch(/Validate draft/);
    expect(ui).not.toMatch(/Submit order|Place order|Enable execution/i);

    const engine = read("ai/forex-ai/automated-trading/simulation-risk/engine.ts");
    expect(engine).toMatch(/placesOrders:\s*false/);
    expect(engine).toMatch(/acceptsForExecution:\s*false/);
    expect(engine).not.toMatch(/create_order|createOrder|placeOrder\s*\(/);
  });
});
