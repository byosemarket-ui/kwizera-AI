/**
 * Phase 21 — Multi-timeframe AI orchestrator.
 * Reuses Phase 18 Market State, Phase 19 knowledge, Phase 20 Ollama adapter.
 */
import { getForexKnowledgeService } from "../../forex-knowledge/index.js";
import type { ForexKnowledgeRetrievalHit } from "../../forex-knowledge/types.js";
import { createBinanceMarketDataService, type BinanceMarketDataService } from "../../market-data/binance/service.js";
import { userFacingBinanceError } from "../../market-data/binance/errors.js";
import { getOllamaAdapter } from "../../ai-provider/ollama-adapter.js";
import { isSmallReasoningModel } from "../../ai-provider/ollama-client.js";
import {
  FOREX_AI_KNOWLEDGE_TOP_K,
  formatKnowledgeForPrompt,
  toKnowledgeSources,
} from "../knowledge-query.js";
import { computeMtfAlignment } from "./alignment.js";
import { buildMultiTimeframeMarketState, resolveMtfTimeframes } from "./build-state.js";
import { FOREX_MTF_REQUIRED } from "./config.js";
import { assembleMtfMarketStateOnly } from "./fallback.js";
import { buildMtfAnalysisPrompt, buildMtfRepairPrompt } from "./prompts.js";
import type { ForexMtfAnalyzeRequest, ForexMtfAnalyzeResult } from "./types.js";
import { parseMtfAiAnalysis } from "./validate.js";

let defaultBinance: BinanceMarketDataService | null = null;

function getBinance(): BinanceMarketDataService {
  defaultBinance ??= createBinanceMarketDataService();
  return defaultBinance;
}

export async function runForexMultiTimeframeAnalysis(
  request: ForexMtfAnalyzeRequest,
  deps?: { binance?: BinanceMarketDataService; nowMs?: number },
): Promise<ForexMtfAnalyzeResult> {
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
      required: FOREX_MTF_REQUIRED.filter((tf) => resolved.timeframes.includes(tf)),
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

  // Same-symbol enforcement
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

  const compactFacts = mtf.slots.map((s) => s.compact);
  const alignment = computeMtfAlignment(compactFacts, mtf.required);

  if (mtf.dataQuality === "INSUFFICIENT_DATA" || alignment.overall === "INSUFFICIENT_DATA") {
    const analysis = assembleMtfMarketStateOnly({
      mtf,
      alignment,
      knowledgeSources: [],
      model: null,
      reason: "Required timeframe Market State(s) unavailable.",
    });
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      diagnostics: {
        promptChars: 0,
        knowledgeHits: 0,
        timeframes: mtf.timeframes,
        marketStateMs,
      },
    };
  }

  const knowledgeQuery = String(request.knowledgeQuery ?? "").trim()
    || `multi timeframe trend alignment momentum market structure confirmation pullback ${alignment.higherBias}`;

  let knowledgeHits: ForexKnowledgeRetrievalHit[] = [];
  try {
    knowledgeHits = await getForexKnowledgeService().retrieveRelevantForexKnowledge({
      query: knowledgeQuery,
      limit: Math.min(2, FOREX_AI_KNOWLEDGE_TOP_K),
    });
  } catch {
    knowledgeHits = [];
  }

  const knowledgeText = formatKnowledgeForPrompt(knowledgeHits);
  const prompt = buildMtfAnalysisPrompt({ mtf, alignment, knowledgeText });
  const adapter = getOllamaAdapter();
  const timeoutMs = request.timeoutMs ?? 120_000;

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

  const knowledgeSources = toKnowledgeSources(knowledgeHits);

  if (!generated.ok || !generated.data) {
    const analysis = assembleMtfMarketStateOnly({
      mtf,
      alignment,
      knowledgeSources,
      model: generated.model,
      reason: generated.error ?? `Ollama unavailable (${generated.code})`,
    });
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        model: generated.model,
        timeframes: mtf.timeframes,
        marketStateMs,
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
    const analysis = assembleMtfMarketStateOnly({
      mtf,
      alignment,
      knowledgeSources,
      model: generated.model,
      reason: parsed.error,
    });
    return {
      ok: true,
      code: "OK",
      analysis,
      latencyMs: Date.now() - started,
      diagnostics: {
        promptChars: prompt.length,
        knowledgeHits: knowledgeHits.length,
        model: generated.model,
        timeframes: mtf.timeframes,
        marketStateMs,
      },
    };
  }

  return {
    ok: true,
    code: "OK",
    analysis: parsed.analysis,
    latencyMs: Date.now() - started,
    diagnostics: {
      promptChars: prompt.length,
      knowledgeHits: knowledgeHits.length,
      model: generated.model,
      timeframes: mtf.timeframes,
      marketStateMs,
    },
  };
}
