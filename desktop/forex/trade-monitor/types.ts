/**
 * Phase 60.0.1 / 60.0.2 / 60.0.3 — Trade Monitor typed RO shapes.
 * Broker-confirmed rows only. Never invent floating/realized P/L.
 */

export type TradeMonitorLoadState =
  | "idle"
  | "loading"
  | "ready"
  | "empty"
  | "auth_required"
  | "forbidden"
  | "disconnected"
  | "error";

export interface TradeMonitorAccountRow {
  accountIdMasked: string | null;
  accountCurrency: string | null;
  equity: number | null;
  balance: number | null;
  usedMargin: number | null;
  usableMargin: number | null;
  dayPl: number | null;
  grossPl: number | null;
  equityIncludesFloatingPl: boolean;
  missingFields?: string[] | null;
}

export interface TradeMonitorPositionRow {
  tradeId: string | null;
  accountIdMasked: string | null;
  instrument: string | null;
  side: string | null;
  amount: number | null;
  openRate: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  currentPrice: number | null;
  currentPriceSource: string | null;
  markPrice: number | null;
  markPriceSide: "bid" | "ask" | null;
  markPriceSource: string | null;
  markQuoteFreshness: string | null;
  markQuoteAgeMs: number | null;
  floatingPl: number | null;
  floatingPlSource: string | null;
  floatingPlProvenance: string | null;
  commission: number | null;
  rolloverInterest: number | null;
  openTime: string | null;
  updatedAt: string | null;
  status: string;
  plBasis: "gross" | null;
  source: "forexconnect-trades";
}

export interface TradeMonitorOrderRow {
  orderId: string | null;
  instrument: string | null;
  side: string | null;
  amount: number | null;
  rate: number | null;
  status: string | null;
  source: "forexconnect-orders";
}

export interface TradeMonitorClosedTradeRow {
  tradeId: string | null;
  accountIdMasked: string | null;
  instrument: string | null;
  side: string | null;
  amount: number | null;
  openRate: number | null;
  closeRate: number | null;
  openTime: string | null;
  closeTime: string | null;
  grossPl: number | null;
  commission: number | null;
  rolloverInterest: number | null;
  netPl: number | null;
  plBasis: "gross" | null;
  historyScope: "CURRENT_TRADING_DAY";
  source: "forexconnect-closed-trades";
}

export interface TradeMonitorSummaryRow {
  instrument: string | null;
  offerId: string | null;
  accountIdMasked: string | null;
  netPl: number | null;
  grossPl: number | null;
  metricScope: "INSTRUMENT_SUMMARY";
  source: "forexconnect-summary";
}

export interface TradeMonitorHistoryRecord {
  recordKey: string;
  tradeId: string;
  accountIdMasked: string | null;
  instrument: string | null;
  side: string | null;
  amount: number | null;
  openRate: number | null;
  closeRate: number | null;
  openTime: string | null;
  closeTime: string | null;
  grossPl: number | null;
  commission: number | null;
  rolloverInterest: number | null;
  netPl: number | null;
  lifecycleStatus: "OPEN" | "CLOSED";
  source: string;
  observedAtUtc: string;
  historyScopeNote: string | null;
}

export interface TradeMonitorHistoryPayload {
  ok: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  historyAvailableFromUtc: string | null;
  coverageNote: string;
  accountScope: string | null;
  total: number;
  limit: number;
  offset: number;
  records: TradeMonitorHistoryRecord[];
}

export interface TradeMonitorConnectionSnapshot {
  sessionStatus: string | null;
  environment: string | null;
  trading: string | null;
  streamState: string | null;
  offersListenerActive: boolean | null;
  subscriptionCount: number | null;
  lastQuoteAt: string | null;
  lastQuoteAgeMs: number | null;
  updateCount: number | null;
  /** Offers table rows cached for subscriptions — not LIVE tick proof. */
  offersSnapshotPresent: boolean | null;
  quoteFreshnessLabel: string;
}

export interface TradeMonitorTablesPayload {
  ok: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  historyAvailableFromUtc?: string | null;
  accounts: {
    ok: boolean;
    capabilityStatus?: string;
    accounts: TradeMonitorAccountRow[];
    fetchedAt?: string | null;
    note?: string;
  };
  openPositions: {
    ok: boolean;
    capabilityStatus?: string;
    code?: string;
    count: number;
    trades: TradeMonitorPositionRow[];
    fetchedAt?: string | null;
    note?: string;
  };
  openWorkingOrders: {
    ok: boolean;
    capabilityStatus?: string;
    code?: string;
    count: number;
    orders: TradeMonitorOrderRow[];
    fetchedAt?: string | null;
    note?: string;
  };
  closedTrades: {
    ok: boolean;
    capabilityStatus: string;
    code?: string;
    count: number;
    closedTrades: TradeMonitorClosedTradeRow[];
    historyScope?: string;
    note?: string;
    fetchedAt?: string | null;
  };
  instrumentSummaries?: {
    ok: boolean;
    capabilityStatus: string;
    count: number;
    summaries: TradeMonitorSummaryRow[];
    metricScope?: string;
    note?: string;
  };
}
