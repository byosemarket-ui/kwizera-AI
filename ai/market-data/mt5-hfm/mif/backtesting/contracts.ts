/**
 * Phase 5F STEP 4 — Professional Backtesting & Walk-Forward contracts.
 * Analytical GROSS_OHLC only. Not cost-adjusted. Not executable. Not STEP 5 calibration.
 */

export const MIF_BACKTEST_CONTRACT_ID = "kwizera.mif.backtesting.v1" as const;
export const MIF_BACKTEST_CONTRACT_VERSION = "1.0.0" as const;
export const MIF_BACKTEST_ENGINE_ID = "mif-backtesting-engine" as const;
export const MIF_BACKTEST_ENGINE_VERSION = "1.0.0" as const;

export const MIF_BACKTEST_EXECUTION_MODEL_ID = "GROSS_OHLC_ANALYTICAL" as const;
export const MIF_BACKTEST_EXECUTION_MODEL_VERSION = "1.0.0" as const;

export const MIF_WALK_FORWARD_POLICY_ID = "walk-forward-rolling-v1" as const;
export const MIF_WALK_FORWARD_POLICY_VERSION = "1.0.0" as const;

export const MIF_BACKTEST_LEDGER_POLICY_ID = "unit-ledger-gross-v1" as const;
export const MIF_BACKTEST_LEDGER_POLICY_VERSION = "1.0.0" as const;

/** VPS-safe bounds. */
export const MIF_BACKTEST_DEFAULT_MAX_STEPS = 50 as const;
export const MIF_BACKTEST_HARD_MAX_STEPS = 200 as const;
export const MIF_BACKTEST_DEFAULT_WARMUP = 40 as const;
export const MIF_BACKTEST_HARD_MAX_CANDLES = 500 as const;
export const MIF_BACKTEST_DEFAULT_MAX_FOLDS = 3 as const;
export const MIF_BACKTEST_HARD_MAX_FOLDS = 6 as const;
export const MIF_BACKTEST_DEFAULT_MIN_OOS_SAMPLES = 30 as const;
export const MIF_BACKTEST_DEFAULT_MAX_POSITIONS = 1 as const;
export const MIF_BACKTEST_DEFAULT_INITIAL_CAPITAL = 10_000 as const;
export const MIF_BACKTEST_DEFAULT_RISK_FRACTION = 0.01 as const;
export const MIF_BACKTEST_DEFAULT_TIMEOUT_MS = 60_000 as const;
export const MIF_BACKTEST_API_MAX_LIST = 50 as const;

/** Primary OOS metric — pinned before fold evaluation (multiple-testing honesty). */
export const MIF_BACKTEST_PRIMARY_METRICS = [
  "OOS_LEVEL_TARGET_RATE",
  "OOS_PATH_FORWARD_RETURN_MEAN_H8",
  "OOS_GROSS_UNIT_EXPECTANCY",
] as const;

export type MifBacktestPrimaryMetric = (typeof MIF_BACKTEST_PRIMARY_METRICS)[number];
export const MIF_BACKTEST_DEFAULT_PRIMARY_METRIC: MifBacktestPrimaryMetric =
  "OOS_PATH_FORWARD_RETURN_MEAN_H8";
