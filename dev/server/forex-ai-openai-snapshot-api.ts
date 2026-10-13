/**
 * Phase 43E — OpenAI analysis from an immutable market-data snapshot.
 *
 * POST /api/forex/ai-analysis/openai              analyze snapshot
 * GET  /api/forex/ai-analysis/openai/:analysisId  fetch analysis
 * GET  /api/forex/ai-analysis/openai?snapshotId=  list analyses
 * GET  /api/forex/ai-analysis/openai/meta         schema / status (no secrets)
 *
 * Admin config (requireForexAdmin):
 * GET/PUT/DELETE /api/forex-admin/openai-config
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_TIMEOUT_MS,
  OPENAI_MAX_TIMEOUT_MS,
  OPENAI_MIN_TIMEOUT_MS,
  OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
  getForexOpenAiConfigStore,
  getOpenAiInferenceGate,
  getOpenAiSnapshotAnalysisEngine,
} from "../../ai/forex-ai/snapshot-openai/index.js";
import { requireForexAdmin } from "./forex-admin-auth.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

async function readJsonBody(req: IncomingMessage, maxBytes = 32_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (Buffer.concat(chunks).length > maxBytes) {
      throw new Error("Request body too large.");
    }
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function evidencePublic(evidence: {
  snapshotId: string;
  contentFingerprint: string;
  provider: string;
  instrument: unknown;
  candleTimeframe: string;
  analysisPeriod: string;
  quoteFreshness: string;
  validationStatus: string;
  candleCount: number;
  categories: unknown;
  warnings: string[];
} | null) {
  if (!evidence) return null;
  return {
    snapshotId: evidence.snapshotId,
    contentFingerprint: evidence.contentFingerprint,
    provider: evidence.provider,
    instrument: evidence.instrument,
    candleTimeframe: evidence.candleTimeframe,
    analysisPeriod: evidence.analysisPeriod,
    quoteFreshness: evidence.quoteFreshness,
    validationStatus: evidence.validationStatus,
    candleCount: evidence.candleCount,
    categories: evidence.categories,
    warnings: evidence.warnings,
  };
}

/** Admin OpenAI configuration routes under /api/forex-admin/openai-config */
export async function handleForexOpenAiAdminConfigApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (url.pathname !== "/api/forex-admin/openai-config") return false;
  if (!requireForexAdmin(req, res, sendJson, url.pathname)) return true;

  const store = getForexOpenAiConfigStore();

  try {
    if (req.method === "GET" || req.method === "HEAD") {
      const status = await store.getPublicStatus();
      sendJson(res, 200, {
        ok: true,
        status,
        defaultModel: OPENAI_DEFAULT_MODEL,
        // Never include apiKey or ciphertext.
      });
      return true;
    }

    if (req.method === "PUT" || req.method === "POST") {
      const body = await readJsonBody(req, 8_000) as {
        apiKey?: string;
        model?: string;
        clearKey?: boolean;
      };
      if (body.clearKey === true) {
        const status = await store.clearApiKey();
        sendJson(res, 200, { ok: true, status, message: "OpenAI API key cleared." });
        return true;
      }
      if (body.apiKey != null && String(body.apiKey).trim()) {
        const status = await store.setApiKey(String(body.apiKey), body.model);
        sendJson(res, 200, {
          ok: true,
          status,
          message: "OpenAI API key saved (encrypted). Value is never returned.",
        });
        return true;
      }
      if (body.model != null) {
        const status = await store.setModel(String(body.model));
        sendJson(res, 200, { ok: true, status, message: "OpenAI model updated." });
        return true;
      }
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_REQUEST", message: "Provide apiKey, model, or clearKey." },
      });
      return true;
    }

    if (req.method === "DELETE") {
      const status = await store.clearApiKey();
      sendJson(res, 200, { ok: true, status, message: "OpenAI API key cleared." });
      return true;
    }

    sendJson(res, 405, {
      ok: false,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET, PUT, POST, or DELETE." },
    });
    return true;
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "OPENAI_CONFIG_ERROR";
    const message = error instanceof Error ? error.message.slice(0, 240) : "OpenAI config failed.";
    // Never include key material.
    sendJson(res, code === "SECRETS_VAULT_LOCKED" ? 503 : 400, {
      ok: false,
      error: { code, message: message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") },
    });
    return true;
  }
}

export async function handleForexAiOpenAiSnapshotApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/ai-analysis/openai")) return false;

  const engine = getOpenAiSnapshotAnalysisEngine();
  const config = getForexOpenAiConfigStore();

  try {
    if (url.pathname === "/api/forex/ai-analysis/openai/meta") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await config.getPublicStatus();
      sendJson(res, 200, {
        ok: true,
        schemaVersion: OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
        provider: "OPENAI",
        defaultTimeoutMs: OPENAI_DEFAULT_TIMEOUT_MS,
        minTimeoutMs: OPENAI_MIN_TIMEOUT_MS,
        maxTimeoutMs: OPENAI_MAX_TIMEOUT_MS,
        concurrency: getOpenAiInferenceGate().stats(),
        decisions: ["BUY", "SELL", "WAIT", "NO_TRADE"],
        newsResearch: "unavailable",
        status,
        note:
          "Independent OpenAI analysis of an immutable snapshotId. "
          + "Does not call Local AI. Does not place broker orders. API key never returned.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/ai-analysis/openai") {
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
        includeNewsResearch: Boolean(body.includeNewsResearch),
      });

      const httpStatus = result.ok
        ? 200
        : result.code === "SNAPSHOT_NOT_FOUND"
          ? 404
          : result.code === "AI_QUEUE_FULL" || result.code === "OPENAI_RATE_LIMIT"
            ? 429
            : result.code === "OPENAI_NOT_CONFIGURED" || result.code === "SECRETS_VAULT_LOCKED"
              ? 503
              : 422;

      sendJson(res, httpStatus, {
        ok: result.ok,
        code: result.code,
        error: result.error,
        latencyMs: result.latencyMs,
        analysis: result.analysis,
        evidence: evidencePublic(result.evidence),
      });
      return true;
    }

    const match = url.pathname.match(/^\/api\/forex\/ai-analysis\/openai\/([^/]+)$/);
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
      sendJson(res, 200, { ok: true, analysis: row.analysis, evidence: evidencePublic(row.evidence) });
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      error: { code: "NOT_FOUND", message: "Unknown OpenAI analysis route." },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "OpenAI analysis failed.";
    sendJson(res, 500, {
      ok: false,
      error: {
        code: "AI_ERROR",
        message: message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]"),
      },
    });
    return true;
  }
}
