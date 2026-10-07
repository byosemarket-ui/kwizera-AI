/**
 * Phase 24 — Compact labeled context: CURRENT facts + Knowledge + Memory.
 * Current Market State always wins. Memory is historical only.
 */
import { formatKnowledgeForPrompt, toKnowledgeSources } from "../knowledge-query.js";
import type { ForexKnowledgeRetrievalHit } from "../../forex-knowledge/types.js";
import {
  formatMemoryContextForPrompt,
  type ForexMemoryContextExample,
  type ForexMemoryContextPack,
} from "../../forex-memory/index.js";
import {
  FOREX_INTELLIGENCE_KNOWLEDGE_CHAR_BUDGET,
  FOREX_INTELLIGENCE_MEMORY_CHAR_BUDGET,
  FOREX_INTELLIGENCE_MEMORY_MAX_EXAMPLES,
  FOREX_AI_PROMPT_VERSION_V24,
} from "./config.js";

export interface ForexMemorySourceRef {
  memoryId: string;
  symbol: string;
  timeframe: string | null;
  scenario: string | null;
  outcome: string;
  relevance: string;
  timestamp: string;
}

export interface ForexIntelligenceContextPack {
  promptVersion: typeof FOREX_AI_PROMPT_VERSION_V24;
  knowledgeText: string;
  memoryText: string;
  knowledgeSources: ReturnType<typeof toKnowledgeSources>;
  memorySources: ForexMemorySourceRef[];
  memoryUnavailable: boolean;
  knowledgeUnavailable: boolean;
  labeledSections: {
    current: string;
    knowledge: string;
    memory: string;
  };
  limitations: string[];
}

function clip(s: string, n: number): string {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, Math.max(0, n - 1))}…`;
}

function relevanceLabel(score: number): string {
  if (score >= 8) return "HIGH";
  if (score >= 5) return "MEDIUM";
  if (score > 0) return "LOW";
  return "CONTEXTUAL";
}

export function toMemorySources(pack: ForexMemoryContextPack | null): ForexMemorySourceRef[] {
  if (!pack) return [];
  return pack.examples.slice(0, FOREX_INTELLIGENCE_MEMORY_MAX_EXAMPLES).map((e: ForexMemoryContextExample) => ({
    memoryId: e.analysisId,
    symbol: e.symbol,
    timeframe: null,
    scenario: e.scenario,
    outcome: e.outcome,
    relevance: relevanceLabel(e.score),
    timestamp: e.generatedAt,
  }));
}

export function buildIntelligenceContext(input: {
  currentFactsLine: string;
  knowledgeHits: ForexKnowledgeRetrievalHit[];
  memoryPack: ForexMemoryContextPack | null;
  knowledgeError?: boolean;
  memoryError?: boolean;
}): ForexIntelligenceContextPack {
  const knowledgeSources = toKnowledgeSources(input.knowledgeHits);
  let knowledgeText = formatKnowledgeForPrompt(input.knowledgeHits);
  knowledgeText = clip(knowledgeText || "None", FOREX_INTELLIGENCE_KNOWLEDGE_CHAR_BUDGET);

  let memoryText = "HISTORICAL MEMORY — NOT CURRENT MARKET DATA: none";
  if (input.memoryPack && input.memoryPack.examples.length > 0) {
    memoryText = clip(
      formatMemoryContextForPrompt({
        ...input.memoryPack,
        examples: input.memoryPack.examples.slice(0, FOREX_INTELLIGENCE_MEMORY_MAX_EXAMPLES),
      }),
      FOREX_INTELLIGENCE_MEMORY_CHAR_BUDGET,
    );
  }

  const limitations = [
    "CURRENT MARKET STATE — AUTHORITATIVE.",
    "KNOWLEDGE BASE — METHODOLOGY / REFERENCE only.",
    "HISTORICAL MEMORY — NOT CURRENT MARKET DATA.",
    "Do not inherit directional bias from memory outcomes.",
    "confidence remains null.",
  ];
  if (input.knowledgeError) limitations.push("Knowledge retrieval unavailable for this analysis.");
  if (input.memoryError) limitations.push("Memory retrieval unavailable for this analysis.");

  return {
    promptVersion: FOREX_AI_PROMPT_VERSION_V24,
    knowledgeText,
    memoryText,
    knowledgeSources,
    memorySources: toMemorySources(input.memoryPack),
    memoryUnavailable: Boolean(input.memoryError),
    knowledgeUnavailable: Boolean(input.knowledgeError),
    labeledSections: {
      current: `CURRENT MARKET STATE — AUTHORITATIVE:\n${input.currentFactsLine}`,
      knowledge: `KNOWLEDGE BASE — METHODOLOGY / REFERENCE:\n${knowledgeText}`,
      memory: memoryText.startsWith("HISTORICAL MEMORY")
        ? memoryText
        : `HISTORICAL MEMORY — NOT CURRENT MARKET DATA:\n${memoryText}`,
    },
    limitations,
  };
}

/** Merge labeled sections into a compact prompt body under a char budget. */
export function assembleLabeledPromptBody(input: {
  header: string;
  currentFacts: string;
  knowledgeText: string;
  memoryText: string;
  budget: number;
}): string {
  let knowledge = input.knowledgeText.trim() || "None";
  let memory = input.memoryText.trim() || "none";
  const build = () => [
    input.header,
    "CURRENT MARKET STATE — AUTHORITATIVE:",
    input.currentFacts,
    "KNOWLEDGE BASE — METHODOLOGY / REFERENCE:",
    knowledge,
    "HISTORICAL MEMORY — NOT CURRENT MARKET DATA:",
    memory,
  ].join("\n");

  let prompt = build();
  while (prompt.length > input.budget && memory.length > 40) {
    memory = memory.slice(0, Math.floor(memory.length * 0.7));
    prompt = build();
  }
  while (prompt.length > input.budget && knowledge.length > 40) {
    knowledge = knowledge.slice(0, Math.floor(knowledge.length * 0.7));
    prompt = build();
  }
  if (prompt.length > input.budget) prompt = prompt.slice(0, input.budget);
  return prompt;
}
