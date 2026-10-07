/**
 * Risk context + optional SL/TP/RR from objective structure only.
 * No account balance, leverage, or invented percentages.
 */
import type { ForexMtfAlignmentResult, ForexMultiTimeframeMarketState } from "../mtf/types.js";
import type {
  ForexDecisionScenario,
  ForexEntryZone,
  ForexRiskContext,
  ForexRiskReward,
} from "./types.js";

function primaryState(mtf: ForexMultiTimeframeMarketState) {
  return mtf.slots.find((s) => s.timeframe === "15m" && s.marketState)?.marketState
    ?? mtf.slots.find((s) => s.marketState)?.marketState
    ?? null;
}

export function buildRiskContext(
  mtf: ForexMultiTimeframeMarketState,
  alignment: ForexMtfAlignmentResult,
  entryZone: ForexEntryZone,
): ForexRiskContext {
  const state = primaryState(mtf);
  const atr = state?.volatility?.atr ?? state?.indicators?.atr14 ?? null;
  const atrPercent = state?.volatility?.atrPercent ?? null;
  const volatility = state?.volatility?.classification
    ?? mtf.slots.find((s) => s.compact.volatility)?.compact.volatility
    ?? null;

  const price = entryZone.currentPrice;
  let distanceToEntry: number | null = null;
  if (
    price != null
    && entryZone.lowerBound != null
    && entryZone.upperBound != null
    && Number.isFinite(price)
  ) {
    if (price >= entryZone.lowerBound && price <= entryZone.upperBound) {
      distanceToEntry = 0;
    } else if (price < entryZone.lowerBound) {
      distanceToEntry = entryZone.lowerBound - price;
    } else {
      distanceToEntry = price - entryZone.upperBound;
    }
  }

  let distanceToInvalidation: number | null = null;
  if (price != null && entryZone.invalidationLevel != null) {
    distanceToInvalidation = Math.abs(price - entryZone.invalidationLevel);
  }

  const factors: string[] = [];
  if (volatility) factors.push(`Volatility classification=${volatility}`);
  if (atr != null) factors.push(`ATR14=${atr}`);
  if (alignment.overall === "MIXED" || alignment.overall === "CONFLICTING") {
    factors.push(`Timeframe alignment=${alignment.overall}`);
  }
  if (mtf.dataQuality !== "COMPLETE_LIVE" && mtf.dataQuality !== "COMPLETE_CONNECTED") {
    factors.push(`Data quality=${mtf.dataQuality}`);
  }
  if (entryZone.status === "UNAVAILABLE") {
    factors.push("Entry zone unavailable — structural risk levels limited");
  }
  factors.push("No account balance / leverage / monetary risk computed.");

  return {
    volatility,
    atr,
    atrPercent,
    distanceToEntry,
    distanceToInvalidation,
    timeframeConflict: alignment.overall === "CONFLICTING" || alignment.overall === "MIXED",
    dataQuality: mtf.dataQuality,
    factors,
  };
}

/**
 * SL/TP candidates only from swing structure + entry reference.
 * If methodology insufficient → null / [].
 */
export function buildStopAndTargets(
  mtf: ForexMultiTimeframeMarketState,
  scenario: ForexDecisionScenario,
  entryZone: ForexEntryZone,
): { stopLossCandidate: number | null; takeProfitCandidates: number[]; riskReward: ForexRiskReward } {
  const unavailable = (reason: string): {
    stopLossCandidate: number | null;
    takeProfitCandidates: number[];
    riskReward: ForexRiskReward;
  } => ({
    stopLossCandidate: null,
    takeProfitCandidates: [],
    riskReward: {
      risk: null,
      reward: null,
      ratio: null,
      method: null,
      unavailableReason: reason,
    },
  });

  if (entryZone.status === "UNAVAILABLE" || entryZone.referencePrice == null) {
    return unavailable(
      "Risk levels unavailable because the required objective market structure / entry reference is not sufficiently established.",
    );
  }

  const state = mtf.slots.find((s) => s.timeframe === entryZone.timeframe)?.marketState
    ?? primaryState(mtf);
  const swingHigh = state?.marketStructure?.lastSwingHigh ?? null;
  const swingLow = state?.marketStructure?.lastSwingLow ?? null;

  if (swingHigh == null || swingLow == null) {
    return unavailable("SL/TP unavailable — BASIC_SWINGS high/low missing.");
  }

  let stopLossCandidate: number | null = entryZone.invalidationLevel;
  let takeProfitCandidates: number[] = [];

  if (scenario.direction === "BULLISH") {
    stopLossCandidate = entryZone.invalidationLevel ?? swingLow;
    takeProfitCandidates = [swingHigh].filter((n) => Number.isFinite(n));
  } else if (scenario.direction === "BEARISH") {
    stopLossCandidate = entryZone.invalidationLevel ?? swingHigh;
    takeProfitCandidates = [swingLow].filter((n) => Number.isFinite(n));
  } else {
    return unavailable("SL/TP not derived for neutral/non-directional scenarios.");
  }

  if (stopLossCandidate == null || takeProfitCandidates.length === 0 || entryZone.referencePrice == null) {
    return unavailable("SL/TP incomplete — cannot compute risk/reward without entry, stop, and target.");
  }

  const entry = entryZone.referencePrice;
  const risk = Math.abs(entry - stopLossCandidate);
  const reward = Math.abs(takeProfitCandidates[0]! - entry);

  if (!(risk > 0) || !(reward >= 0) || !Number.isFinite(risk) || !Number.isFinite(reward)) {
    return unavailable("Risk/reward arithmetic invalid (non-finite or zero risk).");
  }

  const ratio = reward / risk;
  if (!Number.isFinite(ratio) || ratio < 0) {
    return unavailable("Risk/reward ratio not finite/non-negative.");
  }

  return {
    stopLossCandidate,
    takeProfitCandidates,
    riskReward: {
      risk,
      reward,
      ratio,
      method: "swing-structure: |entry-invalidation| risk, |swing-opposite-entry| reward",
      unavailableReason: null,
    },
  };
}
