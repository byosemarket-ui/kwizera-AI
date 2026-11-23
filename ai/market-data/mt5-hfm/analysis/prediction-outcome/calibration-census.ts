/**
 * P8.E F1 / Phase 03 — read-only bounded calibration census over Charts evaluations.
 * Not calibrated win-probability. Confidence is a non-probability analytical score.
 * When paired observations exist, Brier/log-loss diagnostics reuse WF metrics helpers
 * and remain explicitly non-probability.
 */
import {
  classifyCalibrationCensusBucket,
  HFM_CHARTS_CONFIDENCE_SEMANTICS,
  type HfmChartsCalibrationCensusBucket,
} from "./confidence-provenance.js";
import type { HfmChartsProductionEligibilityDiagnostics } from "./analytics-types.js";
import { loadProductionEligibleChartsEvaluations } from "./non-production-charts-record.js";
import {
  getHfmChartsPredictionOutcomeStorage,
  type HfmChartsPredictionOutcomeStorage,
} from "./persistence.js";
import type { HfmChartsPredictionEvaluationRecord } from "./types.js";
import { computeWfCalibrationMetrics } from "../../mif/wf-calibration/metrics.js";
import {
  assertScoreKindAllowedForConfidenceOutcomeDiagnostic,
  assertScoreKindAllowedForProbabilityCalibration,
  classifyConfidenceOutcomeDiagnosticStatus,
  HFM_CHARTS_CONFIDENCE_OUTCOME_DIAGNOSTIC_MIN,
  HFM_CHARTS_CONFIDENCE_OUTCOME_EVENT,
  HFM_CHARTS_CONFIDENCE_OUTCOME_METRIC_BASIS,
  HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN,
  HFM_SCORE_KIND_ANALYTICAL_CONFIDENCE,
  type HfmChartsConfidenceOutcomeDiagnosticStatus,
} from "../prediction-semantics.js";

const SAFETY = {
  placesOrders: false as const,
  mutatesBroker: false as const,
  acceptsForExecution: false as const,
  isNotCalibratedProbability: true as const,
  notBrokerAccountPnl: true as const,
  scheduledWorker: false as const,
  censusOnly: true as const,
  calibrated: false as const,
};

function inc(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

export interface HfmChartsCalibrationCensusReport {
  schemaVersion: "1";
  generatedAt: string;
  note: string;
  confidenceSemantics: typeof HFM_CHARTS_CONFIDENCE_SEMANTICS;
  totalEvaluations: number;
  withValidConfidence: number;
  withoutValidConfidence: number;
  confidenceSources: Record<string, number>;
  unavailableReasons: Record<string, number>;
  buckets: Record<HfmChartsCalibrationCensusBucket, number>;
  /** Eligible-looking decisive+triggered+valid confidence counts by bucket (census only). */
  strictEligibleByBucket: Record<Exclude<HfmChartsCalibrationCensusBucket, "UNKNOWN">, number>;
  minSamplePerBucket: 100;
  bucketReadiness: Record<
    Exclude<HfmChartsCalibrationCensusBucket, "UNKNOWN">,
    "INSUFFICIENT_SAMPLE" | "COUNT_MET_NOT_CALIBRATED"
  >;
  /**
   * Phase 03 — confidence↔outcome diagnostics (NOT estimated win probability).
   * Reuses WF Brier/log-loss helpers; never sets calibrated=true.
   * metricBasis makes clear the numeric channel is confidence/100, not event probability.
   */
  confidenceOutcomeDiagnostics: {
    scoreKind: typeof HFM_SCORE_KIND_ANALYTICAL_CONFIDENCE;
    metricBasis: typeof HFM_CHARTS_CONFIDENCE_OUTCOME_METRIC_BASIS;
    eventDefinition: typeof HFM_CHARTS_CONFIDENCE_OUTCOME_EVENT;
    isProbabilityCalibration: false;
    probabilityCalibrationRejectedReason: string;
    status: HfmChartsConfidenceOutcomeDiagnosticStatus;
    pairCount: number;
    provisionalMin: typeof HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN;
    diagnosticMin: typeof HFM_CHARTS_CONFIDENCE_OUTCOME_DIAGNOSTIC_MIN;
    /** Diagnostic Brier on confidence/100 vs decisive outcome — not probability calibration. */
    brierScore: number | null;
    /** Diagnostic log loss on confidence/100 vs decisive outcome — not probability calibration. */
    logLoss: number | null;
    expectedCalibrationError: number | null;
    positiveCount: number;
    negativeCount: number;
    note: string;
  };
  evaluatorVersions: Record<string, number>;
  signedRPolicyVersions: Record<string, number>;
  symbols: Record<string, number>;
  timeframes: Record<string, number>;
  directions: Record<string, number>;
  warnings: string[];
  /** R2-HYG-1 — present when storage loaders apply server-side provenance filter. */
  productionEligibility?: HfmChartsProductionEligibilityDiagnostics;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
  isNotCalibratedProbability: true;
  notBrokerAccountPnl: true;
  scheduledWorker: false;
  censusOnly: true;
  calibrated: false;
}

function emptyBuckets(): Record<HfmChartsCalibrationCensusBucket, number> {
  return { UNKNOWN: 0, "<50": 0, "50–<75": 0, ">=75": 0 };
}

function emptyEligible(): Record<
  Exclude<HfmChartsCalibrationCensusBucket, "UNKNOWN">,
  number
> {
  return { "<50": 0, "50–<75": 0, ">=75": 0 };
}

export function buildChartsCalibrationCensus(
  evaluations: readonly HfmChartsPredictionEvaluationRecord[],
  generatedAt = new Date().toISOString(),
): HfmChartsCalibrationCensusReport {
  const confidenceSources: Record<string, number> = {};
  const unavailableReasons: Record<string, number> = {};
  const buckets = emptyBuckets();
  const strictEligibleByBucket = emptyEligible();
  const evaluatorVersions: Record<string, number> = {};
  const signedRPolicyVersions: Record<string, number> = {};
  const symbols: Record<string, number> = {};
  const timeframes: Record<string, number> = {};
  const directions: Record<string, number> = {};
  let withValidConfidence = 0;
  let withoutValidConfidence = 0;
  const confidenceOutcomePairs: Array<{ probability: number; outcome: 0 | 1 }> = [];

  for (const e of evaluations) {
    const prov = e.provenance;
    const conf = prov.analyticalConfidence;
    const bucket = classifyCalibrationCensusBucket(conf);
    buckets[bucket] += 1;
    if (bucket === "UNKNOWN") withoutValidConfidence += 1;
    else withValidConfidence += 1;

    inc(confidenceSources, String(prov.confidenceSource ?? "LEGACY_OR_ABSENT"));
    if (prov.confidenceUnavailableReason) {
      inc(unavailableReasons, String(prov.confidenceUnavailableReason));
    } else if (bucket === "UNKNOWN") {
      inc(unavailableReasons, "UNKNOWN_WITHOUT_REASON");
    }

    inc(evaluatorVersions, String(e.evaluatorVersion ?? "UNKNOWN"));
    inc(signedRPolicyVersions, String(e.signedRPolicyVersion ?? "UNKNOWN"));
    inc(symbols, String(prov.symbol || "UNKNOWN").toUpperCase());
    inc(timeframes, String(prov.timeframe || "UNKNOWN").toUpperCase());
    inc(directions, String(prov.direction || "UNKNOWN").toUpperCase());

    const direction = String(prov.direction || "").toUpperCase();
    const triggered = e.entryTrigger?.status === "TRIGGERED";
    const decisive =
      e.resultKind === "TARGET_REACHED" || e.resultKind === "INVALIDATION_REACHED";
    const sourceOk =
      prov.confidenceSource === "REASONING_STORE"
      || prov.confidenceSource === "TEST_OVERRIDE";
    if (
      (direction === "BUY" || direction === "SELL")
      && triggered
      && decisive
      && bucket !== "UNKNOWN"
      && sourceOk
      && conf != null
    ) {
      strictEligibleByBucket[bucket] += 1;
      // Phase 03 — pair analytical confidence (scaled 0–1) with decisive outcome.
      // This is a diagnostic of confidence vs outcomes — not estimated win probability.
      const p = Math.min(1, Math.max(0, Number(conf) / 100));
      const y: 0 | 1 = e.resultKind === "TARGET_REACHED" ? 1 : 0;
      confidenceOutcomePairs.push({ probability: p, outcome: y });
    }
  }

  const bucketReadiness = {
    "<50":
      strictEligibleByBucket["<50"] >= 100
        ? ("COUNT_MET_NOT_CALIBRATED" as const)
        : ("INSUFFICIENT_SAMPLE" as const),
    "50–<75":
      strictEligibleByBucket["50–<75"] >= 100
        ? ("COUNT_MET_NOT_CALIBRATED" as const)
        : ("INSUFFICIENT_SAMPLE" as const),
    ">=75":
      strictEligibleByBucket[">=75"] >= 100
        ? ("COUNT_MET_NOT_CALIBRATED" as const)
        : ("INSUFFICIENT_SAMPLE" as const),
  };

  const diagAllowed = assertScoreKindAllowedForConfidenceOutcomeDiagnostic(
    HFM_SCORE_KIND_ANALYTICAL_CONFIDENCE,
  );
  if (!diagAllowed.ok) {
    throw new Error(diagAllowed.reason);
  }
  const probCalibGate = assertScoreKindAllowedForProbabilityCalibration(
    HFM_SCORE_KIND_ANALYTICAL_CONFIDENCE,
  );
  const diagStatus = classifyConfidenceOutcomeDiagnosticStatus(
    confidenceOutcomePairs.length,
  );
  // WF helper input field is named `probability` for math reuse only; basis is confidence.
  const metrics = computeWfCalibrationMetrics(confidenceOutcomePairs);
  const confidenceOutcomeDiagnostics = {
    scoreKind: HFM_SCORE_KIND_ANALYTICAL_CONFIDENCE,
    metricBasis: HFM_CHARTS_CONFIDENCE_OUTCOME_METRIC_BASIS,
    eventDefinition: HFM_CHARTS_CONFIDENCE_OUTCOME_EVENT,
    isProbabilityCalibration: false as const,
    probabilityCalibrationRejectedReason: probCalibGate.ok
      ? "unexpected_gate_pass"
      : probCalibGate.reason,
    status: diagStatus,
    pairCount: confidenceOutcomePairs.length,
    provisionalMin: HFM_CHARTS_CONFIDENCE_OUTCOME_PROVISIONAL_MIN,
    diagnosticMin: HFM_CHARTS_CONFIDENCE_OUTCOME_DIAGNOSTIC_MIN,
    brierScore: metrics.brierScore,
    logLoss: metrics.logLoss,
    expectedCalibrationError: metrics.expectedCalibrationError,
    positiveCount: metrics.positiveCount,
    negativeCount: metrics.negativeCount,
    note:
      "Confidence↔outcome diagnostics only. Does not produce estimated win probability. "
      + "Brier/log-loss here measure analytical-confidence alignment, not probability calibration. "
      + "Charts path remains skipProbability / NOT_AVAILABLE for statistical probability.",
  };

  const warnings = [
    "CENSUS_ONLY_NOT_CALIBRATED",
    "ANALYTICAL_CONFIDENCE_NOT_WIN_PROBABILITY",
    "DIAGNOSTIC_USES_CONFIDENCE_NOT_EVENT_PROBABILITY",
    "UNKNOWN_BUCKET_EXCLUDED_FROM_CALIBRATION",
    `CONFIDENCE_OUTCOME_DIAGNOSTIC_STATUS=${diagStatus}`,
  ];
  if (diagStatus === "INSUFFICIENT_DATA" || diagStatus === "NO_PAIRS") {
    warnings.push("CONFIDENCE_OUTCOME_DIAGNOSTIC_INSUFFICIENT_SAMPLE");
  }
  if (diagStatus === "PROVISIONAL_DIAGNOSTIC") {
    warnings.push("CONFIDENCE_OUTCOME_DIAGNOSTIC_PROVISIONAL");
  }
  if (diagStatus === "DIAGNOSTIC_READY_NOT_PROBABILITY_CALIBRATION") {
    warnings.push("CONFIDENCE_OUTCOME_DIAGNOSTIC_READY_STILL_NOT_PROBABILITY");
  }
  if (evaluations.length === 0) warnings.push("NO_EVALUATION_RECORDS");

  return {
    schemaVersion: "1",
    generatedAt,
    note:
      "P8.E / Phase 03 calibration census. Not calibrated win-probability performance. "
      + "Analytical confidence is a non-probability score. "
      + "Brier/log-loss when present diagnose confidence↔outcome alignment only. "
      + "Minimum 100 eligible observations per bucket before COUNT_MET_NOT_CALIBRATED.",
    confidenceSemantics: HFM_CHARTS_CONFIDENCE_SEMANTICS,
    totalEvaluations: evaluations.length,
    withValidConfidence,
    withoutValidConfidence,
    confidenceSources,
    unavailableReasons,
    buckets,
    strictEligibleByBucket,
    minSamplePerBucket: 100,
    bucketReadiness,
    confidenceOutcomeDiagnostics,
    evaluatorVersions,
    signedRPolicyVersions,
    symbols,
    timeframes,
    directions,
    warnings,
    ...SAFETY,
  };
}

export async function buildChartsCalibrationCensusFromStorage(input?: {
  storage?: HfmChartsPredictionOutcomeStorage;
  maxRecords?: number;
}): Promise<HfmChartsCalibrationCensusReport> {
  const storage = input?.storage ?? getHfmChartsPredictionOutcomeStorage();
  const loaded = await loadProductionEligibleChartsEvaluations({
    chartsStorage: storage,
    maxRecords: input?.maxRecords ?? 10_000,
  });
  const report = buildChartsCalibrationCensus(loaded.included);
  return {
    ...report,
    productionEligibility: loaded.diagnostics,
    warnings: [
      ...report.warnings,
      ...(loaded.diagnostics.excludedNonProduction > 0
        ? [
            `Excluded ${loaded.diagnostics.excludedNonProduction} non-production evaluation(s) from census (server provenance).`,
          ]
        : []),
      ...(loaded.diagnostics.legacyUnmarkedIncluded > 0
        ? [
            `Included ${loaded.diagnostics.legacyUnmarkedIncluded} legacy unmarked evaluation(s) conservatively.`,
          ]
        : []),
    ],
  };
}
