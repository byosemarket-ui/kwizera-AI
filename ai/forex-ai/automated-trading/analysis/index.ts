export * from "./types.js";
export * from "./direction.js";
export * from "./evidence.js";
export * from "./price-consistency.js";
export * from "./validate.js";
export * from "./prompts.js";
export * from "./store.js";
export * from "./canonical-analysis.types.js";
export {
  normalizeInstrumentId,
  normalizeCanonicalTimeframe,
  normalizeUnixSeconds,
  toCanonicalFromStrategy,
  toCanonicalFromOpenAi,
  assertAiCannotPopulateIndicators,
} from "./adapters.js";
export {
  calculateAnalysisConfidence,
  CONFIDENCE_WEIGHTS,
} from "./confidence.js";
export {
  reconcileAnalysis,
  indicatorsFromStrategyValues,
} from "./reconciler.js";
export {
  runCanonicalAnalysis,
  toCanonicalPublicView,
  CanonicalAnalysisService,
  type CanonicalAnalysisDeps,
  type CanonicalAnalysisPublicView,
  type CanonicalAnalysisRunInput,
  type CanonicalDisplayFreshness,
} from "./canonical-analysis.service.js";
export {
  CanonicalAnalysisHistoryStore,
  getCanonicalAnalysisHistoryStore,
  resetCanonicalAnalysisHistoryStoreForTests,
  toHistoryRecord,
  canonicalHistoryDedupeKey,
  CANONICAL_HISTORY_MAX,
  type CanonicalAnalysisHistoryRecord,
} from "./canonical-analysis-history.store.js";
export { createCanonicalAnalysisProductionDeps } from "./canonical-analysis.production-deps.js";
export {
  summarizeHistoricalMovement,
  classifyCandleGeometry,
  selectClosedMovementCandles,
  type HistoricalMovementSummary,
} from "./historical-movement.js";
export {
  buildMarketEvidenceBundle,
  buildPerTimeframeEvidence,
  marketEvidenceForModelPrompt,
  AT_HISTORY_LOOKBACK_LIMIT,
  AT_MTF_EVIDENCE_TIMEFRAMES,
  MARKET_EVIDENCE_SCHEMA,
  MARKET_EVIDENCE_VERSION,
  type MarketEvidenceBundle,
  type PerTimeframeEvidence,
} from "./market-evidence-builder.js";
export {
  buildTechnicalIntelligence,
  computeIndicatorSuite,
  classifyMarketCondition,
  validateStrategySignal,
  buildStructureIntel,
  TECH_INTEL_SCHEMA,
  INDICATOR_ENGINE_VERSION,
  SIGNAL_VALIDATION_VERSION,
  type TechnicalIntelligenceBundle,
  type IndicatorSuite,
  type SignalValidationRecord,
} from "../technical-intelligence/index.js";
export {
  AtOpenAiAnalysisEngine,
  AT_OPENAI_DEFAULT_TIMEOUT_MS,
  AT_OPENAI_MAX_TIMEOUT_MS,
  AT_OPENAI_MIN_TIMEOUT_MS,
  getAtOpenAiAnalysisEngine,
  resetAtOpenAiAnalysisEngineForTests,
} from "./engine.js";
