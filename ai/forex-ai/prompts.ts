/**
 * Centralized Forex AI prompts — versionable, not scattered in React UI.
 */
import type { ForexMarketState } from "./types.js";

export const FOREX_AI_ENGINE_VERSION = "forex-ai-engine-v1";
export const FOREX_ANALYSIS_PROMPT_VERSION = "forex-analysis-prompt-v1";

export const FOREX_AI_SYSTEM_RULES = [
  "Market values must come only from the supplied structured market state JSON.",
  "Never invent missing prices, OHLC, volume, RSI, EMA, SMA, MACD, Bollinger, ATR, support, resistance, or timestamps.",
  "If a field is null or missing, say information is insufficient — do not guess.",
  "Never claim live data when live is false or data is stale/unknown.",
  "Distinguish facts (from supplied data) from scenarios (conditional possibilities).",
  "Do not present scenarios as guaranteed outcomes.",
  "Explain reasoning using only supplied evidence.",
  "Do not fabricate numeric confidence. Set confidence to null.",
  "Do not create BUY, SELL, LONG, SHORT, ENTRY, or trade orders.",
  "Do not claim certainty about future price movement.",
  "Return JSON only. Keep responses concise.",
].join("\n");

const ANALYSIS_SCHEMA_HINT = `{
  "market_condition": "string",
  "trend": "string",
  "momentum": "string",
  "volatility": "string",
  "scenarios": [
    {
      "type": "BULLISH|BEARISH|NEUTRAL|WAIT",
      "conditions": ["string"],
      "confirmation": ["string"],
      "invalidation": ["string"],
      "reasoning": "string"
    }
  ],
  "confirmation_needed": ["string"],
  "invalidation": ["string"],
  "confidence": null,
  "reasoning": "string"
}`;

/** Build a concise analysis prompt from a validated market state. */
export function buildForexAnalysisPrompt(market: ForexMarketState): string {
  const payload = JSON.stringify(market);
  return [
    "You are the KWIZERA Forex AI Analysis Engine.",
    "Follow these rules exactly:",
    FOREX_AI_SYSTEM_RULES,
    "",
    `Prompt version: ${FOREX_ANALYSIS_PROMPT_VERSION}`,
    "",
    "Structured market state (authoritative; do not invent beyond this):",
    payload,
    "",
    "Respond with JSON only matching this shape:",
    ANALYSIS_SCHEMA_HINT,
    "",
    "Keep scenarios to at most 3. Prefer WAIT when data is insufficient.",
    "confidence must be null.",
  ].join("\n");
}
