/**
 * Truthful MTF fallback — Market State facts only, no invented narrative.
 */
import { randomUUID } from "node:crypto";
import { FOREX_MTF_ENGINE_VERSION, FOREX_MTF_PROMPT_VERSION, FOREX_MTF_SCHEMA_VERSION, roleForTimeframe } from "./config.js";
import type {
  ForexMtfAiAnalysis,
  ForexMtfAlignmentResult,
  ForexMultiTimeframeMarketState,
} from "./types.js";
import type { ForexAiKnowledgeSource } from "../types.js";

export function assembleMtfMarketStateOnly(input: {
  mtf: ForexMultiTimeframeMarketState;
  alignment: ForexMtfAlignmentResult;
  knowledgeSources: ForexAiKnowledgeSource[];
  model: string | null;
  reason: string;
}): ForexMtfAiAnalysis {
  const { mtf, alignment } = input;
  return {
    schemaVersion: FOREX_MTF_SCHEMA_VERSION,
    analysisId: randomUUID(),
    generatedAt: new Date().toISOString(),
    narrativeStatus: "MARKET_STATE_ONLY",
    market: {
      exchange: "BINANCE",
      symbol: mtf.symbol,
      displaySymbol: mtf.displaySymbol,
      marketType: "CRYPTO",
    },
    timeframes: mtf.timeframes,
    timeframeStates: mtf.slots.map((s) => s.compact),
    dataQuality: {
      status: mtf.dataQuality,
      perTimeframe: mtf.slots.map((s) => ({
        timeframe: s.timeframe,
        status: s.compact.status,
        timestamp: s.compact.timestamp,
      })),
    },
    overallAlignment: alignment,
    higherTimeframeBias: {
      direction: alignment.higherBias,
      basis: alignment.higherBasis,
    },
    intermediateTimeframeState: alignment.intermediateState,
    lowerTimeframeState: alignment.lowerState,
    timeframeAnalysis: mtf.slots.map((s) => ({
      timeframe: s.timeframe,
      role: s.role,
      observedFacts: [
        s.compact.usable
          ? `${s.timeframe}: trend=${s.compact.trend} mom=${s.compact.momentum} rsi=${s.compact.rsi ?? "n/a"}`
          : `${s.timeframe}: ${s.compact.status} (${s.compact.reason ?? "unavailable"})`,
      ],
      interpretation: "AI narrative unavailable — factual Market State only.",
    })),
    confluence: alignment.confluence,
    conflicts: alignment.conflicts,
    scenarios: [{
      type: mtf.dataQuality === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : "WAIT",
      name: "Wait for valid AI narrative",
      status: "POSSIBLE",
      reasoning: "Interpretive multi-timeframe narrative withheld because the model response was unavailable/invalid.",
      conditions: ["Valid Ollama JSON"],
      confirmation: [],
      invalidation: [],
    }],
    confirmationNeeded: ["Retry when the model returns valid JSON"],
    invalidationConditions: [],
    risks: ["Local model may omit interpretive confluence narrative"],
    knowledgeSources: input.knowledgeSources,
    limitations: [
      input.reason,
      "No invented prices or indicators.",
      "Multi-timeframe state shown without generated interpretation.",
      "Not a trade signal and not trade execution.",
    ],
    decisionPosture: mtf.dataQuality === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : "WAIT",
    confidence: null,
    model: input.model,
    promptVersion: FOREX_MTF_PROMPT_VERSION,
    engineVersion: FOREX_MTF_ENGINE_VERSION,
  };
}

export function buildFactualTimeframeAnalysis(mtf: ForexMultiTimeframeMarketState): ForexMtfAiAnalysis["timeframeAnalysis"] {
  return mtf.slots.map((s) => ({
    timeframe: s.timeframe,
    role: roleForTimeframe(s.timeframe),
    observedFacts: [
      s.compact.usable
        ? [
          `trend=${s.compact.trend}`,
          `momentum=${s.compact.momentum}`,
          `volatility=${s.compact.volatility}`,
          `rsi=${s.compact.rsi ?? "unavailable"}`,
          `structure=${s.compact.structure ?? "n/a"}`,
          `forming=${s.compact.candleOpen}`,
          `status=${s.compact.status}`,
        ].join("; ")
        : `unavailable: ${s.compact.status}`,
    ],
    interpretation: "",
  }));
}
