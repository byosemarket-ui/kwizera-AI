/**
 * Phase 5F STEP 4 — GROSS_OHLC_ANALYTICAL execution assumptions (documented, versioned).
 */
import {
  MIF_BACKTEST_EXECUTION_MODEL_ID,
  MIF_BACKTEST_EXECUTION_MODEL_VERSION,
  MIF_BACKTEST_DEFAULT_INITIAL_CAPITAL,
  MIF_BACKTEST_DEFAULT_MAX_POSITIONS,
  MIF_BACKTEST_DEFAULT_RISK_FRACTION,
} from "./contracts.js";
import type { MifBacktestCostAvailabilityReport } from "./types.js";

export function buildGrossOhlcAssumptions(input?: {
  initialCapital?: number;
  riskFraction?: number;
  maxPositions?: number;
  maxHorizonBars?: number;
  maxLevelObservationBars?: number;
}): Record<string, unknown> {
  return {
    executionModelId: MIF_BACKTEST_EXECUTION_MODEL_ID,
    executionModelVersion: MIF_BACKTEST_EXECUTION_MODEL_VERSION,
    costAdjusted: false,
    label: "GROSS_OHLC_ANALYTICAL",
    entryReference:
      "Structured entry price when present; else activation candle close (AFTER tip close).",
    exitReference:
      "Level outcome resolution close when TARGET/INVALIDATION; else last COMPLETE horizon close for unit ledger mark; ambiguity → no fill order invented.",
    targetInvalidationRules: "Reuse STEP 3 / 5D.7 evaluateOpportunityOutcome OHLC touch semantics.",
    candleCloseAssumptions:
      "Only CLOSED bars with authoritative closeTime <= decisionTime visible at tip; future bars only openTime > activation.",
    activationTiming: "activationOpenTimeSec = tip open; outcomes use bars strictly after tip.",
    sameCandleAmbiguity: "BOTH_AMBIGUOUS_SAME_CANDLE preserved; no invented event order.",
    gaps: "Detected and flagged; never synthetically filled.",
    missingData: "Missing levels remain missing; incomplete horizons marked PARTIAL/INSUFFICIENT.",
    overlappingSignals: "Max concurrent analytical positions enforced; excess skipped (not trades).",
    concurrentPositionAssumptions: `maxPositions=${input?.maxPositions ?? MIF_BACKTEST_DEFAULT_MAX_POSITIONS}`,
    positionSizing:
      `Unit risk fraction ${input?.riskFraction ?? MIF_BACKTEST_DEFAULT_RISK_FRACTION} of initialCapital research assumption — not broker margin.`,
    capitalAssumption:
      `initialCapital=${input?.initialCapital ?? MIF_BACKTEST_DEFAULT_INITIAL_CAPITAL} research units — not real account balance.`,
    maxHorizonBars: input?.maxHorizonBars ?? 16,
    maxLevelObservationBars: input?.maxLevelObservationBars ?? 200,
    notBrokerFills: true,
    notCostAdjusted: true,
    notCalibratedProbability: true,
  };
}

export function buildCostAvailabilityReport(): MifBacktestCostAvailabilityReport {
  return {
    spread: "NOT_CONSUMED",
    slippage: "UNAVAILABLE",
    commission: "UNAVAILABLE",
    swap: "UNAVAILABLE",
    suitableForCostAdjustedBacktest: false,
    costAdjusted: false,
    note:
      "Gross OHLC only. Spread may exist on bars but is not consumed. Slippage/commission/swap UNAVAILABLE. Never silently assume zero costs as net.",
  };
}
