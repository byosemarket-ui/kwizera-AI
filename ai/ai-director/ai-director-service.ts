/**
 * Step 7/8 — AI Director orchestration (status, diagnostics, plan review helpers).
 * Reuses existing Ollama client + CreativeReasoningProvider — no duplicate AI stack.
 */
import {
  fetchOllamaTags,
  ollamaBaseUrl,
  type OllamaServiceStatus,
} from "../ai-provider/ollama-client.js";
import {
  assessOllamaReadiness,
  toPublicOllamaReadiness,
  type PublicOllamaReadiness,
} from "../media-intelligence/ollama-readiness.js";
import { getCreativeReasoningProvider } from "../creative-planning/ai-creative-planner.js";
import { getVideoGenerationProvider } from "../video-production/video-generation-provider.js";
import type { AiDirectorProviderStatus } from "./ai-director-types.js";
import { describeIntelligencePipeline, type IntelligencePipelineDescription } from "./intelligence-pipeline.js";

export interface AiDirectorDiagnostics {
  ollama: {
    status: OllamaServiceStatus;
    configured: boolean;
    reachable: boolean;
    installedModelCount: number;
    selectedModel: string | null;
    latencyMs: number | null;
    recommendedAction: string;
    autoInstallDisabled: true;
  };
  creativeDirector: {
    providerId: string;
    status: AiDirectorProviderStatus;
    available: boolean;
    modelId: string | null;
    mode: "ai" | "deterministic-fallback";
  };
  videoGenerationProvider: {
    id: string;
    status: string;
    available: boolean;
  };
  pipeline: IntelligencePipelineDescription;
}

function mapProviderStatus(
  ollamaReady: boolean,
  modelAvailable: boolean,
  providerAvailable: boolean,
): AiDirectorProviderStatus {
  if (providerAvailable && modelAvailable) return "AVAILABLE";
  if (ollamaReady && !modelAvailable) return "MODEL_NOT_INSTALLED";
  if (!ollamaReady) return "UNAVAILABLE";
  return "ERROR";
}

export async function getAiDirectorDiagnostics(): Promise<AiDirectorDiagnostics> {
  const started = Date.now();
  const tags = await fetchOllamaTags({ baseUrl: ollamaBaseUrl() });
  const latencyMs = tags.ok ? Date.now() - started : null;
  const readiness = await assessOllamaReadiness();
  const provider = getCreativeReasoningProvider();
  const available = await provider.isAvailable().catch(() => false);
  const videoProvider = getVideoGenerationProvider();

  return {
    ollama: {
      status: tags.status,
      configured: true,
      reachable: tags.ok,
      installedModelCount: tags.models.length,
      selectedModel: readiness.selectedModel,
      latencyMs,
      recommendedAction: readiness.recommendedAction,
      autoInstallDisabled: true,
    },
    creativeDirector: {
      providerId: provider.id,
      status: mapProviderStatus(readiness.ollamaReachable, Boolean(readiness.selectedModel), available),
      available,
      modelId: provider.getLastModel?.() ?? readiness.selectedModel,
      mode: available ? "ai" : "deterministic-fallback",
    },
    videoGenerationProvider: {
      id: videoProvider.id,
      status: videoProvider.status,
      available: await videoProvider.isAvailable().catch(() => false),
    },
    pipeline: describeIntelligencePipeline(),
  };
}

export async function getAiDirectorStatusSummary(): Promise<{
  creativeDirector: AiDirectorDiagnostics["creativeDirector"];
  ollamaReady: boolean;
  ollamaNote: string;
  ollama: PublicOllamaReadiness;
  videoGenerationProvider: AiDirectorDiagnostics["videoGenerationProvider"];
  pipeline: IntelligencePipelineDescription;
}> {
  const diagnostics = await getAiDirectorDiagnostics();
  const readiness = await assessOllamaReadiness();
  return {
    creativeDirector: diagnostics.creativeDirector,
    ollamaReady: readiness.ready,
    ollamaNote: readiness.notes[0] ?? readiness.recommendedAction,
    ollama: toPublicOllamaReadiness(readiness),
    videoGenerationProvider: diagnostics.videoGenerationProvider,
    pipeline: diagnostics.pipeline,
  };
}
