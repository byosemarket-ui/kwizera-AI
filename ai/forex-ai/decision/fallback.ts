/**
 * Truthful deterministic-only fallback when Ollama fails.
 */
import type { ForexAiKnowledgeSource } from "../types.js";
import type { ForexMemorySourceRef } from "../intelligence/context-builder.js";
import type { ForexDecisionAnalysis, ForexDecisionDeterministicPack } from "./types.js";
import { assembleDecisionAnalysis } from "./validate.js";

export function assembleDecisionDeterministicOnly(input: {
  pack: ForexDecisionDeterministicPack;
  knowledgeSources: ForexAiKnowledgeSource[];
  memorySources?: ForexMemorySourceRef[];
  model: string | null;
  reason: string;
  memoryUnavailable?: boolean;
  knowledgeUnavailable?: boolean;
  extraLimitations?: string[];
}): ForexDecisionAnalysis {
  return assembleDecisionAnalysis({
    pack: input.pack,
    narrativeStatus: "DETERMINISTIC_ONLY",
    aiInterpretation: null,
    knowledgeSources: input.knowledgeSources,
    memorySources: input.memorySources ?? [],
    memoryUnavailable: input.memoryUnavailable,
    knowledgeUnavailable: input.knowledgeUnavailable,
    model: input.model,
    extraLimitations: [
      `AI narrative unavailable: ${input.reason}`,
      "Showing deterministic scenario / entry / confirmation / invalidation only.",
      ...(input.extraLimitations ?? []),
    ],
  });
}
