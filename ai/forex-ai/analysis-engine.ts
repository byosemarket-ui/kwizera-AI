/**
 * Forex AI Analysis Engine — Phase 17 foundation + Phase 20 grounding.
 * Reuses the canonical OllamaAdapter; does not create a second Ollama client.
 */
import {
  getCachedOllamaHealth,
  getOllamaAdapter,
  type OllamaHealthCode,
  type OllamaHealthReport,
} from "../ai-provider/ollama-adapter.js";
import { preferredReasoningModelId } from "../ai-provider/ollama-client.js";
import type { ForexKnowledgeRetrievalHit } from "../forex-knowledge/types.js";
import { formatKnowledgeForPrompt, toKnowledgeSources } from "./knowledge-query.js";
import { buildForexAnalysisPrompt, FOREX_AI_ENGINE_VERSION } from "./prompts.js";
import type {
  ForexAiAnalysisType,
  ForexAiAnalyzeResult,
  ForexAiDataQualityStatus,
  ForexAiErrorCode,
  ForexAiHealthPublic,
  ForexAiHealthState,
  ForexMarketState,
} from "./types.js";
import {
  marketStateHasAnalyzableFacts,
  parseForexAiAnalysis,
  validateForexMarketState,
} from "./validate.js";

function mapHealthState(report: OllamaHealthReport): ForexAiHealthState {
  switch (report.code) {
    case "OLLAMA_READY":
      return "AI_READY";
    case "OLLAMA_DISABLED":
      return "AI_DISABLED";
    case "OLLAMA_MODEL_MISSING":
      return "MODEL_NOT_AVAILABLE";
    case "OLLAMA_TIMEOUT":
      return "AI_TIMEOUT";
    case "OLLAMA_UNAVAILABLE":
      return "AI_UNAVAILABLE";
    default:
      return "AI_ERROR";
  }
}

export function toPublicForexAiHealth(report: OllamaHealthReport): ForexAiHealthPublic {
  const state = mapHealthState(report);
  return {
    state,
    ready: report.ready && state === "AI_READY",
    model: report.model,
    preferredModel: preferredReasoningModelId(),
    installedModels: report.installedModels,
    latencyMs: report.latencyMs,
    probedInference: report.probedInference,
    baseUrlBound: "localhost",
    publicOllamaExposed: false,
    notes: [
      ...report.notes,
      "Forex AI uses the shared KWIZERA Ollama adapter (no second Ollama service).",
      "Browser never calls Ollama directly.",
      "Phase 20 analyzes Market State + published Forex knowledge only.",
    ],
    error: report.error,
    ollamaCode: report.code,
  };
}

export async function getForexAiHealth(opts?: {
  probeInference?: boolean;
}): Promise<ForexAiHealthPublic> {
  const report = await getCachedOllamaHealth({
    probeInference: opts?.probeInference ?? false,
    maxAgeMs: 60_000,
  });
  return toPublicForexAiHealth(report);
}

function mapGenerateError(code: OllamaHealthCode | "OK"): ForexAiErrorCode {
  switch (code) {
    case "OLLAMA_DISABLED":
      return "AI_DISABLED";
    case "OLLAMA_UNAVAILABLE":
      return "AI_UNAVAILABLE";
    case "OLLAMA_MODEL_MISSING":
      return "MODEL_NOT_AVAILABLE";
    case "OLLAMA_TIMEOUT":
      return "AI_TIMEOUT";
    case "OLLAMA_INVALID_RESPONSE":
      return "AI_FORMAT_ERROR";
    default:
      return "AI_ERROR";
  }
}

export interface AnalyzeForexMarketStateOptions {
  timeoutMs?: number;
  allowInsufficient?: boolean;
  knowledgeHits?: ForexKnowledgeRetrievalHit[];
  analysisType?: ForexAiAnalysisType;
  dataQualityStatus?: ForexAiDataQualityStatus;
  dataQualityStale?: boolean;
}

/**
 * Run structured Forex analysis against a supplied market state.
 * Does not fetch Binance data. Does not invent missing market numbers.
 */
export async function analyzeForexMarketState(
  input: unknown,
  opts?: AnalyzeForexMarketStateOptions,
): Promise<ForexAiAnalyzeResult> {
  const started = Date.now();
  const validated = validateForexMarketState(input);
  if (!validated.ok) {
    return {
      ok: false,
      code: validated.code,
      analysis: null,
      latencyMs: Date.now() - started,
      error: validated.error,
    };
  }

  const market: ForexMarketState = validated.market;
  if (!opts?.allowInsufficient && !marketStateHasAnalyzableFacts(market)) {
    return {
      ok: false,
      code: "INSUFFICIENT_MARKET_DATA",
      analysis: null,
      latencyMs: Date.now() - started,
      error: "Market state has no analyzable Binance-derived facts. Do not invent values.",
    };
  }

  const knowledgeHits = opts?.knowledgeHits ?? [];
  const knowledgeText = formatKnowledgeForPrompt(knowledgeHits);
  const analysisType = opts?.analysisType ?? "MARKET_OVERVIEW";
  const prompt = buildForexAnalysisPrompt({
    market,
    knowledgeText,
    analysisType,
  });

  const adapter = getOllamaAdapter();
  // Keep Forex prompts short: small context + short JSON for constrained local models.
  const generated = await adapter.generateStructured({
    prompt,
    timeoutMs: opts?.timeoutMs ?? 120_000,
    options: {
      temperature: 0.1,
      num_ctx: 2048,
      num_predict: 280,
    },
  });

  if (!generated.ok || !generated.data) {
    return {
      ok: false,
      code: mapGenerateError(generated.code),
      analysis: null,
      latencyMs: generated.latencyMs,
      error: generated.error ?? "Ollama generation failed",
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        model: generated.model,
        analysisType,
      },
    };
  }

  const parsed = parseForexAiAnalysis(generated.data, {
    market,
    model: generated.model,
    knowledgeSources: toKnowledgeSources(knowledgeHits),
    analysisType,
    dataQualityStatus: opts?.dataQualityStatus,
    dataQualityStale: opts?.dataQualityStale,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      code: parsed.code,
      analysis: null,
      latencyMs: generated.latencyMs,
      error: parsed.error,
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        model: generated.model,
        analysisType,
      },
    };
  }

  return {
    ok: true,
    code: "OK",
    analysis: parsed.analysis,
    latencyMs: generated.latencyMs,
    diagnostics: {
      promptChars: prompt.length,
      knowledgeHits: knowledgeHits.length,
      model: generated.model,
      analysisType,
    },
  };
}

export function forexAiEngineMeta(): {
  engineVersion: string;
  authoritativeOllamaAdapter: string;
  authoritativeOllamaClient: string;
  modelConfig: string;
  marketStateSource: string;
  knowledgeSource: string;
} {
  return {
    engineVersion: FOREX_AI_ENGINE_VERSION,
    authoritativeOllamaAdapter: "ai/ai-provider/ollama-adapter.ts",
    authoritativeOllamaClient: "ai/ai-provider/ollama-client.ts",
    modelConfig: "KWIZERA_OLLAMA_REASONING_MODEL / preferredReasoningModelId()",
    marketStateSource: "ai/forex-market-state (Phase 18)",
    knowledgeSource: "ai/forex-knowledge (Phase 19)",
  };
}
