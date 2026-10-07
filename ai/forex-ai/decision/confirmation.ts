/**
 * Explicit confirmation conditions — never invent MET from UNKNOWN.
 */
import type { ForexMtfAlignmentResult, ForexMultiTimeframeMarketState } from "../mtf/types.js";
import type {
  ForexConfirmationCondition,
  ForexDecisionScenario,
  ForexEntryZone,
} from "./types.js";

function statusFromBool(ok: boolean | null): ForexConfirmationCondition["status"] {
  if (ok === null) return "UNKNOWN";
  return ok ? "MET" : "NOT_MET";
}

export function buildConfirmationConditions(
  mtf: ForexMultiTimeframeMarketState,
  alignment: ForexMtfAlignmentResult,
  scenario: ForexDecisionScenario,
  entryZone: ForexEntryZone,
): { conditions: ForexConfirmationCondition[]; allRequiredMet: boolean; summary: string } {
  const facts = mtf.slots.map((s) => s.compact);
  const t15 = facts.find((f) => f.timeframe === "15m");
  const t5 = facts.find((f) => f.timeframe === "5m");
  const nowIso = new Date().toISOString();

  if (scenario.type === "INSUFFICIENT_DATA") {
    return {
      conditions: [{
        id: "data-required",
        category: "DATA_QUALITY",
        description: "Required multi-timeframe Market States must be available",
        status: "NOT_MET",
        observedValue: mtf.dataQuality,
        requiredValue: "COMPLETE_LIVE or COMPLETE_CONNECTED with required TFs",
        timeframe: null,
        timestamp: nowIso,
      }],
      allRequiredMet: false,
      summary: "Confirmation not applicable — insufficient data.",
    };
  }

  const conditions: ForexConfirmationCondition[] = [];

  // Data quality
  const dqOk = mtf.dataQuality === "COMPLETE_LIVE" || mtf.dataQuality === "COMPLETE_CONNECTED"
    || mtf.dataQuality === "PARTIALLY_STALE";
  conditions.push({
    id: "dq-fresh",
    category: "DATA_QUALITY",
    description: "Market data is connected and not fully stale/disconnected",
    status: statusFromBool(
      mtf.dataQuality === "STALE" || mtf.dataQuality === "DISCONNECTED" ? false : dqOk,
    ),
    observedValue: mtf.dataQuality,
    requiredValue: "Not STALE/DISCONNECTED",
    timeframe: null,
    timestamp: nowIso,
  });

  // HTF alignment with scenario direction
  let htfOk: boolean | null = null;
  if (scenario.direction === "BULLISH") {
    htfOk = alignment.higherBias === "BULLISH" || alignment.overall === "ALIGNED_BULLISH";
  } else if (scenario.direction === "BEARISH") {
    htfOk = alignment.higherBias === "BEARISH" || alignment.overall === "ALIGNED_BEARISH";
  } else if (scenario.direction === "NEUTRAL") {
    htfOk = alignment.higherBias === "NEUTRAL" || scenario.type === "RANGE_CONSOLIDATION";
  } else {
    htfOk = null;
  }
  conditions.push({
    id: "htf-bias",
    category: "MULTI_TIMEFRAME_ALIGNMENT",
    description: "Higher-timeframe bias agrees with scenario direction",
    status: statusFromBool(htfOk),
    observedValue: alignment.higherBias,
    requiredValue: scenario.direction === "UNKNOWN" ? null : scenario.direction,
    timeframe: "4h/1h",
    timestamp: nowIso,
  });

  // LTF structure/trend recovery for pullbacks; alignment for continuation
  let ltfOk: boolean | null = null;
  if (scenario.type === "BULLISH_CONTINUATION" || scenario.type === "BEARISH_CONTINUATION") {
    ltfOk = alignment.overall === "ALIGNED_BULLISH" || alignment.overall === "ALIGNED_BEARISH";
  } else if (scenario.type === "BULLISH_PULLBACK") {
    // Confirmation = LTF no longer exclusively bearish (recovery starting)
    const ltfTrend = t15?.trend ?? t5?.trend ?? null;
    if (ltfTrend == null) ltfOk = null;
    else ltfOk = ltfTrend === "BULLISH" || ltfTrend === "NEUTRAL";
  } else if (scenario.type === "BEARISH_PULLBACK") {
    const ltfTrend = t15?.trend ?? t5?.trend ?? null;
    if (ltfTrend == null) ltfOk = null;
    else ltfOk = ltfTrend === "BEARISH" || ltfTrend === "NEUTRAL";
  } else if (scenario.type === "BREAKOUT_WATCH" || scenario.type === "BREAKDOWN_WATCH") {
    ltfOk = false; // watch states are never fully confirmed by default
  } else if (scenario.type === "CONFLICT" || scenario.type === "WAIT") {
    ltfOk = false;
  } else {
    ltfOk = null;
  }

  conditions.push({
    id: "ltf-confirm",
    category: "STRUCTURE",
    description: "Lower-timeframe structure/trend supports scenario confirmation",
    status: statusFromBool(ltfOk),
    observedValue: `15m=${t15?.trend ?? "n/a"}; 5m=${t5?.trend ?? "n/a"}`,
    requiredValue: scenario.type.includes("PULLBACK")
      ? "LTF trend recovers toward scenario direction or neutral"
      : "LTF aligned with HTF for continuation",
    timeframe: "15m/5m",
    timestamp: t15?.timestamp ?? t5?.timestamp ?? nowIso,
  });

  // Momentum not violently opposing for bullish/bearish scenarios
  const mom = t15?.momentum ?? null;
  let momOk: boolean | null = null;
  if (scenario.direction === "BULLISH") {
    momOk = mom == null ? null : mom !== "NEGATIVE" && mom !== "WEAK";
  } else if (scenario.direction === "BEARISH") {
    momOk = mom == null ? null : mom !== "POSITIVE" && mom !== "STRONG";
  }
  conditions.push({
    id: "momentum",
    category: "MOMENTUM",
    description: "Lower-timeframe momentum not strongly opposing scenario direction",
    status: statusFromBool(momOk),
    observedValue: mom,
    requiredValue: scenario.direction === "BULLISH"
      ? "Not NEGATIVE/WEAK"
      : scenario.direction === "BEARISH"
        ? "Not POSITIVE/STRONG"
        : null,
    timeframe: "15m",
    timestamp: t15?.timestamp ?? nowIso,
  });

  // Price relative to entry zone (if zone exists)
  if (entryZone.status !== "UNAVAILABLE" && entryZone.lowerBound != null && entryZone.upperBound != null) {
    const px = entryZone.currentPrice;
    let inZone: boolean | null = null;
    if (px != null && Number.isFinite(px)) {
      inZone = px >= entryZone.lowerBound && px <= entryZone.upperBound;
    }
    conditions.push({
      id: "price-in-zone",
      category: "CANDLE",
      description: "Current price interacts with derived entry zone",
      status: statusFromBool(inZone),
      observedValue: px == null ? "UNAVAILABLE" : String(px),
      requiredValue: `${entryZone.lowerBound}–${entryZone.upperBound}`,
      timeframe: entryZone.timeframe,
      timestamp: entryZone.dataTimestamp,
    });
  } else {
    conditions.push({
      id: "price-in-zone",
      category: "CANDLE",
      description: "Current price interacts with derived entry zone",
      status: "NOT_APPLICABLE",
      observedValue: entryZone.unavailableReason,
      requiredValue: null,
      timeframe: null,
      timestamp: nowIso,
    });
  }

  const required = conditions.filter((c) => c.status !== "NOT_APPLICABLE");
  const allRequiredMet = required.length > 0 && required.every((c) => c.status === "MET");
  const met = required.filter((c) => c.status === "MET").length;
  const summary = allRequiredMet
    ? "All applicable confirmation conditions are MET (analytical only — not trade execution)."
    : `${met}/${required.length} confirmation conditions MET; confirmation still required.`;

  return { conditions, allRequiredMet, summary };
}
