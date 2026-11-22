/**
 * Phase 5 — HFM AI Reasoning types (no execution authority).
 * Schema v1.2 extends v1.1 with unified evidence/scenario grounding fields.
 */
import type {
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
} from "./constants.js";
import type { HfmReasoningPricePrecisionResult } from "./price-precision.js";
import type { HfmChartsPredictionLinkage } from "../prediction-bridge/types.js";

export type HfmUnifiedInputCompleteness = "COMPLETE" | "PARTIAL";

export type HfmReasoningJobStatus =
  | "QUEUED"
  | "VALIDATING_CONTEXT"
  | "PREPARING_EVIDENCE"
  | "WAITING_FOR_OPENAI"
  | "REASONING"
  | "VALIDATING_RESPONSE"
  | "COMPLETED"
  | "REJECTED"
  | "FAILED";

export type HfmReasoningDecisionAction =
  | "BUY"
  | "SELL"
  | "NO_TRADE"
  | "WAITING_FOR_CONFIRMATION";

export type HfmReasoningConfidenceLabel = "LOW" | "MODERATE" | "HIGH";

export type HfmSectionProvision = "PROVIDED" | "NOT_PROVIDED";

export type HfmReasoningMarketCondition =
  | "TRENDING"
  | "RANGING"
  | "VOLATILE"
  | "UNCLEAR"
  | "NOT_PROVIDED";

export type HfmReasoningBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL"
  | "MIXED"
  | "NOT_PROVIDED";

export type HfmReasoningAlignment =
  | "ALIGNED"
  | "PARTIALLY_ALIGNED"
  | "CONFLICTING"
  | "UNCLEAR"
  | "NOT_PROVIDED";

export type HfmScenarioStatus =
  | "ACTIVE"
  | "POSSIBLE"
  | "INVALIDATED"
  | "NOT_SUPPORTED";

export type HfmSetupStatus =
  | "READY"
  | "WAITING"
  | "INVALIDATED"
  | "NOT_APPLICABLE";

export type HfmTradeDirection = "BUY" | "SELL" | "NONE";

export type HfmRiskLevel =
  | "LOW"
  | "MODERATE"
  | "HIGH"
  | "UNACCEPTABLE"
  | "NOT_PROVIDED";

export interface HfmReasoningTfBlock {
  sectionStatus: HfmSectionProvision;
  bias: HfmReasoningBias | string;
  structure: string;
  observations: string[];
  supportingEvidence: string[];
  risks: string[];
}

export interface HfmReasoningScenario {
  status: HfmScenarioStatus;
  conditions: string[];
  confirmation: string[];
  invalidation: string[];
}

export interface HfmReasoningTradePlan {
  direction: HfmTradeDirection;
  setupStatus: HfmSetupStatus;
  entryZone: { low: number | null; high: number | null };
  stopLoss: number | null;
  takeProfitTargets: number[];
  invalidationPrice: number | null;
  riskRewardEstimate: number | null;
  explanation: string;
}

export interface HfmReasoningCompleteness {
  status: "COMPLETE" | "INCOMPLETE";
  missingSections: string[];
  notes: string[];
}

/** Lifecycle-mapped decision status for Charts AI output. */
export type HfmReasoningDecisionStatus =
  | "OBSERVING"
  | "DEVELOPING"
  | "WAITING_FOR_CONFIRMATION"
  | "CONFIRMED"
  | "INVALIDATED"
  | "EXPIRED"
  | "INSUFFICIENT"
  | "NO_TRADE"
  | "NOT_PROVIDED";

export interface HfmReasoningDirectionalAssessment {
  side: "BULLISH" | "BEARISH";
  status: HfmScenarioStatus | string;
  summary: string;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  missingConfirmations: string[];
  invalidationConditions: string[];
}

export interface HfmReasoningDeterministicDisagreement {
  /** Whether AI agrees with deterministic ranking guidance (null when ranking unavailable). */
  agreesWithRanking: boolean | null;
  /** Whether AI agrees with deterministic scenario package outcome. */
  agreesWithScenarioOutcome: boolean | null;
  disagreementReason: string | null;
  alternativeEvidenceIds: string[];
}

export interface HfmReasoningConfidenceSemantics {
  decisionConfidenceIsWinProbability: false;
  definition: string;
}

export interface HfmReasoningValidatedResult {
  schemaVersion: typeof HFM_REASONING_SCHEMA_VERSION | string;
  analysisStatus: "COMPLETED" | "COMPLETED_WITH_GAPS";
  provider: "HFM_MT5";
  symbol: string;
  contextId: string;
  snapshotId: string;
  snapshotHash: string;
  promptVersion: typeof HFM_REASONING_PROMPT_VERSION | string;
  model: string;
  analysisId: string;
  marketRegime: string;
  decision: {
    action: HfmReasoningDecisionAction;
    /** Model-reported analytical confidence — NOT win probability. */
    confidence: number;
    confidenceLabel: HfmReasoningConfidenceLabel;
    summary: string;
  };
  decisionStatus: HfmReasoningDecisionStatus;
  selectedScenarioId: string | null;
  bullishAssessment: HfmReasoningDirectionalAssessment;
  bearishAssessment: HfmReasoningDirectionalAssessment;
  supportingEvidenceIds: string[];
  conflictingEvidenceIds: string[];
  missingConfirmations: string[];
  invalidationConditions: string[];
  deterministicDisagreement: HfmReasoningDeterministicDisagreement;
  confidenceSemantics: HfmReasoningConfidenceSemantics;
  unifiedInputIdentity: string | null;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  inputCompleteness: HfmUnifiedInputCompleteness | "UNKNOWN";
  marketOverview: {
    sectionStatus: HfmSectionProvision;
    marketCondition: HfmReasoningMarketCondition;
    overallBias: HfmReasoningBias;
    higherTimeframeBias: string;
    timeframeAlignment: HfmReasoningAlignment;
  };
  timeframeAnalysis: {
    H1: HfmReasoningTfBlock;
    M30: HfmReasoningTfBlock;
    M15: HfmReasoningTfBlock;
    M5: HfmReasoningTfBlock;
  };
  scenarios: {
    bullish: HfmReasoningScenario;
    bearish: HfmReasoningScenario;
  };
  tradePlan: HfmReasoningTradePlan;
  evidence: {
    observedFacts: string[];
    interpretations: string[];
    uncertainties: string[];
    missingData: string[];
    dataQualityWarnings: string[];
  };
  riskAssessment: {
    sectionStatus: HfmSectionProvision;
    riskLevel: HfmRiskLevel;
    reasons: string[];
    reasonsToAvoidTrade: string[];
  };
  nextConfirmation: {
    required: boolean;
    conditions: string[];
    timeframesToWatch: string[];
  };
  completeness: HfmReasoningCompleteness;
  pricePrecision: HfmReasoningPricePrecisionResult;
  disclaimer: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export interface HfmReasoningImageRef {
  timeframe: string;
  imageId: string;
  imageHash: string;
  snapshotId: string;
  snapshotHash: string;
  validationStatus: string;
}

/** Phase 5 lineage for audit / reproduction (hashes + ids; no OHLC/image payloads). */
export interface HfmReasoningLineage {
  unifiedInputIdentity: string | null;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  scenarioIds: string[];
  selectedScenarioId: string | null;
  inputCompleteness: HfmUnifiedInputCompleteness | "UNKNOWN";
  groundingStatus: "PASSED" | "FAILED" | "SKIPPED" | "NOT_APPLICABLE";
  rankingReference: string | null;
}

export interface HfmReasoningRecord {
  analysisId: string;
  contextId: string;
  snapshotId: string;
  snapshotHash: string;
  symbol: string;
  provider: "HFM_MT5";
  status: HfmReasoningJobStatus;
  createdAt: string;
  completedAt: string | null;
  promptVersion: string;
  schemaVersion: string;
  model: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  dataQualityStatus: string | null;
  synchronizationStatus: string | null;
  candleCounts: Record<string, number>;
  imageRefs: HfmReasoningImageRef[];
  lineage: HfmReasoningLineage | null;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    latencyMs: number | null;
  } | null;
  result: HfmReasoningValidatedResult | null;
  /**
   * P8.A — optional linkage to MIF Prediction Outcome snapshot.
   * Present after bridge attempt on COMPLETED analyses; null/absent on older records.
   */
  predictionLinkage?: HfmChartsPredictionLinkage | null;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export type HfmReasoningErrorCode =
  | "CONTEXT_NOT_FOUND"
  | "CONTEXT_NOT_VALID"
  | "PROVIDER_MISMATCH"
  | "SNAPSHOT_HASH_MISMATCH"
  | "SYMBOL_MISMATCH"
  | "TIMEFRAME_DATA_MISSING"
  | "TIMEFRAME_NOT_SYNCHRONIZED"
  | "IMAGE_MISSING"
  | "IMAGE_IDENTITY_MISMATCH"
  | "IMAGE_VALIDATION_FAILED"
  | "OPENAI_NOT_CONFIGURED"
  | "OPENAI_VAULT_LOCKED"
  | "OPENAI_MODEL_UNSUPPORTED"
  | "OPENAI_RATE_LIMITED"
  | "OPENAI_TIMEOUT"
  | "OPENAI_REQUEST_FAILED"
  | "INVALID_MODEL_RESPONSE"
  | "MODEL_RESPONSE_IDENTITY_MISMATCH"
  | "REASONING_JOB_ALREADY_RUNNING"
  | "REASONING_STORAGE_FAILED"
  | "CONTEXT_TOO_OLD"
  | "AI_NOT_APPROVED"
  | "INVALID_CONFIDENCE"
  | "INVALID_PRICE_PRECISION"
  | "INSTRUMENT_METADATA_UNAVAILABLE"
  | "UNIFIED_INPUT_INCOMPLETE"
  | "EVIDENCE_GROUNDING_FAILED"
  | "SCENARIO_GROUNDING_FAILED"
  | "INVENTED_PRICE_REJECTED"
  | "PACKAGE_IDENTITY_MISMATCH";
