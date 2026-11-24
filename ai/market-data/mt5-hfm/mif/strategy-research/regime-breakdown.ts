/**
 * Phase 08 regime performance — labels supplied by caller (Phase 06 reuse); no invention.
 */
import { MIF_STRATEGY_RESEARCH_MAX_REGIME_BUCKETS } from "./contracts.js";
import { computeStrategyResearchPerformance } from "./metrics.js";
import type { MifStrategyResearchPolicy } from "./policies.js";
import type { HfmRegimePerformanceBucket, HfmSimulatedTradeInput } from "./types.js";

export function buildRegimeBreakdown(input: {
  trades: readonly HfmSimulatedTradeInput[];
  policy: MifStrategyResearchPolicy;
}): HfmRegimePerformanceBucket[] {
  const groups = new Map<string, HfmSimulatedTradeInput[]>();
  for (const t of input.trades) {
    const label = (t.regimeLabel ?? "UNCLASSIFIED").trim() || "UNCLASSIFIED";
    const list = groups.get(label) ?? [];
    list.push(t);
    groups.set(label, list);
  }

  const out: HfmRegimePerformanceBucket[] = [];
  for (const [regimeLabel, trades] of groups) {
    if (out.length >= MIF_STRATEGY_RESEARCH_MAX_REGIME_BUCKETS) break;
    const perf = computeStrategyResearchPerformance(
      trades,
      input.policy.minSampleForAvailableMetrics,
    );
    const closed = trades.filter((t) => t.status === "CLOSED" && t.unitReturn != null);
    const sampleSufficient = closed.length >= input.policy.minSampleForAvailableMetrics;
    out.push({
      regimeLabel,
      tradeCount: trades.length,
      winCount: perf.winningTrades,
      lossCount: perf.losingTrades,
      winRate: perf.winRate,
      expectancy: perf.expectancy,
      maxDrawdown: perf.maxDrawdown,
      sampleSufficient,
      note: sampleSufficient
        ? "Regime sample meets minimum — still RESEARCH_ONLY"
        : "INSUFFICIENT_SAMPLE for this regime — do not claim strategy works here",
    });
  }
  return out.sort((a, b) => b.tradeCount - a.tradeCount);
}
