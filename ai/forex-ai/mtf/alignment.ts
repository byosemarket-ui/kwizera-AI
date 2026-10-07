/**
 * Deterministic multi-timeframe alignment — not LLM-invented.
 */
import type { NormalizedTimeframeId } from "../../market-data/binance/types.js";
import type { ForexMtfAlignment, ForexMtfAlignmentResult, ForexMtfCompactFacts } from "./types.js";

type TrendDir = "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";

function asTrend(value: string | null | undefined): TrendDir {
  const v = String(value ?? "").toUpperCase();
  if (v === "BULLISH" || v === "BEARISH" || v === "NEUTRAL") return v;
  return "UNKNOWN";
}

function majority(dirs: TrendDir[]): TrendDir {
  const usable = dirs.filter((d) => d === "BULLISH" || d === "BEARISH" || d === "NEUTRAL");
  if (usable.length === 0) return "UNKNOWN";
  const bull = usable.filter((d) => d === "BULLISH").length;
  const bear = usable.filter((d) => d === "BEARISH").length;
  if (bull > 0 && bear === 0 && usable.every((d) => d === "BULLISH" || d === "NEUTRAL")) {
    return bull >= Math.ceil(usable.length / 2) ? "BULLISH" : "NEUTRAL";
  }
  if (bear > 0 && bull === 0 && usable.every((d) => d === "BEARISH" || d === "NEUTRAL")) {
    return bear >= Math.ceil(usable.length / 2) ? "BEARISH" : "NEUTRAL";
  }
  if (bull > bear) return "BULLISH";
  if (bear > bull) return "BEARISH";
  return "NEUTRAL";
}

function pick(facts: ForexMtfCompactFacts[], ids: NormalizedTimeframeId[]): ForexMtfCompactFacts[] {
  return ids.map((id) => facts.find((f) => f.timeframe === id)).filter((f): f is ForexMtfCompactFacts => Boolean(f));
}

/**
 * Alignment rules (documented):
 * - All usable trends BULLISH → ALIGNED_BULLISH
 * - All usable trends BEARISH → ALIGNED_BEARISH
 * - HTF (4h/1h) agree, LTF (15m/5m) oppose → MIXED (pullback-style)
 * - HTF disagree (4h vs 1h) → CONFLICTING
 * - Required slots unusable → INSUFFICIENT_DATA
 */
export function computeMtfAlignment(
  facts: ForexMtfCompactFacts[],
  required: NormalizedTimeframeId[],
): ForexMtfAlignmentResult {
  const requiredSlots = pick(facts, required);
  const requiredUsable = requiredSlots.filter((f) => f.usable);
  if (requiredUsable.length < required.length) {
    return {
      overall: "INSUFFICIENT_DATA",
      higherBias: "UNKNOWN",
      higherBasis: requiredSlots
        .filter((f) => !f.usable)
        .map((f) => `${f.timeframe} unavailable`),
      intermediateState: "INSUFFICIENT_DATA",
      lowerState: "INSUFFICIENT_DATA",
      confluence: [],
      conflicts: [`Required timeframe(s) missing: ${required.filter((tf) => !facts.find((f) => f.timeframe === tf)?.usable).join(", ")}`],
      notes: ["Complete multi-timeframe analysis requires all required timeframe Market States."],
    };
  }

  const higher = pick(facts, ["4h", "1h", "1d", "1w"]).filter((f) => f.usable);
  const intermediate = pick(facts, ["30m", "1h"]).filter((f) => f.usable && f.timeframe === "30m");
  const lower = pick(facts, ["15m", "5m", "1m"]).filter((f) => f.usable);

  const higherTrends = higher.map((f) => asTrend(f.trend));
  const lowerTrends = lower.map((f) => asTrend(f.trend));
  const allUsable = facts.filter((f) => f.usable);
  const allTrends = allUsable.map((f) => asTrend(f.trend));

  const higherBias = majority(higherTrends);
  const lowerBias = majority(lowerTrends);
  const intermediateState = intermediate[0]
    ? `${intermediate[0].trend ?? "UNKNOWN"} / ${intermediate[0].momentum ?? "n/a"}`
    : higher.find((f) => f.timeframe === "1h")
      ? `${higher.find((f) => f.timeframe === "1h")!.trend ?? "UNKNOWN"}`
      : "UNAVAILABLE";

  const higherBasis = higher
    .filter((f) => f.trend)
    .map((f) => `${f.timeframe} trend ${f.trend}`);

  const confluence: string[] = [];
  const conflicts: string[] = [];

  if (allTrends.length > 0 && allTrends.every((t) => t === "BULLISH")) {
    confluence.push("All usable timeframes classify trend as BULLISH");
    return {
      overall: "ALIGNED_BULLISH",
      higherBias: "BULLISH",
      higherBasis,
      intermediateState,
      lowerState: lowerBias,
      confluence,
      conflicts,
      notes: ["Top-down trend alignment is bullish across supplied timeframes."],
    };
  }

  if (allTrends.length > 0 && allTrends.every((t) => t === "BEARISH")) {
    confluence.push("All usable timeframes classify trend as BEARISH");
    return {
      overall: "ALIGNED_BEARISH",
      higherBias: "BEARISH",
      higherBasis,
      intermediateState,
      lowerState: lowerBias,
      confluence,
      conflicts,
      notes: ["Top-down trend alignment is bearish across supplied timeframes."],
    };
  }

  const h4 = asTrend(facts.find((f) => f.timeframe === "4h" && f.usable)?.trend);
  const h1 = asTrend(facts.find((f) => f.timeframe === "1h" && f.usable)?.trend);
  if (
    (h4 === "BULLISH" || h4 === "BEARISH")
    && (h1 === "BULLISH" || h1 === "BEARISH")
    && h4 !== h1
  ) {
    conflicts.push(`Higher timeframes disagree: 4h=${h4}, 1h=${h1}`);
    return {
      overall: "CONFLICTING",
      higherBias: "UNKNOWN",
      higherBasis,
      intermediateState,
      lowerState: lowerBias,
      confluence,
      conflicts,
      notes: ["Primary and intermediate higher timeframes conflict."],
    };
  }

  if (
    (higherBias === "BULLISH" || higherBias === "BEARISH")
    && (lowerBias === "BULLISH" || lowerBias === "BEARISH")
    && higherBias !== lowerBias
  ) {
    conflicts.push(`Higher bias ${higherBias} vs lower bias ${lowerBias}`);
    confluence.push(`Higher timeframes lean ${higherBias}`);
    return {
      overall: "MIXED",
      higherBias,
      higherBasis,
      intermediateState,
      lowerState: lowerBias,
      confluence,
      conflicts,
      notes: ["Lower timeframes currently diverge from higher-timeframe bias (possible pullback/counter-move)."],
    };
  }

  const mixedNotes: string[] = [];
  for (const f of allUsable) {
    mixedNotes.push(`${f.timeframe}=${f.trend ?? "n/a"}`);
  }
  return {
    overall: "MIXED" as ForexMtfAlignment,
    higherBias,
    higherBasis,
    intermediateState,
    lowerState: lowerBias,
    confluence,
    conflicts: conflicts.length ? conflicts : [`Mixed trends: ${mixedNotes.join(", ")}`],
    notes: ["Timeframes are not fully aligned."],
  };
}
