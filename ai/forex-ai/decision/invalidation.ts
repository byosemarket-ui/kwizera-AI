/**
 * Invalidation conditions from factual structure levels + MTF alignment.
 */
import type { ForexMtfAlignmentResult, ForexMultiTimeframeMarketState } from "../mtf/types.js";
import type {
  ForexDecisionScenario,
  ForexEntryZone,
  ForexInvalidationCondition,
} from "./types.js";

export function buildInvalidationConditions(
  mtf: ForexMultiTimeframeMarketState,
  alignment: ForexMtfAlignmentResult,
  scenario: ForexDecisionScenario,
  entryZone: ForexEntryZone,
): { conditions: ForexInvalidationCondition[]; triggered: boolean; summary: string } {
  const conditions: ForexInvalidationCondition[] = [];
  const price = entryZone.currentPrice
    ?? mtf.slots.find((s) => s.compact.price != null)?.compact.price
    ?? null;

  // Data quality invalidation
  const stale = mtf.dataQuality === "STALE" || mtf.dataQuality === "DISCONNECTED";
  conditions.push({
    id: "data-stale",
    description: "Market data becomes stale or disconnected",
    status: stale ? "MET" : "NOT_MET",
    level: null,
    timeframe: null,
    basis: `dataQuality=${mtf.dataQuality}`,
  });

  // HTF bias flip vs scenario
  let htfFlip = false;
  if (scenario.direction === "BULLISH" && (alignment.higherBias === "BEARISH" || alignment.overall === "ALIGNED_BEARISH")) {
    htfFlip = true;
  }
  if (scenario.direction === "BEARISH" && (alignment.higherBias === "BULLISH" || alignment.overall === "ALIGNED_BULLISH")) {
    htfFlip = true;
  }
  if (alignment.overall === "CONFLICTING") {
    htfFlip = true;
  }
  conditions.push({
    id: "htf-bias-fail",
    description: "Higher-timeframe bias fails relative to scenario direction",
    status: htfFlip ? "MET" : "NOT_MET",
    level: null,
    timeframe: "4h/1h",
    basis: `higherBias=${alignment.higherBias}; alignment=${alignment.overall}`,
  });

  // Structural level from entry zone (objective swing-derived only)
  if (entryZone.invalidationLevel != null && Number.isFinite(entryZone.invalidationLevel)) {
    let breached: ForexInvalidationCondition["status"] = "UNKNOWN";
    if (price != null && Number.isFinite(price)) {
      if (scenario.direction === "BULLISH") {
        breached = price < entryZone.invalidationLevel ? "MET" : "NOT_MET";
      } else if (scenario.direction === "BEARISH") {
        breached = price > entryZone.invalidationLevel ? "MET" : "NOT_MET";
      } else {
        breached = "NOT_APPLICABLE";
      }
    }
    conditions.push({
      id: "structure-level",
      description: "Price breaches structural invalidation level derived from BASIC_SWINGS",
      status: breached,
      level: entryZone.invalidationLevel,
      timeframe: entryZone.timeframe,
      basis: entryZone.basis.join("; ") || "swing-derived invalidationLevel",
    });
  } else {
    conditions.push({
      id: "structure-level",
      description: "Structural invalidation level from objective market structure",
      status: "NOT_APPLICABLE",
      level: null,
      timeframe: entryZone.timeframe,
      basis: entryZone.unavailableReason
        || "No objective invalidation level — support/resistance engine not available; swing level missing.",
    });
  }

  const triggered = conditions.some((c) => c.status === "MET" && (c.id === "htf-bias-fail" || c.id === "structure-level" || c.id === "data-stale"));
  const summary = triggered
    ? "One or more invalidation conditions are MET — scenario should be reconsidered."
    : "No invalidation conditions currently MET (based on supplied facts only).";

  return { conditions, triggered, summary };
}
