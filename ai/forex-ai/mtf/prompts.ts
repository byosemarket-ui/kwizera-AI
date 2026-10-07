/**
 * Compact multi-timeframe prompts for constrained local models.
 */
import { FOREX_AI_SYSTEM_RULES } from "../prompts.js";
import {
  FOREX_MTF_PROMPT_CHAR_BUDGET,
  FOREX_MTF_PROMPT_VERSION,
  FOREX_MTF_SCHEMA_VERSION,
} from "./config.js";
import { formatCompactFactsLine } from "./compact.js";
import type { ForexMtfAlignmentResult, ForexMultiTimeframeMarketState } from "./types.js";

const SCHEMA_HINT = `{
  "summary":"string",
  "higher_bias":"BULLISH|BEARISH|NEUTRAL|UNKNOWN",
  "timeframe_interpretations":[{"timeframe":"4h","interpretation":"string"}],
  "scenarios":[{"type":"BULLISH_CONTINUATION|BEARISH_CONTINUATION|PULLBACK|CONSOLIDATION|CONFLICT|WAIT|INSUFFICIENT_DATA","name":"string","reasoning":"string","conditions":[],"confirmation":[],"invalidation":[]}],
  "confirmation_needed":["string"],
  "invalidation":["string"],
  "risks":["string"],
  "limitations":["string"],
  "decision_posture":"OBSERVE|WAIT|ANALYZE|INSUFFICIENT_DATA",
  "confidence":null,
  "reasoning":"string"
}`;

export function buildMtfAnalysisPrompt(input: {
  mtf: ForexMultiTimeframeMarketState;
  alignment: ForexMtfAlignmentResult;
  knowledgeText: string;
}): string {
  const lines = input.mtf.slots.map((s) => formatCompactFactsLine(s.compact));
  const alignmentBlock = [
    `overall=${input.alignment.overall}`,
    `higherBias=${input.alignment.higherBias}`,
    `higherBasis=${input.alignment.higherBasis.join("; ") || "n/a"}`,
    `intermediate=${input.alignment.intermediateState}`,
    `lower=${input.alignment.lowerState}`,
    `confluence=${input.alignment.confluence.join("; ") || "none"}`,
    `conflicts=${input.alignment.conflicts.join("; ") || "none"}`,
  ].join("\n");

  let knowledge = input.knowledgeText.slice(0, 500);
  let body = [
    "KWIZERA Forex Multi-Timeframe AI. Follow rules:",
    FOREX_AI_SYSTEM_RULES,
    "Reason top-down: higher TF context before lower TF detail. Never invent TF values.",
    `Prompt:${FOREX_MTF_PROMPT_VERSION} Schema:${FOREX_MTF_SCHEMA_VERSION}`,
    "",
    `MARKET: BINANCE ${input.mtf.symbol} (${input.mtf.displaySymbol}) SPOT`,
    `DATA_QUALITY: ${input.mtf.dataQuality}`,
    "",
    "TIMEFRAME_STATES (authoritative, top-down):",
    ...lines,
    "",
    "DETERMINISTIC_ALIGNMENT (system facts, not to invent):",
    alignmentBlock,
    "",
    "KNOWLEDGE (reference only):",
    knowledge,
    "",
    "Return JSON only. Max 2 scenarios. confidence=null. No BUY/SELL.",
    SCHEMA_HINT,
  ].join("\n");

  // Priority trim: shrink knowledge first if over budget.
  while (body.length > FOREX_MTF_PROMPT_CHAR_BUDGET && knowledge.length > 40) {
    knowledge = knowledge.slice(0, Math.floor(knowledge.length * 0.7));
    body = body.replace(/KNOWLEDGE \(reference only\):\n[\s\S]*?\n\nReturn JSON/, `KNOWLEDGE (reference only):\n${knowledge}\n\nReturn JSON`);
  }

  if (body.length > FOREX_MTF_PROMPT_CHAR_BUDGET) {
    body = body.slice(0, FOREX_MTF_PROMPT_CHAR_BUDGET);
  }
  return body;
}

export function buildMtfRepairPrompt(input: {
  mtf: ForexMultiTimeframeMarketState;
  alignment: ForexMtfAlignmentResult;
}): string {
  const lines = input.mtf.slots.map((s) => formatCompactFactsLine(s.compact)).join("\n");
  return [
    "Return ONE JSON object only. No markdown.",
    `MARKET ${input.mtf.symbol} alignment=${input.alignment.overall} higherBias=${input.alignment.higherBias}`,
    lines,
    'Keys: summary, higher_bias, timeframe_interpretations, scenarios, confirmation_needed, invalidation, risks, limitations, decision_posture, confidence, reasoning',
    "confidence=null. decision_posture WAIT|OBSERVE|ANALYZE|INSUFFICIENT_DATA. Max 1 scenario. No BUY/SELL. Use only supplied TF facts.",
  ].join("\n");
}
