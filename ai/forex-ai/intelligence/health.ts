/**
 * Phase 24 — Forex AI system health snapshot (read-only, sanitized).
 */
import { getCachedOllamaHealth, getOllamaAdapter } from "../../ai-provider/ollama-adapter.js";
import { getForexKnowledgeService } from "../../forex-knowledge/index.js";
import { getForexMemoryService } from "../../forex-memory/index.js";
import {
  FOREX_AI_PROMPT_VERSION_V24,
  FOREX_INTELLIGENCE_ENGINE_VERSION,
  FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
} from "./config.js";
import { getForexIntelligenceSettingsService } from "./settings.js";
import { FOREX_DECISION_ENGINE_VERSION, FOREX_DECISION_PROMPT_VERSION } from "../decision/config.js";

function isInternalOllamaHost(baseUrl: string): boolean {
  try {
    const u = new URL(baseUrl);
    return u.hostname === "127.0.0.1" || u.hostname === "localhost" || u.hostname === "::1";
  } catch {
    return false;
  }
}

export async function buildForexAiSystemHealth(opts?: { probeInference?: boolean }) {
  const adapter = getOllamaAdapter();
  const health = await getCachedOllamaHealth({
    probeInference: opts?.probeInference !== false,
  });
  const settings = await getForexIntelligenceSettingsService().getSettings();
  const knowledge = getForexKnowledgeService();
  await knowledge.ensureReady();
  const overview = await knowledge.getOverview();
  const memory = getForexMemoryService();
  await memory.ensureReady();
  const memOverview = await memory.overview();
  const learning = await memory.getLearning();
  const diagnostics = await memory.memoryDiagnostics();

  const modelPerf = learning.modelPerformance[0];
  const internalOnly = isInternalOllamaHost(adapter.getBaseUrl());

  return {
    schemaVersion: "forex-ai-health-v1",
    generatedAt: new Date().toISOString(),
    modelTraining: {
      active: false,
      note: "MODEL TRAINING: Not active. Ollama weights are never modified by Forex Admin.",
    },
    memoryLearning: {
      active: true,
      note: "MEMORY LEARNING: Active — external journal / outcome / mistake analytics only.",
    },
    knowledgeRetrieval: {
      active: settings.knowledgeRagEnabled,
      note: "KNOWLEDGE RETRIEVAL: Active when RAG enabled — methodology / reference only.",
    },
    model: {
      provider: "ollama",
      modelId: health.model ?? adapter.getPreferredModel(),
      preferredModel: adapter.getPreferredModel(),
      availability: health.ready,
      status: health.status,
      code: health.code,
      lastHealthCheck: new Date().toISOString(),
      latencyMs: health.latencyMs,
      installedModels: health.installedModels,
      notes: health.notes,
    },
    ollama: {
      reachable: health.ready || health.code === "OLLAMA_MODEL_MISSING",
      inferenceAvailable: health.ready && health.probedInference,
      latencyMs: health.latencyMs,
      exposure: internalOnly ? "INTERNAL_ONLY" : "NON_LOCAL_HOST",
      publicPortExposed: false,
      hostDisplay: internalOnly ? "127.0.0.1 (internal)" : "configured-host (server-side only)",
      note: "Ollama must remain internal. Port 11434 is not exposed publicly by this control center.",
    },
    prompt: {
      promptVersion: FOREX_DECISION_PROMPT_VERSION,
      intelligencePromptVersion: FOREX_AI_PROMPT_VERSION_V24,
      compactPromptMode: settings.compactPromptMode,
      promptBudget: settings.promptCharBudget,
      maxBudget: FOREX_INTELLIGENCE_PROMPT_CHAR_BUDGET,
      systemInstructionVersion: FOREX_INTELLIGENCE_ENGINE_VERSION,
    },
    knowledge: {
      ragEnabled: settings.knowledgeRagEnabled,
      retrievalLimit: 2,
      publishedRequirement: true,
      indexedRequirement: true,
      documents: overview.documents,
      published: overview.published,
      drafts: overview.drafts,
      archived: overview.archived,
      indexedChunks: overview.chunks,
      stale: overview.stale,
      failed: overview.failed,
      indexed: overview.indexed,
    },
    memory: {
      memoryEnabled: true,
      memoryRetrievalEnabled: settings.memoryRetrievalEnabled,
      maxMemoryExamples: settings.memoryMaxExamples,
      totalAnalyses: memOverview.analyses as number,
      outcomes: memOverview.outcomes as number,
      mistakes: memOverview.mistakes as number,
      pending: memOverview.pendingOutcomes as number,
      diagnostics,
    },
    decision: {
      scenarioEngine: "ACTIVE",
      confirmationEngine: "ACTIVE",
      invalidationEngine: "ACTIVE",
      riskEngine: "ACTIVE",
      engineVersion: FOREX_DECISION_ENGINE_VERSION,
    },
    aiPerformance: {
      sampleSize: modelPerf?.sampleSize ?? 0,
      averageLatencyMs: modelPerf?.avgLatencyMs ?? null,
      fallbackRate: modelPerf?.fallbackRate ?? null,
      statisticalConfidence: modelPerf?.statisticalConfidence ?? "INSUFFICIENT_SAMPLE",
      note: "Trading performance: NOT AVAILABLE (no broker execution).",
    },
    settings,
  };
}
