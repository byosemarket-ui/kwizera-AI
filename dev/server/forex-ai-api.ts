/**
 * Forex AI API — Phase 17/20 + Phase 21 MTF + Phase 22 Decision + Phase 23 memory persist.
 * Reuses shared Ollama adapter. Does not expose port 11434.
 *
 * GET  /api/forex/ai/health
 * POST /api/forex/ai/analyze
 * POST /api/forex/ai/multi-timeframe
 * POST /api/forex/ai/decision
 * GET  /api/forex/ai/meta
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  analyzeForexMarketState,
  FOREX_DECISION_DEFAULT_STACK,
  FOREX_DECISION_SCHEMA_VERSION,
  FOREX_MTF_DEFAULT_STACK,
  FOREX_MTF_SCHEMA_VERSION,
  forexAiEngineMeta,
  getForexAiHealth,
  runForexDecisionAnalysis,
  runForexMarketAnalysis,
  runForexMultiTimeframeAnalysis,
  type ForexAiAnalysisType,
} from "../../ai/forex-ai/index.js";
import { getForexMemoryService, type ForexMemoryAnalysisType } from "../../ai/forex-memory/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function persistAnalysisMemory(input: {
  analysisType: ForexMemoryAnalysisType;
  analysis: unknown;
  latencyMs?: number;
  promptChars?: number;
}): Promise<string | null> {
  try {
    if (!input.analysis || typeof input.analysis !== "object") return null;
    const saved = await getForexMemoryService().persistAnalysis({
      analysisType: input.analysisType,
      analysis: input.analysis as Record<string, unknown>,
      latencyMs: input.latencyMs ?? null,
      promptChars: input.promptChars ?? null,
    });
    return saved.analysis.id;
  } catch (error) {
    console.warn(
      "[forex-ai] memory-persist-failed",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

export async function handleForexAiApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/ai")) return false;

  try {
    if (url.pathname === "/api/forex/ai/meta" && (req.method === "GET" || req.method === "HEAD")) {
      sendJson(res, 200, {
        ok: true,
        meta: forexAiEngineMeta(),
        publicOllamaExposed: false,
        schemaVersion: "forex-ai-analysis-v1",
        mtfSchemaVersion: FOREX_MTF_SCHEMA_VERSION,
        mtfDefaultStack: FOREX_MTF_DEFAULT_STACK,
        decisionSchemaVersion: FOREX_DECISION_SCHEMA_VERSION,
        decisionDefaultStack: FOREX_DECISION_DEFAULT_STACK,
        memorySchemaVersion: "forex-memory-v1",
        note: "Forex AI: single-TF + multi-TF + decision + memory journal → shared Ollama adapter. No model-weight training.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/ai/health" && (req.method === "GET" || req.method === "HEAD")) {
      const probe = url.searchParams.get("probe") === "1";
      const started = Date.now();
      const health = await getForexAiHealth({ probeInference: probe });
      console.info(
        "[forex-ai] health",
        JSON.stringify({
          state: health.state,
          model: health.model,
          latencyMs: health.latencyMs,
          probed: health.probedInference,
          durationMs: Date.now() - started,
        }),
      );
      sendJson(res, 200, { ok: true, health });
      return true;
    }

    if (url.pathname === "/api/forex/ai/analyze" && req.method === "POST") {
      const body = await readJsonBody(req) as {
        symbol?: string;
        timeframe?: string;
        analysisType?: ForexAiAnalysisType;
        knowledgeQuery?: string;
        timeoutMs?: number;
        market?: unknown;
        allowInsufficient?: boolean;
        provider?: string;
      };
      const started = Date.now();
      const provider = String(body.provider ?? "").trim().toUpperCase() === "FXCM" ? "FXCM" as const : "BINANCE" as const;

      const hasAuthoritativeRequest = Boolean(
        String(body.symbol ?? "").trim() && String(body.timeframe ?? "").trim(),
      );

      const result = hasAuthoritativeRequest
        ? await runForexMarketAnalysis({
          symbol: String(body.symbol),
          timeframe: String(body.timeframe),
          analysisType: body.analysisType,
          knowledgeQuery: body.knowledgeQuery,
          timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
          provider,
        })
        : await analyzeForexMarketState(body.market ?? body, {
          allowInsufficient: body.allowInsufficient === true,
          analysisType: body.analysisType,
        });

      let memoryId: string | null = null;
      if (result.ok && result.analysis) {
        memoryId = await persistAnalysisMemory({
          analysisType: "SINGLE_TIMEFRAME",
          analysis: result.analysis,
          latencyMs: result.latencyMs,
          promptChars: result.diagnostics?.promptChars,
        });
      }
      console.info(
        "[forex-ai] analyze",
        JSON.stringify({
          ok: result.ok,
          code: result.code,
          mode: hasAuthoritativeRequest ? "market-state+knowledge" : "legacy-market",
          symbol: result.analysis?.symbol ?? body.symbol ?? null,
          timeframe: result.analysis?.timeframe ?? body.timeframe ?? null,
          model: result.analysis?.model ?? result.diagnostics?.model ?? null,
          latencyMs: result.latencyMs,
          promptChars: result.diagnostics?.promptChars ?? null,
          knowledgeHits: result.diagnostics?.knowledgeHits ?? null,
          memoryId,
          durationMs: Date.now() - started,
        }),
      );
      sendJson(res, result.ok ? 200 : 422, { ...result, memoryId });
      return true;
    }

    if (url.pathname === "/api/forex/ai/multi-timeframe" && req.method === "POST") {
      const body = await readJsonBody(req) as {
        symbol?: string;
        timeframes?: string[];
        analysisType?: string;
        knowledgeQuery?: string;
        timeoutMs?: number;
        provider?: string;
      };
      const started = Date.now();
      const provider = String(body.provider ?? "").trim().toUpperCase() === "FXCM" ? "FXCM" as const : "BINANCE" as const;
      const result = await runForexMultiTimeframeAnalysis({
        symbol: String(body.symbol ?? ""),
        timeframes: Array.isArray(body.timeframes) ? body.timeframes.map(String) : undefined,
        analysisType: body.analysisType,
        knowledgeQuery: body.knowledgeQuery,
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
        provider,
      });
      let memoryId: string | null = null;
      if (result.ok && result.analysis) {
        memoryId = await persistAnalysisMemory({
          analysisType: "MULTI_TIMEFRAME",
          analysis: result.analysis,
          latencyMs: result.latencyMs,
          promptChars: result.diagnostics?.promptChars,
        });
      }
      console.info(
        "[forex-ai] mtf-analyze",
        JSON.stringify({
          ok: result.ok,
          code: result.code,
          symbol: result.analysis?.market.symbol ?? body.symbol ?? null,
          timeframes: result.diagnostics?.timeframes ?? body.timeframes ?? null,
          alignment: result.analysis?.overallAlignment.overall ?? null,
          narrative: result.analysis?.narrativeStatus ?? null,
          model: result.analysis?.model ?? result.diagnostics?.model ?? null,
          latencyMs: result.latencyMs,
          promptChars: result.diagnostics?.promptChars ?? null,
          knowledgeHits: result.diagnostics?.knowledgeHits ?? null,
          marketStateMs: result.diagnostics?.marketStateMs ?? null,
          memoryId,
          durationMs: Date.now() - started,
        }),
      );
      sendJson(res, result.ok ? 200 : 422, { ...result, memoryId });
      return true;
    }

    if (url.pathname === "/api/forex/ai/decision" && req.method === "POST") {
      const body = await readJsonBody(req) as {
        symbol?: string;
        timeframes?: string[];
        scenarioMode?: string;
        knowledgeQuery?: string;
        timeoutMs?: number;
        provider?: string;
      };
      const started = Date.now();
      const provider = String(body.provider ?? "").trim().toUpperCase() === "FXCM" ? "FXCM" as const : "BINANCE" as const;
      const result = await runForexDecisionAnalysis({
        symbol: String(body.symbol ?? ""),
        timeframes: Array.isArray(body.timeframes) ? body.timeframes.map(String) : undefined,
        scenarioMode: body.scenarioMode,
        knowledgeQuery: body.knowledgeQuery,
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
        provider,
      });
      let memoryId: string | null = null;
      if (result.ok && result.analysis) {
        memoryId = await persistAnalysisMemory({
          analysisType: "DECISION",
          analysis: result.analysis,
          latencyMs: result.latencyMs,
          promptChars: result.diagnostics?.promptChars,
        });
      }
      console.info(
        "[forex-ai] decision",
        JSON.stringify({
          ok: result.ok,
          code: result.code,
          symbol: result.analysis?.market.symbol ?? body.symbol ?? null,
          timeframes: result.diagnostics?.timeframes ?? body.timeframes ?? null,
          scenario: result.analysis?.scenario.type ?? null,
          posture: result.analysis?.decisionPosture ?? null,
          entry: result.analysis?.entryZone.status ?? null,
          narrative: result.analysis?.narrativeStatus ?? null,
          model: result.analysis?.model ?? result.diagnostics?.model ?? null,
          latencyMs: result.latencyMs,
          promptChars: result.diagnostics?.promptChars ?? null,
          knowledgeHits: result.diagnostics?.knowledgeHits ?? null,
          marketStateMs: result.diagnostics?.marketStateMs ?? null,
          deterministicMs: result.diagnostics?.deterministicMs ?? null,
          memoryId,
          durationMs: Date.now() - started,
        }),
      );
      sendJson(res, result.ok ? 200 : 422, { ...result, memoryId });
      return true;
    }

    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Unsupported method for Forex AI routes." },
      });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown Forex AI route." },
    });
    return true;
  } catch (error) {
    console.error("[forex-ai] error", error instanceof Error ? error.message : error);
    sendJson(res, 500, {
      ok: false,
      error: {
        code: "AI_ERROR",
        message: error instanceof Error ? error.message : "Forex AI request failed",
      },
    });
    return true;
  }
}
