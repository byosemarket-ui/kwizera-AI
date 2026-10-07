/**
 * Phase 23 — Forex AI Memory / Journal / Learning contracts.
 * Historical context only. Does not replace Market State. No model weight training.
 */

export const FOREX_MEMORY_SCHEMA_VERSION = "forex-memory-v1" as const;
export const FOREX_MEMORY_ENGINE_VERSION = "forex-memory-engine-v1";

export type ForexMemoryAnalysisType =
  | "SINGLE_TIMEFRAME"
  | "MULTI_TIMEFRAME"
  | "DECISION";

export type ForexScenarioOutcomeStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PARTIALLY_CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "INCONCLUSIVE"
  | "INSUFFICIENT_DATA";

export type ForexMistakeCategory =
  | "WRONG_DIRECTION"
  | "EARLY_SCENARIO"
  | "LATE_CONFIRMATION"
  | "INVALIDATION_MISSED"
  | "DATA_STALE"
  | "TIMEFRAME_CONFLICT_IGNORED"
  | "ENTRY_ZONE_TOO_WIDE"
  | "ENTRY_ZONE_UNAVAILABLE"
  | "TARGET_UNREALISTIC"
  | "INSUFFICIENT_DATA"
  | "KNOWLEDGE_GROUNDING_ISSUE"
  | "AI_HALLUCINATION_BLOCKED"
  | "ANALYSIS_TIMEOUT"
  | "MODEL_OUTPUT_INVALID"
  | "OTHER";

export type ForexMistakeSeverity = "LOW" | "MEDIUM" | "HIGH";

export type ForexMarketRegime =
  | "TRENDING_BULLISH"
  | "TRENDING_BEARISH"
  | "RANGING"
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "CONFLICTED"
  | "UNKNOWN";

export type ForexStatisticalConfidence = "OK" | "INSUFFICIENT_SAMPLE";

export interface ForexMarketMemorySnapshot {
  id: string;
  symbol: string;
  marketType: "SPOT";
  exchange: "BINANCE";
  timeframe: string | null;
  timestamp: string | null;
  candleTimestamp: string | null;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  trend: string | null;
  momentum: string | null;
  volatility: string | null;
  rsi: number | null;
  atr: number | null;
  structure: string | null;
  swingHigh: number | null;
  swingLow: number | null;
  dataQuality: string;
  source: "binance-spot";
  createdAt: string;
}

export interface ForexTimeframeMemoryRef {
  timeframe: string;
  usable: boolean;
  status: string;
  trend: string | null;
  momentum: string | null;
  rsi: number | null;
  price: number | null;
  timestamp: string | null;
  candleTimestamp: string | null;
}

export interface ForexAnalysisMemoryRecord {
  id: string;
  schemaVersion: typeof FOREX_MEMORY_SCHEMA_VERSION;
  memoryEngineVersion: typeof FOREX_MEMORY_ENGINE_VERSION;
  idempotencyKey: string;
  symbol: string;
  displaySymbol: string;
  timeframes: string[];
  analysisType: ForexMemoryAnalysisType;
  generatedAt: string;
  createdAt: string;
  marketSnapshotId: string | null;
  mtfSnapshotIds: string[];
  scenario: string | null;
  scenarioDirection: string | null;
  decisionPosture: string | null;
  alignment: string | null;
  higherBias: string | null;
  marketRegime: ForexMarketRegime;
  observedFacts: string[];
  deterministicSummary: string | null;
  aiInterpretation: string | null;
  narrativeStatus: string | null;
  confirmationSummary: string | null;
  confirmationConditions: Array<{ id: string; status: string; description: string }>;
  invalidationSummary: string | null;
  invalidationConditions: Array<{ id: string; status: string; description: string; level: number | null }>;
  entryZone: {
    status: string;
    lowerBound: number | null;
    upperBound: number | null;
    referencePrice: number | null;
    invalidationLevel: number | null;
    timeframe: string | null;
    unavailableReason: string | null;
  } | null;
  stopLossCandidate: number | null;
  takeProfitCandidates: number[];
  riskRewardRatio: number | null;
  knowledgeSources: Array<{ documentId: string; title: string }>;
  timeframeStates: ForexTimeframeMemoryRef[];
  dataQuality: string;
  modelId: string | null;
  promptVersion: string | null;
  contractVersion: string | null;
  engineVersion: string | null;
  analysisStatus: "STORED" | "FALLBACK" | "INSUFFICIENT_DATA";
  latencyMs: number | null;
  promptChars: number | null;
  confidence: null;
  evaluationHorizonCandles: number;
  evaluationHorizonMs: number;
  expiresAt: string;
  outcomeId: string | null;
  /** Immutable original payload summary — never rewritten after create. */
  originalImmutable: true;
}

export interface ForexScenarioOutcomeRecord {
  id: string;
  analysisId: string;
  symbol: string;
  scenario: string | null;
  status: ForexScenarioOutcomeStatus;
  zoneTouched: boolean;
  zoneTouchAt: string | null;
  confirmationReached: boolean;
  invalidationReached: boolean;
  targetReached: boolean[];
  eventOrder: string[];
  evaluatedAt: string;
  evaluationHorizonCandles: number;
  notes: string[];
  learningNote: string | null;
  /** Linked only — does not mutate the analysis record body. */
  evidence: string[];
}

export interface ForexMistakeRecord {
  id: string;
  analysisId: string;
  category: ForexMistakeCategory;
  severity: ForexMistakeSeverity;
  description: string;
  evidence: string[];
  detectedAt: string;
  resolved: boolean;
  resolution: string | null;
  symbol: string;
  scenario: string | null;
}

export interface ForexModelPerfCounters {
  modelId: string;
  totalAnalyses: number;
  validJsonOrModelNarrative: number;
  deterministicFallback: number;
  groundingRejected: number;
  timeoutOrUnavailable: number;
  totalLatencyMs: number;
  totalPromptChars: number;
  samplesWithLatency: number;
  samplesWithPrompt: number;
}

export interface ForexLearningBucket {
  key: string;
  sampleSize: number;
  confirmed: number;
  invalidated: number;
  partiallyConfirmed: number;
  inconclusive: number;
  expired: number;
  pending: number;
  zoneTouched: number;
  statisticalConfidence: ForexStatisticalConfidence;
}

export interface ForexMemoryStoreFile {
  version: 1;
  schemaVersion: typeof FOREX_MEMORY_SCHEMA_VERSION;
  marketSnapshots: ForexMarketMemorySnapshot[];
  analyses: ForexAnalysisMemoryRecord[];
  outcomes: ForexScenarioOutcomeRecord[];
  mistakes: ForexMistakeRecord[];
  modelPerf: ForexModelPerfCounters[];
}

export interface ForexMemoryListQuery {
  symbol?: string;
  timeframe?: string;
  scenario?: string;
  outcome?: string;
  analysisType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ForexMemoryRetrieveQuery {
  symbol?: string;
  scenario?: string;
  marketRegime?: string;
  limit?: number;
}

export interface ForexMemoryContextExample {
  analysisId: string;
  symbol: string;
  scenario: string | null;
  regime: ForexMarketRegime;
  outcome: ForexScenarioOutcomeStatus | "NONE";
  posture: string | null;
  generatedAt: string;
  score: number;
}

export interface ForexMemoryContextPack {
  sampleSize: number;
  examples: ForexMemoryContextExample[];
  limitations: string[];
  note: string;
}

export const FOREX_MEMORY_MIN_SAMPLE = 10;
export const FOREX_MEMORY_DEFAULT_HORIZON_CANDLES = 15;
export const FOREX_MEMORY_DEFAULT_HORIZON_MS = 15 * 60 * 1000; // 15m default wall clock
export const FOREX_MEMORY_RETRIEVE_LIMIT = 5;
