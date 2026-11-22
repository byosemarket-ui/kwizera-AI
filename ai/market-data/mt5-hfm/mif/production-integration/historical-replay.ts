/**
 * Phase 5D.7 — bounded deterministic historical replay / backtesting foundation.
 *
 * Replays HFM_MT5 historical candles chronologically through the same production
 * series pipeline. Detectors only see data available at the simulated tip.
 * Separated from live production outcomes (resultNamespace=HISTORICAL_REPLAY).
 * No order execution. Resource-bounded (maxSteps, maxCandlesPerStep).
 */
import { createHash } from "node:crypto";
import type { HfmHistoricalBar } from "../../historical-engine.js";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  filterBarsClosedAtDecision,
  resolveDecisionTimeSec,
} from "./mtf-visibility.js";
// P8.B: close-time visibility (filterBarsClosedAtDecision) is mandatory for every tip.
// Open-time-only clipping must never be the sole MTF Point-in-Time gate.
import {
  MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
  MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION,
} from "./contracts.js";
import {
  runMifHfmOpportunityPipelineFromSeries,
} from "./run-pipeline.js";
import type {
  MifProductionIntegrationResult,
  MifProductionPipelineFromSeriesInput,
} from "./types.js";

export const MIF_HISTORICAL_REPLAY_CONTRACT_ID =
  "kwizera.mif.historical-replay.v1" as const;
export const MIF_HISTORICAL_REPLAY_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_HISTORICAL_REPLAY_ENGINE_ID = "mif-historical-replay" as const;
export const MIF_HISTORICAL_REPLAY_ENGINE_VERSION = "1.0.0" as const;

/** Hard caps to protect VPS resources. */
export const MIF_REPLAY_MAX_STEPS = 200 as const;
export const MIF_REPLAY_MAX_CANDLES = 500 as const;
export const MIF_REPLAY_MIN_WARMUP = 40 as const;

export interface MifHistoricalReplaySeriesInput {
  timeframe: string;
  bars: readonly HfmHistoricalBar[];
}

export interface MifHistoricalReplayInput {
  providerSymbol: string;
  primaryTimeframe: string;
  series: readonly MifHistoricalReplaySeriesInput[];
  /** Inclusive start — bar.time (unix sec). */
  fromTimeSec?: number | null;
  /** Inclusive end — bar.time (unix sec). */
  toTimeSec?: number | null;
  /** Bars required before first detection step. */
  warmupBars?: number;
  /** Max detection steps after warmup. */
  maxSteps?: number;
  /** Step every N closed bars (default 1). */
  stepBars?: number;
  requestIdPrefix?: string;
  assessmentTimestamp?: string;
}

export interface MifHistoricalReplayStepResult {
  stepIndex: number;
  tipOpenTimeSec: number;
  candleCount: number;
  analysisStatus: string;
  candidateCount: number;
  requestId: string;
  /** Compact — full result not retained per step to bound memory. */
  candidateIds: readonly string[];
  failureCodes: readonly string[];
}

export interface MifHistoricalReplayRun {
  contractId: typeof MIF_HISTORICAL_REPLAY_CONTRACT_ID;
  contractVersion: typeof MIF_HISTORICAL_REPLAY_CONTRACT_VERSION;
  engineId: typeof MIF_HISTORICAL_REPLAY_ENGINE_ID;
  engineVersion: typeof MIF_HISTORICAL_REPLAY_ENGINE_VERSION;
  resultNamespace: "HISTORICAL_REPLAY";
  runId: string;
  inputIdentity: string;
  providerId: "HFM_MT5";
  providerSymbol: string;
  primaryTimeframe: string;
  fromTimeSec: number | null;
  toTimeSec: number | null;
  warmupBars: number;
  maxSteps: number;
  stepBars: number;
  startedAt: string;
  completedAt: string;
  stepsExecuted: number;
  steps: readonly MifHistoricalReplayStepResult[];
  dataCoverage: {
    primaryBarCount: number;
    barsInRange: number;
    missingIntervalsDetected: number;
    truncatedByMaxSteps: boolean;
    truncatedByMaxCandles: boolean;
  };
  reproducibility: {
    identicalInputsYieldEquivalentOutputs: true;
    versionsRecorded: true;
  };
  policyVersions: {
    productionContractId: string;
    productionContractVersion: string;
  };
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  doesNotApproveAiReasoning: true;
  separatedFromLiveOutcomes: true;
  limitation: string | null;
}

function clipBars(
  bars: readonly HfmHistoricalBar[],
  fromTimeSec: number | null | undefined,
  toTimeSec: number | null | undefined,
  maxCandles: number,
): { bars: HfmHistoricalBar[]; truncated: boolean } {
  let filtered = [...bars].sort((a, b) => a.time - b.time);
  if (fromTimeSec != null) filtered = filtered.filter((b) => b.time >= fromTimeSec);
  if (toTimeSec != null) filtered = filtered.filter((b) => b.time <= toTimeSec);
  const truncated = filtered.length > maxCandles;
  if (truncated) filtered = filtered.slice(filtered.length - maxCandles);
  return { bars: filtered, truncated };
}

function countGaps(bars: readonly HfmHistoricalBar[]): number {
  if (bars.length < 3) return 0;
  const steps: number[] = [];
  for (let i = 1; i < bars.length; i++) steps.push(bars[i]!.time - bars[i - 1]!.time);
  steps.sort((a, b) => a - b);
  const median = steps[Math.floor(steps.length / 2)]!;
  let gaps = 0;
  for (const s of steps) {
    if (median > 0 && s > median * 2.5) gaps += 1;
  }
  return gaps;
}

/**
 * Bounded chronological replay. Returns limitation string when data insufficient.
 */
export function runMifHistoricalReplay(
  input: MifHistoricalReplayInput,
): MifHistoricalReplayRun {
  const startedAt = new Date().toISOString();
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const primaryTimeframe = String(input.primaryTimeframe || "").trim().toUpperCase();
  const warmup = Math.max(MIF_REPLAY_MIN_WARMUP, input.warmupBars ?? MIF_REPLAY_MIN_WARMUP);
  const maxSteps = Math.min(MIF_REPLAY_MAX_STEPS, Math.max(1, input.maxSteps ?? 50));
  const stepBars = Math.max(1, input.stepBars ?? 1);

  const inputIdentity = createHash("sha256")
    .update(
      stableSerialize({
        providerSymbol,
        primaryTimeframe,
        from: input.fromTimeSec ?? null,
        to: input.toTimeSec ?? null,
        warmup,
        maxSteps,
        stepBars,
        series: input.series.map((s) => ({
          tf: s.timeframe,
          n: s.bars.length,
          first: s.bars[0]?.time ?? null,
          last: s.bars[s.bars.length - 1]?.time ?? null,
        })),
        v: MIF_HISTORICAL_REPLAY_CONTRACT_VERSION,
      }),
    )
    .digest("hex");

  const runId = `replay:${inputIdentity.slice(0, 16)}`;

  const empty = (limitation: string): MifHistoricalReplayRun => ({
    contractId: MIF_HISTORICAL_REPLAY_CONTRACT_ID,
    contractVersion: MIF_HISTORICAL_REPLAY_CONTRACT_VERSION,
    engineId: MIF_HISTORICAL_REPLAY_ENGINE_ID,
    engineVersion: MIF_HISTORICAL_REPLAY_ENGINE_VERSION,
    resultNamespace: "HISTORICAL_REPLAY",
    runId,
    inputIdentity,
    providerId: "HFM_MT5",
    providerSymbol,
    primaryTimeframe,
    fromTimeSec: input.fromTimeSec ?? null,
    toTimeSec: input.toTimeSec ?? null,
    warmupBars: warmup,
    maxSteps,
    stepBars,
    startedAt,
    completedAt: new Date().toISOString(),
    stepsExecuted: 0,
    steps: [],
    dataCoverage: {
      primaryBarCount: 0,
      barsInRange: 0,
      missingIntervalsDetected: 0,
      truncatedByMaxSteps: false,
      truncatedByMaxCandles: false,
    },
    reproducibility: {
      identicalInputsYieldEquivalentOutputs: true,
      versionsRecorded: true,
    },
    policyVersions: {
      productionContractId: MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
      productionContractVersion: MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    separatedFromLiveOutcomes: true,
    limitation,
  });

  if (!providerSymbol || !primaryTimeframe) {
    return empty("providerSymbol and primaryTimeframe required");
  }

  const primarySeries = input.series.find(
    (s) => String(s.timeframe).toUpperCase() === primaryTimeframe,
  );
  if (!primarySeries || !primarySeries.bars.length) {
    return empty(
      `insufficient historical data: no bars for primaryTimeframe=${primaryTimeframe}`,
    );
  }

  const clipped = clipBars(
    primarySeries.bars,
    input.fromTimeSec,
    input.toTimeSec,
    MIF_REPLAY_MAX_CANDLES,
  );
  if (clipped.bars.length < warmup + 1) {
    return empty(
      `insufficient historical data: need >= ${warmup + 1} bars in range; got ${clipped.bars.length}`,
    );
  }

  const gaps = countGaps(clipped.bars);
  const steps: MifHistoricalReplayStepResult[] = [];
  let truncatedByMaxSteps = false;

  // Chronological walk: at tip index i, only bars[0..i] are visible (no look-ahead).
  for (
    let tip = warmup;
    tip < clipped.bars.length;
    tip += stepBars
  ) {
    if (steps.length >= maxSteps) {
      truncatedByMaxSteps = true;
      break;
    }

    const tipBar = clipped.bars[tip]!;
    // Decision time = authoritative tip close (broker-server). Never wall-clock.
    const decision = resolveDecisionTimeSec({
      tipOpenTimeSec: tipBar.time,
      primaryTimeframe,
    });
    if (!decision.ok) {
      steps.push({
        stepIndex: steps.length,
        tipOpenTimeSec: tipBar.time,
        candleCount: 0,
        analysisStatus: "FAILED_ASSESSMENT",
        candidateCount: 0,
        requestId: `${input.requestIdPrefix ?? "replay"}:${runId}:step${steps.length}`,
        candidateIds: [],
        failureCodes: [decision.reason],
      });
      continue;
    }

    // Visible only if candle closeTime <= decisionTime (MTF incomplete-bar safe).
    // openTime <= tip alone is insufficient for higher timeframes.
    const primaryVisible = filterBarsClosedAtDecision({
      bars: clipped.bars.slice(0, tip + 1),
      timeframe: primaryTimeframe,
      decisionTimeSec: decision.decisionTimeSec,
    });

    const seriesForStep = input.series.map((s) => {
      const tf = String(s.timeframe).toUpperCase();
      if (tf === primaryTimeframe) {
        return { timeframe: tf, bars: primaryVisible.visible };
      }
      const closedAtDecision = filterBarsClosedAtDecision({
        bars: s.bars,
        timeframe: tf,
        decisionTimeSec: decision.decisionTimeSec,
      });
      const clippedSec = clipBars(
        closedAtDecision.visible,
        input.fromTimeSec,
        tipBar.time,
        MIF_REPLAY_MAX_CANDLES,
      );
      return { timeframe: tf, bars: clippedSec.bars };
    });

    const pipeInput: MifProductionPipelineFromSeriesInput = {
      requestId: `${input.requestIdPrefix ?? "replay"}:${runId}:step${steps.length}`,
      providerId: "HFM_MT5",
      providerSymbol,
      timeframes: seriesForStep.map((s) => s.timeframe),
      primaryTimeframe,
      series: seriesForStep,
      assessmentTimestamp:
        input.assessmentTimestamp
        ?? new Date(tipBar.time * 1000).toISOString(),
      maxCandleAgeSec: null,
    };

    let result: MifProductionIntegrationResult;
    try {
      result = runMifHfmOpportunityPipelineFromSeries(pipeInput);
    } catch (err) {
      steps.push({
        stepIndex: steps.length,
        tipOpenTimeSec: tipBar.time,
        candleCount: primaryVisible.visible.length,
        analysisStatus: "FAILED_ASSESSMENT",
        candidateCount: 0,
        requestId: pipeInput.requestId!,
        candidateIds: [],
        failureCodes: [err instanceof Error ? err.message : String(err)],
      });
      continue;
    }

    const candidateIds = (result.detection?.candidates ?? []).map((c) => c.candidateId);
    steps.push({
      stepIndex: steps.length,
      tipOpenTimeSec: tipBar.time,
      candleCount: primaryVisible.visible.length,
      analysisStatus: result.analysisStatus,
      candidateCount: candidateIds.length,
      requestId: result.requestId,
      candidateIds,
      failureCodes: [...result.failureCodes],
    });
  }

  return {
    contractId: MIF_HISTORICAL_REPLAY_CONTRACT_ID,
    contractVersion: MIF_HISTORICAL_REPLAY_CONTRACT_VERSION,
    engineId: MIF_HISTORICAL_REPLAY_ENGINE_ID,
    engineVersion: MIF_HISTORICAL_REPLAY_ENGINE_VERSION,
    resultNamespace: "HISTORICAL_REPLAY",
    runId,
    inputIdentity,
    providerId: "HFM_MT5",
    providerSymbol,
    primaryTimeframe,
    fromTimeSec: input.fromTimeSec ?? null,
    toTimeSec: input.toTimeSec ?? null,
    warmupBars: warmup,
    maxSteps,
    stepBars,
    startedAt,
    completedAt: new Date().toISOString(),
    stepsExecuted: steps.length,
    steps,
    dataCoverage: {
      primaryBarCount: primarySeries.bars.length,
      barsInRange: clipped.bars.length,
      missingIntervalsDetected: gaps,
      truncatedByMaxSteps,
      truncatedByMaxCandles: clipped.truncated,
    },
    reproducibility: {
      identicalInputsYieldEquivalentOutputs: true,
      versionsRecorded: true,
    },
    policyVersions: {
      productionContractId: MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
      productionContractVersion: MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    separatedFromLiveOutcomes: true,
    limitation: steps.length === 0
      ? "no replay steps executed — check warmup vs available bars"
      : null,
  };
}
