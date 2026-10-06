import { BinanceMarketDataError } from "./errors.js";
import type { NormalizedCandle, NormalizedInstrument, NormalizedLiveKline, NormalizedLiveTicker, NormalizedMarket, NormalizedTicker, NormalizedTimeframeId } from "./types.js";

const TIMEFRAME_TO_INTERVAL: Record<NormalizedTimeframeId, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};

export function toBinanceSymbol(displaySymbol: string): string {
  const compact = displaySymbol.replace("/", "").replace("-", "").trim().toUpperCase();
  if (!/^[A-Z0-9]{5,20}$/.test(compact)) {
    throw new BinanceMarketDataError("BINANCE_INVALID_SYMBOL", "Invalid market symbol.");
  }
  return compact;
}

export function toDisplaySymbol(binanceSymbol: string, baseAsset?: string, quoteAsset?: string): string {
  if (baseAsset && quoteAsset) return `${baseAsset}/${quoteAsset}`;
  const symbol = binanceSymbol.toUpperCase();
  // Longer quote assets first so EURUSDC → EUR/USDC (never EUR/USD).
  const quotes = ["FDUSD", "USDT", "USDC", "BUSD", "BTC", "ETH", "BNB", "EUR", "USD"];
  const quote = quotes.find((item) => symbol.endsWith(item) && symbol.length > item.length);
  if (!quote) return symbol;
  return `${symbol.slice(0, -quote.length)}/${quote}`;
}

export function toBinanceInterval(timeframe: NormalizedTimeframeId): string {
  return TIMEFRAME_TO_INTERVAL[timeframe];
}

export function parseInterval(raw: string): NormalizedTimeframeId | null {
  const value = raw.toLowerCase() as NormalizedTimeframeId;
  return value in TIMEFRAME_TO_INTERVAL ? value : null;
}

function finiteNumber(value: unknown, label: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new BinanceMarketDataError("BINANCE_INVALID_MARKET_DATA", `Invalid ${label}.`);
  }
  return n;
}

export function normalizeInstrument(input: {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  status?: string;
}): NormalizedInstrument {
  const symbol = toBinanceSymbol(input.symbol);
  const baseAsset = (input.baseAsset ?? toDisplaySymbol(symbol).split("/")[0] ?? symbol).toUpperCase();
  const quoteAsset = (input.quoteAsset ?? toDisplaySymbol(symbol).split("/")[1] ?? "").toUpperCase();
  const rawStatus = (input.status ?? "TRADING").toUpperCase();
  return {
    venue: "binance-spot",
    symbol,
    displaySymbol: toDisplaySymbol(symbol, baseAsset, quoteAsset),
    baseAsset,
    quoteAsset,
    status: rawStatus === "TRADING" ? "trading" : rawStatus === "BREAK" ? "break" : "unknown",
  };
}

/**
 * Binance kline row:
 * [openTime, open, high, low, close, volume, closeTime, ...]
 */
export function normalizeBinanceKline(row: unknown): NormalizedCandle {
  if (!Array.isArray(row) || row.length < 7) {
    throw new BinanceMarketDataError("BINANCE_INVALID_MARKET_DATA", "Invalid candlestick payload.");
  }
  const openTime = finiteNumber(row[0], "open time");
  const open = finiteNumber(row[1], "open");
  const high = finiteNumber(row[2], "high");
  const low = finiteNumber(row[3], "low");
  const close = finiteNumber(row[4], "close");
  const volume = finiteNumber(row[5], "volume");
  const closeTime = finiteNumber(row[6], "close time");
  if (high < Math.max(open, close) || low > Math.min(open, close)) {
    throw new BinanceMarketDataError("BINANCE_INVALID_MARKET_DATA", "Invalid OHLC range.");
  }
  return {
    time: Math.floor(openTime / 1000),
    open,
    high,
    low,
    close,
    volume,
    closed: closeTime <= Date.now(),
  };
}

export function normalizeBinanceKlines(rows: unknown): NormalizedCandle[] {
  if (!Array.isArray(rows)) {
    throw new BinanceMarketDataError("BINANCE_INVALID_RESPONSE", "Candlestick response is not a list.");
  }
  const seen = new Set<number>();
  const candles: NormalizedCandle[] = [];
  for (const row of rows) {
    try {
      const candle = normalizeBinanceKline(row);
      if (seen.has(candle.time)) continue;
      seen.add(candle.time);
      candles.push(candle);
    } catch {
      continue;
    }
  }
  candles.sort((left, right) => left.time - right.time);
  return candles;
}

export function klineStreamName(symbol: string, timeframe: NormalizedTimeframeId): string {
  return `${toBinanceSymbol(symbol).toLowerCase()}@kline_${toBinanceInterval(timeframe)}`;
}

export function buildKlineUrl(websocketBaseUrl: string, symbol: string, timeframe: NormalizedTimeframeId): string {
  const base = websocketBaseUrl.replace(/\/+$/, "");
  return `${base}/ws/${klineStreamName(symbol, timeframe)}`;
}

export function normalizeBinanceKlineEvent(
  raw: unknown,
  expectedSymbol?: string,
  expectedTimeframe?: NormalizedTimeframeId,
  receivedAtUtc = Date.now(),
): NormalizedLiveKline | null {
  const row = unwrapStreamPayload(raw);
  if (!row) return null;
  const eventType = typeof row.e === "string" ? row.e : "";
  if (eventType && eventType !== "kline") return null;
  const body = row.k && typeof row.k === "object" ? row.k as Record<string, unknown> : row;
  let symbol: string;
  try {
    symbol = toBinanceSymbol(String(row.s ?? body.s ?? ""));
  } catch {
    return null;
  }
  if (expectedSymbol) {
    try {
      if (symbol !== toBinanceSymbol(expectedSymbol)) return null;
    } catch {
      return null;
    }
  }
  const intervalRaw = String(body.i ?? "");
  const timeframe = parseInterval(intervalRaw);
  if (!timeframe) return null;
  if (expectedTimeframe && timeframe !== expectedTimeframe) return null;
  try {
    const candle = normalizeBinanceKline([
      body.t,
      body.o,
      body.h,
      body.l,
      body.c,
      body.v,
      body.T,
    ]);
    candle.closed = body.x === true;
    const eventTimeUtc = optionalFinite(row.E) ?? candle.time * 1000;
    return {
      venue: "binance-spot",
      symbol,
      timeframe,
      candle,
      eventTimeUtc,
      receivedAtUtc,
      source: "binance-spot-public",
      streamType: "kline",
    };
  } catch {
    return null;
  }
}

function isValidNormalizedCandle(candle: NormalizedCandle): boolean {
  if (!Number.isFinite(candle.time) || candle.time <= 0) return false;
  const fields = [candle.open, candle.high, candle.low, candle.close, candle.volume];
  if (fields.some((value) => !Number.isFinite(value))) return false;
  if (candle.high < Math.max(candle.open, candle.close)) return false;
  if (candle.low > Math.min(candle.open, candle.close)) return false;
  if (candle.volume < 0) return false;
  return true;
}

/**
 * Merge one Binance live kline into historical candles by candle identity (open time).
 * Same timestamp → update that forming/closed candle in place (never duplicate).
 * Later timestamp → append a new candle.
 * Older timestamp → ignored (stale/out-of-order stream event).
 * Binance stream OHLC is authoritative for the forming candle; open is preserved from the first observation.
 */
export function applyLiveKline(history: NormalizedCandle[], live: NormalizedCandle): NormalizedCandle[] {
  if (!isValidNormalizedCandle(live)) return history;
  if (history.length === 0) return [live];

  const last = history[history.length - 1];
  if (live.time === last.time) {
    const next = history.slice();
    const open = Number.isFinite(last.open) ? last.open : live.open;
    next[next.length - 1] = {
      ...live,
      open,
      high: Math.max(last.high, live.high, open, live.close),
      low: Math.min(last.low, live.low, open, live.close),
      close: live.close,
      volume: live.volume,
      closed: live.closed,
    };
    return next;
  }
  if (live.time > last.time) {
    return [...history, live];
  }
  // Stale event for an earlier interval — do not regress the chart series.
  return history;
}

export function normalizeBinanceTicker24h(raw: unknown): NormalizedTicker {
  if (!raw || typeof raw !== "object") {
    throw new BinanceMarketDataError("BINANCE_INVALID_RESPONSE", "Ticker response is invalid.");
  }
  const row = raw as Record<string, unknown>;
  const instrument = normalizeInstrument({ symbol: String(row.symbol ?? "") });
  const price = finiteNumber(row.lastPrice ?? row.price, "last price");
  const eventTimeUtc = typeof row.closeTime === "number" ? row.closeTime : Date.now();
  return {
    instrument,
    price,
    change: row.priceChange == null ? null : finiteNumber(row.priceChange, "price change"),
    changePercent: row.priceChangePercent == null ? null : finiteNumber(row.priceChangePercent, "price change percent"),
    high: row.highPrice == null ? null : finiteNumber(row.highPrice, "high"),
    low: row.lowPrice == null ? null : finiteNumber(row.lowPrice, "low"),
    volume: row.volume == null ? null : finiteNumber(row.volume, "volume"),
    eventTimeUtc,
  };
}

export function miniTickerStreamName(symbol: string): string {
  return `${toBinanceSymbol(symbol).toLowerCase()}@miniTicker`;
}

export function buildMiniTickerUrl(websocketBaseUrl: string, symbol: string): string {
  const base = websocketBaseUrl.replace(/\/+$/, "");
  return `${base}/ws/${miniTickerStreamName(symbol)}`;
}

function optionalFinite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function unwrapStreamPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (row.data && typeof row.data === "object") return row.data as Record<string, unknown>;
  return row;
}

/**
 * Normalize a public Spot miniTicker payload. Returns null for malformed data
 * so a bad tick cannot enter application state.
 */
export function normalizeBinanceMiniTicker(
  raw: unknown,
  expectedSymbol?: string,
  receivedAtUtc = Date.now(),
): NormalizedLiveTicker | null {
  const row = unwrapStreamPayload(raw);
  if (!row) return null;
  const eventType = typeof row.e === "string" ? row.e : "";
  if (eventType && eventType !== "24hrMiniTicker") return null;
  let symbol: string;
  try {
    symbol = toBinanceSymbol(String(row.s ?? row.symbol ?? ""));
  } catch {
    return null;
  }
  if (expectedSymbol) {
    try {
      if (symbol !== toBinanceSymbol(expectedSymbol)) return null;
    } catch {
      return null;
    }
  }
  const price = optionalFinite(row.c ?? row.lastPrice ?? row.p);
  if (price == null || price <= 0) return null;
  const eventTimeUtc = optionalFinite(row.E ?? row.eventTime);
  if (eventTimeUtc == null || eventTimeUtc <= 0) return null;
  return {
    venue: "binance-spot",
    symbol,
    displaySymbol: toDisplaySymbol(symbol),
    price,
    eventTimeUtc,
    receivedAtUtc,
    source: "binance-spot-public",
    streamType: "miniTicker",
    open: optionalFinite(row.o),
    high: optionalFinite(row.h),
    low: optionalFinite(row.l),
  };
}

const BINANCE_STATUS_VALUES = new Set([
  "TRADING",
  "BREAK",
  "HALT",
  "AUCTION_MATCH",
  "PRE_TRADING",
  "POST_TRADING",
  "END_OF_DAY",
]);

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function collectPermissions(row: Record<string, unknown>): string[] {
  const direct = asStringList(row.permissions);
  const nested = Array.isArray(row.permissionSets)
    ? row.permissionSets.flatMap((set) => asStringList(set))
    : [];
  return [...new Set([...direct, ...nested].map((item) => item.toUpperCase()))];
}

function isSpotSymbol(row: Record<string, unknown>, permissions: string[]): boolean {
  if (row.isSpotTradingAllowed === false) return false;
  if (permissions.length === 0) return true;
  return permissions.includes("SPOT");
}

export function normalizeBinanceSpotMarket(raw: unknown): NormalizedMarket | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const symbolRaw = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
  const baseAsset = typeof row.baseAsset === "string" ? row.baseAsset.trim().toUpperCase() : "";
  const quoteAsset = typeof row.quoteAsset === "string" ? row.quoteAsset.trim().toUpperCase() : "";
  if (!/^[A-Z0-9]{4,30}$/.test(symbolRaw) || !baseAsset || !quoteAsset) return null;
  const permissions = collectPermissions(row);
  if (!isSpotSymbol(row, permissions)) return null;
  const statusRaw = typeof row.status === "string" ? row.status.trim().toUpperCase() : "UNKNOWN";
  const status = (BINANCE_STATUS_VALUES.has(statusRaw) ? statusRaw : "UNKNOWN") as NormalizedMarket["status"];
  return {
    venue: "binance-spot",
    marketType: "spot",
    symbol: symbolRaw,
    displaySymbol: `${baseAsset}/${quoteAsset}`,
    displayName: `${baseAsset} / ${quoteAsset} Spot`,
    baseAsset,
    quoteAsset,
    status,
    tradable: status === "TRADING",
    permissions: permissions.length > 0 ? permissions : ["SPOT"],
    source: "binance-spot-public",
  };
}

export function normalizeBinanceExchangeInfo(raw: unknown): NormalizedMarket[] {
  if (!raw || typeof raw !== "object") {
    throw new BinanceMarketDataError("BINANCE_INVALID_RESPONSE", "Exchange information response is invalid.");
  }
  const payload = raw as { symbols?: unknown };
  if (!Array.isArray(payload.symbols)) {
    throw new BinanceMarketDataError("BINANCE_INVALID_RESPONSE", "Exchange information did not include symbols.");
  }
  const seen = new Set<string>();
  const markets: NormalizedMarket[] = [];
  for (const item of payload.symbols) {
    const market = normalizeBinanceSpotMarket(item);
    if (!market || seen.has(market.symbol)) continue;
    seen.add(market.symbol);
    markets.push(market);
  }
  markets.sort((left, right) => {
    if (left.tradable !== right.tradable) return left.tradable ? -1 : 1;
    return left.symbol.localeCompare(right.symbol);
  });
  return markets;
}

export function filterBinanceMarkets(
  markets: NormalizedMarket[],
  options: { query?: string; quoteAsset?: string; tradable?: "all" | "trading" | "not-trading" } = {},
): NormalizedMarket[] {
  const query = (options.query ?? "").trim().toUpperCase().replace("/", "");
  const quote = (options.quoteAsset ?? "").trim().toUpperCase();
  return markets.filter((market) => {
    if (quote && market.quoteAsset !== quote) return false;
    if (options.tradable === "trading" && !market.tradable) return false;
    if (options.tradable === "not-trading" && market.tradable) return false;
    if (!query) return true;
    return (
      market.symbol.includes(query) ||
      market.baseAsset.includes(query) ||
      market.quoteAsset.includes(query) ||
      market.displaySymbol.replace("/", "").includes(query)
    );
  });
}
