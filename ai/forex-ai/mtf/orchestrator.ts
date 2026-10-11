/**
 * Phase 21/38E — Multi-timeframe AI orchestrator.
 * Reuses Phase 18 Market State, Phase 19 knowledge, Phase 20 Ollama adapter, Phase 38 detectors.
 */
import { getForexKnowledgeService } from "../../forex-knowledge/index.js";
import type { ForexKnowledgeRetrievalHit } from "../../forex-knowledge/types.js";
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../../market-data/binance/service.js";
import { userFacingBinanceError } from "../../market-data/binance/errors.js";
import { userFacingFxcmError } from "../../market-data/fxcm/errors.js";
import { userFacingForexConnectError } from "../../market-data/forexconnect/errors.js";
import { getOllamaAdapter } from "../../ai-provider/ollama-adapter.js";
import { isSmallReasoningModel } from "../../ai-provider/ollama-client.js";
import { parseMarketProviderId } from "../../market-data/providers/identity.js";
import { getMarketDataService } from "../../market-data/providers/market-data-service.js";
import type { MarketProviderId } from "../../market-data/providers/types.js";
import {
  buildEvidenceAwareKnowledgeQuery,
  buildForexAiEvidencePack,
  enrichEvidencePackKnowledge,
  formatEvidenceForPrompt,
  sanitizeMtfAgainstEvidence,
  type ForexAiEvidencePack,
  type ForexAiInferenceStatus,
} from "../evidence/index.js";
import {
  FOREX_AI_KNOWLEDGE_TOP_K,
  formatKnowledgeForPrompt,
  sanitizeKnowledgeQueryInput,
  toKnowledgeSources,
} from "../knowledge-query.js";
import { computeMtfAlignment } from "./alignment.js";
import { buildMultiTimeframeMarketState, resolveMtfTimeframes } from "./build-state.js";
import { FOREX_MTF_REQUIRED } from "./config.js";
import { assembleMtfMarketStateOnly } from "./fallback.js";
import { buildMtfAnalysisPrompt, buildMtfRepairPrompt } from "./prompts.js";
import type { ForexMtfAnalyzeRequest, ForexMtfAnalyzeResult, ForexMtfAiAnalysis } from "./types.js";
import { parseMtfAiAnalysis } from "./validate.js";

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

function pickEvidenceTimeframe(
  mtf: Awaited<ReturnType<typeof buildMultiTimeframeMarketState>>,
): string {
  const preferred = ["1h", "4h", "15m", "30m", "5m"] as const;
  for (const tf of preferred) {
    const slot = mtf.slots.find((s) => s.timeframe === tf && s.compact.usable);
    if (slot) return slot.timeframe;
  }
  const any = mtf.slots.find((s) => s.compact.usable);
  return any?.timeframe ?? mtf.timeframes[0] ?? "1h";
}

async function loadEvidenceCandles(input: {
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

function attachPack(
  analysis: ForexMtfAiAnalysis,
  pack: ForexAiEvidencePack | undefined,
  inferenceLatencyMs: number | null,
  inferenceStatus: ForexAiInferenceStatus,
): ForexMtfAiAnalysis {
  if (!pack) {
    return { ...analysis, inferenceLatencyMs, inferenceStatus };
  }
  const sanitized = sanitizeMtfAgainstEvidence(analysis, pack);
  return {
    ...sanitized.analysis,
    inferenceLatencyMs,
    inferenceStatus,
  };
}

export async function runForexMultiTimeframeAnalysis(
  request: ForexMtfAnalyzeRequest,
  deps?: { binance?: BinanceMarketDataService; nowMs?: number },
): Promise<ForexMtfAnalyzeResult> {
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
      required: FOREX_MTF_REQUIRED.filter((tf) => resolved.timeframes.includes(tf)),
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
      error: "MTF provider mismatch — refusing cross-provider analysis.",
    };
  }

  for (const slot of mtf.slots) {
    if (!slot.marketState) continue;
    if (slot.marketState.provider !== provider) {
      return {
        ok: false,
        code: "INVALID_MARKET_STATE",
        analysis: null,
        latencyMs: Date.now() - started,
        error: `Cross-provider contamination detected for ${slot.timeframe}.`,
      };
    }
    const slotCompact = slot.marketState.canonicalSymbol.replace(/[/_-\s]/g, "").toUpperCase();
    if (slotCompact !== compact && slot.marketState.symbol !== compact) {
      return {
        ok: false,
        code: "INVALID_MARKET_STATE",
        analysis: null,
        latencyMs: Date.now() - started,
        error: `Cross-symbol contamination detected for ${slot.timeframe}.`,
      };
    }
  }

  const compactFacts = mtf.slots.map((s) => s.compact);
  const alignment = computeMtfAlignment(compactFacts, mtf.required);

  const evidenceStarted = Date.now();
  let evidencePack: ForexAiEvidencePack | undefined;
  try {
    const evidenceTf = pickEvidenceTimeframe(mtf);
    const { candles, environment } = await loadEvidenceCandles({
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

  if (mtf.dataQuality === "INSUFFICIENT_DATA" || alignment.overall === "INSUFFICIENT_DATA") {
    const analysis = attachPack(
      assembleMtfMarketStateOnly({
        mtf,
        alignment,
        knowledgeSources: [],
        model: null,
        reason: "Required timeframe Market State(s) unavailable.",
      }),
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
        knowledgeHits: 0,
        timeframes: mtf.timeframes,
        marketStateMs,
        inferenceLatencyMs: null,
        inferenceStatus: "SKIPPED",
      },
    };
  }

  const baseQuery = sanitizeKnowledgeQueryInput(request.knowledgeQuery)
    || `multi timeframe trend alignment momentum market structure confirmation pullback ${alignment.higherBias}`;
  const knowledgeQuery = evidencePack
    ? buildEvidenceAwareKnowledgeQuery(baseQuery, evidencePack)
    : baseQuery;

  let knowledgeHits: ForexKnowledgeRetrievalHit[] = [];
  try {
    knowledgeHits = await getForexKnowledgeService().retrieveRelevantForexKnowledge({
      query: knowledgeQuery,
      limit: Math.min(2, FOREX_AI_KNOWLEDGE_TOP_K),
    });
  } catch {
    knowledgeHits = [];
  }

  if (evidencePack) {
    evidencePack = enrichEvidencePackKnowledge(evidencePack, knowledgeHits);
  }

  const knowledgeText = formatKnowledgeForPrompt(knowledgeHits);
  const evidenceText = evidencePack ? formatEvidenceForPrompt(evidencePack, 700) : "";
  const prompt = buildMtfAnalysisPrompt({ mtf, alignment, knowledgeText, evidenceText });
  const adapter = getOllamaAdapter();
  const timeoutMs = request.timeoutMs ?? 120_000;

  const inferenceStarted = Date.now();
  let generated = await adapter.generateStructured({
    prompt,
    timeoutMs,
    options: { temperature: 0.1, num_ctx: 2048, num_predict: 220 },
  });

  if (
    (!generated.ok || !generated.data)
    && generated.code === "OLLAMA_INVALID_RESPONSE"
    && generated.model
    && isSmallReasoningModel(generated.model)
  ) {
    generated = await adapter.generateStructured({
      prompt: buildMtfRepairPrompt({ mtf, alignment }),
      timeoutMs: Math.min(90_000, timeoutMs),
      options: { temperature: 0, num_ctx: 1536, num_predict: 160 },
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

  const knowledgeSources = toKnowledgeSources(knowledgeHits);

  if (!generated.ok || !generated.data) {
    const analysis = attachPack(
      assembleMtfMarketStateOnly({
        mtf,
        alignment,
        knowledgeSources,
        model: generated.model,
        reason: generated.error ?? `Ollama unavailable (${generated.code})`,
      }),
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
        model: generated.model,
        timeframes: mtf.timeframes,
        marketStateMs,
        inferenceLatencyMs,
        inferenceStatus,
      },
    };
  }

  const parsed = parseMtfAiAnalysis(generated.data, {
    mtf,
    alignment,
    model: generated.model,
    knowledgeSources,
  });

  if (!parsed.ok) {
    const analysis = attachPack(
      assembleMtfMarketStateOnly({
        mtf,
        alignment,
        knowledgeSources,
        model: generated.model,
        reason: parsed.error,
      }),
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
        model: generated.model,
        timeframes: mtf.timeframes,
        marketStateMs,
        inferenceLatencyMs,
        inferenceStatus: "FORMAT_ERROR",
      },
    };
  }

  return {
    ok: true,
    code: "OK",
    analysis: attachPack(parsed.analysis, evidencePack, inferenceLatencyMs, "OK"),
    latencyMs: Date.now() - started,
    evidencePack,
    evidenceLatencyMs,
    diagnostics: {
      promptChars: prompt.length,
      knowledgeHits: knowledgeHits.length,
      model: generated.model,
      timeframes: mtf.timeframes,
      marketStateMs,
      inferenceLatencyMs,
      inferenceStatus: "OK",
    },
  };
}
