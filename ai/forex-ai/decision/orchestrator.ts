/**
 * Phase 22/24/38E — Decision orchestrator with Knowledge RAG + Memory + detector evidence.
 * Reuses Phase 18 Market State, Phase 19 knowledge, Phase 20 Ollama, Phase 21 MTF, Phase 23 memory.
 */
import { getForexKnowledgeService } from "../../forex-knowledge/index.js";
import type { ForexKnowledgeRetrievalHit } from "../../forex-knowledge/types.js";
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../../market-data/binance/service.js";
import { userFacingBinanceError } from "../../market-data/binance/errors.js";
import { userFacingFxcmError } from "../../market-data/fxcm/errors.js";
import { userFacingForexConnectError } from "../../market-data/forexconnect/errors.js";
import { getOllamaAdapter } from "../../ai-provider/ollama-adapter.js";
import { isSmallReasoningModel } from "../../ai-provider/ollama-client.js";
import { getForexMemoryService } from "../../forex-memory/index.js";
import type { ForexMemoryContextPack } from "../../forex-memory/types.js";
import { parseMarketProviderId } from "../../market-data/providers/identity.js";
import { getMarketDataService } from "../../market-data/providers/market-data-service.js";
import type { MarketProviderId } from "../../market-data/providers/types.js";
import {
  buildEvidenceAwareKnowledgeQuery,
  buildForexAiEvidencePack,
  enrichEvidencePackKnowledge,
  formatEvidenceForPrompt,
  sanitizeDecisionAgainstEvidence,
  type ForexAiEvidencePack,
  type ForexAiInferenceStatus,
} from "../evidence/index.js";
import {
  FOREX_AI_KNOWLEDGE_TOP_K,
  sanitizeKnowledgeQueryInput,
} from "../knowledge-query.js";
import { computeMtfAlignment } from "../mtf/alignment.js";
import { buildMultiTimeframeMarketState, resolveMtfTimeframes } from "../mtf/build-state.js";
import { buildIntelligenceContext } from "../intelligence/context-builder.js";
import { getForexIntelligenceSettingsService } from "../intelligence/settings.js";
import { formatDecisionFactsBlock } from "./compact.js";
import { FOREX_DECISION_REQUIRED } from "./config.js";
import { runDeterministicDecisionEngines } from "./decision-engine.js";
import { assembleDecisionDeterministicOnly } from "./fallback.js";
import { buildDecisionAnalysisPrompt, buildDecisionRepairPrompt } from "./prompts.js";
import type {
  ForexDecisionAnalyzeRequest,
  ForexDecisionAnalyzeResult,
  ForexDecisionAnalysis,
} from "./types.js";
import { parseDecisionAiNarrative } from "./validate.js";

let defaultBinance: BinanceMarketDataService | null = null;

function getBinance(): BinanceMarketDataService {
  defaultBinance ??= createBinanceMarketDataService();
  return defaultBinance;
}

function resolveProvider(raw: unknown): MarketProviderId {
  return parseMarketProviderId(raw) ?? "BINANCE";
}

function mapProviderError(provider: MarketProviderId, error: unknown): string {
  if (provider === "FXCM") return userFacingFxcmError(error).message;
  if (provider === "FOREXCONNECT") return userFacingForexConnectError(error).message;
  return userFacingBinanceError(error).message;
}

function pickDecisionEvidenceTf(
  mtf: Awaited<ReturnType<typeof buildMultiTimeframeMarketState>>,
): string {
  for (const tf of ["1h", "4h", "15m"] as const) {
    if (mtf.slots.some((s) => s.timeframe === tf && s.compact.usable)) return tf;
  }
  return mtf.slots.find((s) => s.compact.usable)?.timeframe ?? "1h";
}

async function loadDecisionEvidenceCandles(input: {
  provider: MarketProviderId;
  symbol: string;
  timeframe: string;
  binance: BinanceMarketDataService;
}): Promise<{ candles: Array<{ time: number; open: number; high: number; low: number; close: number; isClosed?: boolean }>; environment?: string | null }> {
  if (input.provider === "BINANCE") {
    const series = await input.binance.listKlines({
      symbol: input.symbol,
      timeframe: input.timeframe as "1h",
      limit: 300,
    });
    return { candles: series.candles, environment: null };
  }
  const series = await getMarketDataService().getHistoricalCandles({
    provider: input.provider,
    symbol: input.symbol,
    timeframe: input.timeframe,
    limit: 300,
  });
  return {
    candles: series.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      isClosed: c.isClosed,
    })),
    environment: series.identity.environment ?? null,
  };
}

function attachEvidence(
  analysis: ForexDecisionAnalysis,
  pack: ForexAiEvidencePack | undefined,
  inferenceLatencyMs: number | null,
  inferenceStatus: ForexAiInferenceStatus,
): ForexDecisionAnalysis {
  if (!pack) {
    return { ...analysis, inferenceLatencyMs, inferenceStatus };
  }
  const sanitized = sanitizeDecisionAgainstEvidence(analysis, pack);
  return {
    ...sanitized.analysis,
    inferenceLatencyMs,
    inferenceStatus,
  };
}

export async function runForexDecisionAnalysis(
  request: ForexDecisionAnalyzeRequest,
  deps?: { binance?: BinanceMarketDataService; nowMs?: number },
): Promise<ForexDecisionAnalyzeResult> {
  const started = Date.now();
  const provider = resolveProvider(request.provider);
  const symbolRaw = String(request.symbol ?? "").trim();
  const symbol = (provider === "FXCM" || provider === "FOREXCONNECT")
    ? symbolRaw
    : symbolRaw.toUpperCase().replace(/[/_-\s]/g, "");
  const compact = symbol.replace(/[/_-\s]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{4,30}$/.test(compact)) {
    return {
      ok: false,
      code: "INVALID_MARKET_STATE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: "symbol must identify a valid provider instrument.",
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
      provider,
    });
  } catch (error) {
    return {
      ok: false,
      code: "DATA_UNAVAILABLE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: mapProviderError(provider, error),
    };
  }
  const marketStateMs = Date.now() - marketStateStarted;

  if (mtf.exchange !== provider) {
    return {
      ok: false,
      code: "INVALID_MARKET_STATE",
      analysis: null,
      latencyMs: Date.now() - started,
      error: "Decision provider mismatch — refusing cross-provider analysis.",
    };
  }

  for (const slot of mtf.slots) {
    if (slot.marketState && slot.marketState.provider !== provider) {
      return {
        ok: false,
        code: "INVALID_MARKET_STATE",
        analysis: null,
        latencyMs: Date.now() - started,
        error: `Cross-provider contamination detected for ${slot.timeframe}.`,
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

  const evidenceStarted = Date.now();
  let evidencePack: ForexAiEvidencePack | undefined;
  try {
    const evidenceTf = pickDecisionEvidenceTf(mtf);
    const { candles, environment } = await loadDecisionEvidenceCandles({
      provider,
      symbol: provider === "BINANCE" ? compact : symbol,
      timeframe: evidenceTf,
      binance: deps?.binance ?? getBinance(),
    });
    evidencePack = buildForexAiEvidencePack({
      provider,
      environment,
      symbol: mtf.symbol,
      timeframe: evidenceTf,
      candles,
      priceBasis: provider === "FOREXCONNECT" ? "bid" : provider === "FXCM" ? "mid" : null,
    });
  } catch {
    evidencePack = undefined;
  }
  const evidenceLatencyMs = Date.now() - evidenceStarted;

  const settings = await getForexIntelligenceSettingsService().getSettings();

  const baseQuery = sanitizeKnowledgeQueryInput(request.knowledgeQuery)
    || `scenario entry confirmation invalidation risk market structure pullback ${pack.scenario.type}`;
  const knowledgeQuery = evidencePack
    ? buildEvidenceAwareKnowledgeQuery(baseQuery, evidencePack)
    : baseQuery;

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

  if (evidencePack) {
    evidencePack = enrichEvidencePackKnowledge(evidencePack, knowledgeHits);
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

  const evidenceText = evidencePack ? formatEvidenceForPrompt(evidencePack, 600) : "";
  const intel = buildIntelligenceContext({
    currentFactsLine: formatDecisionFactsBlock(pack, evidenceText),
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
    const analysis = attachEvidence(
      attachContext(assembleDecisionDeterministicOnly({
        pack,
        knowledgeSources: intel.knowledgeSources,
        memorySources: intel.memorySources,
        model: null,
        reason: "Required timeframe Market State(s) unavailable.",
        memoryUnavailable: intel.memoryUnavailable,
        knowledgeUnavailable: intel.knowledgeUnavailable,
        extraLimitations: intel.limitations,
      })),
      evidencePack,
      null,
      "SKIPPED",
    );
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      evidencePack,
      evidenceLatencyMs,
      diagnostics: {
        promptChars: 0,
        knowledgeHits: knowledgeHits.length,
        memoryHits: intel.memorySources.length,
        timeframes: mtf.timeframes,
        marketStateMs,
        deterministicMs,
        memoryMs,
        promptVersion: intel.promptVersion,
        inferenceLatencyMs: null,
        inferenceStatus: "SKIPPED",
      },
    };
  }

  const prompt = buildDecisionAnalysisPrompt({
    pack,
    knowledgeText: intel.knowledgeText,
    memoryText: intel.memoryText,
    evidenceText,
  });
  const adapter = getOllamaAdapter();
  const timeoutMs = request.timeoutMs ?? 120_000;

  const inferenceStarted = Date.now();
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
  const inferenceLatencyMs = Date.now() - inferenceStarted;
  const inferenceStatus: ForexAiInferenceStatus = generated.ok && generated.data
    ? "OK"
    : generated.code === "OLLAMA_TIMEOUT"
      ? "TIMEOUT"
      : generated.code === "OLLAMA_INVALID_RESPONSE"
        ? "FORMAT_ERROR"
        : "UNAVAILABLE";

  if (!generated.ok || !generated.data) {
    const analysis = attachEvidence(
      attachContext(assembleDecisionDeterministicOnly({
        pack,
        knowledgeSources: intel.knowledgeSources,
        memorySources: intel.memorySources,
        model: generated.model,
        reason: generated.error ?? `Ollama unavailable (${generated.code})`,
        memoryUnavailable: intel.memoryUnavailable,
        knowledgeUnavailable: intel.knowledgeUnavailable,
        extraLimitations: intel.limitations,
      })),
      evidencePack,
      inferenceLatencyMs,
      inferenceStatus,
    );
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      evidencePack,
      evidenceLatencyMs,
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
        inferenceLatencyMs,
        inferenceStatus,
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
    const analysis = attachEvidence(
      attachContext(assembleDecisionDeterministicOnly({
        pack,
        knowledgeSources: intel.knowledgeSources,
        memorySources: intel.memorySources,
        model: generated.model,
        reason: parsed.error,
        memoryUnavailable: intel.memoryUnavailable,
        knowledgeUnavailable: intel.knowledgeUnavailable,
        extraLimitations: intel.limitations,
      })),
      evidencePack,
      inferenceLatencyMs,
      "FORMAT_ERROR",
    );
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      evidencePack,
      evidenceLatencyMs,
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
        inferenceLatencyMs,
        inferenceStatus: "FORMAT_ERROR",
      },
    };
  }

  return {
    ok: true,
    code: "OK",
    analysis: attachEvidence(attachContext(parsed.analysis), evidencePack, inferenceLatencyMs, "OK"),
    latencyMs: Date.now() - started,
    evidencePack,
    evidenceLatencyMs,
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
      inferenceLatencyMs,
      inferenceStatus: "OK",
    },
  };
}
