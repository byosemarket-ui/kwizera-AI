/**
 * Ollama-ready intelligence boundary.
 *
 * Do not install Ollama or download models from this module.
 * Future Ollama connection must plug into the existing CreativeReasoningProvider
 * seam — never a second planner, renderer, or project store.
 *
 *   AI / intelligence request
 *           ↓
 *   CreativeReasoningProvider (Ollama when available, else unconfigured)
 *           ↓
 *   parseJsonObject (normalize)
 *           ↓
 *   validateAiPlannerOutput
 *           ↓
 *   generateCreativeScenes (system decision + deterministic fallback)
 *           ↓
 *   FFmpeg VideoProductionManager (unchanged renderer)
 */
import { getCreativeReasoningProvider } from "../creative-planning/ai-creative-planner.js";
import { validateAiPlannerOutput } from "../creative-planning/plan-validator.js";
import { parseJsonObject } from "../ai-provider/ollama-client.js";

export const OLLAMA_INSTALL_ALLOWED = false;

export interface IntelligencePipelineDescription {
  installOllamaNow: false;
  autoDownloadModels: false;
  providerSeam: "setCreativeReasoningProvider";
  clientModule: "ai/ai-provider/ollama-client.ts";
  validatorModule: "ai/creative-planning/plan-validator.ts";
  plannerModule: "ai/creative-planning/ai-creative-planner.ts";
  rendererModule: "ai/video-production/video-production-manager.ts";
  fallback: "deterministic";
  providerId: string;
}

export function describeIntelligencePipeline(): IntelligencePipelineDescription {
  return {
    installOllamaNow: false,
    autoDownloadModels: false,
    providerSeam: "setCreativeReasoningProvider",
    clientModule: "ai/ai-provider/ollama-client.ts",
    validatorModule: "ai/creative-planning/plan-validator.ts",
    plannerModule: "ai/creative-planning/ai-creative-planner.ts",
    rendererModule: "ai/video-production/video-production-manager.ts",
    fallback: "deterministic",
    providerId: getCreativeReasoningProvider().id,
  };
}

export function normalizeIntelligenceResponse(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") return parseJsonObject(raw);
  return null;
}

export function validateNormalizedPlan(
  raw: unknown,
  opts: {
    projectId: string;
    allowedAssetIds: string[];
    targetDurationSeconds: number;
    productionMode?: import("../video-production/production-mode-types.js").ProductionModeId;
  },
) {
  const normalized = normalizeIntelligenceResponse(raw);
  if (!normalized) {
    return { valid: false as const, errors: ["INVALID_AI_OUTPUT"], warnings: [] as string[], scenes: [] };
  }
  return validateAiPlannerOutput(normalized, opts);
}
