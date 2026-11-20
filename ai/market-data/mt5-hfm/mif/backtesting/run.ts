/**
 * Phase 5F STEP 4 — top-level backtest / walk-forward runner.
 */
import { createHash } from "node:crypto";
import type { MifHistoricalResearchStorage } from "../historical-research/storage.js";
import {
  MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
  MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
} from "../prediction-outcome/contracts.js";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  buildCostAvailabilityReport,
  buildGrossOhlcAssumptions,
} from "./assumptions.js";
import { runChronologicalBacktestBridge } from "./bridge.js";
import {
  MIF_BACKTEST_CONTRACT_ID,
  MIF_BACKTEST_CONTRACT_VERSION,
  MIF_BACKTEST_DEFAULT_MIN_OOS_SAMPLES,
  MIF_BACKTEST_DEFAULT_PRIMARY_METRIC,
  MIF_BACKTEST_ENGINE_ID,
  MIF_BACKTEST_ENGINE_VERSION,
  MIF_BACKTEST_EXECUTION_MODEL_ID,
  MIF_BACKTEST_EXECUTION_MODEL_VERSION,
  MIF_WALK_FORWARD_POLICY_ID,
  MIF_WALK_FORWARD_POLICY_VERSION,
  type MifBacktestPrimaryMetric,
} from "./contracts.js";
import { buildGrossUnitLedger } from "./ledger.js";
import { aggregateBacktestMetrics, emptyMetrics } from "./metrics.js";
import type { MifBacktestStorage } from "./persistence.js";
import type {
  MifBacktestFoldResult,
  MifBacktestRunManifest,
  MifBacktestRunRecord,
  MifBacktestTipPrediction,
} from "./types.js";
import {
  planRollingWalkForward,
  selectFoldTipIndices,
} from "./walk-forward.js";

export interface RunMifBacktestInput {
  researchStorage: MifHistoricalResearchStorage;
  backtestStorage?: MifBacktestStorage;
  datasetId: string;
  version?: number;
  expectedContentHash?: string | null;
  mode?: "SINGLE_WINDOW" | "WALK_FORWARD";
  warmupBars?: number;
  maxSteps?: number;
  stepBars?: number;
  maxFolds?: number;
  minOosSamples?: number;
  primaryMetric?: MifBacktestPrimaryMetric;
  horizons?: readonly number[];
  timeoutMs?: number;
  persist?: boolean;
  useValidation?: boolean;
}

function safety() {
  return {
    placesOrders: false as const,
    mutatesBroker: false as const,
    acceptsForExecution: false as const,
    analyticalOutcomeOnly: true as const,
    doesNotApproveAiReasoning: true as const,
    isNotCalibratedProbability: true as const,
    costAdjusted: false as const,
    notExecutable: true as const,
    executionModel: MIF_BACKTEST_EXECUTION_MODEL_ID,
  };
}

function primaryValue(
  metric: MifBacktestPrimaryMetric,
  tips: readonly MifBacktestTipPrediction[],
  ledgerExpectancy: number | null,
): number | null {
  const outcomes = tips
    .filter((t) => t.outcome && !t.skippedDuplicate)
    .map((t) => t.outcome!);
  const agg = aggregateBacktestMetrics(outcomes);
  if (metric === "OOS_LEVEL_TARGET_RATE") return agg.targetRate.value;
  if (metric === "OOS_PATH_FORWARD_RETURN_MEAN_H8") {
    return agg.pathForwardReturnMeanH8.value;
  }
  if (metric === "OOS_GROSS_UNIT_EXPECTANCY") return ledgerExpectancy;
  return null;
}

function decisiveCount(tips: readonly MifBacktestTipPrediction[]): number {
  return tips.filter(
    (t) =>
      t.outcome
      && !t.skippedDuplicate
      && ["TARGET_REACHED", "INVALIDATION_REACHED"].includes(
        t.outcome.levelOutcome.resultKind,
      ),
  ).length;
}

export async function runMifBacktest(
  input: RunMifBacktestInput,
): Promise<
  | { ok: true; record: MifBacktestRunRecord; persisted: boolean }
  | { ok: false; code: string; message: string }
> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const mode = input.mode ?? "WALK_FORWARD";
  const primaryMetric = input.primaryMetric ?? MIF_BACKTEST_DEFAULT_PRIMARY_METRIC;
  const minOos = input.minOosSamples ?? MIF_BACKTEST_DEFAULT_MIN_OOS_SAMPLES;

  const bridge = await runChronologicalBacktestBridge({
    researchStorage: input.researchStorage,
    datasetId: input.datasetId,
    version: input.version,
    expectedContentHash: input.expectedContentHash,
    warmupBars: input.warmupBars,
    maxSteps: mode === "SINGLE_WINDOW" ? input.maxSteps : Math.min(200, input.maxSteps ?? 80),
    stepBars: input.stepBars,
    horizons: input.horizons,
    timeoutMs: input.timeoutMs,
    startedAtMs: t0,
  });
  if (!bridge.ok) {
    return { ok: false, code: bridge.code, message: bridge.message };
  }

  const tipIndexByTime = new Map<number, number>();
  bridge.bars.forEach((b, i) => tipIndexByTime.set(b.time, i));

  const allTipIndices = [
    ...new Set(
      bridge.tips.map((t) => tipIndexByTime.get(t.tipOpenTimeSec)).filter(
        (x): x is number => x != null,
      ),
    ),
  ].sort((a, b) => a - b);
  const tipOpenTimesByIndex = new Map<number, number>();
  for (const i of allTipIndices) {
    tipOpenTimesByIndex.set(i, bridge.bars[i]!.time);
  }

  const folds: MifBacktestFoldResult[] = [];
  let status: MifBacktestRunManifest["status"] = "COMPLETE";
  let failureReason: string | null = null;

  if (mode === "WALK_FORWARD") {
    const plan = planRollingWalkForward({
      barCount: bridge.bars.length,
      warmupBars: input.warmupBars ?? 40,
      maxFolds: input.maxFolds,
      maxHorizonBars: Math.max(...(input.horizons ?? [16])),
      timeframe: bridge.primaryTimeframe,
      useValidation: input.useValidation,
    });
    if (!plan.folds.length) {
      status = "INSUFFICIENT_SAMPLE";
      failureReason = plan.limitation ?? "NO_FOLDS";
    }

    for (const fold of plan.folds) {
      const oosSel = selectFoldTipIndices({
        fold,
        allTipIndices,
        tipOpenTimesByIndex,
        forSegment: "OOS",
        nextSegmentStartIndex: null,
        horizonBars: plan.horizonBars,
      });
      const oosTimes = new Set(
        oosSel.tipIndices.map((i) => tipOpenTimesByIndex.get(i)!),
      );
      const oosTips = bridge.tips.filter(
        (t) => oosTimes.has(t.tipOpenTimeSec) && !t.skippedDuplicate,
      );
      const oosOutcomes = oosTips
        .filter((t) => t.outcome)
        .map((t) => t.outcome!);
      const oosMetrics = aggregateBacktestMetrics(oosOutcomes);
      const oosLedger = buildGrossUnitLedger({ tips: oosTips });
      const decisive = decisiveCount(oosTips);
      const foldStatus =
        decisive >= minOos
          ? "COMPLETE"
          : oosTips.length === 0
            ? "FAILED"
            : "INSUFFICIENT_SAMPLE";

      const isInterval = {
        label: "IS" as const,
        startOpenTimeSec: bridge.bars[fold.isStartIndex]?.time ?? 0,
        endOpenTimeSec: bridge.bars[Math.max(fold.isStartIndex, fold.isEndIndex - 1)]?.time ?? 0,
        tipCount: fold.isEndIndex - fold.isStartIndex,
      };
      const valInterval =
        fold.valStartIndex != null && fold.valEndIndex != null
          ? {
              label: "VAL" as const,
              startOpenTimeSec: bridge.bars[fold.valStartIndex]?.time ?? 0,
              endOpenTimeSec:
                bridge.bars[Math.max(fold.valStartIndex, fold.valEndIndex - 1)]?.time ?? 0,
              tipCount: fold.valEndIndex - fold.valStartIndex,
            }
          : null;
      const oosInterval = {
        label: "OOS" as const,
        startOpenTimeSec: bridge.bars[fold.oosStartIndex]?.time ?? 0,
        endOpenTimeSec:
          bridge.bars[Math.max(fold.oosStartIndex, fold.oosEndIndex - 1)]?.time ?? 0,
        tipCount: fold.oosEndIndex - fold.oosStartIndex,
      };

      // Capture IS purge exclusions for evidence (selection isolation)
      const isSel = selectFoldTipIndices({
        fold,
        allTipIndices,
        tipOpenTimesByIndex,
        forSegment: "IS",
        nextSegmentStartIndex: fold.oosStartIndex,
        horizonBars: plan.horizonBars,
      });

      folds.push({
        foldIndex: fold.foldIndex,
        status: foldStatus,
        failureReason:
          foldStatus === "INSUFFICIENT_SAMPLE"
            ? `decisiveOos=${decisive} < min=${minOos}`
            : foldStatus === "FAILED"
              ? "NO_OOS_TIPS"
              : null,
        is: isInterval,
        val: valInterval,
        oos: oosInterval,
        purgeBars: fold.purgeBars,
        embargoBars: fold.embargoBars,
        eligibleOosPredictions: oosTips.length,
        decisiveOosSamples: decisive,
        minOosSamplesRequired: minOos,
        exclusions: [
          ...oosSel.exclusions.map((e) => ({
            tipOpenTimeSec: e.tipOpenTimeSec,
            predictionId: null,
            reason: e.reason,
          })),
          ...isSel.exclusions.map((e) => ({
            tipOpenTimeSec: e.tipOpenTimeSec,
            predictionId: null,
            reason: `IS_${e.reason}`,
          })),
        ],
        oosMetrics,
        oosLedger,
        primaryMetric,
        primaryMetricValue: primaryValue(primaryMetric, oosTips, oosLedger.grossExpectancy),
      });
    }

    if (folds.length && folds.every((f) => f.status !== "COMPLETE")) {
      status = "INSUFFICIENT_SAMPLE";
      failureReason = "ALL_FOLDS_INSUFFICIENT_OR_FAILED";
    } else if (folds.some((f) => f.status === "INSUFFICIENT_SAMPLE")) {
      status = "PARTIAL";
    }
  }

  const allOutcomes = bridge.tips
    .filter((t) => t.outcome && !t.skippedDuplicate)
    .map((t) => t.outcome!);
  const aggregateMetrics =
    mode === "WALK_FORWARD" && folds.length
      ? aggregateBacktestMetrics(
          folds.flatMap((f) =>
            bridge.tips
              .filter(
                (t) =>
                  t.tipOpenTimeSec >= f.oos.startOpenTimeSec
                  && t.tipOpenTimeSec <= f.oos.endOpenTimeSec
                  && t.outcome
                  && !t.skippedDuplicate,
              )
              .map((t) => t.outcome!),
          ),
        )
      : aggregateBacktestMetrics(allOutcomes);

  const ledger = buildGrossUnitLedger({ tips: bridge.tips.filter((t) => !t.skippedDuplicate) });

  const assumptions = buildGrossOhlcAssumptions({
    maxHorizonBars: Math.max(...(input.horizons ?? [16])),
  });
  const costAvailability = buildCostAvailabilityReport();

  const runBody = {
    mode,
    datasetId: bridge.datasetId,
    version: bridge.datasetVersion,
    contentHash: bridge.contentHash,
    primaryMetric,
    engineVersion: MIF_BACKTEST_ENGINE_VERSION,
    snapshotPolicyVersion: MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
    evaluatorVersion: MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
    tipPredictionIds: bridge.tips.map((t) => t.predictionId),
  };
  const runHash = createHash("sha256").update(stableSerialize(runBody), "utf8").digest("hex");
  const runId = `bt:${runHash.slice(0, 24)}`;

  const completedAt = new Date().toISOString();
  const manifest: MifBacktestRunManifest = {
    contractId: MIF_BACKTEST_CONTRACT_ID,
    contractVersion: MIF_BACKTEST_CONTRACT_VERSION,
    engineId: MIF_BACKTEST_ENGINE_ID,
    engineVersion: MIF_BACKTEST_ENGINE_VERSION,
    runId,
    runHash,
    createdAt: startedAt,
    completedAt,
    elapsedMs: Date.now() - t0,
    mode,
    dataset: {
      datasetId: bridge.datasetId,
      version: bridge.datasetVersion,
      contentHash: bridge.contentHash,
      instrument: bridge.instrument,
      timeframe: bridge.primaryTimeframe,
      status: "COMPLETE",
    },
    primaryTimeframe: bridge.primaryTimeframe,
    instrument: bridge.instrument,
    executionModelId: MIF_BACKTEST_EXECUTION_MODEL_ID,
    executionModelVersion: MIF_BACKTEST_EXECUTION_MODEL_VERSION,
    walkForwardPolicyId: mode === "WALK_FORWARD" ? MIF_WALK_FORWARD_POLICY_ID : null,
    walkForwardPolicyVersion:
      mode === "WALK_FORWARD" ? MIF_WALK_FORWARD_POLICY_VERSION : null,
    snapshotPolicyVersion: MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
    evaluatorVersion: MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
    strategyVersionPin: null,
    detectorVersionPin: null,
    primaryMetric,
    costAvailability,
    assumptions,
    limitations: [
      ...bridge.limitations,
      "Sharpe/Sortino unsupported without defensible periodic returns",
      "Gross results are not cost-adjusted broker performance",
    ],
    truncatedByMaxCandles: bridge.truncatedByMaxCandles,
    truncatedByMaxSteps: bridge.truncatedByMaxSteps,
    mtfClosureFilterApplied: true,
    tipCount: new Set(bridge.tips.map((t) => t.tipOpenTimeSec)).size,
    predictionCount: bridge.tips.filter((t) => !t.skippedDuplicate).length,
    folds,
    aggregateMetrics: mode === "SINGLE_WINDOW" ? aggregateMetrics : aggregateMetrics,
    ledger,
    status: mode === "SINGLE_WINDOW"
      ? bridge.tips.length
        ? "COMPLETE"
        : "INSUFFICIENT_SAMPLE"
      : status,
    failureReason: mode === "SINGLE_WINDOW"
      ? bridge.tips.length
        ? null
        : "NO_PREDICTIONS"
      : failureReason,
    ...safety(),
  };

  // Ensure emptyMetrics path referenced for folds with no tips
  if (!folds.length && mode === "WALK_FORWARD") {
    void emptyMetrics;
  }

  const record: MifBacktestRunRecord = {
    manifest,
    tips: bridge.tips,
    levelOutcomes: allOutcomes.map((o) => o.levelOutcome),
  };

  let persisted = false;
  if (input.persist !== false && input.backtestStorage) {
    const p = await input.backtestStorage.persistRun(record);
    if (!p.ok) {
      return { ok: false, code: p.code, message: p.message };
    }
    persisted = p.created;
  }

  return { ok: true, record, persisted };
}
