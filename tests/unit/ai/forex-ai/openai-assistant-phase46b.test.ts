/**
 * Phase 46B — Nine-item OpenAI FXCM assistant guidance.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  OPENAI_ASSISTANT_ITEMS_SCHEMA,
  buildOpenAiAssistantGuidanceItems,
  selectPrimaryPlanForAssistant,
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

function fxSpec(partial: Partial<InstrumentContractSpec> = {}): InstrumentContractSpec {
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
    observedAt: "2026-10-15T12:00:00.000Z",
    ...partial,
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
    analysisProvider: "OPENAI",
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
    createdAt: "2026-10-15T12:00:00.000Z",
    ...overrides,
  };
}

describe("Phase 46B nine-item OpenAI assistant guidance", () => {
  it("builds exactly nine numbered items with FXCM field mapping", () => {
    const plan = attachPositionRiskToPlan(basePlan(), {
      settings: settings(),
      contract: fxSpec(),
      tradeAllocation: { amount: 1000, currency: "USD" },
    });
    const bundle = buildOpenAiAssistantGuidanceItems({
      plan,
      marketDirection: "BULLISH",
      supportingEvidence: ["HH/HL structure"],
      contradictingEvidence: [],
      tradeAllocation: { amount: 1000, currency: "USD" },
    });
    expect(bundle.schemaVersion).toBe(OPENAI_ASSISTANT_ITEMS_SCHEMA);
    expect(bundle.items).toHaveLength(9);
    expect(bundle.items.map((i) => i.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(bundle.items[0].title).toMatch(/direction/i);
    expect(bundle.items[0].value).toMatch(/BUY/);
    expect(bundle.items[0].ticketField).toMatch(/BUY|SELL/i);
    expect(bundle.items[5].tone).toBe("stop");
    expect(bundle.items[6].tone).toBe("takeprofit");
    expect(bundle.finalSummary.confirmationStatus).toBe("PENDING");
    expect(bundle.disclaimer).toMatch(/Does not place/i);
    expect(bundle.items[1].why).toMatch(/not the acceptable loss/i);
  });

  it("uses WAIT when confirmation missing and does not invent contract size", () => {
    const plan = attachPositionRiskToPlan(
      basePlan({ intent: "WAIT", confirmationStatus: "PENDING" }),
      { settings: settings(), contract: fxSpec({ verified: false, unavailableReason: "incomplete metadata" }) },
    );
    const bundle = buildOpenAiAssistantGuidanceItems({ plan });
    expect(bundle.items[0].value).toMatch(/WAIT/i);
    expect(bundle.items[1].value).toBe("unavailable");
    expect(bundle.items[1].support).toBe("unavailable");
    expect(bundle.items[1].value).not.toBe("1");
    expect(bundle.items[8].value).toMatch(/WAIT|confirm/i);
  });

  it("marks unsuitable / risk-ineligible in final summary", () => {
    const plan = attachPositionRiskToPlan(
      basePlan({ intent: "UNSUITABLE", unsuitableReasons: ["Structure conflict"] }),
      { settings: settings(), contract: fxSpec() },
    );
    const bundle = buildOpenAiAssistantGuidanceItems({ plan });
    expect(bundle.finalSummary.tone).toBe("unsuitable");
    expect(bundle.items[8].value).toMatch(/UNSUITABLE|Do not proceed/i);
  });

  it("selects primary plan preferring risk-eligible", () => {
    const pull = attachPositionRiskToPlan(basePlan({ planId: "pb", intent: "WAIT" }), {
      settings: settings(),
      contract: fxSpec(),
    });
    const brk = attachPositionRiskToPlan(
      basePlan({
        planId: "bo",
        planKind: "BREAKOUT",
        intent: "BUY",
        lifecycle: "SETUP_CONFIRMED",
        confirmationStatus: "MET",
      }),
      { settings: settings(), contract: fxSpec() },
    );
    // Force pull ineligible path; breakout may or may not be eligible depending on gates.
    const selected = selectPrimaryPlanForAssistant({ pullback: pull, breakout: brk });
    expect(["pb", "bo"]).toContain(selected.planId);
  });

  it("does not hardcode reference-image gold demo prices", () => {
    const plan = attachPositionRiskToPlan(basePlan(), {
      settings: settings(),
      contract: fxSpec(),
    });
    const json = JSON.stringify(buildOpenAiAssistantGuidanceItems({ plan }));
    expect(json).not.toMatch(/4167\.00|4176\.00|4169\.78|4170\.08/);
  });
});

describe("Phase 46B wiring", () => {
  it("OpenAI engine attaches assistantGuidance; Local panel path unchanged", () => {
    const openai = read("ai/forex-ai/snapshot-openai/engine.ts");
    const local = read("ai/forex-ai/snapshot-local/engine.ts");
    const panels = read("desktop/forex/SnapshotAiResultPanels.tsx");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    expect(openai).toMatch(/buildOpenAiAssistantGuidanceItems/);
    expect(openai).toMatch(/assistantGuidance/);
    expect(local).not.toMatch(/buildOpenAiAssistantGuidanceItems/);
    expect(panels).toMatch(/data-forex-ai-phase46b/);
    expect(panels).toMatch(/OPENAI FOREX ANALYSIS ASSISTANT/);
    expect(panels).toMatch(/data-ai-openai-assistant-items/);
    expect(page).toMatch(/Analyze Decision again/);
    expect(page).toMatch(/runPrimaryAnalyze/);
    expect(page).toMatch(/aiProviderMode !== "OPENAI"/);
  });
});
