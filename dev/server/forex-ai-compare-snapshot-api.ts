/**
 * Phase 43F — Compare Local AI + OpenAI independently on one snapshot.
 *
 * POST /api/forex/ai-analysis/compare
 * GET  /api/forex/ai-analysis/compare/meta
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  SNAPSHOT_COMPARE_SCHEMA,
  getSnapshotCompareOrchestrator,
} from "../../ai/forex-ai/snapshot-compare/index.js";
import { getForexOpenAiConfigStore } from "../../ai/forex-ai/snapshot-openai/index.js";

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

export async function handleForexAiCompareSnapshotApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/ai-analysis/compare")) return false;

  try {
    if (url.pathname === "/api/forex/ai-analysis/compare/meta") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await getForexOpenAiConfigStore().getPublicStatus();
      sendJson(res, 200, {
        ok: true,
        schemaVersion: SNAPSHOT_COMPARE_SCHEMA,
        modes: ["LOCAL", "OPENAI", "COMPARE"],
        defaultMode: "COMPARE",
        openai: {
          configured: status.configured,
          vaultUnlocked: status.vaultUnlocked,
          model: status.model,
          modelEligible: status.modelEligible,
        },
        note:
          "Compare runs Local AI and OpenAI independently on the same snapshotId. "
          + "Neither receives the other's result. No broker orders. No consensus trade signal.",
      });
      return true;
    }

    if (url.pathname !== "/api/forex/ai-analysis/compare") {
      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Unknown compare route." },
      });
      return true;
    }

    if (req.method !== "POST") {
      sendJson(res, 405, {
        ok: false,
        error: { code: "METHOD_NOT_ALLOWED", message: "Use POST to compare providers." },
      });
      return true;
    }

    const body = await readJsonBody(req) as Record<string, unknown>;
    const result = await getSnapshotCompareOrchestrator().compare({
      snapshotId: String(body.snapshotId ?? ""),
      contentFingerprint: body.contentFingerprint == null
        ? undefined
        : String(body.contentFingerprint),
      provider: body.provider == null ? undefined : String(body.provider),
      symbol: body.symbol == null ? undefined : String(body.symbol),
      candleTimeframe: body.candleTimeframe == null ? undefined : String(body.candleTimeframe),
      analysisPeriod: body.analysisPeriod == null ? undefined : String(body.analysisPeriod),
      localTimeoutMs: typeof body.localTimeoutMs === "number" ? body.localTimeoutMs : undefined,
      openaiTimeoutMs: typeof body.openaiTimeoutMs === "number" ? body.openaiTimeoutMs : undefined,
      tradeAllocation: body.tradeAllocation == null
        ? null
        : body.tradeAllocation as { amount: number; currency: string },
    });

    const httpStatus = result.ok
      ? 200
      : result.code === "SNAPSHOT_NOT_FOUND"
        ? 404
        : result.code === "AI_QUEUE_FULL"
          ? 429
          : result.code === "BOTH_FAILED"
            ? 422
            : 422;

    sendJson(res, httpStatus, {
      ok: result.ok,
      code: result.code,
      error: result.error,
      latencyMs: result.latencyMs,
      compare: result.compare,
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Compare failed.";
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
