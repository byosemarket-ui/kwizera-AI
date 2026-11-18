/**
 * Phase 3 — HFM AI Reasoning types (no execution authority).
 */
import type {
  HFM_REASONING_PROMPT_VERSION,
  HFM_REASONING_SCHEMA_VERSION,
} from "./constants.js";

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

export type HfmReasoningMarketCondition =
  | "TRENDING"
  | "RANGING"
  | "VOLATILE"
  | "UNCLEAR";

export type HfmReasoningBias =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL"
  | "MIXED";

export type HfmReasoningAlignment =
  | "ALIGNED"
  | "PARTIALLY_ALIGNED"
  | "CONFLICTING"
  | "UNCLEAR";

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

export type HfmRiskLevel = "LOW" | "MODERATE" | "HIGH" | "UNACCEPTABLE";

export interface HfmReasoningTfBlock {
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

export interface HfmReasoningValidatedResult {
  schemaVersion: typeof HFM_REASONING_SCHEMA_VERSION | string;
  analysisStatus: "COMPLETED";
  provider: "HFM_MT5";
  symbol: string;
  contextId: string;
  snapshotId: string;
  snapshotHash: string;
  promptVersion: typeof HFM_REASONING_PROMPT_VERSION | string;
  model: string;
  decision: {
    action: HfmReasoningDecisionAction;
    confidence: number;
    confidenceLabel: HfmReasoningConfidenceLabel;
    summary: string;
  };
  marketOverview: {
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
    riskLevel: HfmRiskLevel;
    reasons: string[];
    reasonsToAvoidTrade: string[];
  };
  nextConfirmation: {
    required: boolean;
    conditions: string[];
    timeframesToWatch: string[];
  };
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
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    latencyMs: number | null;
  } | null;
  result: HfmReasoningValidatedResult | null;
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
  | "AI_NOT_APPROVED";
