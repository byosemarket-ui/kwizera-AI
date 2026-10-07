/**
 * Truthful deterministic-only fallback when Ollama fails.
 */
import type { ForexAiKnowledgeSource } from "../types.js";
import type { ForexDecisionAnalysis, ForexDecisionDeterministicPack } from "./types.js";
import { assembleDecisionAnalysis } from "./validate.js";

export function assembleDecisionDeterministicOnly(input: {
  pack: ForexDecisionDeterministicPack;
  knowledgeSources: ForexAiKnowledgeSource[];
  model: string | null;
  reason: string;
}): ForexDecisionAnalysis {
  return assembleDecisionAnalysis({
    pack: input.pack,
    narrativeStatus: "DETERMINISTIC_ONLY",
    aiInterpretation: null,
    knowledgeSources: input.knowledgeSources,
    model: input.model,
    extraLimitations: [
      `AI narrative unavailable: ${input.reason}`,
      "Showing deterministic scenario / entry / confirmation / invalidation only.",
    ],
  });
}
