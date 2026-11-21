/**
 * Phase 5F STEP 5 Phase B — Research Results types.
 */
import type { MifSafetyFlags } from "../canonical/types.js";
import type {
  MIF_RESEARCH_RESULTS_CONTRACT_ID,
  MIF_RESEARCH_RESULTS_CONTRACT_VERSION,
} from "./contracts.js";

export type MifResearchCalibrationReadinessStatus =
  | "NOT_CALIBRATED"
  | "INSUFFICIENT_DATA";

export interface MifResearchResultFilters {
  symbol?: string | null;
  timeframe?: string | null;
  datasetId?: string | null;
  backtestRunId?: string | null;
}

export interface MifResearchDatasetProvenance {
  datasetId: string;
  version: number;
  contentHash: string;
  instrument: string;
  timeframe: string;
  status: string;
  suitableForCostAdjustedBacktest: boolean;
  pitLimitations: readonly string[];
  costLimitations: readonly string[];
}

export interface MifResearchSymbolTimeframeSummary {
  symbol: string;
  timeframe: string;
  datasetCount: number;
  completeDatasetCount: number;
  incompleteDatasetCount: number;
  /** Descriptive only. */
  descriptiveOnly: true;
}

export interface MifResearchOutcomeDistribution {
  /** Descriptive frequencies — NOT calibrated probabilities. */
  descriptiveOnly: true;
  uniquePredictions: number;
  outcomeRevisionsCountedAsLatestOnly: number;
  completeness: Record<string, number>;
  levelResultKinds: Record<string, number>;
  decisiveTargetReached: number;
  decisiveInvalidationReached: number;
  decisiveDenominator: number;
  excludedNonDecisive: number;
  excludedBreakdown: Record<string, number>;
}

export interface MifResearchLinkageReport {
  analogueSearchCount: number;
  analogueResultCount: number;
  predictionSnapshotCount: number;
  predictionOutcomeCount: number;
  probabilityAssessmentCount: number;
  probabilityFreezeCount: number;
  highTrustFreezeCount: number;
  evidenceLinkageCount: number;
  evidenceLinkageLinkedCount: number;
  evidenceLinkageUnavailableCount: number;
  /** Explicit missing relationships — never invented. */
  missingLinks: readonly string[];
  freezeLinkedToPredictionCount: number;
  assessmentsWithoutFreezeCount: number;
}

export interface MifResearchBacktestSummary {
  runId: string;
  status: string;
  mode: string;
  datasetId: string | null;
  contentHash: string | null;
  costAdjusted: false;
  foldCount: number;
  foldStatuses: Record<string, number>;
  isNotCalibratedProbability: true;
}

export interface MifResearchCalibrationStatusReport {
  status: MifResearchCalibrationReadinessStatus;
  reasons: readonly string[];
  provisionalThreshold: number;
  calibratedThreshold: number;
  frozenAssessmentCount: number;
  decisiveFrozenPairCount: number;
  walkForwardCalibrated: false;
  midSplitScaffoldingNotWfCalibrated: true;
  reliabilityClaimsAllowed: false;
  fabricatedProbabilities: false;
  existingScaffoldingRunCount: number;
  scaffoldingRunsAreNotWalkForwardCalibrated: true;
  claimLabels: readonly string[];
}

export interface MifResearchResultSummary extends MifSafetyFlags {
  contractId: typeof MIF_RESEARCH_RESULTS_CONTRACT_ID;
  contractVersion: typeof MIF_RESEARCH_RESULTS_CONTRACT_VERSION;
  summaryId: string;
  summaryHash: string;
  engineId: string;
  engineVersion: string;
  generatedAt: string;
  filters: MifResearchResultFilters;
  datasets: readonly MifResearchDatasetProvenance[];
  symbolTimeframeSummaries: readonly MifResearchSymbolTimeframeSummary[];
  outcomeDistribution: MifResearchOutcomeDistribution;
  linkage: MifResearchLinkageReport;
  backtests: readonly MifResearchBacktestSummary[];
  calibration: MifResearchCalibrationStatusReport;
  warnings: readonly string[];
  claimLabels: readonly string[];
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  descriptiveResearchOnly: true;
  isNotCalibratedProbability: true;
  costAdjusted: false;
  notExecutable: true;
}
