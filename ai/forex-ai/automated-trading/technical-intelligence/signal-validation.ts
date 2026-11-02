/**
 * Phase 4.18F.3 — Signal validation over strategy candidates.
 * Indicators never independently force BUY/SELL. Canonical NO_TRADE authority preserved.
 */

import type { StrategyDirection } from "../auto-engine/strategy/rules.js";
import type {
  IndicatorSuite,
  MarketConditionRecord,
  SignalValidationOutcome,
  SignalValidationRecord,
  StructureIntelSummary,
} from "./types.js";
import { SIGNAL_VALIDATION_VERSION, TECH_INTEL_SCHEMA } from "./types.js";

export function validateStrategySignal(input: {
  instrument: string;
  timeframe: string;
  strategyDirection: StrategyDirection | null;
  strategyCode: string | null;
  suite: IndicatorSuite;
  condition: MarketConditionRecord;
  structure?: StructureIntelSummary | null;
  quoteFresh?: boolean | null;
  nowMs?: number;
}): SignalValidationRecord {
  const nowMs = input.nowMs ?? Date.now();
  const rejectionReasons: string[] = [];
  const supportReasons: string[] = [];
  const direction = input.strategyDirection;

  let dataQuality: SignalValidationRecord["dataQuality"] = "VALID";
  if (input.condition.insufficient || input.suite.closedCandleCount < 21) {
    dataQuality = "INSUFFICIENT_DATA";
    rejectionReasons.push("INSUFFICIENT_INDICATOR_HISTORY");
  }
  if (input.condition.stale || input.quoteFresh === false) {
    dataQuality = dataQuality === "INSUFFICIENT_DATA" ? "INSUFFICIENT_DATA" : "STALE";
    rejectionReasons.push("STALE_OR_UNFRESH_MARKET_DATA");
  }

  // Agreement helpers
  let indicatorAgreement: SignalValidationRecord["indicatorAgreement"] = "UNKNOWN";
  let structureAgreement: SignalValidationRecord["structureAgreement"] = "UNKNOWN";
  let trendAlignment: SignalValidationRecord["trendAlignment"] = "UNKNOWN";
  let momentumConfirmation: SignalValidationRecord["momentumConfirmation"] = "UNKNOWN";

  const wantBuy = direction === "BUY";
  const wantSell = direction === "SELL";

  if (wantBuy || wantSell) {
    const maSupport =
      (wantBuy && input.suite.movingAverages.sma9VsSma21 === "ABOVE")
      || (wantSell && input.suite.movingAverages.sma9VsSma21 === "BELOW");
    const maConflict =
      (wantBuy && input.suite.movingAverages.sma9VsSma21 === "BELOW")
      || (wantSell && input.suite.movingAverages.sma9VsSma21 === "ABOVE");
    if (maSupport) {
      indicatorAgreement = "SUPPORTS";
      supportReasons.push("SMA stack aligns with candidate");
    } else if (maConflict) {
      indicatorAgreement = "CONFLICTS";
      rejectionReasons.push("SMA_STACK_CONFLICTS_WITH_CANDIDATE");
    } else {
      indicatorAgreement = "NEUTRAL";
    }

    const rsiConflict =
      (wantBuy && input.suite.rsi.zone === "OVERBOUGHT")
      || (wantSell && input.suite.rsi.zone === "OVERSOLD");
    if (rsiConflict) {
      // RSI zone is caution, not automatic veto — visible disagreement.
      if (indicatorAgreement === "SUPPORTS") indicatorAgreement = "NEUTRAL";
      rejectionReasons.push("RSI_ZONE_CAUTION_NOT_AUTO_SIGNAL");
    }

    const macdSupport =
      (wantBuy && (input.suite.macd.cross === "BULLISH_CROSS" || input.suite.macd.histogramMomentum === "EXPANDING_BULL"))
      || (wantSell && (input.suite.macd.cross === "BEARISH_CROSS" || input.suite.macd.histogramMomentum === "EXPANDING_BEAR"));
    const macdConflict =
      (wantBuy && (input.suite.macd.cross === "BEARISH_CROSS" || input.suite.macd.histogramMomentum === "EXPANDING_BEAR"))
      || (wantSell && (input.suite.macd.cross === "BULLISH_CROSS" || input.suite.macd.histogramMomentum === "EXPANDING_BULL"));
    if (macdSupport) supportReasons.push("MACD momentum aligns");
    if (macdConflict) {
      indicatorAgreement = indicatorAgreement === "SUPPORTS" ? "NEUTRAL" : "CONFLICTS";
      rejectionReasons.push("MACD_CONFLICTS_WITH_CANDIDATE");
    }

    const st = input.structure?.trendState;
    if (st === "BULLISH" || st === "BEARISH" || st === "RANGE") {
      if ((wantBuy && st === "BULLISH") || (wantSell && st === "BEARISH")) {
        structureAgreement = "SUPPORTS";
        supportReasons.push(`Structure ${st} supports candidate`);
      } else if ((wantBuy && st === "BEARISH") || (wantSell && st === "BULLISH")) {
        structureAgreement = "CONFLICTS";
        rejectionReasons.push("STRUCTURE_TREND_CONFLICT");
      } else if (st === "RANGE") {
        structureAgreement = "NEUTRAL";
        rejectionReasons.push("STRUCTURE_RANGING");
      } else {
        structureAgreement = "NEUTRAL";
      }
    } else {
      structureAgreement = "UNKNOWN";
    }

    const recentConflictEvent = (input.structure?.events ?? []).some(
      (e) =>
        e.status === "CONFIRMED"
        && ((wantBuy && e.type === "CHOCH" && e.direction === "BEARISH")
          || (wantSell && e.type === "CHOCH" && e.direction === "BULLISH")),
    );
    if (recentConflictEvent) {
      structureAgreement = "CONFLICTS";
      rejectionReasons.push("RECENT_CHOCH_OPPOSES_CANDIDATE");
    }

    if (
      (wantBuy && input.condition.trend === "BULLISH")
      || (wantSell && input.condition.trend === "BEARISH")
    ) {
      trendAlignment = "ALIGNED";
      supportReasons.push(`Trend ${input.condition.trend} aligned`);
    } else if (
      (wantBuy && input.condition.trend === "BEARISH")
      || (wantSell && input.condition.trend === "BULLISH")
    ) {
      trendAlignment = "OPPOSED";
      rejectionReasons.push("TREND_OPPOSED");
    } else if (input.condition.trend === "RANGING" || input.condition.trend === "MIXED") {
      trendAlignment = "NEUTRAL";
      rejectionReasons.push(`TREND_${input.condition.trend}`);
    } else {
      trendAlignment = "UNKNOWN";
    }

    if (
      (wantBuy && input.condition.momentum === "BULLISH_MOMENTUM")
      || (wantSell && input.condition.momentum === "BEARISH_MOMENTUM")
    ) {
      momentumConfirmation = "CONFIRMED";
      supportReasons.push("Momentum confirmed");
    } else if (
      (wantBuy && input.condition.momentum === "BEARISH_MOMENTUM")
      || (wantSell && input.condition.momentum === "BULLISH_MOMENTUM")
    ) {
      momentumConfirmation = "OPPOSED";
      rejectionReasons.push("MOMENTUM_OPPOSED");
    } else if (input.condition.momentum === "WEAK_MOMENTUM" || input.condition.momentum === "MIXED_MOMENTUM") {
      momentumConfirmation = "WEAK";
    } else {
      momentumConfirmation = "UNKNOWN";
    }

    if (input.condition.volatility === "EXTREME") {
      rejectionReasons.push("EXTREME_VOLATILITY");
    }
  }

  let outcome: SignalValidationOutcome;
  if (dataQuality === "INSUFFICIENT_DATA") {
    outcome = "INSUFFICIENT_DATA";
  } else if (dataQuality === "STALE") {
    outcome = "STALE_DATA";
  } else if (direction === "NO_TRADE" || direction == null) {
    outcome = "NO_TRADE";
    rejectionReasons.push(input.strategyCode ? `STRATEGY_${input.strategyCode}` : "STRATEGY_NO_TRADE");
  } else if (
    indicatorAgreement === "CONFLICTS"
    || structureAgreement === "CONFLICTS"
    || trendAlignment === "OPPOSED"
  ) {
    outcome = "CONFLICT";
  } else if (wantBuy) {
    outcome = "BUY_CANDIDATE";
  } else if (wantSell) {
    outcome = "SELL_CANDIDATE";
  } else {
    outcome = "NO_TRADE";
  }

  // Hard rule: indicators never promote NO_TRADE → BUY/SELL
  if ((direction === "NO_TRADE" || direction == null) && (outcome === "BUY_CANDIDATE" || outcome === "SELL_CANDIDATE")) {
    outcome = "NO_TRADE";
    rejectionReasons.push("INDICATORS_CANNOT_OVERRIDE_STRATEGY_NO_TRADE");
  }

  return {
    schemaVersion: TECH_INTEL_SCHEMA,
    validationVersion: SIGNAL_VALIDATION_VERSION,
    instrument: input.instrument,
    timeframe: input.timeframe,
    outcome,
    strategyDirection: direction,
    strategyCode: input.strategyCode,
    indicatorAgreement,
    structureAgreement,
    trendAlignment,
    momentumConfirmation,
    volatilityCondition: input.condition.volatility,
    dataQuality,
    rejectionReasons: [...new Set(rejectionReasons)].slice(0, 24),
    supportReasons: [...new Set(supportReasons)].slice(0, 24),
    confidenceType: "ANALYSIS_CONFIDENCE",
    isCalibratedWinProbability: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    calculatedAtMs: nowMs,
  };
}
