/**
 * Forex AI API — Phase 17 foundation + Phase 20 Market Analysis Engine.
 * Reuses shared Ollama adapter. Does not expose port 11434.
 *
 * GET  /api/forex/ai/health
 * POST /api/forex/ai/analyze   — { symbol, timeframe } (authoritative) or legacy { market }
 * GET  /api/forex/ai/meta
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  analyzeForexMarketState,
  forexAiEngineMeta,
  getForexAiHealth,
  runForexMarketAnalysis,
  type ForexAiAnalysisType,
} from "../../ai/forex-ai/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

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
        note: "Forex AI Market Analysis Engine: Market State + Forex Knowledge → shared Ollama adapter.",
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
      };
      const started = Date.now();

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
        })
        : await analyzeForexMarketState(body.market ?? body, {
          allowInsufficient: body.allowInsufficient === true,
          analysisType: body.analysisType,
        });

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
          durationMs: Date.now() - started,
        }),
      );
      sendJson(res, result.ok ? 200 : 422, result);
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
