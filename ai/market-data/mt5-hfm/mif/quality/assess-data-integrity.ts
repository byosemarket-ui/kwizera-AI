/**
 * Phase 5B.2 Step 1 — scoped data-integrity + gap + coverage assessment.
 * Does not approve AI reasoning. Does not replace Phase 2 quality.
 * Does not produce unified overall MIF quality (Step 3).
 */
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import {
  MIF_QUALITY_CONTRACT_ID,
  MIF_QUALITY_CONTRACT_VERSION,
  MIF_QUALITY_STEP1_ENGINE_ID,
  MIF_QUALITY_STEP1_ENGINE_VERSION,
  MIF_QUALITY_STEP1_POLICY_ID,
  MIF_QUALITY_STEP1_POLICY_VERSION,
} from "./contracts.js";
import {
  MIF_QI_SYMBOL_MISMATCH,
  MIF_QI_TIMEFRAME_MISMATCH,
  MIF_QI_TIMEBASE_UNCERTAIN,
  type MifQualityFindingCode,
} from "./codes.js";
import { validateCandleInterval } from "./candle-interval-validator.js";
import { validateCandleChronology } from "./chronology-validator.js";
import { assessCandleCoverage } from "./coverage-assessor.js";
import { detectDuplicateCandles } from "./duplicate-detector.js";
import { detectCandleGaps } from "./gap-detector.js";
import { validateCandleOhlcIntegrity } from "./ohlc-validator.js";
import { sessionCalendarUncertaintyFinding } from "./session-uncertainty.js";
import { computeStep1InputIdentity } from "./stable-identity.js";
import type {
  AssessDataIntegrityInput,
  MifQualityFinding,
  MifQualityMetric,
  MifStep1DataIntegrityAssessment,
  MifStep1IntegrityStatus,
} from "./types.js";

function deriveStatus(findings: MifQualityFinding[]): MifStep1IntegrityStatus {
  let status: MifStep1IntegrityStatus = "VALID";
  for (const f of findings) {
    if (f.severity === "blocking") return "BLOCKED";
    if (f.severity === "degraded") status = status === "BLOCKED" ? status : "DEGRADED";
    else if (f.severity === "warning" && status === "VALID") status = "WARNING";
  }
  // precedence enforced: if we saw degraded after setting warning, upgrade
  if (findings.some((f) => f.severity === "degraded") && status !== "BLOCKED") {
    status = "DEGRADED";
  }
  if (findings.some((f) => f.severity === "blocking")) return "BLOCKED";
  return status;
}

function uniqueCodes(
  findings: MifQualityFinding[],
  pred: (f: MifQualityFinding) => boolean,
): MifQualityFindingCode[] {
  const out: MifQualityFindingCode[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    if (!pred(f)) continue;
    if (seen.has(f.code)) continue;
    seen.add(f.code);
    out.push(f.code);
  }
  return out;
}

/**
 * Assess canonical HFM candle series for Step 1 integrity / gaps / coverage.
 */
export function assessMifDataIntegrity(
  input: AssessDataIntegrityInput,
): MifStep1DataIntegrityAssessment {
  const candles = input.candles;
  const symbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim();
  const policyId = input.policyId ?? MIF_QUALITY_STEP1_POLICY_ID;
  const policyVersion = input.policyVersion ?? MIF_QUALITY_STEP1_POLICY_VERSION;
  const authority = input.expectedIntervalAuthority ?? null;

  const findings: MifQualityFinding[] = [];

  // Per-candle OHLC + interval
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]!;
    findings.push(...validateCandleOhlcIntegrity(c, i));
    findings.push(...validateCandleInterval(c, i, timeframe));
    if (c.providerSymbol && c.providerSymbol.toUpperCase() !== symbol) {
      findings.push({
        code: MIF_QI_SYMBOL_MISMATCH,
        severity: "blocking",
        message: `candle symbol ${c.providerSymbol} != ${symbol}`,
        candleIndex: i,
        openTimeSec: c.openTimeSec,
        candleState: c.candleState,
      });
    }
    if (c.timeframe && c.timeframe !== timeframe && c.timeframe.toUpperCase() !== timeframe.toUpperCase()) {
      findings.push({
        code: MIF_QI_TIMEFRAME_MISMATCH,
        severity: "blocking",
        message: `candle timeframe ${c.timeframe} != ${timeframe}`,
        candleIndex: i,
        openTimeSec: c.openTimeSec,
        candleState: c.candleState,
      });
    }
    if (c.providerId !== MIF_PROVIDER_ID) {
      // already emitted in ohlc validator; keep single path
    }
  }

  if (!symbol) {
    findings.push({
      code: MIF_QI_SYMBOL_MISMATCH,
      severity: "blocking",
      message: "providerSymbol empty",
    });
  }

  findings.push(...detectDuplicateCandles(candles, timeframe));
  const chrono = validateCandleChronology(candles, timeframe);
  findings.push(...chrono.findings);

  if (chrono.timebase === "UNKNOWN") {
    findings.push({
      code: MIF_QI_TIMEBASE_UNCERTAIN,
      severity: "warning",
      message: "series timebase is UNKNOWN; cross-domain clock claims are not made",
    });
  }

  const sessionFinding = sessionCalendarUncertaintyFinding(authority);
  if (sessionFinding) findings.push(sessionFinding);

  const gaps = detectCandleGaps({
    candles,
    timeframe,
    providerSymbol: symbol,
    authority,
  });
  findings.push(...gaps.findings);

  const coverage = assessCandleCoverage({
    candles,
    timeframe,
    requirement: input.coverageRequirement ?? null,
  });
  findings.push(...coverage.findings);
  gaps.counters.insufficientHistoryCount += coverage.insufficientHistoryCount;

  const status = deriveStatus(findings);
  const inputIdentity = computeStep1InputIdentity({
    candles,
    providerSymbol: symbol,
    timeframe,
    engineId: MIF_QUALITY_STEP1_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP1_ENGINE_VERSION,
    policyId,
    policyVersion,
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    coverageRequirement: input.coverageRequirement ?? null,
    authorityId: authority?.authorityId ?? null,
    authorityVersion: authority?.authorityVersion ?? null,
  });

  const metrics: MifQualityMetric[] = [
    {
      metricId: "observed_candle_count",
      value: coverage.coverage.observedCandleCount,
      unit: "count",
      status: "ok",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "valid_candle_count",
      value: coverage.coverage.validCandleCount,
      unit: "count",
      status: coverage.coverage.satisfiesExplicitRequirement === false ? "degraded" : "ok",
      threshold: coverage.coverage.requiredMinValidCandles,
      thresholdSource: coverage.coverage.requiredMinValidCandles != null
        ? "explicit_consumer"
        : "none",
      reasonCode: null,
    },
    {
      metricId: "confirmed_missing_count",
      value: gaps.counters.confirmedMissingCount,
      unit: "count",
      status: gaps.counters.confirmedMissingCount > 0 ? "degraded" : "ok",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "possible_missing_count",
      value: gaps.counters.possibleMissingCount,
      unit: "count",
      status: gaps.counters.possibleMissingCount > 0 ? "uncertain" : "ok",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "unknown_session_gap_count",
      value: gaps.counters.unknownSessionGapCount,
      unit: "count",
      status: gaps.counters.unknownSessionGapCount > 0 ? "uncertain" : "ok",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
    {
      metricId: "ordering_valid",
      value: chrono.orderingValid,
      unit: "boolean",
      status: chrono.orderingValid ? "ok" : "blocked",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
  ];

  const blockingCodes = uniqueCodes(findings, (f) => f.severity === "blocking");
  const warningCodes = uniqueCodes(
    findings,
    (f) => f.severity === "warning" || f.severity === "info",
  );
  const uncertaintyCodes = uniqueCodes(
    findings,
    (f) =>
      f.code === "NO_AUTHORITATIVE_SESSION_CALENDAR" ||
      f.code === "UNKNOWN_SESSION_GAP" ||
      f.code === "POSSIBLE_GAP" ||
      f.code === "TIMEBASE_UNCERTAIN" ||
      f.code === "DURATION_UNSUPPORTED" ||
      f.code === "COVERAGE_OBSERVED_RANGE_ONLY" ||
      f.code === "GAP_DETECTION_SKIPPED",
  );

  // Instrument ref from first candle with instrument, if any.
  const withInst = candles.find((c) => c.instrument != null)?.instrument ?? null;

  const diagnosticsSummary = [
    `step1 status=${status}`,
    `observed=${coverage.coverage.observedCandleCount}`,
    `valid=${coverage.coverage.validCandleCount}`,
    `confirmedMissing=${gaps.counters.confirmedMissingCount}`,
    `possibleMissing=${gaps.counters.possibleMissingCount}`,
    `unknownSessionGap=${gaps.counters.unknownSessionGapCount}`,
    `orderingValid=${chrono.orderingValid}`,
    `blocks=${blockingCodes.length}`,
  ].join("; ");

  return {
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    assessmentId: input.assessmentId ?? `step1:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    scope: "step1-data-integrity",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: symbol,
    timeframe,
    timebase: chrono.timebase,
    instrumentRef: withInst
      ? {
          providerSymbol: withInst.providerSymbol,
          catalogVersion: withInst.catalogVersion,
          digits: withInst.digits,
          point: withInst.point,
          tickSize: withInst.tickSize,
        }
      : null,
    assessmentTimestamp: input.assessmentTimestamp ?? new Date().toISOString(),
    policyId,
    policyVersion,
    engineId: MIF_QUALITY_STEP1_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP1_ENGINE_VERSION,
    status,
    metrics,
    findings,
    warningCodes,
    blockingCodes,
    uncertaintyCodes,
    gapCounters: gaps.counters,
    coverage: coverage.coverage,
    orderingValid: chrono.orderingValid,
    diagnosticsSummary,
    doesNotApproveAiReasoning: true,
    notUnifiedOverallAssessment: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}

/** Test helper: countCandidateOpensBetween re-export */
export { countCandidateOpensBetween } from "./gap-detector.js";
