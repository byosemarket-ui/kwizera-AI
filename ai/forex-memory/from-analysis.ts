/**
 * Map Phase 20/21/22 analysis results into immutable memory records.
 */
import { createHash, randomUUID } from "node:crypto";
import { classifyMarketRegime } from "./regime.js";
import {
  FOREX_MEMORY_DEFAULT_HORIZON_CANDLES,
  FOREX_MEMORY_DEFAULT_HORIZON_MS,
  FOREX_MEMORY_ENGINE_VERSION,
  FOREX_MEMORY_SCHEMA_VERSION,
  type ForexAnalysisMemoryRecord,
  type ForexMarketMemorySnapshot,
  type ForexMemoryAnalysisType,
  type ForexTimeframeMemoryRef,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

function finiteOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function buildIdempotencyKey(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

export function buildMarketSnapshotFromCompact(input: {
  symbol: string;
  timeframe: string | null;
  price: number | null;
  trend: string | null;
  momentum: string | null;
  volatility: string | null;
  rsi: number | null;
  structure: string | null;
  timestamp: string | null;
  dataQuality: string;
  provider?: "BINANCE" | "FXCM";
  marketType?: ForexMarketMemorySnapshot["marketType"];
  displaySymbol?: string;
  providerSymbol?: string;
}): ForexMarketMemorySnapshot {
  const createdAt = nowIso();
  const provider = input.provider === "FXCM" ? "FXCM" : "BINANCE";
  const compact = input.symbol.replace(/[/_-\s]/g, "").toUpperCase();
  return {
    id: randomUUID(),
    symbol: compact,
    marketType: input.marketType ?? (provider === "FXCM" ? "FOREX" : "SPOT"),
    exchange: provider,
    provider,
    providerSymbol: input.providerSymbol ?? input.symbol,
    canonicalSymbol: compact,
    displaySymbol: input.displaySymbol ?? input.symbol,
    timeframe: input.timeframe,
    timestamp: input.timestamp,
    candleTimestamp: input.timestamp,
    price: finiteOrNull(input.price),
    open: null,
    high: null,
    low: null,
    close: finiteOrNull(input.price),
    volume: null,
    trend: input.trend,
    momentum: input.momentum,
    volatility: input.volatility,
    rsi: finiteOrNull(input.rsi),
    atr: null,
    structure: input.structure,
    swingHigh: null,
    swingLow: null,
    dataQuality: input.dataQuality,
    source: provider === "FXCM" ? "fxcm-mid" : "binance-spot",
    createdAt,
  };
}

function mapTfStates(raw: unknown): ForexTimeframeMemoryRef[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 12).map((item) => {
    const r = (item && typeof item === "object") ? item as Record<string, unknown> : {};
    return {
      timeframe: String(r.timeframe ?? ""),
      usable: r.usable !== false,
      status: String(r.status ?? "UNKNOWN"),
      trend: r.trend == null ? null : String(r.trend),
      momentum: r.momentum == null ? null : String(r.momentum),
      rsi: finiteOrNull(r.rsi),
      price: finiteOrNull(r.price),
      timestamp: r.timestamp == null ? null : String(r.timestamp),
      candleTimestamp: r.timestamp == null ? null : String(r.timestamp),
    };
  }).filter((t) => t.timeframe);
}

export interface PersistAnalysisInput {
  analysisType: ForexMemoryAnalysisType;
  analysis: Record<string, unknown>;
  latencyMs?: number | null;
  promptChars?: number | null;
}

export function buildAnalysisMemoryFromPayload(input: PersistAnalysisInput): {
  record: ForexAnalysisMemoryRecord;
  marketSnapshots: ForexMarketMemorySnapshot[];
} {
  const a = input.analysis;
  const market = (a.market && typeof a.market === "object") ? a.market as Record<string, unknown> : {};
  const symbol = String(market.symbol ?? a.symbol ?? "").toUpperCase();
  const displaySymbol = String(market.displaySymbol ?? symbol);
  const generatedAt = String(a.generatedAt ?? nowIso());
  const analysisId = String(a.analysisId ?? randomUUID());
  const timeframes = Array.isArray(a.timeframes)
    ? a.timeframes.map(String)
    : [String(market.timeframe ?? a.timeframe ?? "")].filter(Boolean);

  const timeframeStates = mapTfStates(a.timeframeStates);
  const dataQualityObj = (a.dataQuality && typeof a.dataQuality === "object")
    ? a.dataQuality as Record<string, unknown>
    : {};
  const dataQuality = String(dataQualityObj.status ?? a.dataQuality ?? "UNKNOWN");

  const scenarioObj = (a.scenario && typeof a.scenario === "object")
    ? a.scenario as Record<string, unknown>
    : null;
  const scenario = scenarioObj
    ? String(scenarioObj.type ?? "")
    : Array.isArray(a.scenarios) && a.scenarios[0]
      ? String((a.scenarios[0] as { type?: string }).type ?? "")
      : null;

  const alignmentObj = (a.alignment && typeof a.alignment === "object")
    ? a.alignment as Record<string, unknown>
    : (a.overallAlignment && typeof a.overallAlignment === "object")
      ? a.overallAlignment as Record<string, unknown>
      : null;
  const alignment = alignmentObj ? String(alignmentObj.overall ?? "") : null;
  const higherBias = alignmentObj
    ? String(alignmentObj.higherBias ?? "")
    : (a.higherTimeframeBias && typeof a.higherTimeframeBias === "object")
      ? String((a.higherTimeframeBias as { direction?: string }).direction ?? "")
      : null;

  const entryZoneRaw = (a.entryZone && typeof a.entryZone === "object")
    ? a.entryZone as Record<string, unknown>
    : null;

  const confirmation = (a.confirmation && typeof a.confirmation === "object")
    ? a.confirmation as Record<string, unknown>
    : null;
  const invalidation = (a.invalidation && typeof a.invalidation === "object")
    ? a.invalidation as Record<string, unknown>
    : null;

  const confirmationConditions = Array.isArray(confirmation?.conditions)
    ? (confirmation!.conditions as Array<Record<string, unknown>>).slice(0, 20).map((c) => ({
      id: String(c.id ?? ""),
      status: String(c.status ?? "UNKNOWN"),
      description: String(c.description ?? ""),
    }))
    : Array.isArray(a.confirmationNeeded)
      ? (a.confirmationNeeded as unknown[]).slice(0, 12).map((c, i) => ({
        id: `c-${i}`,
        status: "UNKNOWN",
        description: String(c),
      }))
      : [];

  const invalidationConditions = Array.isArray(invalidation?.conditions)
    ? (invalidation!.conditions as Array<Record<string, unknown>>).slice(0, 20).map((c) => ({
      id: String(c.id ?? ""),
      status: String(c.status ?? "UNKNOWN"),
      description: String(c.description ?? ""),
      level: finiteOrNull(c.level),
    }))
    : Array.isArray(a.invalidationConditions)
      ? (a.invalidationConditions as unknown[]).slice(0, 12).map((c, i) => ({
        id: `i-${i}`,
        status: "UNKNOWN",
        description: String(c),
        level: null,
      }))
      : [];

  const knowledgeSources = Array.isArray(a.knowledgeSources)
    ? (a.knowledgeSources as Array<Record<string, unknown>>).slice(0, 10).map((k) => ({
      documentId: String(k.documentId ?? ""),
      title: String(k.title ?? ""),
    }))
    : [];

  const memorySources = Array.isArray(a.memorySources)
    ? (a.memorySources as Array<Record<string, unknown>>).slice(0, 10).map((m) => ({
      memoryId: String(m.memoryId ?? ""),
      symbol: String(m.symbol ?? ""),
      timeframe: m.timeframe == null ? null : String(m.timeframe),
      scenario: m.scenario == null ? null : String(m.scenario),
      outcome: String(m.outcome ?? "NONE"),
      relevance: String(m.relevance ?? "CONTEXTUAL"),
      timestamp: String(m.timestamp ?? generatedAt),
    })).filter((m) => m.memoryId)
    : [];

  const narrativeStatus = a.narrativeStatus == null ? null : String(a.narrativeStatus);
  const analysisStatus: ForexAnalysisMemoryRecord["analysisStatus"] =
    dataQuality === "INSUFFICIENT_DATA" || String(a.decisionPosture ?? "") === "INSUFFICIENT_DATA"
      ? "INSUFFICIENT_DATA"
      : narrativeStatus === "DETERMINISTIC_ONLY" || narrativeStatus === "MARKET_STATE_ONLY"
        ? "FALLBACK"
        : "STORED";

  const volatilityHint = timeframeStates
    .map((t) => (t as ForexTimeframeMemoryRef & { volatility?: string }).volatility)
    .find(Boolean) ?? null;

  const marketRegime = classifyMarketRegime({
    alignment,
    higherBias,
    scenario,
    volatility: volatilityHint,
    trends: timeframeStates.map((t) => t.trend),
  });

  const provider = market.exchange === "FXCM" ? "FXCM" as const : "BINANCE" as const;
  const marketType = provider === "FXCM"
    ? (String(market.marketType ?? "FOREX").toUpperCase() as ForexMarketMemorySnapshot["marketType"])
    : "SPOT";

  const marketSnapshots = timeframeStates
    .filter((t) => t.usable)
    .map((t) => buildMarketSnapshotFromCompact({
      symbol,
      timeframe: t.timeframe,
      price: t.price,
      trend: t.trend,
      momentum: t.momentum,
      volatility: null,
      rsi: t.rsi,
      structure: null,
      timestamp: t.timestamp,
      dataQuality: t.status,
      provider,
      marketType,
      displaySymbol,
    }));

  // Single-TF fallback snapshot
  if (marketSnapshots.length === 0 && (market.currentPrice != null || a.price != null || market.symbol)) {
    marketSnapshots.push(buildMarketSnapshotFromCompact({
      symbol,
      timeframe: timeframes[0] ?? null,
      price: finiteOrNull(market.currentPrice ?? a.price),
      trend: a.trend && typeof a.trend === "object"
        ? String((a.trend as { direction?: string }).direction ?? "")
        : null,
      momentum: a.momentum && typeof a.momentum === "object"
        ? String((a.momentum as { state?: string }).state ?? "")
        : null,
      volatility: a.volatility && typeof a.volatility === "object"
        ? String((a.volatility as { state?: string }).state ?? "")
        : null,
      rsi: null,
      structure: null,
      timestamp: generatedAt,
      dataQuality,
      provider,
      marketType,
      displaySymbol,
    }));
  }

  const horizonCandles = FOREX_MEMORY_DEFAULT_HORIZON_CANDLES;
  const horizonMs = FOREX_MEMORY_DEFAULT_HORIZON_MS * (
    timeframes.includes("4h") ? 16 : timeframes.includes("1h") ? 4 : 1
  );
  const expiresAt = new Date(Date.parse(generatedAt) + horizonMs).toISOString();

  const idempotencyKey = buildIdempotencyKey([
    symbol,
    input.analysisType,
    timeframes.join(","),
    generatedAt,
    analysisId,
    String(a.schemaVersion ?? a.contractVersion ?? ""),
  ]);

  const rr = (a.riskReward && typeof a.riskReward === "object")
    ? finiteOrNull((a.riskReward as { ratio?: number }).ratio)
    : null;

  const record: ForexAnalysisMemoryRecord = {
    id: analysisId,
    schemaVersion: FOREX_MEMORY_SCHEMA_VERSION,
    memoryEngineVersion: FOREX_MEMORY_ENGINE_VERSION,
    idempotencyKey,
    symbol,
    displaySymbol,
    timeframes,
    analysisType: input.analysisType,
    generatedAt,
    createdAt: nowIso(),
    marketSnapshotId: marketSnapshots[0]?.id ?? null,
    mtfSnapshotIds: marketSnapshots.map((s) => s.id),
    scenario: scenario || null,
    scenarioDirection: scenarioObj ? String(scenarioObj.direction ?? "") || null : null,
    decisionPosture: a.decisionPosture == null ? null : String(a.decisionPosture),
    alignment,
    higherBias,
    marketRegime,
    observedFacts: Array.isArray(a.observedFacts) ? a.observedFacts.map(String).slice(0, 40) : [],
    deterministicSummary: a.deterministicSummary == null
      ? (a.summary == null ? null : String(a.summary))
      : String(a.deterministicSummary),
    aiInterpretation: a.aiInterpretation == null
      ? (a.reasoning == null ? null : String(a.reasoning))
      : String(a.aiInterpretation),
    narrativeStatus,
    confirmationSummary: confirmation ? String(confirmation.summary ?? "") : null,
    confirmationConditions,
    invalidationSummary: invalidation ? String(invalidation.summary ?? "") : null,
    invalidationConditions,
    entryZone: entryZoneRaw
      ? {
        status: String(entryZoneRaw.status ?? "UNAVAILABLE"),
        lowerBound: finiteOrNull(entryZoneRaw.lowerBound),
        upperBound: finiteOrNull(entryZoneRaw.upperBound),
        referencePrice: finiteOrNull(entryZoneRaw.referencePrice),
        invalidationLevel: finiteOrNull(entryZoneRaw.invalidationLevel),
        timeframe: entryZoneRaw.timeframe == null ? null : String(entryZoneRaw.timeframe),
        unavailableReason: entryZoneRaw.unavailableReason == null
          ? null
          : String(entryZoneRaw.unavailableReason),
      }
      : null,
    stopLossCandidate: finiteOrNull(a.stopLossCandidate),
    takeProfitCandidates: Array.isArray(a.takeProfitCandidates)
      ? a.takeProfitCandidates.map(finiteOrNull).filter((n): n is number => n != null)
      : [],
    riskRewardRatio: rr,
    knowledgeSources,
    memorySources,
    memoryUnavailable: a.memoryUnavailable === true,
    knowledgeUnavailable: a.knowledgeUnavailable === true,
    timeframeStates,
    dataQuality,
    modelId: a.model == null ? null : String(a.model),
    promptVersion: a.promptVersion == null ? null : String(a.promptVersion),
    contractVersion: a.schemaVersion == null ? null : String(a.schemaVersion),
    engineVersion: a.engineVersion == null ? null : String(a.engineVersion),
    analysisStatus,
    latencyMs: finiteOrNull(input.latencyMs),
    promptChars: finiteOrNull(input.promptChars),
    confidence: null,
    evaluationHorizonCandles: horizonCandles,
    evaluationHorizonMs: horizonMs,
    expiresAt,
    outcomeId: null,
    originalImmutable: true,
  };

  return { record, marketSnapshots };
}
