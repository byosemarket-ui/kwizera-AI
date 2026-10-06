import { FOREX_INSTRUMENTS } from "../dashboard-data";
import {
  CANDLE_COUNT,
  DEVELOPMENT_SERIES_END_UTC,
  type Candle,
  type ChartTimeframeId,
  type MarketSeries,
  CHART_TIMEFRAMES,
} from "./types";
import { roundPrice, sanitizeCandles } from "./validate-candles";

const BASE_PRICE: Record<string, number> = {
  "EUR/USD": 1.085,
  "GBP/USD": 1.265,
  "USD/JPY": 149.2,
  "USD/CHF": 0.882,
  "AUD/USD": 0.662,
  "USD/CAD": 1.358,
  "NZD/USD": 0.598,
  "XAU/USD": 2320,
};

function priceDigits(symbol: string): number {
  if (symbol.includes("JPY")) return 3;
  if (symbol.startsWith("XAU")) return 2;
  return 5;
}

function symbolBias(symbol: string): number {
  let total = 0;
  for (let index = 0; index < symbol.length; index += 1) total += symbol.charCodeAt(index);
  return total;
}

export function isSupportedChartSymbol(symbol: string): boolean {
  return FOREX_INSTRUMENTS.some((item) => item.symbol === symbol);
}

export function generateDevelopmentCandles(symbol: string, timeframe: ChartTimeframeId): Candle[] {
  const base = BASE_PRICE[symbol];
  const spec = CHART_TIMEFRAMES.find((item) => item.id === timeframe);
  if (!base || !spec) return [];
  const digits = priceDigits(symbol);
  const bias = symbolBias(symbol) / 100;
  const stepMs = spec.minutes * 60 * 1000;
  const candles: Candle[] = [];
  let previousClose = base;
  for (let index = 0; index < CANDLE_COUNT; index += 1) {
    const time = Math.floor((DEVELOPMENT_SERIES_END_UTC - (CANDLE_COUNT - 1 - index) * stepMs) / 1000);
    const wave = Math.sin(index / 18 + bias) * 0.012 + Math.sin(index / 7 + bias * 0.31) * 0.0045;
    const step = ((index % 13) - 6) * 0.00035;
    const close = roundPrice(base * (1 + wave + step * (0.2 + bias * 0.02)), digits);
    const open = roundPrice(previousClose, digits);
    const wick = roundPrice(Math.abs(close - open) * 0.42 + base * 0.00035 * (1 + Math.abs(Math.sin(index / 5 + bias))), digits);
    const high = roundPrice(Math.max(open, close) + wick, digits);
    const low = roundPrice(Math.min(open, close) - wick, digits);
    candles.push({ time, open, high, low, close });
    previousClose = close;
  }
  return sanitizeCandles(candles);
}

export function getDevelopmentSeries(symbol: string, timeframe: ChartTimeframeId): MarketSeries | null {
  if (!isSupportedChartSymbol(symbol)) return null;
  const candles = generateDevelopmentCandles(symbol, timeframe);
  if (candles.length === 0) return null;
  return {
    symbol,
    timeframe,
    candles,
    kind: "development",
    statusLabel: "Development data",
    timezone: "UTC",
  };
}
