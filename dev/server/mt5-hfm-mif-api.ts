/**
 * Phase 5D.5/5D.6/5D.7 — HFM_MT5 MIF Opportunity Detection Admin API (read-only / analytical).
 *
 * Primary surface: on-demand admin HTTP.
 * Optional worker: disabled by default; explicit enable required.
 *
 * POST /api/forex/providers/mt5-hfm/mif/opportunity-detection
 * GET  /api/forex/providers/mt5-hfm/mif/opportunity-detection/status
 * GET  /api/forex/providers/mt5-hfm/mif/runs/:runId
 * GET  /api/forex/providers/mt5-hfm/mif/candidates
 * GET  /api/forex/providers/mt5-hfm/mif/candidates/:candidateId
 * GET  /api/forex/providers/mt5-hfm/mif/candidates/:candidateId/history
 * POST /api/forex/providers/mt5-hfm/mif/candidates/:candidateId/lifecycle
 * POST /api/forex/providers/mt5-hfm/mif/candidates/:candidateId/observe
 * GET  /api/forex/providers/mt5-hfm/mif/outcomes
 * GET  /api/forex/providers/mt5-hfm/mif/outcomes/:evaluationId
 * GET  /api/forex/providers/mt5-hfm/mif/performance
 * POST /api/forex/providers/mt5-hfm/mif/historical-replay
 * GET  /api/forex/providers/mt5-hfm/mif/historical-replay/:runId
 * GET  /api/forex/providers/mt5-hfm/mif/storage/audit
 * POST /api/forex/providers/mt5-hfm/mif/ranking
 * GET  /api/forex/providers/mt5-hfm/mif/ranking
 * GET  /api/forex/providers/mt5-hfm/mif/ranking/:rankingRunId
 * POST /api/forex/providers/mt5-hfm/mif/evidence-intelligence
 * GET  /api/forex/providers/mt5-hfm/mif/evidence-intelligence/:assessmentId
 * POST /api/forex/providers/mt5-hfm/mif/probability
 * GET  /api/forex/providers/mt5-hfm/mif/probability
 * GET  /api/forex/providers/mt5-hfm/mif/probability/:assessmentId
 * POST /api/forex/providers/mt5-hfm/mif/calibration
 * GET  /api/forex/providers/mt5-hfm/mif/calibration/:calibrationRunId
 * POST /api/forex/providers/mt5-hfm/mif/ai-reasoning
 * GET  /api/forex/providers/mt5-hfm/mif/ai-reasoning
 * GET  /api/forex/providers/mt5-hfm/mif/ai-reasoning/:reasoningRunId
 * GET  /api/forex/providers/mt5-hfm/mif/research/datasets
 * GET  /api/forex/providers/mt5-hfm/mif/research/datasets/:datasetId
 * GET  /api/forex/providers/mt5-hfm/mif/research/datasets/:datasetId/bars
 * GET  /api/forex/providers/mt5-hfm/mif/research/export-jobs/:jobId
 * POST /api/forex/providers/mt5-hfm/mif/research/export
 * GET  /api/forex/providers/mt5-hfm/mif/research/timeframes
 * GET  /api/forex/providers/mt5-hfm/mif/research/coverage
 * POST /api/forex/providers/mt5-hfm/mif/research/analogues/reference
 * POST /api/forex/providers/mt5-hfm/mif/research/analogues/search
 * GET  /api/forex/providers/mt5-hfm/mif/research/analogues/searches
 * GET  /api/forex/providers/mt5-hfm/mif/research/analogues/searches/:searchId
 * GET  /api/forex/providers/mt5-hfm/mif/research/analogues/searches/:searchId/analogues
 * GET  /api/forex/providers/mt5-hfm/mif/research/analogues/searches/:searchId/analogues/:analogueId
 * POST /api/forex/providers/mt5-hfm/mif/prediction-outcome/snapshots
 * POST /api/forex/providers/mt5-hfm/mif/prediction-outcome/evaluate/historical
 * POST /api/forex/providers/mt5-hfm/mif/prediction-outcome/evaluate/live
 * GET  /api/forex/providers/mt5-hfm/mif/prediction-outcome/outcomes
 * GET  /api/forex/providers/mt5-hfm/mif/prediction-outcome/outcomes/:predictionId
 * GET  /api/forex/providers/mt5-hfm/mif/prediction-outcome/performance
 * POST /api/forex/providers/mt5-hfm/mif/prediction-outcome/charts/evaluate
 * GET  /api/forex/providers/mt5-hfm/mif/prediction-outcome/charts/evaluations
 * GET  /api/forex/providers/mt5-hfm/mif/prediction-outcome/charts/evaluations/:evaluationId
 * GET  /api/forex/providers/mt5-hfm/mif/prediction-outcome/charts/performance
 * POST /api/forex/providers/mt5-hfm/mif/backtesting/runs
 * GET  /api/forex/providers/mt5-hfm/mif/backtesting/runs
 * GET  /api/forex/providers/mt5-hfm/mif/backtesting/runs/:runId
 * GET  /api/forex/providers/mt5-hfm/mif/backtesting/runs/:runId/folds
 * GET  /api/forex/providers/mt5-hfm/mif/research-results
 * GET  /api/forex/providers/mt5-hfm/mif/research-results/:summaryId
 * GET  /api/forex/providers/mt5-hfm/mif/calibration/status
 * POST /api/forex/providers/mt5-hfm/mif/probability-freeze
 * GET  /api/forex/providers/mt5-hfm/mif/probability-freeze
 * GET  /api/forex/providers/mt5-hfm/mif/probability-freeze/:freezeId
 * POST /api/forex/providers/mt5-hfm/mif/calibration/walk-forward
 * GET  /api/forex/providers/mt5-hfm/mif/calibration/walk-forward
 * GET  /api/forex/providers/mt5-hfm/mif/calibration/walk-forward/:runId
 * GET  /api/forex/providers/mt5-hfm/mif/calibration/walk-forward/:runId/evidence
 * POST /api/forex/providers/mt5-hfm/mif/evidence-linkage
 * GET  /api/forex/providers/mt5-hfm/mif/evidence-linkage
 * GET/POST /api/forex/providers/mt5-hfm/mif/worker/*
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { assertAdminAccess, rolesFromHeaders, adminTokenFromHeaders } from "../../ai/admin-control-plane/admin-auth-boundary.js";
import { assertNoSecretsInMt5HfmPayload } from "../../ai/market-data/mt5-hfm/secrets-guard.js";
import {
  MIF_PRODUCTION_DEFAULT_TIMEFRAMES,
  MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
  MIF_PRODUCTION_PRIMARY_TIMEFRAME,
  MIF_PROVIDER_ID,
  MIF_RESEARCH_API_MAX_BAR_PAGE,
  MIF_RESEARCH_EXPORTABLE_TIMEFRAMES,
  assessEvidenceIntelligence,
  assessProbabilityIntelligence,
  aggregateResearchResults,
  buildCalibrationRun,
  buildProbabilityFreeze,
  buildProbabilityFreezeRevision,
  buildResearchCoverageMatrix,
  classifyTimeframeLayer,
  computeOpportunityPerformanceStatistics,
  disableMifOdWorker,
  enableMifOdWorker,
  aggregatePredictionPerformance,
  buildAnalogueReferenceState,
  buildPredictionSnapshot,
  evaluatePredictionAgainstHistoricalArchive,
  evaluatePredictionAgainstLiveCopyRates,
  getMifAnalogueSearchStorage,
  getMifHistoricalResearchStorage,
  getMifOdWorkerStatus,
  getMifOpportunityStorage,
  getMifBacktestStorage,
  getMifPredictionOutcomeStorage,
  getMifProbabilityFreezeStorage,
  getMifResearchResultsStorage,
  getMifWfCalibrationStorage,
  getMifEvidenceLinkageStorage,
  runWalkForwardCalibration,
  buildEvidenceLinkage,
  isResearchExportExplicitlyEnabled,
  observeCandidateAgainstCandles,
  rankOpportunityCandidates,
  runAnalogueSearch,
  runMifAiMarketReasoning,
  runMifBacktest,
  runMifHistoricalReplay,
  runMifHfmOpportunityPipelineLive,
  runResearchHistoricalExport,
  type MifCandidateLifecycleState,
  type MifCanonicalCandle,
  type MifDetectionEvidenceRef,
  type MifOpportunityCandidate,
  type MifProbabilityTargetEvent,
} from "../../ai/market-data/mt5-hfm/mif/index.js";
import {
  aggregateChartsPredictionPerformanceFromStorage,
  evaluateChartsPredictionHistorical,
  getHfmChartsPredictionOutcomeStorage,
} from "../../ai/market-data/mt5-hfm/analysis/prediction-outcome/index.js";

const PREDICTION_OUTCOME_SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  analyticalOutcomeOnly: true as const,
  doesNotApproveAiReasoning: true as const,
  isNotCalibratedProbability: true as const,
  notExecutable: true as const,
  autoWorker: false as const,
};

const BACKTEST_SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  analyticalOutcomeOnly: true as const,
  doesNotApproveAiReasoning: true as const,
  isNotCalibratedProbability: true as const,
  costAdjusted: false as const,
  notExecutable: true as const,
  autoWorker: false as const,
  executionModel: "GROSS_OHLC_ANALYTICAL" as const,
};

const RESEARCH_RESULTS_SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  doesNotApproveAiReasoning: true as const,
  isNotCalibratedProbability: true as const,
  descriptiveResearchOnly: true as const,
  costAdjusted: false as const,
  notExecutable: true as const,
  autoWorker: false as const,
  walkForwardCalibrated: false as const,
};

const PROBABILITY_FREEZE_SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  doesNotApproveAiReasoning: true as const,
  isCalibratedProbability: false as const,
  isWalkForwardCalibrated: false as const,
  analyticalFreezeOnly: true as const,
  notExecutable: true as const,
};

type SendJson = (res: ServerResponse, status: number, data: unknown) => void;

function hitCandidate(stored: string | null, focus: string): boolean {
  return stored === focus;
}

const MAX_BODY = 8192;
/** Historical replay accepts bounded injected series (resource-capped server-side). */
const MAX_REPLAY_BODY = 512 * 1024;
const PATH_PREFIX = "/api/forex/providers/mt5-hfm/mif";

async function readJsonBodyBounded(
  req: IncomingMessage,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw Object.assign(new Error("Request body too large"), { code: "PAYLOAD_TOO_LARGE" });
    }
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON body must be an object");
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    throw Object.assign(
      new Error(err instanceof Error ? err.message : "invalid JSON"),
      { code: "BAD_JSON" },
    );
  }
}

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

  // --- Persistence retrieval ---
  const runMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/runs\/([^/]+)$/.exec(url.pathname);
  if (runMatch && req.method === "GET") {
    const run = await getMifOpportunityStorage().getRun(decodeURIComponent(runMatch[1]!));
    if (!run) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "RUN_NOT_FOUND", message: "analysis run not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = { ok: true, run, placesOrders: false, mutatesBroker: false, acceptsForExecution: false };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/candidates` && req.method === "GET") {
    const listed = await getMifOpportunityStorage().listCandidates({
      providerSymbol: url.searchParams.get("symbol") ?? undefined,
      strategyId: url.searchParams.get("strategyId") ?? undefined,
      direction: url.searchParams.get("direction") ?? undefined,
      lifecycleState: (url.searchParams.get("lifecycleState") as MifCandidateLifecycleState | null) ?? undefined,
      fromIso: url.searchParams.get("from") ?? undefined,
      toIso: url.searchParams.get("to") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
    });
    const payload = {
      ok: true,
      ...listed,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const candMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/candidates\/([^/]+)$/.exec(url.pathname);
  if (candMatch && req.method === "GET") {
    const candidate = await getMifOpportunityStorage().getCandidate(decodeURIComponent(candMatch[1]!));
    if (!candidate) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "CANDIDATE_NOT_FOUND", message: "candidate not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = { ok: true, candidate, placesOrders: false, mutatesBroker: false, acceptsForExecution: false };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const histMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/candidates\/([^/]+)\/history$/.exec(url.pathname);
  if (histMatch && req.method === "GET") {
    const history = await getMifOpportunityStorage().getCandidateHistory(decodeURIComponent(histMatch[1]!));
    sendJson(res, 200, {
      ok: true,
      candidateId: decodeURIComponent(histMatch[1]!),
      history,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  const lifeMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/candidates\/([^/]+)\/lifecycle$/.exec(url.pathname);
  if (lifeMatch && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const toState = String(body.toState || "").trim() as MifCandidateLifecycleState;
    const reason = String(body.reason || "manual_transition").trim();
    const result = await getMifOpportunityStorage().transitionLifecycle({
      candidateId: decodeURIComponent(lifeMatch[1]!),
      toState,
      reason,
      notes: typeof body.notes === "string" ? body.notes : "",
      outcomeKind: (body.outcomeKind as never) ?? null,
    });
    sendJson(res, result.ok ? 200 : 400, {
      ok: result.ok,
      candidate: result.candidate,
      error: result.error ? { code: "LIFECYCLE_ERROR", message: result.error } : undefined,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  // --- Phase 5D.7: observe / outcomes / performance / replay ---
  const observeMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/candidates\/([^/]+)\/observe$/.exec(
    url.pathname,
  );
  if (observeMatch && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const candles = Array.isArray(body.closedCandles)
      ? (body.closedCandles as MifCanonicalCandle[])
      : [];
    const result = await observeCandidateAgainstCandles({
      candidateId: decodeURIComponent(observeMatch[1]!),
      closedCandles: candles,
      targetPrice: typeof body.targetPrice === "number" ? body.targetPrice : null,
      targetSide: (body.targetSide as "ABOVE" | "BELOW" | null) ?? null,
      invalidationPrice: typeof body.invalidationPrice === "number" ? body.invalidationPrice : null,
      invalidationSide: (body.invalidationSide as "ABOVE" | "BELOW" | null) ?? null,
      entryPrice: typeof body.entryPrice === "number" ? body.entryPrice : null,
      maxAgeBars: typeof body.maxAgeBars === "number" ? body.maxAgeBars : undefined,
      activationOpenTimeSec:
        typeof body.activationOpenTimeSec === "number" ? body.activationOpenTimeSec : null,
    });
    const payload = {
      ok: result.ok,
      lifecycleState: result.lifecycleState,
      outcomeKind: result.outcomeKind,
      evaluation: result.evaluation,
      error: result.error ? { code: "OBSERVE_ERROR", message: result.error } : undefined,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, result.ok ? 200 : 400, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/outcomes` && req.method === "GET") {
    const listed = await getMifOpportunityStorage().listOutcomeEvaluations({
      candidateId: url.searchParams.get("candidateId") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
    });
    const payload = {
      ok: true,
      ...listed,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const outcomeMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/outcomes\/([^/]+)$/.exec(
    url.pathname,
  );
  if (outcomeMatch && req.method === "GET") {
    const evaluation = await getMifOpportunityStorage().getOutcomeEvaluation(
      decodeURIComponent(outcomeMatch[1]!),
    );
    if (!evaluation) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "OUTCOME_NOT_FOUND", message: "outcome evaluation not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      evaluation,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/performance` && req.method === "GET") {
    const store = getMifOpportunityStorage();
    const listed = await store.listCandidates({
      providerSymbol: url.searchParams.get("symbol") ?? undefined,
      strategyId: url.searchParams.get("strategyId") ?? undefined,
      fromIso: url.searchParams.get("from") ?? undefined,
      toIso: url.searchParams.get("to") ?? undefined,
      limit: 500,
      offset: 0,
    });
    const evaluations = await store.listOutcomeEvaluations({ limit: 500, offset: 0 });
    const report = computeOpportunityPerformanceStatistics({
      candidates: listed.items,
      evaluations: evaluations.items,
      fromIso: url.searchParams.get("from"),
      toIso: url.searchParams.get("to"),
      groupBy: {
        strategyId: url.searchParams.get("strategyId") ?? undefined,
        providerSymbol: url.searchParams.get("symbol") ?? undefined,
        timeframe: url.searchParams.get("timeframe") ?? undefined,
        marketRegime: url.searchParams.get("regime") ?? undefined,
      },
    });
    const payload = {
      ok: true,
      performance: report,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/historical-replay` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, MAX_REPLAY_BODY);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const symbol = String(body.symbol || body.providerSymbol || "").trim().toUpperCase();
    const primaryTimeframe = String(body.primaryTimeframe || MIF_PRODUCTION_PRIMARY_TIMEFRAME)
      .trim()
      .toUpperCase();
    const series = Array.isArray(body.series) ? body.series : [];
    if (!symbol || !series.length) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "symbol and series[] required; replay uses injected HFM_MT5 historical bars only",
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const run = runMifHistoricalReplay({
      providerSymbol: symbol,
      primaryTimeframe,
      series: series as never,
      fromTimeSec: typeof body.fromTimeSec === "number" ? body.fromTimeSec : null,
      toTimeSec: typeof body.toTimeSec === "number" ? body.toTimeSec : null,
      warmupBars: typeof body.warmupBars === "number" ? body.warmupBars : undefined,
      maxSteps: typeof body.maxSteps === "number" ? body.maxSteps : undefined,
      stepBars: typeof body.stepBars === "number" ? body.stepBars : undefined,
    });
    await getMifOpportunityStorage().persistReplayRun(run);
    const payload = {
      ok: true,
      replay: run,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      separatedFromLiveOutcomes: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const replayMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/historical-replay\/([^/]+)$/.exec(
    url.pathname,
  );
  if (replayMatch && req.method === "GET") {
    const replay = await getMifOpportunityStorage().getReplayRun(
      decodeURIComponent(replayMatch[1]!),
    );
    if (!replay) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "REPLAY_NOT_FOUND", message: "historical replay run not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      replay,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      separatedFromLiveOutcomes: true,
    });
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/storage/audit` && req.method === "GET") {
    const audit = await getMifOpportunityStorage().auditIntegrity();
    sendJson(res, 200, {
      ok: true,
      audit,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  // --- Phase 5F STEP 1: historical research (read-only archive) ---
  if (url.pathname === `${PATH_PREFIX}/research/coverage` && req.method === "GET") {
    const matrix = await buildResearchCoverageMatrix(getMifHistoricalResearchStorage());
    const payload = {
      ok: true,
      ...matrix,
      note: "codeSupported ≠ verifiedLive ≠ operationallyExportable ≠ actuallyArchived ≠ researchEligible",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/research/timeframes` && req.method === "GET") {
    const tfParam = url.searchParams.get("timeframe");
    const payload = {
      ok: true,
      exportableTimeframes: [...MIF_RESEARCH_EXPORTABLE_TIMEFRAMES],
      layers: tfParam
        ? classifyTimeframeLayer(tfParam)
        : MIF_RESEARCH_EXPORTABLE_TIMEFRAMES.map((tf) => classifyTimeframeLayer(tf)),
      note: "Code-supported ≠ verified-live ≠ operationally exportable ≠ archived",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/research/datasets` && req.method === "GET") {
    const store = getMifHistoricalResearchStorage();
    let entries = await store.listRegistry();
    const symbol = url.searchParams.get("symbol")?.trim().toUpperCase();
    const timeframe = url.searchParams.get("timeframe")?.trim().toUpperCase();
    const status = url.searchParams.get("status")?.trim().toUpperCase();
    if (symbol) entries = entries.filter((e) => e.instrument === symbol);
    if (timeframe) entries = entries.filter((e) => e.timeframe === timeframe);
    if (status) entries = entries.filter((e) => e.status === status);
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    const page = entries.slice(offset, offset + limit);
    const payload = {
      ok: true,
      datasets: page,
      total: entries.length,
      offset,
      limit,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const researchDatasetMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/research\/datasets\/([^/]+)$/.exec(url.pathname);
  if (researchDatasetMatch && req.method === "GET") {
    const datasetId = decodeURIComponent(researchDatasetMatch[1]!);
    const versionRaw = url.searchParams.get("version");
    const version = versionRaw != null ? Number(versionRaw) : undefined;
    const store = getMifHistoricalResearchStorage();
    const manifest = await store.getDatasetManifest(
      datasetId,
      Number.isFinite(version) ? version : undefined,
    );
    if (!manifest) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "DATASET_NOT_FOUND", message: "research dataset not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const verify = url.searchParams.get("verify") === "1";
    const consistency = verify
      ? await store.verifyDatasetConsistency(datasetId, manifest.version)
      : null;
    const payload = {
      ok: true,
      manifest,
      researchEligibility: manifest.researchEligibility,
      consistency,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const researchBarsMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/research\/datasets\/([^/]+)\/bars$/.exec(
      url.pathname,
    );
  if (researchBarsMatch && req.method === "GET") {
    const datasetId = decodeURIComponent(researchBarsMatch[1]!);
    const version = Number(url.searchParams.get("version") ?? 1);
    if (!Number.isFinite(version) || version < 1) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_VERSION", message: "version must be a positive integer" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    const limit = Math.min(
      MIF_RESEARCH_API_MAX_BAR_PAGE,
      Math.max(1, Number(url.searchParams.get("limit") ?? 100) || 100),
    );
    const page = await getMifHistoricalResearchStorage().getDatasetBars(datasetId, version, {
      offset,
      limit,
    });
    if (!page) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "DATASET_BARS_NOT_FOUND", message: "research dataset bars not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = {
      ok: true,
      datasetId,
      version,
      bars: page.bars,
      total: page.total,
      offset,
      limit,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const researchJobMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/research\/export-jobs\/([^/]+)$/.exec(url.pathname);
  if (researchJobMatch && req.method === "GET") {
    const jobId = decodeURIComponent(researchJobMatch[1]!);
    const job = await getMifHistoricalResearchStorage().getExportJob(jobId);
    if (!job) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "EXPORT_JOB_NOT_FOUND", message: "export job not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = {
      ok: true,
      job,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      researchReadOnly: true,
      autoWorker: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/research/export` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    if (!isResearchExportExplicitlyEnabled()) {
      sendJson(res, 403, {
        ok: false,
        error: {
          code: "EXPORT_DISABLED",
          message:
            "research export is OFF by default; set KWIZERA_MIF_RESEARCH_EXPORT_ENABLED=1 for explicit admin export (no auto-worker)",
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        researchReadOnly: true,
        autoWorker: false,
        exportEnabled: false,
      });
      return true;
    }
    const instrument = String(body.symbol || body.instrument || "").trim().toUpperCase();
    const timeframe = String(body.timeframe || "").trim().toUpperCase();
    if (!instrument || !timeframe) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "symbol/instrument and timeframe required" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const result = await runResearchHistoricalExport({
      instrument,
      timeframe,
      requestedStartTimeSec:
        typeof body.requestedStartTimeSec === "number" ? body.requestedStartTimeSec : null,
      requestedEndTimeSec:
        typeof body.requestedEndTimeSec === "number" ? body.requestedEndTimeSec : null,
      maxPages: typeof body.maxPages === "number" ? body.maxPages : undefined,
      maxBars: typeof body.maxBars === "number" ? body.maxBars : undefined,
      resumeJobId: typeof body.resumeJobId === "string" ? body.resumeJobId : null,
      singlePage: body.singlePage === true,
      allowExport: true,
    });
    const payload = {
      ok: result.job.status !== "FAILED",
      job: result.job,
      manifest: result.manifest,
      candleCount: result.bars.length,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      researchReadOnly: true,
      autoWorker: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, result.job.status === "FAILED" ? 400 : 200, payload);
    return true;
  }

  // --- Phase 5F STEP 2: historical analogue search (analytical, read-only) ---
  if (url.pathname === `${PATH_PREFIX}/research/analogues/reference` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const datasetId = String(body.datasetId || "").trim();
    const tipOpenTimeSec = Number(body.tipOpenTimeSec);
    const versionRaw = body.version != null ? Number(body.version) : undefined;
    if (!datasetId || !Number.isFinite(tipOpenTimeSec)) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "datasetId and tipOpenTimeSec required" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const store = getMifHistoricalResearchStorage();
    const manifest = await store.getDatasetManifest(
      datasetId,
      Number.isFinite(versionRaw) ? versionRaw : undefined,
    );
    if (!manifest) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "DATASET_NOT_FOUND", message: "research dataset not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const page = await store.getDatasetBars(manifest.datasetId, manifest.version);
    if (!page) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "DATASET_BARS_NOT_FOUND", message: "bars not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const built = buildAnalogueReferenceState({
      manifest,
      bars: page.bars,
      tipOpenTimeSec,
      lookbackBars: typeof body.lookbackBars === "number" ? body.lookbackBars : undefined,
      warmupBars: typeof body.warmupBars === "number" ? body.warmupBars : undefined,
      eligibilityMode:
        typeof body.eligibilityMode === "string"
          ? (body.eligibilityMode as "PRICE_ACTION")
          : "PRICE_ACTION",
    });
    if (!built.ok) {
      sendJson(res, 400, {
        ok: false,
        error: { code: built.code, message: built.message },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        analyticalOnly: true,
        doesNotApproveAiReasoning: true,
        similarityIsNotProbability: true,
      });
      return true;
    }
    const payload = {
      ok: true,
      reference: built.reference,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalOnly: true,
      doesNotApproveAiReasoning: true,
      similarityIsNotProbability: true,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/research/analogues/search` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, 64 * 1024);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
        ok: false,
        error: { code: code ?? "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const datasetId = String(body.datasetId || "").trim();
    const tipOpenTimeSec = Number(body.tipOpenTimeSec);
    if (!datasetId || !Number.isFinite(tipOpenTimeSec)) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "datasetId and tipOpenTimeSec required" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const researchStore = getMifHistoricalResearchStorage();
    const versionRaw = body.version != null ? Number(body.version) : undefined;
    const manifest = await researchStore.getDatasetManifest(
      datasetId,
      Number.isFinite(versionRaw) ? versionRaw : undefined,
    );
    if (!manifest) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "DATASET_NOT_FOUND", message: "research dataset not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const page = await researchStore.getDatasetBars(manifest.datasetId, manifest.version);
    if (!page) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "DATASET_BARS_NOT_FOUND", message: "bars not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const built = buildAnalogueReferenceState({
      manifest,
      bars: page.bars,
      tipOpenTimeSec,
      lookbackBars: typeof body.lookbackBars === "number" ? body.lookbackBars : undefined,
      warmupBars: typeof body.warmupBars === "number" ? body.warmupBars : undefined,
      eligibilityMode:
        typeof body.eligibilityMode === "string"
          ? (body.eligibilityMode as "PRICE_ACTION")
          : "PRICE_ACTION",
    });
    if (!built.ok) {
      sendJson(res, 400, {
        ok: false,
        error: { code: built.code, message: built.message },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        analyticalOnly: true,
        similarityIsNotProbability: true,
      });
      return true;
    }
    const paramsBody =
      body.params && typeof body.params === "object" && !Array.isArray(body.params)
        ? (body.params as Record<string, unknown>)
        : {};
    const corpusDatasetIds = Array.isArray(body.corpusDatasetIds)
      ? body.corpusDatasetIds.map((x) => String(x))
      : undefined;
    const search = await runAnalogueSearch({
      storage: researchStore,
      reference: built.reference,
      corpusDatasetIds,
      params: {
        maxDatasets: typeof paramsBody.maxDatasets === "number" ? paramsBody.maxDatasets : undefined,
        maxCandidatesScanned:
          typeof paramsBody.maxCandidatesScanned === "number"
            ? paramsBody.maxCandidatesScanned
            : undefined,
        maxResults: typeof paramsBody.maxResults === "number" ? paramsBody.maxResults : undefined,
        stride: typeof paramsBody.stride === "number" ? paramsBody.stride : undefined,
        timeoutMs: typeof paramsBody.timeoutMs === "number" ? paramsBody.timeoutMs : undefined,
        allowCrossInstrument: paramsBody.allowCrossInstrument === true,
        minFeatureCoverage:
          typeof paramsBody.minFeatureCoverage === "number"
            ? paramsBody.minFeatureCoverage
            : undefined,
      },
    });
    const persisted = await getMifAnalogueSearchStorage().persistSearch(search);
    const payload = {
      ok: true,
      search,
      persisted,
      note: "Similarity score is not a probability or trade recommendation.",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalOnly: true,
      doesNotApproveAiReasoning: true,
      similarityIsNotProbability: true,
      researchReadOnly: true,
      autoWorker: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/research/analogues/searches` && req.method === "GET") {
    const listed = await getMifAnalogueSearchStorage().listSearches({
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
      limit: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
    });
    const payload = {
      ok: true,
      ...listed,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalOnly: true,
      similarityIsNotProbability: true,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const analogueSearchMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/research\/analogues\/searches\/([^/]+)$/.exec(
      url.pathname,
    );
  if (analogueSearchMatch && req.method === "GET") {
    const searchId = decodeURIComponent(analogueSearchMatch[1]!);
    const search = await getMifAnalogueSearchStorage().getSearch(searchId);
    if (!search) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "SEARCH_NOT_FOUND", message: "analogue search not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = {
      ok: true,
      search,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalOnly: true,
      doesNotApproveAiReasoning: true,
      similarityIsNotProbability: true,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const analogueListMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/research\/analogues\/searches\/([^/]+)\/analogues$/.exec(
      url.pathname,
    );
  if (analogueListMatch && req.method === "GET") {
    const searchId = decodeURIComponent(analogueListMatch[1]!);
    const search = await getMifAnalogueSearchStorage().getSearch(searchId);
    if (!search) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "SEARCH_NOT_FOUND", message: "analogue search not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 25) || 25));
    const page = search.analogues.slice(offset, offset + limit);
    const payload = {
      ok: true,
      searchId: search.searchId,
      status: search.status,
      statusReason: search.statusReason,
      analogues: page,
      total: search.analogues.length,
      offset,
      limit,
      suppressedCount: search.stats.candidatesSuppressed,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalOnly: true,
      similarityIsNotProbability: true,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const analogueOneMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/research\/analogues\/searches\/([^/]+)\/analogues\/([^/]+)$/.exec(
      url.pathname,
    );
  if (analogueOneMatch && req.method === "GET") {
    const searchId = decodeURIComponent(analogueOneMatch[1]!);
    const analogueId = decodeURIComponent(analogueOneMatch[2]!);
    const search = await getMifAnalogueSearchStorage().getSearch(searchId);
    if (!search) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "SEARCH_NOT_FOUND", message: "analogue search not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const analogue =
      search.analogues.find((a) => a.analogueId === analogueId) ??
      search.suppressedAnalogues.find((a) => a.analogueId === analogueId);
    if (!analogue) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "ANALOGUE_NOT_FOUND", message: "analogue not found in search" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const payload = {
      ok: true,
      searchId: search.searchId,
      analogue,
      note: "outcome is separated from similarity; probability not computed in STEP 2",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      analyticalOnly: true,
      doesNotApproveAiReasoning: true,
      similarityIsNotProbability: true,
      researchReadOnly: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  // --- Phase 5F STEP 3: prediction outcome & performance (analytical only) ---
  if (url.pathname === `${PATH_PREFIX}/prediction-outcome/snapshots` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, 64 * 1024);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
        ok: false,
        error: { code: code ?? "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const snapshot = buildPredictionSnapshot({
      candidateId: String(body.candidateId || ""),
      reasoningRunId: body.reasoningRunId != null ? String(body.reasoningRunId) : null,
      evaluationId: body.evaluationId != null ? String(body.evaluationId) : null,
      analysisRunId: body.analysisRunId != null ? String(body.analysisRunId) : null,
      activationOpenTimeSec:
        body.activationOpenTimeSec != null ? Number(body.activationOpenTimeSec) : null,
      activationTimestamp:
        body.activationTimestamp != null ? String(body.activationTimestamp) : null,
      instrument: String(body.instrument || body.providerSymbol || ""),
      timeframe: String(body.timeframe || ""),
      direction: body.direction != null ? String(body.direction) : null,
      entryPrice: body.entryPrice != null ? Number(body.entryPrice) : null,
      targetPrice: body.targetPrice != null ? Number(body.targetPrice) : null,
      targetSide:
        body.targetSide === "ABOVE" || body.targetSide === "BELOW" ? body.targetSide : null,
      invalidationPrice: body.invalidationPrice != null ? Number(body.invalidationPrice) : null,
      invalidationSide:
        body.invalidationSide === "ABOVE" || body.invalidationSide === "BELOW"
          ? body.invalidationSide
          : null,
      invalidationConditions: Array.isArray(body.invalidationConditions)
        ? body.invalidationConditions.map((x) => String(x))
        : null,
      requiredConfirmations: Array.isArray(body.requiredConfirmations)
        ? body.requiredConfirmations.map((x) => String(x))
        : null,
      thesis: body.thesis != null ? String(body.thesis) : null,
      rationale: body.rationale != null ? String(body.rationale) : null,
      modelVersion: body.modelVersion != null ? String(body.modelVersion) : null,
      strategyVersion: body.strategyVersion != null ? String(body.strategyVersion) : null,
      strategyId: body.strategyId != null ? String(body.strategyId) : null,
      detectorId: body.detectorId != null ? String(body.detectorId) : null,
      sourceAnalysisIdentity:
        body.sourceAnalysisIdentity != null ? String(body.sourceAnalysisIdentity) : null,
    });
    if (snapshot.status !== "FROZEN") {
      sendJson(res, 400, {
        ok: false,
        error: { code: snapshot.invalidReason ?? "INVALID_SNAPSHOT", message: snapshot.invalidReason },
        snapshot,
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const persisted = await getMifPredictionOutcomeStorage().persistSnapshot(snapshot);
    if (!persisted.ok) {
      sendJson(res, 409, {
        ok: false,
        error: { code: persisted.code, message: persisted.message },
        snapshot,
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const payload = { ok: true, snapshot, persisted, ...PREDICTION_OUTCOME_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (
    url.pathname === `${PATH_PREFIX}/prediction-outcome/evaluate/historical`
    && req.method === "POST"
  ) {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, 64 * 1024);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
        ok: false,
        error: { code: code ?? "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const datasetId = String(body.datasetId || "").trim();
    if (!datasetId) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "datasetId required" },
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    let snapshot;
    if (body.predictionId) {
      snapshot = await getMifPredictionOutcomeStorage().getSnapshot(String(body.predictionId));
      if (!snapshot) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "SNAPSHOT_NOT_FOUND", message: "prediction snapshot not found" },
          ...PREDICTION_OUTCOME_SAFETY,
        });
        return true;
      }
    } else {
      snapshot = buildPredictionSnapshot({
        candidateId: String(body.candidateId || ""),
        reasoningRunId: body.reasoningRunId != null ? String(body.reasoningRunId) : null,
        analysisRunId: body.analysisRunId != null ? String(body.analysisRunId) : null,
        activationOpenTimeSec:
          body.activationOpenTimeSec != null ? Number(body.activationOpenTimeSec) : null,
        instrument: String(body.instrument || body.providerSymbol || ""),
        timeframe: String(body.timeframe || ""),
        direction: body.direction != null ? String(body.direction) : null,
        entryPrice: body.entryPrice != null ? Number(body.entryPrice) : null,
        targetPrice: body.targetPrice != null ? Number(body.targetPrice) : null,
        targetSide:
          body.targetSide === "ABOVE" || body.targetSide === "BELOW" ? body.targetSide : null,
        invalidationPrice: body.invalidationPrice != null ? Number(body.invalidationPrice) : null,
        invalidationSide:
          body.invalidationSide === "ABOVE" || body.invalidationSide === "BELOW"
            ? body.invalidationSide
            : null,
        invalidationConditions: Array.isArray(body.invalidationConditions)
          ? body.invalidationConditions.map((x) => String(x))
          : null,
        modelVersion: body.modelVersion != null ? String(body.modelVersion) : null,
        strategyVersion: body.strategyVersion != null ? String(body.strategyVersion) : null,
      });
    }
    const horizons = Array.isArray(body.horizons)
      ? body.horizons.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      : undefined;
    const result = await evaluatePredictionAgainstHistoricalArchive({
      snapshot,
      researchStorage: getMifHistoricalResearchStorage(),
      outcomeStorage: getMifPredictionOutcomeStorage(),
      datasetId,
      version: body.version != null ? Number(body.version) : undefined,
      expectedContentHash:
        body.expectedContentHash != null ? String(body.expectedContentHash) : null,
      horizons,
      persist: body.persist !== false,
    });
    if (!result.ok) {
      sendJson(res, 400, {
        ok: false,
        error: { code: result.code, message: result.message },
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const payload = {
      ok: true,
      outcome: result.outcome,
      persisted: result.persisted,
      note: "Path metrics and level outcomes are distinct. Not calibrated probability.",
      ...PREDICTION_OUTCOME_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/prediction-outcome/evaluate/live` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, 512 * 1024);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
        ok: false,
        error: { code: code ?? "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const bars = Array.isArray(body.bars) ? body.bars : null;
    const brokerNowSec = Number(body.brokerNowSec);
    if (!bars || !Number.isFinite(brokerNowSec)) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "bars[] and brokerNowSec required for live CopyRates evaluation",
        },
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    let snapshot;
    if (body.predictionId) {
      snapshot = await getMifPredictionOutcomeStorage().getSnapshot(String(body.predictionId));
      if (!snapshot) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "SNAPSHOT_NOT_FOUND", message: "prediction snapshot not found" },
          ...PREDICTION_OUTCOME_SAFETY,
        });
        return true;
      }
    } else {
      snapshot = buildPredictionSnapshot({
        candidateId: String(body.candidateId || ""),
        reasoningRunId: body.reasoningRunId != null ? String(body.reasoningRunId) : null,
        activationOpenTimeSec:
          body.activationOpenTimeSec != null ? Number(body.activationOpenTimeSec) : null,
        instrument: String(body.instrument || body.providerSymbol || ""),
        timeframe: String(body.timeframe || ""),
        direction: body.direction != null ? String(body.direction) : null,
        entryPrice: body.entryPrice != null ? Number(body.entryPrice) : null,
        targetPrice: body.targetPrice != null ? Number(body.targetPrice) : null,
        targetSide:
          body.targetSide === "ABOVE" || body.targetSide === "BELOW" ? body.targetSide : null,
        invalidationPrice: body.invalidationPrice != null ? Number(body.invalidationPrice) : null,
        invalidationSide:
          body.invalidationSide === "ABOVE" || body.invalidationSide === "BELOW"
            ? body.invalidationSide
            : null,
      });
    }
    const result = await evaluatePredictionAgainstLiveCopyRates({
      snapshot,
      bars: bars.map((b) => {
        const row = b as Record<string, unknown>;
        return {
          time: Number(row.time),
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          tickVolume: row.tickVolume != null ? Number(row.tickVolume) : null,
          realVolume: row.realVolume != null ? Number(row.realVolume) : null,
          spread: row.spread != null ? Number(row.spread) : null,
          isClosed: row.isClosed !== false,
          candleState:
            row.candleState === "FORMING" || row.candleState === "CLOSED"
              ? row.candleState
              : "CLOSED",
          validationStatus: row.validationStatus === "rejected" ? "rejected" : "ok",
          provenance: row.provenance != null ? String(row.provenance) : undefined,
        };
      }),
      brokerNowSec,
      outcomeStorage: getMifPredictionOutcomeStorage(),
      sourceProvenance:
        body.sourceProvenance != null ? String(body.sourceProvenance) : "copyrates",
      snapshotId: body.snapshotId != null ? String(body.snapshotId) : null,
      sequenceId: body.sequenceId != null ? String(body.sequenceId) : null,
      horizons: Array.isArray(body.horizons)
        ? body.horizons.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
        : undefined,
      persist: body.persist !== false,
    });
    if (!result.ok) {
      sendJson(res, 400, {
        ok: false,
        error: { code: result.code, message: result.message },
        liveMarketVerified: false,
        note: "Contract evaluation only; live-market verification may be pending",
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const payload = {
      ok: true,
      outcome: result.outcome,
      persisted: result.persisted,
      liveMarketVerified: false,
      note: "Live adapter contract path. Live-market verification deferred when market closed.",
      ...PREDICTION_OUTCOME_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/prediction-outcome/outcomes` && req.method === "GET") {
    const listed = await getMifPredictionOutcomeStorage().listOutcomes({
      predictionId: url.searchParams.get("predictionId") ?? undefined,
      marketSourceMode: url.searchParams.get("marketSourceMode") ?? undefined,
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
      limit: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
    });
    const payload = { ok: true, ...listed, ...PREDICTION_OUTCOME_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const predictionOutcomeMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/prediction-outcome\/outcomes\/([^/]+)$/.exec(
      url.pathname,
    );
  if (predictionOutcomeMatch && req.method === "GET") {
    const predictionId = decodeURIComponent(predictionOutcomeMatch[1]!);
    const latest = await getMifPredictionOutcomeStorage().getLatestOutcomeForPrediction(
      predictionId,
    );
    const all = await getMifPredictionOutcomeStorage().listOutcomesForPrediction(predictionId);
    if (!latest) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "OUTCOME_NOT_FOUND", message: "no outcomes for predictionId" },
        ...PREDICTION_OUTCOME_SAFETY,
      });
      return true;
    }
    const payload = {
      ok: true,
      predictionId,
      latest,
      revisions: all,
      note: "Multiple revisions are not independent predictions",
      ...PREDICTION_OUTCOME_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/prediction-outcome/performance` && req.method === "GET") {
    const dirRaw = url.searchParams.get("direction");
    const modeRaw = url.searchParams.get("marketSourceMode");
    const horizonRaw = url.searchParams.get("horizon");
    const summary = await aggregatePredictionPerformance({
      storage: getMifPredictionOutcomeStorage(),
      groupKey: {
        instrument: url.searchParams.get("instrument") || undefined,
        timeframe: url.searchParams.get("timeframe") || undefined,
        direction:
          dirRaw === "BUY" || dirRaw === "SELL" || dirRaw === "NEUTRAL" || dirRaw === "UNKNOWN"
            ? dirRaw
            : undefined,
        horizon: horizonRaw && Number.isFinite(Number(horizonRaw)) ? Number(horizonRaw) : undefined,
        modelVersion: url.searchParams.get("modelVersion") || undefined,
        strategyVersion: url.searchParams.get("strategyVersion") || undefined,
        marketSourceMode:
          modeRaw === "HISTORICAL_ARCHIVE" || modeRaw === "LIVE_COPYRATES" ? modeRaw : undefined,
        outcomeStatus: url.searchParams.get("outcomeStatus") || undefined,
        dateFromIso: url.searchParams.get("from") || undefined,
        dateToIso: url.searchParams.get("to") || undefined,
      },
    });
    await getMifPredictionOutcomeStorage().persistPerformanceSummary(
      summary,
      summary.summaryId,
    );
    const payload = { ok: true, summary, ...PREDICTION_OUTCOME_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  // --- P8.C: Charts prediction outcome evaluation (on-demand, historical PIT only) ---
  if (
    url.pathname === `${PATH_PREFIX}/prediction-outcome/charts/evaluate`
    && req.method === "POST"
  ) {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, 64 * 1024);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
        ok: false,
        error: {
          code: code ?? "BAD_REQUEST",
          message: err instanceof Error ? err.message : String(err),
        },
        ...PREDICTION_OUTCOME_SAFETY,
        notBrokerAccountPnl: true,
        scheduledWorker: false,
      });
      return true;
    }
    const predictionId = String(body.predictionId || "").trim();
    const datasetId = String(body.datasetId || "").trim();
    if (!predictionId || !datasetId) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "predictionId and datasetId required",
        },
        ...PREDICTION_OUTCOME_SAFETY,
        notBrokerAccountPnl: true,
        scheduledWorker: false,
      });
      return true;
    }
    let entryZone: { low: number; high: number } | null = null;
    if (body.entryZone && typeof body.entryZone === "object") {
      const ez = body.entryZone as Record<string, unknown>;
      const low = ez.low != null ? Number(ez.low) : NaN;
      const high = ez.high != null ? Number(ez.high) : NaN;
      if (Number.isFinite(low) && Number.isFinite(high)) {
        entryZone = { low, high };
      }
    }
    const horizons = Array.isArray(body.horizons)
      ? body.horizons.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
      : undefined;
    const result = await evaluateChartsPredictionHistorical({
      researchStorage: getMifHistoricalResearchStorage(),
      predictionStorage: getMifPredictionOutcomeStorage(),
      chartsStorage: getHfmChartsPredictionOutcomeStorage(),
      request: {
        predictionId,
        datasetId,
        datasetVersion: body.datasetVersion != null ? Number(body.datasetVersion) : undefined,
        expectedContentHash:
          body.expectedContentHash != null ? String(body.expectedContentHash) : null,
        entryZone,
        scenarioId: body.scenarioId != null ? String(body.scenarioId) : null,
        setupFingerprint:
          body.setupFingerprint != null ? String(body.setupFingerprint) : null,
        evidencePackageId:
          body.evidencePackageId != null ? String(body.evidencePackageId) : null,
        scenarioPackageId:
          body.scenarioPackageId != null ? String(body.scenarioPackageId) : null,
        analyticalConfidence:
          body.analyticalConfidence != null ? Number(body.analyticalConfidence) : null,
        horizons,
        maxAgeBars: body.maxAgeBars != null ? Number(body.maxAgeBars) : undefined,
        persist: body.persist !== false,
      },
    });
    if (!result.ok) {
      sendJson(res, 400, {
        ok: false,
        error: { code: result.code, message: result.message },
        ...PREDICTION_OUTCOME_SAFETY,
        notBrokerAccountPnl: true,
        scheduledWorker: false,
      });
      return true;
    }
    const ev = result.evaluation;
    const payload = {
      ok: true,
      evaluationId: ev.evaluationId,
      predictionId: ev.predictionId,
      resultKind: ev.resultKind,
      entryTriggerStatus: ev.entryTrigger.status,
      realizedSignedRMultiple: ev.realizedSignedRMultiple,
      mae: ev.mae,
      mfe: ev.mfe,
      pitManifestId: ev.provenance.pitManifestId,
      datasetContentHash: ev.provenance.datasetContentHash,
      persisted: result.persisted,
      created: result.created,
      evaluation: ev,
      note:
        "P8.C Charts historical evaluation. Analytical OHLC only — not broker account P&L. "
        + "Decisive win-rate excludes UNTRIGGERED/AMBIGUOUS/EXPIRED. No scheduled worker.",
      ...PREDICTION_OUTCOME_SAFETY,
      notBrokerAccountPnl: true,
      scheduledWorker: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (
    url.pathname === `${PATH_PREFIX}/prediction-outcome/charts/evaluations`
    && req.method === "GET"
  ) {
    const predictionId = url.searchParams.get("predictionId");
    const store = getHfmChartsPredictionOutcomeStorage();
    if (predictionId) {
      const items = await store.listEvaluationsForPrediction(predictionId);
      const payload = {
        ok: true,
        predictionId,
        items,
        total: items.length,
        ...PREDICTION_OUTCOME_SAFETY,
        notBrokerAccountPnl: true,
        scheduledWorker: false,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }
    const listed = await store.listAllEvaluations({
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
      limit: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
    });
    const payload = {
      ok: true,
      ...listed,
      ...PREDICTION_OUTCOME_SAFETY,
      notBrokerAccountPnl: true,
      scheduledWorker: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const chartsEvalMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/prediction-outcome\/charts\/evaluations\/([^/]+)$/.exec(
      url.pathname,
    );
  if (chartsEvalMatch && req.method === "GET") {
    const evaluationId = decodeURIComponent(chartsEvalMatch[1]!);
    const evaluation = await getHfmChartsPredictionOutcomeStorage().getEvaluation(
      evaluationId,
    );
    if (!evaluation) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "EVALUATION_NOT_FOUND", message: "charts evaluation not found" },
        ...PREDICTION_OUTCOME_SAFETY,
        notBrokerAccountPnl: true,
        scheduledWorker: false,
      });
      return true;
    }
    const payload = {
      ok: true,
      evaluation,
      ...PREDICTION_OUTCOME_SAFETY,
      notBrokerAccountPnl: true,
      scheduledWorker: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (
    url.pathname === `${PATH_PREFIX}/prediction-outcome/charts/performance`
    && req.method === "GET"
  ) {
    const summary = await aggregateChartsPredictionPerformanceFromStorage({
      storage: getHfmChartsPredictionOutcomeStorage(),
      totalCompletedAnalyses:
        url.searchParams.get("totalCompletedAnalyses") != null
          ? Number(url.searchParams.get("totalCompletedAnalyses"))
          : null,
      noTradeSkipped:
        url.searchParams.get("noTradeSkipped") != null
          ? Number(url.searchParams.get("noTradeSkipped"))
          : null,
      waitingSkipped:
        url.searchParams.get("waitingSkipped") != null
          ? Number(url.searchParams.get("waitingSkipped"))
          : null,
    });
    const payload = {
      ok: true,
      summary,
      ...PREDICTION_OUTCOME_SAFETY,
      notBrokerAccountPnl: true,
      scheduledWorker: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  // --- Phase 5F STEP 4: backtesting & walk-forward (gross OHLC analytical) ---
  if (url.pathname === `${PATH_PREFIX}/backtesting/runs` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, 64 * 1024);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      sendJson(res, code === "PAYLOAD_TOO_LARGE" ? 413 : 400, {
        ok: false,
        error: { code: code ?? "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        ...BACKTEST_SAFETY,
      });
      return true;
    }
    const datasetId = String(body.datasetId || "").trim();
    if (!datasetId) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "datasetId required" },
        ...BACKTEST_SAFETY,
      });
      return true;
    }
    const mode =
      body.mode === "SINGLE_WINDOW" || body.mode === "WALK_FORWARD"
        ? body.mode
        : "WALK_FORWARD";
    const result = await runMifBacktest({
      researchStorage: getMifHistoricalResearchStorage(),
      backtestStorage: getMifBacktestStorage(),
      datasetId,
      version: body.version != null ? Number(body.version) : undefined,
      expectedContentHash:
        body.expectedContentHash != null ? String(body.expectedContentHash) : null,
      mode,
      warmupBars: typeof body.warmupBars === "number" ? body.warmupBars : undefined,
      maxSteps: typeof body.maxSteps === "number" ? body.maxSteps : undefined,
      stepBars: typeof body.stepBars === "number" ? body.stepBars : undefined,
      maxFolds: typeof body.maxFolds === "number" ? body.maxFolds : undefined,
      minOosSamples: typeof body.minOosSamples === "number" ? body.minOosSamples : undefined,
      timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : 60_000,
      persist: body.persist !== false,
      useValidation: body.useValidation !== false,
      horizons: Array.isArray(body.horizons)
        ? body.horizons.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)
        : undefined,
      primaryMetric:
        body.primaryMetric === "OOS_LEVEL_TARGET_RATE"
        || body.primaryMetric === "OOS_PATH_FORWARD_RETURN_MEAN_H8"
        || body.primaryMetric === "OOS_GROSS_UNIT_EXPECTANCY"
          ? body.primaryMetric
          : undefined,
    });
    if (!result.ok) {
      sendJson(res, 400, {
        ok: false,
        error: { code: result.code, message: result.message },
        ...BACKTEST_SAFETY,
      });
      return true;
    }
    const payload = {
      ok: true,
      manifest: result.record.manifest,
      tipCount: result.record.tips.length,
      persisted: result.persisted,
      note: "Gross OHLC analytical backtest. Not cost-adjusted. Not broker performance. Not calibrated probability.",
      ...BACKTEST_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/backtesting/runs` && req.method === "GET") {
    const listed = await getMifBacktestStorage().listRuns({
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
      limit: Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20)),
    });
    const payload = { ok: true, ...listed, ...BACKTEST_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const backtestRunMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/backtesting\/runs\/([^/]+)$/.exec(url.pathname);
  if (backtestRunMatch && req.method === "GET") {
    const runId = decodeURIComponent(backtestRunMatch[1]!);
    const manifest = await getMifBacktestStorage().getManifest(runId);
    if (!manifest) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "RUN_NOT_FOUND", message: "backtest run not found" },
        ...BACKTEST_SAFETY,
      });
      return true;
    }
    const payload = { ok: true, manifest, ...BACKTEST_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const backtestFoldsMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/backtesting\/runs\/([^/]+)\/folds$/.exec(
      url.pathname,
    );
  if (backtestFoldsMatch && req.method === "GET") {
    const runId = decodeURIComponent(backtestFoldsMatch[1]!);
    const folds = await getMifBacktestStorage().getFolds(runId);
    if (!folds) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "RUN_NOT_FOUND", message: "backtest run not found" },
        ...BACKTEST_SAFETY,
      });
      return true;
    }
    const payload = { ok: true, runId, folds, ...BACKTEST_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  // --- Phase 5F STEP 5 Phase B: research results (bounded descriptive aggregation) ---
  if (url.pathname === `${PATH_PREFIX}/research-results` && req.method === "GET") {
    const generate = url.searchParams.get("generate") === "1";
    const filters = {
      symbol: url.searchParams.get("symbol"),
      timeframe: url.searchParams.get("timeframe"),
      datasetId: url.searchParams.get("datasetId"),
      backtestRunId: url.searchParams.get("backtestRunId"),
    };
    const store = getMifResearchResultsStorage();
    if (generate) {
      const summary = await aggregateResearchResults({ filters });
      const persisted = await store.persistSummary(summary);
      const payload = {
        ok: true,
        summary,
        persisted: persisted.ok ? { created: persisted.created } : { error: persisted },
        items: [summary],
        total: 1,
        ...RESEARCH_RESULTS_SAFETY,
        note: "DESCRIPTIVE — NOT A PROBABILITY. UNCALIBRATED. COST-ADJUSTED BACKTEST NOT AVAILABLE when cost incomplete.",
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }
    const listed = await store.listSummaries({
      limit: Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20)),
      offset: Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0),
    });
    const payload = {
      ok: true,
      ...listed,
      ...RESEARCH_RESULTS_SAFETY,
      note: "Pass generate=1 for a bounded on-demand summary. Descriptive only; not calibrated probability.",
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const researchResultMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/research-results\/([^/]+)$/.exec(url.pathname);
  if (researchResultMatch && req.method === "GET") {
    const summaryId = decodeURIComponent(researchResultMatch[1]!);
    const summary = await getMifResearchResultsStorage().getSummary(summaryId);
    if (!summary) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "SUMMARY_NOT_FOUND", message: "research result summary not found" },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const payload = { ok: true, summary, ...RESEARCH_RESULTS_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  // --- Phase 5F STEP 5 Phase B: immutable probability freeze ---
  if (url.pathname === `${PATH_PREFIX}/probability-freeze` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, MAX_BODY);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: (err as { code?: string })?.code ?? "BAD_REQUEST",
          message: err instanceof Error ? err.message : "invalid body",
        },
        ...PROBABILITY_FREEZE_SAFETY,
      });
      return true;
    }
    const assessmentId = String(body.assessmentId ?? "").trim();
    if (!assessmentId) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "ASSESSMENT_ID_REQUIRED", message: "assessmentId is required" },
        ...PROBABILITY_FREEZE_SAFETY,
      });
      return true;
    }
    const assessment = await getMifOpportunityStorage().getProbabilityAssessment(assessmentId);
    if (!assessment) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "ASSESSMENT_NOT_FOUND", message: "probability assessment not found" },
        ...PROBABILITY_FREEZE_SAFETY,
      });
      return true;
    }
    const predictionId =
      body.predictionId != null && String(body.predictionId).trim()
        ? String(body.predictionId).trim()
        : null;
    let outcomeResolvedAt: string | null =
      body.outcomeResolvedAt != null && String(body.outcomeResolvedAt).trim()
        ? String(body.outcomeResolvedAt).trim()
        : null;
    if (predictionId && !outcomeResolvedAt) {
      const latest = await getMifPredictionOutcomeStorage().getLatestOutcomeForPrediction(
        predictionId,
      );
      if (latest?.levelOutcome?.evaluationTimestamp) {
        outcomeResolvedAt = latest.levelOutcome.evaluationTimestamp;
      } else if (latest?.computationTimestamp) {
        outcomeResolvedAt = latest.computationTimestamp;
      }
    }
    const supersedesFreezeId =
      body.supersedesFreezeId != null && String(body.supersedesFreezeId).trim()
        ? String(body.supersedesFreezeId).trim()
        : null;
    let built;
    if (supersedesFreezeId) {
      const prior = await getMifProbabilityFreezeStorage().getFreeze(supersedesFreezeId);
      if (!prior) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "PRIOR_FREEZE_NOT_FOUND", message: "supersedesFreezeId not found" },
          ...PROBABILITY_FREEZE_SAFETY,
        });
        return true;
      }
      built = buildProbabilityFreezeRevision({
        prior,
        assessment,
        revisionReason: String(body.revisionReason ?? "correction"),
        outcomeResolvedAt,
        sourceDatasetId:
          body.sourceDatasetId != null ? String(body.sourceDatasetId) : prior.sourceDatasetId,
        sourceDatasetVersion:
          body.sourceDatasetVersion != null
            ? Number(body.sourceDatasetVersion)
            : prior.sourceDatasetVersion,
        sourceContentHash:
          body.sourceContentHash != null
            ? String(body.sourceContentHash)
            : prior.sourceContentHash,
      });
    } else {
      built = buildProbabilityFreeze({
        assessment,
        predictionId,
        predictionAvailableAt:
          body.predictionAvailableAt != null
            ? String(body.predictionAvailableAt)
            : null,
        snapshotActivationAt:
          body.snapshotActivationAt != null
            ? String(body.snapshotActivationAt)
            : null,
        outcomeResolvedAt,
        sourceDatasetId:
          body.sourceDatasetId != null ? String(body.sourceDatasetId) : null,
        sourceDatasetVersion:
          body.sourceDatasetVersion != null ? Number(body.sourceDatasetVersion) : null,
        sourceContentHash:
          body.sourceContentHash != null ? String(body.sourceContentHash) : null,
      });
    }
    if (!built.ok) {
      sendJson(res, 400, {
        ok: false,
        error: { code: built.code, message: built.message },
        ...PROBABILITY_FREEZE_SAFETY,
      });
      return true;
    }
    const persisted = await getMifProbabilityFreezeStorage().persistFreeze(built.freeze);
    if (!persisted.ok) {
      sendJson(res, 409, {
        ok: false,
        error: { code: persisted.code, message: persisted.message },
        freeze: built.freeze,
        ...PROBABILITY_FREEZE_SAFETY,
      });
      return true;
    }
    const payload = {
      ok: true,
      freeze: built.freeze,
      created: persisted.created,
      calibrationClaim: "NOT_CALIBRATED" as const,
      ...PROBABILITY_FREEZE_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/probability-freeze` && req.method === "GET") {
    const listed = await getMifProbabilityFreezeStorage().listFreezes({
      assessmentId: url.searchParams.get("assessmentId") ?? undefined,
      predictionId: url.searchParams.get("predictionId") ?? undefined,
      providerSymbol: url.searchParams.get("symbol") ?? undefined,
      limit: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
      offset: Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0),
    });
    const payload = {
      ok: true,
      ...listed,
      ...PROBABILITY_FREEZE_SAFETY,
      note: "Frozen prediction-time probabilities are NOT calibrated probabilities.",
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const freezeMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/probability-freeze\/([^/]+)$/.exec(url.pathname);
  if (freezeMatch && req.method === "GET") {
    const freezeId = decodeURIComponent(freezeMatch[1]!);
    const freeze = await getMifProbabilityFreezeStorage().getFreeze(freezeId);
    if (!freeze) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "FREEZE_NOT_FOUND", message: "probability freeze not found" },
        ...PROBABILITY_FREEZE_SAFETY,
      });
      return true;
    }
    const payload = { ok: true, freeze, ...PROBABILITY_FREEZE_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  // --- Phase 5F STEP 5 Phase C: walk-forward-aware calibration (metrics-only) ---
  if (url.pathname === `${PATH_PREFIX}/calibration/walk-forward` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, MAX_BODY);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: (err as { code?: string })?.code ?? "BAD_REQUEST",
          message: err instanceof Error ? err.message : "invalid body",
        },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const backtestRunId = String(body.backtestRunId ?? "").trim();
    if (!backtestRunId) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BACKTEST_RUN_ID_REQUIRED", message: "backtestRunId is required" },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const bt = getMifBacktestStorage();
    const manifest = await bt.getManifest(backtestRunId);
    if (!manifest) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "BACKTEST_NOT_FOUND", message: "backtest run not found" },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const tips = await bt.getTips(backtestRunId);
    const freezes = await getMifProbabilityFreezeStorage().listFreezes({ limit: 100 });
    const outcomes = await getMifPredictionOutcomeStorage().listOutcomes({ limit: 100 });
    const result = runWalkForwardCalibration({
      backtestManifest: manifest,
      tips,
      freezes: freezes.items,
      outcomes: outcomes.items,
    });
    const persisted = await getMifWfCalibrationStorage().persistRun(result.run, {
      runId: result.run.runId,
      included: result.included,
      excluded: result.excluded,
    });
    const payload = {
      ok: true,
      run: result.run,
      persisted: persisted.ok ? { created: persisted.created } : { error: persisted },
      includedCount: result.included.length,
      excludedCount: result.excluded.length,
      walkForwardCalibrated: false,
      modelFitPerformed: false,
      note: "Metrics-only WF evaluation. NOT_CALIBRATED / INSUFFICIENT_DATA / PROVISIONAL_EVALUATION / CALIBRATION_EVALUATED as evidence supports. Never mid-split 5E.",
      ...RESEARCH_RESULTS_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/calibration/walk-forward` && req.method === "GET") {
    const listed = await getMifWfCalibrationStorage().listRuns({
      limit: Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20)),
      offset: Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0),
    });
    const payload = {
      ok: true,
      ...listed,
      walkForwardCalibrated: false,
      ...RESEARCH_RESULTS_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const wfEvidenceMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/calibration\/walk-forward\/([^/]+)\/evidence$/.exec(
      url.pathname,
    );
  if (wfEvidenceMatch && req.method === "GET") {
    const runId = decodeURIComponent(wfEvidenceMatch[1]!);
    const evidence = await getMifWfCalibrationStorage().getEvidence(runId);
    if (!evidence) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "EVIDENCE_NOT_FOUND", message: "WF calibration evidence not found" },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const bounded = {
      runId: evidence.runId,
      included: evidence.included.slice(0, 500),
      excluded: evidence.excluded.slice(0, 500),
      includedTotal: evidence.included.length,
      excludedTotal: evidence.excluded.length,
    };
    const payload = { ok: true, evidence: bounded, ...RESEARCH_RESULTS_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const wfRunMatch =
    /^\/api\/forex\/providers\/mt5-hfm\/mif\/calibration\/walk-forward\/([^/]+)$/.exec(
      url.pathname,
    );
  if (wfRunMatch && req.method === "GET") {
    const runId = decodeURIComponent(wfRunMatch[1]!);
    const run = await getMifWfCalibrationStorage().getRun(runId);
    if (!run) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "WF_CALIBRATION_NOT_FOUND", message: "WF calibration run not found" },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const payload = { ok: true, run, ...RESEARCH_RESULTS_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/evidence-linkage` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBodyBounded(req, MAX_BODY);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: (err as { code?: string })?.code ?? "BAD_REQUEST",
          message: err instanceof Error ? err.message : "invalid body",
        },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const built = buildEvidenceLinkage({
      searchId: body.searchId != null ? String(body.searchId) : null,
      analogueId: body.analogueId != null ? String(body.analogueId) : null,
      predictionId: body.predictionId != null ? String(body.predictionId) : null,
      assessmentId: body.assessmentId != null ? String(body.assessmentId) : null,
      freezeId: body.freezeId != null ? String(body.freezeId) : null,
      searchHash: body.searchHash != null ? String(body.searchHash) : null,
      snapshotHash: body.snapshotHash != null ? String(body.snapshotHash) : null,
      freezeHash: body.freezeHash != null ? String(body.freezeHash) : null,
      markUnavailable: body.markUnavailable === true,
      unavailableReason:
        body.unavailableReason != null ? String(body.unavailableReason) : null,
      createdAt: new Date().toISOString(),
    });
    if (!built.ok) {
      sendJson(res, built.code === "CONFLICT" ? 409 : 400, {
        ok: false,
        error: { code: built.code, message: built.message },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const persisted = await getMifEvidenceLinkageStorage().persist(built.linkage);
    if (!persisted.ok) {
      sendJson(res, 409, {
        ok: false,
        error: { code: persisted.code, message: persisted.message },
        ...RESEARCH_RESULTS_SAFETY,
      });
      return true;
    }
    const payload = {
      ok: true,
      linkage: built.linkage,
      created: persisted.created,
      neverInferredFromProximity: true,
      ...RESEARCH_RESULTS_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/evidence-linkage` && req.method === "GET") {
    const listed = await getMifEvidenceLinkageStorage().list({
      predictionId: url.searchParams.get("predictionId") ?? undefined,
      searchId: url.searchParams.get("searchId") ?? undefined,
      limit: Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50)),
      offset: Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0),
    });
    const payload = { ok: true, ...listed, ...RESEARCH_RESULTS_SAFETY };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/storage/rebuild-index` && req.method === "POST") {
    const rebuilt = await getMifOpportunityStorage().rebuildIndex();
    sendJson(res, 200, {
      ok: rebuilt.ok,
      rebuilt,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  // --- Phase 5E Step 1: ranking ---
  if (url.pathname === `${PATH_PREFIX}/ranking` && req.method === "GET") {
    const listed = await getMifOpportunityStorage().listRankingRuns({
      providerSymbol: url.searchParams.get("symbol") ?? undefined,
      strategyId: url.searchParams.get("strategyId") ?? undefined,
      fromIso: url.searchParams.get("from") ?? undefined,
      toIso: url.searchParams.get("to") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
    });
    const payload = {
      ok: true,
      ...listed,
      isWinProbability: false,
      executionReadiness: false,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/ranking` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }

    // Preferred: rank from a persisted analysis runId
    const analysisRunId = String(body.analysisRunId || body.runId || "").trim();
    const store = getMifOpportunityStorage();
    if (analysisRunId) {
      const run = await store.getRun(analysisRunId);
      if (!run) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "RUN_NOT_FOUND", message: "analysis run not found" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      const snap = run.resultSnapshot;
      const candidates = (snap.detection?.candidates ?? []) as MifOpportunityCandidate[];
      const evidence = (snap.evidenceRefs
        ?? snap._debugContext?.evidence
        ?? []) as MifDetectionEvidenceRef[];
      // If a ranking was already produced for this analysis and reuse requested, return it
      if (body.reuseExisting !== false && snap.ranking?.rankingRunId) {
        const existing = await store.getRankingRun(snap.ranking.rankingRunId);
        if (existing) {
          sendJson(res, 200, {
            ok: true,
            ranking: existing,
            reused: true,
            isWinProbability: false,
            isExecutionApproval: false,
            executionReadiness: false,
            placesOrders: false,
            mutatesBroker: false,
            acceptsForExecution: false,
          });
          return true;
        }
      }
      const ranking = rankOpportunityCandidates({
        candidates,
        evidence,
        dataQualityStatus: snap.dataQualityStatus,
        mtfRelation: snap.mtfRelation,
        analysisRunId,
        providerSymbol: run.providerSymbol,
        primaryTimeframe: run.primaryTimeframe,
        strategyFilter: typeof body.strategyId === "string" ? body.strategyId : null,
      });
      await store.persistRankingRun(ranking);
      const payload = {
        ok: true,
        ranking,
        isWinProbability: false,
        isExecutionApproval: false,
        executionReadiness: false,
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      };
      assertNoSecretsInMt5HfmPayload(payload);
      sendJson(res, 200, payload);
      return true;
    }

    // Alternate: injected candidates+evidence (fixtures / bounded tests)
    const candidates = Array.isArray(body.candidates)
      ? (body.candidates as MifOpportunityCandidate[])
      : [];
    const evidence = Array.isArray(body.evidence)
      ? (body.evidence as MifDetectionEvidenceRef[])
      : [];
    if (!candidates.length) {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "analysisRunId or candidates[] required",
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const ranking = rankOpportunityCandidates({
      candidates,
      evidence,
      dataQualityStatus: String(body.dataQualityStatus || "VALID"),
      mtfRelation: typeof body.mtfRelation === "string" ? body.mtfRelation : null,
      providerSymbol: typeof body.symbol === "string" ? body.symbol : null,
      primaryTimeframe: typeof body.primaryTimeframe === "string" ? body.primaryTimeframe : null,
      strategyFilter: typeof body.strategyId === "string" ? body.strategyId : null,
    });
    await store.persistRankingRun(ranking);
    sendJson(res, 200, {
      ok: true,
      ranking,
      isWinProbability: false,
      isExecutionApproval: false,
      executionReadiness: false,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  const rankingMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/ranking\/([^/]+)$/.exec(
    url.pathname,
  );
  if (rankingMatch && req.method === "GET") {
    const ranking = await getMifOpportunityStorage().getRankingRun(
      decodeURIComponent(rankingMatch[1]!),
    );
    if (!ranking) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "RANKING_NOT_FOUND", message: "ranking run not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      ranking,
      isWinProbability: false,
      executionReadiness: false,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  // --- Phase 5E Step 2: evidence intelligence ---
  if (url.pathname === `${PATH_PREFIX}/evidence-intelligence` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const candidateId = String(body.candidateId || "").trim();
    const store = getMifOpportunityStorage();
    let candidate: MifOpportunityCandidate | null = null;
    let evidence: MifDetectionEvidenceRef[] = [];
    if (candidateId) {
      const persisted = await store.getCandidate(candidateId);
      if (!persisted) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "CANDIDATE_NOT_FOUND", message: "candidate not found" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      candidate = persisted.candidateSnapshot;
      const run = await store.getRun(persisted.runId);
      evidence = (run?.resultSnapshot?.evidenceRefs ?? []) as MifDetectionEvidenceRef[];
    } else if (body.candidate && typeof body.candidate === "object") {
      candidate = body.candidate as MifOpportunityCandidate;
      evidence = Array.isArray(body.evidence) ? (body.evidence as MifDetectionEvidenceRef[]) : [];
    }
    if (!candidate) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "candidateId or candidate required" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const assessment = assessEvidenceIntelligence({
      candidate,
      evidence,
      analysisRunId: typeof body.analysisRunId === "string" ? body.analysisRunId : null,
      primaryTimeframe: typeof body.primaryTimeframe === "string" ? body.primaryTimeframe : null,
    });
    await store.persistEvidenceIntelligence(assessment);
    const payload = {
      ok: true,
      assessment,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const eviMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/evidence-intelligence\/([^/]+)$/.exec(
    url.pathname,
  );
  if (eviMatch && req.method === "GET") {
    const assessment = await getMifOpportunityStorage().getEvidenceIntelligence(
      decodeURIComponent(eviMatch[1]!),
    );
    if (!assessment) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "EVIDENCE_NOT_FOUND", message: "evidence assessment not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      assessment,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  // --- Phase 5E Step 2: probability ---
  if (url.pathname === `${PATH_PREFIX}/probability` && req.method === "GET") {
    const listed = await getMifOpportunityStorage().listProbabilityAssessments({
      providerSymbol: url.searchParams.get("symbol") ?? undefined,
      strategyId: url.searchParams.get("strategyId") ?? undefined,
      fromIso: url.searchParams.get("from") ?? undefined,
      toIso: url.searchParams.get("to") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
    });
    const payload = {
      ok: true,
      ...listed,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isGuaranteedOutcome: false,
      executionReadiness: false,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/probability` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const store = getMifOpportunityStorage();
    const candidateId = String(body.candidateId || "").trim();
    let candidate: MifOpportunityCandidate | null = null;
    let evidence: MifDetectionEvidenceRef[] = [];
    if (candidateId) {
      const persisted = await store.getCandidate(candidateId);
      if (!persisted) {
        sendJson(res, 404, {
          ok: false,
          error: { code: "CANDIDATE_NOT_FOUND", message: "candidate not found" },
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
        });
        return true;
      }
      candidate = persisted.candidateSnapshot;
      const run = await store.getRun(persisted.runId);
      evidence = (run?.resultSnapshot?.evidenceRefs ?? []) as MifDetectionEvidenceRef[];
    } else if (body.candidate && typeof body.candidate === "object") {
      candidate = body.candidate as MifOpportunityCandidate;
      evidence = Array.isArray(body.evidence) ? (body.evidence as MifDetectionEvidenceRef[]) : [];
    }
    if (!candidate) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "candidateId or candidate required" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const hist = await store.listCandidates({
      providerSymbol: candidate.providerSymbol,
      limit: 200,
    });
    const evals = await store.listOutcomeEvaluations({ limit: 200 });
    const targetEvent = (typeof body.targetEvent === "string"
      ? body.targetEvent
      : "TARGET_REACHED_BEFORE_INVALIDATION_WITHIN_HORIZON") as MifProbabilityTargetEvent;
    const bundle = assessProbabilityIntelligence({
      candidate,
      evidence,
      historicalCandidates: hist.items,
      evaluations: evals.items,
      targetEvent,
      analysisRunId: typeof body.analysisRunId === "string" ? body.analysisRunId : null,
      primaryTimeframe: typeof body.primaryTimeframe === "string" ? body.primaryTimeframe : null,
      dataQualityStatus: typeof body.dataQualityStatus === "string" ? body.dataQualityStatus : null,
      evaluationHorizonBars:
        typeof body.evaluationHorizonBars === "number" ? body.evaluationHorizonBars : null,
    });
    await store.persistEvidenceIntelligence(bundle.evidence);
    await store.persistProbabilityAssessment(bundle.probability);
    const payload = {
      ok: true,
      evidence: bundle.evidence,
      probability: bundle.probability,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isGuaranteedOutcome: false,
      executionReadiness: false,
      doesNotApproveAiReasoning: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const probMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/probability\/([^/]+)$/.exec(
    url.pathname,
  );
  if (probMatch && req.method === "GET") {
    const assessment = await getMifOpportunityStorage().getProbabilityAssessment(
      decodeURIComponent(probMatch[1]!),
    );
    if (!assessment) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "PROBABILITY_NOT_FOUND", message: "probability assessment not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      probability: assessment,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isGuaranteedOutcome: false,
      executionReadiness: false,
    });
    return true;
  }

  // Phase 5F STEP 5 Phase B — calibration readiness (NOT a calibrated model claim).
  if (url.pathname === `${PATH_PREFIX}/calibration/status` && req.method === "GET") {
    const summary = await aggregateResearchResults({
      filters: {
        symbol: url.searchParams.get("symbol"),
        timeframe: url.searchParams.get("timeframe"),
        datasetId: url.searchParams.get("datasetId"),
        backtestRunId: url.searchParams.get("backtestRunId"),
      },
    });
    const payload = {
      ok: true,
      status: summary.calibration.status,
      calibration: summary.calibration,
      claimLabels: summary.calibration.claimLabels,
      note: "NOT_CALIBRATED / INSUFFICIENT_DATA only in Phase B. Mid-split 5E scaffolding is not walk-forward calibrated. No OOS fitting.",
      ...RESEARCH_RESULTS_SAFETY,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/calibration` && req.method === "POST") {
    const store = getMifOpportunityStorage();
    const listed = await store.listProbabilityAssessments({ limit: 200 });
    const evals = await store.listOutcomeEvaluations({ limit: 200 });
    const resolved = new Map<string, { outcome: 0 | 1; resolvedAt: string }>();
    for (const ev of evals.items) {
      if (ev.outcomeKind === "TARGET_REACHED") {
        resolved.set(ev.candidateId, {
          outcome: 1,
          resolvedAt: ev.evaluationTimestamp,
        });
      } else if (ev.outcomeKind === "INVALIDATION_REACHED") {
        resolved.set(ev.candidateId, {
          outcome: 0,
          resolvedAt: ev.evaluationTimestamp,
        });
      }
    }
    const run = buildCalibrationRun({
      historicalAssessments: listed.items,
      resolvedOutcomes: resolved,
    });
    await store.persistCalibrationRun(run);
    sendJson(res, 200, {
      ok: true,
      calibration: run,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      // Phase B clarification: preserved 5E scaffolding is not WF-calibrated.
      walkForwardCalibrated: false,
      midSplitScaffoldingNotWfCalibrated: true,
      researchResultsClaim: "NOT_CALIBRATED",
      note: "Metrics-only / mid-split scaffolding. Not walk-forward calibrated. See GET /calibration/status.",
    });
    return true;
  }

  const calMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/calibration\/([^/]+)$/.exec(
    url.pathname,
  );
  if (calMatch && req.method === "GET") {
    const calibration = await getMifOpportunityStorage().getCalibrationRun(
      decodeURIComponent(calMatch[1]!),
    );
    if (!calibration) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "CALIBRATION_NOT_FOUND", message: "calibration run not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      calibration,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }

  // --- Phase 5E Step 3: AI market reasoning ---
  if (url.pathname === `${PATH_PREFIX}/ai-reasoning` && req.method === "GET") {
    const listed = await getMifOpportunityStorage().listAiMarketReasoning({
      providerSymbol: url.searchParams.get("symbol") ?? undefined,
      analysisRunId: url.searchParams.get("analysisRunId") ?? undefined,
      fromIso: url.searchParams.get("from") ?? undefined,
      toIso: url.searchParams.get("to") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 50) || 50,
      offset: Number(url.searchParams.get("offset") ?? 0) || 0,
    });
    const payload = {
      ok: true,
      ...listed,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isWinProbability: false,
      executionReadiness: false,
      doesNotApproveAiReasoning: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === `${PATH_PREFIX}/ai-reasoning` && req.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await readJsonBody(req);
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "BAD_REQUEST", message: err instanceof Error ? err.message : String(err) },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const analysisRunId = String(body.analysisRunId || body.runId || "").trim();
    if (!analysisRunId) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INPUT", message: "analysisRunId required" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const store = getMifOpportunityStorage();
    const run = await store.getRun(analysisRunId);
    if (!run?.resultSnapshot) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "RUN_NOT_FOUND", message: "analysis run not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    if (run.providerId !== "HFM_MT5" && run.resultSnapshot.providerId !== "HFM_MT5") {
      sendJson(res, 400, {
        ok: false,
        error: {
          code: "PROVIDER_NOT_ALLOWED",
          message: "AI market reasoning accepts HFM_MT5 only",
        },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
        doesNotApproveAiReasoning: true,
      });
      return true;
    }
    const focusCandidateId =
      typeof body.candidateId === "string" ? body.candidateId.trim() : null;
    const rankingRunId =
      (typeof body.rankingRunId === "string" && body.rankingRunId.trim())
      || run.resultSnapshot.ranking?.rankingRunId
      || null;
    const rankingRun = rankingRunId ? await store.getRankingRun(rankingRunId) : null;

    let probabilityBundle = null;
    if (focusCandidateId) {
      const listed = await store.listProbabilityAssessments({
        providerSymbol: run.providerSymbol,
        limit: 50,
      });
      const prob = listed.items.find((p) => p.candidateId === focusCandidateId) ?? null;
      if (prob?.evidenceAssessmentId) {
        const evi = await store.getEvidenceIntelligence(prob.evidenceAssessmentId);
        if (evi) probabilityBundle = { evidence: evi, probability: prob };
      }
    } else if (run.resultSnapshot._probabilityBundles?.[0]) {
      probabilityBundle = run.resultSnapshot._probabilityBundles[0];
    }

    // Idempotent reuse: identical context+prompt already persisted
    if (body.reuseExisting !== false) {
      const prior = await store.listAiMarketReasoning({
        analysisRunId,
        limit: 20,
      });
      const hit = prior.items.find(
        (x) =>
          (x.status === "SUCCESS" || x.status === "PARTIAL_RESULT")
          && (!focusCandidateId || hitCandidate(x.candidateId, focusCandidateId)),
      );
      if (hit) {
        sendJson(res, 200, {
          ok: true,
          reasoning: hit,
          reused: true,
          placesOrders: false,
          mutatesBroker: false,
          acceptsForExecution: false,
          isWinProbability: false,
          executionReadiness: false,
          doesNotApproveAiReasoning: true,
        });
        return true;
      }
    }

    const reasoning = await runMifAiMarketReasoning({
      result: run.resultSnapshot,
      rankingRun,
      probabilityBundle,
      focusCandidateId,
    });
    await store.persistAiMarketReasoning(reasoning);
    const payload = {
      ok: true,
      reasoning,
      reused: false,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isWinProbability: false,
      isGuaranteedOutcome: false,
      executionReadiness: false,
      doesNotApproveAiReasoning: true,
    };
    assertNoSecretsInMt5HfmPayload(payload);
    sendJson(res, 200, payload);
    return true;
  }

  const aiMatch = /^\/api\/forex\/providers\/mt5-hfm\/mif\/ai-reasoning\/([^/]+)$/.exec(
    url.pathname,
  );
  if (aiMatch && req.method === "GET") {
    const reasoning = await getMifOpportunityStorage().getAiMarketReasoning(
      decodeURIComponent(aiMatch[1]!),
    );
    if (!reasoning) {
      sendJson(res, 404, {
        ok: false,
        error: { code: "REASONING_NOT_FOUND", message: "AI reasoning run not found" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      reasoning,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isWinProbability: false,
      executionReadiness: false,
      doesNotApproveAiReasoning: true,
    });
    return true;
  }

  // --- Optional worker (disabled by default) ---
  if (url.pathname === `${PATH_PREFIX}/worker/status` && req.method === "GET") {
    sendJson(res, 200, {
      ok: true,
      worker: getMifOdWorkerStatus(),
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }
  if (url.pathname === `${PATH_PREFIX}/worker/enable` && req.method === "POST") {
    let body: Record<string, unknown> = {};
    try {
      body = await readJsonBody(req);
    } catch {
      body = {};
    }
    const symbol = String(body.symbol || "").trim().toUpperCase();
    if (!symbol) {
      sendJson(res, 400, {
        ok: false,
        error: { code: "INVALID_INSTRUMENT", message: "symbol required to enable worker" },
        placesOrders: false,
        mutatesBroker: false,
        acceptsForExecution: false,
      });
      return true;
    }
    const worker = enableMifOdWorker({
      symbol,
      intervalMs: typeof body.intervalMs === "number" ? body.intervalMs : undefined,
    });
    sendJson(res, 200, {
      ok: true,
      worker,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
    return true;
  }
  if (url.pathname === `${PATH_PREFIX}/worker/disable` && req.method === "POST") {
    sendJson(res, 200, {
      ok: true,
      worker: disableMifOdWorker(),
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    });
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
