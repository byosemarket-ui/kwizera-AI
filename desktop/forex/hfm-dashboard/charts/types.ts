/** HFM Charts Workspace types — HFM_MT5 only. No synthetic market data. */

export const HFM_CHARTS_PROVIDER = "HFM_MT5" as const;

/** Native CopyRates + live forming verified (STEP 3 / 1C.2 — all twelve required TFs). */
export const HFM_CHART_VERIFIED_TFS = [
  "M1",
  "M3",
  "M5",
  "M15",
  "M30",
  "H1",
  "H2",
  "H4",
  "H6",
  "H12",
  "D1",
  "W1",
] as const;

/** UI timeframe bar — request only; unavailable stays honest. */
export const HFM_CHART_TIMEFRAMES = [
  "M1",
  "M2",
  "M3",
  "M5",
  "M10",
  "M15",
  "M20",
  "M30",
  "H1",
  "H2",
  "H3",
  "H4",
  "H6",
  "H8",
  "H12",
  "D1",
  "W1",
  "MN1",
] as const;

export type HfmChartTimeframe = (typeof HFM_CHART_TIMEFRAMES)[number];

export type HfmChartTypeId = "candlestick" | "ohlc" | "line" | "area";

export interface HfmChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
  closed?: boolean;
}

export type HfmChartDataStatus =
  | "CONNECTED"
  | "DISCONNECTED"
  | "RECONNECTING"
  | "STALE"
  | "DELAYED"
  | "UNAVAILABLE"
  | "INVALID"
  | "LOADING"
  | "EMPTY";

export type HfmDrawingToolId =
  | "cursor"
  | "hline"
  | "vline"
  | "trendline"
  | "rectangle"
  | "text"
  | "channel"
  | "fib_retracement"
  | "fib_extension";

export interface HfmDrawingBase {
  id: string;
  tool: HfmDrawingToolId;
  symbol: string;
  timeframe: string;
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  visible: boolean;
  locked?: boolean;
  label?: string;
}

export interface HfmChartTemplate {
  id: string;
  name: string;
  chartType: HfmChartTypeId;
  showGrid: boolean;
  indicators: HfmIndicatorConfig[];
  updatedAt: string;
  isDefault?: boolean;
}

export interface HfmPricePoint {
  time: number;
  price: number;
}

export type HfmDrawing =
  | (HfmDrawingBase & { tool: "hline"; price: number })
  | (HfmDrawingBase & { tool: "vline"; time: number })
  | (HfmDrawingBase & { tool: "trendline"; a: HfmPricePoint; b: HfmPricePoint })
  | (HfmDrawingBase & { tool: "rectangle"; a: HfmPricePoint; b: HfmPricePoint })
  | (HfmDrawingBase & { tool: "text"; point: HfmPricePoint; text: string })
  | (HfmDrawingBase & { tool: "channel"; a: HfmPricePoint; b: HfmPricePoint; offsetPrice: number })
  | (HfmDrawingBase & { tool: "fib_retracement"; a: HfmPricePoint; b: HfmPricePoint })
  | (HfmDrawingBase & { tool: "fib_extension"; a: HfmPricePoint; b: HfmPricePoint; c: HfmPricePoint });

export type HfmIndicatorKind =
  | "sma"
  | "ema"
  | "rsi"
  | "macd"
  | "stoch"
  | "cci"
  | "atr"
  | "bollinger"
  | "adx"
  | "tick_volume"
  | "real_volume";

export interface HfmIndicatorConfig {
  id: string;
  kind: HfmIndicatorKind;
  visible: boolean;
  period?: number;
  period2?: number;
  period3?: number;
  deviation?: number;
  color?: string;
}

export const HFM_FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

export function isHfmChartTimeframe(value: string): value is HfmChartTimeframe {
  return (HFM_CHART_TIMEFRAMES as readonly string[]).includes(value);
}

export function isVerifiedHfmChartTf(tf: string): boolean {
  return (HFM_CHART_VERIFIED_TFS as readonly string[]).includes(tf);
}
