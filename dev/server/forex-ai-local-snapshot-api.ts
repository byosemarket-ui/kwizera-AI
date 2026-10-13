/**
 * Phase 43D — Local AI analysis from an immutable market-data snapshot.
 *
 * POST /api/forex/ai-analysis/local              create analysis for snapshotId
 * GET  /api/forex/ai-analysis/local/:analysisId  fetch analysis
 * GET  /api/forex/ai-analysis/local?snapshotId=  list analyses for snapshot
 * GET  /api/forex/ai-analysis/local/meta         schema / limits
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  LOCAL_AI_DEFAULT_TIMEOUT_MS,
  LOCAL_AI_MAX_TIMEOUT_MS,
  LOCAL_AI_MIN_TIMEOUT_MS,
  LOCAL_SNAPSHOT_ANALYSIS_SCHEMA,
  getLocalAiInferenceGate,
  getLocalSnapshotAnalysisEngine,
} from "../../ai/forex-ai/snapshot-local/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 32_000) {
      throw new Error("Request body too large.");
    }
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

export async function handleForexAiLocalSnapshotApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/ai-analysis/local")) return false;

  const engine = getLocalSnapshotAnalysisEngine();

  try {
    if (url.pathname === "/api/forex/ai-analysis/local/meta") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        schemaVersion: LOCAL_SNAPSHOT_ANALYSIS_SCHEMA,
        modelNote: "Uses shared Ollama adapter (preferred llama3.2:1b). Port 11434 is not exposed.",
        defaultTimeoutMs: LOCAL_AI_DEFAULT_TIMEOUT_MS,
        minTimeoutMs: LOCAL_AI_MIN_TIMEOUT_MS,
        maxTimeoutMs: LOCAL_AI_MAX_TIMEOUT_MS,
        concurrency: getLocalAiInferenceGate().stats(),
        decisions: ["BUY", "SELL", "WAIT", "NO_TRADE"],
        note: "Local AI analyzes an immutable snapshotId. Does not create snapshots or place orders.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/ai-analysis/local") {
      if (req.method === "GET" || req.method === "HEAD") {
        const snapshotId = String(url.searchParams.get("snapshotId") ?? "").trim();
        if (!snapshotId) {
          sendJson(res, 400, {
            ok: false,
            error: { code: "INVALID_REQUEST", message: "Query snapshotId is required for list." },
          });
          return true;
        }
        const limit = Number(url.searchParams.get("limit") ?? 10) || 10;
        const items = await engine.listBySnapshot(snapshotId, limit);
        sendJson(res, 200, { ok: true, count: items.length, items });
        return true;
      }

      if (req.method !== "POST") {
        sendJson(res, 405, {
          ok: false,
          error: { code: "METHOD_NOT_ALLOWED", message: "Use POST to analyze a snapshot." },
        });
        return true;
      }

      const body = await readJsonBody(req) as Record<string, unknown>;
      const result = await engine.analyze({
        snapshotId: String(body.snapshotId ?? ""),
        contentFingerprint: body.contentFingerprint == null
          ? undefined
          : String(body.contentFingerprint),
        provider: body.provider == null ? undefined : String(body.provider),
        symbol: body.symbol == null ? undefined : String(body.symbol),
        candleTimeframe: body.candleTimeframe == null ? undefined : String(body.candleTimeframe),
        analysisPeriod: body.analysisPeriod == null ? undefined : String(body.analysisPeriod),
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
      });

      const status = result.ok
        ? 200
        : result.code === "SNAPSHOT_NOT_FOUND"
          ? 404
          : result.code === "AI_QUEUE_FULL"
            ? 429
            : 422;

      sendJson(res, status, {
        ok: result.ok,
        code: result.code,
        error: result.error,
        latencyMs: result.latencyMs,
        analysis: result.analysis,
        evidence: result.evidence
          ? {
              snapshotId: result.evidence.snapshotId,
              contentFingerprint: result.evidence.contentFingerprint,
              provider: result.evidence.provider,
              instrument: result.evidence.instrument,
              candleTimeframe: result.evidence.candleTimeframe,
              analysisPeriod: result.evidence.analysisPeriod,
              quoteFreshness: result.evidence.quoteFreshness,
              validationStatus: result.evidence.validationStatus,
              candleCount: result.evidence.candleCount,
              categories: result.evidence.categories,
              warnings: result.evidence.warnings,
            }
          : null,
      });
      return true;
    }

    const match = url.pathname.match(/^\/api\/forex\/ai-analysis\/local\/([^/]+)$/);
    if (match) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const id = decodeURIComponent(match[1] ?? "");
      if (id === "meta") {
        sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Unknown route." } });
        return true;
      }
      const row = await engine.getAnalysis(id);
      if (!row) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "ANALYSIS_NOT_FOUND", message: "Analysis not found." },
        });
        return true;
      }
      sendJson(res, 200, { ok: true, analysis: row.analysis, evidence: row.evidence });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown local AI analysis route." },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Local AI analysis failed.";
    sendJson(res, 500, {
      ok: false,
      error: { code: "AI_ERROR", message },
    });
    return true;
  }
}
