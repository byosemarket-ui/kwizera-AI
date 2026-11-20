/**
 * Phase 5F STEP 1 — historical research types.
 */
import type { HfmHistoricalBar } from "../../historical-engine.js";
import type {
  MifResearchCostAvailability,
  MifResearchDatasetStatus,
  MifResearchExportJobStatus,
} from "./contracts.js";

export interface MifResearchMissingInterval {
  fromOpenTimeSec: number;
  toOpenTimeSec: number;
  expectedBars: number;
  classification: "POSSIBLE_GAP" | "UNKNOWN_SESSION_GAP" | "INCOMPLETE_EXPORT_RANGE";
}

export interface MifResearchQualitySummary {
  validCandles: number;
  rejectedCandles: number;
  duplicateOrOutOfOrderRejected: number;
  invalidOhlcRejected: number;
  missingIntervals: readonly MifResearchMissingInterval[];
  incompleteExportRange: boolean;
  sessionUncertainty: boolean;
  metadataUncertainty: boolean;
  costDataAvailability: MifResearchCostAvailabilityBundle;
  notes: readonly string[];
}

export interface MifResearchCostAvailabilityEntry {
  costType: "spread" | "slippage" | "commission" | "swap";
  availability: MifResearchCostAvailability;
  sourceBackedBarCount?: number;
  totalBarCount?: number;
  limitation: string | null;
}

export interface MifResearchCostAvailabilityBundle {
  spread: MifResearchCostAvailabilityEntry;
  slippage: MifResearchCostAvailabilityEntry;
  commission: MifResearchCostAvailabilityEntry;
  swap: MifResearchCostAvailabilityEntry;
}

export interface MifResearchInclusionRules {
  providerMustBe: "HFM_MT5";
  timeframeMustBeOperationallyExportable: true;
  rejectInvalidOhlc: true;
  rejectDuplicateOrOutOfOrder: true;
  synthesizeCandles: false;
  interpolateGaps: false;
  repairSilently: false;
  allowOtherProviders: false;
  /** Optional inclusive requested window (unix sec open times). */
  requestedStartTimeSec: number | null;
  requestedEndTimeSec: number | null;
  maxBars: number;
  maxPages: number;
}

export interface MifResearchPitInstrumentSpec {
  providerSymbol: string;
  digits: number | null;
  point: number | null;
  tickSize: number | null;
  contractSize: number | null;
  /** Observation/collection time of this metadata snapshot. */
  observedAt: string;
  /** Claimed effective time — null when historical effective time unknown. */
  effectiveAt: string | null;
  availability: MifResearchCostAvailability;
  sourceIdentity: string;
  confidence: "CURRENT_OBSERVATION" | "HISTORICAL_UNKNOWN" | "NONE";
  limitation: string;
}

export interface MifResearchPitSessionMetadata {
  providerSymbol: string;
  sessionsPresent: boolean;
  /**
   * Must remain false unless a verified historical session source exists.
   * Today's catalog observation never sets this true.
   */
  historicalAuthority: boolean;
  observedAt: string;
  effectiveAt: string | null;
  availability: "CURRENT_METADATA_ONLY" | "UNAVAILABLE";
  sourceIdentity: string;
  confidence: "CURRENT_OBSERVATION" | "HISTORICAL_UNKNOWN" | "NONE";
  limitation: string;
  /** Opaque reference to catalog version / path when captured. */
  catalogRef: string | null;
  /** Periods before first durable observation remain unknown. */
  unknownBeforeObservedAt: true;
}

export interface MifResearchPitMetadataBundle {
  instrumentSpec: MifResearchPitInstrumentSpec;
  sessions: MifResearchPitSessionMetadata;
  collectedAt: string;
  /** Forward-looking: observation applies from observedAt onward only. */
  observationCoverage: {
    observedAt: string;
    appliesRetrospectively: false;
    unknownPeriodsNote: string;
  };
}

export interface MifResearchEligibility {
  exportCompleteness: MifResearchDatasetStatus;
  qualityValidity: "QUALITY_VALID" | "QUALITY_DEGRADED";
  metadataAuthority: "HISTORICALLY_AUTHORITATIVE" | "METADATA_LIMITED";
  costCompleteness: "COST_COMPLETE" | "COST_INCOMPLETE";
  suitableForCandleResearch: boolean;
  suitableForCostAdjustedBacktest: boolean;
  suitableForSessionSensitiveResearch: boolean;
  blockReasons: readonly string[];
  notes: readonly string[];
}

export interface MifResearchExportProvenance {
  exportJobId: string;
  pagesFetched: number;
  lastStartPos: number;
  nextStartPos: number | null;
  requestedCountPerPage: number;
  returnedBarTotal: number;
  hasMoreAtStop: boolean;
  incompleteReason: string | null;
  sourceFreshnessNotes: readonly string[];
  fetchErrors: readonly string[];
}

export interface MifResearchDatasetManifest {
  contractId: "kwizera.mif.historical-research.v1";
  contractVersion: string;
  engineId: string;
  engineVersion: string;
  datasetId: string;
  version: number;
  status: MifResearchDatasetStatus;
  provider: "HFM_MT5";
  instrument: string;
  timeframe: string;
  timebase: "BROKER_SERVER";
  startTime: number | null;
  endTime: number | null;
  candleCount: number;
  sourceSnapshotId: string | null;
  qualitySummary: MifResearchQualitySummary;
  missingIntervals: readonly MifResearchMissingInterval[];
  inclusionRules: MifResearchInclusionRules;
  createdAt: string;
  contentHash: string;
  metadataRef: string | null;
  pitMetadata: MifResearchPitMetadataBundle;
  exportProvenance: MifResearchExportProvenance;
  barsRelativePath: string;
  researchEligibility: MifResearchEligibility;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  researchReadOnly: true;
}

export interface MifResearchExportJob {
  contractId: "kwizera.mif.historical-research.v1";
  jobId: string;
  status: MifResearchExportJobStatus;
  provider: "HFM_MT5";
  instrument: string;
  timeframe: string;
  requestedStartTimeSec: number | null;
  requestedEndTimeSec: number | null;
  maxPages: number;
  maxBars: number;
  pagesFetched: number;
  nextStartPos: number;
  barsAccepted: number;
  barsRejected: number;
  returnedRangeStart: number | null;
  returnedRangeEnd: number | null;
  hasMore: boolean;
  incompleteReason: string | null;
  datasetId: string | null;
  datasetVersion: number | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  errors: readonly string[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  researchReadOnly: true;
  autoWorker: false;
}

/** Durable stored bar — preserves source fields; never synthesized. */
export interface MifResearchStoredBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
  validationStatus: "ok";
  provenance: "native" | "cached";
  timebase: "BROKER_SERVER";
}

export type MifResearchBarLike = HfmHistoricalBar | MifResearchStoredBar;

export interface MifResearchRegistryEntry {
  datasetId: string;
  version: number;
  instrument: string;
  timeframe: string;
  status: MifResearchDatasetStatus;
  contentHash: string;
  candleCount: number;
  startTime: number | null;
  endTime: number | null;
  createdAt: string;
  manifestRelativePath: string;
  suitableForCandleResearch?: boolean;
  suitableForCostAdjustedBacktest?: boolean;
  costCompleteness?: "COST_COMPLETE" | "COST_INCOMPLETE";
}
