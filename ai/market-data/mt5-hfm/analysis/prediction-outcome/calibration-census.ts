/**
 * P8.E F1 — read-only bounded calibration census over Charts evaluations.
 * Not calibrated performance. Confidence is a non-probability analytical score.
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

  const warnings = [
    "CENSUS_ONLY_NOT_CALIBRATED",
    "ANALYTICAL_CONFIDENCE_NOT_WIN_PROBABILITY",
    "CALIBRATION_MATH_NOT_IMPLEMENTED",
    "UNKNOWN_BUCKET_EXCLUDED_FROM_CALIBRATION",
  ];
  if (evaluations.length === 0) warnings.push("NO_EVALUATION_RECORDS");

  return {
    schemaVersion: "1",
    generatedAt,
    note:
      "P8.E F1 calibration census. Counts only. Not calibrated performance. "
      + "Analytical confidence is a non-probability score. "
      + "Minimum 100 eligible observations per bucket required before any future calibration.",
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
