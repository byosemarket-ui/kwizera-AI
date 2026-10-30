import type { DailyRiskComputeInput, DailyRiskSnapshot } from "./types.js";
import { DAILY_RISK_SCHEMA } from "./types.js";

export function tradingDayKeyUtc(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

function parseMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? ms : null;
}

function finiteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Build authoritative daily-risk snapshot.
 * Unavailable / inconsistent inputs → authoritative=false and blockers (never treat as zero risk).
 */
export function computeDailyRiskSnapshot(input: DailyRiskComputeInput): DailyRiskSnapshot {
  const nowMs = input.nowMs ?? Date.now();
  const tradingDayKey = tradingDayKeyUtc(nowMs);
  const blockers: string[] = [];
  const accountMaxAgeMs = input.accountMaxAgeMs ?? 15_000;
  const updatedAtUtc = new Date(nowMs).toISOString();

  let dayStartEquity: number | null = null;
  let dayStartBalance: number | null = null;
  let dayStartRecordedAtUtc: string | null = null;

  const priorSameDay =
    input.prior
    && input.prior.tradingDayKey === tradingDayKey
    && input.prior.authoritative
    && finiteNumber(input.prior.dayStartEquity)
      ? input.prior
      : null;

  if (priorSameDay) {
    dayStartEquity = priorSameDay.dayStartEquity;
    dayStartBalance = priorSameDay.dayStartBalance;
    dayStartRecordedAtUtc = priorSameDay.dayStartRecordedAtUtc;
  }

  if (!finiteNumber(input.equity)) blockers.push("EQUITY_MISSING");
  if (!finiteNumber(input.balance)) blockers.push("BALANCE_MISSING");
  if (!input.accountCurrency || String(input.accountCurrency).trim().length !== 3) {
    blockers.push("ACCOUNT_CURRENCY_MISSING");
  }

  const acctMs = parseMs(input.accountsFetchedAtUtc);
  if (acctMs == null) blockers.push("ACCOUNT_FETCHED_AT_MISSING");
  else if (nowMs - acctMs > accountMaxAgeMs) blockers.push("ACCOUNT_STATE_STALE");
  else if (acctMs > nowMs + 5_000) blockers.push("ACCOUNT_FETCHED_AT_FUTURE");

  // Establish day-start only from a fresh accounts snapshot at/after day boundary.
  if (
    dayStartEquity == null
    && finiteNumber(input.equity)
    && acctMs != null
    && nowMs - acctMs <= accountMaxAgeMs
  ) {
    dayStartEquity = input.equity;
    dayStartBalance = finiteNumber(input.balance) ? input.balance : null;
    dayStartRecordedAtUtc = updatedAtUtc;
  }

  if (dayStartEquity == null || !finiteNumber(dayStartEquity) || !(dayStartEquity > 0)) {
    blockers.push("DAY_START_EQUITY_UNAVAILABLE");
  }

  let realizedPnlAccount: number | null = null;
  if (!input.closedTradesFetchOk || input.dayClosedTrades == null) {
    blockers.push("CLOSED_TRADES_UNAVAILABLE");
  } else {
    let sum = 0;
    for (const row of input.dayClosedTrades) {
      const closeMs = parseMs(row.closeTimeUtc);
      if (closeMs == null) {
        blockers.push("CLOSED_TRADE_TIME_MISSING");
        realizedPnlAccount = null;
        break;
      }
      if (tradingDayKeyUtc(closeMs) !== tradingDayKey) continue;
      if (!finiteNumber(row.realizedPnl)) {
        blockers.push("CLOSED_TRADE_PNL_MISSING");
        realizedPnlAccount = null;
        break;
      }
      sum += row.realizedPnl;
    }
    if (!blockers.includes("CLOSED_TRADE_TIME_MISSING") && !blockers.includes("CLOSED_TRADE_PNL_MISSING")) {
      realizedPnlAccount = sum;
    }
  }

  let unrealizedPnlAccount: number | null = null;
  if (!input.openTradesFetchOk) {
    blockers.push("OPEN_TRADES_UNAVAILABLE");
  } else if (input.openUnrealizedPnl == null || !finiteNumber(input.openUnrealizedPnl)) {
    // Empty open book with fetch ok may legitimately be 0 — only when explicitly provided.
    blockers.push("UNREALIZED_PNL_UNAVAILABLE");
  } else {
    unrealizedPnlAccount = input.openUnrealizedPnl;
  }

  let dailyDrawdownFraction: number | null = null;
  let dailyLossAccount: number | null = null;
  if (
    finiteNumber(dayStartEquity)
    && dayStartEquity > 0
    && finiteNumber(input.equity)
  ) {
    const dd = (dayStartEquity - input.equity) / dayStartEquity;
    dailyDrawdownFraction = Number.isFinite(dd) ? Math.max(0, dd) : null;
    if (dailyDrawdownFraction == null) blockers.push("DRAWDOWN_COMPUTE_FAILED");
    dailyLossAccount = Math.max(0, dayStartEquity - input.equity);
  }

  // Detect possible deposit/withdrawal discontinuity vs prior equity path (soft blocker).
  let depositsAccount: number | null = null;
  let withdrawalsAccount: number | null = null;
  if (
    priorSameDay
    && finiteNumber(priorSameDay.currentBalance)
    && finiteNumber(input.balance)
    && finiteNumber(realizedPnlAccount)
  ) {
    const expected = priorSameDay.currentBalance + realizedPnlAccount;
    const delta = input.balance - expected;
    if (Math.abs(delta) > 1e-6) {
      if (delta > 0) depositsAccount = delta;
      else withdrawalsAccount = -delta;
      // Not automatically fatal — but mark non-authoritative until reconciled.
      blockers.push("BALANCE_DISCONTINUITY");
    }
  }

  const authoritative = blockers.length === 0
    && finiteNumber(dayStartEquity)
    && finiteNumber(realizedPnlAccount)
    && finiteNumber(unrealizedPnlAccount)
    && finiteNumber(input.equity);

  return {
    schemaVersion: DAILY_RISK_SCHEMA,
    tradingDayKey,
    timezone: "UTC",
    accountId: input.accountId,
    accountCurrency: input.accountCurrency,
    dayStartEquity,
    dayStartBalance,
    dayStartRecordedAtUtc,
    currentEquity: finiteNumber(input.equity) ? input.equity : null,
    currentBalance: finiteNumber(input.balance) ? input.balance : null,
    currentUsableMargin: finiteNumber(input.usableMargin) ? input.usableMargin : null,
    realizedPnlAccount,
    unrealizedPnlAccount,
    dailyDrawdownFraction,
    dailyLossAccount,
    depositsAccount,
    withdrawalsAccount,
    accountsFetchedAtUtc: input.accountsFetchedAtUtc,
    closedTradesFetchedAtUtc: input.closedTradesFetchedAtUtc,
    openTradesFetchedAtUtc: input.openTradesFetchedAtUtc,
    authoritative,
    blockers,
    updatedAtUtc,
  };
}
