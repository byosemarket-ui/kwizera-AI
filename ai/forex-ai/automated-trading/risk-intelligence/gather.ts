/**
 * Stage 2 — Gather / validate live read-only FXCM risk telemetry.
 * Fail-closed: never invent zero exposure, zero daily loss, or zero drawdown.
 * Never mutates broker state.
 */
import type { ForexConnectAccountRow, ForexConnectAccountsResult } from "../../../market-data/forexconnect/types.js";
import {
  countOpenPositionsFromTradesPayload,
  sumOpenExposureLotsFromTradesPayload,
} from "../demo-execution/open-market-risk.js";
import {
  computeDailyRiskSnapshot,
  tradingDayKeyUtc,
} from "../auto-engine/daily-risk/compute.js";
import type { DailyRiskSnapshot } from "../auto-engine/daily-risk/types.js";
import type {
  RiskFieldMeta,
  RiskFieldStatus,
  RiskIntelligenceDaily,
  RiskIntelligenceExposure,
  RiskIntelligencePosition,
  RiskIntelligenceSnapshot,
  RiskIntelligenceSpread,
} from "./types.js";
import {
  RISK_INTELLIGENCE_SCHEMA,
  RISK_INTELLIGENCE_STAGE,
} from "./types.js";

const DEFAULT_ACCOUNT_MAX_AGE_MS = 15_000;
const DEFAULT_QUOTE_MAX_AGE_MS = 5_000;

function meta(status: RiskFieldStatus, reason: string | null = null): RiskFieldMeta {
  return { status, reason };
}

function finiteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function finitePositive(n: unknown): n is number {
  return finiteNumber(n) && n > 0;
}

function parseMs(iso: string | null | undefined): number | null {
  if (iso == null || !String(iso).trim()) return null;
  const ms = Date.parse(String(iso));
  return Number.isFinite(ms) ? ms : null;
}

function normalizeInstrument(symbol: string | null | undefined): string | null {
  const s = String(symbol ?? "").replace(/\s+/g, "").toUpperCase();
  return s || null;
}

function maskAccountId(id: string | null | undefined): string | null {
  const raw = String(id ?? "").trim();
  if (!raw) return null;
  if (raw.length <= 4) return `****${raw}`;
  return `****${raw.slice(-4)}`;
}

function resolveDirection(row: Record<string, unknown>): "BUY" | "SELL" | null {
  const raw = String(row.buySell ?? row.BuySell ?? row.side ?? row.Side ?? row.direction ?? "").toUpperCase();
  if (raw === "B" || raw === "BUY" || raw === "LONG") return "BUY";
  if (raw === "S" || raw === "SELL" || raw === "SHORT") return "SELL";
  const amount = Number(row.amount ?? row.Amount);
  if (Number.isFinite(amount) && amount > 0) return "BUY";
  if (Number.isFinite(amount) && amount < 0) return "SELL";
  return null;
}

export function readConfiguredMaxSpreadAbsolute(
  override?: number | null,
): { value: number | null; source: "request" | "env" | null; reason: string | null } {
  if (override === null) {
    return { value: null, source: null, reason: "Request explicitly cleared maxSpreadAbsolute." };
  }
  if (typeof override === "number" && Number.isFinite(override) && override > 0) {
    return { value: override, source: "request", reason: null };
  }
  const envRaw = String(process.env.KWIZERA_AT_MAX_SPREAD_ABSOLUTE ?? "").trim();
  if (!envRaw) {
    return {
      value: null,
      source: null,
      reason:
        "SPREAD_LIMIT_NOT_CONFIGURED — set KWIZERA_AT_MAX_SPREAD_ABSOLUTE (instrument-absolute price units) "
        + "or pass maxSpreadAbsolute on precheck; no invented market-based limit.",
    };
  }
  const n = Number(envRaw);
  if (!Number.isFinite(n) || !(n > 0)) {
    return {
      value: null,
      source: null,
      reason: "KWIZERA_AT_MAX_SPREAD_ABSOLUTE is set but not a finite positive number.",
    };
  }
  return { value: n, source: "env", reason: null };
}

export interface RiskIntelligenceGatherInput {
  environment: string;
  instrument: string | null;
  expectedAccountId?: string | null;
  expectedAccountIdMasked?: string | null;
  accounts: ForexConnectAccountsResult | null;
  trades: Record<string, unknown> | null;
  closedTrades: Record<string, unknown> | null;
  brokerConnected: boolean;
  forexConnectAvailable: boolean;
  baseUnitSize: number | null;
  contractVerified: boolean;
  bid: number | null;
  ask: number | null;
  quoteAgeMs: number | null;
  maxSpreadAbsolute?: number | null;
  priorDaily: DailyRiskSnapshot | null;
  nowMs?: number;
  accountMaxAgeMs?: number;
  quoteMaxAgeMs?: number;
}

function validateAccount(
  input: RiskIntelligenceGatherInput,
  nowMs: number,
  accountMaxAgeMs: number,
): RiskIntelligenceSnapshot["account"] {
  const unavailable = (
    status: RiskFieldStatus,
    reason: string,
    partial: Partial<RiskIntelligenceSnapshot["account"]> = {},
  ): RiskIntelligenceSnapshot["account"] => ({
    accountId: null,
    accountIdMasked: null,
    environment: null,
    accountCurrency: null,
    balance: null,
    equity: null,
    usedMargin: null,
    usableMargin: null,
    dayPl: null,
    grossPl: null,
    fetchedAtUtc: null,
    fetchedAtMs: null,
    isFresh: null,
    missingFields: [],
    meta: meta(status, reason),
    ...partial,
  });

  if (!input.forexConnectAvailable) {
    return unavailable("UNAVAILABLE", "ForexConnect bridge/sidecar unavailable.");
  }
  if (!input.brokerConnected) {
    return unavailable("UNAVAILABLE", "ForexConnect status is not CONNECTED.");
  }
  const accounts = input.accounts;
  if (!accounts || accounts.ok !== true) {
    return unavailable(
      "UNAVAILABLE",
      `Accounts fetch failed${accounts?.error?.code ? ` (${accounts.error.code})` : ""}.`,
      { fetchedAtUtc: accounts?.fetchedAt ?? null, fetchedAtMs: parseMs(accounts?.fetchedAt) },
    );
  }
  if (!Array.isArray(accounts.accounts)) {
    return unavailable("INVALID", "Accounts response missing accounts array.");
  }
  if (accounts.accounts.length === 0) {
    return unavailable(
      "UNAVAILABLE",
      "Accounts snapshot empty — not treated as zero equity/exposure.",
      { fetchedAtUtc: accounts.fetchedAt ?? null, fetchedAtMs: parseMs(accounts.fetchedAt) },
    );
  }
  if (accounts.accounts.length > 1) {
    return unavailable(
      "INVALID",
      `Multiple accounts (${accounts.accounts.length}) in snapshot — refusing to combine.`,
    );
  }

  const row: ForexConnectAccountRow = accounts.accounts[0];
  const accountId = row.accountId != null ? String(row.accountId) : null;
  const accountIdMasked = row.accountIdMasked ?? maskAccountId(accountId);
  const env = row.environment != null ? String(row.environment).toLowerCase() : null;
  const wantEnv = String(input.environment || "").toLowerCase();
  if (env && wantEnv && env !== wantEnv && !(wantEnv === "demo" && env === "demo") && !(wantEnv === "live" && env === "live")) {
    // Allow common aliases
    const envOk =
      (wantEnv.includes("demo") && env.includes("demo"))
      || (wantEnv.includes("live") && env.includes("live"))
      || env === wantEnv;
    if (!envOk) {
      return unavailable("INVALID", `Account environment ${env} does not match selected ${wantEnv}.`, {
        accountId,
        accountIdMasked,
        environment: env,
      });
    }
  }

  if (input.expectedAccountId && accountId && String(input.expectedAccountId) !== accountId) {
    return unavailable("INVALID", "Account identity does not match expected account id.", {
      accountId,
      accountIdMasked,
      environment: env,
    });
  }
  if (
    input.expectedAccountIdMasked
    && accountIdMasked
    && String(input.expectedAccountIdMasked) !== accountIdMasked
  ) {
    return unavailable("INVALID", "Account masked id does not match expected identity.", {
      accountId,
      accountIdMasked,
      environment: env,
    });
  }

  const missing = Array.isArray(row.missingFields) ? [...row.missingFields] : [];
  const balance = finiteNumber(row.balance) ? row.balance : null;
  const equity = finiteNumber(row.equity) ? row.equity : null;
  const usedMargin = finiteNumber(row.usedMargin) ? row.usedMargin : null;
  const usableMargin = finiteNumber(row.usableMargin) ? row.usableMargin : null;
  const dayPl = finiteNumber(row.dayPl) ? row.dayPl! : null;
  const grossPl = finiteNumber(row.grossPl) ? row.grossPl! : null;
  const currency = row.accountCurrency != null ? String(row.accountCurrency) : null;

  if (balance == null) missing.push("balance");
  if (equity == null) missing.push("equity");
  if (usableMargin == null) missing.push("usableMargin");
  if (!currency || currency.trim().length !== 3) missing.push("accountCurrency");

  const fetchedAtUtc = accounts.fetchedAt ?? null;
  const fetchedAtMs = parseMs(fetchedAtUtc);
  let isFresh: boolean | null = null;
  let status: RiskFieldStatus = "VERIFIED";
  let reason: string | null = null;

  if (fetchedAtMs == null) {
    status = "INVALID";
    reason = "Accounts fetchedAt missing — cannot attest freshness.";
    isFresh = false;
  } else if (fetchedAtMs > nowMs + 5_000) {
    status = "INVALID";
    reason = "Accounts fetchedAt is in the future.";
    isFresh = false;
  } else if (nowMs - fetchedAtMs > accountMaxAgeMs) {
    status = "STALE";
    reason = `Account age ${nowMs - fetchedAtMs}ms exceeds ${accountMaxAgeMs}ms.`;
    isFresh = false;
  } else {
    isFresh = true;
  }

  if (status === "VERIFIED") {
    if (balance == null || equity == null || usableMargin == null) {
      status = "INVALID";
      reason = `Required account fields missing: ${missing.join(", ") || "unknown"}.`;
    } else if (!(equity > 0) || balance < 0 || usableMargin < 0) {
      status = "INVALID";
      reason = "Account numeric fields failed positivity/non-negativity validation.";
    } else if (usedMargin != null && usedMargin < 0) {
      status = "INVALID";
      reason = "usedMargin is negative.";
    }
  }

  // Never coerce missing dayPl/grossPl to zero — leave null.
  return {
    accountId,
    accountIdMasked,
    environment: env,
    accountCurrency: currency,
    balance,
    equity,
    usedMargin,
    usableMargin,
    dayPl,
    grossPl,
    fetchedAtUtc,
    fetchedAtMs,
    isFresh,
    missingFields: [...new Set(missing)],
    meta: meta(status, reason),
  };
}

function mapPositions(
  tradesPayload: Record<string, unknown> | null,
  baseUnitSize: number | null,
): { positions: RiskIntelligencePosition[]; incomplete: boolean; fetchOk: boolean } {
  if (!tradesPayload || tradesPayload.ok === false) {
    return { positions: [], incomplete: true, fetchOk: false };
  }
  const trades = tradesPayload.trades;
  if (!Array.isArray(trades)) {
    return { positions: [], incomplete: true, fetchOk: false };
  }
  const positions: RiskIntelligencePosition[] = [];
  let incomplete = false;
  for (const row of trades) {
    if (!row || typeof row !== "object") {
      incomplete = true;
      break;
    }
    const r = row as Record<string, unknown>;
    const instrument = normalizeInstrument(String(r.instrument ?? r.symbol ?? r.Instrument ?? ""));
    const direction = resolveDirection(r);
    let lots: number | null = null;
    if (r.lots != null || r.Lots != null) {
      const l = Number(r.lots ?? r.Lots);
      lots = Number.isFinite(l) && l >= 0 ? Math.abs(l) : null;
      if (lots == null) incomplete = true;
    } else {
      const amount = Number(r.amount ?? r.Amount);
      if (!Number.isFinite(amount)) {
        incomplete = true;
      } else if (finitePositive(baseUnitSize) && Number.isInteger(baseUnitSize) && Math.abs(amount) % baseUnitSize === 0) {
        lots = Math.abs(amount) / baseUnitSize;
      } else {
        incomplete = true;
      }
    }
    const openPrice = Number(r.openRate ?? r.OpenRate ?? r.openPrice ?? r.entryPrice);
    const markPrice = Number(r.close ?? r.Close ?? r.currentPrice ?? r.markPrice);
    const upl = Number(r.grossPL ?? r.GrossPL ?? r.pl ?? r.PL ?? r.floatingPl);
    positions.push({
      tradeId: r.tradeId != null || r.TradeID != null ? String(r.tradeId ?? r.TradeID) : null,
      instrument,
      direction,
      lots,
      amount: Number.isFinite(Number(r.amount ?? r.Amount)) ? Math.abs(Number(r.amount ?? r.Amount)) : null,
      openPrice: Number.isFinite(openPrice) ? openPrice : null,
      markPrice: Number.isFinite(markPrice) ? markPrice : null,
      unrealizedPnl: Number.isFinite(upl) ? upl : null,
    });
  }
  return { positions, incomplete, fetchOk: true };
}

function buildExposure(
  input: RiskIntelligenceGatherInput,
): RiskIntelligenceExposure {
  const want = normalizeInstrument(input.instrument);
  const bus = input.baseUnitSize;
  const contractVerified = input.contractVerified === true;
  const trades = input.trades;

  const mapped = mapPositions(trades, bus);
  if (!input.forexConnectAvailable || !input.brokerConnected) {
    return {
      openPositionCountAccount: null,
      openPositionCountInstrument: null,
      openExposureLotsAccount: null,
      openExposureLotsInstrument: null,
      openExposureLots: null,
      openPositionCount: null,
      exposureAuthoritative: false,
      duplicateTradeSuspected: null,
      positions: [],
      baseUnitSize: bus,
      contractVerified,
      meta: meta("UNAVAILABLE", "ForexConnect unavailable — exposure unverified."),
    };
  }
  if (!trades || trades.ok === false || !Array.isArray(trades.trades)) {
    return {
      openPositionCountAccount: null,
      openPositionCountInstrument: null,
      openExposureLotsAccount: null,
      openExposureLotsInstrument: null,
      openExposureLots: null,
      openPositionCount: null,
      exposureAuthoritative: false,
      duplicateTradeSuspected: null,
      positions: [],
      baseUnitSize: bus,
      contractVerified,
      meta: meta(
        "UNAVAILABLE",
        "Open trades snapshot incomplete or ForexConnect /trades unavailable — not treated as zero exposure.",
      ),
    };
  }
  if (!contractVerified || !finitePositive(bus) || !Number.isInteger(bus)) {
    return {
      openPositionCountAccount: countOpenPositionsFromTradesPayload(trades, { scope: "account" }),
      openPositionCountInstrument: want
        ? countOpenPositionsFromTradesPayload(trades, { instrument: want, scope: "instrument" })
        : null,
      openExposureLotsAccount: null,
      openExposureLotsInstrument: null,
      openExposureLots: null,
      openPositionCount: want
        ? countOpenPositionsFromTradesPayload(trades, { instrument: want, scope: "instrument" })
        : countOpenPositionsFromTradesPayload(trades, { scope: "account" }),
      exposureAuthoritative: false,
      duplicateTradeSuspected: null,
      positions: mapped.positions,
      baseUnitSize: bus,
      contractVerified,
      meta: meta(
        "UNAVAILABLE",
        "Contract size missing/unverified — exposure lots unverified (fail closed).",
      ),
    };
  }
  if (mapped.incomplete) {
    return {
      openPositionCountAccount: null,
      openPositionCountInstrument: null,
      openExposureLotsAccount: null,
      openExposureLotsInstrument: null,
      openExposureLots: null,
      openPositionCount: null,
      exposureAuthoritative: false,
      duplicateTradeSuspected: null,
      positions: mapped.positions,
      baseUnitSize: bus,
      contractVerified,
      meta: meta("INVALID", "One or more open trades missing quantity/contract conversion fields."),
    };
  }

  const openExposureLotsAccount = sumOpenExposureLotsFromTradesPayload(trades, {
    baseUnitSize: bus,
    scope: "account",
  });
  const openExposureLotsInstrument = want
    ? sumOpenExposureLotsFromTradesPayload(trades, {
      instrument: want,
      baseUnitSize: bus,
      scope: "instrument",
    })
    : null;
  const openPositionCountAccount = countOpenPositionsFromTradesPayload(trades, { scope: "account" });
  const openPositionCountInstrument = want
    ? countOpenPositionsFromTradesPayload(trades, { instrument: want, scope: "instrument" })
    : null;

  const openExposureLots = want != null ? openExposureLotsInstrument : openExposureLotsAccount;
  const openPositionCount = want != null ? openPositionCountInstrument : openPositionCountAccount;

  if (openExposureLots == null || openPositionCount == null) {
    return {
      openPositionCountAccount,
      openPositionCountInstrument,
      openExposureLotsAccount,
      openExposureLotsInstrument,
      openExposureLots: null,
      openPositionCount: null,
      exposureAuthoritative: false,
      duplicateTradeSuspected: null,
      positions: mapped.positions,
      baseUnitSize: bus,
      contractVerified,
      meta: meta("INVALID", "Exposure calculation failed for trades payload."),
    };
  }

  // Duplicate/conflict: any existing open trade on the proposed instrument.
  const duplicateTradeSuspected = want != null
    ? openPositionCountInstrument != null && openPositionCountInstrument >= 1
    : openPositionCountAccount != null && openPositionCountAccount >= 1
      ? true
      : false;

  return {
    openPositionCountAccount,
    openPositionCountInstrument,
    openExposureLotsAccount,
    openExposureLotsInstrument,
    openExposureLots,
    openPositionCount,
    exposureAuthoritative: true,
    duplicateTradeSuspected,
    positions: mapped.positions,
    baseUnitSize: bus,
    contractVerified,
    meta: meta(
      "VERIFIED",
      trades.trades.length === 0
        ? "Complete empty open-trades snapshot — zero open exposure verified."
        : null,
    ),
  };
}

function sumOpenUnrealized(trades: Record<string, unknown> | null): {
  value: number | null;
  ok: boolean;
} {
  if (!trades || trades.ok !== true || !Array.isArray(trades.trades)) {
    return { value: null, ok: false };
  }
  if (trades.trades.length === 0) return { value: 0, ok: true };
  let sum = 0;
  for (const row of trades.trades) {
    if (!row || typeof row !== "object") return { value: null, ok: false };
    const r = row as Record<string, unknown>;
    const upl = Number(r.grossPL ?? r.GrossPL ?? r.pl ?? r.PL ?? r.floatingPl);
    if (!Number.isFinite(upl)) return { value: null, ok: false };
    sum += upl;
  }
  return { value: sum, ok: true };
}

function mapClosedTrades(closed: Record<string, unknown> | null): {
  rows: Array<{
    tradeId: string | null;
    closeTimeUtc: string | null;
    realizedPnl: number | null;
  }> | null;
  fetchOk: boolean;
  fetchedAtUtc: string | null;
  duplicateIds: boolean;
} {
  if (!closed || closed.ok !== true) {
    return { rows: null, fetchOk: false, fetchedAtUtc: null, duplicateIds: false };
  }
  if (!Array.isArray(closed.closedTrades)) {
    return {
      rows: null,
      fetchOk: false,
      fetchedAtUtc: typeof closed.fetchedAt === "string" ? closed.fetchedAt : null,
      duplicateIds: false,
    };
  }
  const seen = new Set<string>();
  let duplicateIds = false;
  const rows = closed.closedTrades.map((r) => {
    const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
    const tradeId = row.tradeId != null || row.TradeID != null
      ? String(row.tradeId ?? row.TradeID)
      : null;
    if (tradeId) {
      if (seen.has(tradeId)) duplicateIds = true;
      seen.add(tradeId);
    }
    return {
      tradeId,
      closeTimeUtc: row.closeTime == null && row.CloseTime == null
        ? null
        : String(row.closeTime ?? row.CloseTime),
      realizedPnl: Number.isFinite(Number(row.grossPL ?? row.GrossPL ?? row.pl ?? row.PL))
        ? Number(row.grossPL ?? row.GrossPL ?? row.pl ?? row.PL)
        : null,
    };
  });
  return {
    rows,
    fetchOk: true,
    fetchedAtUtc: typeof closed.fetchedAt === "string" ? closed.fetchedAt : null,
    duplicateIds,
  };
}

function buildDaily(
  input: RiskIntelligenceGatherInput,
  account: RiskIntelligenceSnapshot["account"],
  nowMs: number,
  accountMaxAgeMs: number,
): { daily: RiskIntelligenceDaily; computed: DailyRiskSnapshot | null } {
  const tradingDayKey = tradingDayKeyUtc(nowMs);
  const closed = mapClosedTrades(input.closedTrades);
  const unrealized = sumOpenUnrealized(input.trades);

  // Prefer broker Accounts.dayPl when present (never invent 0 when absent).
  let dayRealizedPnlAccount: number | null = null;
  let dayRealizedSource: RiskIntelligenceDaily["dayRealizedSource"] = null;
  const dailyBlockers: string[] = [];

  if (account.dayPl != null && finiteNumber(account.dayPl)) {
    dayRealizedPnlAccount = account.dayPl;
    dayRealizedSource = "accounts.dayPl";
  }

  if (closed.duplicateIds) {
    dailyBlockers.push("DUPLICATE_CLOSED_TRADE_IDS");
  }

  let computed: DailyRiskSnapshot | null = null;
  if (account.meta.status === "VERIFIED" || account.meta.status === "STALE") {
    computed = computeDailyRiskSnapshot({
      nowMs,
      accountId: account.accountId,
      accountCurrency: account.accountCurrency,
      equity: account.equity,
      balance: account.balance,
      usableMargin: account.usableMargin,
      accountsFetchedAtUtc: account.fetchedAtUtc,
      prior: input.priorDaily,
      dayClosedTrades: closed.rows,
      closedTradesFetchOk: closed.fetchOk && !closed.duplicateIds,
      closedTradesFetchedAtUtc: closed.fetchedAtUtc,
      openUnrealizedPnl: unrealized.ok ? unrealized.value : null,
      openTradesFetchOk: unrealized.ok,
      openTradesFetchedAtUtc:
        input.trades && typeof input.trades.fetchedAt === "string"
          ? input.trades.fetchedAt
          : null,
      accountMaxAgeMs,
    });
    dailyBlockers.push(...computed.blockers);
  } else {
    dailyBlockers.push("ACCOUNT_SNAPSHOT_NOT_VERIFIED");
  }

  if (dayRealizedPnlAccount == null && computed && finiteNumber(computed.realizedPnlAccount)) {
    // Only accept closed-trade sum when compute did not mark closed-trade blockers.
    const closedBlocked = computed.blockers.some((b) =>
      b === "CLOSED_TRADES_UNAVAILABLE"
      || b === "CLOSED_TRADE_TIME_MISSING"
      || b === "CLOSED_TRADE_PNL_MISSING"
    );
    if (!closedBlocked) {
      dayRealizedPnlAccount = computed.realizedPnlAccount;
      dayRealizedSource = "closed_trades_sum";
    }
  }

  if (dayRealizedPnlAccount == null) {
    dailyBlockers.push("DAY_REALIZED_PNL_UNAVAILABLE");
  }

  const dayStartEquity = computed && finitePositive(computed.dayStartEquity)
    ? computed.dayStartEquity
    : null;
  const dayStartBalance = computed && finiteNumber(computed.dayStartBalance)
    ? computed.dayStartBalance
    : null;

  let dailyMeta: RiskFieldMeta;
  if (dayRealizedPnlAccount != null && finiteNumber(dayRealizedPnlAccount)) {
    dailyMeta = meta("VERIFIED", `Source=${dayRealizedSource}; timezone=UTC trading day ${tradingDayKey}.`);
  } else if (!closed.fetchOk && account.dayPl == null) {
    dailyMeta = meta(
      "UNAVAILABLE",
      "Neither Accounts.dayPl nor usable closed-trades history available — daily loss remains blocked.",
    );
  } else if (closed.duplicateIds) {
    dailyMeta = meta("INVALID", "Duplicate closed-trade ids — refusing fabricated daily PnL.");
  } else {
    dailyMeta = meta(
      "UNAVAILABLE",
      `Daily realized PnL unavailable (${dailyBlockers.join(", ") || "unknown"}).`,
    );
  }

  let drawdownMeta: RiskFieldMeta;
  if (dayStartEquity == null) {
    drawdownMeta = meta(
      "UNAVAILABLE",
      "Day-start equity unavailable — drawdown remains blocked (UTC trading-day boundary).",
    );
  } else if (account.equity == null || !finitePositive(account.equity)) {
    drawdownMeta = meta("UNAVAILABLE", "Current equity unavailable for drawdown.");
  } else if (account.meta.status === "STALE") {
    drawdownMeta = meta("STALE", "Account snapshot stale — drawdown not attested.");
  } else {
    drawdownMeta = meta("VERIFIED", "Drawdown uses equity vs UTC trading-day start equity.");
  }

  const authoritative = Boolean(
    computed?.authoritative
    && dayRealizedPnlAccount != null
    && dayStartEquity != null
    && account.meta.status === "VERIFIED",
  );

  return {
    computed,
    daily: {
      tradingDayKey,
      timezone: "UTC",
      dayRealizedPnlAccount,
      dayRealizedSource,
      unrealizedPnlAccount: unrealized.ok ? unrealized.value : null,
      dayStartEquity,
      dayStartBalance,
      dayStartRecordedAtUtc: computed?.dayStartRecordedAtUtc ?? null,
      dailyDrawdownFraction: computed?.dailyDrawdownFraction ?? null,
      dailyLossAccount: computed?.dailyLossAccount ?? null,
      authoritative,
      blockers: [...new Set(dailyBlockers)],
      meta: dailyMeta,
      drawdownMeta,
    },
  };
}

function buildSpread(
  input: RiskIntelligenceGatherInput,
  nowMs: number,
  quoteMaxAgeMs: number,
): RiskIntelligenceSpread {
  const instrument = normalizeInstrument(input.instrument);
  const limit = readConfiguredMaxSpreadAbsolute(input.maxSpreadAbsolute);
  const limitMeta = limit.value == null
    ? meta("NOT_CONFIGURED", limit.reason)
    : meta("VERIFIED", `Limit from ${limit.source}.`);

  const bid = input.bid;
  const ask = input.ask;
  const quoteAgeMs = input.quoteAgeMs;

  if (bid == null || ask == null) {
    return {
      instrument,
      bid: bid ?? null,
      ask: ask ?? null,
      spread: null,
      quoteAgeMs: quoteAgeMs ?? null,
      maxSpreadAbsolute: limit.value,
      meta: meta("UNAVAILABLE", "Bid/ask missing — spread unverified."),
      limitMeta,
    };
  }
  if (!finitePositive(bid) || !finitePositive(ask)) {
    return {
      instrument,
      bid,
      ask,
      spread: null,
      quoteAgeMs: quoteAgeMs ?? null,
      maxSpreadAbsolute: limit.value,
      meta: meta("INVALID", "Bid/ask must be finite and positive."),
      limitMeta,
    };
  }
  if (ask < bid) {
    return {
      instrument,
      bid,
      ask,
      spread: null,
      quoteAgeMs: quoteAgeMs ?? null,
      maxSpreadAbsolute: limit.value,
      meta: meta("INVALID", "Crossed market: ask < bid."),
      limitMeta,
    };
  }
  if (quoteAgeMs == null || !Number.isFinite(quoteAgeMs)) {
    return {
      instrument,
      bid,
      ask,
      spread: ask - bid,
      quoteAgeMs: null,
      maxSpreadAbsolute: limit.value,
      meta: meta("UNAVAILABLE", "Quote age unknown — freshness not attested."),
      limitMeta,
    };
  }
  if (quoteAgeMs < 0) {
    return {
      instrument,
      bid,
      ask,
      spread: ask - bid,
      quoteAgeMs,
      maxSpreadAbsolute: limit.value,
      meta: meta("INVALID", "Negative quote age."),
      limitMeta,
    };
  }
  if (quoteAgeMs > quoteMaxAgeMs) {
    return {
      instrument,
      bid,
      ask,
      spread: ask - bid,
      quoteAgeMs,
      maxSpreadAbsolute: limit.value,
      meta: meta("STALE", `Quote age ${quoteAgeMs}ms exceeds ${quoteMaxAgeMs}ms.`),
      limitMeta,
    };
  }

  void nowMs;
  return {
    instrument,
    bid,
    ask,
    spread: ask - bid,
    quoteAgeMs,
    maxSpreadAbsolute: limit.value,
    meta: meta("VERIFIED", null),
    limitMeta,
  };
}

/**
 * Pure builder: validate RO payloads into a Stage 2 risk intelligence snapshot.
 */
export function buildRiskIntelligenceSnapshot(
  input: RiskIntelligenceGatherInput,
): { snapshot: RiskIntelligenceSnapshot; dailyComputed: DailyRiskSnapshot | null } {
  const nowMs = input.nowMs ?? Date.now();
  const accountMaxAgeMs = input.accountMaxAgeMs ?? DEFAULT_ACCOUNT_MAX_AGE_MS;
  const quoteMaxAgeMs = input.quoteMaxAgeMs ?? DEFAULT_QUOTE_MAX_AGE_MS;

  const account = validateAccount(input, nowMs, accountMaxAgeMs);
  const exposure = buildExposure(input);
  const { daily, computed } = buildDaily(input, account, nowMs, accountMaxAgeMs);
  const spread = buildSpread(input, nowMs, quoteMaxAgeMs);

  const precheckAccount = account.meta.status === "VERIFIED" || account.meta.status === "STALE"
    ? {
      equity: account.equity,
      balance: account.balance,
      usableMargin: account.usableMargin,
      usedMargin: account.usedMargin,
      currency: account.accountCurrency,
      accountIdMasked: account.accountIdMasked,
      fetchedAtMs: account.fetchedAtMs,
      isFresh: account.isFresh,
    }
    : null;

  // Day-start equity only feeds precheck when drawdown meta is verified (or at least present+fresh account).
  const dayStartForPrecheck =
    daily.drawdownMeta.status === "VERIFIED" ? daily.dayStartEquity : null;
  const dayPnlForPrecheck =
    daily.meta.status === "VERIFIED" ? daily.dayRealizedPnlAccount : null;

  const snapshot: RiskIntelligenceSnapshot = {
    schemaVersion: RISK_INTELLIGENCE_SCHEMA,
    stage: RISK_INTELLIGENCE_STAGE,
    computedAtUtc: new Date(nowMs).toISOString(),
    environment: input.environment,
    instrument: normalizeInstrument(input.instrument),
    brokerConnected: input.brokerConnected,
    forexConnectAvailable: input.forexConnectAvailable,
    account,
    exposure,
    daily,
    spread,
    precheckAccount,
    precheckExposure: {
      openExposureLots: exposure.openExposureLots,
      openPositionCount: exposure.openPositionCount,
      exposureAuthoritative: exposure.exposureAuthoritative,
      duplicateTradeSuspected: exposure.duplicateTradeSuspected,
      dayRealizedPnlAccount: dayPnlForPrecheck,
      dayStartEquity: dayStartForPrecheck,
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "Stage 2 live read-only risk intelligence. Does not place, modify, cancel, or close broker orders. "
      + "Missing/stale fields remain fail-closed for Phase 2 precheck.",
  };

  return { snapshot, dailyComputed: computed };
}

export function logRiskIntelligenceEvents(snapshot: RiskIntelligenceSnapshot): void {
  const base = {
    stage: RISK_INTELLIGENCE_STAGE,
    schema: RISK_INTELLIGENCE_SCHEMA,
    env: snapshot.environment,
    instrument: snapshot.instrument,
    placesOrders: false,
    mutatesBroker: false,
  };
  console.info("[risk-intelligence] snapshot", {
    ...base,
    accountStatus: snapshot.account.meta.status,
    exposureStatus: snapshot.exposure.meta.status,
    exposureAuthoritative: snapshot.exposure.exposureAuthoritative,
    dailyStatus: snapshot.daily.meta.status,
    drawdownStatus: snapshot.daily.drawdownMeta.status,
    spreadStatus: snapshot.spread.meta.status,
    spreadLimitStatus: snapshot.spread.limitMeta.status,
    openExposureLots: snapshot.exposure.openExposureLots,
    openPositionCount: snapshot.exposure.openPositionCount,
    dayRealizedSource: snapshot.daily.dayRealizedSource,
  });
  if (snapshot.account.meta.status !== "VERIFIED") {
    console.warn("[risk-intelligence] account_validation", {
      ...base,
      status: snapshot.account.meta.status,
      reason: snapshot.account.meta.reason,
      missingFields: snapshot.account.missingFields,
    });
  }
  if (!snapshot.exposure.exposureAuthoritative) {
    console.warn("[risk-intelligence] exposure_unverified", {
      ...base,
      status: snapshot.exposure.meta.status,
      reason: snapshot.exposure.meta.reason,
    });
  }
  if (snapshot.daily.meta.status !== "VERIFIED") {
    console.warn("[risk-intelligence] daily_pnl_unavailable", {
      ...base,
      status: snapshot.daily.meta.status,
      reason: snapshot.daily.meta.reason,
      blockers: snapshot.daily.blockers,
    });
  }
  if (snapshot.spread.meta.status !== "VERIFIED" || snapshot.spread.limitMeta.status === "NOT_CONFIGURED") {
    console.warn("[risk-intelligence] spread_blocked", {
      ...base,
      spreadStatus: snapshot.spread.meta.status,
      spreadReason: snapshot.spread.meta.reason,
      limitStatus: snapshot.spread.limitMeta.status,
      limitReason: snapshot.spread.limitMeta.reason,
    });
  }
}
