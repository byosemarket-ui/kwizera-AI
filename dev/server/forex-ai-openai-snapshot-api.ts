/**
 * Phase 43E/43F — OpenAI analysis from an immutable market-data snapshot.
 *
 * POST /api/forex/ai-analysis/openai              analyze snapshot
 * GET  /api/forex/ai-analysis/openai/:analysisId  fetch analysis
 * GET  /api/forex/ai-analysis/openai?snapshotId=  list analyses
 * GET  /api/forex/ai-analysis/openai/meta         schema / status (no secrets)
 *
 * Admin config (requireForexAdmin):
 * GET/PUT/DELETE /api/forex-admin/openai-config
 * GET  /api/forex-admin/openai-config/models
 * POST /api/forex-admin/openai-config/models/refresh
 * POST /api/forex-admin/openai-config/verify
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_TIMEOUT_MS,
  OPENAI_MAX_TIMEOUT_MS,
  OPENAI_MIN_TIMEOUT_MS,
  OPENAI_SNAPSHOT_ANALYSIS_SCHEMA,
  discoverEligibleOpenAiModels,
  getForexOpenAiConfigStore,
  getOpenAiInferenceGate,
  getOpenAiSnapshotAnalysisEngine,
  isOpenAiChatEligibleModel,
  verifyOpenAiConnection,
} from "../../ai/forex-ai/snapshot-openai/index.js";
import {
  MULTI_IMAGE_ANALYSIS_SCHEMA,
  MULTI_IMAGE_DEFAULT_TIMEOUT_MS,
  MULTI_IMAGE_MAX_BYTES_PER_IMAGE,
  MULTI_IMAGE_MAX_CAPTURES,
  MULTI_IMAGE_MAX_TIMEOUT_MS,
  MULTI_IMAGE_MAX_TOTAL_BYTES,
  MULTI_IMAGE_MIN_TIMEOUT_MS,
  getMultiImageAnalysisStore,
  getMultiImageOpenAiAnalysisEngine,
  isOpenAiVisionEligibleModel,
} from "../../ai/forex-ai/multi-image-openai/index.js";
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
  if (!url.pathname.startsWith("/api/forex-admin/openai-config")) return false;
  if (!requireForexAdmin(req, res, sendJson, url.pathname)) return true;

  const store = getForexOpenAiConfigStore();

  try {
    // GET cached eligible models (no live OpenAI call)
    if (url.pathname === "/api/forex-admin/openai-config/models") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await store.getPublicStatus();
      const cached = await store.getDiscoveredModels();
      sendJson(res, 200, {
        ok: true,
        status,
        discoveredAt: cached.discoveredAt,
        stale: cached.stale,
        models: cached.models,
        selectedModel: status.model,
        note:
          "Cached discovery only. Use POST …/models/refresh to fetch from OpenAI. "
          + "Eligible = chat-compatible policy; not a claim of Forex suitability.",
      });
      return true;
    }

    // POST verify — bounded Chat Completions JSON ping (does not claim Forex suitability alone)
    if (url.pathname === "/api/forex-admin/openai-config/verify") {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const status = await store.getPublicStatus();
      if (!status.vaultUnlocked) {
        sendJson(res, 503, {
          ok: false,
          error: {
            code: "SECRETS_VAULT_LOCKED",
            message: "Secret vault is locked. Set KWIZERA_SECRETS_PASSPHRASE on the server.",
          },
        });
        return true;
      }
      if (!status.configured) {
        sendJson(res, 503, {
          ok: false,
          error: {
            code: "OPENAI_NOT_CONFIGURED",
            message: "OpenAI API key is not configured. Save an encrypted key first.",
          },
        });
        return true;
      }

      const body = await readJsonBody(req, 4_000) as { model?: string };
      const modelToTest = String(body.model ?? status.model).trim() || status.model;
      if (!isOpenAiChatEligibleModel(modelToTest)) {
        await store.recordValidation(false, `Model "${modelToTest}" is not chat-eligible.`);
        sendJson(res, 422, {
          ok: false,
          error: {
            code: "MODEL_NOT_ELIGIBLE",
            message: `Model "${modelToTest}" is not eligible for Forex chat analysis.`,
          },
          status: await store.getPublicStatus(),
        });
        return true;
      }

      let apiKey: string | null;
      try {
        apiKey = await store.getApiKey();
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "SECRET_DECRYPT_FAILED";
        sendJson(res, 503, {
          ok: false,
          error: {
            code,
            message: err instanceof Error ? err.message.slice(0, 200) : "Failed to decrypt API key.",
          },
        });
        return true;
      }
      if (!apiKey) {
        sendJson(res, 503, {
          ok: false,
          error: { code: "OPENAI_NOT_CONFIGURED", message: "OpenAI API key is not configured." },
        });
        return true;
      }

      const verified = await verifyOpenAiConnection({
        apiKey,
        model: modelToTest,
        timeoutMs: 25_000,
      });
      apiKey = null;

      await store.recordValidation(
        verified.ok,
        verified.ok
          ? `Verified model ${modelToTest} via bounded Chat Completions JSON ping.`
          : (verified.error || verified.code),
      );
      const nextStatus = await store.getPublicStatus();
      const http = verified.ok
        ? 200
        : verified.code === "OPENAI_AUTH_ERROR"
          ? 401
          : verified.code === "OPENAI_RATE_LIMIT"
            ? 429
            : verified.code === "OPENAI_TIMEOUT" || verified.code === "OPENAI_UNAVAILABLE"
              ? 503
              : 422;
      sendJson(res, http, {
        ok: verified.ok,
        code: verified.code,
        model: modelToTest,
        returnedModel: verified.returnedModel,
        latencyMs: verified.latencyMs,
        verificationDisplay: nextStatus.verificationDisplay,
        status: nextStatus,
        error: verified.ok
          ? null
          : {
              code: verified.code,
              message: (verified.error || "Verification failed.").replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]"),
            },
        note: verified.ok
          ? "Connection verified with a bounded non-trading JSON ping. Forex analysis suitability still depends on structured analysis responses."
          : "Verification failed. Key presence alone does not imply VERIFIED.",
      });
      return true;
    }

    // POST refresh — server decrypts key, lists models, probes GPT-6 candidates
    if (url.pathname === "/api/forex-admin/openai-config/models/refresh") {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const status = await store.getPublicStatus();
      if (!status.vaultUnlocked) {
        sendJson(res, 503, {
          ok: false,
          error: {
            code: "SECRETS_VAULT_LOCKED",
            message: "Secret vault is locked. Set KWIZERA_SECRETS_PASSPHRASE on the server.",
          },
        });
        return true;
      }
      if (!status.configured) {
        sendJson(res, 503, {
          ok: false,
          error: {
            code: "OPENAI_NOT_CONFIGURED",
            message: "OpenAI API key is not configured. Save an encrypted key first.",
          },
        });
        return true;
      }

      let apiKey: string | null;
      try {
        apiKey = await store.getApiKey();
      } catch (err) {
        const code = (err as { code?: string })?.code ?? "SECRET_DECRYPT_FAILED";
        sendJson(res, 503, {
          ok: false,
          error: {
            code,
            message: err instanceof Error ? err.message.slice(0, 200) : "Failed to decrypt API key.",
          },
        });
        return true;
      }
      if (!apiKey) {
        sendJson(res, 503, {
          ok: false,
          error: { code: "OPENAI_NOT_CONFIGURED", message: "OpenAI API key is not configured." },
        });
        return true;
      }

      const discovered = await discoverEligibleOpenAiModels({
        apiKey,
        timeoutMs: 15_000,
      });
      apiKey = null;

      if (!discovered.ok) {
        const http =
          discovered.code === "OPENAI_AUTH_ERROR"
            ? 401
            : discovered.code === "OPENAI_RATE_LIMIT"
              ? 429
              : discovered.code === "OPENAI_TIMEOUT" || discovered.code === "OPENAI_UNAVAILABLE"
                ? 503
                : 422;
        sendJson(res, http, {
          ok: false,
          error: {
            code: discovered.code,
            message: discovered.error || "Model discovery failed.",
          },
          latencyMs: discovered.latencyMs,
        });
        return true;
      }

      await store.saveDiscoveredModels(discovered.models);
      const nextStatus = await store.getPublicStatus();
      const selectedInList = discovered.models.some((m) => m.id === nextStatus.model);
      const gpt6 = discovered.models.filter((m) => m.gpt6Family);

      sendJson(res, 200, {
        ok: true,
        latencyMs: discovered.latencyMs,
        discoveredAt: nextStatus.modelsDiscoveredAt,
        models: discovered.models,
        listedCount: discovered.listedCount,
        gpt6Candidates: discovered.probed,
        gpt6EligibleCount: gpt6.length,
        selectedModel: nextStatus.model,
        selectedModelInDiscovery: selectedInList,
        selectedModelEligible: nextStatus.modelEligible,
        status: nextStatus,
        note:
          "Eligible models pass chat-compatibility policy (including gpt-6* when accessible). "
          + "List membership ≠ Forex suitability. Saved selection is never auto-replaced. "
          + "Use Verify connection for a bounded inference check.",
      });
      return true;
    }

    if (url.pathname !== "/api/forex-admin/openai-config") {
      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Unknown OpenAI config route." },
      });
      return true;
    }

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

    // Phase 49B — multi-image routes (must be before /:analysisId)
    if (url.pathname === "/api/forex/ai-analysis/openai/multi-image/meta") {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const status = await config.getPublicStatus();
      sendJson(res, 200, {
        ok: true,
        schemaVersion: MULTI_IMAGE_ANALYSIS_SCHEMA,
        phase: "49C",
        maxCaptures: MULTI_IMAGE_MAX_CAPTURES,
        maxTotalBytes: MULTI_IMAGE_MAX_TOTAL_BYTES,
        maxBytesPerImage: MULTI_IMAGE_MAX_BYTES_PER_IMAGE,
        defaultTimeoutMs: MULTI_IMAGE_DEFAULT_TIMEOUT_MS,
        minTimeoutMs: MULTI_IMAGE_MIN_TIMEOUT_MS,
        maxTimeoutMs: MULTI_IMAGE_MAX_TIMEOUT_MS,
        requiresExplicitConfirm: true,
        model: status.model,
        modelVisionEligible: isOpenAiVisionEligibleModel(status.model),
        note:
          "Multi-image analysis loads stored chart captures server-side. "
          + "Images are sent to OpenAI only after POST …/multi-image with confirmed=true. "
          + "Review alone does not transmit images.",
      });
      return true;
    }

    if (url.pathname === "/api/forex/ai-analysis/openai/multi-image/review") {
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = await readJsonBody(req, 64_000) as Record<string, unknown>;
      const multi = getMultiImageOpenAiAnalysisEngine();
      const result = await multi.buildReview(
        body.captureIds,
        body.snapshotId == null ? null : String(body.snapshotId),
      );
      sendJson(res, result.ok ? 200 : 422, {
        ok: result.ok,
        code: result.code,
        error: result.error,
        review: result.review,
      });
      return true;
    }

    if (url.pathname === "/api/forex/ai-analysis/openai/multi-image") {
      if (req.method === "GET" || req.method === "HEAD") {
        const items = await getMultiImageAnalysisStore().listRecent(
          Number(url.searchParams.get("limit") ?? 10) || 10,
        );
        sendJson(res, 200, { ok: true, count: items.length, items });
        return true;
      }
      if (req.method !== "POST") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use POST." } });
        return true;
      }
      const body = await readJsonBody(req, 64_000) as Record<string, unknown>;
      const multi = getMultiImageOpenAiAnalysisEngine();
      const result = await multi.analyze({
        confirmed: body.confirmed === true,
        selectionFingerprint: String(body.selectionFingerprint ?? ""),
        captureIds: Array.isArray(body.captureIds) ? body.captureIds.map(String) : [],
        snapshotId: body.snapshotId == null ? undefined : String(body.snapshotId),
        contentFingerprint: body.contentFingerprint == null
          ? undefined
          : String(body.contentFingerprint),
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
        tradeAllocation: body.tradeAllocation == null
          ? null
          : body.tradeAllocation as { amount: number; currency: string },
      });
      const httpStatus = result.ok
        ? 200
        : result.code === "CONFIRMATION_REQUIRED" || result.code === "SELECTION_CHANGED"
          ? 409
          : result.code === "MODEL_NOT_VISION_ELIGIBLE" || result.code === "INVALID_SELECTION"
            ? 422
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
        review: result.review,
      });
      return true;
    }

    const multiImageGet = url.pathname.match(/^\/api\/forex\/ai-analysis\/openai\/multi-image\/([^/]+)$/);
    if (multiImageGet) {
      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: { code: "METHOD_NOT_ALLOWED", message: "Use GET." } });
        return true;
      }
      const id = decodeURIComponent(multiImageGet[1] ?? "");
      if (id === "meta" || id === "review") {
        sendJson(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "Unknown route." } });
        return true;
      }
      const row = await getMultiImageAnalysisStore().get(id);
      if (!row) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "ANALYSIS_NOT_FOUND", message: "Multi-image analysis not found." },
        });
        return true;
      }
      sendJson(res, 200, { ok: true, analysis: row.analysis });
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
        tradeAllocation: body.tradeAllocation == null
          ? null
          : body.tradeAllocation as { amount: number; currency: string },
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
