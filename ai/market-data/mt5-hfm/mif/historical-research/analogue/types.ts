/**
 * Phase 5F STEP 2 — analogue engine types.
 */
import type {
  MifAnalogueComparisonMode,
  MifAnalogueEligibilityMode,
} from "./contracts.js";

export interface MifAnalogueSafetyFlags {
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  analyticalOnly: true;
  doesNotApproveAiReasoning: true;
  similarityIsNotProbability: true;
}

export const MIF_ANALOGUE_SAFETY: MifAnalogueSafetyFlags = {
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  analyticalOnly: true,
  doesNotApproveAiReasoning: true,
  similarityIsNotProbability: true,
};

export type MifAnalogueExclusionReason =
  | "PROVIDER_NOT_HFM_MT5"
  | "STATUS_INCOMPLETE"
  | "NOT_SUITABLE_FOR_CANDLE_RESEARCH"
  | "MISSING_CONTENT_HASH"
  | "INSUFFICIENT_HISTORY"
  | "INSUFFICIENT_WARMUP"
  | "TIP_NOT_CLOSED"
  | "FUTURE_BARS_IN_WINDOW"
  | "DISQUALIFYING_GAP"
  | "INVALID_OHLC"
  | "CROSS_TF_REJECTED"
  | "CROSS_INSTRUMENT_CROSS_TF_REJECTED"
  | "INSUFFICIENT_COMPARABLE_FEATURES"
  | "MODE_REQUIRES_STRUCTURE"
  | "MODE_REQUIRES_MTF"
  | "MODE_REQUIRES_OUTCOME_WINDOW"
  | "DATASET_HASH_MISMATCH"
  | "ZERO_RANGE_UNSAFE"
  | "CANCELLED"
  | "TIMEOUT"
  | "MAX_CANDIDATES_REACHED"
  | "OVERLAP_SUPPRESSED"
  | "SAME_EVENT_DUPLICATE"
  | "SELF_REFERENCE_EXCLUDED"
  | "OTHER";

export interface MifAnalogueFeatureSlot {
  name: string;
  group: "SHAPE" | "RETURNS" | "VOLATILITY" | "MOMENTUM" | "STRUCTURE" | "CATEGORICAL";
  version: string;
  value: number | null;
  available: boolean;
  unavailableReason: string | null;
  normalization: string;
  inputWindowBars: number;
}

export interface MifAnalogueFeatureVector {
  featureSetId: string;
  featureSetVersion: string;
  continuous: readonly MifAnalogueFeatureSlot[];
  categorical: readonly MifAnalogueFeatureSlot[];
  unavailableFeatures: readonly string[];
  atr: number | null;
  lookbackBars: number;
  warmupBars: number;
}

export interface MifAnalogueQualityAssessment {
  missingInWindow: number;
  gapCount: number;
  insufficientHistory: boolean;
  notes: readonly string[];
}

export interface MifAnalogueReferenceState {
  contractId: "kwizera.mif.historical-analogue.v1";
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  referenceId: string;
  createdAt: string;
  instrument: string;
  timeframe: string;
  tipOpenTimeSec: number;
  datasetId: string;
  datasetVersion: number;
  contentHash: string;
  lookbackBars: number;
  warmupBars: number;
  featureSetId: string;
  featureSetVersion: string;
  eligibilityMode: MifAnalogueEligibilityMode;
  comparisonMode: MifAnalogueComparisonMode;
  multiTimeframe: readonly {
    timeframe: string;
    datasetId: string;
    datasetVersion: number;
    contentHash: string;
    tipOpenTimeSec: number;
  }[];
  quality: MifAnalogueQualityAssessment;
  pitWarnings: readonly string[];
  costWarnings: readonly string[];
  features: MifAnalogueFeatureVector;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  analyticalOnly: true;
  doesNotApproveAiReasoning: true;
  similarityIsNotProbability: true;
}

export interface MifAnalogueScoreContribution {
  name: string;
  group: string;
  weight: number;
  contribution: number;
  available: boolean;
  referenceValue: number | null;
  candidateValue: number | null;
}

export interface MifAnalogueSimilarityResult {
  score: number;
  distance: number;
  algorithmId: string;
  algorithmVersion: string;
  weightTableId: string;
  weightTableVersion: string;
  normalizationPolicyId: string;
  normalizationPolicyVersion: string;
  comparableCoverage: number;
  insufficientComparableFeatures: boolean;
  contributions: readonly MifAnalogueScoreContribution[];
  agreeingFeatures: readonly string[];
  disagreeingFeatures: readonly string[];
  unavailableFeatures: readonly string[];
}

export type MifAnalogueOutcomeCompleteness = "COMPLETE" | "PARTIAL" | "INSUFFICIENT";

export interface MifAnalogueOutcomeHorizon {
  bars: number;
  forwardReturn: number | null;
  direction: "UP" | "DOWN" | "FLAT" | null;
  mfe: number | null;
  mae: number | null;
  completeness: MifAnalogueOutcomeCompleteness;
  gapFlags: readonly string[];
}

export interface MifAnalogueOutcomeAttachment {
  candidateTipOpenTimeSec: number;
  horizons: readonly MifAnalogueOutcomeHorizon[];
  sessionUncertainty: true;
  costUncertainty: true;
  note: string;
  /** Explicit separation from similarity. */
  separatedFromSimilarityScore: true;
  /** STEP 3 probability not implemented. */
  probabilityNotComputed: true;
}

export interface MifAnalogueCandidateRecord {
  analogueId: string;
  instrument: string;
  timeframe: string;
  tipOpenTimeSec: number;
  windowStartOpenTimeSec: number;
  windowEndOpenTimeSec: number;
  datasetId: string;
  datasetVersion: number;
  contentHash: string;
  similarity: MifAnalogueSimilarityResult;
  explanation: {
    selectedBecause: string;
    factualNotes: readonly string[];
    disclaimer: string;
  };
  qualityNotes: readonly string[];
  pitWarnings: readonly string[];
  costWarnings: readonly string[];
  outcome: MifAnalogueOutcomeAttachment | null;
  suppressed: boolean;
  suppressionReason: MifAnalogueExclusionReason | null;
}

export interface MifAnalogueSearchParams {
  eligibilityMode: MifAnalogueEligibilityMode;
  lookbackBars: number;
  warmupBars: number;
  maxDatasets: number;
  maxCandidatesScanned: number;
  maxResults: number;
  stride: number;
  timeoutMs: number;
  minFeatureCoverage: number;
  overlapIouThreshold: number;
  outcomeHorizons: readonly number[];
  allowCrossInstrument: boolean;
  includeStructureFeatures: boolean;
}

export type MifAnalogueSearchStatus =
  | "COMPLETED"
  | "PARTIAL_TIMEOUT"
  | "PARTIAL_TRUNCATED"
  | "CANCELLED"
  | "FAILED"
  | "INSUFFICIENT_HISTORY";

export interface MifAnalogueSearchRecord {
  contractId: "kwizera.mif.historical-analogue.v1";
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  searchId: string;
  searchHash: string;
  createdAt: string;
  status: MifAnalogueSearchStatus;
  statusReason: string | null;
  reference: MifAnalogueReferenceState;
  params: MifAnalogueSearchParams;
  corpus: readonly {
    datasetId: string;
    version: number;
    contentHash: string;
    instrument: string;
    timeframe: string;
  }[];
  policyVersions: {
    featureSetId: string;
    featureSetVersion: string;
    normalizationPolicyId: string;
    normalizationPolicyVersion: string;
    weightTableId: string;
    weightTableVersion: string;
    similarityAlgorithmId: string;
    similarityAlgorithmVersion: string;
    overlapPolicyId: string;
    overlapPolicyVersion: string;
  };
  stats: {
    datasetsConsidered: number;
    datasetsExcluded: number;
    candidatesScanned: number;
    candidatesExcluded: number;
    candidatesScored: number;
    candidatesSuppressed: number;
    resultsReturned: number;
    durationMs: number;
  };
  exclusionSummary: readonly { reason: MifAnalogueExclusionReason; count: number }[];
  analogues: readonly MifAnalogueCandidateRecord[];
  suppressedAnalogues: readonly MifAnalogueCandidateRecord[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  analyticalOnly: true;
  doesNotApproveAiReasoning: true;
  similarityIsNotProbability: true;
  researchReadOnly: true;
}
