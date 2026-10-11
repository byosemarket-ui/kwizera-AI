/**
 * Forex AI Analysis Engine — Phase 17 foundation + Phase 20 grounding + Phase 38E evidence.
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
import { isSmallReasoningModel } from "../ai-provider/ollama-client.js";
import {
  formatEvidenceForPrompt,
  sanitizeAnalysisAgainstEvidence,
  type ForexAiEvidencePack,
  type ForexAiInferenceStatus,
} from "./evidence/index.js";
import { assembleGroundedMarketReadout } from "./grounded-fallback.js";
import { formatKnowledgeForPrompt, toKnowledgeSources } from "./knowledge-query.js";
import {
  buildForexAnalysisPrompt,
  buildForexAnalysisRepairPrompt,
  FOREX_AI_ENGINE_VERSION,
} from "./prompts.js";
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
      "Phase 38E grounds reasoning on detector evidence (patterns/structure).",
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

function mapInferenceStatus(code: OllamaHealthCode | "OK"): ForexAiInferenceStatus {
  switch (code) {
    case "OK":
      return "OK";
    case "OLLAMA_TIMEOUT":
      return "TIMEOUT";
    case "OLLAMA_INVALID_RESPONSE":
      return "FORMAT_ERROR";
    case "OLLAMA_DISABLED":
    case "OLLAMA_UNAVAILABLE":
    case "OLLAMA_MODEL_MISSING":
      return "UNAVAILABLE";
    default:
      return "UNAVAILABLE";
  }
}

function attachEvidence(
  analysis: NonNullable<ForexAiAnalyzeResult["analysis"]>,
  pack: ForexAiEvidencePack | undefined,
  inferenceLatencyMs: number | null,
  inferenceStatus: ForexAiInferenceStatus,
) {
  if (!pack) {
    analysis.inferenceLatencyMs = inferenceLatencyMs;
    analysis.inferenceStatus = inferenceStatus;
    return analysis;
  }
  const sanitized = sanitizeAnalysisAgainstEvidence(analysis, pack);
  sanitized.analysis.inferenceLatencyMs = inferenceLatencyMs;
  sanitized.analysis.inferenceStatus = inferenceStatus;
  return sanitized.analysis;
}

export interface AnalyzeForexMarketStateOptions {
  timeoutMs?: number;
  allowInsufficient?: boolean;
  knowledgeHits?: ForexKnowledgeRetrievalHit[];
  analysisType?: ForexAiAnalysisType;
  dataQualityStatus?: ForexAiDataQualityStatus;
  dataQualityStale?: boolean;
  evidencePack?: ForexAiEvidencePack | null;
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
      evidencePack: opts?.evidencePack ?? undefined,
    };
  }

  const market: ForexMarketState = validated.market;
  if (!opts?.allowInsufficient && !marketStateHasAnalyzableFacts(market)) {
    return {
      ok: false,
      code: "INSUFFICIENT_MARKET_DATA",
      analysis: null,
      latencyMs: Date.now() - started,
      error: "Market state has no analyzable provider-derived facts. Do not invent values.",
      evidencePack: opts?.evidencePack ?? undefined,
    };
  }

  const knowledgeHits = opts?.knowledgeHits ?? [];
  const knowledgeText = formatKnowledgeForPrompt(knowledgeHits);
  const analysisType = opts?.analysisType ?? "MARKET_OVERVIEW";
  const evidencePack = opts?.evidencePack ?? undefined;
  const evidenceText = evidencePack ? formatEvidenceForPrompt(evidencePack, 900) : "";
  const prompt = buildForexAnalysisPrompt({
    market,
    knowledgeText,
    analysisType,
    evidenceText,
  });

  const adapter = getOllamaAdapter();
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const genOptions = {
    temperature: 0.1,
    num_ctx: 2048,
    num_predict: 220,
  } as const;

  const inferenceStarted = Date.now();
  // Keep Forex prompts short: small context + short JSON for constrained local models.
  let generated = await adapter.generateStructured({
    prompt,
    timeoutMs,
    options: { ...genOptions },
  });

  // One controlled repair attempt when a small model returns non-JSON (no fake analysis).
  if (
    (!generated.ok || !generated.data)
    && generated.code === "OLLAMA_INVALID_RESPONSE"
    && generated.model
    && isSmallReasoningModel(generated.model)
  ) {
    generated = await adapter.generateStructured({
      prompt: buildForexAnalysisRepairPrompt(market),
      timeoutMs: Math.min(90_000, timeoutMs),
      options: { temperature: 0, num_ctx: 1536, num_predict: 180 },
    });
  }
  const inferenceLatencyMs = Date.now() - inferenceStarted;

  if (!generated.ok || !generated.data) {
    const code = mapGenerateError(generated.code);
    const inferenceStatus = mapInferenceStatus(generated.code);
    // Truthful degradation on format/timeout: Market State + evidence facts — never invent narrative.
    if (
      (code === "AI_FORMAT_ERROR" || code === "AI_TIMEOUT")
      && marketStateHasAnalyzableFacts(market)
    ) {
      const analysis = assembleGroundedMarketReadout({
        market,
        model: generated.model,
        knowledgeSources: toKnowledgeSources(knowledgeHits),
        analysisType,
        dataQualityStatus: opts?.dataQualityStatus ?? (market.live ? "LIVE" : "CONNECTED"),
        dataQualityStale: opts?.dataQualityStale ?? false,
        reason: generated.error ?? "Ollama returned non-JSON after repair attempt.",
        evidencePack,
        inferenceStatus,
        inferenceLatencyMs,
      });
      return {
        ok: true,
        code: "OK",
        analysis: attachEvidence(analysis, evidencePack, inferenceLatencyMs, inferenceStatus),
        latencyMs: Date.now() - started,
        evidencePack,
        diagnostics: {
          promptChars: prompt.length,
          knowledgeHits: knowledgeHits.length,
          model: generated.model,
          analysisType,
          inferenceLatencyMs,
          inferenceStatus,
        },
      };
    }
    return {
      ok: false,
      code,
      analysis: null,
      latencyMs: Date.now() - started,
      error: generated.error ?? "Ollama generation failed",
      evidencePack,
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        model: generated.model,
        analysisType,
        inferenceLatencyMs,
        inferenceStatus,
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
    if (marketStateHasAnalyzableFacts(market) && evidencePack) {
      const analysis = assembleGroundedMarketReadout({
        market,
        model: generated.model,
        knowledgeSources: toKnowledgeSources(knowledgeHits),
        analysisType,
        dataQualityStatus: opts?.dataQualityStatus ?? (market.live ? "LIVE" : "CONNECTED"),
        dataQualityStale: opts?.dataQualityStale ?? false,
        reason: parsed.error,
        evidencePack,
        inferenceStatus: "FORMAT_ERROR",
        inferenceLatencyMs,
      });
      return {
        ok: true,
        code: "OK",
        analysis: attachEvidence(analysis, evidencePack, inferenceLatencyMs, "FORMAT_ERROR"),
        latencyMs: Date.now() - started,
        evidencePack,
        diagnostics: {
          promptChars: prompt.length,
          knowledgeHits: knowledgeHits.length,
          model: generated.model,
          analysisType,
          inferenceLatencyMs,
          inferenceStatus: "FORMAT_ERROR",
        },
      };
    }
    return {
      ok: false,
      code: parsed.code,
      analysis: null,
      latencyMs: Date.now() - started,
      error: parsed.error,
      evidencePack,
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        model: generated.model,
        analysisType,
        inferenceLatencyMs,
        inferenceStatus: "FORMAT_ERROR",
      },
    };
  }

  return {
    ok: true,
    code: "OK",
    analysis: attachEvidence(parsed.analysis, evidencePack, inferenceLatencyMs, "OK"),
    latencyMs: Date.now() - started,
    evidencePack,
    diagnostics: {
      promptChars: prompt.length,
      knowledgeHits: knowledgeHits.length,
      model: generated.model,
      analysisType,
      inferenceLatencyMs,
      inferenceStatus: "OK",
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
  decisionEngine: string;
  evidenceSchema: string;
} {
  return {
    engineVersion: FOREX_AI_ENGINE_VERSION,
    authoritativeOllamaAdapter: "ai/ai-provider/ollama-adapter.ts",
    authoritativeOllamaClient: "ai/ai-provider/ollama-client.ts",
    modelConfig: "KWIZERA_OLLAMA_REASONING_MODEL / preferredReasoningModelId()",
    marketStateSource: "ai/forex-market-state (Phase 18)",
    knowledgeSource: "ai/forex-knowledge (Phase 19)",
    decisionEngine: "ai/forex-ai/decision (Phase 22)",
    evidenceSchema: "forex-ai-evidence-v1 (Phase 38E)",
  };
}
