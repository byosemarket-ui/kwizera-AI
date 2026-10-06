import type {
  ForexAiAnalysis,
  ForexAiErrorCode,
  ForexAiScenario,
  ForexAiScenarioType,
  ForexMarketState,
} from "./types.js";
import { FOREX_AI_ENGINE_VERSION, FOREX_ANALYSIS_PROMPT_VERSION } from "./prompts.js";

const SCENARIO_TYPES = new Set<ForexAiScenarioType>(["BULLISH", "BEARISH", "NEUTRAL", "WAIT"]);

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function asNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function validateForexMarketState(input: unknown): {
  ok: true;
  market: ForexMarketState;
} | {
  ok: false;
  code: Extract<ForexAiErrorCode, "INVALID_MARKET_STATE">;
  error: string;
} {
  if (!input || typeof input !== "object") {
    return { ok: false, code: "INVALID_MARKET_STATE", error: "Market state must be an object." };
  }
  const raw = input as Record<string, unknown>;
  const symbol = asString(raw.symbol).toUpperCase();
  const timeframe = asString(raw.timeframe).toLowerCase();
  if (!/^[A-Z0-9]{4,30}$/.test(symbol)) {
    return { ok: false, code: "INVALID_MARKET_STATE", error: "symbol must be a Binance-style compact symbol." };
  }
  if (!timeframe) {
    return { ok: false, code: "INVALID_MARKET_STATE", error: "timeframe is required." };
  }
  if (raw.exchange !== "BINANCE" || raw.marketType !== "SPOT") {
    return { ok: false, code: "INVALID_MARKET_STATE", error: "exchange must be BINANCE and marketType SPOT." };
  }

  const candleRaw = (raw.candle && typeof raw.candle === "object")
    ? raw.candle as Record<string, unknown>
    : {};
  const indicatorsRaw = (raw.indicators && typeof raw.indicators === "object")
    ? raw.indicators as Record<string, unknown>
    : {};
  const macdRaw = (indicatorsRaw.macd && typeof indicatorsRaw.macd === "object")
    ? indicatorsRaw.macd as Record<string, unknown>
    : {};
  const bbRaw = (indicatorsRaw.bollinger && typeof indicatorsRaw.bollinger === "object")
    ? indicatorsRaw.bollinger as Record<string, unknown>
    : {};
  const srRaw = (raw.supportResistance && typeof raw.supportResistance === "object")
    ? raw.supportResistance as Record<string, unknown>
    : {};

  const sma: Record<string, number | null> = {};
  if (indicatorsRaw.sma && typeof indicatorsRaw.sma === "object") {
    for (const [key, value] of Object.entries(indicatorsRaw.sma as Record<string, unknown>)) {
      sma[key] = asNullableNumber(value);
    }
  }
  const ema: Record<string, number | null> = {};
  if (indicatorsRaw.ema && typeof indicatorsRaw.ema === "object") {
    for (const [key, value] of Object.entries(indicatorsRaw.ema as Record<string, unknown>)) {
      ema[key] = asNullableNumber(value);
    }
  }

  const market: ForexMarketState = {
    symbol,
    exchange: "BINANCE",
    marketType: "SPOT",
    timeframe,
    timestamp: typeof raw.timestamp === "string" ? raw.timestamp : null,
    price: asNullableNumber(raw.price),
    candle: {
      open: asNullableNumber(candleRaw.open),
      high: asNullableNumber(candleRaw.high),
      low: asNullableNumber(candleRaw.low),
      close: asNullableNumber(candleRaw.close),
      volume: asNullableNumber(candleRaw.volume),
    },
    trend: typeof raw.trend === "string" ? raw.trend : null,
    momentum: typeof raw.momentum === "string" ? raw.momentum : null,
    volatility: typeof raw.volatility === "string" ? raw.volatility : null,
    indicators: {
      sma,
      ema,
      rsi: asNullableNumber(indicatorsRaw.rsi),
      macd: {
        macd: asNullableNumber(macdRaw.macd),
        signal: asNullableNumber(macdRaw.signal),
        histogram: asNullableNumber(macdRaw.histogram),
      },
      bollinger: {
        mid: asNullableNumber(bbRaw.mid),
        upper: asNullableNumber(bbRaw.upper),
        lower: asNullableNumber(bbRaw.lower),
        widthPct: asNullableNumber(bbRaw.widthPct),
      },
    },
    marketStructure: (raw.marketStructure && typeof raw.marketStructure === "object")
      ? raw.marketStructure as Record<string, unknown>
      : {},
    supportResistance: {
      support: Array.isArray(srRaw.support)
        ? srRaw.support.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
        : [],
      resistance: Array.isArray(srRaw.resistance)
        ? srRaw.resistance.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
        : [],
    },
    dataSource: raw.dataSource === "binance-spot" ? "binance-spot" : "none",
    live: raw.live === true,
  };

  return { ok: true, market };
}

export function marketStateHasAnalyzableFacts(market: ForexMarketState): boolean {
  return market.dataSource === "binance-spot"
    && (
      market.price != null
      || market.candle.close != null
      || market.indicators.rsi != null
      || Object.values(market.indicators.sma).some((v) => v != null)
      || Object.values(market.indicators.ema).some((v) => v != null)
    );
}

function parseScenario(raw: unknown): ForexAiScenario | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const typeRaw = asString(item.type).toUpperCase() as ForexAiScenarioType;
  if (!SCENARIO_TYPES.has(typeRaw)) return null;
  return {
    type: typeRaw,
    conditions: asStringArray(item.conditions),
    confirmation: asStringArray(item.confirmation),
    invalidation: asStringArray(item.invalidation),
    reasoning: asString(item.reasoning),
  };
}

export function parseForexAiAnalysis(
  data: Record<string, unknown>,
  context: {
    market: ForexMarketState;
    model: string | null;
  },
): { ok: true; analysis: ForexAiAnalysis } | { ok: false; code: "AI_FORMAT_ERROR"; error: string } {
  const marketCondition = asString(data.market_condition ?? data.marketCondition);
  const trend = asString(data.trend);
  const momentum = asString(data.momentum);
  const volatility = asString(data.volatility);
  const reasoning = asString(data.reasoning);
  if (!marketCondition && !trend && !reasoning) {
    return { ok: false, code: "AI_FORMAT_ERROR", error: "AI response missing required descriptive fields." };
  }

  const scenariosRaw = Array.isArray(data.scenarios) ? data.scenarios : [];
  const scenarios = scenariosRaw
    .map(parseScenario)
    .filter((item): item is ForexAiScenario => item != null)
    .slice(0, 3);

  // Never accept fabricated numeric confidence from the model as truth.
  const confidence = null;

  return {
    ok: true,
    analysis: {
      generatedAt: new Date().toISOString(),
      symbol: context.market.symbol,
      timeframe: context.market.timeframe,
      marketCondition: marketCondition || "Insufficient structured description",
      trend: trend || "Insufficient data",
      momentum: momentum || "Insufficient data",
      volatility: volatility || "Insufficient data",
      scenarios,
      confirmationNeeded: asStringArray(data.confirmation_needed ?? data.confirmationNeeded),
      invalidation: asStringArray(data.invalidation),
      reasoning: reasoning || "Model did not provide reasoning.",
      confidence,
      model: context.model,
      dataTimestamp: context.market.timestamp,
      promptVersion: FOREX_ANALYSIS_PROMPT_VERSION,
      engineVersion: FOREX_AI_ENGINE_VERSION,
    },
  };
}
