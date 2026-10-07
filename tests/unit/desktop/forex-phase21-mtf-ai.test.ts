import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  computeMtfAlignment,
  detectMtfGroundingViolations,
  FOREX_MTF_DEFAULT_STACK,
  FOREX_MTF_PROMPT_CHAR_BUDGET,
  FOREX_MTF_REQUIRED,
  FOREX_MTF_SCHEMA_VERSION,
  formatCompactFactsLine,
  resolveMtfTimeframes,
  roleForTimeframe,
  sortTimeframesTopDown,
  type ForexMtfCompactFacts,
} from "../../../ai/forex-ai/mtf/index.ts";
import { buildMtfAnalysisPrompt } from "../../../ai/forex-ai/mtf/prompts.ts";
import type { ForexMultiTimeframeMarketState } from "../../../ai/forex-ai/mtf/types.ts";

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
    volatility: partial.volatility ?? null,
    rsi: partial.rsi ?? null,
    ema50: null,
    sma20: null,
    sma50: null,
    structure: partial.structure ?? null,
    price: partial.price ?? 100,
    candleOpen: false,
    timestamp: "2026-10-07T12:00:00.000Z",
    ...partial,
  };
}

describe("Forex Phase 21 — Multi-Timeframe AI Analysis", () => {
  it("reuses Phase 18/19/20 infrastructure without duplicates", () => {
    const orch = read("ai/forex-ai/mtf/orchestrator.ts");
    const build = read("ai/forex-ai/mtf/build-state.ts");
    const api = read("dev/server/forex-ai-api.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    expect(build).toContain("buildForexMarketState");
    expect(build).not.toContain("new WebSocket");
    expect(orch).toContain("getOllamaAdapter");
    expect(orch).toContain("retrieveRelevantForexKnowledge");
    expect(orch).not.toContain("11434");
    expect(api).toContain("/api/forex/ai/multi-timeframe");
    expect(api).toContain("runForexMultiTimeframeAnalysis");
    expect(page).toContain("data-forex-ai-phase21");
    expect(page).toContain("Analyze Multi-Timeframe");
  });

  it("accepts only Binance-supported timeframes and sorts top-down", () => {
    expect(FOREX_MTF_DEFAULT_STACK).toEqual(["4h", "1h", "30m", "15m", "5m"]);
    expect(FOREX_MTF_REQUIRED).toEqual(["4h", "1h", "15m"]);
    const ok = resolveMtfTimeframes(["5m", "4h", "15m"]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.timeframes).toEqual(["4h", "15m", "5m"]);
    const bad = resolveMtfTimeframes(["3m", "2h"]);
    expect(bad.ok).toBe(false);
    expect(sortTimeframesTopDown(["5m", "1h", "4h"])).toEqual(["4h", "1h", "5m"]);
  });

  it("CASE A aligned bullish / CASE B aligned bearish", () => {
    const bull = ["4h", "1h", "30m", "15m", "5m"].map((tf) => fact({ timeframe: tf as never, trend: "BULLISH" }));
    expect(computeMtfAlignment(bull, FOREX_MTF_REQUIRED).overall).toBe("ALIGNED_BULLISH");
    const bear = ["4h", "1h", "30m", "15m", "5m"].map((tf) => fact({ timeframe: tf as never, trend: "BEARISH" }));
    expect(computeMtfAlignment(bear, FOREX_MTF_REQUIRED).overall).toBe("ALIGNED_BEARISH");
  });

  it("CASE C mixed when HTF bullish and LTF bearish", () => {
    const mixed = [
      fact({ timeframe: "4h", trend: "BULLISH" }),
      fact({ timeframe: "1h", trend: "BULLISH" }),
      fact({ timeframe: "30m", trend: "NEUTRAL" }),
      fact({ timeframe: "15m", trend: "BEARISH" }),
      fact({ timeframe: "5m", trend: "BEARISH" }),
    ];
    const result = computeMtfAlignment(mixed, FOREX_MTF_REQUIRED);
    expect(result.overall).toBe("MIXED");
    expect(result.higherBias).toBe("BULLISH");
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("CASE D insufficient when required TF missing", () => {
    const partial = [
      fact({ timeframe: "4h", trend: "BULLISH" }),
      fact({ timeframe: "1h", usable: false, status: "DATA_UNAVAILABLE", trend: null }),
      fact({ timeframe: "15m", trend: "BULLISH" }),
    ];
    const result = computeMtfAlignment(partial, FOREX_MTF_REQUIRED);
    expect(result.overall).toBe("INSUFFICIENT_DATA");
  });

  it("detects conflicting higher timeframes", () => {
    const conflict = [
      fact({ timeframe: "4h", trend: "BULLISH" }),
      fact({ timeframe: "1h", trend: "BEARISH" }),
      fact({ timeframe: "15m", trend: "NEUTRAL" }),
    ];
    expect(computeMtfAlignment(conflict, FOREX_MTF_REQUIRED).overall).toBe("CONFLICTING");
  });

  it("builds compact prompt within budget and keeps TF facts separate", () => {
    const mtf: ForexMultiTimeframeMarketState = {
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      marketType: "SPOT",
      displaySymbol: "BTC/USDT",
      generatedAt: "2026-10-07T12:00:00.000Z",
      timeframes: ["4h", "1h", "15m"],
      required: ["4h", "1h", "15m"],
      dataQuality: "COMPLETE_CONNECTED",
      slots: [
        { timeframe: "4h", role: "PRIMARY_TREND", marketState: null, compact: fact({ timeframe: "4h", trend: "BULLISH", rsi: 55 }) },
        { timeframe: "1h", role: "INTERMEDIATE_TREND", marketState: null, compact: fact({ timeframe: "1h", trend: "BULLISH", rsi: 52 }) },
        { timeframe: "15m", role: "TACTICAL", marketState: null, compact: fact({ timeframe: "15m", trend: "NEUTRAL", rsi: 48 }) },
      ],
    };
    const alignment = computeMtfAlignment(mtf.slots.map((s) => s.compact), mtf.required);
    const prompt = buildMtfAnalysisPrompt({
      mtf,
      alignment,
      knowledgeText: "Multi-timeframe trend alignment is educational reference only. ".repeat(40),
    });
    expect(prompt.length).toBeLessThanOrEqual(FOREX_MTF_PROMPT_CHAR_BUDGET);
    expect(prompt).toContain("4h(PRIMARY_TREND)");
    expect(prompt).toContain("BTCUSDT");
    expect(prompt).toContain("TIMEFRAME_STATES");
    expect(formatCompactFactsLine(fact({ timeframe: "5m", usable: false, status: "DATA_UNAVAILABLE" }))).toContain("NO_DATA");
  });

  it("grounds against unavailable timeframe RSI claims and trade language", () => {
    const mtf: ForexMultiTimeframeMarketState = {
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      marketType: "SPOT",
      displaySymbol: "BTC/USDT",
      generatedAt: "2026-10-07T12:00:00.000Z",
      timeframes: ["4h", "5m"],
      required: ["4h", "1h", "15m"],
      dataQuality: "INSUFFICIENT_DATA",
      slots: [
        { timeframe: "4h", role: "PRIMARY_TREND", marketState: null, compact: fact({ timeframe: "4h", trend: "BULLISH", rsi: 60 }) },
        { timeframe: "5m", role: "LOWER_CONFIRMATION", marketState: null, compact: fact({ timeframe: "5m", usable: false, status: "DATA_UNAVAILABLE" }) },
      ],
    };
    expect(detectMtfGroundingViolations("5m confirmation exists", mtf).length).toBeGreaterThan(0);
    expect(detectMtfGroundingViolations("Buy now with a market order", mtf).length).toBeGreaterThan(0);
    expect(FOREX_MTF_SCHEMA_VERSION).toBe("forex-mtf-ai-analysis-v1");
  });
});
