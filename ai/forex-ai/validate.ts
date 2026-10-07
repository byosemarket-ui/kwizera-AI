import { randomUUID } from "node:crypto";
import type {
  ForexAiAnalysis,
  ForexAiAnalysisType,
  ForexAiDataQualityStatus,
  ForexAiDecisionPosture,
  ForexAiErrorCode,
  ForexAiKnowledgeSource,
  ForexAiScenario,
  ForexAiScenarioType,
  ForexMarketState,
} from "./types.js";
import {
  FOREX_AI_ANALYSIS_SCHEMA_VERSION,
  FOREX_AI_ENGINE_VERSION,
  FOREX_ANALYSIS_PROMPT_VERSION,
} from "./prompts.js";
import { formatDisplaySymbol } from "./data-quality.js";

const SCENARIO_TYPES = new Set<ForexAiScenarioType>(["BULLISH", "BEARISH", "NEUTRAL", "WAIT"]);
const DECISION_POSTURES = new Set<ForexAiDecisionPosture>([
  "OBSERVE", "WAIT", "ANALYZE", "INSUFFICIENT_DATA",
]);

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

function clip(text: string, max = 480): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
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
    name: asString(item.name) || undefined,
    status: asString(item.status).toUpperCase() === "WATCH" ? "WATCH"
      : asString(item.status).toUpperCase() === "INACTIVE" ? "INACTIVE"
        : "POSSIBLE",
    conditions: asStringArray(item.conditions),
    confirmation: asStringArray(item.confirmation),
    invalidation: asStringArray(item.invalidation),
    reasoning: clip(asString(item.reasoning), 360),
    supportingFacts: asStringArray(item.supporting_facts ?? item.supportingFacts).slice(0, 6),
  };
}

/** Practical hallucination checks against supplied Market State. */
export function detectGroundingViolations(
  textBlob: string,
  market: ForexMarketState,
): string[] {
  const flags: string[] = [];
  const blob = textBlob.toLowerCase();

  if (market.indicators.rsi == null && /\brsi\b[^.]{0,40}\b(\d{1,3}(?:\.\d+)?)\b/.test(blob)) {
    const m = blob.match(/\brsi\b[^.]{0,40}\b(\d{1,3}(?:\.\d+)?)\b/);
    if (m && Number(m[1]) > 0) {
      flags.push("AI invented an RSI value that was not supplied.");
    }
  }

  if (market.price != null && market.price > 0) {
    const priceMentions = [...blob.matchAll(/\b(?:price|last|close)\b[^.]{0,30}\b(\d{3,}(?:\.\d+)?)\b/g)];
    for (const match of priceMentions) {
      const claimed = Number(match[1]);
      if (!Number.isFinite(claimed) || claimed <= 0) continue;
      const ratio = claimed / market.price;
      if (ratio < 0.85 || ratio > 1.15) {
        flags.push("AI claimed a price inconsistent with supplied Market State.");
        break;
      }
    }
  }

  if (/\b(buy|sell|long|short)\s+(now|order|market|signal)\b/i.test(textBlob)
    || /\bexecute\s+(a\s+)?(trade|order)\b/i.test(textBlob)) {
    flags.push("AI attempted trade-execution language.");
  }

  return flags;
}

function buildObservedFacts(market: ForexMarketState, fromModel: string[]): string[] {
  const facts: string[] = [];
  facts.push(`Symbol ${market.symbol} · timeframe ${market.timeframe} · exchange BINANCE SPOT`);
  if (market.price != null) facts.push(`Last price ${market.price}`);
  if (market.candle.close != null) {
    facts.push(
      `Candle O=${market.candle.open} H=${market.candle.high} L=${market.candle.low} C=${market.candle.close} V=${market.candle.volume}`,
    );
  }
  if (market.indicators.rsi != null) facts.push(`RSI14=${market.indicators.rsi}`);
  else facts.push("RSI14 unavailable (not provided)");
  if (market.indicators.ema["50"] != null) facts.push(`EMA50=${market.indicators.ema["50"]}`);
  if (market.indicators.sma["20"] != null) facts.push(`SMA20=${market.indicators.sma["20"]}`);
  if (market.indicators.sma["50"] != null) facts.push(`SMA50=${market.indicators.sma["50"]}`);
  if (market.trend) facts.push(`Classified trend=${market.trend}`);
  if (market.momentum) facts.push(`Classified momentum=${market.momentum}`);
  if (market.volatility) facts.push(`Classified volatility=${market.volatility}`);
  facts.push(`live=${market.live} · dataSource=${market.dataSource}`);
  // Merge model facts that do not invent missing RSI/price — keep short.
  for (const item of fromModel.slice(0, 4)) {
    if (market.indicators.rsi == null && /\brsi\b/i.test(item) && /\d/.test(item)) continue;
    if (!facts.includes(item)) facts.push(clip(item, 160));
  }
  return facts.slice(0, 12);
}

export function parseForexAiAnalysis(
  data: Record<string, unknown>,
  context: {
    market: ForexMarketState;
    model: string | null;
    knowledgeSources?: ForexAiKnowledgeSource[];
    analysisType?: ForexAiAnalysisType;
    dataQualityStatus?: ForexAiDataQualityStatus;
    dataQualityStale?: boolean;
  },
): { ok: true; analysis: ForexAiAnalysis } | { ok: false; code: "AI_FORMAT_ERROR" | "AI_ANALYSIS_INVALID"; error: string } {
  const marketCondition = asString(data.market_condition ?? data.marketCondition);
  const trend = asString(data.trend);
  const momentum = asString(data.momentum);
  const volatility = asString(data.volatility);
  const reasoning = asString(data.reasoning);
  const summary = asString(data.summary) || marketCondition || reasoning;
  if (!summary && !trend && !reasoning) {
    return { ok: false, code: "AI_FORMAT_ERROR", error: "AI response missing required descriptive fields." };
  }

  const scenariosRaw = Array.isArray(data.scenarios) ? data.scenarios : [];
  const scenarios = scenariosRaw
    .map(parseScenario)
    .filter((item): item is ForexAiScenario => item != null)
    .slice(0, 2);

  const decisionRaw = asString(data.decision_posture ?? data.decisionPosture).toUpperCase() as ForexAiDecisionPosture;
  const decisionPosture = DECISION_POSTURES.has(decisionRaw)
    ? decisionRaw
    : (marketStateHasAnalyzableFacts(context.market) ? "OBSERVE" : "INSUFFICIENT_DATA");

  const blob = [
    summary, marketCondition, trend, momentum, volatility, reasoning,
    ...scenarios.map((s) => s.reasoning),
    ...asStringArray(data.observed_facts ?? data.observedFacts),
  ].join("\n");

  const grounding = detectGroundingViolations(blob, context.market);
  if (grounding.length > 0) {
    return {
      ok: false,
      code: "AI_ANALYSIS_INVALID",
      error: grounding[0] ?? "AI output failed grounding checks.",
    };
  }

  const structureState = asString(data.market_structure ?? data.marketStructure)
    || String(context.market.marketStructure.structureState ?? context.market.trend ?? "Insufficient data");

  const analysis: ForexAiAnalysis = {
    schemaVersion: FOREX_AI_ANALYSIS_SCHEMA_VERSION,
    analysisId: randomUUID(),
    generatedAt: new Date().toISOString(),
    analysisType: context.analysisType ?? "MARKET_OVERVIEW",
    market: {
      exchange: "BINANCE",
      symbol: context.market.symbol,
      displaySymbol: formatDisplaySymbol(context.market.symbol),
      marketType: "CRYPTO",
      timeframe: context.market.timeframe,
    },
    dataQuality: {
      status: context.dataQualityStatus ?? (context.market.live ? "LIVE" : "CONNECTED"),
      stale: context.dataQualityStale ?? false,
      marketTimestamp: context.market.timestamp,
    },
    summary: clip(summary || "Insufficient structured description", 400),
    observedFacts: buildObservedFacts(
      context.market,
      asStringArray(data.observed_facts ?? data.observedFacts),
    ),
    trend: {
      direction: trend || context.market.trend || "Insufficient data",
      explanation: clip(asString(data.trend_explanation ?? data.trendExplanation) || reasoning, 320),
    },
    momentum: {
      state: momentum || context.market.momentum || "Insufficient data",
      explanation: clip(asString(data.momentum_explanation ?? data.momentumExplanation) || "", 320),
    },
    volatility: {
      state: volatility || context.market.volatility || "Insufficient data",
      explanation: clip(asString(data.volatility_explanation ?? data.volatilityExplanation) || "", 320),
    },
    marketStructure: {
      state: structureState,
      explanation: clip(asString(data.market_structure_explanation ?? data.marketStructureExplanation) || "", 320),
    },
    scenarios,
    confirmationNeeded: asStringArray(data.confirmation_needed ?? data.confirmationNeeded).slice(0, 6),
    invalidationConditions: asStringArray(data.invalidation ?? data.invalidationConditions).slice(0, 6),
    risks: asStringArray(data.risks).slice(0, 6),
    knowledgeSources: context.knowledgeSources ?? [],
    limitations: [
      ...asStringArray(data.limitations).slice(0, 4),
      "AI analysis is interpretive, not a guaranteed prediction.",
      "Does not execute trades. Depends on supplied Market State freshness.",
    ].slice(0, 8),
    decisionPosture,
    confidence: null,
    model: context.model,
    dataTimestamp: context.market.timestamp,
    promptVersion: FOREX_ANALYSIS_PROMPT_VERSION,
    engineVersion: FOREX_AI_ENGINE_VERSION,
    symbol: context.market.symbol,
    timeframe: context.market.timeframe,
    marketCondition: marketCondition || summary || "Insufficient structured description",
    reasoning: clip(reasoning || summary || "Model did not provide reasoning.", 600),
    invalidation: asStringArray(data.invalidation ?? data.invalidationConditions).slice(0, 6),
  };

  return { ok: true, analysis };
}
