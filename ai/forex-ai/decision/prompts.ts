/**
 * Compact decision prompts — Phase 24 labeled CURRENT / KNOWLEDGE / MEMORY.
 * Do not inflate beyond Phase 21 budget for llama3.2:1b.
 */
import {
  FOREX_DECISION_PROMPT_CHAR_BUDGET,
  FOREX_DECISION_PROMPT_VERSION,
  FOREX_DECISION_SCHEMA_VERSION,
} from "./config.js";
import { formatDecisionFactsBlock } from "./compact.js";
import { assembleLabeledPromptBody } from "../intelligence/context-builder.js";
import type { ForexDecisionDeterministicPack } from "./types.js";

const SYSTEM = [
  "You are a Forex analytical assistant for KWIZERA AI STUDIO.",
  "CURRENT MARKET STATE is authoritative. Knowledge is methodology only. Historical memory is context only — never current fact.",
  "Do not invent numbers. Never invent prices, RSI, ATR, support, resistance, entry, SL, TP, or timestamps.",
  "Never output BUY, SELL, LONG, SHORT as trade orders.",
  "Never claim current direction because previous memory outcomes succeeded.",
  "Never rewrite historical memory outcomes.",
  "Use WAIT / WATCH / CONFIRMATION_REQUIRED / SCENARIO_ACTIVE language only.",
  "If a value is UNAVAILABLE or null, say so. confidence must be null.",
  "Return compact JSON only.",
].join(" ");

export function buildDecisionAnalysisPrompt(input: {
  pack: ForexDecisionDeterministicPack;
  knowledgeText: string;
  memoryText?: string;
}): string {
  const facts = formatDecisionFactsBlock(input.pack);
  const header = [
    SYSTEM,
    `Prompt:${FOREX_DECISION_PROMPT_VERSION} Schema:${FOREX_DECISION_SCHEMA_VERSION}`,
    "OUTPUT JSON keys:",
    "interpretation, confirmation_notes, invalidation_notes, risks, limitations",
    "Do not restate numeric facts differently from CURRENT MARKET STATE.",
  ].join("\n");

  return assembleLabeledPromptBody({
    header,
    currentFacts: facts,
    knowledgeText: input.knowledgeText || "None",
    memoryText: input.memoryText || "none",
    budget: FOREX_DECISION_PROMPT_CHAR_BUDGET,
  });
}

export function buildDecisionRepairPrompt(pack: ForexDecisionDeterministicPack): string {
  return [
    SYSTEM,
    "Repair: return ONLY a JSON object with keys interpretation, risks, limitations.",
    "interpretation must explain the deterministic scenario without inventing numbers or using memory as current fact.",
    `scenario=${pack.scenario.type} posture=${pack.decisionPosture}`,
    `summary=${pack.deterministicSummary.slice(0, 400)}`,
  ].join("\n").slice(0, FOREX_DECISION_PROMPT_CHAR_BUDGET);
}
