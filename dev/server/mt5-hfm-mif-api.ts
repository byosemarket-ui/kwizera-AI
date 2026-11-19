/**
 * Phase 5D.5 — HFM_MT5 MIF Opportunity Detection Admin API (read-only / analytical).
 *
 * Selected surface: admin HTTP endpoint (not a background worker).
 * Rationale: on-demand analysis reuses existing admin auth, avoids uncontrolled
 * polling on a resource-constrained VPS, and mirrors Phase 2 analysis API patterns.
 *
 * POST /api/forex/providers/mt5-hfm/mif/opportunity-detection
 * GET  /api/forex/providers/mt5-hfm/mif/opportunity-detection/status
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertAdminAccess, rolesFromHeaders, adminTokenFromHeaders } from "../../ai/admin-control-plane/admin-auth-boundary.js";
import { assertNoSecretsInMt5HfmPayload } from "../../ai/market-data/mt5-hfm/secrets-guard.js";
import {
  MIF_PRODUCTION_DEFAULT_TIMEFRAMES,
  MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
  MIF_PRODUCTION_PRIMARY_TIMEFRAME,
  MIF_PROVIDER_ID,
  runMifHfmOpportunityPipelineLive,
} from "../../ai/market-data/mt5-hfm/mif/index.js";

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

const MAX_BODY = 8192;
const PATH_PREFIX = "/api/forex/providers/mt5-hfm/mif";

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

function publicResultPayload(result: Awaited<ReturnType<typeof runMifHfmOpportunityPipelineLive>>) {
  // Strip debug context if present; never expose internal secrets.
  const { _debugContext: _drop, ...safe } = result as typeof result & { _debugContext?: unknown };
  void _drop;
  return {
    ok:
      result.analysisStatus === "OK"
      || result.analysisStatus === "OK_EMPTY_CANDIDATES"
      || result.analysisStatus === "INSUFFICIENT_EVIDENCE"
      || result.analysisStatus === "PARTIAL_DEGRADED",
    ...safe,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalOnly: true,
    notExecutable: true,
  };
}

export async function handleMt5HfmMifApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  sendJson: SendJson,
): Promise<boolean> {
  if (!url.pathname.startsWith(PATH_PREFIX)) return false;

  if (!requireAdmin(req, res, sendJson, url.pathname)) return true;

  if (url.pathname === `${PATH_PREFIX}/opportunity-detection/status` && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      providerId: MIF_PROVIDER_ID,
      contractId: MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
      defaultTimeframes: [...MIF_PRODUCTION_DEFAULT_TIMEFRAMES],
      primaryTimeframe: MIF_PRODUCTION_PRIMARY_TIMEFRAME,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalOnly: true,
      surface: "admin-http",
      surfaceRationale:
        "On-demand admin API preferred over background worker to avoid uncontrolled polling on constrained VPS.",
    });
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/opportunity-detection` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      const code = (err as { code?: string }).code;
      sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
        ok: false,
        error: {
          code: code === "PAYLOAD_TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }

    const symbol = String(body.symbol ?? body.providerSymbol ?? "").trim().toUpperCase();
    if (!symbol) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INSTRUMENT", message: "symbol is required" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }

    const providerRaw = String(body.providerId ?? body.provider ?? MIF_PROVIDER_ID).trim().toUpperCase();
    if (providerRaw !== MIF_PROVIDER_ID) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "WRONG_PROVIDER",
          message: `provider ${providerRaw} rejected; only HFM_MT5 permitted`,
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }

    const timeframes = Array.isArray(body.timeframes)
      ? body.timeframes.map((t) => String(t).trim().toUpperCase()).filter(Boolean)
      : undefined;
    const primaryTimeframe =
      typeof body.primaryTimeframe === "string" ? body.primaryTimeframe.trim().toUpperCase() : undefined;
    const candleLimit =
      typeof body.candleLimit === "number" && Number.isFinite(body.candleLimit)
        ? body.candleLimit
        : undefined;
    const requestId =
      typeof body.requestId === "string" && body.requestId.trim()
        ? body.requestId.trim()
        : undefined;
    const refresh = body.refresh === true;

    console.info(
      JSON.stringify({
        event: "mif_od_analysis_started",
        requestId: requestId ?? null,
        providerId: MIF_PROVIDER_ID,
        symbol,
        timeframes: timeframes ?? [...MIF_PRODUCTION_DEFAULT_TIMEFRAMES],
      }),
    );

    try {
      const result = await runMifHfmOpportunityPipelineLive({
        requestId,
        providerId: MIF_PROVIDER_ID,
        providerSymbol: symbol,
        timeframes,
        primaryTimeframe,
        candleLimit,
        refresh,
      });

      const payload = publicResultPayload(result);
      assertNoSecretsInMt5HfmPayload(payload);

      console.info(
        JSON.stringify({
          event: "mif_od_analysis_completed",
          requestId: result.requestId,
          symbol: result.providerSymbol,
          analysisStatus: result.analysisStatus,
          candidateCount: result.candidateCount,
          dataQualityStatus: result.dataQualityStatus,
          detectorOutcomes: result.detection?.outcomes.map((o) => ({
            strategyId: o.strategyId,
            status: o.status,
          })),
        }),
      );

      const httpStatus =
        result.analysisStatus === "FAILED_VALIDATION"
          ? 400
          : result.analysisStatus === "FAILED_PROVIDER"
            || result.analysisStatus === "FAILED_UPSTREAM_DATA"
            ? 502
            : result.analysisStatus.startsWith("FAILED_")
              ? 500
              : 200;

      sendJson(res, httpStatus, payload);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "mif_od_analysis_failed",
          symbol,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      sendJson(res, 500, {
        ok: false,
        error: {
          code: "PIPELINE_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        doesNotApproveAiReasoning: true,
      });
    }
    return true;
  }

  sendJson(res, 404, {
    ok: false,
    error: { code: "NOT_FOUND", message: `Unknown MIF route ${url.pathname}` },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  });
  return true;
}
