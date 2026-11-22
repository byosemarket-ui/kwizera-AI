/**
 * P8.C — thin Charts prediction evaluation orchestrator.
 *
 * Reuses MIF evaluatePredictionOutcome / path metrics / 5D.7 level engine.
 * Adds: entry-trigger separation, signed R, mandatory P8.B PIT manifest.
 * Historical path only — no LIVE_COPYRATES fallback.
 */
import {
  buildPitReplayInputManifest,
  MifPitReplayManifestStorage,
  type MifHistoricalResearchStorage,
} from "../../mif/historical-research/index.js";
import { computeCandleRangeHash } from "../../mif/prediction-outcome/identity.js";
import {
  evaluatePredictionOutcome,
  getMifPredictionOutcomeStorage,
  isPredictionSnapshotValid,
  loadHistoricalArchiveForOutcome,
  type MifPredictionOutcomeStorage,
  type MifPredictionSnapshot,
} from "../../mif/prediction-outcome/index.js";
import {
  HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_ID,
  HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
  HFM_CHARTS_SIGNED_R_DEFINITION,
  HFM_CHARTS_SIGNED_R_POLICY_VERSION,
} from "./contracts.js";
import {
  findEntryTrigger,
  resolveChartsEntryZone,
  selectPostTriggerClosedCandles,
} from "./entry-trigger.js";
import { computeChartsEvaluationId } from "./identity.js";
import {
  getHfmChartsPredictionOutcomeStorage,
  type HfmChartsPredictionOutcomeStorage,
} from "./persistence.js";
import { computeSignedRealizedR } from "./signed-r.js";
import type {
  HfmChartsEvaluatePredictionInput,
  HfmChartsPredictionEvaluationRecord,
  HfmChartsPredictionResultKind,
} from "./types.js";

const SAFETY = {
  analyticalOhlcOnly: true as const,
  notBrokerAccountPnl: true as const,
  isNotCalibratedProbability: true as const,
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  doesNotApproveAiReasoning: true as const,
  notExecutable: true as const,
};

export type EvaluateChartsPredictionResult =
  | {
      ok: true;
      evaluation: HfmChartsPredictionEvaluationRecord;
      persisted: boolean;
      created: boolean;
    }
  | { ok: false; code: string; message: string };

function mapLevelResultKind(kind: string): HfmChartsPredictionResultKind {
  switch (kind) {
    case "TARGET_REACHED":
    case "INVALIDATION_REACHED":
    case "BOTH_AMBIGUOUS_SAME_CANDLE":
    case "EXPIRED_UNRESOLVED":
    case "STILL_ACTIVE":
    case "NO_OBSERVATION_WINDOW":
    case "INSUFFICIENT_HISTORICAL_EVIDENCE":
    case "LEVELS_NOT_PROVIDED":
    case "AMBIGUOUS_OUTCOME":
      return kind;
    default:
      return "REJECTED";
  }
}

function pickMaeMfe(
  pathOutcome: HfmChartsPredictionEvaluationRecord["pathOutcome"],
): { mae: number | null; mfe: number | null } {
  if (!pathOutcome?.horizons?.length) return { mae: null, mfe: null };
  // Prefer the longest complete/partial horizon metric.
  const ranked = [...pathOutcome.horizons].sort(
    (a, b) => b.requestedHorizon - a.requestedHorizon,
  );
  for (const h of ranked) {
    if (h.mae != null || h.mfe != null) {
      return { mae: h.mae, mfe: h.mfe };
    }
  }
  return { mae: null, mfe: null };
}

/**
 * Evaluate a P8.A Charts prediction against a sealed COMPLETE historical dataset
 * with a mandatory P8.B PIT replay manifest.
 */
export async function evaluateChartsPredictionHistorical(input: {
  researchStorage: MifHistoricalResearchStorage;
  predictionStorage?: MifPredictionOutcomeStorage;
  chartsStorage?: HfmChartsPredictionOutcomeStorage;
  request: HfmChartsEvaluatePredictionInput;
}): Promise<EvaluateChartsPredictionResult> {
  const predictionStorage =
    input.predictionStorage ?? getMifPredictionOutcomeStorage();
  const chartsStorage =
    input.chartsStorage ?? getHfmChartsPredictionOutcomeStorage();
  const req = input.request;
  const computationTimestamp = req.evaluationTimestamp ?? new Date().toISOString();

  const snapshot: MifPredictionSnapshot | null =
    req.snapshot
    ?? (await predictionStorage.getSnapshot(req.predictionId));
  if (!snapshot) {
    return {
      ok: false,
      code: "SNAPSHOT_NOT_FOUND",
      message: `prediction snapshot not found: ${req.predictionId}`,
    };
  }
  if (snapshot.predictionId !== req.predictionId && req.snapshot == null) {
    return {
      ok: false,
      code: "PREDICTION_ID_MISMATCH",
      message: "loaded snapshot predictionId does not match request",
    };
  }
  if (!isPredictionSnapshotValid(snapshot)) {
    return {
      ok: false,
      code: "INVALID_SNAPSHOT",
      message: snapshot.invalidReason ?? "snapshot is not FROZEN",
    };
  }
  const direction = String(snapshot.direction || "").toUpperCase();
  if (direction !== "BUY" && direction !== "SELL") {
    return {
      ok: false,
      code: "NOT_DIRECTIONAL_PREDICTION",
      message: `Charts evaluation requires BUY/SELL snapshot; got ${direction}`,
    };
  }

  const datasetId = String(req.datasetId || "").trim();
  if (!datasetId) {
    return { ok: false, code: "MISSING_DATASET_ID", message: "datasetId required" };
  }

  // Load/verify COMPLETE archive first (hash + suitability + instrument/TF).
  const source = await loadHistoricalArchiveForOutcome({
    storage: input.researchStorage,
    datasetId,
    version: req.datasetVersion,
    expectedContentHash: req.expectedContentHash,
    activationOpenTimeSec: snapshot.activationOpenTimeSec,
    instrument: snapshot.instrument,
    timeframe: snapshot.timeframe,
  });
  if (!source.ok) {
    return { ok: false, code: source.code, message: source.message };
  }
  if (source.manifest.status !== "COMPLETE") {
    return {
      ok: false,
      code: "INCOMPLETE_DATASET",
      message: "historical Charts evaluation requires COMPLETE datasets",
    };
  }
  if (source.manifest.researchEligibility?.suitableForCandleResearch !== true) {
    return {
      ok: false,
      code: "UNSUITABLE_DATASET",
      message: "dataset is not suitableForCandleResearch",
    };
  }

  // Mandatory P8.B PIT manifest — bind sealed dataset identity at activation cutoff.
  const pitBuilt = await buildPitReplayInputManifest(input.researchStorage, {
    instrument: snapshot.instrument,
    primaryTimeframe: snapshot.timeframe,
    datasets: [
      {
        datasetId: source.manifest.datasetId,
        version: source.manifest.version,
      },
    ],
    decisionCutoffSec: snapshot.activationOpenTimeSec,
    verifyHashes: true,
  });
  if (!pitBuilt.ok) {
    return { ok: false, code: pitBuilt.code, message: pitBuilt.message };
  }
  const pitManifest = pitBuilt.manifest;
  const pitStore = MifPitReplayManifestStorage.fromResearchStorage(
    input.researchStorage,
  );
  const pitPersist = await pitStore.persistManifest(pitManifest);
  if (!pitPersist.ok) {
    return {
      ok: false,
      code: pitPersist.code,
      message: pitPersist.message,
    };
  }

  const zoneResolved = resolveChartsEntryZone({
    snapshot,
    entryZoneOverride: req.entryZone ?? null,
  });
  if (!zoneResolved.ok) {
    return {
      ok: false,
      code: zoneResolved.code,
      message: zoneResolved.message,
    };
  }

  const maxAgeBars = req.maxAgeBars ?? 200;
  const entryTrigger = findEntryTrigger({
    activationOpenTimeSec: snapshot.activationOpenTimeSec,
    entryZone: zoneResolved.zone,
    entryZoneSource: zoneResolved.source,
    closedCandles: source.futureClosed,
    maxBars: maxAgeBars,
  });

  const invalidationPrice = snapshot.levels.invalidation.price;
  const entryPrice = snapshot.levels.entry.price;
  const targetPrice = snapshot.levels.target.price;

  const lineage = {
    analysisRunId: snapshot.analysisRunId,
    sourceAnalysisIdentity: snapshot.sourceAnalysisIdentity,
    scenarioId: req.scenarioId ?? null,
    setupFingerprint: req.setupFingerprint ?? snapshot.detectorId ?? null,
    evidencePackageId: req.evidencePackageId ?? null,
    scenarioPackageId: req.scenarioPackageId ?? null,
    analyticalConfidence:
      req.analyticalConfidence != null && Number.isFinite(req.analyticalConfidence)
        ? req.analyticalConfidence
        : null,
  };

  // ——— UNTRIGGERED path ———
  if (entryTrigger.status === "UNTRIGGERED") {
    const obs = source.futureClosed.slice(0, maxAgeBars);
    const candleRangeHash = computeCandleRangeHash({
      openTimeSecs: obs.map((c) => c.openTimeSec),
      closes: obs.map((c) => c.close),
      highs: obs.map((c) => c.high),
      lows: obs.map((c) => c.low),
      marketSourceMode: "HISTORICAL_ARCHIVE",
      provenanceKey: `pit:${pitManifest.manifestId}:${source.provenance.contentHash}:untriggered`,
    });
    const resultKind: HfmChartsPredictionResultKind =
      obs.length === 0
        ? "NO_OBSERVATION_WINDOW"
        : obs.length >= maxAgeBars
          ? "UNTRIGGERED"
          : "UNTRIGGERED";

    const evaluationId = computeChartsEvaluationId({
      predictionId: snapshot.predictionId,
      pitManifestId: pitManifest.manifestId,
      datasetContentHash: source.provenance.contentHash,
      candleRangeHash,
      triggerStatus: entryTrigger.status,
      triggerOpenTimeSec: null,
    });

    const evaluation: HfmChartsPredictionEvaluationRecord = {
      contractId: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
      contractVersion: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
      evaluatorId: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_ID,
      evaluatorVersion: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
      evaluationId,
      predictionId: snapshot.predictionId,
      snapshotHash: snapshot.snapshotHash,
      resultKind,
      entryTrigger,
      realizedSignedRMultiple: null,
      signedRDefinition: HFM_CHARTS_SIGNED_R_DEFINITION,
      signedRPolicyVersion: HFM_CHARTS_SIGNED_R_POLICY_VERSION,
      invalidationPrice,
      entryPrice,
      targetPrice,
      exitPrice: null,
      mae: null,
      mfe: null,
      observationCandleCount: obs.length,
      evaluationStartOpenTimeSec: obs[0]?.openTimeSec ?? null,
      evaluationEndOpenTimeSec: obs[obs.length - 1]?.openTimeSec ?? null,
      provenance: {
        predictionId: snapshot.predictionId,
        snapshotHash: snapshot.snapshotHash,
        ...lineage,
        symbol: snapshot.instrument,
        timeframe: snapshot.timeframe,
        direction,
        pitManifestId: pitManifest.manifestId,
        pitManifestContentIdentityHash: pitManifest.contentIdentityHash,
        datasetId: source.provenance.datasetId,
        datasetVersion: source.provenance.datasetVersion,
        datasetContentHash: source.provenance.contentHash,
        candleRangeHash,
        evaluatorVersion: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
        entryTriggerPolicyVersion: HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
        signedRPolicyVersion: HFM_CHARTS_SIGNED_R_POLICY_VERSION,
      },
      levelOutcome: null,
      pathOutcome: null,
      mifOutcome: null,
      computationTimestamp,
      ...SAFETY,
    };

    let persisted = false;
    let created = false;
    if (req.persist !== false) {
      const p = await chartsStorage.persistEvaluation(evaluation);
      if (!p.ok) {
        return { ok: false, code: p.code, message: p.message };
      }
      persisted = true;
      created = p.created;
    }
    return { ok: true, evaluation, persisted, created };
  }

  // ——— TRIGGERED path ———
  const triggerOpen = entryTrigger.triggerOpenTimeSec!;
  const postTrigger = selectPostTriggerClosedCandles({
    closedCandles: source.futureClosed,
    triggerOpenTimeSec: triggerOpen,
  });

  // Evaluate levels/path using existing engines; activation leakage guard uses
  // snapshot.activationOpenTimeSec, so post-trigger bars (after activation) are valid.
  // Conservative policy: trigger candle itself is excluded from TP/SL path.
  const evaluated = evaluatePredictionOutcome({
    snapshot,
    futureClosedCandles: postTrigger,
    activationClose: entryTrigger.triggerReferencePrice,
    marketSourceMode: "HISTORICAL_ARCHIVE",
    marketProvenance: {
      ...source.provenance,
    },
    dataQuality: {
      ...source.dataQuality,
      // Observation starts after trigger, which is after activation.
      activationExcluded: true,
    },
    horizons: req.horizons,
    maxAgeBars,
    evaluationTimestamp: computationTimestamp,
  });
  if (!evaluated.ok) {
    return { ok: false, code: evaluated.code, message: evaluated.message };
  }

  // Rebuild candleRangeHash to bind PIT manifest identity (distinct evaluation identity).
  const candleRangeHash = computeCandleRangeHash({
    openTimeSecs: postTrigger.map((c) => c.openTimeSec),
    closes: postTrigger.map((c) => c.close),
    highs: postTrigger.map((c) => c.high),
    lows: postTrigger.map((c) => c.low),
    marketSourceMode: "HISTORICAL_ARCHIVE",
    provenanceKey: `pit:${pitManifest.manifestId}:${source.provenance.contentHash}:triggered:${triggerOpen}`,
  });

  const levelOutcome = evaluated.outcome.levelOutcome;
  const resultKind = mapLevelResultKind(levelOutcome.resultKind);

  // Exit reference: prefer level resolution close; null when non-terminal.
  const exitPrice =
    resultKind === "TARGET_REACHED"
    || resultKind === "INVALIDATION_REACHED"
      ? levelOutcome.resolvedClose
      : null;

  const signed = computeSignedRealizedR({
    direction,
    entryPrice,
    invalidationPrice,
    exitPrice,
    resultKind,
  });

  // Force null R on ambiguity regardless of any nested engine value.
  const realizedSignedRMultiple =
    resultKind === "BOTH_AMBIGUOUS_SAME_CANDLE"
      ? null
      : signed.ok
        ? signed.realizedSignedRMultiple
        : null;

  // Apply signed R onto a copy of levelOutcome for P8.C provenance; do not mutate
  // the nested 5D.7 definition field semantics for legacy readers — keep both.
  const levelOutcomeWithSignedR = {
    ...levelOutcome,
    realizedRMultiple: realizedSignedRMultiple,
    realizedRMultipleDefinition: HFM_CHARTS_SIGNED_R_DEFINITION,
  };

  const { mae, mfe } = pickMaeMfe(evaluated.outcome.pathOutcome);

  const evaluationId = computeChartsEvaluationId({
    predictionId: snapshot.predictionId,
    pitManifestId: pitManifest.manifestId,
    datasetContentHash: source.provenance.contentHash,
    candleRangeHash,
    triggerStatus: entryTrigger.status,
    triggerOpenTimeSec: triggerOpen,
  });

  // Embed MIF outcome with P8.C-bound candleRangeHash / evaluator tagging in note fields
  // without overwriting legacy 1.0.0 outcome ids (Charts record is the primary store).
  // Keep embedded MIF engineVersion at its native contract; tag Charts policy via
  // evaluatorVersion + Charts evaluationId. Never rewrite persisted 1.0.0 records.
  const mifOutcome = {
    ...evaluated.outcome,
    candleRangeHash,
    levelOutcome: levelOutcomeWithSignedR,
    evaluatorVersion: `charts:${HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION}`,
  };

  const evaluation: HfmChartsPredictionEvaluationRecord = {
    contractId: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_ID,
    contractVersion: HFM_CHARTS_PREDICTION_OUTCOME_CONTRACT_VERSION,
    evaluatorId: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_ID,
    evaluatorVersion: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
    evaluationId,
    predictionId: snapshot.predictionId,
    snapshotHash: snapshot.snapshotHash,
    resultKind,
    entryTrigger,
    realizedSignedRMultiple,
    signedRDefinition: HFM_CHARTS_SIGNED_R_DEFINITION,
    signedRPolicyVersion: HFM_CHARTS_SIGNED_R_POLICY_VERSION,
    invalidationPrice,
    entryPrice,
    targetPrice,
    exitPrice,
    mae,
    mfe,
    observationCandleCount: postTrigger.length,
    evaluationStartOpenTimeSec: postTrigger[0]?.openTimeSec ?? null,
    evaluationEndOpenTimeSec:
      postTrigger[postTrigger.length - 1]?.openTimeSec ?? null,
    provenance: {
      predictionId: snapshot.predictionId,
      snapshotHash: snapshot.snapshotHash,
      ...lineage,
      symbol: snapshot.instrument,
      timeframe: snapshot.timeframe,
      direction,
      pitManifestId: pitManifest.manifestId,
      pitManifestContentIdentityHash: pitManifest.contentIdentityHash,
      datasetId: source.provenance.datasetId,
      datasetVersion: source.provenance.datasetVersion,
      datasetContentHash: source.provenance.contentHash,
      candleRangeHash,
      evaluatorVersion: HFM_CHARTS_PREDICTION_OUTCOME_EVALUATOR_VERSION,
      entryTriggerPolicyVersion: HFM_CHARTS_ENTRY_TRIGGER_POLICY_VERSION,
      signedRPolicyVersion: HFM_CHARTS_SIGNED_R_POLICY_VERSION,
    },
    levelOutcome: levelOutcomeWithSignedR,
    pathOutcome: evaluated.outcome.pathOutcome,
    mifOutcome,
    computationTimestamp,
    ...SAFETY,
  };

  let persisted = false;
  let created = false;
  if (req.persist !== false) {
    const p = await chartsStorage.persistEvaluation(evaluation);
    if (!p.ok) {
      return { ok: false, code: p.code, message: p.message };
    }
    persisted = true;
    created = p.created;
  }

  return { ok: true, evaluation, persisted, created };
}
