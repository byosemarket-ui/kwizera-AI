/**
 * Unified candle client — Charts / TA / Market State.
 * Routes through /api/forex/market-data/candles (never silent Binance↔FXCM fallback).
 */
import type { Candle, ChartTimeframeId } from "../chart/types";
import type { MarketProviderId } from "../../../ai/market-data/providers/types";

export type UnifiedCandlesLoadState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "unavailable"
  | "live"
  | "stale"
  | "connecting"
  | "reconnecting";

export interface UnifiedCandlesResult {
  state: UnifiedCandlesLoadState;
  provider: MarketProviderId | null;
  symbol: string | null;
  displaySymbol: string | null;
  timeframe: ChartTimeframeId;
  candles: Candle[];
  forming: Candle | null;
  connectionState: string | null;
  dataQuality: string | null;
  sourceMode: string | null;
  live: boolean;
  message: string;
  errorCode: string | null;
  lastQuoteAt: string | null;
  dataSource: "unified-market-data";
}

function mapCandle(raw: Record<string, unknown>): Candle {
  return {
    time: Number(raw.time),
    open: Number(raw.open),
    high: Number(raw.high),
    low: Number(raw.low),
    close: Number(raw.close),
    volume: raw.volume == null ? undefined : Number(raw.volume),
    closed: Boolean(raw.isClosed ?? raw.closed),
  };
}

function stateFromSeries(series: {
  connectionState?: string;
  dataQuality?: string;
  count?: number;
  sourceMode?: string;
}): UnifiedCandlesLoadState {
  const conn = String(series.connectionState ?? "").toUpperCase();
  if (conn === "LIVE") return "live";
  if (conn === "STALE") return "stale";
  if (conn === "RECONNECTING") return "reconnecting";
  if (conn === "CONNECTING" || conn === "CONNECTED") return "connecting";
  if ((series.count ?? 0) > 0) return "ready";
  return "empty";
}

function emptyResult(
  provider: MarketProviderId | null,
  symbol: string | null,
  timeframe: ChartTimeframeId,
  partial: Partial<UnifiedCandlesResult>,
): UnifiedCandlesResult {
  return {
    state: partial.state ?? "empty",
    provider,
    symbol,
    displaySymbol: partial.displaySymbol ?? null,
    timeframe,
    candles: partial.candles ?? [],
    forming: partial.forming ?? null,
    connectionState: partial.connectionState ?? null,
    dataQuality: partial.dataQuality ?? null,
    sourceMode: partial.sourceMode ?? null,
    live: partial.live ?? false,
    message: partial.message ?? "No candle data.",
    errorCode: partial.errorCode ?? null,
    lastQuoteAt: partial.lastQuoteAt ?? null,
    dataSource: "unified-market-data",
  };
}

export async function fetchUnifiedCandleSeries(options: {
  provider: MarketProviderId;
  symbol: string;
  timeframe: ChartTimeframeId;
  mode?: "historical" | "live";
  marketType?: string | null;
  refresh?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<UnifiedCandlesResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const mode = options.mode ?? "historical";
  const params = new URLSearchParams({
    provider: options.provider,
    symbol: options.symbol,
    timeframe: options.timeframe,
    mode,
    limit: "300",
  });
  if (options.marketType) params.set("marketType", options.marketType);
  if (options.refresh) params.set("refresh", "1");

  try {
    const res = await fetchImpl(`/api/forex/market-data/candles?${params.toString()}`, {
      headers: { Accept: "application/json" },
      method: "GET",
    });
    const payload = await res.json() as {
      ok?: boolean;
      series?: Record<string, unknown>;
      error?: { code?: string; message?: string };
    };
    if (!res.ok || payload.ok === false || !payload.series) {
      const code = payload.error?.code ?? "CANDLE_ERROR";
      const unavailable = /DISABLED|NOT_CONFIGURED|CONFIG_MISSING/i.test(code);
      return emptyResult(options.provider, options.symbol, options.timeframe, {
        state: unavailable ? "unavailable" : "error",
        errorCode: code,
        message: payload.error?.message
          ?? (unavailable
            ? "Provider candles unavailable (disabled or not configured)."
            : "Unable to load candles from unified Market Data."),
      });
    }

    const series = payload.series;
    const identity = (series.identity ?? {}) as Record<string, unknown>;
    const rawCandles = Array.isArray(series.candles)
      ? (series.candles as Array<Record<string, unknown>>)
      : [];
    const candles = rawCandles.map(mapCandle);
    const formingRaw = series.forming as Record<string, unknown> | null | undefined;
    const forming = formingRaw ? mapCandle(formingRaw) : null;
    const connectionState = String(series.connectionState ?? "");
    const live = connectionState.toUpperCase() === "LIVE";

    return {
      state: stateFromSeries({
        connectionState,
        dataQuality: String(series.dataQuality ?? ""),
        count: candles.length,
        sourceMode: String(series.sourceMode ?? ""),
      }),
      provider: options.provider,
      symbol: options.symbol,
      displaySymbol: typeof identity.displaySymbol === "string" ? identity.displaySymbol : null,
      timeframe: options.timeframe,
      candles,
      forming,
      connectionState,
      dataQuality: String(series.dataQuality ?? ""),
      sourceMode: String(series.sourceMode ?? ""),
      live,
      message: typeof series.note === "string" && series.note
        ? series.note
        : `${options.provider} candles via unified Market Data.`,
      errorCode: typeof series.errorCode === "string" ? series.errorCode : null,
      lastQuoteAt: typeof series.lastQuoteAt === "string" ? series.lastQuoteAt : null,
      dataSource: "unified-market-data",
    };
  } catch {
    return emptyResult(options.provider, options.symbol, options.timeframe, {
      state: "error",
      errorCode: "NETWORK_ERROR",
      message: "Unable to reach unified Market Data candle API.",
    });
  }
}
