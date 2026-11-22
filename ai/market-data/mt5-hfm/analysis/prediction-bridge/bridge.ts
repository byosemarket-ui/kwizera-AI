/**
 * P8.A — thin Charts → MIF Prediction Outcome adapter.
 *
 * For completed BUY/SELL with valid levels: create exactly one immutable
 * MifPredictionSnapshot (idempotent via deterministic predictionId + stable createdAt).
 * NO_TRADE / WAITING: preserve decision, do not create directional predictions.
 */
import type { MifScenarioPackage } from "../../mif/scenario-intelligence/types.js";
import {
  buildPredictionSnapshot,
  getMifPredictionOutcomeStorage,
  isPredictionSnapshotValid,
  type MifPredictionOutcomeStorage,
  type MifPredictionSnapshot,
} from "../../mif/prediction-outcome/index.js";
import type { HfmAnalysisContextResult } from "../types.js";
import type { HfmReasoningRecord } from "../reasoning/types.js";
import {
  HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
  HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION,
  HFM_CHARTS_PREDICTION_BRIDGE_ID,
  HFM_CHARTS_PREDICTION_BRIDGE_VERSION,
  HFM_CHARTS_SOURCE_ANALYSIS_PREFIX,
} from "./contracts.js";
import { extractChartsTradeLevels } from "./map-levels.js";
import { resolveActivationFromContext } from "./resolve-activation.js";
import type {
  HfmChartsPredictionBridgeResult,
  HfmChartsPredictionLinkage,
  HfmChartsPredictionLinkageStatus,
} from "./types.js";

const SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  analyticalOutcomeOnly: true as const,
  doesNotApproveAiReasoning: true as const,
  isNotCalibratedProbability: true as const,
  notExecutable: true as const,
};

function findSetupFingerprint(
  scenarioPackage: MifScenarioPackage | null | undefined,
  scenarioId: string | null,
): string | null {
  if (!scenarioPackage || !scenarioId) return null;
  if (scenarioPackage.bullishScenario?.scenarioId === scenarioId) {
    return scenarioPackage.bullishScenario.setupFingerprint ?? null;
  }
  if (scenarioPackage.bearishScenario?.scenarioId === scenarioId) {
    return scenarioPackage.bearishScenario.setupFingerprint ?? null;
  }
  return null;
}

function makeLinkage(input: {
  status: HfmChartsPredictionLinkageStatus;
  predictionId: string | null;
  snapshotHash: string | null;
  decisionAction: string | null;
  scenarioId: string | null;
  setupFingerprint: string | null;
  evidencePackageId: string | null;
  scenarioPackageId: string | null;
  reason: string | null;
  bridgedAt: string;
}): HfmChartsPredictionLinkage {
  return {
    bridgeContractId: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
    bridgeContractVersion: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION,
    bridgeId: HFM_CHARTS_PREDICTION_BRIDGE_ID,
    bridgeVersion: HFM_CHARTS_PREDICTION_BRIDGE_VERSION,
    status: input.status,
    predictionId: input.predictionId,
    snapshotHash: input.snapshotHash,
    decisionAction: input.decisionAction,
    scenarioId: input.scenarioId,
    setupFingerprint: input.setupFingerprint,
    evidencePackageId: input.evidencePackageId,
    scenarioPackageId: input.scenarioPackageId,
    reason: input.reason,
    bridgedAt: input.bridgedAt,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

function skipResult(
  record: HfmReasoningRecord,
  reason: string,
  extras?: {
    scenarioId?: string | null;
    setupFingerprint?: string | null;
    evidencePackageId?: string | null;
    scenarioPackageId?: string | null;
    decisionAction?: string | null;
  },
): HfmChartsPredictionBridgeResult {
  const bridgedAt = new Date().toISOString();
  const linkage = makeLinkage({
    status: "SKIPPED",
    predictionId: null,
    snapshotHash: null,
    decisionAction: extras?.decisionAction ?? record.result?.decision?.action ?? null,
    scenarioId: extras?.scenarioId ?? record.result?.selectedScenarioId ?? record.lineage?.selectedScenarioId ?? null,
    setupFingerprint: extras?.setupFingerprint ?? null,
    evidencePackageId:
      extras?.evidencePackageId
      ?? record.result?.evidencePackageId
      ?? record.lineage?.evidencePackageId
      ?? null,
    scenarioPackageId:
      extras?.scenarioPackageId
      ?? record.result?.scenarioPackageId
      ?? record.lineage?.scenarioPackageId
      ?? null,
    reason,
    bridgedAt,
  });
  return {
    contractId: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
    contractVersion: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION,
    bridgeId: HFM_CHARTS_PREDICTION_BRIDGE_ID,
    bridgeVersion: HFM_CHARTS_PREDICTION_BRIDGE_VERSION,
    analysisId: record.analysisId,
    snapshotId: record.snapshotId,
    status: "SKIPPED",
    predictionId: null,
    snapshot: null,
    created: false,
    linkage,
    reason,
    ...SAFETY,
  };
}

function failResult(
  record: HfmReasoningRecord,
  reason: string,
  snapshot: MifPredictionSnapshot | null = null,
): HfmChartsPredictionBridgeResult {
  const bridgedAt = new Date().toISOString();
  const linkage = makeLinkage({
    status: "FAILED",
    predictionId: snapshot?.predictionId ?? null,
    snapshotHash: snapshot?.snapshotHash ?? null,
    decisionAction: record.result?.decision?.action ?? null,
    scenarioId: record.result?.selectedScenarioId ?? null,
    setupFingerprint: null,
    evidencePackageId: record.result?.evidencePackageId ?? null,
    scenarioPackageId: record.result?.scenarioPackageId ?? null,
    reason,
    bridgedAt,
  });
  return {
    contractId: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
    contractVersion: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION,
    bridgeId: HFM_CHARTS_PREDICTION_BRIDGE_ID,
    bridgeVersion: HFM_CHARTS_PREDICTION_BRIDGE_VERSION,
    analysisId: record.analysisId,
    snapshotId: record.snapshotId,
    status: "FAILED",
    predictionId: snapshot?.predictionId ?? null,
    snapshot,
    created: false,
    linkage,
    reason,
    ...SAFETY,
  };
}

export interface BridgeChartsReasoningToPredictionInput {
  record: HfmReasoningRecord;
  /** Charts multi-TF context for activation candle + live provenance. */
  context?: HfmAnalysisContextResult | null;
  /** Optional Phase 4 scenario package for setupFingerprint lineage. */
  scenarioPackage?: MifScenarioPackage | null;
  /** Inject storage for tests. */
  storage?: MifPredictionOutcomeStorage;
  /** Override wall-clock for deterministic tests. */
  bridgedAt?: string;
}

/**
 * Bridge a completed Charts AI reasoning record into an immutable MIF prediction snapshot.
 * Safe to call repeatedly for the same analysisId — identical identity → REUSED.
 */
export async function bridgeChartsReasoningToPrediction(
  input: BridgeChartsReasoningToPredictionInput,
): Promise<HfmChartsPredictionBridgeResult> {
  const record = input.record;
  const bridgedAt = input.bridgedAt ?? new Date().toISOString();

  if (record.status !== "COMPLETED") {
    return skipResult(record, "NOT_COMPLETED");
  }
  const result = record.result;
  if (!result) {
    return skipResult(record, "NO_RESULT");
  }

  const action = String(result.decision?.action || "").toUpperCase();
  const scenarioId = result.selectedScenarioId ?? record.lineage?.selectedScenarioId ?? null;
  const setupFingerprint = findSetupFingerprint(input.scenarioPackage ?? null, scenarioId);
  const evidencePackageId =
    result.evidencePackageId ?? record.lineage?.evidencePackageId ?? null;
  const scenarioPackageId =
    result.scenarioPackageId ?? record.lineage?.scenarioPackageId ?? null;

  if (action === "NO_TRADE") {
    return skipResult(record, "NO_TRADE", {
      decisionAction: action,
      scenarioId,
      setupFingerprint,
      evidencePackageId,
      scenarioPackageId,
    });
  }
  if (action === "WAITING_FOR_CONFIRMATION" || action === "WAITING") {
    return skipResult(record, "WAITING", {
      decisionAction: action,
      scenarioId,
      setupFingerprint,
      evidencePackageId,
      scenarioPackageId,
    });
  }
  if (action !== "BUY" && action !== "SELL") {
    return skipResult(record, "NO_TRADE", {
      decisionAction: action,
      scenarioId,
      setupFingerprint,
      evidencePackageId,
      scenarioPackageId,
    });
  }

  const levelsResult = extractChartsTradeLevels(result);
  if (!levelsResult.ok) {
    return skipResult(record, levelsResult.code, {
      decisionAction: action,
      scenarioId,
      setupFingerprint,
      evidencePackageId,
      scenarioPackageId,
    });
  }

  const activationResult = resolveActivationFromContext(
    input.context ?? null,
    record.symbol,
  );
  if (!activationResult.ok) {
    return skipResult(record, activationResult.code, {
      decisionAction: action,
      scenarioId,
      setupFingerprint,
      evidencePackageId,
      scenarioPackageId,
    });
  }
  const { activation } = activationResult;

  // candidateId prefers scenarioId for lineage; falls back to analysis-scoped id.
  const candidateId =
    (scenarioId && String(scenarioId).trim())
    || (setupFingerprint && `fp:${setupFingerprint}`)
    || `charts-analysis:${record.analysisId}`;

  const sourceAnalysisIdentity = `${HFM_CHARTS_SOURCE_ANALYSIS_PREFIX}${record.analysisId}`;
  // Stable createdAt from analysis completion — required for idempotent snapshotHash.
  const createdAt = record.completedAt || record.createdAt || bridgedAt;

  const snapshot = buildPredictionSnapshot({
    candidateId,
    // Do not put Charts analysisId into MIF reasoningRunId namespace.
    reasoningRunId: null,
    evaluationId: null,
    analysisRunId: record.analysisId,
    activationOpenTimeSec: activation.activationOpenTimeSec,
    activationTimestamp: createdAt,
    instrument: activation.providerSymbol,
    timeframe: activation.timeframe,
    direction: action,
    entryPrice: levelsResult.levels.entryPrice,
    targetPrice: levelsResult.levels.takeProfit,
    invalidationPrice: levelsResult.levels.invalidationPrice,
    // Prefer structured invalidation; also retain textual conditions for evidence.
    invalidationConditions: result.invalidationConditions ?? [],
    requiredConfirmations: result.missingConfirmations ?? [],
    thesis: result.decision?.summary ?? null,
    rationale: result.tradePlan?.explanation ?? null,
    modelVersion: record.model ?? result.model ?? null,
    strategyVersion: record.promptVersion ?? null,
    strategyId: "hfm-charts-analyze",
    detectorId: setupFingerprint,
    sourceAnalysisIdentity,
    marketProvenance: {
      mode: "LIVE_COPYRATES",
      providerId: "HFM_MT5",
      sourceProvenance: "hfm-charts-analysis",
      snapshotId: record.snapshotId,
      sequenceId: record.analysisId,
      sourceMode: "CHARTS_ANALYZE",
    },
    referenceCandle: {
      openTimeSec: activation.activationOpenTimeSec,
      close: activation.close,
      timeframe: activation.timeframe,
      providerSymbol: activation.providerSymbol,
    },
    createdAt,
  });

  if (!isPredictionSnapshotValid(snapshot)) {
    return failResult(
      record,
      snapshot.invalidReason ?? "SNAPSHOT_INVALID",
      snapshot,
    );
  }

  const storage = input.storage ?? getMifPredictionOutcomeStorage();
  let persisted: { ok: true; created: boolean } | { ok: false; code: string; message: string };
  try {
    persisted = await storage.persistSnapshot(snapshot);
  } catch (err) {
    return failResult(
      record,
      `PERSIST_FAILED:${err instanceof Error ? err.message : String(err)}`.slice(0, 200),
      snapshot,
    );
  }

  if (!persisted.ok) {
    // Immutable conflict on identical predictionId with different hash is a real failure.
    // If an existing snapshot for this predictionId already matches, treat as reuse.
    if (persisted.code === "SNAPSHOT_IMMUTABLE_CONFLICT") {
      const existing = await storage.getSnapshot(snapshot.predictionId);
      if (existing && existing.snapshotHash === snapshot.snapshotHash) {
        const linkage = makeLinkage({
          status: "REUSED",
          predictionId: existing.predictionId,
          snapshotHash: existing.snapshotHash,
          decisionAction: action,
          scenarioId,
          setupFingerprint,
          evidencePackageId,
          scenarioPackageId,
          reason: null,
          bridgedAt,
        });
        return {
          contractId: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
          contractVersion: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION,
          bridgeId: HFM_CHARTS_PREDICTION_BRIDGE_ID,
          bridgeVersion: HFM_CHARTS_PREDICTION_BRIDGE_VERSION,
          analysisId: record.analysisId,
          snapshotId: record.snapshotId,
          status: "REUSED",
          predictionId: existing.predictionId,
          snapshot: existing,
          created: false,
          linkage,
          reason: null,
          ...SAFETY,
        };
      }
      return failResult(record, "PERSIST_CONFLICT", snapshot);
    }
    return failResult(record, persisted.code || "PERSIST_FAILED", snapshot);
  }

  const status: HfmChartsPredictionLinkageStatus = persisted.created ? "CREATED" : "REUSED";
  const linkage = makeLinkage({
    status,
    predictionId: snapshot.predictionId,
    snapshotHash: snapshot.snapshotHash,
    decisionAction: action,
    scenarioId,
    setupFingerprint,
    evidencePackageId,
    scenarioPackageId,
    reason: null,
    bridgedAt,
  });

  return {
    contractId: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_ID,
    contractVersion: HFM_CHARTS_PREDICTION_BRIDGE_CONTRACT_VERSION,
    bridgeId: HFM_CHARTS_PREDICTION_BRIDGE_ID,
    bridgeVersion: HFM_CHARTS_PREDICTION_BRIDGE_VERSION,
    analysisId: record.analysisId,
    snapshotId: record.snapshotId,
    status,
    predictionId: snapshot.predictionId,
    snapshot,
    created: persisted.created,
    linkage,
    reason: null,
    ...SAFETY,
  };
}

/**
 * Attach linkage onto a reasoning record without dropping the original analysis.
 * Bridge failures never mutate decision/result — only predictionLinkage.
 */
export function applyPredictionLinkage(
  record: HfmReasoningRecord,
  bridgeResult: HfmChartsPredictionBridgeResult,
): HfmReasoningRecord {
  return {
    ...record,
    predictionLinkage: bridgeResult.linkage,
  };
}
