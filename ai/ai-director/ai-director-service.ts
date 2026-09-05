/**
 * Step 7/8/9 — AI Director orchestration (status, diagnostics, plan review helpers).
 * Reuses existing Ollama client + CreativeReasoningProvider — no duplicate AI stack.
 */
import {
  type OllamaServiceStatus,
} from "../ai-provider/ollama-client.js";
import { getCachedOllamaHealth } from "../ai-provider/ollama-adapter.js";
import {
  assessOllamaReadiness,
  toPublicOllamaReadiness,
  type OllamaReadinessReport,
  type PublicOllamaReadiness,
} from "../media-intelligence/ollama-readiness.js";
import { getCreativeReasoningProvider } from "../creative-planning/ai-creative-planner.js";
import { getVideoGenerationProvider } from "../video-production/video-generation-provider.js";
import { getVideoKnowledgePackMeta } from "../video-knowledge-engine/video-knowledge-pack.js";
import { VIDEO_SKILLS_VERSION, listVideoSkills } from "../video-skills/video-skills.js";
import { CREATIVE_ADVISOR_VERSION } from "../creative-planning/ollama-creative-advisor.js";
import type { AiDirectorProviderStatus } from "./ai-director-types.js";
import { describeIntelligencePipeline, type IntelligencePipelineDescription } from "./intelligence-pipeline.js";

export interface AiDirectorDiagnostics {
  ollama: {
    status: OllamaServiceStatus;
    installationStatus: OllamaReadinessReport["installationStatus"];
    configured: boolean;
    disabled: boolean;
    reachable: boolean;
    installedModelCount: number;
    selectedModel: string | null;
    latencyMs: number | null;
    recommendedAction: string;
    fallbackActive: boolean;
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

function mapProviderStatus(input: {
  disabled: boolean;
  ollamaReachable: boolean;
  modelAvailable: boolean;
  providerAvailable: boolean;
  ready: boolean;
}): AiDirectorProviderStatus {
  if (input.disabled) return "DISABLED";
  if (input.providerAvailable && input.ready) return "AVAILABLE";
  if (input.ollamaReachable && !input.modelAvailable) return "MODEL_NOT_INSTALLED";
  if (!input.ollamaReachable) return "UNAVAILABLE";
  return "FALLBACK_ACTIVE";
}

function buildDiagnostics(
  readiness: OllamaReadinessReport,
  latencyMs: number | null,
  providerAvailable: boolean,
  providerId: string,
  providerModel: string | null,
  video: { id: string; status: string; available: boolean },
): AiDirectorDiagnostics {
  return {
    ollama: {
      status: readiness.status,
      installationStatus: readiness.installationStatus,
      configured: !readiness.disabled,
      disabled: readiness.disabled,
      reachable: readiness.ollamaReachable,
      installedModelCount: readiness.installedModels.length,
      selectedModel: readiness.selectedModel,
      latencyMs,
      recommendedAction: readiness.recommendedAction,
      fallbackActive: readiness.fallbackActive,
      autoInstallDisabled: true,
    },
    creativeDirector: {
      providerId,
      status: mapProviderStatus({
        disabled: readiness.disabled,
        ollamaReachable: readiness.ollamaReachable,
        modelAvailable: Boolean(readiness.selectedModel),
        providerAvailable,
        ready: readiness.ready,
      }),
      available: providerAvailable,
      modelId: providerModel ?? readiness.selectedModel,
      mode: providerAvailable ? "ai" : "deterministic-fallback",
    },
    videoGenerationProvider: video,
    pipeline: describeIntelligencePipeline(),
  };
}

export async function getAiDirectorDiagnostics(): Promise<AiDirectorDiagnostics> {
  const started = Date.now();
  const readiness = await assessOllamaReadiness();
  const latencyMs = readiness.ollamaReachable ? Date.now() - started : null;
  const provider = getCreativeReasoningProvider();
  const available = await provider.isAvailable().catch(() => false);
  const videoProvider = getVideoGenerationProvider();
  return buildDiagnostics(
    readiness,
    latencyMs,
    available,
    provider.id,
    provider.getLastModel?.() ?? null,
    {
      id: videoProvider.id,
      status: videoProvider.status,
      available: await videoProvider.isAvailable().catch(() => false),
    },
  );
}

export async function getAiDirectorStatusSummary(): Promise<{
  creativeDirector: AiDirectorDiagnostics["creativeDirector"];
  ollamaReady: boolean;
  ollamaNote: string;
  ollama: PublicOllamaReadiness;
  ollamaAdapter: {
    code: string;
    ready: boolean;
    model: string | null;
    latencyMs: number | null;
    probedInference: boolean;
  };
  videoKnowledge: { ready: true; version: string; count: number };
  videoSkills: { ready: true; version: string; count: number };
  creativeAdvisor: { version: string; role: "advisor-only" };
  videoGenerationProvider: AiDirectorDiagnostics["videoGenerationProvider"];
  pipeline: IntelligencePipelineDescription;
}> {
  const started = Date.now();
  const readiness = await assessOllamaReadiness();
  const latencyMs = readiness.ollamaReachable ? Date.now() - started : null;
  const provider = getCreativeReasoningProvider();
  const available = await provider.isAvailable().catch(() => false);
  const videoProvider = getVideoGenerationProvider();
  const diagnostics = buildDiagnostics(
    readiness,
    latencyMs,
    available,
    provider.id,
    provider.getLastModel?.() ?? null,
    {
      id: videoProvider.id,
      status: videoProvider.status,
      available: await videoProvider.isAvailable().catch(() => false),
    },
  );
  // Status must not block on inference probes (1-vCPU hosts). Deep probe stays on diagnostics/cache opt-in.
  const adapterHealth = await getCachedOllamaHealth({ probeInference: false });
  const knowledge = getVideoKnowledgePackMeta();
  return {
    creativeDirector: diagnostics.creativeDirector,
    ollamaReady: readiness.ready && adapterHealth.ready,
    ollamaNote: adapterHealth.notes[0] ?? readiness.notes[0] ?? readiness.recommendedAction,
    ollama: toPublicOllamaReadiness(readiness),
    ollamaAdapter: {
      code: adapterHealth.code,
      ready: adapterHealth.ready,
      model: adapterHealth.model,
      latencyMs: adapterHealth.latencyMs,
      probedInference: adapterHealth.probedInference,
    },
    videoKnowledge: { ready: true, version: knowledge.version, count: knowledge.count },
    videoSkills: { ready: true, version: VIDEO_SKILLS_VERSION, count: listVideoSkills().length },
    creativeAdvisor: { version: CREATIVE_ADVISOR_VERSION, role: "advisor-only" },
    videoGenerationProvider: diagnostics.videoGenerationProvider,
    pipeline: diagnostics.pipeline,
  };
}
