/**
 * Phase 5F STEP 1 — enforceable research readiness for future consumers.
 * Prevents silent treatment of incomplete costs/metadata as known.
 */
import type {
  MifResearchCostAvailabilityBundle,
  MifResearchDatasetManifest,
  MifResearchDatasetStatus,
  MifResearchEligibility,
  MifResearchPitMetadataBundle,
  MifResearchQualitySummary,
} from "./types.js";

export type { MifResearchEligibility };

export function assessCostCompleteness(
  costs: MifResearchCostAvailabilityBundle,
): {
  completeness: MifResearchCostCompleteness;
  suitableForCostAdjustedBacktest: boolean;
  blockReasons: string[];
} {
  const blockReasons: string[] = [];
  for (const key of ["spread", "slippage", "commission", "swap"] as const) {
    const entry = costs[key];
    if (entry.availability === "UNAVAILABLE") {
      blockReasons.push(`cost_${key}_UNAVAILABLE`);
    } else if (entry.availability === "CURRENT_METADATA_ONLY") {
      blockReasons.push(`cost_${key}_CURRENT_METADATA_ONLY_NOT_HISTORICAL`);
    } else if (
      key === "spread" &&
      typeof entry.sourceBackedBarCount === "number" &&
      typeof entry.totalBarCount === "number" &&
      entry.sourceBackedBarCount < entry.totalBarCount
    ) {
      blockReasons.push(`cost_spread_PARTIAL_SOURCE_BACKED`);
    }
  }
  // Cost-adjusted backtest requires all four to be SOURCE_BACKED with full coverage.
  const allSourceBacked =
    costs.spread.availability === "SOURCE_BACKED" &&
    costs.slippage.availability === "SOURCE_BACKED" &&
    costs.commission.availability === "SOURCE_BACKED" &&
    costs.swap.availability === "SOURCE_BACKED" &&
    (costs.spread.sourceBackedBarCount ?? 0) === (costs.spread.totalBarCount ?? 0) &&
    (costs.spread.totalBarCount ?? 0) > 0;

  return {
    completeness: allSourceBacked ? ("COST_COMPLETE" as const) : ("COST_INCOMPLETE" as const),
    suitableForCostAdjustedBacktest: allSourceBacked,
    blockReasons,
  };
}

export function assessResearchEligibility(input: {
  status: MifResearchDatasetStatus;
  qualitySummary: MifResearchQualitySummary;
  pitMetadata: MifResearchPitMetadataBundle;
  candleCount: number;
}): MifResearchEligibility {
  const blockReasons: string[] = [];
  const notes: string[] = [];

  if (input.status !== "COMPLETE") {
    blockReasons.push("EXPORT_INCOMPLETE");
  }
  if (input.candleCount <= 0) {
    blockReasons.push("NO_CANDLES");
  }

  const degraded =
    input.qualitySummary.rejectedCandles > 0 ||
    input.qualitySummary.missingIntervals.some(
      (m) => m.classification !== "INCOMPLETE_EXPORT_RANGE",
    ) ||
    input.qualitySummary.incompleteExportRange ||
    input.qualitySummary.sessionUncertainty ||
    input.qualitySummary.metadataUncertainty;

  const qualityValidity = degraded ? "QUALITY_DEGRADED" : "QUALITY_VALID";
  if (degraded) blockReasons.push("QUALITY_DEGRADED");

  const historicallyAuthoritative =
    input.pitMetadata.sessions.historicalAuthority === true &&
    input.pitMetadata.instrumentSpec.availability === "SOURCE_BACKED" &&
    input.pitMetadata.instrumentSpec.effectiveAt != null;

  const metadataAuthority = historicallyAuthoritative
    ? "HISTORICALLY_AUTHORITATIVE"
    : "METADATA_LIMITED";
  if (!historicallyAuthoritative) {
    blockReasons.push("METADATA_NOT_HISTORICALLY_AUTHORITATIVE");
    notes.push(
      "PIT sessions/specs are observation-only; periods before collection remain unknown",
    );
  }

  const cost = assessCostCompleteness(input.qualitySummary.costDataAvailability);
  blockReasons.push(...cost.blockReasons);

  // COMPLETE candle archives may be used for OHLC research; consumers must honor qualityValidity.
  const suitableForCandleResearchFinal =
    input.candleCount > 0 && input.status === "COMPLETE";

  const suitableForSessionSensitiveResearch =
    suitableForCandleResearchFinal && historicallyAuthoritative;

  if (!cost.suitableForCostAdjustedBacktest) {
    notes.push(
      "cost-adjusted backtest forbidden until slippage/commission/swap are SOURCE_BACKED historically",
    );
  }

  return {
    exportCompleteness: input.status,
    qualityValidity,
    metadataAuthority,
    costCompleteness: cost.completeness,
    suitableForCandleResearch: suitableForCandleResearchFinal,
    suitableForCostAdjustedBacktest: cost.suitableForCostAdjustedBacktest,
    suitableForSessionSensitiveResearch,
    blockReasons: [...new Set(blockReasons)],
    notes,
  };
}

export function eligibilityFromManifest(
  manifest: MifResearchDatasetManifest,
): MifResearchEligibility {
  return (
    manifest.researchEligibility ??
    assessResearchEligibility({
      status: manifest.status,
      qualitySummary: manifest.qualitySummary,
      pitMetadata: manifest.pitMetadata,
      candleCount: manifest.candleCount,
    })
  );
}

/** Hard guard for future backtest engines — throws if costs incomplete. */
export function assertCostAdjustedBacktestAllowed(
  eligibility: MifResearchEligibility,
): { ok: true } | { ok: false; blockReasons: readonly string[] } {
  if (eligibility.suitableForCostAdjustedBacktest) return { ok: true };
  return { ok: false, blockReasons: eligibility.blockReasons };
}
