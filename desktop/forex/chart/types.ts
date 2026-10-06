export type ChartTimeframeId = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";
export type ChartTypeId = "candlestick" | "line";
export type MarketDataKind = "development" | "live";
export type ChartLoadState = "loading" | "ready" | "empty" | "unavailable" | "error";
export type OverlayIndicatorKind = "sma" | "ema" | "bollinger";
export type PaneIndicatorKind = "rsi" | "macd";
export type IndicatorKind = OverlayIndicatorKind | PaneIndicatorKind;
export type PriceLevelKind = "support" | "resistance";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ChartTimeframe {
  id: ChartTimeframeId;
  label: string;
  minutes: number;
}

export interface MarketSeries {
  symbol: string;
  timeframe: ChartTimeframeId;
  candles: Candle[];
  kind: MarketDataKind;
  statusLabel: string;
  timezone: "UTC";
}

export interface MarketDataRequest {
  symbol: string;
  timeframe: ChartTimeframeId;
}

export interface MarketDataResult {
  state: ChartLoadState;
  series: MarketSeries | null;
  message: string;
}

export interface OverlayIndicatorConfig {
  id: string;
  kind: OverlayIndicatorKind;
  period: number;
  deviation?: number;
}

export interface PaneIndicatorConfig {
  id: string;
  kind: PaneIndicatorKind;
  period?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
}

export interface IndicatorConfig {
  id: string;
  kind: IndicatorKind;
  period?: number;
  deviation?: number;
  fastPeriod?: number;
  slowPeriod?: number;
  signalPeriod?: number;
}

export interface LinePoint {
  time: number;
  value: number;
}

export interface HistogramPoint {
  time: number;
  value: number;
}

export interface PriceLevel {
  id: string;
  kind: PriceLevelKind;
  price: number;
}

export const CHART_TIMEFRAMES: ChartTimeframe[] = [
  { id: "1m", label: "1m", minutes: 1 },
  { id: "5m", label: "5m", minutes: 5 },
  { id: "15m", label: "15m", minutes: 15 },
  { id: "30m", label: "30m", minutes: 30 },
  { id: "1h", label: "1H", minutes: 60 },
  { id: "4h", label: "4H", minutes: 240 },
  { id: "1d", label: "1D", minutes: 1440 },
  { id: "1w", label: "1W", minutes: 10080 },
];

/** Test-only default for development candle helpers. Not a production chart default. */
export const DEFAULT_CHART_SYMBOL = "EUR/USD";
export const DEFAULT_CHART_TIMEFRAME: ChartTimeframeId = "1h";
export const CANDLE_COUNT = 300;
/** Fixed end timestamp so test candles stay deterministic. */
export const DEVELOPMENT_SERIES_END_UTC = Date.UTC(2026, 9, 1, 12, 0, 0);

export function timeframeLabel(id: ChartTimeframeId): string {
  return CHART_TIMEFRAMES.find((item) => item.id === id)?.label ?? id;
}
