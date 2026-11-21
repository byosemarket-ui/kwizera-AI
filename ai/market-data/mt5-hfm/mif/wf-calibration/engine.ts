/**
 * Phase 5F STEP 5 Phase C — walk-forward-aware calibration evaluation (metrics-only).
 *
 * Uses existing STEP 4 fold open-time boundaries. Never fits on OOS.
 * Never relabels mid-split 5E runs as WF-calibrated.
 */
import { createHash } from "node:crypto";
import type { MifBacktestFoldResult, MifBacktestRunManifest } from "../backtesting/types.js";
import type { MifProbabilityFreezeRecord } from "../probability-intelligence/freeze-types.js";
import type { MifPredictionOutcomeRecord } from "../prediction-outcome/types.js";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  MIF_WF_CALIBRATION_CALIBRATED_THRESHOLD,
  MIF_WF_CALIBRATION_CONTRACT_ID,
  MIF_WF_CALIBRATION_CONTRACT_VERSION,
  MIF_WF_CALIBRATION_ENGINE_ID,
  MIF_WF_CALIBRATION_ENGINE_VERSION,
  MIF_WF_CALIBRATION_PROVISIONAL_THRESHOLD,
  MIF_WF_CALIBRATION_TARGET_EVENT,
} from "./contracts.js";
import { computeWfCalibrationMetrics, resolveWfStatusFromOosCount } from "./metrics.js";
import type {
  MifWfCalibrationObservation,
  MifWfCalibrationRun,
  MifWfExcludedObservation,
  MifWfFoldCalibrationResult,
  MifWfFoldRole,
} from "./types.js";

export interface MifBacktestTipCompact {
  tipOpenTimeSec: number;
  decisionTimeSec?: number;
  candidateId: string;
  predictionId: string;
  skippedDuplicate?: boolean;
  outcomeId?: string | null;
  levelResult?: string | null;
  completeness?: string | null;
}

function secToIso(sec: number): string {
  return new Date(sec * 1000).toISOString();
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

function latestOutcomes(
  outcomes: readonly MifPredictionOutcomeRecord[],
): Map<string, MifPredictionOutcomeRecord> {
  const map = new Map<string, MifPredictionOutcomeRecord>();
  for (const o of outcomes) {
    const prev = map.get(o.predictionId);
    if (!prev || o.revisionOrdinal >= prev.revisionOrdinal) map.set(o.predictionId, o);
  }
  return map;
}

function assignFoldRole(
  tipOpenTimeSec: number,
  fold: MifBacktestFoldResult,
  horizonBars: number,
): { role: MifWfFoldRole; excluded?: MifWfExcludedObservation["reason"]; detail?: string } {
  const { is, val, oos } = fold;
  const inRange = (start: number, end: number) =>
    tipOpenTimeSec >= start && tipOpenTimeSec < end;

  // Embargo: tips too close to OOS start (approximate using embargoBars as seconds? No —
  // STEP 4 uses tip indices. We use open-time intervals from fold + exclusion list.)
  if (inRange(oos.startOpenTimeSec, oos.endOpenTimeSec)) {
    // Horizon crossing: tip + horizon conceptually into next fold — use horizonBars as bar count;
    // without bar series we approximate: if tip is within last horizonBars of OOS end, flag.
    // Safer: if tipOpenTimeSec + horizonBars * typical bar would cross — without bar duration,
    // use exclusion list from fold when tip is listed.
    return { role: "OOS" };
  }
  if (val && inRange(val.startOpenTimeSec, val.endOpenTimeSec)) return { role: "VAL" };
  if (inRange(is.startOpenTimeSec, is.endOpenTimeSec)) return { role: "IS" };
  return { role: "OUTSIDE" };
}

function isExcludedByFold(
  tipOpenTimeSec: number,
  predictionId: string,
  fold: MifBacktestFoldResult,
): MifWfExcludedObservation["reason"] | null {
  for (const ex of fold.exclusions ?? []) {
    const hit =
      ex.tipOpenTimeSec === tipOpenTimeSec
      || (ex.predictionId != null && ex.predictionId === predictionId);
    if (!hit) continue;
    if (/embargo/i.test(ex.reason)) return "EMBARGO_EXCLUDED";
    if (/purge/i.test(ex.reason)) return "PURGE_EXCLUDED";
    return "OTHER";
  }
  return null;
}

export function runWalkForwardCalibration(input: {
  backtestManifest: MifBacktestRunManifest;
  tips: readonly MifBacktestTipCompact[];
  freezes: readonly MifProbabilityFreezeRecord[];
  outcomes: readonly MifPredictionOutcomeRecord[];
  createdAt?: string;
}): {
  run: MifWfCalibrationRun;
  included: MifWfCalibrationObservation[];
  excluded: MifWfExcludedObservation[];
} {
  const manifest = input.backtestManifest;
  const folds = (manifest.folds ?? []) as MifBacktestFoldResult[];
  const excluded: MifWfExcludedObservation[] = [];
  const included: MifWfCalibrationObservation[] = [];
  const exclusionBreakdown: Record<string, number> = {};

  const bump = (reason: string) => {
    exclusionBreakdown[reason] = (exclusionBreakdown[reason] ?? 0) + 1;
  };

  const outcomeByPred = latestOutcomes(input.outcomes);
  const tipByPrediction = new Map<string, MifBacktestTipCompact>();
  for (const t of input.tips) {
    if (t.skippedDuplicate) {
      excluded.push({
        freezeId: null,
        assessmentId: null,
        predictionId: t.predictionId,
        reason: "DUPLICATE_PREDICTION",
        detail: "tip marked skippedDuplicate",
      });
      bump("DUPLICATE_PREDICTION");
      continue;
    }
    tipByPrediction.set(t.predictionId, t);
  }

  // Prefer highest revision freeze per assessmentId
  const freezeByAssessment = new Map<string, MifProbabilityFreezeRecord>();
  for (const f of input.freezes) {
    const prev = freezeByAssessment.get(f.assessmentId);
    if (!prev || f.revisionOrdinal >= prev.revisionOrdinal) {
      if (prev && f.revisionOrdinal > prev.revisionOrdinal) {
        excluded.push({
          freezeId: prev.freezeId,
          assessmentId: prev.assessmentId,
          predictionId: prev.predictionId,
          reason: "SUPERSEDED_REVISION",
          detail: `superseded by ${f.freezeId}`,
        });
        bump("SUPERSEDED_REVISION");
      }
      freezeByAssessment.set(f.assessmentId, f);
    }
  }

  let temporalLeakage = false;
  let incompatibleTarget = false;
  let invalidProvenance = false;

  const oosPoints: { probability: number; outcome: 0 | 1 }[] = [];
  const foldResults: MifWfFoldCalibrationResult[] = [];

  for (const fold of folds) {
    const foldIncluded: MifWfCalibrationObservation[] = [];
    const foldReasons: string[] = [];
    let foldExcluded = 0;

    if (
      !(fold.oos?.startOpenTimeSec >= 0)
      || !(fold.oos?.endOpenTimeSec > fold.oos.startOpenTimeSec)
      || !(fold.is?.startOpenTimeSec >= 0)
    ) {
      foldResults.push({
        foldIndex: fold.foldIndex,
        status: "INVALID_PROVENANCE",
        fold: {
          is: fold.is,
          val: fold.val,
          oos: fold.oos,
          purgeBars: fold.purgeBars,
          embargoBars: fold.embargoBars,
          status: fold.status,
        },
        trainingInterval: {
          fromOpenTimeSec: fold.is?.startOpenTimeSec ?? 0,
          toOpenTimeSec: fold.is?.endOpenTimeSec ?? 0,
          fromIso: secToIso(fold.is?.startOpenTimeSec ?? 0),
          toIso: secToIso(fold.is?.endOpenTimeSec ?? 0),
        },
        evaluationInterval: {
          fromOpenTimeSec: fold.oos?.startOpenTimeSec ?? 0,
          toOpenTimeSec: fold.oos?.endOpenTimeSec ?? 0,
          fromIso: secToIso(fold.oos?.startOpenTimeSec ?? 0),
          toIso: secToIso(fold.oos?.endOpenTimeSec ?? 0),
        },
        includedCount: 0,
        excludedCount: 0,
        metrics: null,
        reasons: ["MISSING_FOLD_BOUNDARIES"],
      });
      continue;
    }

    for (const freeze of freezeByAssessment.values()) {
      if (freeze.targetEvent !== MIF_WF_CALIBRATION_TARGET_EVENT) {
        incompatibleTarget = true;
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "INCOMPATIBLE_TARGET_EVENT",
          detail: freeze.targetEvent,
        });
        bump("INCOMPATIBLE_TARGET_EVENT");
        foldExcluded += 1;
        continue;
      }
      if (freeze.provenanceTrust !== "HIGH") {
        invalidProvenance = true;
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "LIMITED_PROVENANCE",
          detail: freeze.predictionTimeProvenance,
        });
        bump("LIMITED_PROVENANCE");
        foldExcluded += 1;
        continue;
      }
      if (!freeze.predictionId) {
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: null,
          reason: "MISSING_PREDICTION_ID",
          detail: "WF calibration requires predictionId link",
        });
        bump("MISSING_PREDICTION_ID");
        foldExcluded += 1;
        continue;
      }

      const outcome = outcomeByPred.get(freeze.predictionId);
      if (!outcome) {
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "NO_DECISIVE_OUTCOME",
          detail: "no outcome record",
        });
        bump("NO_DECISIVE_OUTCOME");
        foldExcluded += 1;
        continue;
      }

      const kind = outcome.levelOutcome?.resultKind;
      if (kind === "LEVELS_NOT_PROVIDED") {
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "MISSING_LEVELS",
          detail: kind,
        });
        bump("MISSING_LEVELS");
        foldExcluded += 1;
        continue;
      }
      if (kind === "EXPIRED_UNRESOLVED" || kind === "STILL_ACTIVE") {
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "EXPIRED_OUTCOME",
          detail: kind,
        });
        bump("EXPIRED_OUTCOME");
        foldExcluded += 1;
        continue;
      }
      if (
        kind === "BOTH_AMBIGUOUS_SAME_CANDLE"
        || kind === "AMBIGUOUS_OUTCOME"
      ) {
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "AMBIGUOUS_OUTCOME",
          detail: String(kind),
        });
        bump("AMBIGUOUS_OUTCOME");
        foldExcluded += 1;
        continue;
      }
      if (
        outcome.pathOutcome?.unsupportedReason
        || outcome.completeness === "INSUFFICIENT"
      ) {
        // unsupported direction often sets unsupportedReason
        if (outcome.pathOutcome?.unsupportedReason) {
          excluded.push({
            freezeId: freeze.freezeId,
            assessmentId: freeze.assessmentId,
            predictionId: freeze.predictionId,
            reason: "UNSUPPORTED_DIRECTION",
            detail: outcome.pathOutcome.unsupportedReason,
          });
          bump("UNSUPPORTED_DIRECTION");
          foldExcluded += 1;
          continue;
        }
      }
      if (kind !== "TARGET_REACHED" && kind !== "INVALIDATION_REACHED") {
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "NO_DECISIVE_OUTCOME",
          detail: String(kind),
        });
        bump("NO_DECISIVE_OUTCOME");
        foldExcluded += 1;
        continue;
      }

      const resolvedAt =
        outcome.levelOutcome?.evaluationTimestamp || outcome.computationTimestamp;
      if (!resolvedAt || freeze.predictedAt >= resolvedAt) {
        temporalLeakage = true;
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "TEMPORAL_LEAKAGE",
          detail: `predictedAt=${freeze.predictedAt} resolvedAt=${resolvedAt}`,
        });
        bump("TEMPORAL_LEAKAGE");
        foldExcluded += 1;
        continue;
      }

      const tip = tipByPrediction.get(freeze.predictionId);
      const tipOpen = tip?.tipOpenTimeSec ?? null;
      if (tipOpen == null) {
        // Still allow if tip times unavailable — assign OUTSIDE unless we can match fold via activation
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "OTHER",
          detail: "prediction not found in backtest tips for fold assignment",
        });
        bump("OTHER");
        foldExcluded += 1;
        continue;
      }

      const foldEx = isExcludedByFold(tipOpen, freeze.predictionId, fold);
      if (foldEx) {
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: foldEx,
          detail: `fold_exclusion tip=${tipOpen}`,
        });
        bump(foldEx);
        foldExcluded += 1;
        continue;
      }

      const { role } = assignFoldRole(tipOpen, fold, fold.purgeBars);
      if (role !== "OOS") {
        // Training/VAL observations are NOT used for OOS metrics (no fitting either).
        continue;
      }

      // Reject if resolved outcome falls inside training IS window (leakage into labels used before OOS).
      const resolvedSec = Math.floor(Date.parse(resolvedAt) / 1000);
      if (
        Number.isFinite(resolvedSec)
        && resolvedSec >= fold.is.startOpenTimeSec
        && resolvedSec < fold.is.endOpenTimeSec
      ) {
        temporalLeakage = true;
        excluded.push({
          freezeId: freeze.freezeId,
          assessmentId: freeze.assessmentId,
          predictionId: freeze.predictionId,
          reason: "OUTCOME_IN_TRAINING_WINDOW",
          detail: "resolvedAt falls inside IS training interval",
        });
        bump("OUTCOME_IN_TRAINING_WINDOW");
        foldExcluded += 1;
        continue;
      }

      // Horizon crossing OOS end: tipOpen + purgeBars bars — approximate with tip near end
      if (
        tipOpen >= fold.oos.endOpenTimeSec - Math.max(1, fold.purgeBars)
        // without bar duration this is weak; use tipOpen >= oos.end as hard fail already excluded
      ) {
        // If tip is in OOS but outcome resolution extends past oos.end, flag horizon cross
        if (resolvedSec >= fold.oos.endOpenTimeSec) {
          excluded.push({
            freezeId: freeze.freezeId,
            assessmentId: freeze.assessmentId,
            predictionId: freeze.predictionId,
            reason: "HORIZON_CROSSES_OOS_BOUNDARY",
            detail: "outcome resolved after OOS interval end",
          });
          bump("HORIZON_CROSSES_OOS_BOUNDARY");
          foldExcluded += 1;
          continue;
        }
      }

      const obs: MifWfCalibrationObservation = {
        freezeId: freeze.freezeId,
        assessmentId: freeze.assessmentId,
        predictionId: freeze.predictionId,
        candidateId: freeze.candidateId,
        probability: freeze.probability,
        predictedAt: freeze.predictedAt,
        resolvedAt,
        outcome: kind === "TARGET_REACHED" ? 1 : 0,
        levelResultKind: kind,
        tipOpenTimeSec: tipOpen,
        foldIndex: fold.foldIndex,
        foldRole: "OOS",
        provenanceTrust: freeze.provenanceTrust,
        evaluationHorizonBars: freeze.evaluationHorizonBars,
        sourceDatasetId: freeze.sourceDatasetId,
        sourceContentHash: freeze.sourceContentHash,
      };
      foldIncluded.push(obs);
      included.push(obs);
      oosPoints.push({ probability: obs.probability, outcome: obs.outcome });
    }

    const metrics =
      foldIncluded.length > 0 ? computeWfCalibrationMetrics(foldIncluded) : null;
    const foldStatus = resolveWfStatusFromOosCount(foldIncluded.length, {
      temporalLeakage: false,
      incompatibleTarget: false,
      invalidProvenance: false,
      unfrozenOnly: false,
      provisionalThreshold: MIF_WF_CALIBRATION_PROVISIONAL_THRESHOLD,
      calibratedThreshold: MIF_WF_CALIBRATION_CALIBRATED_THRESHOLD,
      allowCalibratedClaim: false,
    });

    foldResults.push({
      foldIndex: fold.foldIndex,
      status: foldStatus.status,
      fold: {
        is: fold.is,
        val: fold.val,
        oos: fold.oos,
        purgeBars: fold.purgeBars,
        embargoBars: fold.embargoBars,
        status: fold.status,
      },
      trainingInterval: {
        fromOpenTimeSec: fold.is.startOpenTimeSec,
        toOpenTimeSec: fold.is.endOpenTimeSec,
        fromIso: secToIso(fold.is.startOpenTimeSec),
        toIso: secToIso(fold.is.endOpenTimeSec),
      },
      evaluationInterval: {
        fromOpenTimeSec: fold.oos.startOpenTimeSec,
        toOpenTimeSec: fold.oos.endOpenTimeSec,
        fromIso: secToIso(fold.oos.startOpenTimeSec),
        toIso: secToIso(fold.oos.endOpenTimeSec),
      },
      includedCount: foldIncluded.length,
      excludedCount: foldExcluded,
      metrics,
      reasons: [...foldStatus.reasons, ...foldReasons],
    });
  }

  const oosAggregate =
    oosPoints.length > 0 ? computeWfCalibrationMetrics(oosPoints) : null;
  const unfrozenOnly =
    input.freezes.length === 0
    || input.freezes.every((f) => f.provenanceTrust !== "HIGH");

  const overall = resolveWfStatusFromOosCount(oosPoints.length, {
    temporalLeakage,
    incompatibleTarget: incompatibleTarget && oosPoints.length === 0,
    invalidProvenance: invalidProvenance && oosPoints.length === 0,
    unfrozenOnly,
    provisionalThreshold: MIF_WF_CALIBRATION_PROVISIONAL_THRESHOLD,
    calibratedThreshold: MIF_WF_CALIBRATION_CALIBRATED_THRESHOLD,
    allowCalibratedClaim: false,
  });

  const createdAt = input.createdAt ?? new Date().toISOString();
  const identity = {
    backtestRunId: manifest.runId,
    backtestRunHash: manifest.runHash,
    included: included.map((i) => i.freezeId).sort(),
    engine: MIF_WF_CALIBRATION_ENGINE_VERSION,
    contract: MIF_WF_CALIBRATION_CONTRACT_VERSION,
  };
  const runHash = hashPayload(identity);
  const runId = `wfcal:${runHash.slice(0, 28)}`;

  const run: MifWfCalibrationRun = {
    contractId: MIF_WF_CALIBRATION_CONTRACT_ID,
    contractVersion: MIF_WF_CALIBRATION_CONTRACT_VERSION,
    runId,
    runHash,
    engineId: MIF_WF_CALIBRATION_ENGINE_ID,
    engineVersion: MIF_WF_CALIBRATION_ENGINE_VERSION,
    createdAt,
    backtestRunId: manifest.runId,
    backtestRunHash: manifest.runHash,
    datasetId: manifest.dataset?.datasetId ?? null,
    datasetContentHash: manifest.dataset?.contentHash ?? null,
    mode: manifest.mode,
    status: overall.status,
    statusReasons: overall.reasons,
    targetEvent: MIF_WF_CALIBRATION_TARGET_EVENT,
    provisionalThreshold: MIF_WF_CALIBRATION_PROVISIONAL_THRESHOLD,
    calibratedThreshold: MIF_WF_CALIBRATION_CALIBRATED_THRESHOLD,
    totalEligibleObservations: included.length,
    totalExcluded: excluded.length,
    exclusionBreakdown,
    folds: foldResults,
    oosAggregateMetrics: oosAggregate,
    modelFitPerformed: false,
    walkForwardCalibrated: false,
    midSplitScaffoldingNotUsed: true,
    isNotCalibratedProbability: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    notExecutable: true,
  };

  return { run, included, excluded };
}
