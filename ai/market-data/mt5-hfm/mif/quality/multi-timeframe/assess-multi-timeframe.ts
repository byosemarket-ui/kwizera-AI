/**
 * Phase 5B.2 Step 2 — scoped multi-timeframe quality assessment.
 * Reuses Step 1 OHLC tip awareness via candle-state policy; does not run unified Step 3.
 */
import { createHash } from "node:crypto";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import {
  MIF_QUALITY_CONTRACT_ID,
  MIF_QUALITY_CONTRACT_VERSION,
  MIF_QUALITY_STEP2_MTF_ENGINE_ID,
  MIF_QUALITY_STEP2_MTF_ENGINE_VERSION,
} from "../contracts.js";
import {
  MIF_QI_CLOCK_DOMAINS_INCOMPARABLE,
  MIF_QI_MTF_ALIGNMENT_UNKNOWN,
  MIF_QI_MTF_SKEW_THRESHOLD_UNSET,
  MIF_QI_TIMEBASE_MIXED,
  MIF_QI_TIMEBASE_UNCERTAIN,
  MIF_QI_TIMEFRAME_UNSUPPORTED,
} from "../codes.js";
import { deriveScopedQualityStatus, uniqueFindingCodes } from "../status.js";
import { stableSerialize } from "../stable-identity.js";
import type { MifQualityFinding, MifQualityMetric } from "../types.js";
import { evaluateTipCandleStatePolicy } from "./candle-state-policy.js";
import { assessTimeframePresence } from "./missing-timeframes.js";
import { assessMultiTimeframeSynchronization } from "./synchronization.js";
import type {
  AssessMultiTimeframeQualityInput,
  MifMultiTimeframeQualityAssessment,
} from "./types.js";

function tipSlice(c: MifCanonicalCandle | undefined): Record<string, unknown> | null {
  if (!c) return null;
  return {
    openTimeSec: c.openTimeSec,
    closeTimeSec: c.closeTimeSec,
    candleState: c.candleState,
    timebase: c.timebase,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  };
}

function computeMtfInputIdentity(input: AssessMultiTimeframeQualityInput): string {
  const req = input.requirement;
  const seriesKeys = Object.keys(input.seriesByTimeframe).sort();
  const series: Record<string, unknown> = {};
  for (const tf of seriesKeys) {
    const arr = input.seriesByTimeframe[tf] ?? [];
    series[tf] = {
      count: arr.length,
      // Preserve original order in identity via open times list (bounded).
      opens: arr.map((c) => c.openTimeSec),
      tip: tipSlice(arr[arr.length - 1]),
    };
  }
  const payload = {
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    engineId: MIF_QUALITY_STEP2_MTF_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP2_MTF_ENGINE_VERSION,
    providerSymbol: String(input.providerSymbol || "").trim().toUpperCase(),
    requirement: {
      consumerId: req.consumerId,
      requiredTimeframes: [...req.requiredTimeframes],
      optionalTimeframes: [...(req.optionalTimeframes ?? [])],
      missingRequiredBlocks: req.missingRequiredBlocks !== false,
      candleStatePolicy: req.candleStatePolicy,
      maxTipSkewSec: req.maxTipSkewSec ?? null,
      skewBoundary: req.skewBoundary ?? "open",
    },
    series,
  };
  return createHash("sha256").update(stableSerialize(payload), "utf8").digest("hex");
}

export function assessMifMultiTimeframeQuality(
  input: AssessMultiTimeframeQualityInput,
): MifMultiTimeframeQualityAssessment {
  const symbol = String(input.providerSymbol || "").trim().toUpperCase();
  const findings: MifQualityFinding[] = [];
  const req = input.requirement;

  const presence = assessTimeframePresence({
    seriesByTimeframe: input.seriesByTimeframe,
    requirement: req,
  });
  findings.push(...presence.findings);

  // Candle-state policy on tips for required TFs that are present & non-empty.
  for (const tf of req.requiredTimeframes) {
    const series = input.seriesByTimeframe[tf];
    if (!series || series.length === 0) continue;
    const tip = series[series.length - 1]!;
    findings.push(
      ...evaluateTipCandleStatePolicy({
        timeframe: tf,
        tip,
        policy: req.candleStatePolicy,
      }),
    );
  }

  const syncTfs = [
    ...req.requiredTimeframes.filter((tf) => (input.seriesByTimeframe[tf]?.length ?? 0) > 0),
  ];
  const sync = assessMultiTimeframeSynchronization({
    seriesByTimeframe: input.seriesByTimeframe,
    timeframes: syncTfs,
    skewBoundary: req.skewBoundary ?? "open",
    maxTipSkewSec: req.maxTipSkewSec,
  });
  findings.push(...sync.findings);

  const status = deriveScopedQualityStatus(findings);
  const inputIdentity = computeMtfInputIdentity(input);

  const metrics: MifQualityMetric[] = [
    {
      metricId: "required_missing_count",
      value: presence.requiredMissing.length,
      unit: "count",
      status: presence.requiredMissing.length ? "blocked" : "ok",
      threshold: 0,
      thresholdSource: "explicit_consumer",
      reasonCode: null,
    },
    {
      metricId: "measured_skew_sec",
      value: sync.measuredSkewSec,
      unit: "seconds",
      status: sync.measuredSkewSec == null ? "uncertain" : "ok",
      threshold: req.maxTipSkewSec ?? null,
      thresholdSource: req.maxTipSkewSec != null ? "explicit_consumer" : "requires_owner_decision",
      reasonCode: null,
    },
    {
      metricId: "alignment",
      value: sync.alignment,
      unit: "enum",
      status:
        sync.alignment === "aligned"
          ? "ok"
          : sync.alignment === "incomparable"
            ? "blocked"
            : "uncertain",
      threshold: null,
      thresholdSource: "none",
      reasonCode: null,
    },
  ];

  return {
    contractId: MIF_QUALITY_CONTRACT_ID,
    contractVersion: MIF_QUALITY_CONTRACT_VERSION,
    scope: "step2-multi-timeframe-quality",
    assessmentId: input.assessmentId ?? `step2-mtf:${inputIdentity.slice(0, 16)}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol: symbol,
    consumerId: req.consumerId,
    engineId: MIF_QUALITY_STEP2_MTF_ENGINE_ID,
    engineVersion: MIF_QUALITY_STEP2_MTF_ENGINE_VERSION,
    assessmentTimestamp: input.assessmentTimestamp ?? new Date().toISOString(),
    status,
    suppliedTimeframes: presence.supplied,
    requiredTimeframes: [...req.requiredTimeframes],
    optionalTimeframes: [...(req.optionalTimeframes ?? [])],
    requiredMissing: presence.requiredMissing,
    optionalMissing: presence.optionalMissing,
    emptyTimeframes: presence.empty,
    unsupportedTimeframes: presence.unsupported,
    tipByTimeframe: sync.tips,
    measuredSkewSec: sync.measuredSkewSec,
    maxTipSkewSec: req.maxTipSkewSec ?? null,
    alignment: sync.alignment,
    timebase: sync.timebase,
    metrics,
    findings,
    warningCodes: uniqueFindingCodes(findings, (f) => f.severity === "warning" || f.severity === "info"),
    blockingCodes: uniqueFindingCodes(findings, (f) => f.severity === "blocking"),
    uncertaintyCodes: uniqueFindingCodes(
      findings,
      (f) =>
        f.code === MIF_QI_MTF_SKEW_THRESHOLD_UNSET ||
        f.code === MIF_QI_MTF_ALIGNMENT_UNKNOWN ||
        f.code === MIF_QI_TIMEBASE_UNCERTAIN ||
        f.code === MIF_QI_TIMEBASE_MIXED ||
        f.code === MIF_QI_CLOCK_DOMAINS_INCOMPARABLE ||
        f.code === MIF_QI_TIMEFRAME_UNSUPPORTED,
    ),
    diagnosticsSummary: `step2-mtf status=${status}; consumer=${req.consumerId}; skew=${sync.measuredSkewSec}; alignment=${sync.alignment}`,
    doesNotApproveAiReasoning: true,
    notUnifiedOverallAssessment: true,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
}
