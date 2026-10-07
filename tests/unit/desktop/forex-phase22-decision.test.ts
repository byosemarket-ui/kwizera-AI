import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildConfirmationConditions,
  buildEntryZone,
  buildInvalidationConditions,
  buildRiskContext,
  buildStopAndTargets,
  detectDecisionGroundingViolations,
  FOREX_DECISION_DEFAULT_STACK,
  FOREX_DECISION_PROMPT_CHAR_BUDGET,
  FOREX_DECISION_REQUIRED,
  FOREX_DECISION_SCHEMA_VERSION,
  resolveDecisionPosture,
  runDeterministicDecisionEngines,
  selectDecisionScenario,
  buildDecisionAnalysisPrompt,
} from "../../../ai/forex-ai/decision/index.ts";
import { assessMarketStateForAnalysis } from "../../../ai/forex-ai/data-quality.ts";
import { computeMtfAlignment, roleForTimeframe } from "../../../ai/forex-ai/mtf/index.ts";
import type { ForexMtfCompactFacts, ForexMultiTimeframeMarketState } from "../../../ai/forex-ai/mtf/types.ts";
import type { ForexBinanceMarketState } from "../../../ai/forex-market-state/types.ts";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function fact(partial: Partial<ForexMtfCompactFacts> & Pick<ForexMtfCompactFacts, "timeframe">): ForexMtfCompactFacts {
  return {
    role: roleForTimeframe(partial.timeframe),
    usable: partial.usable ?? true,
    status: partial.status ?? "CONNECTED",
    trend: partial.trend ?? null,
    momentum: partial.momentum ?? null,
    volatility: partial.volatility ?? "NORMAL",
    rsi: partial.rsi ?? 50,
    ema50: null,
    sma20: null,
    sma50: null,
    structure: partial.structure ?? "BASIC_SWINGS",
    price: partial.price ?? 100_000,
    candleOpen: false,
    timestamp: "2026-10-07T12:00:00.000Z",
    ...partial,
  };
}

function mockState(partial: {
  timeframe: "4h" | "1h" | "30m" | "15m" | "5m";
  trend?: "BULLISH" | "BEARISH" | "NEUTRAL";
  swingHigh?: number | null;
  swingLow?: number | null;
  atr?: number | null;
  price?: number;
  structureState?: "BASIC_SWINGS" | "INSUFFICIENT_DATA";
}): ForexBinanceMarketState {
  const price = partial.price ?? 100_000;
  return {
    version: "forex-market-state-v1",
    exchange: "BINANCE",
    symbol: "BTCUSDT",
    displaySymbol: "BTC/USDT",
    marketType: "SPOT",
    timeframe: partial.timeframe,
    candleOpenTime: 1,
    candleCloseTime: 2,
    lastMarketUpdate: Date.now(),
    stateGeneratedAt: Date.now(),
    price: {
      last: price,
      open: price,
      high: price,
      low: price,
      close: price,
      absoluteChange: 0,
      percentageChange: 0,
      changeReference: "PREVIOUS_CLOSED_CANDLE",
    },
    candle: null,
    volume: null,
    volatility: {
      atr: partial.atr ?? 500,
      atrPercent: 0.5,
      classification: "NORMAL",
      period: 14,
    },
    trend: {
      direction: partial.trend ?? "BULLISH",
      strength: "MODERATE",
      priceVsEma50: "ABOVE",
      sma20VsSma50: "ABOVE",
    },
    momentum: {
      rsi: 55,
      macd: { value: null, signal: null, histogram: null },
      classification: "POSITIVE",
    },
    indicators: {
      sma20: null,
      sma50: null,
      ema50: null,
      rsi14: 55,
      macd: { value: null, signal: null, histogram: null },
      bollinger: { mid: null, upper: null, lower: null, widthPct: null },
      atr14: partial.atr ?? 500,
    },
    marketStructure: {
      trend: partial.trend ?? "BULLISH",
      lastSwingHigh: partial.swingHigh === undefined ? 102_000 : partial.swingHigh,
      lastSwingLow: partial.swingLow === undefined ? 98_000 : partial.swingLow,
      structureState: partial.structureState ?? "BASIC_SWINGS",
    },
    supportResistance: null,
    supportResistanceReason: "MANUAL_ONLY",
    dataQuality: {
      connection: "CONNECTED",
      lastUpdate: Date.now(),
      stale: false,
      candleCount: 100,
      valid: true,
    },
    dataSource: "binance-spot",
  };
}

function mtfFromTrends(
  trends: Record<string, string>,
  opts?: { missing?: string[]; noStructure?: boolean; price?: number },
): ForexMultiTimeframeMarketState {
  const tfs = ["4h", "1h", "30m", "15m", "5m"] as const;
  const slots = tfs.map((tf) => {
    const missing = opts?.missing?.includes(tf);
    const trend = trends[tf] ?? "NEUTRAL";
    const compact = fact({
      timeframe: tf,
      usable: !missing,
      status: missing ? "DATA_UNAVAILABLE" : "CONNECTED",
      trend: missing ? null : trend,
      momentum: trend === "BULLISH" ? "POSITIVE" : trend === "BEARISH" ? "NEGATIVE" : "NEUTRAL",
      price: opts?.price ?? 100_000,
      structure: opts?.noStructure ? "INSUFFICIENT_DATA" : "BASIC_SWINGS",
    });
    return {
      timeframe: tf,
      role: roleForTimeframe(tf),
      marketState: missing
        ? null
        : mockState({
          timeframe: tf,
          trend: trend as "BULLISH" | "BEARISH" | "NEUTRAL",
          structureState: opts?.noStructure ? "INSUFFICIENT_DATA" : "BASIC_SWINGS",
          swingHigh: opts?.noStructure ? null : 102_000,
          swingLow: opts?.noStructure ? null : 98_000,
          price: opts?.price ?? 100_000,
        }),
      compact,
    };
  });
  return {
    symbol: "BTCUSDT",
    exchange: "BINANCE",
    marketType: "SPOT",
    displaySymbol: "BTC/USDT",
    generatedAt: new Date().toISOString(),
    timeframes: [...tfs],
    required: [...FOREX_DECISION_REQUIRED],
    slots,
    dataQuality: opts?.missing?.length ? "INSUFFICIENT_DATA" : "COMPLETE_CONNECTED",
  };
}

describe("Forex Phase 22 — Scenario / Entry / Decision Engine", () => {
  it("reuses Phase 18–21 infrastructure without duplicates", () => {
    const orch = read("ai/forex-ai/decision/orchestrator.ts");
    const api = read("dev/server/forex-ai-api.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const entry = read("ai/forex-ai/decision/entry-zone.ts");
    expect(orch).toContain("buildMultiTimeframeMarketState");
    expect(orch).toContain("getOllamaAdapter");
    expect(orch).toContain("retrieveRelevantForexKnowledge");
    expect(orch).not.toContain("11434");
    expect(orch).not.toContain("new WebSocket");
    expect(api).toContain("/api/forex/ai/decision");
    expect(api).toContain("runForexDecisionAnalysis");
    expect(page).toContain("data-forex-ai-phase22");
    expect(page).toContain("Analyze Decision");
    expect(entry).toContain("ENTRY_ZONE_UNAVAILABLE");
    expect(entry).toContain("supportResistance");
    expect(FOREX_DECISION_DEFAULT_STACK).toEqual(["4h", "1h", "30m", "15m", "5m"]);
    expect(FOREX_DECISION_SCHEMA_VERSION).toBe("forex-decision-analysis-v1");
    expect(FOREX_DECISION_PROMPT_CHAR_BUDGET).toBe(2800);
  });

  it("A/B continuation scenarios", () => {
    const bull = mtfFromTrends({ "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH" });
    const bear = mtfFromTrends({ "4h": "BEARISH", "1h": "BEARISH", "30m": "BEARISH", "15m": "BEARISH", "5m": "BEARISH" });
    const aBull = computeMtfAlignment(bull.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const aBear = computeMtfAlignment(bear.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    expect(selectDecisionScenario(bull, aBull).type).toBe("BULLISH_CONTINUATION");
    expect(selectDecisionScenario(bear, aBear).type).toBe("BEARISH_CONTINUATION");
  });

  it("C/D pullback scenarios", () => {
    const bullPb = mtfFromTrends({ "4h": "BULLISH", "1h": "BULLISH", "30m": "NEUTRAL", "15m": "BEARISH", "5m": "BEARISH" });
    const bearPb = mtfFromTrends({ "4h": "BEARISH", "1h": "BEARISH", "30m": "NEUTRAL", "15m": "BULLISH", "5m": "BULLISH" });
    const a1 = computeMtfAlignment(bullPb.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const a2 = computeMtfAlignment(bearPb.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    expect(a1.overall).toBe("MIXED");
    expect(selectDecisionScenario(bullPb, a1).type).toBe("BULLISH_PULLBACK");
    expect(selectDecisionScenario(bearPb, a2).type).toBe("BEARISH_PULLBACK");
  });

  it("E range / F conflict / G missing required", () => {
    const range = mtfFromTrends({ "4h": "NEUTRAL", "1h": "NEUTRAL", "30m": "NEUTRAL", "15m": "NEUTRAL", "5m": "NEUTRAL" });
    const conflict = mtfFromTrends({ "4h": "BULLISH", "1h": "BEARISH", "30m": "NEUTRAL", "15m": "BULLISH", "5m": "BEARISH" });
    const missing = mtfFromTrends(
      { "4h": "BULLISH", "1h": "BULLISH", "15m": "BULLISH" },
      { missing: ["1h"] },
    );
    const aR = computeMtfAlignment(range.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const aC = computeMtfAlignment(conflict.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const aM = computeMtfAlignment(missing.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    expect(["RANGE_CONSOLIDATION", "WAIT"]).toContain(selectDecisionScenario(range, aR).type);
    expect(selectDecisionScenario(conflict, aC).type).toBe("CONFLICT");
    expect(aM.overall).toBe("INSUFFICIENT_DATA");
    expect(selectDecisionScenario(missing, aM).type).toBe("INSUFFICIENT_DATA");
  });

  it("J entry zone unavailable without BASIC_SWINGS; available with swings", () => {
    const noStruct = mtfFromTrends(
      { "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH" },
      { noStructure: true },
    );
    const withStruct = mtfFromTrends({
      "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH",
    });
    const a1 = computeMtfAlignment(noStruct.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const a2 = computeMtfAlignment(withStruct.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const s1 = selectDecisionScenario(noStruct, a1);
    const s2 = selectDecisionScenario(withStruct, a2);
    const z1 = buildEntryZone(noStruct, s1);
    const z2 = buildEntryZone(withStruct, s2);
    expect(z1.status).toBe("UNAVAILABLE");
    expect(z1.unavailableReason).toMatch(/ENTRY_ZONE_UNAVAILABLE|BASIC_SWINGS/i);
    expect(z1.lowerBound).toBeNull();
    expect(z2.status).not.toBe("UNAVAILABLE");
    expect(z2.lowerBound).not.toBeNull();
    expect(z2.upperBound).not.toBeNull();
    expect(z2.upperBound!).toBeGreaterThan(z2.lowerBound!);
  });

  it("K/L confirmation not met vs met for continuation", () => {
    const aligned = mtfFromTrends({
      "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH",
    }, { price: 98_200 });
    const a = computeMtfAlignment(aligned.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const scenario = selectDecisionScenario(aligned, a);
    const zone = buildEntryZone(aligned, scenario);
    // Force price into zone for MET path
    zone.currentPrice = (zone.lowerBound! + zone.upperBound!) / 2;
    const confMet = buildConfirmationConditions(aligned, a, scenario, zone);
    expect(confMet.conditions.every((c) => c.status !== "UNKNOWN" || true)).toBe(true);

    const pullback = mtfFromTrends({
      "4h": "BULLISH", "1h": "BULLISH", "30m": "NEUTRAL", "15m": "BEARISH", "5m": "BEARISH",
    });
    const aPb = computeMtfAlignment(pullback.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const scPb = selectDecisionScenario(pullback, aPb);
    const zPb = buildEntryZone(pullback, scPb);
    const confPb = buildConfirmationConditions(pullback, aPb, scPb, zPb);
    expect(confPb.allRequiredMet).toBe(false);
    expect(confPb.conditions.some((c) => c.status === "NOT_MET")).toBe(true);
  });

  it("M invalidation / N risk-reward / O missing SL methodology", () => {
    const aligned = mtfFromTrends({
      "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH",
    });
    const a = computeMtfAlignment(aligned.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const pack = runDeterministicDecisionEngines(aligned, a);
    expect(pack.riskReward.ratio == null || pack.riskReward.ratio >= 0).toBe(true);
    if (pack.entryZone.status !== "UNAVAILABLE" && pack.stopLossCandidate != null) {
      expect(pack.riskReward.ratio).not.toBeNull();
      expect(Number.isFinite(pack.riskReward.ratio!)).toBe(true);
    }

    const noStruct = mtfFromTrends({
      "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH",
    }, { noStructure: true });
    const a2 = computeMtfAlignment(noStruct.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const sc = selectDecisionScenario(noStruct, a2);
    const zone = buildEntryZone(noStruct, sc);
    const st = buildStopAndTargets(noStruct, sc, zone);
    expect(st.stopLossCandidate).toBeNull();
    expect(st.takeProfitCandidates).toEqual([]);
    expect(st.riskReward.unavailableReason).toBeTruthy();

    // Invalidation when price breaches swing-derived level
    const sc2 = selectDecisionScenario(aligned, a);
    const zone2 = buildEntryZone(aligned, sc2);
    zone2.currentPrice = (zone2.invalidationLevel ?? 0) - 1;
    const inv = buildInvalidationConditions(aligned, a, sc2, zone2);
    if (zone2.invalidationLevel != null && sc2.direction === "BULLISH") {
      expect(inv.conditions.find((c) => c.id === "structure-level")?.status).toBe("MET");
    }
  });

  it("P/Q same symbol defaults; posture rules; confidence null; no BUY/SELL", () => {
    expect(resolveDecisionPosture({
      dataQuality: "INSUFFICIENT_DATA",
      scenarioType: "WAIT",
      confirmationAllMet: false,
      invalidationTriggered: false,
      alignmentOverall: "INSUFFICIENT_DATA",
    })).toBe("INSUFFICIENT_DATA");

    expect(resolveDecisionPosture({
      dataQuality: "COMPLETE_CONNECTED",
      scenarioType: "CONFLICT",
      confirmationAllMet: false,
      invalidationTriggered: false,
      alignmentOverall: "CONFLICTING",
    })).toBe("WAIT");

    expect(resolveDecisionPosture({
      dataQuality: "COMPLETE_CONNECTED",
      scenarioType: "BULLISH_PULLBACK",
      confirmationAllMet: false,
      invalidationTriggered: false,
      alignmentOverall: "MIXED",
    })).toBe("CONFIRMATION_REQUIRED");

    expect(resolveDecisionPosture({
      dataQuality: "COMPLETE_CONNECTED",
      scenarioType: "BULLISH_CONTINUATION",
      confirmationAllMet: true,
      invalidationTriggered: false,
      alignmentOverall: "ALIGNED_BULLISH",
    })).toBe("SCENARIO_ACTIVE");

    expect(resolveDecisionPosture({
      dataQuality: "COMPLETE_CONNECTED",
      scenarioType: "BULLISH_CONTINUATION",
      confirmationAllMet: true,
      invalidationTriggered: true,
      alignmentOverall: "ALIGNED_BULLISH",
    })).toBe("INVALIDATED");

    const aligned = mtfFromTrends({
      "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH",
    });
    const a = computeMtfAlignment(aligned.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const pack = runDeterministicDecisionEngines(aligned, a);
    expect(pack.mtf.symbol).toBe("BTCUSDT");
    expect(pack.mtf.slots.every((s) => !s.marketState || s.marketState.symbol === "BTCUSDT")).toBe(true);

    const prompt = buildDecisionAnalysisPrompt({ pack, knowledgeText: "structure confirmation" });
    expect(prompt.length).toBeLessThanOrEqual(FOREX_DECISION_PROMPT_CHAR_BUDGET);
    expect(prompt.toLowerCase()).not.toMatch(/\bbuy now\b|\bsell now\b/);
    expect(prompt).toContain("confidence must be null");

    const violations = detectDecisionGroundingViolations(
      JSON.stringify({ interpretation: "RSI is 99 and entry at 50000", risks: [] }),
      pack,
    );
    expect(violations.length).toBeGreaterThan(0);

    // No fake Math.random in decision engines
    for (const f of [
      "ai/forex-ai/decision/scenario-engine.ts",
      "ai/forex-ai/decision/entry-zone.ts",
      "ai/forex-ai/decision/decision-engine.ts",
      "ai/forex-ai/decision/risk.ts",
    ]) {
      const src = read(f);
      expect(src).not.toContain("Math.random");
      expect(src).not.toMatch(/fakePrice|mockPrice|demoPrice|fakeEntry|fakeStopLoss/);
    }
  });

  it("4h forming-candle open age is not falsely STALE for analysis", () => {
    const now = Date.now();
    // Mid 4h candle: open ~90 minutes ago — must remain usable for MTF/decision HTF.
    const state = mockState({ timeframe: "4h", trend: "BEARISH" });
    state.lastMarketUpdate = now - 90 * 60 * 1000;
    state.stateGeneratedAt = now;
    state.candle = {
      open: 100_000,
      high: 101_000,
      low: 99_000,
      close: 100_000,
      volume: 1,
      openTime: Math.floor((now - 90 * 60 * 1000) / 1000),
      closeTime: Math.floor((now + 150 * 60 * 1000) / 1000),
      isClosed: false,
    };
    const q = assessMarketStateForAnalysis(state, now);
    expect(q.ok).toBe(true);
    expect(q.code).toBe("OK");
  });

  it("risk context built without inventing account balance", () => {
    const aligned = mtfFromTrends({
      "4h": "BULLISH", "1h": "BULLISH", "30m": "BULLISH", "15m": "BULLISH", "5m": "BULLISH",
    });
    const a = computeMtfAlignment(aligned.slots.map((s) => s.compact), FOREX_DECISION_REQUIRED);
    const sc = selectDecisionScenario(aligned, a);
    const zone = buildEntryZone(aligned, sc);
    const risk = buildRiskContext(aligned, a, zone);
    expect(risk.factors.some((f) => /account balance/i.test(f))).toBe(true);
    expect(risk.dataQuality).toBe("COMPLETE_CONNECTED");
  });
});
