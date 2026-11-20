/**
 * Phase 5F STEP 4 — chronological backtest bridge.
 * Composes tip-clipped OD pipeline + STEP 3 snapshots/outcomes. Not broker execution.
 */
import type { HfmHistoricalBar } from "../../historical-engine.js";
import type { MifHistoricalResearchStorage } from "../historical-research/storage.js";
import { researchBarsToHfmHistorical } from "../historical-research/replay-bridge.js";
import { assertCostAdjustedBacktestAllowed } from "../historical-research/research-eligibility.js";
import {
  MIF_PREDICTION_DEFAULT_HORIZONS,
  MIF_PREDICTION_OUTCOME_ENGINE_VERSION,
  MIF_PREDICTION_SNAPSHOT_POLICY_VERSION,
} from "../prediction-outcome/contracts.js";
import { evaluatePredictionOutcome } from "../prediction-outcome/engine.js";
import { buildPredictionSnapshot } from "../prediction-outcome/snapshot.js";
import { loadHistoricalArchiveForOutcome } from "../prediction-outcome/source-historical.js";
import type { MifPredictionSnapshot } from "../prediction-outcome/types.js";
import {
  MIF_REPLAY_MAX_CANDLES,
  MIF_REPLAY_MAX_STEPS,
  MIF_REPLAY_MIN_WARMUP,
} from "../production-integration/historical-replay.js";
import { runMifHfmOpportunityPipelineFromSeries } from "../production-integration/run-pipeline.js";
import {
  MIF_BACKTEST_DEFAULT_MAX_STEPS,
  MIF_BACKTEST_DEFAULT_WARMUP,
  MIF_BACKTEST_HARD_MAX_CANDLES,
  MIF_BACKTEST_HARD_MAX_STEPS,
} from "./contracts.js";
import {
  filterBarsClosedAtDecision,
  resolveDecisionTimeSec,
} from "../production-integration/mtf-visibility.js";
import type { MifBacktestTipPrediction } from "./types.js";

export interface ChronologicalBacktestBridgeInput {
  researchStorage: MifHistoricalResearchStorage;
  datasetId: string;
  version?: number;
  expectedContentHash?: string | null;
  /** Optional secondary TF series from other COMPLETE datasets (same instrument). */
  secondarySeries?: Array<{ timeframe: string; bars: readonly HfmHistoricalBar[] }>;
  warmupBars?: number;
  maxSteps?: number;
  stepBars?: number;
  horizons?: readonly number[];
  fromTipIndex?: number;
  toTipIndexExclusive?: number;
  tipIndexAllowlist?: ReadonlySet<number> | null;
  timeoutMs?: number;
  startedAtMs?: number;
}

export interface ChronologicalBacktestBridgeResult {
  ok: true;
  instrument: string;
  primaryTimeframe: string;
  datasetId: string;
  datasetVersion: number;
  contentHash: string;
  bars: HfmHistoricalBar[];
  tips: MifBacktestTipPrediction[];
  truncatedByMaxCandles: boolean;
  truncatedByMaxSteps: boolean;
  mtfExcludedTotal: number;
  limitations: string[];
}

export interface ChronologicalBacktestBridgeError {
  ok: false;
  code: string;
  message: string;
}

/**
 * Walk tips chronologically with MTF closure filter; freeze snapshots; evaluate STEP 3 outcomes.
 */
export async function runChronologicalBacktestBridge(
  input: ChronologicalBacktestBridgeInput,
): Promise<ChronologicalBacktestBridgeResult | ChronologicalBacktestBridgeError> {
  const startedAtMs = input.startedAtMs ?? Date.now();
  const timeoutMs = input.timeoutMs ?? 60_000;

  const consistency = await input.researchStorage.verifyDatasetConsistency(
    input.datasetId,
    input.version ?? (await latestVersion(input.researchStorage, input.datasetId)),
  );
  const version =
    input.version
    ?? (await latestVersion(input.researchStorage, input.datasetId));
  if (!consistency.ok) {
    return { ok: false, code: consistency.code, message: consistency.message };
  }

  const manifest = await input.researchStorage.getDatasetManifest(input.datasetId, version);
  if (!manifest) {
    return { ok: false, code: "MANIFEST_MISSING", message: "dataset manifest not found" };
  }
  if (manifest.provider !== "HFM_MT5") {
    return { ok: false, code: "UNSUPPORTED_PROVIDER", message: "HFM_MT5 only" };
  }
  if (manifest.status !== "COMPLETE") {
    return {
      ok: false,
      code: "INCOMPLETE_DATASET",
      message: "authoritative backtest requires COMPLETE datasets",
    };
  }
  if (
    input.expectedContentHash
    && input.expectedContentHash !== manifest.contentHash
  ) {
    return { ok: false, code: "HASH_MISMATCH", message: "content hash mismatch" };
  }

  // Cost gate: never claim cost-adjusted; enforce existing guard.
  const costGate = assertCostAdjustedBacktestAllowed(manifest.researchEligibility);
  if (costGate.ok) {
    // Even if somehow true in future, STEP 4 still runs GROSS unless explicitly upgraded.
  }

  const page = await input.researchStorage.getDatasetBars(manifest.datasetId, manifest.version);
  if (!page) {
    return { ok: false, code: "BARS_MISSING", message: "bars not found" };
  }

  let bars = researchBarsToHfmHistorical(page.bars).sort((a, b) => a.time - b.time);
  let truncatedByMaxCandles = false;
  if (bars.length > MIF_BACKTEST_HARD_MAX_CANDLES) {
    bars = bars.slice(bars.length - MIF_BACKTEST_HARD_MAX_CANDLES);
    truncatedByMaxCandles = true;
  }

  const warmup = Math.max(
    MIF_REPLAY_MIN_WARMUP,
    input.warmupBars ?? MIF_BACKTEST_DEFAULT_WARMUP,
  );
  const maxSteps = Math.min(
    MIF_BACKTEST_HARD_MAX_STEPS,
    Math.max(1, input.maxSteps ?? MIF_BACKTEST_DEFAULT_MAX_STEPS),
  );
  const stepBars = Math.max(1, input.stepBars ?? 1);
  const horizons = [...(input.horizons ?? MIF_PREDICTION_DEFAULT_HORIZONS)];

  if (bars.length < warmup + 1) {
    return {
      ok: false,
      code: "INSUFFICIENT_BARS",
      message: `need >= ${warmup + 1} bars; got ${bars.length}`,
    };
  }

  const instrument = String(manifest.instrument).toUpperCase();
  const primaryTimeframe = String(manifest.timeframe).toUpperCase();
  const seenPredictionIds = new Set<string>();
  const tips: MifBacktestTipPrediction[] = [];
  let truncatedByMaxSteps = false;
  let mtfExcludedTotal = 0;
  const limitations: string[] = [];
  if (truncatedByMaxCandles) {
    limitations.push(
      `truncated to most recent ${MIF_BACKTEST_HARD_MAX_CANDLES} bars (selection bias disclosed)`,
    );
  }
  limitations.push(
    "GROSS_OHLC_ANALYTICAL only; costAdjusted=false; not broker execution",
  );
  if (!costGate.ok) {
    limitations.push(
      `cost-adjusted backtest blocked: ${costGate.blockReasons.join(",")}`,
    );
  }

  // Preload full archive candles once for outcome evaluation after each tip.
  const archiveSource = await loadHistoricalArchiveForOutcome({
    storage: input.researchStorage,
    datasetId: manifest.datasetId,
    version: manifest.version,
    expectedContentHash: manifest.contentHash,
    activationOpenTimeSec: bars[warmup]!.time,
    instrument,
    timeframe: primaryTimeframe,
  });
  if (!archiveSource.ok) {
    return { ok: false, code: archiveSource.code, message: archiveSource.message };
  }

  const fromTip = Math.max(warmup, input.fromTipIndex ?? warmup);
  const toTip = Math.min(
    bars.length,
    input.toTipIndexExclusive ?? bars.length,
  );

  for (let tip = fromTip; tip < toTip; tip += stepBars) {
    if (Date.now() - startedAtMs > timeoutMs) {
      limitations.push("TIMEOUT");
      break;
    }
    if (tips.length >= maxSteps) {
      truncatedByMaxSteps = true;
      break;
    }
    if (input.tipIndexAllowlist && !input.tipIndexAllowlist.has(tip)) {
      continue;
    }

    const tipBar = bars[tip]!;
    const decision = resolveDecisionTimeSec({
      tipOpenTimeSec: tipBar.time,
      primaryTimeframe,
    });
    if (!decision.ok) {
      limitations.push(decision.reason);
      continue;
    }

    const primaryVisible = filterBarsClosedAtDecision({
      bars: bars.slice(0, tip + 1),
      timeframe: primaryTimeframe,
      decisionTimeSec: decision.decisionTimeSec,
    });
    mtfExcludedTotal += primaryVisible.excluded.length;

    const series = [
      { timeframe: primaryTimeframe, bars: primaryVisible.visible },
      ...(input.secondarySeries ?? []).map((s) => {
        const filtered = filterBarsClosedAtDecision({
          bars: s.bars,
          timeframe: String(s.timeframe).toUpperCase(),
          decisionTimeSec: decision.decisionTimeSec,
        });
        mtfExcludedTotal += filtered.excluded.length;
        return {
          timeframe: String(s.timeframe).toUpperCase(),
          bars: filtered.visible.slice(-MIF_REPLAY_MAX_CANDLES),
        };
      }),
    ];

    let pipeline;
    try {
      pipeline = runMifHfmOpportunityPipelineFromSeries({
        requestId: `bt:${manifest.datasetId}:tip${tip}`,
        providerId: "HFM_MT5",
        providerSymbol: instrument,
        timeframes: series.map((s) => s.timeframe),
        primaryTimeframe,
        series,
        assessmentTimestamp: new Date(tipBar.time * 1000).toISOString(),
        maxCandleAgeSec: null,
      });
    } catch (err) {
      limitations.push(err instanceof Error ? err.message : String(err));
      continue;
    }

    const candidates = pipeline.detection?.candidates ?? [];
    if (!candidates.length) continue;

    // Open position tracking for overlap (max 1 by default applied later in ledger;
    // bridge still records all predictions but marks skippedOverlap for duplicates in time).
    for (const cand of candidates) {
      const snap = buildPredictionSnapshot({
        candidateId: cand.candidateId,
        analysisRunId: pipeline.requestId,
        activationOpenTimeSec: tipBar.time,
        instrument,
        timeframe: primaryTimeframe,
        direction: cand.direction,
        invalidationConditions: cand.invalidationConditions,
        requiredConfirmations: cand.requiredConfirmations,
        thesis: cand.thesis,
        rationale: cand.rationale,
        strategyId: String(cand.strategyId),
        detectorId: cand.detectorId,
        strategyVersion: cand.strategyDefinitionVersion,
        modelVersion: cand.detectorVersion,
        marketProvenance: {
          mode: "HISTORICAL_ARCHIVE",
          providerId: "HFM_MT5",
          datasetId: manifest.datasetId,
          datasetVersion: manifest.version,
          contentHash: manifest.contentHash,
        },
        referenceCandle: {
          openTimeSec: tipBar.time,
          close: tipBar.close,
          timeframe: primaryTimeframe,
          providerSymbol: instrument,
        },
      });

      if (snap.status !== "FROZEN") continue;

      const skippedDuplicate = seenPredictionIds.has(snap.predictionId);
      if (!skippedDuplicate) seenPredictionIds.add(snap.predictionId);

      let outcome = null;
      let outcomeError: string | null = null;
      if (!skippedDuplicate) {
        const future = archiveSource.allClosed.filter(
          (c) => c.openTimeSec > tipBar.time,
        );
        const activationCandle = archiveSource.allClosed.find(
          (c) => c.openTimeSec === tipBar.time,
        );
        const evaluated = evaluatePredictionOutcome({
          snapshot: snap,
          futureClosedCandles: future,
          activationClose: activationCandle?.close ?? tipBar.close,
          marketSourceMode: "HISTORICAL_ARCHIVE",
          marketProvenance: {
            mode: "HISTORICAL_ARCHIVE",
            providerId: "HFM_MT5",
            datasetId: manifest.datasetId,
            datasetVersion: manifest.version,
            contentHash: manifest.contentHash,
          },
          dataQuality: {
            ...archiveSource.dataQuality,
            tipClipped: true,
          },
          horizons,
        });
        if (evaluated.ok) outcome = evaluated.outcome;
        else outcomeError = `${evaluated.code}:${evaluated.message}`;
      }

      tips.push({
        tipOpenTimeSec: tipBar.time,
        decisionTimeSec: decision.decisionTimeSec,
        candidateId: cand.candidateId,
        predictionId: snap.predictionId,
        snapshot: snap as MifPredictionSnapshot,
        outcome,
        outcomeError,
        skippedDuplicate,
        skippedOverlap: false,
      });
    }
  }

  void MIF_REPLAY_MAX_STEPS;
  void MIF_PREDICTION_SNAPSHOT_POLICY_VERSION;
  void MIF_PREDICTION_OUTCOME_ENGINE_VERSION;

  return {
    ok: true,
    instrument,
    primaryTimeframe,
    datasetId: manifest.datasetId,
    datasetVersion: manifest.version,
    contentHash: manifest.contentHash,
    bars,
    tips,
    truncatedByMaxCandles,
    truncatedByMaxSteps,
    mtfExcludedTotal,
    limitations,
  };
}

async function latestVersion(
  storage: MifHistoricalResearchStorage,
  datasetId: string,
): Promise<number> {
  const reg = await storage.listRegistry();
  const matches = reg
    .filter((e) => e.datasetId === datasetId)
    .sort((a, b) => b.version - a.version);
  return matches[0]?.version ?? 1;
}
