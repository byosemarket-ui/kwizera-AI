/**
 * P8.B — Point-in-Time replay integrity types.
 */
import type { MifReplayClipMode } from "../replay-bridge.js";
import type { MifResearchMissingInterval } from "../types.js";
import type {
  MIF_PIT_REPLAY_CONTRACT_ID,
  MIF_PIT_REPLAY_CONTRACT_VERSION,
  MIF_PIT_REPLAY_ENGINE_ID,
  MIF_PIT_REPLAY_ENGINE_VERSION,
  MIF_PIT_REPLAY_MANIFEST_POLICY_ID,
  MIF_PIT_REPLAY_MANIFEST_POLICY_VERSION,
} from "./contracts.js";

export interface MifPitSafetyFlags {
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  researchReadOnly: true;
  doesNotApproveAiReasoning: true;
  notExecutable: true;
}

export interface MifPitDatasetInventoryEntry extends MifPitSafetyFlags {
  datasetId: string;
  version: number;
  instrument: string;
  timeframe: string;
  status: string;
  contentHash: string;
  candleCount: number;
  startTime: number | null;
  endTime: number | null;
  startIso: string | null;
  endIso: string | null;
  suitableForCandleResearch: boolean;
  suitableForCostAdjustedBacktest: boolean;
  hashVerified: boolean;
  countVerified: boolean;
  authoritativeForPitReplay: boolean;
  integrityCode: string | null;
  missingIntervalCount: number;
  missingClassifications: readonly string[];
  sessionUncertainty: boolean;
  incompleteExportRange: boolean;
  blockReasons: readonly string[];
}

export interface MifPitDatasetInventoryReport extends MifPitSafetyFlags {
  contractId: typeof MIF_PIT_REPLAY_CONTRACT_ID;
  contractVersion: typeof MIF_PIT_REPLAY_CONTRACT_VERSION;
  engineId: typeof MIF_PIT_REPLAY_ENGINE_ID;
  engineVersion: typeof MIF_PIT_REPLAY_ENGINE_VERSION;
  generatedAt: string;
  storageRootHint: string;
  registryEntryCount: number;
  scannedCount: number;
  authoritativeCount: number;
  incompleteExcludedCount: number;
  hashFailureCount: number;
  entries: readonly MifPitDatasetInventoryEntry[];
  summaryNote: string;
}

export interface MifPitPriorityTfCell {
  instrument: string;
  timeframe: string;
  present: boolean;
  authoritative: boolean;
  datasetId: string | null;
  version: number | null;
  contentHash: string | null;
  status: string | null;
  candleCount: number | null;
  startTime: number | null;
  endTime: number | null;
  startIso: string | null;
  endIso: string | null;
  missingIntervalCount: number | null;
  sessionUncertainty: boolean | null;
  incompleteExcluded: boolean;
  notes: readonly string[];
}

export interface MifPitPriorityCoverageReport extends MifPitSafetyFlags {
  contractId: typeof MIF_PIT_REPLAY_CONTRACT_ID;
  contractVersion: typeof MIF_PIT_REPLAY_CONTRACT_VERSION;
  generatedAt: string;
  symbols: readonly string[];
  timeframes: readonly string[];
  cells: readonly MifPitPriorityTfCell[];
  mtfOverlap: {
    startTime: number | null;
    endTime: number | null;
    startIso: string | null;
    endIso: string | null;
    limitedBy: string | null;
    sufficientForLongTermPerformanceClaims: false;
    note: string;
  };
  incompleteDatasetsNoted: readonly {
    datasetId: string;
    instrument: string;
    timeframe: string;
    candleCount: number;
    reason: string;
  }[];
  disclaimer: string;
}

export interface MifPitReplayTimeframeBinding {
  timeframe: string;
  datasetId: string;
  version: number;
  contentHash: string;
  candleCount: number;
  startTime: number | null;
  endTime: number | null;
  missingIntervalCount: number;
  missingIntervals: readonly MifResearchMissingInterval[];
  suitableForCandleResearch: true;
  status: "COMPLETE";
}

export interface MifPitReplayInputManifest extends MifPitSafetyFlags {
  contractId: typeof MIF_PIT_REPLAY_CONTRACT_ID;
  contractVersion: typeof MIF_PIT_REPLAY_CONTRACT_VERSION;
  engineId: typeof MIF_PIT_REPLAY_ENGINE_ID;
  engineVersion: typeof MIF_PIT_REPLAY_ENGINE_VERSION;
  manifestPolicyId: typeof MIF_PIT_REPLAY_MANIFEST_POLICY_ID;
  manifestPolicyVersion: typeof MIF_PIT_REPLAY_MANIFEST_POLICY_VERSION;
  manifestId: string;
  contentIdentityHash: string;
  instrument: string;
  primaryTimeframe: string;
  timeframes: readonly MifPitReplayTimeframeBinding[];
  requestedStartTimeSec: number | null;
  requestedEndTimeSec: number | null;
  actualStartTimeSec: number | null;
  actualEndTimeSec: number | null;
  decisionCutoffSec: number;
  clipMode: Extract<MifReplayClipMode, "CLOSE_TIME_AT_DECISION">;
  closeTimeVisibilityPolicyId: string;
  closeTimeVisibilityPolicyVersion: string;
  createdAt: string;
  status: "FROZEN";
  limitations: readonly string[];
}
