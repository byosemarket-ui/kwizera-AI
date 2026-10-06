import { BinanceMarketDataError } from "./errors.js";
import type { NormalizedCandle, NormalizedInstrument, NormalizedMarket, NormalizedTicker, NormalizedTimeframeId } from "./types.js";

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
  const quotes = ["USDT", "USDC", "BUSD", "FDUSD", "BTC", "ETH", "BNB", "EUR", "USD"];
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
  return rows.map(normalizeBinanceKline);
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
