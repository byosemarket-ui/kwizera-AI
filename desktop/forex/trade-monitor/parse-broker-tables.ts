/**
 * Phase 60.0.1 / 60.0.2 / 60.0.3 — normalize broker-ro-tables + trade-history JSON.
 * Fail closed: missing arrays become empty; never invent P/L fields.
 */
import type {
  TradeMonitorAccountRow,
  TradeMonitorClosedTradeRow,
  TradeMonitorHistoryPayload,
  TradeMonitorHistoryRecord,
  TradeMonitorOrderRow,
  TradeMonitorPositionRow,
  TradeMonitorSummaryRow,
  TradeMonitorTablesPayload,
} from "./types";

/** Never coerce null/"" to 0 — Number(null)===0 would invent P/L and sizes. */
function asFinite(n: unknown): number | null {
  if (n == null || n === "") return null;
  if (typeof n === "number") return Number.isFinite(n) ? n : null;
  if (typeof n !== "string") return null;
  const trimmed = n.trim();
  if (!trimmed) return null;
  const v = Number(trimmed);
  return Number.isFinite(v) ? v : null;
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function parseBrokerRoTables(raw: unknown): TradeMonitorTablesPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const accountsBlock = (body.accounts && typeof body.accounts === "object"
    ? body.accounts
    : {}) as Record<string, unknown>;
  const positionsBlock = (body.openPositions && typeof body.openPositions === "object"
    ? body.openPositions
    : {}) as Record<string, unknown>;
  const ordersBlock = (body.openWorkingOrders && typeof body.openWorkingOrders === "object"
    ? body.openWorkingOrders
    : {}) as Record<string, unknown>;
  const closedBlock = (body.closedTrades && typeof body.closedTrades === "object"
    ? body.closedTrades
    : {}) as Record<string, unknown>;
  const summaryBlock = (body.instrumentSummaries && typeof body.instrumentSummaries === "object"
    ? body.instrumentSummaries
    : {}) as Record<string, unknown>;

  const accountRowsRaw = Array.isArray(accountsBlock.accounts) ? accountsBlock.accounts : [];
  const accounts: TradeMonitorAccountRow[] = accountRowsRaw.map((row) => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    return {
      accountIdMasked: asString(r.accountIdMasked),
      accountCurrency: asString(r.accountCurrency),
      equity: asFinite(r.equity),
      balance: asFinite(r.balance),
      usedMargin: asFinite(r.usedMargin),
      usableMargin: asFinite(r.usableMargin),
      dayPl: asFinite(r.dayPl),
      grossPl: asFinite(r.grossPl),
      equityIncludesFloatingPl: r.equityIncludesFloatingPl !== false,
      missingFields: Array.isArray(r.missingFields)
        ? r.missingFields.map((x) => String(x))
        : null,
    };
  });

  const tradeRowsRaw = Array.isArray(positionsBlock.trades)
    ? positionsBlock.trades
    : Array.isArray(positionsBlock.items)
      ? positionsBlock.items
      : [];
  const trades: TradeMonitorPositionRow[] = tradeRowsRaw.map((row) => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const floatingPl = asFinite(r.floatingPl ?? r.grossPl ?? r.grossPL ?? r.pl);
    const markPrice = asFinite(r.markPrice);
    const freshness = asString(r.markQuoteFreshness);
    // Live mark only when freshness says received; else use currentPrice only if BROKER_CLOSE_ONLY.
    let currentPrice: number | null = null;
    let currentPriceSource: string | null = null;
    if (freshness === "QUOTE_RECEIVED" && markPrice != null) {
      currentPrice = markPrice;
      currentPriceSource = asString(r.markPriceSource) ?? asString(r.currentPriceSource);
    } else if (freshness === "BROKER_CLOSE_ONLY") {
      currentPrice = asFinite(r.currentPrice ?? r.brokerClosePrice ?? r.close ?? r.closeRate);
      currentPriceSource = asString(r.currentPriceSource ?? r.brokerClosePriceSource);
    } else if (!freshness) {
      // Legacy payloads without mark enrichment.
      currentPrice = asFinite(r.currentPrice ?? r.close ?? r.closeRate);
      currentPriceSource = asString(r.currentPriceSource);
    }
    const sideRaw = asString(r.markPriceSide);
    const markPriceSide = sideRaw === "bid" || sideRaw === "ask" ? sideRaw : null;
    return {
      tradeId: asString(r.tradeId),
      accountIdMasked: asString(r.accountIdMasked),
      instrument: asString(r.instrument),
      side: asString(r.side),
      amount: asFinite(r.amount),
      openRate: asFinite(r.openRate),
      stopLoss: asFinite(r.stopLoss),
      takeProfit: asFinite(r.takeProfit),
      currentPrice,
      currentPriceSource,
      markPrice,
      markPriceSide,
      markPriceSource: asString(r.markPriceSource),
      markQuoteFreshness: freshness,
      markQuoteAgeMs: asFinite(r.markQuoteAgeMs),
      floatingPl,
      floatingPlSource: asString(r.floatingPlSource)
        ?? (floatingPl != null ? "forexconnect-trades.gross_pl" : null),
      floatingPlProvenance: asString(r.floatingPlProvenance),
      commission: asFinite(r.commission),
      rolloverInterest: asFinite(r.rolloverInterest),
      openTime: asString(r.openTime),
      updatedAt: asString(r.updatedAt ?? r.fetchedAt ?? positionsBlock.fetchedAt),
      status: asString(r.status) ?? "OPEN",
      plBasis: floatingPl != null ? "gross" : null,
      source: "forexconnect-trades",
    };
  });

  const orderRowsRaw = Array.isArray(ordersBlock.orders)
    ? ordersBlock.orders
    : Array.isArray(ordersBlock.items)
      ? ordersBlock.items
      : [];
  const orders: TradeMonitorOrderRow[] = orderRowsRaw.map((row) => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    return {
      orderId: asString(r.orderId),
      instrument: asString(r.instrument),
      side: asString(r.side),
      amount: asFinite(r.amount),
      rate: asFinite(r.rate),
      status: asString(r.status),
      source: "forexconnect-orders",
    };
  });

  const closedRowsRaw = Array.isArray(closedBlock.closedTrades)
    ? closedBlock.closedTrades
    : Array.isArray(closedBlock.trades)
      ? closedBlock.trades
      : Array.isArray(closedBlock.items)
        ? closedBlock.items
        : [];
  const closedTrades: TradeMonitorClosedTradeRow[] = closedRowsRaw.map((row) => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    const grossPl = asFinite(r.grossPl ?? r.grossPL);
    const commission = asFinite(r.commission);
    const rolloverInterest = asFinite(r.rolloverInterest);
    let netPl = asFinite(r.netPl);
    if (
      netPl == null
      && grossPl != null
      && commission != null
      && rolloverInterest != null
    ) {
      netPl = grossPl + commission + rolloverInterest;
    }
    return {
      tradeId: asString(r.tradeId),
      accountIdMasked: asString(r.accountIdMasked),
      instrument: asString(r.instrument),
      side: asString(r.side),
      amount: asFinite(r.amount),
      openRate: asFinite(r.openRate),
      closeRate: asFinite(r.closeRate),
      openTime: asString(r.openTime),
      closeTime: asString(r.closeTime),
      grossPl,
      commission,
      rolloverInterest,
      netPl,
      plBasis: grossPl != null ? "gross" : null,
      historyScope: "CURRENT_TRADING_DAY",
      source: "forexconnect-closed-trades",
    };
  });

  const summaryRowsRaw = Array.isArray(summaryBlock.summaries)
    ? summaryBlock.summaries
    : Array.isArray(summaryBlock.items)
      ? summaryBlock.items
      : [];
  const summaries: TradeMonitorSummaryRow[] = summaryRowsRaw.map((row) => {
    const r = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
    return {
      instrument: asString(r.instrument),
      offerId: asString(r.offerId),
      accountIdMasked: asString(r.accountIdMasked),
      netPl: asFinite(r.netPl),
      grossPl: asFinite(r.grossPl),
      metricScope: "INSTRUMENT_SUMMARY",
      source: "forexconnect-summary",
    };
  });

  return {
    ok: body.ok === true,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    historyAvailableFromUtc: asString(body.historyAvailableFromUtc),
    accounts: {
      ok: accountsBlock.ok === true,
      capabilityStatus: asString(accountsBlock.capabilityStatus) ?? undefined,
      accounts,
      fetchedAt: asString(accountsBlock.fetchedAt),
      note: asString(accountsBlock.note) ?? undefined,
    },
    openPositions: {
      ok: positionsBlock.ok === true,
      capabilityStatus: asString(positionsBlock.capabilityStatus) ?? undefined,
      code: asString(positionsBlock.code) ?? undefined,
      count: typeof positionsBlock.count === "number"
        ? positionsBlock.count
        : trades.length,
      trades,
      fetchedAt: asString(positionsBlock.fetchedAt),
      note: asString(positionsBlock.note) ?? undefined,
    },
    openWorkingOrders: {
      ok: ordersBlock.ok === true,
      capabilityStatus: asString(ordersBlock.capabilityStatus) ?? undefined,
      code: asString(ordersBlock.code) ?? undefined,
      count: typeof ordersBlock.count === "number" ? ordersBlock.count : orders.length,
      orders,
      fetchedAt: asString(ordersBlock.fetchedAt),
      note: asString(ordersBlock.note) ?? undefined,
    },
    closedTrades: {
      ok: closedBlock.ok === true,
      capabilityStatus: asString(closedBlock.capabilityStatus) ?? "MISSING",
      code: asString(closedBlock.code) ?? undefined,
      count: typeof closedBlock.count === "number" ? closedBlock.count : closedTrades.length,
      closedTrades,
      historyScope: asString(closedBlock.historyScope) ?? "CURRENT_TRADING_DAY",
      note: asString(closedBlock.note) ?? undefined,
      fetchedAt: asString(closedBlock.fetchedAt),
    },
    instrumentSummaries: {
      ok: summaryBlock.ok === true,
      capabilityStatus: asString(summaryBlock.capabilityStatus) ?? "MISSING",
      count: typeof summaryBlock.count === "number" ? summaryBlock.count : summaries.length,
      summaries,
      metricScope: asString(summaryBlock.metricScope) ?? "INSTRUMENT_SUMMARY",
      note: asString(summaryBlock.note) ?? undefined,
    },
  };
}

export function parseTradeHistory(raw: unknown): TradeMonitorHistoryPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  if (body.ok !== true) return null;
  const rows = Array.isArray(body.records) ? body.records : [];
  const records: TradeMonitorHistoryRecord[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const tradeId = asString(r.tradeId);
    const recordKey = asString(r.recordKey);
    if (!tradeId || !recordKey) continue;
    const statusRaw = asString(r.lifecycleStatus)?.toUpperCase();
    const lifecycleStatus = statusRaw === "CLOSED" ? "CLOSED" : "OPEN";
    records.push({
      recordKey,
      tradeId,
      accountIdMasked: asString(r.accountIdMasked),
      instrument: asString(r.instrument),
      side: asString(r.side),
      amount: asFinite(r.amount),
      openRate: asFinite(r.openRate),
      closeRate: asFinite(r.closeRate),
      openTime: asString(r.openTime),
      closeTime: asString(r.closeTime),
      grossPl: asFinite(r.grossPl),
      commission: asFinite(r.commission),
      rolloverInterest: asFinite(r.rolloverInterest),
      netPl: asFinite(r.netPl),
      lifecycleStatus,
      source: asString(r.source) ?? "unknown",
      observedAtUtc: asString(r.observedAtUtc) ?? "",
      historyScopeNote: asString(r.historyScopeNote),
    });
  }
  return {
    ok: true,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    historyAvailableFromUtc: asString(body.historyAvailableFromUtc),
    coverageNote: asString(body.coverageNote)
      ?? "Persisted history coverage is limited to local observation start.",
    accountScope: asString(body.accountScope),
    total: typeof body.total === "number" ? body.total : records.length,
    limit: typeof body.limit === "number" ? body.limit : records.length,
    offset: typeof body.offset === "number" ? body.offset : 0,
    records,
  };
}

/** Sum only verified finite floating P/L values; null if none present. */
export function sumVerifiedFloatingPl(
  trades: ReadonlyArray<{ floatingPl: number | null }>,
): number | null {
  let sum = 0;
  let any = false;
  for (const row of trades) {
    if (row.floatingPl == null || !Number.isFinite(row.floatingPl)) continue;
    sum += row.floatingPl;
    any = true;
  }
  return any ? sum : null;
}

/**
 * Day realized P/L from closed-trade gross fields only.
 * Does not invent values; does not use incomplete subsets as "all-time".
 */
export function sumVerifiedClosedGrossPl(
  rows: ReadonlyArray<{ grossPl: number | null }>,
): number | null {
  let sum = 0;
  let any = false;
  for (const row of rows) {
    if (row.grossPl == null || !Number.isFinite(row.grossPl)) continue;
    sum += row.grossPl;
    any = true;
  }
  return any ? sum : null;
}

/** Realized P/L from persisted CLOSED history records only (partial coverage). */
export function sumVerifiedHistoryClosedGrossPl(
  rows: ReadonlyArray<{ lifecycleStatus: string; grossPl: number | null }>,
): number | null {
  return sumVerifiedClosedGrossPl(
    rows.filter((r) => r.lifecycleStatus === "CLOSED"),
  );
}
