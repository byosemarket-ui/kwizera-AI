/**
 * Phase 5E Step 3 — AI Market Reasoning types.
 */
import type { MifSafetyFlags } from "../canonical/types.js";
import type {
  MIF_AI_MARKET_REASONING_CONTRACT_ID,
  MIF_AI_MARKET_REASONING_CONTRACT_VERSION,
} from "./contracts.js";

export type MifAiReasoningRunStatus =
  | "SUCCESS"
  | "INSUFFICIENT_CONTEXT"
  | "MODEL_UNAVAILABLE"
  | "MODEL_TIMEOUT"
  | "INVALID_MODEL_OUTPUT"
  | "EVIDENCE_VALIDATION_FAILED"
  | "BLOCKED_BY_DATA_QUALITY"
  | "PARTIAL_RESULT";

export type MifAiScenarioStatus =
  | "ACTIVE"
  | "DEVELOPING"
  | "WAITING_FOR_CONFIRMATION"
  | "CONFIRMED"
  | "INVALIDATED"
  | "LOW_EVIDENCE"
  | "BLOCKED";

export type MifAiEvidenceSupportStatus =
  | "HIGH_EVIDENCE_SUPPORT"
  | "MODERATE_EVIDENCE_SUPPORT"
  | "LOW_EVIDENCE_SUPPORT"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTED"
  | "UNAVAILABLE";

export type MifAiClaimKind =
  | "OBSERVED_FACT"
  | "ENGINE_DERIVED"
  | "HISTORICAL_STATISTICAL"
  | "AI_INTERPRETATION"
  | "HYPOTHESIS"
  | "UNKNOWN";

export interface MifAiReasoningContext {
  contextVersion: string;
  contextIdentity: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  analysisTimestamp: string;
  analysisRunId: string | null;
  primaryTimeframe: string | null;
  dataQualityStatus: string;
  analysisStatus: string;
  mtfRelation: string | null;
  timeframeSnapshots: readonly {
    timeframe: string;
    barCount: number;
    regimeDirection: string | null;
    regimeStructure: string | null;
    tipCandleState: string | null;
  }[];
  availableEvidenceIds: readonly string[];
  evidenceSummaries: readonly {
    evidenceId: string;
    family: string;
    presence: string;
    qualityStatus: string;
    candleState: string | null;
    notes: string;
  }[];
  candidates: readonly {
    candidateId: string;
    strategyId: string;
    direction: string;
    status: string;
    thesis: string;
    supportingEvidenceIds: readonly string[];
    conflictingEvidenceIds: readonly string[];
    invalidationConditions: readonly string[];
    knownLimitations: readonly string[];
  }[];
  ranking: {
    rankingRunId: string | null;
    rankedCount: number;
    top: readonly {
      candidateId: string;
      strategyId: string;
      rankPosition: number | null;
      overallScore: number | null;
      scoreBand: string;
      rankingEligibility: string;
    }[];
    isWinProbability: false;
  } | null;
  probability: {
    assessmentId: string | null;
    candidateId: string | null;
    probability: number | null;
    rawEmpiricalFrequency: number | null;
    sampleStatus: string | null;
    calibrationStatus: string | null;
    reliabilityStatus: string | null;
    targetEvent: string | null;
    isWinProbability: boolean;
    limitations: readonly string[];
  } | null;
  evidenceIntelligence: {
    assessmentId: string | null;
    supportingCount: number;
    contradictingCount: number;
    missing: readonly string[];
    explanation: string | null;
  } | null;
  contextSummary: Record<string, unknown> | null;
  knownLimitations: readonly string[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
}

export interface MifAiScenario {
  side: "BULLISH" | "BEARISH";
  status: MifAiScenarioStatus;
  summary: string;
  supportingEvidenceRefs: readonly string[];
  contradictingEvidenceRefs: readonly string[];
  missingEvidence: readonly string[];
  confirmationConditions: readonly string[];
  invalidationConditions: readonly string[];
  claimKinds: readonly MifAiClaimKind[];
  /** Never invent prices — only echo source refs or LEVELS_NOT_PROVIDED. */
  priceContextStatus: "AVAILABLE_FROM_SOURCE" | "LEVELS_NOT_PROVIDED" | "STALE" | "NOT_APPLICABLE";
  priceContextNotes: readonly string[];
}

export interface MifAiValidatedReasoningOutput {
  marketOverview: string;
  higherTimeframeAnalysis: string;
  intermediateTimeframeAnalysis: string;
  lowerTimeframeAnalysis: string;
  marketStructureAnalysis: string;
  marketRegimeAnalysis: string;
  liquidityAnalysis: string;
  momentumAnalysis: string;
  displacementAnalysis: string;
  patternAnalysis: string;
  opportunityAnalysis: string;
  rankingInterpretation: string;
  probabilityInterpretation: string;
  evidenceSummary: string;
  bullishScenario: MifAiScenario;
  bearishScenario: MifAiScenario;
  scenarioComparison: string;
  confirmationConditions: readonly string[];
  invalidationConditions: readonly string[];
  missingInformation: readonly string[];
  contradictions: readonly string[];
  reasoningConclusion: string;
  reasoningLimitations: readonly string[];
  evidenceSupportStatus: MifAiEvidenceSupportStatus;
  citedEvidenceRefs: readonly string[];
}

export interface MifAiMarketReasoningRun extends MifSafetyFlags {
  contractId: typeof MIF_AI_MARKET_REASONING_CONTRACT_ID;
  contractVersion: typeof MIF_AI_MARKET_REASONING_CONTRACT_VERSION;
  reasoningRunId: string;
  reasoningId: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  analysisRunId: string | null;
  candidateId: string | null;
  rankingRunId: string | null;
  probabilityAssessmentId: string | null;
  analysisTimestamp: string;
  modelIdentifier: string | null;
  promptVersion: string;
  contextVersion: string;
  contextIdentity: string;
  sourceEvidenceRefs: readonly string[];
  status: MifAiReasoningRunStatus;
  validationErrors: readonly string[];
  output: MifAiValidatedReasoningOutput | null;
  rawModelResponseRetained: boolean;
  usage: { promptTokens: number | null; completionTokens: number | null } | null;
  calculatedAt: string;
  completedAt: string;
  disclaimer: string;
  doesNotApproveAiReasoning: true;
  isWinProbability: false;
  isGuaranteedOutcome: false;
  isExecutionApproval: false;
  executionReadiness: false;
  analyticalAiReasoningOnly: true;
  notExecutable: true;
}

/** Injectable chat for tests — production uses openAiChatJson. */
export type MifAiChatJsonFn = (input: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  timeoutMs: number;
}) => Promise<{
  ok: boolean;
  code?: string;
  model?: string | null;
  data?: Record<string, unknown> | null;
  rawText?: string;
  error?: string;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}>;
