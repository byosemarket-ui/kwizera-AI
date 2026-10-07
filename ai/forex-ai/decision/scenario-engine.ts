/**
 * Deterministic scenario selection from MTF alignment + Market State facts.
 * Does not invent prices or structure labels beyond Phase 18 classifications.
 */
import type { ForexMtfAlignmentResult, ForexMtfCompactFacts, ForexMultiTimeframeMarketState } from "../mtf/types.js";
import type { ForexDecisionScenario, ForexDecisionScenarioType, ForexScenarioDirection } from "./types.js";

function trendOf(facts: ForexMtfCompactFacts[], tf: string): string | null {
  return facts.find((f) => f.timeframe === tf && f.usable)?.trend ?? null;
}

function momentumOf(facts: ForexMtfCompactFacts[], tf: string): string | null {
  return facts.find((f) => f.timeframe === tf && f.usable)?.momentum ?? null;
}

function nameFor(type: ForexDecisionScenarioType): string {
  return type.replace(/_/g, " ");
}

export function selectDecisionScenario(
  mtf: ForexMultiTimeframeMarketState,
  alignment: ForexMtfAlignmentResult,
): ForexDecisionScenario {
  const facts = mtf.slots.map((s) => s.compact);

  if (alignment.overall === "INSUFFICIENT_DATA" || mtf.dataQuality === "INSUFFICIENT_DATA") {
    return {
      type: "INSUFFICIENT_DATA",
      direction: "UNKNOWN",
      name: nameFor("INSUFFICIENT_DATA"),
      evidence: alignment.conflicts.length ? alignment.conflicts : ["Required timeframe Market State unavailable."],
      notes: ["Scenario withheld until required multi-timeframe data is available."],
    };
  }

  if (mtf.dataQuality === "STALE" || mtf.dataQuality === "DISCONNECTED") {
    return {
      type: "WAIT",
      direction: "UNKNOWN",
      name: nameFor("WAIT"),
      evidence: [`MTF data quality = ${mtf.dataQuality}`],
      notes: ["Stale or disconnected market data — do not treat scenarios as current."],
    };
  }

  if (alignment.overall === "CONFLICTING") {
    return {
      type: "CONFLICT",
      direction: "UNKNOWN",
      name: nameFor("CONFLICT"),
      evidence: [...alignment.conflicts, ...alignment.higherBasis],
      notes: ["Higher timeframes disagree; wait for clearer hierarchical bias."],
    };
  }

  const t4 = trendOf(facts, "4h");
  const t1 = trendOf(facts, "1h");
  const t30 = trendOf(facts, "30m");
  const t15 = trendOf(facts, "15m");
  const t5 = trendOf(facts, "5m");
  const m15 = momentumOf(facts, "15m");
  const m5 = momentumOf(facts, "5m");

  const evidence: string[] = [
    ...alignment.higherBasis,
    `alignment=${alignment.overall}`,
    `lowerState=${alignment.lowerState}`,
  ];
  if (t30) evidence.push(`30m trend=${t30}`);
  if (t15) evidence.push(`15m trend=${t15}`);
  if (t5) evidence.push(`5m trend=${t5}`);
  if (m15) evidence.push(`15m momentum=${m15}`);

  if (alignment.overall === "ALIGNED_BULLISH") {
    return {
      type: "BULLISH_CONTINUATION",
      direction: "BULLISH",
      name: nameFor("BULLISH_CONTINUATION"),
      evidence,
      notes: ["All usable timeframes classify trend as bullish."],
    };
  }

  if (alignment.overall === "ALIGNED_BEARISH") {
    return {
      type: "BEARISH_CONTINUATION",
      direction: "BEARISH",
      name: nameFor("BEARISH_CONTINUATION"),
      evidence,
      notes: ["All usable timeframes classify trend as bearish."],
    };
  }

  // MIXED: HTF bias vs LTF divergence → pullback-style scenarios
  if (alignment.overall === "MIXED") {
    if (alignment.higherBias === "BULLISH" && (alignment.lowerState === "BEARISH" || t15 === "BEARISH" || t5 === "BEARISH")) {
      return {
        type: "BULLISH_PULLBACK",
        direction: "BULLISH",
        name: nameFor("BULLISH_PULLBACK"),
        evidence,
        notes: [
          "Higher-timeframe bias bullish while lower timeframes are temporarily bearish/weak.",
          "Analytical pullback — not an automatic entry.",
        ],
      };
    }
    if (alignment.higherBias === "BEARISH" && (alignment.lowerState === "BULLISH" || t15 === "BULLISH" || t5 === "BULLISH")) {
      return {
        type: "BEARISH_PULLBACK",
        direction: "BEARISH",
        name: nameFor("BEARISH_PULLBACK"),
        evidence,
        notes: [
          "Higher-timeframe bias bearish while lower timeframes are temporarily bullish/weak.",
          "Analytical pullback — not an automatic entry.",
        ],
      };
    }

    const neutrals = [t4, t1, t30, t15, t5].filter((t) => t === "NEUTRAL").length;
    if (neutrals >= 2 || alignment.higherBias === "NEUTRAL") {
      return {
        type: "RANGE_CONSOLIDATION",
        direction: "NEUTRAL",
        name: nameFor("RANGE_CONSOLIDATION"),
        evidence,
        notes: ["Mixed/neutral classifications suggest consolidation rather than directional continuation."],
      };
    }

    // HTF lean with mild LTF neutrality → watch breakout/breakdown
    if (alignment.higherBias === "BULLISH") {
      return {
        type: "BREAKOUT_WATCH",
        direction: "BULLISH",
        name: nameFor("BREAKOUT_WATCH"),
        evidence,
        notes: ["Higher bias bullish but lower timeframes not fully aligned — watch for confirmation."],
      };
    }
    if (alignment.higherBias === "BEARISH") {
      return {
        type: "BREAKDOWN_WATCH",
        direction: "BEARISH",
        name: nameFor("BREAKDOWN_WATCH"),
        evidence,
        notes: ["Higher bias bearish but lower timeframes not fully aligned — watch for confirmation."],
      };
    }
  }

  // Momentum extreme vs trend hint for reversal watch (descriptive only)
  if (
    (t4 === "BULLISH" || t1 === "BULLISH")
    && (m15 === "NEGATIVE" || m15 === "WEAK")
    && (m5 === "NEGATIVE" || m5 === "WEAK")
    && alignment.higherBias === "BULLISH"
  ) {
    return {
      type: "REVERSAL_WATCH",
      direction: "UNKNOWN",
      name: nameFor("REVERSAL_WATCH"),
      evidence,
      notes: ["Lower-timeframe momentum is weak while higher bias remains bullish — watch only."],
    };
  }

  return {
    type: "WAIT",
    direction: (alignment.higherBias as ForexScenarioDirection) || "UNKNOWN",
    name: nameFor("WAIT"),
    evidence,
    notes: ["No high-confidence scenario from current multi-timeframe facts."],
  };
}
