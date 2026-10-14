/**
 * Phase 45 — Deterministic position sizing & risk management.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FOREX_RISK_DEFAULT_SETTINGS,
  attachPositionRiskToPlan,
  calculatePositionRisk,
  contractSpecFromCryptoFilters,
  contractSpecFromForexConnectMetadata,
  floorToStep,
  getForexRiskSettingsService,
  resetForexRiskSettingsServiceForTests,
  resolveConversionRate,
  unavailableContractSpec,
  validateForexRiskSettingsPatch,
  type ForexRiskSettings,
  type InstrumentContractSpec,
} from "../../../../ai/forex-ai/position-sizing/index.ts";
import type { SnapshotTradePlan as Plan } from "../../../../ai/forex-ai/snapshot-plans/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function fxPipCostSpec(): InstrumentContractSpec {
  return {
    instrumentId: "EUR/USD",
    provider: "FOREXCONNECT",
    quoteCurrency: "USD",
    contractCurrency: "USD",
    convention: "fx_pip_cost_lot",
    pointSize: 0.0001,
    pipCostAccount: 10, // $10 per pip per lot in USD account
    baseUnitSize: 100_000,
    contractMultiplier: 1,
    quantityMin: 0.01,
    quantityMax: 50,
    quantityStep: 0.01,
    quantityUnit: "lots",
    tickSize: 0.0001,
    marginRate: 0.0333,
    verified: true,
    source: "fixture",
    unavailableReason: null,
    observedAt: "2026-10-14T12:00:00.000Z",
  };
}

function settings(partial: Partial<ForexRiskSettings> = {}): ForexRiskSettings {
  return {
    ...FOREX_RISK_DEFAULT_SETTINGS,
    accountCurrency: "USD",
    manualBalance: 10_000,
    riskBudgetMode: "percentage",
    riskPercent: 1,
    minRewardRiskRatio: 1.5,
    calculationMode: "risk_budget_first",
    ...partial,
  };
}

function basePlan(overrides: Partial<Plan> = {}): Plan {
  return {
    schemaVersion: "forex-snapshot-trade-plans-v1",
    planId: "plan-1",
    planKind: "PULLBACK",
    version: 1,
    analysisProvider: "OPENAI",
    analysisId: "a1",
    snapshotId: "s1",
    contentFingerprint: "fp",
    instrument: "EUR/USD",
    candleTimeframe: "15m",
    analysisPeriod: "6h",
    marketDirection: "BULLISH",
    intent: "BUY",
    lifecycle: "PLAN_CREATED",
    lifecycleNote: "ok",
    entryZone: {
      lower: 1.1,
      upper: 1.1,
      reference: 1.1,
      rationale: "ref",
      unavailableReason: null,
    },
    confirmationRequired: [],
    confirmationStatus: "NOT_STARTED",
    stopLoss: { price: 1.09, rationale: "sl", unavailableReason: null },
    takeProfit: { prices: [1.12], rationale: "tp", unavailableReason: null },
    invalidationConditions: [],
    expiryConditions: [],
    riskReward: { ratio: 2, risk: 0.01, reward: 0.02, unavailableReason: null },
    spreadNote: null,
    dataQualityLimitations: [],
    unsuitableReasons: [],
    createdAt: "2026-10-14T12:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 45 decimal helpers", () => {
  it("rounds quantity DOWN to step and never up", () => {
    expect(floorToStep(1.019, 0.01)).toBe(1.01);
    expect(floorToStep(0.019, 0.01)).toBe(0.01);
    expect(floorToStep(0.009, 0.01)).toBe(0);
  });
});

describe("Phase 45 contract specs", () => {
  it("refuses incomplete ForexConnect metadata", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "EUR/USD",
      metadata: { contractCurrency: "USD" },
    });
    expect(spec.verified).toBe(false);
    expect(spec.unavailableReason).toMatch(/incomplete/i);
  });

  it("accepts verified pip-cost ForexConnect fields", () => {
    const spec = contractSpecFromForexConnectMetadata({
      instrumentId: "EUR/USD",
      metadata: { pointSize: 0.0001, pipCost: 10, quoteAsset: "USD" },
      quoteCurrency: "USD",
    });
    expect(spec.verified).toBe(true);
    expect(spec.convention).toBe("fx_pip_cost_lot");
  });

  it("builds crypto specs only from verified filters", () => {
    const ok = contractSpecFromCryptoFilters({
      instrumentId: "BTC/USDT",
      quoteCurrency: "USDT",
      stepSize: 0.00001,
      minQty: 0.00001,
    });
    expect(ok.verified).toBe(true);
    expect(ok.convention).toBe("crypto_base_qty");
    const bad = contractSpecFromCryptoFilters({
      instrumentId: "BTC/USDT",
      quoteCurrency: "USDT",
      stepSize: 0,
      minQty: 0.001,
    });
    expect(bad.verified).toBe(false);
  });
});

describe("Phase 45 conversion", () => {
  it("supports direct, inverse, and rejects stale quotes", () => {
    const now = Date.parse("2026-10-14T12:00:00.000Z");
    const direct = resolveConversionRate({
      fromCurrency: "EUR",
      toCurrency: "USD",
      maxAgeMs: 60_000,
      nowMs: now,
      quotes: [{
        base: "EUR",
        quote: "USD",
        bid: 1.1,
        ask: 1.1002,
        source: "offers",
        observedAt: "2026-10-14T11:59:30.000Z",
      }],
    });
    expect(direct.ok).toBe(true);
    if (direct.ok) expect(direct.quote.rate).toBeCloseTo(1.1001, 4);

    const inverse = resolveConversionRate({
      fromCurrency: "USD",
      toCurrency: "EUR",
      maxAgeMs: 60_000,
      nowMs: now,
      quotes: [{
        base: "EUR",
        quote: "USD",
        bid: 1.1,
        ask: 1.1,
        source: "offers",
        observedAt: "2026-10-14T11:59:30.000Z",
      }],
    });
    expect(inverse.ok).toBe(true);
    if (inverse.ok) {
      expect(inverse.quote.inverted).toBe(true);
      expect(inverse.quote.rate).toBeCloseTo(1 / 1.1, 6);
    }

    const stale = resolveConversionRate({
      fromCurrency: "EUR",
      toCurrency: "USD",
      maxAgeMs: 1_000,
      nowMs: now,
      quotes: [{
        base: "EUR",
        quote: "USD",
        bid: 1.1,
        ask: 1.1,
        source: "offers",
        observedAt: "2026-10-14T11:00:00.000Z",
      }],
    });
    expect(stale.ok).toBe(false);
  });
});

describe("Phase 45 risk-budget-first / size-first", () => {
  it("sizes long FX with pip-cost and rounds down to step", () => {
    // stop 100 pips, pipCost $10 → $1000 / lot; budget $100 → 0.1 lot
    const result = calculatePositionRisk({
      settings: settings({ riskPercent: 1, manualBalance: 10_000 }),
      contract: fxPipCostSpec(),
      side: "BUY",
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.12,
    });
    expect(result.riskBudgetAccount).toBe(100);
    expect(result.stopDistancePoints).toBeCloseTo(100, 6);
    expect(result.positionSize).toBe(0.1);
    expect(result.netLossAccount).toBeCloseTo(100, 6);
    expect(result.rewardRiskRatio).toBeGreaterThanOrEqual(1.5);
    expect(result.riskEligible).toBe(true);
  });

  it("handles short side and rejects invalid SL side", () => {
    const ok = calculatePositionRisk({
      settings: settings(),
      contract: fxPipCostSpec(),
      side: "SELL",
      entryPrice: 1.1,
      stopLoss: 1.11,
      takeProfit: 1.08,
    });
    expect(ok.riskEligible).toBe(true);

    const bad = calculatePositionRisk({
      settings: settings(),
      contract: fxPipCostSpec(),
      side: "SELL",
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.08,
    });
    expect(bad.riskEligible).toBe(false);
    expect(bad.blockingReasons.join(" ")).toMatch(/above entry/i);
  });

  it("size-first marks excess when proposed size breaches budget", () => {
    const result = calculatePositionRisk({
      settings: settings({ calculationMode: "size_first", proposedSize: 1 }),
      contract: fxPipCostSpec(),
      side: "BUY",
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.12,
      proposedSize: 1,
      calculationMode: "size_first",
    });
    expect(result.positionSize).toBe(1);
    expect(result.excessRiskAccount).toBeGreaterThan(0);
    expect(result.maxPermissibleSize).toBe(0.1);
    expect(result.riskEligible).toBe(false);
    expect(result.blockingReasons.join(" ")).toMatch(/exceeds risk budget/i);
  });

  it("enforces minimum R:R", () => {
    const result = calculatePositionRisk({
      settings: settings({ minRewardRiskRatio: 3 }),
      contract: fxPipCostSpec(),
      side: "BUY",
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.115, // 1.5R only
    });
    expect(result.riskEligible).toBe(false);
    expect(result.blockingReasons.join(" ")).toMatch(/below minimum/i);
  });

  it("blocks when contract metadata missing", () => {
    const result = calculatePositionRisk({
      settings: settings(),
      contract: unavailableContractSpec("XAU/USD", "FOREXCONNECT", "No verified ounce multiplier."),
      side: "BUY",
      entryPrice: 2000,
      stopLoss: 1990,
      takeProfit: 2030,
    });
    expect(result.riskEligible).toBe(false);
    expect(result.blockingReasons[0]).toMatch(/ounce|verified|incomplete|No verified/i);
  });

  it("crypto base qty with conversion to account currency", () => {
    const contract = contractSpecFromCryptoFilters({
      instrumentId: "BTC/USDT",
      quoteCurrency: "USDT",
      stepSize: 0.001,
      minQty: 0.001,
      tickSize: 0.01,
      observedAt: "2026-10-14T12:00:00.000Z",
    });
    const result = calculatePositionRisk({
      settings: settings({
        accountCurrency: "USD",
        manualBalance: 10_000,
        riskPercent: 1,
      }),
      contract,
      side: "BUY",
      entryPrice: 50_000,
      stopLoss: 49_000,
      takeProfit: 53_000,
      conversionQuotes: [{
        base: "USDT",
        quote: "USD",
        bid: 1,
        ask: 1,
        source: "fixture",
        observedAt: "2026-10-14T12:00:00.000Z",
      }],
      nowMs: Date.parse("2026-10-14T12:00:00.000Z"),
    });
    // $100 budget / $1000 per 1 BTC = 0.1 → step 0.001 → 0.1
    expect(result.positionSize).toBeCloseTo(0.1, 6);
    expect(result.riskEligible).toBe(true);
  });

  it("fixed risk amount mode", () => {
    const result = calculatePositionRisk({
      settings: settings({
        riskBudgetMode: "fixed",
        riskFixedAmount: 50,
      }),
      contract: fxPipCostSpec(),
      side: "BUY",
      entryPrice: 1.1,
      stopLoss: 1.09,
      takeProfit: 1.12,
    });
    expect(result.riskBudgetAccount).toBe(50);
    expect(result.positionSize).toBe(0.05);
  });
});

describe("Phase 45 plan eligibility gates", () => {
  it("keeps UNSUITABLE plans risk-ineligible even when size calculates", () => {
    const plan = basePlan({ intent: "UNSUITABLE", unsuitableReasons: ["structure"] });
    const withRisk = attachPositionRiskToPlan(plan, {
      settings: settings(),
      contract: fxPipCostSpec(),
    });
    expect(withRisk.positionRisk?.positionSize).toBeGreaterThan(0);
    expect(withRisk.positionRisk?.riskEligible).toBe(false);
    expect(withRisk.positionRisk?.blockingReasons.join(" ")).toMatch(/UNSUITABLE/);
    expect(withRisk.intent).toBe("UNSUITABLE");
  });
});

describe("Phase 45 settings validation + persistence", () => {
  afterEach(() => {
    resetForexRiskSettingsServiceForTests();
  });

  it("rejects invalid currency and percent", () => {
    expect(validateForexRiskSettingsPatch({ accountCurrency: "US" }).ok).toBe(false);
    expect(validateForexRiskSettingsPatch({ riskPercent: 0 }).ok).toBe(false);
    expect(validateForexRiskSettingsPatch({ riskPercent: 1.5, accountCurrency: "USD" }).ok).toBe(true);
  });

  it("persists settings without secrets", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "fx-risk-45-"));
    const store = getForexRiskSettingsService(dir);
    const updated = await store.updateSettings({
      accountCurrency: "USD",
      manualBalance: 5000,
      riskPercent: 0.75,
    });
    expect("error" in updated).toBe(false);
    if (!("error" in updated)) {
      expect(updated.settings.accountCurrency).toBe("USD");
      expect(updated.settings.manualBalance).toBe(5000);
      expect(JSON.stringify(updated.settings)).not.toMatch(/sk-/);
    }
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("Phase 45 wiring", () => {
  it("wires risk API, admin panel, enrich path, and FC offer fields", () => {
    const api = read("dev/server/forex-risk-api.ts");
    const index = read("dev/server/index.ts");
    const admin = read("desktop/forex-admin/ForexAdminRiskSettingsPanel.tsx");
    const panels = read("desktop/forex/SnapshotAiResultPanels.tsx");
    const sidecar = read("services/forexconnect-sidecar/server.py");
    const openaiEngine = read("ai/forex-ai/snapshot-openai/engine.ts");
    expect(api).toContain("/api/forex-admin/risk-settings");
    expect(api).toContain("/api/forex/risk/calculate");
    expect(api).toContain("requireForexAdmin");
    expect(index).toContain("handleForexRiskApi");
    expect(admin).toContain("data-forex-admin-risk-settings");
    expect(panels).toContain("data-plan-risk");
    expect(sidecar).toContain("pointSize");
    expect(sidecar).toContain("pipCost");
    expect(openaiEngine).toContain("enrichAnalysisWithPositionRisk");
    expect(api).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
  });
});
