export const DAILY_RISK_SCHEMA = "kwizera.daily-risk.v1" as const;

export interface DailyRiskSnapshot {
  schemaVersion: typeof DAILY_RISK_SCHEMA;
  /** Trading day key YYYY-MM-DD in configured timezone (default UTC). */
  tradingDayKey: string;
  timezone: "UTC";
  accountId: string | null;
  accountCurrency: string | null;
  dayStartEquity: number | null;
  dayStartBalance: number | null;
  dayStartRecordedAtUtc: string | null;
  currentEquity: number | null;
  currentBalance: number | null;
  currentUsableMargin: number | null;
  realizedPnlAccount: number | null;
  unrealizedPnlAccount: number | null;
  dailyDrawdownFraction: number | null;
  dailyLossAccount: number | null;
  depositsAccount: number | null;
  withdrawalsAccount: number | null;
  accountsFetchedAtUtc: string | null;
  closedTradesFetchedAtUtc: string | null;
  openTradesFetchedAtUtc: string | null;
  authoritative: boolean;
  blockers: string[];
  updatedAtUtc: string;
}

export interface DailyRiskComputeInput {
  nowMs?: number;
  timezone?: "UTC";
  accountId: string | null;
  accountCurrency: string | null;
  equity: number | null;
  balance: number | null;
  usableMargin: number | null;
  accountsFetchedAtUtc: string | null;
  /** Persisted day-start for this tradingDayKey when already known. */
  prior: DailyRiskSnapshot | null;
  /**
   * Closed trades with realized PnL attributed to this trading day.
   * Missing/uncertain → do not invent zero.
   */
  dayClosedTrades: Array<{
    tradeId?: string | null;
    closeTimeUtc: string | null;
    realizedPnl: number | null;
    amountChange?: number | null;
  }> | null;
  closedTradesFetchOk: boolean;
  closedTradesFetchedAtUtc: string | null;
  /** Sum of floating PnL from open trades when broker supplies it. */
  openUnrealizedPnl: number | null;
  openTradesFetchOk: boolean;
  openTradesFetchedAtUtc: string | null;
  /** Max age for accounts snapshot. */
  accountMaxAgeMs?: number;
}
