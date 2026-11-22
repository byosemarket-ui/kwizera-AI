/**
 * P8.A — Charts → MIF prediction bridge types.
 */
import type {
  HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
  HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION,
  HFM_CHARTS_PREDICTION_BRIDGE_ID,
  HFM_CHARTS_PREDICTION_BRIDGE_VERSION,
  HFM_CHARTS_PREDICTION_BRIDGE_SKIP_REASONS,
} from "./contracts.js";
import type { MifPredictionSnapshot } from "../../mif/prediction-outcome/types.js";

export type HfmChartsPredictionBridgeSkipReason =
  (typeof HFM_CHARTS_PREDICTION_BRIDGE_SKIP_REASONS)[number];

export type HfmChartsPredictionLinkageStatus =
  | "CREATED"
  | "REUSED"
  | "SKIPPED"
  | "FAILED";

/**
 * Persisted on HfmReasoningRecord after bridge attempt.
 * Does not replace the analysis record; additive lineage only.
 */
export interface HfmChartsPredictionLinkage {
  bridgeContractId: typeof HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID;
  bridgeContractVersion: typeof HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION;
  bridgeId: typeof HFM_CHARTS_PREDICTION_BRIDGE_ID;
  bridgeVersion: typeof HFM_CHARTS_PREDICTION_BRIDGE_VERSION;
  status: HfmChartsPredictionLinkageStatus;
  predictionId: string | null;
  snapshotHash: string | null;
  decisionAction: string | null;
  scenarioId: string | null;
  setupFingerprint: string | null;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  reason: HfmChartsPredictionBridgeSkipReason | string | null;
  bridgedAt: string;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

export interface HfmChartsPredictionBridgeSafety {
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  analyticalOutcomeOnly: true;
  doesNotApproveAiReasoning: true;
  isNotCalibratedProbability: true;
  notExecutable: true;
}

export interface HfmChartsPredictionBridgeResult extends HfmChartsPredictionBridgeSafety {
  contractId: typeof HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID;
  contractVersion: typeof HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION;
  bridgeId: typeof HFM_CHARTS_PREDICTION_BRIDGE_ID;
  bridgeVersion: typeof HFM_CHARTS_PREDICTION_BRIDGE_VERSION;
  analysisId: string;
  snapshotId: string;
  status: HfmChartsPredictionLinkageStatus;
  predictionId: string | null;
  snapshot: MifPredictionSnapshot | null;
  created: boolean;
  linkage: HfmChartsPredictionLinkage;
  reason: HfmChartsPredictionBridgeSkipReason | string | null;
}

export interface HfmChartsResolvedLevels {
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  invalidationPrice: number;
}

export interface HfmChartsActivationBoundary {
  activationOpenTimeSec: number;
  timeframe: string;
  close: number | null;
  providerSymbol: string;
}
