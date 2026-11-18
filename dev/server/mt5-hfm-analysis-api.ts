/**
 * Phase 2 — HFM Analysis preparation Admin API (no OpenAI reasoning, no execution).
 *
 * POST /api/forex/providers/mt5-hfm/analysis/context
 * GET  /api/forex/providers/mt5-hfm/analysis/context/:snapshotId
 * GET  /api/forex/providers/mt5-hfm/analysis/status
 * GET  /api/forex/providers/mt5-hfm/analysis/images/:imageId
 * POST /api/forex/providers/mt5-hfm/analysis/retention/run
 * GET  /api/forex/providers/mt5-hfm/analysis/openai-inspection
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertAdminAccess, rolesFromHeaders, adminTokenFromHeaders } from "../../ai/admin-control-plane/admin-auth-boundary.js";
import { assertNoSecretsInMt5HfmPayload } from "../../ai/market-data/mt5-hfm/secrets-guard.js";
import {
  getHfmAnalysisPrepStatus,
  getHfmAnalysisStorage,
  noteSelectedChartSymbol,
  prepareHfmAnalysisContext,
  runHfmAnalysisRetentionCleanup,
  HFM_ANALYSIS_DEFAULT_TF_PACK,
  HFM_ANALYSIS_PROVIDER,
} from "../../ai/market-data/mt5-hfm/analysis/index.js";
import {
  disableHfmAutoAnalysis,
  enableHfmAutoAnalysis,
  executeAnalysisPipeline,
  getHfmAutoAnalysisStatus,
  getHfmReasoningStatus,
  getHfmReasoningStorage,
  runHfmAiReasoning,
  setHfmAutoAnalysisSymbol,
} from "../../ai/market-data/mt5-hfm/analysis/reasoning/index.js";
import { isOpenAiVisionEligibleModel } from "../../ai/forex-ai/multi-image-openai/vision-policy.js";
import {
  getForexOpenAiConfigStore,
  isOpenAiChatEligibleModel,
} from "../../ai/forex-ai/snapshot-openai/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

const MAX_BODY = 8192;

function headersRecord(req: IncomingMessage): Record<string, string | string[] | undefined> {
  return req.headers as Record<string, string | string[] | undefined>;
}

function requireAdmin(
  req: IncomingMessage,
  res: ServerResponse,
  sendJson: SendJson,
  pathname: string,
): boolean {
  const decision = assertAdminAccess({
    roles: rolesFromHeaders(headersRecord(req)),
    adminToken: adminTokenFromHeaders(headersRecord(req)),
    path: pathname,
    adminApi: true,
    remoteAddress: req.socket.remoteAddress,
  });
  if (!decision.allowed) {
    sendJson(res, 403, {
      ok: false,
      error: { code: "ADMIN_FORBIDDEN", message: decision.reason },
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return false;
  }
  return true;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY) {
      throw Object.assign(new Error("Request body too large"), { code: "PAYLOAD_TOO_LARGE" });
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function publicContextPayload(result: Awaited<ReturnType<typeof prepareHfmAnalysisContext>>) {
  const storage = getHfmAnalysisStorage();
  const images: Record<string, unknown> = {};
  for (const [tf, meta] of Object.entries(result.chartImages)) {
    images[tf] = {
      ...meta,
      ...storage.protectedImageRef(meta.imageId),
    };
  }
  return {
    ok: result.ok,
    provider: HFM_ANALYSIS_PROVIDER,
    state: result.state,
    job: result.job,
    snapshot: result.snapshot
      ? {
          snapshotId: result.snapshot.snapshotId,
          snapshotHash: result.snapshot.snapshotHash,
          hashVersion: result.snapshot.hashVersion,
          provider: result.snapshot.provider,
          symbol: result.snapshot.symbol,
          capturedAt: result.snapshot.capturedAt,
          chartTimeframeAtStart: result.snapshot.chartTimeframeAtStart,
          dataQuality: result.snapshot.dataQuality,
          synchronization: result.snapshot.synchronization,
          quote: result.snapshot.quote,
          timeframeSummaries: Object.fromEntries(
            Object.entries(result.snapshot.timeframes).map(([tf, ds]) => [
              tf,
              {
                timeframe: ds.timeframe,
                symbol: ds.symbol,
                candleCount: ds.candleCount,
                oldestTimestamp: ds.oldestTimestamp,
                newestTimestamp: ds.newestTimestamp,
                freshness: ds.freshness,
                validationStatus: ds.validationStatus,
                hasCurrent: Boolean(ds.current),
              },
            ]),
          ),
          // Full candles available via stored context; omit bulky series from default API response.
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        }
      : null,
    chartImages: images,
    timings: result.timings,
    diagnostics: result.diagnostics,
    analysisTimeframes: [...HFM_ANALYSIS_DEFAULT_TF_PACK],
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

export async function handleMt5HfmAnalysisApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith("/api/forex/providers/mt5-hfm/analysis")) {
    return false;
  }

  if (!requireAdmin(req, res, sendJson, url.pathname)) return true;

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/status" && req.method === "GET") {
    const status = getHfmAnalysisPrepStatus();
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      ...status,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/context" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? "").trim().toUpperCase();
      if (!symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "SYMBOL_REQUIRED", message: "symbol is required" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      // Reject provider override attempts.
      if (body.provider != null && String(body.provider) !== HFM_ANALYSIS_PROVIDER) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "PROVIDER_LOCKED", message: "Only HFM_MT5 is permitted." },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      noteSelectedChartSymbol(symbol);
      const result = await prepareHfmAnalysisContext({
        symbol,
        chartTimeframe: String(body.chartTimeframe ?? body.timeframe ?? "H1"),
        refresh: body.refresh === true,
        runRetention: body.runRetention === true,
      });
      const payload = publicContextPayload(result);
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, result.ok ? 200 : 422, payload);
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: {
          code: "CONTEXT_FAILED",
          message: err instanceof Error ? err.message : String(err),
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
    }
    return true;
  }

  const contextReasoningMatch = url.pathname.match(
    /^\/api\/forex\/providers\/mt5-hfm\/analysis\/context\/([^/]+)\/reasoning$/,
  );
  if (contextReasoningMatch && req.method === "GET") {
    const contextId = decodeURIComponent(contextReasoningMatch[1] ?? "");
    const list = await getHfmReasoningStorage().list({ contextId, limit: 1 });
    const latest = list[0] ?? null;
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      contextId,
      analysis: latest,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const contextMatch = url.pathname.match(
    /^\/api\/forex\/providers\/mt5-hfm\/analysis\/context\/([^/]+)$/,
  );
  if (contextMatch && req.method === "GET") {
    const snapshotId = decodeURIComponent(contextMatch[1] ?? "");
    const stored = await getHfmAnalysisStorage().loadContext(snapshotId);
    if (!stored) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Context not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = publicContextPayload(stored);
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const imageMatch = url.pathname.match(
    /^\/api\/forex\/providers\/mt5-hfm\/analysis\/images\/([^/]+)$/,
  );
  if (imageMatch && req.method === "GET") {
    const imageId = decodeURIComponent(imageMatch[1] ?? "");
    if (!/^[a-f0-9]{16,64}$/i.test(imageId)) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_IMAGE_ID", message: "Invalid image id" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const loaded = await getHfmAnalysisStorage().loadImage(imageId);
    if (!loaded) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Image not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": loaded.png.length,
      "X-Kwizera-Image-Id": loaded.meta.imageId,
      "X-Kwizera-Symbol": loaded.meta.symbol,
      "X-Kwizera-Timeframe": loaded.meta.timeframe,
      "X-Kwizera-Snapshot-Id": loaded.meta.snapshotId,
      "Cache-Control": "private, no-store",
    });
    res.end(loaded.png);
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/retention/run" && req.method === "POST") {
    const result = await runHfmAnalysisRetentionCleanup();
    const payload = {
      ok: result.ok,
      provider: HFM_ANALYSIS_PROVIDER,
      cleanup: result,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/openai-inspection" && req.method === "GET") {
    // Safe public status only — never returns API key.
    const status = await getForexOpenAiConfigStore().getPublicStatus();
    const payload = {
      ok: true,
      provider: "OPENAI",
      model: status.model,
      modelEligible: status.modelEligible,
      chatCompletionsCompatible: isOpenAiChatEligibleModel(status.model),
      visionEligible: isOpenAiVisionEligibleModel(status.model),
      configured: status.configured,
      vaultUnlocked: status.vaultUnlocked,
      verificationDisplay: status.verificationDisplay,
      note: status.note,
      phase2Policy: {
        reuseExistingIntegration: true,
        responsesApiMigration: false,
        modelChangesForbidden: true,
        analysisRequestsInPhase2: false,
        imageInputExpectedForLaterPhases: true,
        concurrencyNote: "Existing OPENAI_AI_MAX_CONCURRENT=1 applies to later phases",
      },
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  // --- Phase 4 Auto Analysis scheduler ---
  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/auto-analysis" && req.method === "GET") {
    const scheduler = await getHfmAutoAnalysisStatus();
    const reasoning = getHfmReasoningStatus();
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      scheduler,
      activeAnalysis: reasoning.active,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/auto-analysis/enable" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? "").trim().toUpperCase();
      if (!symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "SYMBOL_REQUIRED", message: "symbol is required" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      const { state, firstRun } = await enableHfmAutoAnalysis({
        symbol,
        chartTimeframe: String(body.chartTimeframe ?? body.timeframe ?? "H4"),
      });
      const payload = {
        ok: true,
        provider: HFM_ANALYSIS_PROVIDER,
        scheduler: state,
        firstRun,
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, firstRun.alreadyRunning ? 409 : firstRun.ok ? 200 : 422, payload);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "AUTO_ANALYSIS_ENABLE_FAILED",
          message: err instanceof Error ? err.message.slice(0, 300) : String(err),
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
    }
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/auto-analysis/disable" && req.method === "POST") {
    const scheduler = await disableHfmAutoAnalysis();
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      scheduler,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/auto-analysis/symbol" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? "").trim().toUpperCase();
      if (!symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "SYMBOL_REQUIRED", message: "symbol is required" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      const scheduler = await setHfmAutoAnalysisSymbol({
        symbol,
        chartTimeframe: body.chartTimeframe != null || body.timeframe != null
          ? String(body.chartTimeframe ?? body.timeframe)
          : undefined,
      });
      const payload = {
        ok: true,
        provider: HFM_ANALYSIS_PROVIDER,
        scheduler,
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "SYMBOL_UPDATE_FAILED",
          message: err instanceof Error ? err.message.slice(0, 300) : String(err),
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
    }
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/analyze-now" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const symbol = String(body.symbol ?? "").trim().toUpperCase();
      if (!symbol) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "SYMBOL_REQUIRED", message: "symbol is required" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      if (body.provider != null && String(body.provider) !== HFM_ANALYSIS_PROVIDER) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "PROVIDER_LOCKED", message: "Only HFM_MT5 is permitted." },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      noteSelectedChartSymbol(symbol);
      const result = await executeAnalysisPipeline({
        symbol,
        chartTimeframe: String(body.chartTimeframe ?? body.timeframe ?? "H4"),
        trigger: "manual",
      });
      const payload = {
        ok: result.ok,
        provider: HFM_ANALYSIS_PROVIDER,
        ...result,
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      const http = result.alreadyRunning ? 409 : result.ok ? 200 : result.blocked ? 422 : 502;
      sendJson(res, http, payload);
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: {
          code: "ANALYZE_NOW_FAILED",
          message: err instanceof Error ? err.message.slice(0, 300) : String(err),
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
    }
    return true;
  }

  // --- Phase 3 reasoning ---
  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/reason" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const contextId = String(body.contextId ?? body.snapshotId ?? "").trim();
      if (!contextId) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "CONTEXT_REQUIRED", message: "contextId is required" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      if (body.provider != null && String(body.provider) !== HFM_ANALYSIS_PROVIDER) {
        sendJson(res, 400, {
          ok: false,
          error: { code: "PROVIDER_LOCKED", message: "Only HFM_MT5 is permitted." },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      const record = await runHfmAiReasoning({ contextId });
      const payload = {
        ok: record.status === "COMPLETED",
        provider: HFM_ANALYSIS_PROVIDER,
        analysis: record,
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      const http =
        record.status === "COMPLETED" ? 200
          : record.status === "REJECTED" ? 422
            : 502;
      sendJson(res, http, payload);
    } catch (err) {
      sendJson(res, 500, {
        ok: false,
        error: {
          code: "REASONING_FAILED",
          message: err instanceof Error ? err.message.slice(0, 300) : String(err),
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
    }
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/reason/history" && req.method === "GET") {
    const symbol = url.searchParams.get("symbol")?.trim() || undefined;
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const items = await getHfmReasoningStorage().list({ symbol, limit, offset });
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      items,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === "/api/forex/providers/mt5-hfm/analysis/reason/status" && req.method === "GET") {
    const status = getHfmReasoningStatus();
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      ...status,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const reasonStatusMatch = url.pathname.match(
    /^\/api\/forex\/providers\/mt5-hfm\/analysis\/reason\/([^/]+)\/status$/,
  );
  if (reasonStatusMatch && req.method === "GET") {
    const analysisId = decodeURIComponent(reasonStatusMatch[1] ?? "");
    const active = getHfmReasoningStatus().active;
    const stored = await getHfmReasoningStorage().load(analysisId);
    const analysis = stored ?? (active?.analysisId === analysisId ? active : null);
    if (!analysis) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Analysis not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      analysisId: analysis.analysisId,
      status: analysis.status,
      symbol: analysis.symbol,
      contextId: analysis.contextId,
      errorCode: analysis.errorCode,
      errorMessage: analysis.errorMessage,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const reasonMatch = url.pathname.match(
    /^\/api\/forex\/providers\/mt5-hfm\/analysis\/reason\/([^/]+)$/,
  );
  if (reasonMatch && req.method === "GET") {
    const analysisId = decodeURIComponent(reasonMatch[1] ?? "");
    const stored = await getHfmReasoningStorage().load(analysisId);
    if (!stored) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "Analysis not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = {
      ok: true,
      provider: HFM_ANALYSIS_PROVIDER,
      analysis: stored,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  sendJson(res, 404, {
    ok: false,
    error: { code: "NOT_FOUND", message: "Unknown HFM analysis route" },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  });
  return true;
}
