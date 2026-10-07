/**
 * Phase 22/24 — Decision orchestrator with Knowledge RAG + controlled Memory context.
 * Reuses Phase 18 Market State, Phase 19 knowledge, Phase 20 Ollama, Phase 21 MTF, Phase 23 memory.
 */
import { getForexKnowledgeService } from "../../forex-knowledge/index.js";
import type { ForexKnowledgeRetrievalHit } from "../../forex-knowledge/types.js";
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../../market-data/binance/service.js";
import { userFacingBinanceError } from "../../market-data/binance/errors.js";
import { getOllamaAdapter } from "../../ai-provider/ollama-adapter.js";
import { isSmallReasoningModel } from "../../ai-provider/ollama-client.js";
import { getForexMemoryService } from "../../forex-memory/index.js";
import type { ForexMemoryContextPack } from "../../forex-memory/types.js";
import { FOREX_AI_KNOWLEDGE_TOP_K } from "../knowledge-query.js";
import { computeMtfAlignment } from "../mtf/alignment.js";
import { buildMultiTimeframeMarketState, resolveMtfTimeframes } from "../mtf/build-state.js";
import { buildIntelligenceContext } from "../intelligence/context-builder.js";
import { getForexIntelligenceSettingsService } from "../intelligence/settings.js";
import { formatDecisionFactsBlock } from "./compact.js";
import { FOREX_DECISION_REQUIRED } from "./config.js";
import { runDeterministicDecisionEngines } from "./decision-engine.js";
import { assembleDecisionDeterministicOnly } from "./fallback.js";
import { buildDecisionAnalysisPrompt, buildDecisionRepairPrompt } from "./prompts.js";
import type { ForexDecisionAnalyzeRequest, ForexDecisionAnalyzeResult } from "./types.js";
import { parseDecisionAiNarrative } from "./validate.js";

let defaultBinance: BinanceMarketDataService | null = null;

function getBinance(): BinanceMarketDataService {
  defaultBinance ??= createBinanceMarketDataService();
  return defaultBinance;
}

export async function runForexDecisionAnalysis(
  request: ForexDecisionAnalyzeRequest,
  deps?: { binance?: BinanceMarketDataService; nowMs?: number },
): Promise<ForexDecisionAnalyzeResult> {
  const started = Date.now();
  const symbol = String(request.symbol ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,30}$/.test(symbol)) {
    return {
      ok: false,
      code: "INVALID_MARKET_STATE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: "symbol must be a Binance-style compact symbol (e.g. BTCUSDT).",
    };
  }

  const resolved = resolveMtfTimeframes(request.timeframes);
  if (!resolved.ok) {
    return {
      ok: false,
      code: "UNSUPPORTED_TIMEFRAME",
      analysis: null,
      latencyMs: Date.now() - started,
      error: resolved.error,
    };
  }

  const marketStateStarted = Date.now();
  let mtf;
  try {
    mtf = await buildMultiTimeframeMarketState({
      symbol,
      timeframes: resolved.timeframes,
      binance: deps?.binance ?? getBinance(),
      nowMs: deps?.nowMs,
      required: FOREX_DECISION_REQUIRED.filter((tf) => resolved.timeframes.includes(tf)),
    });
  } catch (error) {
    const mapped = userFacingBinanceError(error);
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: mapped.message,
    };
  }
  const marketStateMs = Date.now() - marketStateStarted;

  for (const slot of mtf.slots) {
    if (slot.marketState && slot.marketState.symbol !== symbol) {
      return {
        ok: false,
        code: "INVALID_MARKET_STATE",
        analysis: null,
        latencyMs: Date.now() - started,
        error: `Cross-symbol contamination detected for ${slot.timeframe}.`,
      };
    }
  }

  const detStarted = Date.now();
  const alignment = computeMtfAlignment(
    mtf.slots.map((s) => s.compact),
    mtf.required,
  );
  const pack = runDeterministicDecisionEngines(mtf, alignment);
  const deterministicMs = Date.now() - detStarted;

  const settings = await getForexIntelligenceSettingsService().getSettings();

  const knowledgeQuery = String(request.knowledgeQuery ?? "").trim()
    || `scenario entry confirmation invalidation risk market structure pullback ${pack.scenario.type}`;

  let knowledgeHits: ForexKnowledgeRetrievalHit[] = [];
  let knowledgeError = false;
  if (settings.knowledgeRagEnabled) {
    try {
      knowledgeHits = await getForexKnowledgeService().retrieveRelevantForexKnowledge({
        query: knowledgeQuery,
        limit: Math.min(2, FOREX_AI_KNOWLEDGE_TOP_K),
      });
    } catch {
      knowledgeHits = [];
      knowledgeError = true;
    }
  }

  let memoryPack: ForexMemoryContextPack | null = null;
  let memoryError = false;
  const memoryStarted = Date.now();
  if (settings.memoryRetrievalEnabled && settings.memoryMaxExamples > 0) {
    try {
      memoryPack = await getForexMemoryService().retrieve({
        symbol,
        scenario: pack.scenario.type,
        marketRegime: undefined,
        limit: settings.memoryMaxExamples,
      });
    } catch {
      memoryPack = null;
      memoryError = true;
    }
  }
  const memoryMs = Date.now() - memoryStarted;

  const intel = buildIntelligenceContext({
    currentFactsLine: formatDecisionFactsBlock(pack),
    knowledgeHits,
    memoryPack,
    knowledgeError,
    memoryError,
  });

  const attachContext = <T extends { memorySources?: unknown; knowledgeSources?: unknown }>(analysis: T): T => {
    const next = analysis as T & {
      memorySources: typeof intel.memorySources;
      knowledgeSources: typeof intel.knowledgeSources;
      memoryUnavailable: boolean;
      knowledgeUnavailable: boolean;
      limitations: string[];
    };
    next.memorySources = intel.memorySources;
    next.knowledgeSources = intel.knowledgeSources;
    next.memoryUnavailable = intel.memoryUnavailable;
    next.knowledgeUnavailable = intel.knowledgeUnavailable;
    next.limitations = [...(Array.isArray(next.limitations) ? next.limitations : []), ...intel.limitations]
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .slice(0, 16);
    return next;
  };

  if (
    pack.decisionPosture === "INSUFFICIENT_DATA"
    || mtf.dataQuality === "INSUFFICIENT_DATA"
  ) {
    const analysis = attachContext(assembleDecisionDeterministicOnly({
      pack,
      knowledgeSources: intel.knowledgeSources,
      memorySources: intel.memorySources,
      model: null,
      reason: "Required timeframe Market State(s) unavailable.",
      memoryUnavailable: intel.memoryUnavailable,
      knowledgeUnavailable: intel.knowledgeUnavailable,
      extraLimitations: intel.limitations,
    }));
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      diagnostics: {
        promptChars: 0,
        knowledgeHits: knowledgeHits.length,
        memoryHits: intel.memorySources.length,
        timeframes: mtf.timeframes,
        marketStateMs,
        deterministicMs,
        memoryMs,
        promptVersion: intel.promptVersion,
      },
    };
  }

  const prompt = buildDecisionAnalysisPrompt({
    pack,
    knowledgeText: intel.knowledgeText,
    memoryText: intel.memoryText,
  });
  const adapter = getOllamaAdapter();
  const timeoutMs = request.timeoutMs ?? 120_000;

  let generated = await adapter.generateStructured({
    prompt,
    timeoutMs,
    options: { temperature: 0.1, num_ctx: 2048, num_predict: 200 },
  });

  if (
    (!generated.ok || !generated.data)
    && generated.code === "OLLAMA_INVALID_RESPONSE"
    && generated.model
    && isSmallReasoningModel(generated.model)
  ) {
    generated = await adapter.generateStructured({
      prompt: buildDecisionRepairPrompt(pack),
      timeoutMs: Math.min(90_000, timeoutMs),
      options: { temperature: 0, num_ctx: 1536, num_predict: 140 },
    });
  }

  if (!generated.ok || !generated.data) {
    const analysis = attachContext(assembleDecisionDeterministicOnly({
      pack,
      knowledgeSources: intel.knowledgeSources,
      memorySources: intel.memorySources,
      model: generated.model,
      reason: generated.error ?? `Ollama unavailable (${generated.code})`,
      memoryUnavailable: intel.memoryUnavailable,
      knowledgeUnavailable: intel.knowledgeUnavailable,
      extraLimitations: intel.limitations,
    }));
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        memoryHits: intel.memorySources.length,
        model: generated.model,
        timeframes: mtf.timeframes,
        marketStateMs,
        deterministicMs,
        memoryMs,
        promptVersion: intel.promptVersion,
      },
    };
  }

  const parsed = parseDecisionAiNarrative(generated.data, {
    pack,
    model: generated.model,
    knowledgeSources: intel.knowledgeSources,
    memorySources: intel.memorySources,
    memoryUnavailable: intel.memoryUnavailable,
    knowledgeUnavailable: intel.knowledgeUnavailable,
    extraLimitations: intel.limitations,
  });

  if (!parsed.ok) {
    const analysis = attachContext(assembleDecisionDeterministicOnly({
      pack,
      knowledgeSources: intel.knowledgeSources,
      memorySources: intel.memorySources,
      model: generated.model,
      reason: parsed.error,
      memoryUnavailable: intel.memoryUnavailable,
      knowledgeUnavailable: intel.knowledgeUnavailable,
      extraLimitations: intel.limitations,
    }));
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        memoryHits: intel.memorySources.length,
        model: generated.model,
        timeframes: mtf.timeframes,
        marketStateMs,
        deterministicMs,
        memoryMs,
        promptVersion: intel.promptVersion,
      },
    };
  }

  return {
    ok: true,
    code: "OK",
    analysis: attachContext(parsed.analysis),
    latencyMs: Date.now() - started,
    diagnostics: {
      promptChars: prompt.length,
      knowledgeHits: knowledgeHits.length,
      memoryHits: intel.memorySources.length,
      model: generated.model,
      timeframes: mtf.timeframes,
      marketStateMs,
      deterministicMs,
      memoryMs,
      promptVersion: intel.promptVersion,
    },
  };
}
