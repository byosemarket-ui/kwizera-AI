/**
 * Phase 5D.5 — HFM_MT5 → canonical → MIF assessments → OD orchestrator.
 * Pure series path + live fetch wrapper. Read-only / analytical only.
 */
import { randomUUID } from "node:crypto";
import type { HfmHistoricalBar } from "../../historical-engine.js";
import { adaptHfmHistoricalBars } from "../adapters/historical-adapter.js";
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import type { MifCanonicalCandle } from "../canonical/candle.js";
import { assessMifFibonacci } from "../analysis/fibonacci/assess-fibonacci.js";
import { assessMifHarmonicPatterns } from "../analysis/harmonics/assess-harmonic-patterns.js";
import { assessMifLiquidityReference } from "../analysis/liquidity-reference/assess-liquidity-reference.js";
import { assessMifMarketStructure } from "../analysis/market-structure/assess-market-structure.js";
import { assessMifMomentum } from "../analysis/momentum/assess-momentum.js";
import { assessMifPriceDisplacement } from "../analysis/price-displacement/assess-price-displacement.js";
import { assessMifMultiTimeframeRelationships } from "../analysis/mtf-relationships/assess-mtf-relationships.js";
import type { MifMtfTimeframeSources } from "../analysis/mtf-relationships/types.js";
import { assessMifChartPatterns } from "../analysis/patterns/detect-chart-patterns.js";
import { assessMifMarketRegime } from "../analysis/regime/assess-market-regime.js";
import { assessMifSupportResistance } from "../analysis/support-resistance/assess-support-resistance.js";
import { assessMifUnifiedChartAnalysis } from "../analysis/unified/assess-unified-chart-analysis.js";
import { assessMifDataIntegrity } from "../quality/assess-data-integrity.js";
import { createHfmCatalogSessionAuthority } from "../quality/hfm-session-authority.js";
import type { MifExpectedIntervalAuthority } from "../quality/types.js";
import { runMifOpportunityDetection } from "../opportunity-detection/run-opportunity-detection.js";
import type { MifOpportunityDetectionContext } from "../opportunity-detection/types.js";
import { getDefaultMifStrategyIntelligenceRegistry } from "../strategy-intelligence/registry.js";
import { buildStrategyEvidenceSummaryFromContext } from "../opportunity-detection/evidence-summary.js";
import {
  applyEvidenceQualityToCandidates,
  assessMifEvidenceQuality,
} from "./evidence-quality.js";
import {
  MIF_PRODUCTION_CANDLE_LIMIT,
  MIF_PRODUCTION_DEFAULT_TIMEFRAMES,
  MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
  MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION,
  MIF_PRODUCTION_INTEGRATION_ENGINE_ID,
  MIF_PRODUCTION_INTEGRATION_ENGINE_VERSION,
  MIF_PRODUCTION_PRIMARY_TIMEFRAME,
} from "./contracts.js";
import { rankOpportunityCandidates } from "../opportunity-ranking/rank-candidates.js";
import { assessProbabilityIntelligenceBatch } from "../probability-intelligence/assess.js";
import { buildProductionEvidenceRefs } from "./build-evidence.js";
import {
  isSupportedProductionTimeframe,
  resolveAvailableTimeframeRoles,
} from "./timeframe-roles.js";
import type {
  MifProductionDataQualityDiagnostics,
  MifProductionFailureCode,
  MifProductionIntegrationResult,
  MifProductionLiveFetchInput,
  MifProductionPipelineFromSeriesInput,
  MifProductionTfAssessmentSnapshot,
  MifProductionTfSeriesInput,
} from "./types.js";

function safetyFlags() {
  return {
    placesOrders: false as const,
    mutatesBroker: false as const,
    acceptsForExecution: false as const,
    doesNotApproveAiReasoning: true as const,
    analyticalIntegrationOnly: true as const,
    notExecutable: true as const,
  };
}

function baseResult(
  partial: Omit<
    MifProductionIntegrationResult,
    keyof ReturnType<typeof safetyFlags> | "contractId" | "contractVersion" | "engineId" | "engineVersion" | "providerId"
  > &
    Partial<MifProductionIntegrationResult>,
): MifProductionIntegrationResult {
  return {
    contractId: MIF_PRODUCTION_INTEGRATION_CONTRACT_ID,
    contractVersion: MIF_PRODUCTION_INTEGRATION_CONTRACT_VERSION,
    engineId: MIF_PRODUCTION_INTEGRATION_ENGINE_ID,
    engineVersion: MIF_PRODUCTION_INTEGRATION_ENGINE_VERSION,
    providerId: MIF_PROVIDER_ID,
    ...safetyFlags(),
    ...partial,
    dataQualityDiagnostics: partial.dataQualityDiagnostics ?? null,
  };
}

function buildDataQualityDiagnostics(input: {
  dataQualityStatus: MifProductionIntegrationResult["dataQualityStatus"];
  analysisStatus: MifProductionIntegrationResult["analysisStatus"];
  snapshots: readonly MifProductionTfAssessmentSnapshot[];
}): MifProductionDataQualityDiagnostics {
  const perTimeframe = input.snapshots.map((s) => ({
    timeframe: s.timeframe,
    integrityStatus: s.dataIntegrityStatus,
    findingCodes: [...(s.integrityFindingCodes ?? [])],
  }));
  const primaryFindingCodes = [
    ...new Set(perTimeframe.flatMap((p) => p.findingCodes)),
  ];
  const sessionCalendarAuthorityMissing = primaryFindingCodes.includes(
    "NO_AUTHORITATIVE_SESSION_CALENDAR",
  );
  const driver =
    input.analysisStatus === "PARTIAL_DEGRADED"
      ? `analysisStatus=PARTIAL_DEGRADED because dataQualityStatus=${input.dataQualityStatus}`
        + (sessionCalendarAuthorityMissing
          ? "; primary integrity warning includes NO_AUTHORITATIVE_SESSION_CALENDAR (HFM catalog sessions unavailable or unusable)"
          : "; HFM catalog session authority attached when present — holidays remain unknown")
      : `analysisStatus=${input.analysisStatus}; dataQualityStatus=${input.dataQualityStatus}`;
  return {
    dataQualityStatus: input.dataQualityStatus,
    analysisStatusDriver: driver,
    perTimeframe,
    primaryFindingCodes,
    explanation: driver,
    sessionCalendarAuthorityMissing,
  };
}

function normalizeSymbol(symbol: string): string {
  return String(symbol || "").trim().toUpperCase();
}

function normalizeTf(tf: string): string {
  return String(tf || "").trim().toUpperCase();
}

function qualityGate(input: {
  quality: { kind: "step1-data-integrity"; assessment: ReturnType<typeof assessMifDataIntegrity> };
}) {
  return input;
}

function assessOneTf(input: {
  symbol: string;
  timeframe: string;
  candles: readonly MifCanonicalCandle[];
  assessmentTimestamp: string;
  expectedIntervalAuthority?: MifExpectedIntervalAuthority | null;
}): {
  integrity: ReturnType<typeof assessMifDataIntegrity>;
  regime: ReturnType<typeof assessMifMarketRegime>;
  fibonacci: ReturnType<typeof assessMifFibonacci>;
  chartPatterns: ReturnType<typeof assessMifChartPatterns>;
  harmonic: ReturnType<typeof assessMifHarmonicPatterns>;
  unified: ReturnType<typeof assessMifUnifiedChartAnalysis>;
  marketStructure: ReturnType<typeof assessMifMarketStructure>;
  supportResistance: ReturnType<typeof assessMifSupportResistance>;
  liquidityReference: ReturnType<typeof assessMifLiquidityReference>;
  momentum: ReturnType<typeof assessMifMomentum>;
  priceDisplacement: ReturnType<typeof assessMifPriceDisplacement>;
} {
  const integrity = assessMifDataIntegrity({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    assessmentTimestamp: input.assessmentTimestamp,
    expectedIntervalAuthority: input.expectedIntervalAuthority ?? null,
  });
  const quality = qualityGate({
    quality: { kind: "step1-data-integrity", assessment: integrity },
  }).quality;

  const marketStructure = assessMifMarketStructure({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const supportResistance = assessMifSupportResistance({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    marketStructure,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const liquidityReference = assessMifLiquidityReference({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    marketStructure,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const momentum = assessMifMomentum({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const priceDisplacement = assessMifPriceDisplacement({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    marketStructure,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const regime = assessMifMarketRegime({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const fibonacci = assessMifFibonacci({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const chartPatterns = assessMifChartPatterns({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const harmonic = assessMifHarmonicPatterns({
    candles: [...input.candles],
    providerSymbol: input.symbol,
    timeframe: input.timeframe,
    quality,
    assessmentTimestamp: input.assessmentTimestamp,
  });
  const unified = assessMifUnifiedChartAnalysis({
    pattern: chartPatterns,
    fibonacci,
    assessmentTimestamp: input.assessmentTimestamp,
  });

  return {
    integrity,
    regime,
    fibonacci,
    chartPatterns,
    harmonic,
    unified,
    marketStructure,
    supportResistance,
    liquidityReference,
    momentum,
    priceDisplacement,
  };
}

function adaptSeries(
  series: MifProductionTfSeriesInput,
  symbol: string,
): {
  candles: MifCanonicalCandle[];
  adapterFailures: number;
  errors: string[];
} {
  const tf = normalizeTf(series.timeframe);
  if (series.candles && series.candles.length) {
    const mismatches: string[] = [];
    for (const c of series.candles) {
      if (c.providerSymbol && c.providerSymbol.toUpperCase() !== symbol) {
        mismatches.push("INSTRUMENT_MISMATCH");
      }
      if (c.timeframe && normalizeTf(c.timeframe) !== tf) {
        mismatches.push("TIMEFRAME_MISMATCH");
      }
    }
    return {
      candles: [...series.candles],
      adapterFailures: 0,
      errors: [...new Set(mismatches), ...(series.errors ?? [])],
    };
  }
  const adapted = adaptHfmHistoricalBars([...series.bars], { symbol, timeframe: tf });
  const errors = [...(series.errors ?? [])];
  for (const f of adapted.failures) {
    errors.push(`${f.code}:${f.message}`);
  }
  return {
    candles: adapted.candles,
    adapterFailures: adapted.failures.length,
    errors,
  };
}

function deriveDataQualityStatus(
  statuses: readonly string[],
): "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING" {
  if (!statuses.length) return "MISSING";
  if (statuses.some((s) => s === "BLOCKED")) return "BLOCKED";
  if (statuses.some((s) => s === "DEGRADED")) return "DEGRADED";
  if (statuses.some((s) => s === "WARNING")) return "WARNING";
  if (statuses.every((s) => s === "VALID")) return "VALID";
  return "WARNING";
}

export interface MifProductionPipelineRunOpts {
  includeDebugContext?: boolean;
  persist?: boolean;
  /** Optional historical peers for Step 2 probability (never required; empty → insufficient). */
  historicalCandidates?: import("./persistence/types.js").MifPersistedCandidate[];
  historicalEvaluations?: import("./outcome-evaluation.js").MifOutcomeEvaluationRecord[];
}

/**
 * Core production path from already-retrieved HFM series (fixtures or live).
 */
export function runMifHfmOpportunityPipelineFromSeries(
  input: MifProductionPipelineFromSeriesInput,
  opts?: MifProductionPipelineRunOpts,
): MifProductionIntegrationResult {
  const processingTimestamp = new Date().toISOString();
  const requestId = String(input.requestId || "").trim() || randomUUID();
  const warnings: string[] = [];
  const errors: string[] = [];
  const failureCodes: MifProductionFailureCode[] = [];

  const providerId = String(input.providerId ?? MIF_PROVIDER_ID).trim().toUpperCase();
  if (providerId !== MIF_PROVIDER_ID) {
    failureCodes.push("WRONG_PROVIDER");
    return baseResult({
      requestId,
      providerSymbol: normalizeSymbol(input.providerSymbol),
      requestedTimeframes: [],
      resolvedTimeframes: [],
      primaryTimeframe: MIF_PRODUCTION_PRIMARY_TIMEFRAME,
      marketDataTimestamp: null,
      candleTimestampSec: null,
      candleLifecycle: null,
      dataFreshness: null,
      processingTimestamp,
      analysisStatus: "FAILED_VALIDATION",
      dataQualityStatus: "BLOCKED",
      availableTimeframeRoles: [],
      timeframeSnapshots: [],
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      detection: null,
      candidateCount: 0,
      warnings,
      errors: [`provider ${providerId} rejected; only HFM_MT5 permitted`],
      failureCodes,
      contextSummary: null,
    });
  }

  const symbol = normalizeSymbol(input.providerSymbol);
  if (!symbol) {
    failureCodes.push("INVALID_INSTRUMENT");
    return baseResult({
      requestId,
      providerSymbol: "",
      requestedTimeframes: [],
      resolvedTimeframes: [],
      primaryTimeframe: MIF_PRODUCTION_PRIMARY_TIMEFRAME,
      marketDataTimestamp: null,
      candleTimestampSec: null,
      candleLifecycle: null,
      dataFreshness: null,
      processingTimestamp,
      analysisStatus: "FAILED_VALIDATION",
      dataQualityStatus: "MISSING",
      availableTimeframeRoles: [],
      timeframeSnapshots: [],
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      detection: null,
      candidateCount: 0,
      warnings,
      errors: ["providerSymbol is required"],
      failureCodes,
      contextSummary: null,
    });
  }

  const requestedTimeframes = (input.timeframes?.length
    ? input.timeframes
    : input.series.map((s) => s.timeframe)
  ).map(normalizeTf);

  for (const tf of requestedTimeframes) {
    if (!isSupportedProductionTimeframe(tf)) {
      failureCodes.push("INVALID_TIMEFRAME");
      return baseResult({
        requestId,
        providerSymbol: symbol,
        requestedTimeframes,
        resolvedTimeframes: [],
        primaryTimeframe: MIF_PRODUCTION_PRIMARY_TIMEFRAME,
        marketDataTimestamp: null,
        candleTimestampSec: null,
        candleLifecycle: null,
        dataFreshness: null,
        processingTimestamp,
        analysisStatus: "FAILED_VALIDATION",
        dataQualityStatus: "MISSING",
        availableTimeframeRoles: [],
        timeframeSnapshots: [],
        mtfStatus: null,
        mtfRelation: null,
        eligibility: [],
        detection: null,
        candidateCount: 0,
        warnings,
        errors: [`unsupported timeframe ${tf}`],
        failureCodes,
        contextSummary: null,
      });
    }
  }

  const primaryTimeframe = normalizeTf(
    input.primaryTimeframe
      || (requestedTimeframes.includes(MIF_PRODUCTION_PRIMARY_TIMEFRAME)
        ? MIF_PRODUCTION_PRIMARY_TIMEFRAME
        : requestedTimeframes[0] || MIF_PRODUCTION_PRIMARY_TIMEFRAME),
  );

  const assessmentTimestamp = input.assessmentTimestamp ?? processingTimestamp;
  const seriesByTf = new Map<string, MifProductionTfSeriesInput>();
  for (const s of input.series) {
    seriesByTf.set(normalizeTf(s.timeframe), s);
  }

  const sessionAuthority: MifExpectedIntervalAuthority | null =
    input.expectedIntervalAuthority === undefined
      ? null
      : input.expectedIntervalAuthority;
  if (sessionAuthority) {
    warnings.push(
      `HFM session authority attached id=${sessionAuthority.authorityId}@${sessionAuthority.authorityVersion}`,
    );
  }

  const resolvedTimeframes: string[] = [];
  const snapshots: MifProductionTfAssessmentSnapshot[] = [];
  const mtfSources: MifMtfTimeframeSources[] = [];
  const integrityStatuses: string[] = [];
  let primaryBundle: ReturnType<typeof assessOneTf> | null = null;
  let primaryCandles: MifCanonicalCandle[] = [];
  let newestTipSec: number | null = null;
  let tipLifecycle: string | null = null;
  let dataFreshness: string | null = null;

  try {
    for (const tf of requestedTimeframes) {
      const series = seriesByTf.get(tf);
      if (!series) {
        errors.push(`${tf}: missing series`);
        failureCodes.push("MISSING_CANDLES");
        snapshots.push({
          timeframe: tf,
          barCount: 0,
          candleCount: 0,
          adapterFailures: 0,
          dataIntegrityStatus: null,
          regimeStatus: null,
          regimeDirection: null,
          regimeStructure: null,
          fibonacciStatus: null,
          chartPatternsStatus: null,
          harmonicStatus: null,
          unifiedStatus: null,
          tipCandleState: null,
          tipOpenTimeSec: null,
          newestTimestampSec: null,
          freshness: null,
          warnings: [],
          errors: ["missing series"],
        });
        continue;
      }

      if (!series.bars.length && !(series.candles && series.candles.length)) {
        errors.push(`${tf}: empty bars`);
        failureCodes.push("MISSING_CANDLES");
        snapshots.push({
          timeframe: tf,
          barCount: 0,
          candleCount: 0,
          adapterFailures: 0,
          dataIntegrityStatus: null,
          regimeStatus: null,
          regimeDirection: null,
          regimeStructure: null,
          fibonacciStatus: null,
          chartPatternsStatus: null,
          harmonicStatus: null,
          unifiedStatus: null,
          tipCandleState: null,
          tipOpenTimeSec: null,
          newestTimestampSec: series.newestTimestampSec ?? null,
          freshness: series.freshness ?? null,
          warnings: [],
          errors: ["empty bars"],
        });
        continue;
      }

      const adapted = adaptSeries(series, symbol);
      if (adapted.errors.some((e) => e.startsWith("INSTRUMENT_MISMATCH"))) {
        failureCodes.push("INSTRUMENT_MISMATCH");
      }
      if (adapted.errors.some((e) => e.startsWith("TIMEFRAME_MISMATCH"))) {
        failureCodes.push("TIMEFRAME_MISMATCH");
      }
      if (adapted.adapterFailures > 0) {
        failureCodes.push("INVALID_OHLC");
        warnings.push(`${tf}: ${adapted.adapterFailures} adapter failures`);
      }
      if (!adapted.candles.length) {
        errors.push(`${tf}: no valid canonical candles`);
        failureCodes.push("INVALID_OHLC");
        snapshots.push({
          timeframe: tf,
          barCount: series.bars.length,
          candleCount: 0,
          adapterFailures: adapted.adapterFailures,
          dataIntegrityStatus: null,
          regimeStatus: null,
          regimeDirection: null,
          regimeStructure: null,
          fibonacciStatus: null,
          chartPatternsStatus: null,
          harmonicStatus: null,
          unifiedStatus: null,
          tipCandleState: null,
          tipOpenTimeSec: null,
          newestTimestampSec: series.newestTimestampSec ?? null,
          freshness: series.freshness ?? null,
          warnings: [],
          errors: adapted.errors,
        });
        continue;
      }

      // Optional stale gate against assessment wall clock
      const tip = adapted.candles[adapted.candles.length - 1]!;
      if (
        typeof input.maxCandleAgeSec === "number"
        && Number.isFinite(input.maxCandleAgeSec)
        && tip.closeTimeSec != null
      ) {
        const assessSec = Math.floor(Date.parse(assessmentTimestamp) / 1000);
        if (Number.isFinite(assessSec) && assessSec - tip.closeTimeSec > input.maxCandleAgeSec) {
          failureCodes.push("STALE_CANDLES");
          errors.push(`${tf}: stale tip closeTimeSec=${tip.closeTimeSec}`);
        }
      }

      const bundle = assessOneTf({
        symbol,
        timeframe: tf,
        candles: adapted.candles,
        assessmentTimestamp,
        expectedIntervalAuthority: sessionAuthority,
      });

      integrityStatuses.push(bundle.integrity.status);
      resolvedTimeframes.push(tf);
      if (tf === primaryTimeframe) {
        primaryBundle = bundle;
        primaryCandles = adapted.candles;
      }
      if (newestTipSec == null || (tip.openTimeSec != null && tip.openTimeSec > newestTipSec)) {
        newestTipSec = tip.openTimeSec;
        tipLifecycle = tip.candleState;
      }
      if (series.freshness) dataFreshness = series.freshness;

      const integrityCodes = [
        ...new Set(
          (bundle.integrity.findings ?? [])
            .filter((f) => f.severity === "warning" || f.severity === "degraded" || f.severity === "blocking")
            .map((f) => String(f.code)),
        ),
      ];
      const integrityMsgs = (bundle.integrity.findings ?? [])
        .filter((f) => f.severity === "warning" || f.severity === "degraded" || f.severity === "blocking")
        .slice(0, 8)
        .map((f) => `${f.code}: ${f.message}`);
      snapshots.push({
        timeframe: tf,
        barCount: series.bars.length,
        candleCount: adapted.candles.length,
        adapterFailures: adapted.adapterFailures,
        dataIntegrityStatus: bundle.integrity.status,
        integrityFindingCodes: integrityCodes,
        regimeStatus: bundle.regime.status,
        regimeDirection: bundle.regime.direction,
        regimeStructure: bundle.regime.structure,
        fibonacciStatus: bundle.fibonacci.status,
        chartPatternsStatus: bundle.chartPatterns.status,
        harmonicStatus: bundle.harmonic.status,
        unifiedStatus: bundle.unified.status,
        tipCandleState: tip.candleState,
        tipOpenTimeSec: tip.openTimeSec,
        newestTimestampSec: series.newestTimestampSec ?? tip.openTimeSec,
        freshness: series.freshness ?? null,
        warnings: [
          ...adapted.errors.filter((e) => !e.startsWith("INVALID")),
          ...integrityMsgs,
        ],
        errors: adapted.errors.filter((e) => e.startsWith("INVALID") || e.includes("MISMATCH")),
      });

      mtfSources.push({
        timeframe: tf,
        providerSymbol: symbol,
        regime: bundle.regime,
        harmonic: bundle.harmonic,
        fibonacci: bundle.fibonacci,
        chartPatterns: bundle.chartPatterns,
        unified: bundle.unified,
        tipCandleState: tip.candleState,
        tipTimebase: tip.timebase,
        tipOpenTimeSec: tip.openTimeSec,
        qualityStatus: bundle.integrity.status === "VALID" || bundle.integrity.status === "WARNING"
          || bundle.integrity.status === "DEGRADED" || bundle.integrity.status === "BLOCKED"
          ? bundle.integrity.status
          : "MISSING",
      });
    }
  } catch (err) {
    failureCodes.push("ASSESSMENT_ERROR");
    return baseResult({
      requestId,
      providerSymbol: symbol,
      requestedTimeframes,
      resolvedTimeframes,
      primaryTimeframe,
      marketDataTimestamp: assessmentTimestamp,
      candleTimestampSec: newestTipSec,
      candleLifecycle: tipLifecycle,
      dataFreshness,
      processingTimestamp,
      analysisStatus: "FAILED_ASSESSMENT",
      dataQualityStatus: "BLOCKED",
      availableTimeframeRoles: resolveAvailableTimeframeRoles(resolvedTimeframes),
      timeframeSnapshots: snapshots,
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      detection: null,
      candidateCount: 0,
      warnings,
      errors: [...errors, err instanceof Error ? err.message : String(err)],
      failureCodes,
      contextSummary: null,
    });
  }

  // Critical upstream failures must not become successful empty analysis
  if (
    failureCodes.includes("INSTRUMENT_MISMATCH")
    || failureCodes.includes("TIMEFRAME_MISMATCH")
  ) {
    return baseResult({
      requestId,
      providerSymbol: symbol,
      requestedTimeframes,
      resolvedTimeframes,
      primaryTimeframe,
      marketDataTimestamp: assessmentTimestamp,
      candleTimestampSec: newestTipSec,
      candleLifecycle: tipLifecycle,
      dataFreshness,
      processingTimestamp,
      analysisStatus: "FAILED_UPSTREAM_DATA",
      dataQualityStatus: "BLOCKED",
      availableTimeframeRoles: resolveAvailableTimeframeRoles(resolvedTimeframes),
      timeframeSnapshots: snapshots,
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      detection: null,
      candidateCount: 0,
      warnings,
      errors: errors.length ? errors : ["identity inconsistency in source series"],
      failureCodes,
      contextSummary: null,
    });
  }

  if (!primaryBundle || !primaryCandles.length) {
    // Fall back to first resolved if primary missing
    if (resolvedTimeframes.length && snapshots.length) {
      const fallbackTf = resolvedTimeframes[0]!;
      const series = seriesByTf.get(fallbackTf)!;
      const adapted = adaptSeries(series, symbol);
      primaryCandles = adapted.candles;
      primaryBundle = assessOneTf({
        symbol,
        timeframe: fallbackTf,
        candles: adapted.candles,
        assessmentTimestamp,
        expectedIntervalAuthority: sessionAuthority,
      });
      warnings.push(`primary timeframe ${primaryTimeframe} unavailable; using ${fallbackTf}`);
    }
  }

  if (!primaryBundle || !primaryCandles.length) {
    failureCodes.push("MISSING_CANDLES");
    return baseResult({
      requestId,
      providerSymbol: symbol,
      requestedTimeframes,
      resolvedTimeframes,
      primaryTimeframe,
      marketDataTimestamp: assessmentTimestamp,
      candleTimestampSec: newestTipSec,
      candleLifecycle: tipLifecycle,
      dataFreshness,
      processingTimestamp,
      analysisStatus: "FAILED_UPSTREAM_DATA",
      dataQualityStatus: "MISSING",
      availableTimeframeRoles: [],
      timeframeSnapshots: snapshots,
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      detection: null,
      candidateCount: 0,
      warnings,
      errors: errors.length ? errors : ["no usable primary series"],
      failureCodes,
      contextSummary: null,
    });
  }

  if (failureCodes.includes("STALE_CANDLES") && !resolvedTimeframes.length) {
    return baseResult({
      requestId,
      providerSymbol: symbol,
      requestedTimeframes,
      resolvedTimeframes,
      primaryTimeframe,
      marketDataTimestamp: assessmentTimestamp,
      candleTimestampSec: newestTipSec,
      candleLifecycle: tipLifecycle,
      dataFreshness,
      processingTimestamp,
      analysisStatus: "FAILED_UPSTREAM_DATA",
      dataQualityStatus: "BLOCKED",
      availableTimeframeRoles: [],
      timeframeSnapshots: snapshots,
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      detection: null,
      candidateCount: 0,
      warnings,
      errors,
      failureCodes,
      contextSummary: null,
    });
  }

  let mtf: ReturnType<typeof assessMifMultiTimeframeRelationships>;
  try {
    mtf = assessMifMultiTimeframeRelationships({
      sources: mtfSources,
      providerSymbol: symbol,
      instrument: input.instrument ?? null,
      assessmentTimestamp,
    });
  } catch (err) {
    failureCodes.push("ASSESSMENT_ERROR");
    return baseResult({
      requestId,
      providerSymbol: symbol,
      requestedTimeframes,
      resolvedTimeframes,
      primaryTimeframe,
      marketDataTimestamp: assessmentTimestamp,
      candleTimestampSec: newestTipSec,
      candleLifecycle: tipLifecycle,
      dataFreshness,
      processingTimestamp,
      analysisStatus: "FAILED_ASSESSMENT",
      dataQualityStatus: deriveDataQualityStatus(integrityStatuses),
      availableTimeframeRoles: resolveAvailableTimeframeRoles(resolvedTimeframes),
      timeframeSnapshots: snapshots,
      mtfStatus: null,
      mtfRelation: null,
      eligibility: [],
      detection: null,
      candidateCount: 0,
      warnings,
      errors: [...errors, err instanceof Error ? err.message : String(err)],
      failureCodes,
      contextSummary: null,
    });
  }

  const dataQualityStatus = deriveDataQualityStatus(integrityStatuses);
  if (dataQualityStatus === "BLOCKED") {
    failureCodes.push("QUALITY_BLOCKED");
  }

  const availableTimeframeRoles = resolveAvailableTimeframeRoles(resolvedTimeframes);
  const evidencePrimaryTf = resolvedTimeframes.includes(primaryTimeframe)
    ? primaryTimeframe
    : (resolvedTimeframes[0] ?? primaryTimeframe);

  const evidence = buildProductionEvidenceRefs({
    primaryTimeframe: evidencePrimaryTf,
    assessmentTimestamp,
    dataQualityStatus,
    integrity: primaryBundle.integrity,
    regime: primaryBundle.regime,
    fibonacci: primaryBundle.fibonacci,
    chartPatterns: primaryBundle.chartPatterns,
    harmonic: primaryBundle.harmonic,
    unified: primaryBundle.unified,
    mtf,
    marketStructure: primaryBundle.marketStructure,
    supportResistance: primaryBundle.supportResistance,
    liquidityReference: primaryBundle.liquidityReference,
    momentum: primaryBundle.momentum,
    priceDisplacement: primaryBundle.priceDisplacement,
    primaryCandles,
  });

  const context: MifOpportunityDetectionContext = {
    contextVersion: "1.0.0",
    providerId: MIF_PROVIDER_ID,
    providerSymbol: symbol,
    instrument: input.instrument ?? null,
    assessmentTimestamp,
    timebase: primaryCandles[primaryCandles.length - 1]?.timebase ?? "BROKER_SERVER",
    dataQualityStatus,
    availableTimeframeRoles,
    evidence,
    regime: primaryBundle.regime,
    harmonic: primaryBundle.harmonic,
    fibonacci: primaryBundle.fibonacci,
    chartPatterns: primaryBundle.chartPatterns,
    unified: primaryBundle.unified,
    mtfRelationships: mtf,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDetectionContextOnly: true,
  };

  const summary = buildStrategyEvidenceSummaryFromContext(context);
  const strategyReg = getDefaultMifStrategyIntelligenceRegistry();
  const eligibility = strategyReg.listStrategies().map((s) =>
    strategyReg.evaluateEligibility(s.strategyId, summary)
  );

  let detection: ReturnType<typeof runMifOpportunityDetection> | null = null;
  try {
    detection = runMifOpportunityDetection({ context });
    const eq = assessMifEvidenceQuality({
      context,
      eligibility,
      candidates: detection.candidates,
      assessmentTimestamp,
    });
    if (eq.analysisImpact === "FAIL_ANALYSIS") {
      failureCodes.push("QUALITY_BLOCKED");
    }
    const adjusted = applyEvidenceQualityToCandidates(detection.candidates, eq);
    detection = {
      ...detection,
      candidates: adjusted.candidates,
    };
    (detection as { _evidenceQuality?: typeof eq })._evidenceQuality = eq;
  } catch (err) {
    failureCodes.push("ORCHESTRATOR_ERROR");
    return baseResult({
      requestId,
      providerSymbol: symbol,
      requestedTimeframes,
      resolvedTimeframes,
      primaryTimeframe,
      marketDataTimestamp: assessmentTimestamp,
      candleTimestampSec: newestTipSec,
      candleLifecycle: tipLifecycle,
      dataFreshness,
      processingTimestamp,
      analysisStatus: "FAILED_ORCHESTRATOR",
      dataQualityStatus,
      availableTimeframeRoles,
      timeframeSnapshots: snapshots,
      mtfStatus: mtf.status,
      mtfRelation: mtf.directional.relation,
      eligibility,
      detection: null,
      candidateCount: 0,
      warnings,
      errors: [...errors, err instanceof Error ? err.message : String(err)],
      failureCodes,
      contextSummary: {
        evidenceCount: evidence.length,
        assessmentTimestamp,
        hasRegime: true,
        hasMtf: true,
        hasFibonacci: true,
        hasChartPatterns: true,
        hasHarmonic: true,
        hasUnified: true,
        hasMarketStructure: !!primaryBundle.marketStructure,
        hasSupportResistance: !!primaryBundle.supportResistance,
        hasLiquidityReference: !!primaryBundle.liquidityReference,
        hasMomentum: !!primaryBundle.momentum,
        hasPriceDisplacement: !!primaryBundle.priceDisplacement,
      },
      ...(opts?.includeDebugContext ? { _debugContext: context } : {}),
    });
  }

  const evidenceQualityRaw = (detection as { _evidenceQuality?: ReturnType<typeof assessMifEvidenceQuality> })
    ._evidenceQuality ?? null;
  const evidenceQuality = evidenceQualityRaw
    ? {
        overallBand: evidenceQualityRaw.overallBand,
        analysisImpact: evidenceQualityRaw.analysisImpact,
        explanation: evidenceQualityRaw.explanation,
        dataQuality: evidenceQualityRaw.dataQuality,
        evidenceCompleteness: evidenceQualityRaw.evidenceCompleteness,
        mtfAgreement: evidenceQualityRaw.mtfAgreement,
        partialSourceFamilies: evidenceQualityRaw.partialSourceFamilies,
        executionReadiness: false as const,
        notWinProbability: true as const,
      }
    : null;

  // Distinguish empty vs insufficient vs degraded vs failed
  const eligibleCount = eligibility.filter((e) => e.status === "ELIGIBLE_FOR_DETECTION").length;
  const insufficientCount = eligibility.filter((e) => e.status === "INSUFFICIENT_EVIDENCE").length;
  const candidateCount = detection.candidates.length;

  let analysisStatus: MifProductionIntegrationResult["analysisStatus"] = "OK";
  if (dataQualityStatus === "BLOCKED" || evidenceQualityRaw?.analysisImpact === "FAIL_ANALYSIS") {
    analysisStatus = "FAILED_UPSTREAM_DATA";
  } else if (failureCodes.includes("STALE_CANDLES") || failureCodes.includes("INVALID_OHLC")) {
    analysisStatus = "PARTIAL_DEGRADED";
  } else if (
    evidenceQualityRaw?.analysisImpact === "PARTIAL_DEGRADED"
    || evidenceQualityRaw?.analysisImpact === "FORCE_NEEDS_CONFIRMATION"
  ) {
    analysisStatus = "PARTIAL_DEGRADED";
  } else if (candidateCount === 0 && eligibleCount === 0 && insufficientCount > 0) {
    analysisStatus = "INSUFFICIENT_EVIDENCE";
  } else if (candidateCount === 0) {
    analysisStatus = "OK_EMPTY_CANDIDATES";
  } else if (dataQualityStatus === "DEGRADED" || dataQualityStatus === "WARNING") {
    analysisStatus = "PARTIAL_DEGRADED";
  }

  // Serialization self-check
  try {
    JSON.stringify({
      candidates: detection.candidates,
      outcomes: detection.outcomes.map((o) => ({
        strategyId: o.strategyId,
        status: o.status,
        detectorId: o.detectorId,
      })),
    });
  } catch (err) {
    failureCodes.push("SERIALIZATION_ERROR");
    return baseResult({
      requestId,
      providerSymbol: symbol,
      requestedTimeframes,
      resolvedTimeframes,
      primaryTimeframe,
      marketDataTimestamp: assessmentTimestamp,
      candleTimestampSec: newestTipSec,
      candleLifecycle: tipLifecycle,
      dataFreshness,
      processingTimestamp,
      analysisStatus: "FAILED_SERIALIZATION",
      dataQualityStatus,
      availableTimeframeRoles,
      timeframeSnapshots: snapshots,
      mtfStatus: mtf.status,
      mtfRelation: mtf.directional.relation,
      eligibility,
      detection: null,
      candidateCount: 0,
      warnings,
      errors: [...errors, err instanceof Error ? err.message : String(err)],
      failureCodes,
      contextSummary: {
        evidenceCount: evidence.length,
        assessmentTimestamp,
        hasRegime: true,
        hasMtf: true,
        hasFibonacci: true,
        hasChartPatterns: true,
        hasHarmonic: true,
        hasUnified: true,
        hasMarketStructure: !!primaryBundle.marketStructure,
        hasSupportResistance: !!primaryBundle.supportResistance,
        hasLiquidityReference: !!primaryBundle.liquidityReference,
        hasMomentum: !!primaryBundle.momentum,
        hasPriceDisplacement: !!primaryBundle.priceDisplacement,
      },
    });
  }

  // Phase 5E Step 1 — analytical ranking (never mutates candidates)
  let rankingSummary: MifProductionIntegrationResult["ranking"] = null;
  let rankingRunFull: ReturnType<typeof rankOpportunityCandidates> | null = null;
  try {
    rankingRunFull = rankOpportunityCandidates({
      candidates: detection.candidates,
      evidence,
      dataQualityStatus,
      mtfRelation: mtf.directional.relation,
      regimeStructure: primaryBundle.regime.structure,
      regimeDirection: primaryBundle.regime.direction,
      analysisRunId: requestId,
      providerSymbol: symbol,
      primaryTimeframe,
      rankedAt: processingTimestamp,
    });
    rankingSummary = {
      rankingRunId: rankingRunFull.rankingRunId,
      rankedCount: rankingRunFull.rankedCount,
      blockedCount: rankingRunFull.blockedCount,
      insufficientCount: rankingRunFull.insufficientCount,
      top: rankingRunFull.rankings.slice(0, 20).map((r) => ({
        candidateId: r.candidateId,
        strategyId: String(r.strategyId),
        rankPosition: r.rankPosition,
        overallScore: r.overallScore,
        scoreBand: r.scoreBand,
        rankingEligibility: r.rankingEligibility,
      })),
      isWinProbability: false,
      executionReadiness: false,
    };
  } catch (err) {
    warnings.push(
      `ranking_failed:${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // Phase 5E Step 2 — evidence + probability (historical peers optional; never fabricate)
  let probabilitySummary: MifProductionIntegrationResult["probabilityIntelligence"] = null;
  let probabilityBundles: ReturnType<typeof assessProbabilityIntelligenceBatch> | null = null;
  try {
    probabilityBundles = assessProbabilityIntelligenceBatch({
      candidates: detection.candidates,
      evidence,
      historicalCandidates: opts?.historicalCandidates ?? [],
      evaluations: opts?.historicalEvaluations ?? [],
      analysisRunId: requestId,
      rankingRunId: rankingRunFull?.rankingRunId ?? null,
      primaryTimeframe,
      marketRegime: primaryBundle.regime.structure,
      rankingScoreBand: rankingRunFull?.rankings?.[0]?.scoreBand ?? null,
      dataQualityStatus,
      calculatedAt: processingTimestamp,
      maxCandidates: 20,
    });
    probabilitySummary = {
      assessedCount: probabilityBundles.length,
      insufficientSampleCount: probabilityBundles.filter(
        (b) =>
          b.probability.sampleStatus === "INSUFFICIENT_SAMPLE"
          || b.probability.sampleStatus === "INSUFFICIENT_HISTORICAL_COVERAGE",
      ).length,
      unavailableCount: probabilityBundles.filter(
        (b) =>
          b.probability.sampleStatus === "UNAVAILABLE"
          || b.probability.sampleStatus === "LEVELS_NOT_PROVIDED"
          || b.probability.sampleStatus === "BLOCKED_BY_DATA_QUALITY",
      ).length,
      withProbabilityCount: probabilityBundles.filter((b) => b.probability.probability != null)
        .length,
      top: probabilityBundles.slice(0, 20).map((b) => ({
        candidateId: b.probability.candidateId,
        sampleStatus: b.probability.sampleStatus,
        probability: b.probability.probability,
        reliabilityStatus: b.probability.reliabilityStatus,
        calibrationStatus: b.probability.calibrationStatus,
        isWinProbability: b.probability.isWinProbability,
      })),
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
    };
  } catch (err) {
    warnings.push(
      `probability_intelligence_failed:${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const dataQualityDiagnostics = buildDataQualityDiagnostics({
    dataQualityStatus,
    analysisStatus,
    snapshots,
  });

  return baseResult({
    requestId,
    providerSymbol: symbol,
    requestedTimeframes,
    resolvedTimeframes,
    primaryTimeframe,
    marketDataTimestamp: assessmentTimestamp,
    candleTimestampSec: newestTipSec,
    candleLifecycle: tipLifecycle,
    dataFreshness,
    processingTimestamp,
    analysisStatus,
    dataQualityStatus,
    dataQualityDiagnostics,
    availableTimeframeRoles,
    timeframeSnapshots: snapshots,
    mtfStatus: mtf.status,
    mtfRelation: mtf.directional.relation,
    eligibility,
    detection,
    candidateCount,
    evidenceRefs: evidence,
    warnings: [...warnings, ...detection.outcomes.flatMap((o) => o.warnings)].slice(0, 50),
    errors,
    failureCodes: [...new Set(failureCodes)],
    contextSummary: {
      evidenceCount: evidence.length,
      assessmentTimestamp,
      hasRegime: true,
      hasMtf: true,
      hasFibonacci: true,
      hasChartPatterns: true,
      hasHarmonic: true,
      hasUnified: true,
      hasMarketStructure: !!primaryBundle.marketStructure,
      hasSupportResistance: !!primaryBundle.supportResistance,
      hasLiquidityReference: !!primaryBundle.liquidityReference,
      hasMomentum: !!primaryBundle.momentum,
      hasPriceDisplacement: !!primaryBundle.priceDisplacement,
    },
    evidenceQuality,
    ranking: rankingSummary,
    probabilityIntelligence: probabilitySummary,
    persistence: null,
    _rankingRun: rankingRunFull,
    _probabilityBundles: probabilityBundles,
    ...(opts?.includeDebugContext ? { _debugContext: context } : {}),
  });
}

/**
 * Run series pipeline and optionally persist (default: persist when successful-ish).
 */
export async function runMifHfmOpportunityPipelineFromSeriesPersisted(
  input: MifProductionPipelineFromSeriesInput,
  opts?: MifProductionPipelineRunOpts,
): Promise<MifProductionIntegrationResult> {
  const started = new Date().toISOString();
  // Enrich with stored historical peers when available (no future leakage inside cohort engine).
  let histOpts = opts;
  try {
    const { getMifOpportunityStorage } = await import("./persistence/storage.js");
    const store = getMifOpportunityStorage();
    const listed = await store.listCandidates({
      providerSymbol: input.providerSymbol,
      limit: 200,
    });
    const evals = await store.listOutcomeEvaluations({ limit: 200 });
    histOpts = {
      ...opts,
      historicalCandidates: opts?.historicalCandidates ?? listed.items,
      historicalEvaluations: opts?.historicalEvaluations ?? evals.items,
    };
  } catch {
    histOpts = opts;
  }
  const result = runMifHfmOpportunityPipelineFromSeries(input, histOpts);
  const shouldPersist = opts?.persist !== false
    && !String(result.analysisStatus).startsWith("FAILED_VALIDATION");
  if (!shouldPersist) return result;
  try {
    const { getMifOpportunityStorage } = await import("./persistence/storage.js");
    const store = getMifOpportunityStorage();
    const saved = await store.persistAnalysisResult(result, {
      analysisStartedAt: started,
      runId: result.requestId,
    });
    return {
      ...result,
      persistence: {
        persisted: true,
        runId: saved.run.runId,
        candidateIds: saved.candidates.map((c) => c.candidateId),
        created: saved.created,
        rankingRunId: saved.rankingRunId,
      },
    };
  } catch (err) {
    return {
      ...result,
      warnings: [
        ...result.warnings,
        `persistence_failed:${err instanceof Error ? err.message : String(err)}`,
      ],
      persistence: {
        persisted: false,
        runId: null,
        candidateIds: [],
        created: false,
      },
    };
  }
}

/**
 * Live HFM_MT5 fetch → series pipeline. Read-only agent path only.
 */
export async function runMifHfmOpportunityPipelineLive(
  input: MifProductionLiveFetchInput & { persist?: boolean },
): Promise<MifProductionIntegrationResult> {
  const processingTimestamp = new Date().toISOString();
  const requestId = String(input.requestId || "").trim() || randomUUID();
  const providerId = String(input.providerId ?? MIF_PROVIDER_ID).trim().toUpperCase();
  const symbol = normalizeSymbol(input.providerSymbol);
  const timeframes = (input.timeframes?.length
    ? input.timeframes
    : MIF_PRODUCTION_DEFAULT_TIMEFRAMES
  ).map(normalizeTf);
  const limit = Math.min(
    300,
    Math.max(30, input.candleLimit ?? MIF_PRODUCTION_CANDLE_LIMIT),
  );

  if (providerId !== MIF_PROVIDER_ID) {
    return runMifHfmOpportunityPipelineFromSeries({
      requestId,
      providerId,
      providerSymbol: symbol,
      timeframes,
      series: [],
      assessmentTimestamp: input.assessmentTimestamp ?? processingTimestamp,
    });
  }

  const { fetchHfmHistoricalCandles } = await import("../../historical-engine.js");
  const series: MifProductionTfSeriesInput[] = [];
  const fetchErrors: string[] = [];
  const failureCodes: MifProductionFailureCode[] = [];

  for (const tf of timeframes) {
    try {
      const hist = await fetchHfmHistoricalCandles({
        symbol,
        timeframe: tf,
        limit,
        refresh: input.refresh === true,
      });
      if (hist.provider !== MIF_PROVIDER_ID) {
        failureCodes.push("WRONG_PROVIDER");
      }
      if (!hist.available || !hist.bars.length) {
        fetchErrors.push(`${tf}: unavailable (${hist.errors.join("; ") || "no bars"})`);
        failureCodes.push("HFM_UNAVAILABLE");
        series.push({
          timeframe: tf,
          bars: [],
          freshness: hist.freshness,
          source: hist.source,
          newestTimestampSec: hist.newestTimestamp,
          errors: hist.errors,
        });
        continue;
      }
      series.push({
        timeframe: hist.timeframe || tf,
        bars: hist.bars as HfmHistoricalBar[],
        freshness: hist.freshness,
        source: hist.source,
        newestTimestampSec: hist.newestTimestamp,
        errors: hist.errors,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fetchErrors.push(`${tf}: ${msg}`);
      if (/timeout/i.test(msg)) failureCodes.push("HFM_TIMEOUT");
      else failureCodes.push("HFM_UNAVAILABLE");
      series.push({
        timeframe: tf,
        bars: [],
        errors: [msg],
      });
    }
  }

  let sessionAuthority: MifExpectedIntervalAuthority | null = null;
  try {
    const { getHfmCatalogService } = await import("../../catalog-service.js");
    const cat = await getHfmCatalogService().getSymbol(symbol);
    if (cat?.sessions) {
      sessionAuthority = createHfmCatalogSessionAuthority({
        providerSymbol: symbol,
        sessions: cat.sessions as Record<string, unknown>,
        catalogVersion: cat.catalogVersion ?? null,
      });
    }
  } catch {
    sessionAuthority = null;
  }

  let result = await runMifHfmOpportunityPipelineFromSeriesPersisted(
    {
      requestId,
      providerId: MIF_PROVIDER_ID,
      providerSymbol: symbol,
      timeframes,
      primaryTimeframe: input.primaryTimeframe,
      series,
      assessmentTimestamp: input.assessmentTimestamp ?? processingTimestamp,
      maxCandleAgeSec: input.maxCandleAgeSec,
      expectedIntervalAuthority: sessionAuthority,
    },
    { persist: input.persist !== false },
  );

  if (fetchErrors.length && result.analysisStatus.startsWith("FAILED") === false
    && result.resolvedTimeframes.length === 0) {
    return {
      ...result,
      analysisStatus: "FAILED_PROVIDER",
      errors: [...result.errors, ...fetchErrors],
      failureCodes: [...new Set([...result.failureCodes, ...failureCodes])],
    };
  }

  if (fetchErrors.length) {
    result = {
      ...result,
      warnings: [...result.warnings, ...fetchErrors],
      failureCodes: [...new Set([...result.failureCodes, ...failureCodes])],
      analysisStatus:
        result.resolvedTimeframes.length === 0
          ? "FAILED_PROVIDER"
          : result.analysisStatus === "OK" || result.analysisStatus === "OK_EMPTY_CANDIDATES"
            ? "PARTIAL_DEGRADED"
            : result.analysisStatus,
    };
  }

  return result;
}
