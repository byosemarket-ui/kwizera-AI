/**
 * Step 7 — AI Director orchestration (status, diagnostics, plan review helpers).
 * Reuses existing Ollama client + CreativeReasoningProvider — no duplicate AI stack.
 */
import {
  fetchOllamaTags,
  ollamaBaseUrl,
  type OllamaServiceStatus,
} from "../ai-provider/ollama-client.js";
import { assessOllamaReadiness } from "../media-intelligence/ollama-readiness.js";
import { getCreativeReasoningProvider } from "../creative-planning/ai-creative-planner.js";
import { getVideoGenerationProvider } from "../video-production/video-generation-provider.js";
import type { AiDirectorProviderStatus } from "./ai-director-types.js";

export interface AiDirectorDiagnostics {
  ollama: {
    status: OllamaServiceStatus;
    baseUrl: string;
    reachable: boolean;
    installedModels: string[];
    selectedModel: string | null;
    latencyMs: number | null;
    recommendedAction: string;
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
  const baseUrl = ollamaBaseUrl();
  const started = Date.now();
  const tags = await fetchOllamaTags({ baseUrl });
  const latencyMs = tags.ok ? Date.now() - started : null;
  const readiness = await assessOllamaReadiness();
  const provider = getCreativeReasoningProvider();
  const available = await provider.isAvailable().catch(() => false);
  const videoProvider = getVideoGenerationProvider();

  return {
    ollama: {
      status: tags.status,
      baseUrl,
      reachable: tags.ok,
      installedModels: tags.models.map((m) => m.name),
      selectedModel: readiness.selectedModel,
      latencyMs,
      recommendedAction: readiness.recommendedAction,
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
  };
}

export async function getAiDirectorStatusSummary(): Promise<{
  creativeDirector: AiDirectorDiagnostics["creativeDirector"];
  ollamaReady: boolean;
  ollamaNote: string;
  ollama: Awaited<ReturnType<typeof assessOllamaReadiness>>;
  videoGenerationProvider: AiDirectorDiagnostics["videoGenerationProvider"];
}> {
  const diagnostics = await getAiDirectorDiagnostics();
  const readiness = await assessOllamaReadiness();
  return {
    creativeDirector: diagnostics.creativeDirector,
    ollamaReady: readiness.ready,
    ollamaNote: readiness.notes.join(" "),
    ollama: readiness,
    videoGenerationProvider: diagnostics.videoGenerationProvider,
  };
}
