/**
 * Phase 4.18F.3 — Deterministic trend / momentum / volatility classification.
 * Documented evidence rules; no arbitrary opaque weights.
 */

import type { IndicatorSuite, MarketConditionRecord, MomentumStateIntel, StructureIntelSummary, TrendStateIntel, VolatilityStateIntel } from "./types.js";
import { TECH_INTEL_SCHEMA } from "./types.js";

export function classifyMarketCondition(input: {
  suite: IndicatorSuite;
  structure?: StructureIntelSummary | null;
  nowMs?: number;
}): MarketConditionRecord {
  const suite = input.suite;
  const structure = input.structure ?? null;
  const nowMs = input.nowMs ?? Date.now();
  const trendEvidence: string[] = [];
  const momentumEvidence: string[] = [];
  const volatilityEvidence: string[] = [];

  const insufficient =
    suite.closedCandleCount < 21
    || suite.movingAverages.sma21.quality === "INSUFFICIENT_DATA"
    || suite.atr.atr.quality === "INSUFFICIENT_DATA";

  const stale =
    suite.movingAverages.sma9.quality === "STALE"
    || suite.rsi.rsi14.quality === "STALE"
    || suite.atr.atr.quality === "STALE";

  // --- Trend ---
  let trend: TrendStateIntel = "UNKNOWN";
  if (insufficient) {
    trend = "UNKNOWN";
    trendEvidence.push("Insufficient closed history for trend classification.");
  } else {
    const maBull =
      suite.movingAverages.sma9VsSma21 === "ABOVE"
      && suite.movingAverages.priceVsSma21 === "ABOVE";
    const maBear =
      suite.movingAverages.sma9VsSma21 === "BELOW"
      && suite.movingAverages.priceVsSma21 === "BELOW";
    const structTrend = structure?.trendState ?? null;
    if (structTrend === "BULLISH") trendEvidence.push(`Structure trend=${structTrend}`);
    if (structTrend === "BEARISH") trendEvidence.push(`Structure trend=${structTrend}`);
    if (structTrend === "RANGE") trendEvidence.push("Structure trend=RANGE");

    const adxStrong =
      suite.adx.adx.quality === "VALID"
      && typeof suite.adx.adx.value === "number"
      && suite.adx.adx.value >= 20;
    if (suite.adx.adx.quality === "VALID") {
      trendEvidence.push(`ADX=${suite.adx.adx.value?.toFixed?.(2) ?? suite.adx.adx.value} strength=${suite.adx.trendStrength}`);
    } else {
      trendEvidence.push(`ADX unavailable (${suite.adx.adx.quality})`);
    }

    if (maBull) trendEvidence.push("SMA9>SMA21 and price above SMA21");
    if (maBear) trendEvidence.push("SMA9<SMA21 and price below SMA21");

    if (structTrend === "RANGE" && !adxStrong) {
      trend = "RANGING";
    } else if (maBull && (structTrend === "BULLISH" || structTrend == null || structTrend === "UNKNOWN")) {
      trend = "BULLISH";
    } else if (maBear && (structTrend === "BEARISH" || structTrend == null || structTrend === "UNKNOWN")) {
      trend = "BEARISH";
    } else if (maBull && structTrend === "BEARISH") {
      trend = "MIXED";
      trendEvidence.push("MA bullish vs structure bearish");
    } else if (maBear && structTrend === "BULLISH") {
      trend = "MIXED";
      trendEvidence.push("MA bearish vs structure bullish");
    } else if (structTrend === "BULLISH") {
      trend = "BULLISH";
    } else if (structTrend === "BEARISH") {
      trend = "BEARISH";
    } else if (structTrend === "RANGE") {
      trend = "RANGING";
    } else if (maBull) {
      trend = "BULLISH";
    } else if (maBear) {
      trend = "BEARISH";
    } else {
      trend = "MIXED";
      trendEvidence.push("MA and structure inconclusive");
    }
  }

  // --- Momentum ---
  let momentum: MomentumStateIntel = "UNKNOWN";
  if (insufficient) {
    momentum = "UNKNOWN";
    momentumEvidence.push("Insufficient history for momentum.");
  } else {
    const rsi = suite.rsi.rsi14.value;
    const macdCross = suite.macd.cross;
    const hist = suite.macd.histogramMomentum;
    if (suite.rsi.rsi14.quality === "VALID" && rsi != null) {
      momentumEvidence.push(`RSI14=${rsi.toFixed(2)} zone=${suite.rsi.zone} mom=${suite.rsi.momentum}`);
    }
    if (suite.macd.macd.quality === "VALID") {
      momentumEvidence.push(`MACD cross=${macdCross} hist=${hist}`);
    }
    const bullVotes =
      (suite.rsi.momentum === "RISING" ? 1 : 0)
      + (macdCross === "BULLISH_CROSS" || hist === "EXPANDING_BULL" ? 1 : 0)
      + (suite.movingAverages.sma9Slope === "UP" ? 1 : 0);
    const bearVotes =
      (suite.rsi.momentum === "FALLING" ? 1 : 0)
      + (macdCross === "BEARISH_CROSS" || hist === "EXPANDING_BEAR" ? 1 : 0)
      + (suite.movingAverages.sma9Slope === "DOWN" ? 1 : 0);

    if (bullVotes >= 2 && bearVotes === 0) momentum = "BULLISH_MOMENTUM";
    else if (bearVotes >= 2 && bullVotes === 0) momentum = "BEARISH_MOMENTUM";
    else if (bullVotes > 0 && bearVotes > 0) momentum = "MIXED_MOMENTUM";
    else if (bullVotes === 1 || bearVotes === 1) momentum = "WEAK_MOMENTUM";
    else momentum = "WEAK_MOMENTUM";
    momentumEvidence.push(`votes bull=${bullVotes} bear=${bearVotes}`);
  }

  // --- Volatility ---
  let volatility: VolatilityStateIntel = suite.atr.volatilityClass;
  if (suite.atr.atr.quality !== "VALID") {
    volatility = "UNKNOWN";
    volatilityEvidence.push(`ATR quality=${suite.atr.atr.quality}`);
  } else {
    volatilityEvidence.push(
      `ATR(SMA_OF_TR)=${suite.atr.atr.value} atrPct=${suite.atr.atrPctOfPrice.value} class=${suite.atr.volatilityClass}`,
    );
    if (suite.bollinger.volatilityRegime !== "UNKNOWN") {
      volatilityEvidence.push(`BB regime=${suite.bollinger.volatilityRegime}`);
    }
  }

  return {
    schemaVersion: TECH_INTEL_SCHEMA,
    instrument: suite.instrument,
    timeframe: suite.timeframe,
    trend,
    momentum,
    volatility,
    trendEvidence,
    momentumEvidence,
    volatilityEvidence,
    insufficient,
    stale,
    calculatedAtMs: nowMs,
  };
}
