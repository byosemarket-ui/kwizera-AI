/**
 * Single monitor evaluation tick — deterministic, no LLM.
 */
import { buildForexAiEvidencePack } from "../forex-ai/evidence/build-evidence-pack.js";
import { detectCandlestickPatterns } from "../forex-patterns/detect.js";
import { detectMarketStructure } from "../forex-structure/detect.js";
import { fromUnifiedCandles as patternsFromUnified } from "../forex-patterns/detect.js";
import { fromUnifiedCandles as structureFromUnified } from "../forex-structure/detect.js";
import {
  getMarketDataService,
  type HistoricalCandlesRequest,
  type MarketDataService,
} from "../market-data/providers/market-data-service.js";
import type { UnifiedCandleSeries } from "../market-data/providers/contracts.js";
import { parseCanonicalTimeframe } from "../market-data/providers/contracts.js";
import { assessCandleFreshnessDetailed } from "./freshness.js";
import { resolveForexMonitorLimits } from "./limits.js";
import { evaluateSetupRules } from "./setup-rules.js";
import type {
  EvaluateMonitorTickInput,
  EvaluateMonitorTickResult,
  ForexMonitorSession,
  MonitorEvidenceSummary,
} from "./types.js";

export type FetchMonitorCandles = (
  req: HistoricalCandlesRequest,
) => Promise<UnifiedCandleSeries>;

function lastClosedTimeFromSeries(series: UnifiedCandleSeries): number | null {
  const closed = series.candles.filter((c) => c.isClosed);
  if (!closed.length) return null;
  return closed[closed.length - 1]!.time;
}

function evidenceHeadline(summary: MonitorEvidenceSummary | null): string | null {
  if (!summary) return null;
  return summary.headline;
}

function buildSummary(pack: ReturnType<typeof buildForexAiEvidencePack>): MonitorEvidenceSummary {
  const p0 = pack.patterns.detections[0];
  const e0 = pack.structure.events[0];
  const parts: string[] = [];
  if (p0) parts.push(`${p0.name} ${p0.status}`);
  if (e0) parts.push(`${e0.type} ${e0.direction} ${e0.status}`);
  if (pack.structure.trendState) parts.push(`trend ${pack.structure.trendState}`);
  return {
    pack,
    headline: parts.length ? parts.join(" · ") : "No pattern/structure highlights",
  };
}

function patchSession(
  session: ForexMonitorSession,
  patch: Partial<ForexMonitorSession>,
): ForexMonitorSession {
  return { ...session, ...patch, updatedAt: new Date().toISOString() };
}

export interface EvaluateMonitorDeps {
  marketData?: MarketDataService;
  fetchCandles?: FetchMonitorCandles;
  limits?: ReturnType<typeof resolveForexMonitorLimits>;
}

export async function evaluateMonitorTick(
  input: EvaluateMonitorTickInput,
  deps?: EvaluateMonitorDeps,
): Promise<EvaluateMonitorTickResult> {
  const limits = deps?.limits ?? resolveForexMonitorLimits();
  const nowMs = input.nowMs ?? Date.now();
  let session = { ...input.session };

  const tf = parseCanonicalTimeframe(session.timeframe);
  if (!tf) {
    return {
      session: patchSession(session, {
        lastError: `Invalid timeframe: ${session.timeframe}`,
        lifecycleState: session.lifecycleState === "STARTING" ? "ERROR" : session.lifecycleState,
      }),
      setupEval: { state: "WATCHING", setup: null, transitionReason: "Invalid timeframe" },
      evidenceSummary: null,
      freshnessState: "UNAVAILABLE",
      freshnessWarnings: [],
      lastClosedCandleTime: null,
      error: "INVALID_TIMEFRAME",
    };
  }

  let series = input.candles ?? null;
  if (!series) {
    const fetch = deps?.fetchCandles
      ?? ((req) => (deps?.marketData ?? getMarketDataService()).getHistoricalCandles(req));
    try {
      series = await fetch({
        provider: session.provider,
        symbol: session.symbol,
        timeframe: session.timeframe,
        marketType: session.config.marketType,
        limit: limits.CANDLE_LIMIT,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        session: patchSession(session, { lastError: msg }),
        setupEval: { state: "WATCHING", setup: null, transitionReason: "Fetch failed" },
        evidenceSummary: null,
        freshnessState: "UNAVAILABLE",
        freshnessWarnings: [msg],
        lastClosedCandleTime: null,
        error: msg,
      };
    }
  }

  const lastClosed = lastClosedTimeFromSeries(series);
  const freshness = assessCandleFreshnessDetailed({
    provider: session.provider,
    timeframe: session.timeframe,
    lastClosedTime: lastClosed,
    lastUpdateAt: series.updatedAt,
    nowMs,
    sourceMode: series.sourceMode,
    connectionState: series.connectionState,
    fcDiagnostics: input.fcDiagnostics ?? series.streamDiagnostics ?? null,
  });

  if (
    session.lastClosedCandleTimeEvaluated != null
    && lastClosed != null
    && session.lastClosedCandleTimeEvaluated === lastClosed
    && session.freshnessState === "FRESH"
    && freshness.state === "FRESH"
  ) {
    return {
      skipped: true,
      session: patchSession(session, {
        lastEvaluationAt: new Date(nowMs).toISOString(),
        dataAgeMs: freshness.dataAgeMs,
      }),
      setupEval: {
        state: session.currentSetup?.state ?? "WATCHING",
        setup: session.currentSetup,
        transitionReason: "Skipped — same closed candle still FRESH",
      },
      evidenceSummary: session.lastEvidenceSummary
        ? { pack: null as unknown as MonitorEvidenceSummary["pack"], headline: session.lastEvidenceSummary }
        : null,
      freshnessState: freshness.state,
      freshnessWarnings: freshness.warnings,
      lastClosedCandleTime: lastClosed,
    };
  }

  const patternCandles = patternsFromUnified(series.candles);
  const structureCandles = structureFromUnified(series.candles);

  const patternResult = detectCandlestickPatterns({
    provider: session.provider as "BINANCE",
    environment: session.environment,
    symbol: session.symbol,
    timeframe: session.timeframe,
    candles: patternCandles,
    includeForming: false,
  });

  const structureResult = detectMarketStructure({
    provider: session.provider as "BINANCE",
    environment: session.environment,
    symbol: session.symbol,
    timeframe: session.timeframe,
    candles: structureCandles,
    includeForming: false,
  });

  const pack = buildForexAiEvidencePack({
    provider: session.provider,
    environment: session.environment,
    symbol: session.symbol,
    timeframe: session.timeframe,
    candles: series.candles,
    patternResult,
    structureResult,
    knowledgeHits: [],
  });

  const evidenceSummary = buildSummary(pack);

  const setupEval = evaluateSetupRules({
    patternResult,
    structureResult,
    provider: String(session.provider),
    symbol: session.symbol,
    timeframe: session.timeframe,
    priorSetup: session.currentSetup,
    lastClosedCandleTime: lastClosed,
    nowIso: new Date(nowMs).toISOString(),
  });

  session = patchSession(session, {
    lastEvaluationAt: new Date(nowMs).toISOString(),
    lastValidCandleTime: lastClosed,
    lastDataUpdateAt: series.updatedAt,
    dataAgeMs: freshness.dataAgeMs,
    freshnessState: freshness.state,
    lastClosedCandleTimeEvaluated: lastClosed,
    lastEvidenceSummary: evidenceHeadline(evidenceSummary),
    evaluationCount: session.evaluationCount + 1,
    currentSetup: setupEval.setup,
    lastError: null,
  });

  return {
    session,
    setupEval,
    evidenceSummary,
    freshnessState: freshness.state,
    freshnessWarnings: freshness.warnings,
    lastClosedCandleTime: lastClosed,
  };
}
