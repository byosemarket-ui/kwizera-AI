import { BinanceMarketDataError } from "./errors.js";
import type { NormalizedCandle, NormalizedInstrument, NormalizedTicker, NormalizedTimeframeId } from "./types.js";

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
