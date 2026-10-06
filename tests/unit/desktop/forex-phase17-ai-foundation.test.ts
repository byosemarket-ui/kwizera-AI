import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyForexMarketState,
  FOREX_AI_SYSTEM_RULES,
  FOREX_ANALYSIS_PROMPT_VERSION,
  buildForexAnalysisPrompt,
  forexAiEngineMeta,
  marketStateHasAnalyzableFacts,
  parseForexAiAnalysis,
  validateForexMarketState,
} from "../../../ai/forex-ai/index.ts";

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

describe("Forex Phase 17 — AI / Ollama foundation", () => {
  it("reuses canonical Ollama adapter and client (no duplicate Ollama service)", () => {
    const engine = read("ai/forex-ai/analysis-engine.ts");
    const api = read("dev/server/forex-ai-api.ts");
    const meta = forexAiEngineMeta();

    expect(engine).toContain('from "../ai-provider/ollama-adapter.js"');
    expect(engine).toContain("getOllamaAdapter");
    expect(engine).toContain("getCachedOllamaHealth");
    expect(engine).not.toContain("http://127.0.0.1:11434");
    expect(engine).not.toContain("/api/generate");
    expect(api).toContain("getForexAiHealth");
    expect(api).toContain("analyzeForexMarketState");
    expect(api).toContain('"/api/forex/ai/health"');
    expect(meta.authoritativeOllamaAdapter).toBe("ai/ai-provider/ollama-adapter.ts");
    expect(meta.authoritativeOllamaClient).toBe("ai/ai-provider/ollama-client.ts");
  });

  it("Forex shell routes AI Analysis to foundation page without second app shell", () => {
    const shell = read("desktop/forex/ForexShell.tsx");
    const routes = read("desktop/forex/forex-routes.ts");
    const page = read("desktop/forex/ForexAiAnalysisPage.tsx");
    const server = read("dev/server/index.ts");

    expect(shell).toContain('route === "ai-analysis"');
    expect(shell).toContain("ForexAiAnalysisPage");
    expect(routes).toContain('id: "ai-analysis"');
    expect(routes).toContain("implemented: true");
    expect(page).toContain("/api/forex/ai/health");
    expect(page).toContain("data-forex-ai-foundation");
    expect(page).not.toContain("11434");
    expect(server).toContain("handleForexAiApi");
  });

  it("prompt rules forbid inventing market values and BUY/SELL orders", () => {
    expect(FOREX_AI_SYSTEM_RULES).toContain("Never invent missing prices");
    expect(FOREX_AI_SYSTEM_RULES).toContain("Do not create BUY, SELL");
    expect(FOREX_AI_SYSTEM_RULES).toContain("Do not fabricate numeric confidence");
    const market = emptyForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      price: 100,
      candle: { open: 99, high: 101, low: 98, close: 100, volume: 10 },
    });
    const prompt = buildForexAnalysisPrompt(market);
    expect(prompt).toContain(FOREX_ANALYSIS_PROMPT_VERSION);
    expect(prompt).toContain("BTCUSDT");
    expect(prompt).toContain("confidence must be null");
  });

  it("validates market state and rejects analyzable-empty input honestly", () => {
    const invalid = validateForexMarketState({ symbol: "x", timeframe: "15m" });
    expect(invalid.ok).toBe(false);

    const empty = emptyForexMarketState({
      symbol: "ETHUSDT",
      timeframe: "1h",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "none",
    });
    const validated = validateForexMarketState(empty);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(marketStateHasAnalyzableFacts(validated.market)).toBe(false);
    }

    const withFacts = emptyForexMarketState({
      symbol: "ETHUSDT",
      timeframe: "1h",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      indicators: {
        sma: { "20": 2700 },
        ema: {},
        rsi: 44,
        macd: { macd: null, signal: null, histogram: null },
        bollinger: { mid: null, upper: null, lower: null, widthPct: null },
      },
    });
    expect(marketStateHasAnalyzableFacts(withFacts)).toBe(true);
  });

  it("parses AI JSON without accepting fabricated confidence", () => {
    const market = emptyForexMarketState({
      symbol: "BTCUSDT",
      timeframe: "15m",
      exchange: "BINANCE",
      marketType: "SPOT",
      dataSource: "binance-spot",
      price: 1,
    });
    const parsed = parseForexAiAnalysis({
      market_condition: "range",
      trend: "flat",
      momentum: "neutral",
      volatility: "low",
      scenarios: [{ type: "WAIT", conditions: [], confirmation: [], invalidation: [], reasoning: "wait" }],
      confirmation_needed: ["more data"],
      invalidation: [],
      confidence: 0.99,
      reasoning: "from supplied state only",
    }, { market, model: "llama3.2:1b" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.analysis.confidence).toBeNull();
      expect(parsed.analysis.scenarios[0]?.type).toBe("WAIT");
      expect(parsed.analysis.model).toBe("llama3.2:1b");
    }
  });
});
