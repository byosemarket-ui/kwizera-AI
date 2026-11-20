/**
 * Phase 5F STEP 1 — trading-cost availability classification.
 * Never invents slippage/commission/swap. Never treats current metadata as historical truth.
 */
import type {
  MifResearchBarLike,
  MifResearchCostAvailabilityBundle,
  MifResearchCostAvailabilityEntry,
} from "./types.js";

function spreadEntry(bars: readonly MifResearchBarLike[]): MifResearchCostAvailabilityEntry {
  const total = bars.length;
  let withSpread = 0;
  for (const b of bars) {
    if (typeof b.spread === "number" && Number.isFinite(b.spread)) withSpread += 1;
  }
  if (total > 0 && withSpread === total) {
    return {
      costType: "spread",
      availability: "SOURCE_BACKED",
      sourceBackedBarCount: withSpread,
      totalBarCount: total,
      limitation: null,
    };
  }
  if (withSpread > 0) {
    return {
      costType: "spread",
      availability: "SOURCE_BACKED",
      sourceBackedBarCount: withSpread,
      totalBarCount: total,
      limitation: `partial_source_spread:${withSpread}/${total}; missing bars have no inventable historical spread`,
    };
  }
  return {
    costType: "spread",
    availability: "UNAVAILABLE",
    sourceBackedBarCount: 0,
    totalBarCount: total,
    limitation: "no source bar spread values present; current quote spread must not be used as historical",
  };
}

function unavailable(
  costType: "slippage" | "commission" | "swap",
  reason: string,
): MifResearchCostAvailabilityEntry {
  return {
    costType,
    availability: "UNAVAILABLE",
    limitation: reason,
  };
}

/**
 * Classify cost availability for a research bar series.
 * Slippage / commission / swap are always UNAVAILABLE for HFM_MT5 bar archives today.
 */
export function classifyResearchCostAvailability(
  bars: readonly MifResearchBarLike[],
): MifResearchCostAvailabilityBundle {
  return {
    spread: spreadEntry(bars),
    slippage: unavailable(
      "slippage",
      "HFM_MT5 historical bars do not provide slippage; do not invent or estimate",
    ),
    commission: unavailable(
      "commission",
      "HFM_MT5 historical bars/catalog path do not provide historical commission series",
    ),
    swap: unavailable(
      "swap",
      "HFM_MT5 historical bars/catalog path do not provide historical swap/financing series",
    ),
  };
}

/** Reject using current metadata as historical cost truth. */
export function assertCostNotCurrentMetadataAsHistorical(
  availability: MifResearchCostAvailabilityBundle,
): readonly string[] {
  const warnings: string[] = [];
  for (const key of ["spread", "slippage", "commission", "swap"] as const) {
    if (availability[key].availability === "CURRENT_METADATA_ONLY") {
      warnings.push(
        `${key}=CURRENT_METADATA_ONLY must not be treated as historical truth for backtesting`,
      );
    }
  }
  return warnings;
}

/**
 * Enforceable completeness for future backtests.
 * Never treat UNAVAILABLE/CURRENT_METADATA_ONLY costs as known historical values.
 */
export function researchCostCoverageStatus(
  availability: MifResearchCostAvailabilityBundle,
): {
  costCompleteness: "COST_COMPLETE" | "COST_INCOMPLETE";
  allowsCostAdjustedResults: false | true;
  missingOrNonHistorical: readonly string[];
} {
  const missingOrNonHistorical: string[] = [];
  for (const key of ["spread", "slippage", "commission", "swap"] as const) {
    if (availability[key].availability !== "SOURCE_BACKED") {
      missingOrNonHistorical.push(key);
    } else if (
      key === "spread" &&
      (availability.spread.sourceBackedBarCount ?? 0) <
        (availability.spread.totalBarCount ?? 0)
    ) {
      missingOrNonHistorical.push("spread_partial");
    }
  }
  const complete = missingOrNonHistorical.length === 0;
  return {
    costCompleteness: complete ? "COST_COMPLETE" : "COST_INCOMPLETE",
    allowsCostAdjustedResults: complete,
    missingOrNonHistorical,
  };
}
