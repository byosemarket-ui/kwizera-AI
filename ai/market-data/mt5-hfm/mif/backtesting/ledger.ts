/**
 * Phase 5F STEP 4 — bounded gross unit ledger (research assumption, not broker account).
 * Prediction forward returns are not automatically trade PnL; this ledger converts
 * closed directional path metrics into unit returns under explicit overlap rules.
 */
import {
  MIF_BACKTEST_DEFAULT_INITIAL_CAPITAL,
  MIF_BACKTEST_DEFAULT_MAX_POSITIONS,
  MIF_BACKTEST_DEFAULT_RISK_FRACTION,
  MIF_BACKTEST_LEDGER_POLICY_ID,
  MIF_BACKTEST_LEDGER_POLICY_VERSION,
} from "./contracts.js";
import type { MifBacktestTipPrediction, MifBacktestLedgerSummary } from "./types.js";

export function buildGrossUnitLedger(input: {
  tips: readonly MifBacktestTipPrediction[];
  initialCapital?: number;
  riskFraction?: number;
  maxPositions?: number;
  preferredHorizon?: number;
}): MifBacktestLedgerSummary {
  const initialCapital = input.initialCapital ?? MIF_BACKTEST_DEFAULT_INITIAL_CAPITAL;
  const riskFraction = input.riskFraction ?? MIF_BACKTEST_DEFAULT_RISK_FRACTION;
  const maxPositions = input.maxPositions ?? MIF_BACKTEST_DEFAULT_MAX_POSITIONS;
  const preferredHorizon = input.preferredHorizon ?? 8;

  const trades: MifBacktestLedgerSummary["trades"][number][] = [];
  const equityCurve: MifBacktestLedgerSummary["equityCurve"][number][] = [];
  let equity = initialCapital;
  let peak = initialCapital;
  let openCount = 0;
  let skippedOverlap = 0;
  const unitReturns: number[] = [];
  let grossWins = 0;
  let grossLosses = 0;
  let winSum = 0;
  let lossSumAbs = 0;

  for (const tip of input.tips) {
    if (tip.skippedDuplicate) continue;
    if (!tip.outcome || tip.snapshot.status !== "FROZEN") continue;

    if (openCount >= maxPositions) {
      skippedOverlap += 1;
      trades.push({
        predictionId: tip.predictionId,
        tipOpenTimeSec: tip.tipOpenTimeSec,
        direction: tip.snapshot.direction,
        entryPrice: tip.outcome.pathOutcome.entryPrice ?? 0,
        exitPrice: null,
        unitReturn: null,
        status: "SKIPPED",
        exitReason: "MAX_POSITIONS",
      });
      continue;
    }

    const level = tip.outcome.levelOutcome.resultKind;
    if (level === "BOTH_AMBIGUOUS_SAME_CANDLE" || level === "AMBIGUOUS_OUTCOME") {
      trades.push({
        predictionId: tip.predictionId,
        tipOpenTimeSec: tip.tipOpenTimeSec,
        direction: tip.snapshot.direction,
        entryPrice: tip.outcome.pathOutcome.entryPrice ?? 0,
        exitPrice: null,
        unitReturn: null,
        status: "AMBIGUOUS",
        exitReason: level,
      });
      continue;
    }

    const hm =
      tip.outcome.pathOutcome.horizons.find((h) => h.requestedHorizon === preferredHorizon)
      ?? tip.outcome.pathOutcome.horizons.find((h) => h.forwardReturn != null);

    if (!hm || hm.forwardReturn == null || hm.entryPrice == null) {
      trades.push({
        predictionId: tip.predictionId,
        tipOpenTimeSec: tip.tipOpenTimeSec,
        direction: tip.snapshot.direction,
        entryPrice: tip.outcome.pathOutcome.entryPrice ?? 0,
        exitPrice: null,
        unitReturn: null,
        status: "INSUFFICIENT",
        exitReason: "NO_PATH_RETURN",
      });
      continue;
    }

    // Unit return from path metric (gross OHLC). Not broker fill PnL.
    const unitReturn = hm.forwardReturn;
    const exitPrice =
      tip.outcome.levelOutcome.resolvedClose
      ?? (hm.entryPrice != null && unitReturn != null
        ? tip.snapshot.direction === "SELL"
          ? hm.entryPrice * (1 - unitReturn)
          : hm.entryPrice * (1 + unitReturn)
        : null);

    openCount += 1;
    equity = equity * (1 + unitReturn * riskFraction);
    peak = Math.max(peak, equity);
    unitReturns.push(unitReturn);
    if (unitReturn >= 0) {
      grossWins += 1;
      winSum += unitReturn;
    } else {
      grossLosses += 1;
      lossSumAbs += Math.abs(unitReturn);
    }
    openCount -= 1;

    trades.push({
      predictionId: tip.predictionId,
      tipOpenTimeSec: tip.tipOpenTimeSec,
      direction: tip.snapshot.direction,
      entryPrice: hm.entryPrice,
      exitPrice,
      unitReturn,
      status: "CLOSED",
      exitReason: level === "TARGET_REACHED" || level === "INVALIDATION_REACHED"
        ? level
        : `HORIZON_${hm.requestedHorizon}`,
    });

    equityCurve.push({
      timeSec: tip.tipOpenTimeSec,
      equity,
      peakEquity: peak,
      drawdown: peak > 0 ? (peak - equity) / peak : 0,
    });
  }

  const closed = trades.filter((t) => t.status === "CLOSED" && t.unitReturn != null);
  const expectancy =
    closed.length >= 5
      ? closed.reduce((a, t) => a + (t.unitReturn ?? 0), 0) / closed.length
      : null;
  const profitFactor =
    closed.length >= 5 && lossSumAbs > 0
      ? winSum / lossSumAbs
      : closed.length >= 5 && lossSumAbs === 0 && winSum > 0
        ? null // infinite — report unsupported rather than Infinity
        : null;

  return {
    policyId: MIF_BACKTEST_LEDGER_POLICY_ID,
    policyVersion: MIF_BACKTEST_LEDGER_POLICY_VERSION,
    implemented: true,
    initialCapital,
    riskFraction,
    maxPositions,
    trades,
    equityCurve,
    finalEquity: equity,
    peakEquity: peak,
    maxDrawdown: equityCurve.reduce((m, p) => Math.max(m, p.drawdown), 0),
    grossExpectancy: expectancy,
    profitFactor:
      profitFactor == null && closed.length >= 5 && lossSumAbs === 0 && winSum > 0
        ? null
        : profitFactor,
    closedTradeCount: closed.length,
    skippedOverlapCount: skippedOverlap,
    note:
      "Gross unit ledger from path forward returns. Not broker fills. Not cost-adjusted. Overlaps skipped at maxPositions.",
  };
}
