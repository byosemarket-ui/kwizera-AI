/**
 * Phase 08 performance metrics — definitions + availability, never win probability.
 */
import type {
  HfmResearchMetric,
  HfmSimulatedTradeInput,
  HfmStrategyResearchPerformance,
} from "./types.js";

function metric(
  id: string,
  name: string,
  value: number | null,
  sampleSize: number,
  minSample: number,
  definition: string,
  calculationBasis: string,
  extraLimitations: string[] = [],
  forceAvailability?: HfmResearchMetric["availability"],
): HfmResearchMetric {
  const limitations = [...extraLimitations];
  let availability: HfmResearchMetric["availability"] =
    forceAvailability
    ?? (value == null
      ? "UNSUPPORTED"
      : sampleSize < minSample
        ? "INSUFFICIENT_SAMPLE"
        : "AVAILABLE");
  if (availability === "INSUFFICIENT_SAMPLE") {
    limitations.push(`sample ${sampleSize} < min ${minSample}`);
  }
  return {
    id,
    name,
    value,
    definition,
    calculationBasis,
    sampleSize,
    availability,
    limitations,
    isWinProbability: false,
    isEventProbability: false,
  };
}

export function computeStrategyResearchPerformance(
  trades: readonly HfmSimulatedTradeInput[],
  minSample: number,
): HfmStrategyResearchPerformance {
  const closed = trades.filter((t) => t.status === "CLOSED" && t.unitReturn != null);
  const ambiguous = trades.filter((t) => t.status === "AMBIGUOUS");
  const breakeven = closed.filter((t) => Math.abs(t.unitReturn!) < 1e-12);
  const wins = closed.filter((t) => (t.unitReturn ?? 0) > 0);
  const losses = closed.filter((t) => (t.unitReturn ?? 0) < 0);
  const returns = closed.map((t) => t.unitReturn!);
  const n = closed.length;

  const winRate = n ? wins.length / n : null;
  const netReturn = n ? returns.reduce((a, b) => a + b, 0) : null;
  const averageWin = wins.length
    ? wins.reduce((a, t) => a + (t.unitReturn ?? 0), 0) / wins.length
    : null;
  const averageLoss = losses.length
    ? losses.reduce((a, t) => a + (t.unitReturn ?? 0), 0) / losses.length
    : null;
  const expectancy = n && netReturn != null ? netReturn / n : null;

  const grossWins = wins.reduce((a, t) => a + (t.unitReturn ?? 0), 0);
  const grossLossAbs = Math.abs(losses.reduce((a, t) => a + (t.unitReturn ?? 0), 0));
  const profitFactor =
    grossLossAbs > 0 ? grossWins / grossLossAbs : grossWins > 0 ? null : null;

  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of returns) {
    equity += r;
    peak = Math.max(peak, equity);
    maxDd = Math.max(maxDd, peak - equity);
  }

  const holdings = closed
    .map((t) => t.holdingBars)
    .filter((h): h is number => typeof h === "number" && Number.isFinite(h));
  const avgHold = holdings.length
    ? holdings.reduce((a, b) => a + b, 0) / holdings.length
    : null;

  let maxWinStreak = 0;
  let maxLossStreak = 0;
  let curW = 0;
  let curL = 0;
  for (const t of closed) {
    if ((t.unitReturn ?? 0) > 0) {
      curW += 1;
      curL = 0;
      maxWinStreak = Math.max(maxWinStreak, curW);
    } else if ((t.unitReturn ?? 0) < 0) {
      curL += 1;
      curW = 0;
      maxLossStreak = Math.max(maxLossStreak, curL);
    } else {
      curW = 0;
      curL = 0;
    }
  }

  let sharpe: number | null = null;
  if (n >= minSample) {
    const mean = expectancy ?? 0;
    const variance =
      returns.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(1, n - 1);
    const sd = Math.sqrt(variance);
    sharpe = sd > 0 ? mean / sd : null;
  }

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: breakeven.length,
    ambiguousTrades: ambiguous.length,
    winRate: metric(
      "winRate",
      "Historical win rate",
      winRate,
      n,
      minSample,
      "Closed winning trades / closed decisive trades",
      "unitReturn > 0 among CLOSED trades; excludes AMBIGUOUS",
      [
        "Historical win rate is not probability of the next trade winning",
        `${ambiguous.length} ambiguous trades excluded from win rate`,
      ],
    ),
    netReturn: metric(
      "netReturn",
      "Net unit return",
      netReturn,
      n,
      minSample,
      "Sum of closed unit returns under research assumptions",
      "sum(unitReturn) for CLOSED trades",
    ),
    averageWin: metric(
      "averageWin",
      "Average win",
      averageWin,
      wins.length,
      Math.min(10, minSample),
      "Mean unit return of winning trades",
      "mean(unitReturn | unitReturn > 0)",
    ),
    averageLoss: metric(
      "averageLoss",
      "Average loss",
      averageLoss,
      losses.length,
      Math.min(10, minSample),
      "Mean unit return of losing trades",
      "mean(unitReturn | unitReturn < 0)",
    ),
    expectancy: metric(
      "expectancy",
      "Expectancy",
      expectancy,
      n,
      minSample,
      "Mean unit return per closed trade",
      "netReturn / closedTradeCount",
    ),
    profitFactor: metric(
      "profitFactor",
      "Profit factor",
      profitFactor,
      n,
      minSample,
      "Gross wins / abs(gross losses)",
      "sum(wins) / abs(sum(losses))",
      profitFactor == null && grossWins > 0 && grossLossAbs === 0
        ? ["undefined when no losses"]
        : [],
    ),
    maxDrawdown: metric(
      "maxDrawdown",
      "Maximum drawdown",
      n ? maxDd : null,
      n,
      minSample,
      "Peak-to-trough decline of cumulative unit equity",
      "max(peakEquity - equity) over closed trade sequence",
    ),
    averageHoldingBars: metric(
      "averageHoldingBars",
      "Average holding bars",
      avgHold,
      holdings.length,
      Math.min(10, minSample),
      "Mean holding duration in bars",
      "mean(holdingBars) for CLOSED trades with holdingBars",
    ),
    consecutiveWins: metric(
      "consecutiveWins",
      "Max consecutive wins",
      n ? maxWinStreak : null,
      n,
      minSample,
      "Longest winning streak among closed trades",
      "max streak where unitReturn > 0",
    ),
    consecutiveLosses: metric(
      "consecutiveLosses",
      "Max consecutive losses",
      n ? maxLossStreak : null,
      n,
      minSample,
      "Longest losing streak among closed trades",
      "max streak where unitReturn < 0",
    ),
    sharpe: metric(
      "sharpe",
      "Sharpe-like ratio (research)",
      sharpe,
      n,
      minSample,
      "Mean unit return / sample stdev — research assumption, not annualized live Sharpe",
      "mean(r) / stdev(r) on closed unit returns",
      ["Not a broker-account Sharpe; no risk-free rate adjustment"],
    ),
  };
}
