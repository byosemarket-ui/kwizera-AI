/**
 * Compact decision prompts — do not inflate beyond Phase 21 budget.
 */
import {
  FOREX_DECISION_PROMPT_CHAR_BUDGET,
  FOREX_DECISION_PROMPT_VERSION,
  FOREX_DECISION_SCHEMA_VERSION,
} from "./config.js";
import { formatDecisionFactsBlock } from "./compact.js";
import type { ForexDecisionDeterministicPack } from "./types.js";

const SYSTEM = [
  "You are a Forex analytical assistant for KWIZERA AI STUDIO.",
  "Explain the supplied DETERMINISTIC decision facts. Do not invent numbers.",
  "Never invent prices, RSI, ATR, support, resistance, entry, SL, TP, or timestamps.",
  "Never output BUY, SELL, LONG, SHORT as trade orders.",
  "Use WAIT / WATCH / CONFIRMATION_REQUIRED / SCENARIO_ACTIVE language only.",
  "If a value is UNAVAILABLE or null, say so. confidence must be null.",
  "Return compact JSON only.",
].join(" ");

export function buildDecisionAnalysisPrompt(input: {
  pack: ForexDecisionDeterministicPack;
  knowledgeText: string;
}): string {
  const facts = formatDecisionFactsBlock(input.pack);
  let knowledge = (input.knowledgeText || "").trim() || "None";

  const header = [
    SYSTEM,
    `Prompt:${FOREX_DECISION_PROMPT_VERSION} Schema:${FOREX_DECISION_SCHEMA_VERSION}`,
    "OUTPUT JSON keys:",
    "interpretation, confirmation_notes, invalidation_notes, risks, limitations",
    "Do not restate numeric facts differently from DETERMINISTIC FACTS.",
  ].join("\n");

  let body = [
    "DETERMINISTIC FACTS:",
    facts,
    "KNOWLEDGE:",
    knowledge,
  ].join("\n");

  while (header.length + 1 + body.length > FOREX_DECISION_PROMPT_CHAR_BUDGET && knowledge.length > 40) {
    knowledge = knowledge.slice(0, Math.floor(knowledge.length * 0.7));
    body = ["DETERMINISTIC FACTS:", facts, "KNOWLEDGE:", knowledge || "None"].join("\n");
  }

  let prompt = `${header}\n${body}`;
  if (prompt.length > FOREX_DECISION_PROMPT_CHAR_BUDGET) {
    // Preserve facts; trim knowledge first already done — hard slice as last resort on knowledge section only
    const factsBlock = ["DETERMINISTIC FACTS:", facts].join("\n");
    const budgetLeft = FOREX_DECISION_PROMPT_CHAR_BUDGET - header.length - factsBlock.length - 20;
    const kn = budgetLeft > 0 ? knowledge.slice(0, budgetLeft) : "";
    prompt = `${header}\n${factsBlock}\nKNOWLEDGE:\n${kn || "None"}`;
    if (prompt.length > FOREX_DECISION_PROMPT_CHAR_BUDGET) {
      prompt = prompt.slice(0, FOREX_DECISION_PROMPT_CHAR_BUDGET);
    }
  }
  return prompt;
}

export function buildDecisionRepairPrompt(pack: ForexDecisionDeterministicPack): string {
  return [
    SYSTEM,
    "Repair: return ONLY a JSON object with keys interpretation, risks, limitations.",
    "interpretation must explain the deterministic scenario without inventing numbers.",
    `scenario=${pack.scenario.type} posture=${pack.decisionPosture}`,
    `summary=${pack.deterministicSummary.slice(0, 400)}`,
  ].join("\n").slice(0, FOREX_DECISION_PROMPT_CHAR_BUDGET);
}
