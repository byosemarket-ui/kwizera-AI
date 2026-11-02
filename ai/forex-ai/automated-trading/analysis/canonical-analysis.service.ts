/**
 * Phase 4.18D — Read-only canonical analysis orchestration.
 * Uses existing FC candles / quote freshness / strategy / OpenAI adapters + reconciler.
 * Never places or authorizes broker orders.
 */
import { createHash } from "node:crypto";
import {
  FOREXCONNECT_TIMEFRAME_MS,
  isForexConnectSupportedTimeframe,
} from "../../../market-data/forexconnect/timeframes.js";
import { auditCandleQuality, type CandleQualityReport } from "../candle-quality.js";
import { evaluateSmaCrossoverStrategy } from "../auto-engine/strategy/evaluate.js";
import type { StrategyCandle } from "../auto-engine/strategy/rules.js";
import { SMA_CROSSOVER_RULES } from "../auto-engine/strategy/rules.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import {
  normalizeCanonicalTimeframe,
  normalizeInstrumentId,
  toCanonicalFromOpenAi,
  toCanonicalFromStrategy,
} from "./adapters.js";
import {
  getCanonicalAnalysisHistoryStore,
  type CanonicalAnalysisHistoryRecord,
  type CanonicalAnalysisHistoryStore,
} from "./canonical-analysis-history.store.js";
import type {
  CanonicalAnalysisResult,
  CanonicalQuoteSnapshot,
  CanonicalTimeframeId,
} from "./canonical-analysis.types.js";
import {
  ANALYSIS_CONFIDENCE_MODEL_VERSION,
  ANALYSIS_CONFIDENCE_TYPE,
  CANONICAL_ANALYSIS_SCHEMA,
  CANONICAL_ANALYSIS_VERSION,
} from "./canonical-analysis.types.js";
import { indicatorsFromStrategyValues, reconcileAnalysis } from "./reconciler.js";
import type { AtOpenAiAnalysisResult } from "./types.js";

export type CanonicalDisplayFreshness = "CURRENT" | "STALE" | "BLOCKED" | "NOT_AVAILABLE";

export interface CanonicalAnalysisPublicView {
  schemaVersion: typeof CANONICAL_ANALYSIS_SCHEMA;
  analysisVersion: typeof CANONICAL_ANALYSIS_VERSION;
  available: boolean;
  displayFreshness: CanonicalDisplayFreshness;
  analysisId: string | null;
  instrument: string | null;
  primaryTimeframe: CanonicalTimeframeId | string | null;
  direction: "BUY" | "SELL" | null;
  marketInterpretation: "BULLISH" | "BEARISH" | null;
  finalOutcome: string | null;
  confidencePct: number | null;
  confidenceType: typeof ANALYSIS_CONFIDENCE_TYPE;
  confidenceModelVersion: typeof ANALYSIS_CONFIDENCE_MODEL_VERSION;
  confidenceBreakdown: CanonicalAnalysisResult["confidenceBreakdown"];
  confidenceLimitations: string[];
  isCalibratedWinProbability: false;
  availableConfidenceFactorCount: number;
  reconciliationCode: string | null;
  analyzedAtUtc: string | null;
  quote: CanonicalQuoteSnapshot | null;
  fastSma: number | null;
  slowSma: number | null;
  atr: number | null;
  atrMethod: string | null;
  htfAgreement: string | null;
  aiAgreement: "AGREE" | "DISAGREE" | "UNAVAILABLE" | "N_A";
  dataQuality: string | null;
  quoteFresh: boolean | null;
  explanation: string[];
  validationErrors: Array<{ code: string; message: string }>;
  placesOrders: false;
  acceptsForExecution: false;
  analysisIsNotExecution: true;
}

export interface CanonicalAnalysisRunInput {
  environment: AutomatedTradingEnvironment;
  instrument: string | null | undefined;
  timeframe: string | null | undefined;
  trigger?: CanonicalAnalysisResult["trigger"];
  /** When true (default), persist to history store. */
  persist?: boolean;
  /** Optional OpenAI result; if omitted, deps.getLatestOpenAi may be used. */
  openAiAnalysis?: AtOpenAiAnalysisResult | null;
  includeOpenAi?: boolean;
  nowMs?: number;
}

export interface CanonicalAnalysisDeps {
  loadCandles: (instrument: string, timeframe: CanonicalTimeframeId) => Promise<StrategyCandle[]>;
  getQuoteSnapshot: (instrument: string) => Promise<CanonicalQuoteSnapshot>;
  getPointSize: (instrument: string) => Promise<number | null>;
  getLatestOpenAi?: (instrument: string) => AtOpenAiAnalysisResult | null;
  historyStore?: CanonicalAnalysisHistoryStore;
}

export function toCanonicalPublicView(
  result: CanonicalAnalysisResult | null,
  opts?: { maxAgeMs?: number; nowMs?: number },
): CanonicalAnalysisPublicView {
  const base: CanonicalAnalysisPublicView = {
    schemaVersion: CANONICAL_ANALYSIS_SCHEMA,
    analysisVersion: CANONICAL_ANALYSIS_VERSION,
    available: false,
    displayFreshness: "NOT_AVAILABLE",
    analysisId: null,
    instrument: null,
    primaryTimeframe: null,
    direction: null,
    marketInterpretation: null,
    finalOutcome: null,
    confidencePct: null,
    confidenceType: ANALYSIS_CONFIDENCE_TYPE,
    confidenceModelVersion: ANALYSIS_CONFIDENCE_MODEL_VERSION,
    confidenceBreakdown: null,
    confidenceLimitations: [],
    isCalibratedWinProbability: false,
    availableConfidenceFactorCount: 0,
    reconciliationCode: null,
    analyzedAtUtc: null,
    quote: null,
    fastSma: null,
    slowSma: null,
    atr: null,
    atrMethod: null,
    htfAgreement: null,
    aiAgreement: "N_A",
    dataQuality: null,
    quoteFresh: null,
    explanation: [],
    validationErrors: [],
    placesOrders: false,
    acceptsForExecution: false,
    analysisIsNotExecution: true,
  };
  if (!result) return base;

  const nowMs = opts?.nowMs ?? Date.now();
  const maxAge = opts?.maxAgeMs ?? 30 * 60_000;
  const analyzedMs = Date.parse(result.analyzedAtUtc);
  let displayFreshness: CanonicalDisplayFreshness = "CURRENT";
  if (
    result.finalOutcome === "STALE_DATA"
    || result.finalOutcome === "INSUFFICIENT_DATA"
    || result.finalOutcome === "CONFLICT"
    || result.finalOutcome === "NO_TRADE"
  ) {
    displayFreshness = result.finalOutcome === "STALE_DATA" ? "STALE" : "BLOCKED";
  } else if (!Number.isFinite(analyzedMs) || nowMs - analyzedMs > maxAge) {
    displayFreshness = "STALE";
  }

  let aiAgreement: CanonicalAnalysisPublicView["aiAgreement"] = "UNAVAILABLE";
  if (!result.ai || !result.ai.direction) aiAgreement = "UNAVAILABLE";
  else if (!result.direction) aiAgreement = "N_A";
  else if (result.ai.direction === result.direction) aiAgreement = "AGREE";
  else aiAgreement = "DISAGREE";

  const factors = result.confidenceBreakdown?.factors ?? [];
  const availableConfidenceFactorCount = factors.filter((f) => f.available).length;

  return {
    ...base,
    available: true,
    displayFreshness,
    analysisId: result.analysisId,
    instrument: result.instrument,
    primaryTimeframe: result.primaryTimeframe,
    direction: result.direction,
    marketInterpretation: result.marketInterpretation,
    finalOutcome: result.finalOutcome,
    confidencePct: result.confidencePct,
    confidenceBreakdown: result.confidenceBreakdown,
    confidenceLimitations: result.confidenceLimitations,
    availableConfidenceFactorCount,
    reconciliationCode: result.reconciliationCode,
    analyzedAtUtc: result.analyzedAtUtc,
    quote: result.quote,
    fastSma: result.indicators.fastSma.value,
    slowSma: result.indicators.slowSma.value,
    atr: result.indicators.atr.value,
    atrMethod: result.indicators.atrMethod,
    htfAgreement: result.htf?.agreement ?? null,
    aiAgreement,
    dataQuality: result.dataQuality,
    quoteFresh: result.quote.quoteFresh,
    explanation: result.explanation,
    validationErrors: result.validationErrors,
  };
}

function fingerprintEvidence(
  instrument: string,
  timeframe: string,
  candles: StrategyCandle[],
  quote: CanonicalQuoteSnapshot,
): string {
  const h = createHash("sha256");
  h.update(instrument);
  h.update("|");
  h.update(timeframe);
  h.update("|");
  h.update(quote.snapshotFingerprint ?? "");
  const last = candles[candles.length - 1];
  if (last) {
    h.update(`|${last.time}|${last.open}|${last.high}|${last.low}|${last.close}`);
  }
  h.update(`|n=${candles.length}`);
  return h.digest("hex").slice(0, 24);
}

function emptyIndicators() {
  return indicatorsFromStrategyValues({ fastSma: null, slowSma: null, atr: null });
}

function blockedQuote(instrument: string, reason: string, nowIso: string): CanonicalQuoteSnapshot {
  return {
    instrument,
    bid: null,
    ask: null,
    quoteFresh: false,
    freshnessReasonCode: reason,
    effectivePriceChangeAgeMs: null,
    snapshotFingerprint: null,
    evaluatedAtUtc: nowIso,
  };
}

/**
 * Pure orchestration entry — inject deps for unit tests / production bridge.
 */
export async function runCanonicalAnalysis(
  input: CanonicalAnalysisRunInput,
  deps: CanonicalAnalysisDeps,
): Promise<{
  ok: boolean;
  result: CanonicalAnalysisResult;
  candleQuality: CandleQualityReport | null;
  marketEvidence: import("./market-evidence-builder.js").MarketEvidenceBundle | null;
  history: { saved: boolean; duplicate: boolean; writeError: string | null };
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}> {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const historyStore = deps.historyStore ?? getCanonicalAnalysisHistoryStore();
  const instrumentRaw = String(input.instrument ?? "").trim();
  const instrument = normalizeInstrumentId(instrumentRaw);

  const fail = async (
    partial: Parameters<typeof reconcileAnalysis>[0],
  ): Promise<{
    ok: boolean;
    result: CanonicalAnalysisResult;
    candleQuality: CandleQualityReport | null;
    marketEvidence: null;
    history: { saved: boolean; duplicate: boolean; writeError: string | null };
    placesOrders: false;
    acceptsForExecution: false;
    mutatesBroker: false;
  }> => {
    const result = reconcileAnalysis(partial);
    let hist = { saved: false, duplicate: false, writeError: null as string | null };
    if (input.persist !== false) {
      const w = await historyStore.save(result);
      hist = { ...w, writeError: historyStore.lastWriteError };
    }
    return {
      ok: result.direction != null,
      result,
      candleQuality: null,
      marketEvidence: null,
      history: hist,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  };

  if (!instrument) {
    return fail({
      environment: input.environment,
      instrument: "",
      primaryTimeframe: "15m",
      analyzedAtUtc: nowIso,
      trigger: input.trigger ?? "manual",
      quote: blockedQuote("", "INSTRUMENT_NOT_SELECTED", nowIso),
      indicators: emptyIndicators(),
      deterministic: null,
      candleStrategyReady: false,
    });
  }

  const tf = normalizeCanonicalTimeframe(input.timeframe);
  if (!tf || !isForexConnectSupportedTimeframe(tf)) {
    // Use a non-stale quote shell so timeframe rejection maps to INSUFFICIENT_DATA
    // (not STALE_DATA). Direction remains null.
    return fail({
      environment: input.environment,
      instrument,
      primaryTimeframe: "15m",
      analyzedAtUtc: nowIso,
      trigger: input.trigger ?? "manual",
      quote: {
        instrument,
        bid: null,
        ask: null,
        quoteFresh: true,
        freshnessReasonCode: "LIVE_FRESH",
        effectivePriceChangeAgeMs: 0,
        snapshotFingerprint: null,
        evaluatedAtUtc: nowIso,
      },
      indicators: emptyIndicators(),
      deterministic: {
        strategyId: SMA_CROSSOVER_RULES.strategyId,
        direction: "NO_TRADE",
        code: "TIMEFRAME_UNSUPPORTED",
        reasons: [`Unsupported timeframe "${String(input.timeframe ?? "")}".`],
        entryPrice: null,
        stopLoss: null,
        takeProfit: null,
        confidencePct: null,
        closedCandle: null,
        atrMethod: "SMA_OF_TR",
      },
      candleStrategyReady: false,
      expectedInstrument: instrument,
    });
  }

  let candles: StrategyCandle[] = [];
  try {
    candles = await deps.loadCandles(instrument, tf);
  } catch {
    candles = [];
  }

  // Instrument isolation on candle payload — reject foreign symbols if stamped
  const foreign = candles.find((c) => {
    const stamped = (c as StrategyCandle & { instrument?: string }).instrument;
    return stamped != null && normalizeInstrumentId(stamped) !== instrument;
  });
  if (foreign) {
    return fail({
      environment: input.environment,
      instrument,
      primaryTimeframe: tf,
      analyzedAtUtc: nowIso,
      trigger: input.trigger ?? "manual",
      quote: blockedQuote(instrument, "INSTRUMENT_MISMATCH", nowIso),
      indicators: emptyIndicators(),
      deterministic: null,
      strategyInstrument: normalizeInstrumentId(
        (foreign as StrategyCandle & { instrument?: string }).instrument,
      ),
      expectedInstrument: instrument,
      candleStrategyReady: false,
    });
  }

  const stepSec = Math.floor(FOREXCONNECT_TIMEFRAME_MS[tf] / 1000);
  const candleQuality = auditCandleQuality({
    candles,
    instrument,
    timeframe: tf,
    source: "forexconnect-history",
    expectedStepSeconds: stepSec,
    strategyClosedBarsRequired: SMA_CROSSOVER_RULES.slowSmaLength + 2,
    nowMs,
  });

  let quote: CanonicalQuoteSnapshot;
  try {
    quote = await deps.getQuoteSnapshot(instrument);
    quote = { ...quote, instrument: normalizeInstrumentId(quote.instrument) || instrument };
  } catch {
    quote = blockedQuote(instrument, "QUOTE_UNAVAILABLE", nowIso);
  }

  // Bid/ask validity
  if (
    quote.quoteFresh
    && (quote.bid == null || quote.ask == null || !(quote.bid > 0) || !(quote.ask > 0) || quote.ask < quote.bid)
  ) {
    quote = {
      ...quote,
      quoteFresh: false,
      freshnessReasonCode: quote.freshnessReasonCode ?? "BID_ASK_INVALID",
    };
  }

  const pointSize = await deps.getPointSize(instrument).catch(() => null);

  // Optional MTF evidence for HTF confirmation (non-fatal if load fails).
  let marketEvidence: import("./market-evidence-builder.js").MarketEvidenceBundle | null = null;
  try {
    const { buildMarketEvidenceBundle, AT_MTF_EVIDENCE_TIMEFRAMES } = await import(
      "./market-evidence-builder.js"
    );
    const candlesByTf: Record<string, StrategyCandle[]> = { [tf]: candles };
    for (const other of AT_MTF_EVIDENCE_TIMEFRAMES) {
      if (other === tf) continue;
      try {
        candlesByTf[other] = await deps.loadCandles(instrument, other);
      } catch {
        /* skip unavailable TF */
      }
    }
    let liveTickMovement: Parameters<typeof buildMarketEvidenceBundle>[0]["liveTickMovement"] = null;
    try {
      const { getGenuineTickCaptureService } = await import(
        "../../../market-data/forexconnect/genuine-tick-capture.js"
      );
      const capture = getGenuineTickCaptureService();
      const snap = capture.getSnapshot(instrument, { asOfMs: nowMs, sessionConnected: true });
      const counters = capture.getCounters();
      liveTickMovement = {
        latest: snap.latest
          ? {
            bid: snap.latest.bid,
            ask: snap.latest.ask,
            mid: snap.latest.mid,
            spread: snap.latest.spread,
            receiptTimestampMs: snap.latest.receiptTimestampMs,
            eventTimestampMs: snap.latest.eventTimestampMs,
            eventClass: snap.latest.eventClass,
            source: snap.latest.source,
          }
          : null,
        windows: snap.windows.map((w) => ({
          windowId: w.windowId,
          genuineTickCount: w.genuineTickCount,
          direction: w.direction,
          netBidMovement: w.netBidMovement,
          netAskMovement: w.netAskMovement,
          midPriceMovement: w.midPriceMovement,
          percentageMovement: w.percentageMovement,
          currentSpread: w.currentSpread,
          averageSpread: w.averageSpread,
          freshness: w.freshness,
          status: w.status,
          coverage: w.coverage,
          firstReceiptTimestampMs: w.firstReceiptTimestampMs,
          latestReceiptTimestampMs: w.latestReceiptTimestampMs,
        })),
        counters: {
          accepted: counters.accepted,
          filtered: counters.filtered,
          persisted: counters.persisted,
          duplicates: counters.duplicates,
          lastAcceptedAtMs: counters.lastAcceptedAtMs,
        },
      };
    } catch {
      liveTickMovement = null;
    }
    marketEvidence = buildMarketEvidenceBundle({
      environment: input.environment,
      instrument,
      primaryTimeframe: tf,
      candlesByTf,
      quote,
      pointSize,
      nowMs,
      liveTickMovement,
    });
  } catch {
    marketEvidence = null;
  }
  const evaluation = evaluateSmaCrossoverStrategy({ candles, pointSize });
  const adapted = toCanonicalFromStrategy({
    evaluation,
    instrument,
    timeframe: tf,
    asOfUtc: nowIso,
  });

  const deterministic = adapted.ok
    ? adapted.slice
    : {
      strategyId: SMA_CROSSOVER_RULES.strategyId,
      direction: "NO_TRADE" as const,
      code: adapted.ok === false ? adapted.code : "ADAPTER_FAILED",
      reasons: adapted.ok === false ? [adapted.message] : ["Adapter failed."],
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      confidencePct: null,
      closedCandle: null,
      atrMethod: "SMA_OF_TR" as const,
    };

  const indicators = indicatorsFromStrategyValues({
    fastSma: evaluation.fastSma,
    slowSma: evaluation.slowSma,
    atr: evaluation.atr,
    atrLength: SMA_CROSSOVER_RULES.atrLength,
    asOfUtc: nowIso,
  });

  let ai = null as ReturnType<typeof toCanonicalFromOpenAi> extends { ok: true; slice: infer S }
    ? S | null
    : null;
  let aiInstrument: string | null = null;
  if (input.includeOpenAi !== false) {
    const oa =
      input.openAiAnalysis
      ?? deps.getLatestOpenAi?.(instrument)
      ?? null;
    if (oa) {
      const adaptedAi = toCanonicalFromOpenAi(oa);
      if (adaptedAi.ok) {
        // Only use AI when instrument matches
        if (adaptedAi.instrument === instrument) {
          ai = adaptedAi.slice;
          aiInstrument = adaptedAi.instrument;
        }
      }
    }
  }

  const evidenceFingerprint = fingerprintEvidence(instrument, tf, candles, quote);

  const htf = marketEvidence
    ? {
      primaryTimeframe: tf,
      confirmationTimeframes: marketEvidence.multiTimeframe.confirmationTimeframes as import("./canonical-analysis.types.js").CanonicalTimeframeId[],
      perTf: marketEvidence.historical.byTimeframe.map((t) => ({
        timeframe: t.timeframe as import("./canonical-analysis.types.js").CanonicalTimeframeId,
        candleRef: null,
        deterministicBias: t.deterministicBias,
      })),
      agreement: marketEvidence.multiTimeframe.agreement,
    }
    : null;

  const result = reconcileAnalysis({
    environment: input.environment,
    instrument,
    primaryTimeframe: tf,
    analyzedAtUtc: nowIso,
    trigger: input.trigger ?? "manual",
    evidenceFingerprint,
    quote,
    candleStrategyReady: candleQuality.strategyReady,
    candleQuality: {
      strategyReady: candleQuality.strategyReady,
      blockers: candleQuality.blockers,
      closedBars: candleQuality.closedBars,
      invalidOhlcCount: candleQuality.invalidOhlcCount,
      duplicateCount: candleQuality.duplicateCount,
    },
    indicators,
    deterministic,
    ai,
    htf,
    aiInstrument,
    strategyInstrument: instrument,
    expectedInstrument: instrument,
  });

  let hist = { saved: false, duplicate: false, writeError: null as string | null };
  if (input.persist !== false) {
    const w = await historyStore.save(result);
    hist = { ...w, writeError: historyStore.lastWriteError };
  }

  return {
    ok: result.direction != null,
    result,
    candleQuality,
    marketEvidence,
    history: hist,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

export class CanonicalAnalysisService {
  constructor(
    private readonly depsFactory: () => CanonicalAnalysisDeps,
    private readonly historyStore: CanonicalAnalysisHistoryStore = getCanonicalAnalysisHistoryStore(),
  ) {}

  async run(input: CanonicalAnalysisRunInput) {
    const deps = this.depsFactory();
    return runCanonicalAnalysis(input, {
      ...deps,
      historyStore: input.persist === false ? deps.historyStore : (deps.historyStore ?? this.historyStore),
    });
  }

  latestHistory(): CanonicalAnalysisHistoryRecord | null {
    return this.historyStore.latest();
  }

  listHistory(limit = 12): CanonicalAnalysisHistoryRecord[] {
    return this.historyStore.list(limit);
  }

  getHistory(id: string): CanonicalAnalysisHistoryRecord | null {
    return this.historyStore.get(id);
  }
}
