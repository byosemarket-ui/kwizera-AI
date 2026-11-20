/**
 * Phase 5D.5 — production integration request/result types.
 */
import type { HfmHistoricalBar } from "../../historical-engine.js";
import type { MifCanonicalCandle } from "../canonical/candle.js";
import type { MifCanonicalInstrument } from "../canonical/instrument.js";
import type { MifSafetyFlags } from "../canonical/types.js";
import type { MifFibonacciAssessment } from "../analysis/fibonacci/types.js";
import type { MifHarmonicAssessment } from "../analysis/harmonics/types.js";
import type { MifMtfRelationshipsAssessment } from "../analysis/mtf-relationships/types.js";
import type { MifChartPatternAssessment } from "../analysis/patterns/types.js";
import type { MifMarketRegimeAssessment } from "../analysis/regime/types.js";
import type { MifUnifiedChartAnalysisAssessment } from "../analysis/unified/types.js";
import type { MifStep1DataIntegrityAssessment } from "../quality/types.js";
import type {
  MifOpportunityDetectionRunResult,
  MifOpportunityDetectionContext,
} from "../opportunity-detection/types.js";
import type { MifStrategyEligibilityResult, MifTimeframeRole } from "../strategy-intelligence/types.js";
import type {
  MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
  MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION,
} from "./contracts.js";

export type MifProductionAnalysisStatus =
  | "OK"
  | "OK_EMPTY_CANDIDATES"
  | "INSUFFICIENT_EVIDENCE"
  | "PARTIAL_DEGRADED"
  | "FAILED_UPSTREAM_DATA"
  | "FAILED_PROVIDER"
  | "FAILED_VALIDATION"
  | "FAILED_ASSESSMENT"
  | "FAILED_ORCHESTRATOR"
  | "FAILED_SERIALIZATION";

export type MifProductionFailureCode =
  | "WRONG_PROVIDER"
  | "INVALID_INSTRUMENT"
  | "INVALID_TIMEFRAME"
  | "HFM_UNAVAILABLE"
  | "HFM_TIMEOUT"
  | "MISSING_CANDLES"
  | "STALE_CANDLES"
  | "INVALID_OHLC"
  | "INSTRUMENT_MISMATCH"
  | "TIMEFRAME_MISMATCH"
  | "INCOMPLETE_HISTORY"
  | "QUALITY_BLOCKED"
  | "ASSESSMENT_ERROR"
  | "ORCHESTRATOR_ERROR"
  | "SERIALIZATION_ERROR"
  | "UNKNOWN";

export interface MifProductionTfSeriesInput {
  timeframe: string;
  bars: readonly HfmHistoricalBar[];
  /** Optional pre-adapted candles; when omitted, bars are adapted. */
  candles?: readonly MifCanonicalCandle[];
  freshness?: string | null;
  source?: string | null;
  newestTimestampSec?: number | null;
  errors?: readonly string[];
}

/**
 * Injected series path — used by tests and by live fetch wrapper.
 * Never fabricates OHLC.
 */
export interface MifProductionPipelineFromSeriesInput {
  requestId?: string | null;
  providerId?: string;
  providerSymbol: string;
  instrument?: MifCanonicalInstrument | null;
  timeframes?: readonly string[];
  primaryTimeframe?: string;
  series: readonly MifProductionTfSeriesInput[];
  assessmentTimestamp?: string;
  /** Max age of newest CLOSED candle tip vs assessment time (sec). null = no stale gate. */
  maxCandleAgeSec?: number | null;
  /**
   * Optional HFM session-calendar authority (from catalog SymbolInfoSession*).
   * When omitted, live path attempts catalog load; series tests may inject fixtures.
   */
  expectedIntervalAuthority?: import("../quality/types.js").MifExpectedIntervalAuthority | null;
}

export interface MifProductionLiveFetchInput {
  requestId?: string | null;
  providerId?: string;
  providerSymbol: string;
  timeframes?: readonly string[];
  primaryTimeframe?: string;
  candleLimit?: number;
  refresh?: boolean;
  assessmentTimestamp?: string;
  maxCandleAgeSec?: number | null;
}

export interface MifProductionTfAssessmentSnapshot {
  timeframe: string;
  barCount: number;
  candleCount: number;
  adapterFailures: number;
  dataIntegrityStatus: string | null;
  /** Compact integrity finding codes that drove WARNING/DEGRADED/BLOCKED. */
  integrityFindingCodes: readonly string[];
  regimeStatus: string | null;
  regimeDirection: string | null;
  regimeStructure: string | null;
  fibonacciStatus: string | null;
  chartPatternsStatus: string | null;
  harmonicStatus: string | null;
  unifiedStatus: string | null;
  tipCandleState: string | null;
  tipOpenTimeSec: number | null;
  newestTimestampSec: number | null;
  freshness: string | null;
  warnings: string[];
  errors: string[];
}

/** Traceable explanation for aggregate dataQualityStatus / PARTIAL_DEGRADED. */
export interface MifProductionDataQualityDiagnostics {
  dataQualityStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING";
  analysisStatusDriver: string;
  perTimeframe: readonly {
    timeframe: string;
    integrityStatus: string | null;
    findingCodes: readonly string[];
  }[];
  primaryFindingCodes: readonly string[];
  explanation: string;
  /** True when WARNING is solely from missing HFM session calendar authority. */
  sessionCalendarAuthorityMissing: boolean;
}

export interface MifProductionIntegrationResult extends MifSafetyFlags {
  contractId: typeof MIF_PRODUCTION_INTEGRATION_CONTRACT_ID;
  contractVersion: typeof MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION;
  engineId: string;
  engineVersion: string;
  requestId: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  requestedTimeframes: readonly string[];
  resolvedTimeframes: readonly string[];
  primaryTimeframe: string;
  marketDataTimestamp: string | null;
  candleTimestampSec: number | null;
  candleLifecycle: string | null;
  dataFreshness: string | null;
  processingTimestamp: string;
  analysisStatus: MifProductionAnalysisStatus;
  dataQualityStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING";
  dataQualityDiagnostics: MifProductionDataQualityDiagnostics | null;
  availableTimeframeRoles: readonly MifTimeframeRole[];
  timeframeSnapshots: readonly MifProductionTfAssessmentSnapshot[];
  mtfStatus: string | null;
  mtfRelation: string | null;
  eligibility: readonly MifStrategyEligibilityResult[];
  detection: MifOpportunityDetectionRunResult | null;
  candidateCount: number;
  /** Compact evidence refs for ranking reproducibility (no secrets). */
  evidenceRefs?: readonly import("../opportunity-detection/types.js").MifDetectionEvidenceRef[];
  warnings: readonly string[];
  errors: readonly string[];
  failureCodes: readonly MifProductionFailureCode[];
  /** Present when analysis produced a context (even if detection failed). */
  contextSummary: {
    evidenceCount: number;
    assessmentTimestamp: string;
    hasRegime: boolean;
    hasMtf: boolean;
    hasFibonacci: boolean;
    hasChartPatterns: boolean;
    hasHarmonic: boolean;
    hasUnified: boolean;
    hasMarketStructure: boolean;
    hasSupportResistance: boolean;
    hasLiquidityReference: boolean;
    hasMomentum: boolean;
    hasPriceDisplacement: boolean;
  } | null;
  /** Phase 5D.6 evidence quality (not a win probability). */
  evidenceQuality?: {
    overallBand: string;
    analysisImpact: string;
    explanation: string;
    dataQuality: string;
    evidenceCompleteness: string;
    mtfAgreement: string;
    partialSourceFamilies: readonly string[];
    executionReadiness: false;
    notWinProbability: true;
  } | null;
  /** Persistence metadata when durable store is enabled. */
  persistence?: {
    persisted: boolean;
    runId: string | null;
    candidateIds: readonly string[];
    created: boolean;
    rankingRunId?: string | null;
  } | null;
  /** Phase 5E Step 1 — analytical ranking (not win probability). */
  ranking?: {
    rankingRunId: string;
    rankedCount: number;
    blockedCount: number;
    insufficientCount: number;
    top: readonly {
      candidateId: string;
      strategyId: string;
      rankPosition: number | null;
      overallScore: number | null;
      scoreBand: string;
      rankingEligibility: string;
    }[];
    isWinProbability: false;
    executionReadiness: false;
  } | null;
  /** Phase 5E Step 2 — evidence + probability intelligence (nullable probability when insufficient). */
  probabilityIntelligence?: {
    assessedCount: number;
    insufficientSampleCount: number;
    unavailableCount: number;
    withProbabilityCount: number;
    top: readonly {
      candidateId: string;
      sampleStatus: string;
      probability: number | null;
      reliabilityStatus: string;
      calibrationStatus: string;
      isWinProbability: boolean;
    }[];
    placesOrders: false;
    mutatesBroker: false;
    acceptsForExecution: false;
  } | null;
  doesNotApproveAiReasoning: true;
  analyticalIntegrationOnly: true;
  notExecutable: true;
  /** Internal context retained for tests only when explicitly requested. */
  _debugContext?: MifOpportunityDetectionContext;
  /** Full ranking run retained for persistence/tests — not a win-probability payload. */
  _rankingRun?: import("../opportunity-ranking/types.js").MifOpportunityRankingRun | null;
  /** Full Step 2 bundles retained for persistence/tests. */
  _probabilityBundles?: readonly import("../probability-intelligence/types.js").MifProbabilityBundle[] | null;
}

export interface MifProductionAssessmentBundle {
  integrity: MifStep1DataIntegrityAssessment;
  regime: MifMarketRegimeAssessment;
  fibonacci: MifFibonacciAssessment;
  chartPatterns: MifChartPatternAssessment;
  harmonic: MifHarmonicAssessment;
  unified: MifUnifiedChartAnalysisAssessment;
  candles: readonly MifCanonicalCandle[];
}
