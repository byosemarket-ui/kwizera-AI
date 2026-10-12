/**
 * Phase 43B — Analysis market-data snapshot API.
 *
 * POST /api/forex/analysis-snapshot          create immutable snapshot
 * GET  /api/forex/analysis-snapshot/:id      fetch by id
 * GET  /api/forex/analysis-snapshot          list recent meta
 * GET  /api/forex/analysis-snapshot/meta     schema / limits
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ANALYSIS_PERIOD_IDS,
  ANALYSIS_SNAPSHOT_MAX_CANDLES,
  ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
  getAnalysisSnapshotEngine,
} from "../../ai/market-data/analysis-snapshot/index.js";
import { CANONICAL_TIMEFRAMES } from "../../ai/market-data/providers/contracts.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > 64_000) {
      throw new Error("Request body too large.");
    }
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

export async function handleForexAnalysisSnapshotApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/analysis-snapshot")) return false;

  const engine = getAnalysisSnapshotEngine();

  try {
    if (url.pathname === "/api/forex/analysis-snapshot/meta") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      sendJson(res, 200, {
        ok: true,
        schemaVersion: ANALYSIS_SNAPSHOT_SCHEMA_VERSION,
        candleTimeframes: CANONICAL_TIMEFRAMES,
        analysisPeriods: ANALYSIS_PERIOD_IDS,
        maxCandles: ANALYSIS_SNAPSHOT_MAX_CANDLES,
        note: "Immutable analysis market-data snapshots for future Local AI / OpenAI / Compare Both.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/analysis-snapshot") {
      if (req.method === "GET" || req.method === "HEAD") {
        const limit = Number(url.searchParams.get("limit") ?? 20) || 20;
        const items = await engine.listMeta(limit);
        sendJson(res, 200, { ok: true, count: items.length, items });
        return true;
      }
      if (req.method !== "POST") {
        sendJson(res, 405, {
          ok: false,
          error: { code: "METHOD_NOT_ALLOWED", message: "Use POST to create a snapshot." },
        });
        return true;
      }
      const body = await readJsonBody(req) as Record<string, unknown>;
      const result = await engine.createSnapshot({
        provider: String(body.provider ?? ""),
        symbol: String(body.symbol ?? ""),
        candleTimeframe: String(body.candleTimeframe ?? body.timeframe ?? ""),
        analysisPeriod: String(body.analysisPeriod ?? ""),
        higherTimeframes: Array.isArray(body.higherTimeframes)
          ? body.higherTimeframes.map(String)
          : undefined,
        requireLiveQuote: Boolean(body.requireLiveQuote),
        marketType: body.marketType == null ? null : String(body.marketType),
        requestId: body.requestId == null ? undefined : String(body.requestId),
      });
      sendJson(res, result.ok ? 200 : 422, {
        ok: result.ok,
        code: result.code,
        error: result.error,
        latencyMs: result.latencyMs,
        snapshot: result.snapshot,
      });
      return true;
    }

    const match = url.pathname.match(/^\/api\/forex\/analysis-snapshot\/([^/]+)$/);
    if (match) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const id = decodeURIComponent(match[1] ?? "");
      const snapshot = await engine.getSnapshot(id);
      if (!snapshot) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "SNAPSHOT_NOT_FOUND", message: "Snapshot not found." },
        });
        return true;
      }
      sendJson(res, 200, { ok: true, snapshot });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown analysis-snapshot route." },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Snapshot request failed.";
    sendJson(res, 500, {
      ok: false,
      error: { code: "SNAPSHOT_ERROR", message },
    });
    return true;
  }
}
