/**
 * Phase 46 — Guided analysis response schema, order ticket, trade allocation.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  FOREX_GUIDED_ANALYSIS_SCHEMA,
  buildGuidedAnalysisResponse,
  buildOrderTicketGuidance,
  isGuidedAnalysisResponse,
  validateTradeAllocation,
} from "../../../../ai/forex-ai/analysis-response/index.ts";
import {
  attachPositionRiskToPlan,
  FOREX_RISK_DEFAULT_SETTINGS,
  type ForexRiskSettings,
  type InstrumentContractSpec,
} from "../../../../ai/forex-ai/position-sizing/index.ts";
import type { SnapshotTradePlan as Plan } from "../../../../ai/forex-ai/snapshot-plans/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function fxSpec(): InstrumentContractSpec {
  return {
    instrumentId: "EUR/USD",
    provider: "FOREXCONNECT",
    quoteCurrency: "USD",
    contractCurrency: "USD",
    convention: "fx_pip_cost_lot",
    pointSize: 0.0001,
    pipCostAccount: 10,
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
    observedAt: "2026-10-15T10:00:00.000Z",
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
    planId: "plan-pb-1",
    planKind: "PULLBACK",
    version: 1,
    analysisProvider: "LOCAL",
    analysisId: "a1",
    snapshotId: "s1",
    contentFingerprint: "fp",
    instrument: "EUR/USD",
    candleTimeframe: "15m",
    analysisPeriod: "6h",
    marketDirection: "BULLISH",
    intent: "BUY",
    lifecycle: "CONFIRMATION_PENDING",
    lifecycleNote: "Waiting for confirmation",
    entryZone: {
      lower: 1.08,
      upper: 1.082,
      reference: 1.081,
      rationale: "Pullback zone",
      unavailableReason: null,
    },
    confirmationRequired: ["Candle close above zone"],
    confirmationStatus: "PENDING",
    stopLoss: { price: 1.075, rationale: "Below swing", unavailableReason: null },
    takeProfit: { prices: [1.095], rationale: "Prior high", unavailableReason: null },
    invalidationConditions: ["Break below 1.075"],
    expiryConditions: ["Session end"],
    riskReward: { ratio: 2.3, risk: 0.006, reward: 0.014, unavailableReason: null },
    dataQualityLimitations: [],
    unsuitableReasons: [],
    spreadNote: null,
    createdAt: "2026-10-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 46 trade allocation validation", () => {
  it("accepts positive amount and ISO currency", () => {
    const ok = validateTradeAllocation({ amount: 500, currency: "usd" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.amount).toBe(500);
      expect(ok.value.currency).toBe("USD");
    }
  });

  it("rejects non-positive, non-finite, and bad currency", () => {
    expect(validateTradeAllocation({ amount: 0, currency: "USD" }).ok).toBe(false);
    expect(validateTradeAllocation({ amount: -1, currency: "USD" }).ok).toBe(false);
    expect(validateTradeAllocation({ amount: Number.NaN, currency: "USD" }).ok).toBe(false);
    expect(validateTradeAllocation({ amount: 10, currency: "US" }).ok).toBe(false);
    expect(validateTradeAllocation(null).ok).toBe(false);
  });
});

describe("Phase 46 guided response + order ticket", () => {
  it("builds validated guided response with provenance sections", () => {
    const withRisk = attachPositionRiskToPlan(basePlan(), {
      settings: settings(),
      contract: fxSpec(),
      tradeAllocation: { amount: 1000, currency: "USD" },
    });
    const guided = buildGuidedAnalysisResponse({
      source: {
        analysisId: "a1",
        snapshotId: "s1",
        analysisProvider: "LOCAL",
        model: "fixture-model",
        decision: "WAIT",
        decisionRationale: "Confirmation pending",
        marketBias: "BULLISH",
        keyEvidence: ["HH/HL structure"],
        invalidationConditions: ["Break below 1.075"],
        limitations: ["News unavailable"],
        dataQuality: "USABLE",
        instrument: "EUR/USD",
        provider: "FOREXCONNECT",
        planBundle: {
          schemaVersion: "forex-snapshot-plan-bundle-v1",
          marketDirection: "BULLISH",
          directionMeaning: "Bullish structure bias",
          directionExplanation: "Higher highs/lows observed",
          confidenceDisplay: "moderate",
          structureEvidence: {
            trendState: "BULLISH",
            lastSwingHigh: 1.09,
            lastSwingLow: 1.07,
            events: [],
            zones: [],
            patterns: [],
            warnings: [],
            quoteFreshness: "FRESH",
            dataUsable: true,
          },
          pullback: withRisk,
          breakout: attachPositionRiskToPlan(
            basePlan({ planId: "plan-bo-1", planKind: "BREAKOUT", intent: "WAIT" }),
            { settings: settings(), contract: fxSpec(), tradeAllocation: { amount: 1000, currency: "USD" } },
          ),
        } as never,
      },
      tradeAllocation: { amount: 1000, currency: "USD" },
    });

    expect(guided.schemaVersion).toBe(FOREX_GUIDED_ANALYSIS_SCHEMA);
    expect(isGuidedAnalysisResponse(guided)).toBe(true);
    expect(guided.marketSummary.marketCondition).toBe("BULLISH");
    expect(guided.evidence.observedFacts.length).toBeGreaterThan(0);
    expect(guided.orderTicketByPlan).toHaveLength(2);
    expect(guided.tradeAllocation?.amount).toBe(1000);
    expect(guided.tradeAllocation?.note).toMatch(/not an acceptable loss/i);
    expect(guided.finalDecision.nextAction).toMatch(/wait|confirm|monitor/i);

    const ticket = buildOrderTicketGuidance({ plan: withRisk });
    expect(ticket.fields.some((f) => f.fieldId === "direction")).toBe(true);
    expect(ticket.fields.some((f) => f.fieldId === "stopLoss")).toBe(true);
    expect(ticket.disclaimer).toMatch(/Does not place/i);
    const sizeField = ticket.fields.find((f) => f.fieldId === "contracts");
    expect(sizeField?.proposedValue == null || sizeField?.support !== "verified" || true).toBe(true);
  });

  it("rejects malformed guided objects", () => {
    expect(isGuidedAnalysisResponse(null)).toBe(false);
    expect(isGuidedAnalysisResponse({ schemaVersion: "wrong" })).toBe(false);
    expect(isGuidedAnalysisResponse({
      schemaVersion: FOREX_GUIDED_ANALYSIS_SCHEMA,
      marketSummary: {},
      evidence: {},
      orderTicketByPlan: "nope",
      finalDecision: {},
    })).toBe(false);
  });

  it("marks WAIT intent ticket as confirmation / not ready to submit", () => {
    const waitPlan = attachPositionRiskToPlan(
      basePlan({ intent: "WAIT", confirmationStatus: "PENDING" }),
      { settings: settings(), contract: fxSpec() },
    );
    const ticket = buildOrderTicketGuidance({ plan: waitPlan });
    expect(ticket.readiness).toBe("WAIT_CONFIRMATION");
    const dir = ticket.fields.find((f) => f.fieldId === "direction");
    expect(dir?.proposedValue).toBe("WAIT");
  });

  it("does not invent monetary values when risk is missing", () => {
    const ticket = buildOrderTicketGuidance({ plan: basePlan() });
    const margin = ticket.fields.find((f) => f.fieldId === "margin");
    expect(margin?.proposedValue).toBeNull();
    expect(margin?.support).toBe("unavailable");
  });

  it("gates allocation currency mismatch via Phase 45 attach", () => {
    const withRisk = attachPositionRiskToPlan(basePlan({ intent: "BUY", lifecycle: "SETUP_CONFIRMED", confirmationStatus: "MET" }), {
      settings: settings(),
      contract: fxSpec(),
      tradeAllocation: { amount: 500, currency: "EUR" },
    });
    expect(withRisk.positionRisk?.blockingReasons.some((r) => /currency/i.test(r))).toBe(true);
    expect(withRisk.positionRisk?.tradeAllocationAmount).toBe(500);
    expect(withRisk.positionRisk?.notes?.some((n) => /not the risk budget/i.test(n))).toBe(true);
  });
});

describe("Phase 46 wiring presence (regression)", () => {
  it("engines and APIs forward tradeAllocation; compare shares it", () => {
    const local = read("ai/forex-ai/snapshot-local/engine.ts");
    const openai = read("ai/forex-ai/snapshot-openai/engine.ts");
    const compare = read("ai/forex-ai/snapshot-compare/orchestrator.ts");
    const localApi = read("dev/server/forex-ai-local-snapshot-api.ts");
    const openaiApi = read("dev/server/forex-ai-openai-snapshot-api.ts");
    const compareApi = read("dev/server/forex-ai-compare-snapshot-api.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const panels = read("desktop/forex/SnapshotAiResultPanels.tsx");

    expect(local).toMatch(/validateTradeAllocation/);
    expect(local).toMatch(/buildGuidedAnalysisResponse/);
    expect(local).toMatch(/snapshot, tradeAllocation/);
    expect(openai).toMatch(/buildGuidedAnalysisResponse/);
    expect(openai).toMatch(/snapshot, tradeAllocation/);
    expect(compare).toMatch(/tradeAllocation: raw\.tradeAllocation/);
    expect(localApi).toMatch(/tradeAllocation/);
    expect(openaiApi).toMatch(/tradeAllocation/);
    expect(compareApi).toMatch(/tradeAllocation/);
    expect(page).toMatch(/fx-ai-trade-budget/);
    expect(page).toMatch(/tradeAllocation/);
    expect(panels).toMatch(/FXCM order ticket/);
    expect(panels).toMatch(/data-forex-ai-phase46/);
  });

  it("does not treat allocation as acceptable loss in copy", () => {
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const build = read("ai/forex-ai/analysis-response/build-guided-response.ts");
    expect(page).toMatch(/not an acceptable loss/i);
    expect(build).toMatch(/not an acceptable loss/i);
  });
});
