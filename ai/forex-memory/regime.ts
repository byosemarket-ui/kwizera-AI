/**
 * Deterministic market regime from stored analysis facts — not LLM-invented.
 */
import type { ForexMarketRegime } from "./types.js";

export function classifyMarketRegime(input: {
  alignment?: string | null;
  higherBias?: string | null;
  scenario?: string | null;
  volatility?: string | null;
  trends?: Array<string | null | undefined>;
}): ForexMarketRegime {
  const alignment = String(input.alignment ?? "").toUpperCase();
  const vol = String(input.volatility ?? "").toUpperCase();
  if (alignment === "CONFLICTING") return "CONFLICTED";
  if (vol === "HIGH" || vol === "EXTREME") return "HIGH_VOLATILITY";
  if (vol === "LOW") return "LOW_VOLATILITY";

  if (alignment === "ALIGNED_BULLISH" || input.higherBias === "BULLISH") {
    if (alignment === "ALIGNED_BULLISH") return "TRENDING_BULLISH";
  }
  if (alignment === "ALIGNED_BEARISH" || input.higherBias === "BEARISH") {
    if (alignment === "ALIGNED_BEARISH") return "TRENDING_BEARISH";
  }

  const trends = (input.trends ?? []).map((t) => String(t ?? "").toUpperCase()).filter(Boolean);
  const bull = trends.filter((t) => t === "BULLISH").length;
  const bear = trends.filter((t) => t === "BEARISH").length;
  const neutral = trends.filter((t) => t === "NEUTRAL").length;
  if (neutral >= Math.ceil(trends.length / 2) && trends.length > 0) return "RANGING";
  if (bull > bear && bull > 0) return "TRENDING_BULLISH";
  if (bear > bull && bear > 0) return "TRENDING_BEARISH";
  if (alignment === "MIXED") return "CONFLICTED";
  return "UNKNOWN";
}
