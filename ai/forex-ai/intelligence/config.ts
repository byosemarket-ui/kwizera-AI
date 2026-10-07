/**
 * Phase 24 — Forex AI Intelligence Control configuration constants.
 * External memory + RAG only. No model-weight training.
 */
export const FOREX_AI_PROMPT_VERSION_V24 = "forex-ai-prompt-v24";
export const FOREX_INTELLIGENCE_ENGINE_VERSION = "forex-intelligence-engine-v1";
export const FOREX_INTELLIGENCE_CONFIG_VERSION = "forex-intelligence-config-v1";

/** Keep overall prompt budget aligned with Phase 21/22 — do not inflate for 1b. */
export const FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET = 2800;
export const FOREX_INTELLIGENCE_MEMORY_CHAR_BUDGET = 420;
export const FOREX_INTELLIGENCE_KNOWLEDGE_CHAR_BUDGET = 500;
export const FOREX_INTELLIGENCE_MEMORY_MAX_EXAMPLES = 3;

export const FOREX_INTELLIGENCE_DEFAULT_SETTINGS = {
  knowledgeRagEnabled: true,
  memoryRetrievalEnabled: true,
  memoryMaxExamples: FOREX_INTELLIGENCE_MEMORY_MAX_EXAMPLES,
  compactPromptMode: true,
  promptCharBudget: FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
} as const;

export type ForexIntelligenceSettings = {
  knowledgeRagEnabled: boolean;
  memoryRetrievalEnabled: boolean;
  memoryMaxExamples: number;
  compactPromptMode: boolean;
  promptCharBudget: number;
};
