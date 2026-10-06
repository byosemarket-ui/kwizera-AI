import type { MarketConnectionSnapshot, NormalizedMarket } from "../../../ai/market-data/binance/types";
import { disconnectedSnapshot } from "../../../ai/market-data/binance/connection";
import { resolveBinancePublicConfig } from "../../../ai/market-data/binance/config";

const STATUS_PATH = "/api/forex/binance/status";

export async function fetchBinanceConnectionStatus(
  fetchImpl: typeof fetch = fetch,
): Promise<MarketConnectionSnapshot> {
  const fallback = disconnectedSnapshot(
    resolveBinancePublicConfig({ KWIZERA_ENV: "development" }),
    "Binance public API status is unavailable.",
  );
  try {
    const response = await fetchImpl(STATUS_PATH, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json() as { snapshot?: MarketConnectionSnapshot };
    if (!payload.snapshot || typeof payload.snapshot.state !== "string") {
      return { ...fallback, state: "ERROR", errorCode: "BINANCE_INVALID_RESPONSE", message: "Invalid Binance status payload." };
    }
    return {
      ...payload.snapshot,
      liveMarketData: false,
      websocketActive: false,
    };
  } catch {
    return {
      ...fallback,
      state: "ERROR",
      errorCode: "BINANCE_NETWORK",
      message: "Market data is temporarily unavailable.",
    };
  }
}

function isNormalizedSpotMarket(value: unknown): value is NormalizedMarket {
  if (!value || typeof value !== "object") return false;
  const row = value as NormalizedMarket;
  return (
    row.venue === "binance-spot" &&
    row.marketType === "spot" &&
    typeof row.symbol === "string" &&
    /^[A-Z0-9]{4,30}$/.test(row.symbol) &&
    typeof row.baseAsset === "string" &&
    typeof row.quoteAsset === "string" &&
    typeof row.status === "string"
  );
}

const MARKETS_PATH = "/api/forex/binance/markets";

export type BinanceMarketsLoadState = "loading" | "ready" | "empty" | "error" | "disconnected";

export interface BinanceMarketsResult {
  state: BinanceMarketsLoadState;
  markets: NormalizedMarket[];
  message: string;
  restBaseHost: string | null;
  fetchedAtUtc: number | null;
}

export async function fetchBinanceMarkets(
  options: { refresh?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<BinanceMarketsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const path = options.refresh ? `${MARKETS_PATH}?refresh=1` : MARKETS_PATH;
  try {
    const response = await fetchImpl(path, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const payload = await response.json() as {
      ok?: boolean;
      markets?: NormalizedMarket[];
      restBaseHost?: string;
      fetchedAtUtc?: number;
      error?: { code?: string; message?: string };
    };
    if (payload.error?.code === "BINANCE_DISABLED") {
      return {
        state: "disconnected",
        markets: [],
        message: "Binance market service unavailable.",
        restBaseHost: null,
        fetchedAtUtc: null,
      };
    }
    if (!response.ok || payload.ok === false || !Array.isArray(payload.markets)) {
      return {
        state: "error",
        markets: [],
        message: "Unable to load Binance markets.",
        restBaseHost: null,
        fetchedAtUtc: null,
      };
    }
    const markets = payload.markets.filter(isNormalizedSpotMarket);
    if (markets.length === 0) {
      return {
        state: "empty",
        markets: [],
        message: "No Binance markets available.",
        restBaseHost: payload.restBaseHost ?? null,
        fetchedAtUtc: payload.fetchedAtUtc ?? null,
      };
    }
    return {
      state: "ready",
      markets,
      message: "Spot market metadata from Binance. Prices are not included.",
      restBaseHost: payload.restBaseHost ?? null,
      fetchedAtUtc: payload.fetchedAtUtc ?? Date.now(),
    };
  } catch {
    return {
      state: "error",
      markets: [],
      message: "Unable to load Binance markets.",
      restBaseHost: null,
      fetchedAtUtc: null,
    };
  }
}

export type BinanceKlinesLoadState = "loading" | "ready" | "empty" | "error" | "disconnected";

export interface BinanceKlinesResult {
  state: BinanceKlinesLoadState;
  symbol: string | null;
  timeframe: string | null;
  candles: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closed: boolean;
  }>;
  message: string;
}

function isNormalizedCandle(value: unknown): value is BinanceKlinesResult["candles"][number] {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const fields = [row.time, row.open, row.high, row.low, row.close, row.volume];
  if (fields.some((item) => typeof item !== "number" || !Number.isFinite(item))) return false;
  if ((row.high as number) < Math.max(row.open as number, row.close as number)) return false;
  if ((row.low as number) > Math.min(row.open as number, row.close as number)) return false;
  return true;
}

export async function fetchBinanceKlinesSeries(options: {
  symbol: string;
  timeframe: string;
  fetchImpl?: typeof fetch;
}): Promise<BinanceKlinesResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const path = `/api/forex/binance/klines?symbol=${encodeURIComponent(options.symbol)}&interval=${encodeURIComponent(options.timeframe)}&limit=300`;
  try {
    const response = await fetchImpl(path, { method: "GET", headers: { Accept: "application/json" } });
    const payload = await response.json() as {
      ok?: boolean;
      symbol?: string;
      timeframe?: string;
      candles?: unknown[];
      error?: { code?: string };
    };
    if (payload.error?.code === "BINANCE_DISABLED") {
      return { state: "disconnected", symbol: null, timeframe: null, candles: [], message: "Binance live data unavailable." };
    }
    if (!response.ok || payload.ok === false || !Array.isArray(payload.candles)) {
      return { state: "error", symbol: null, timeframe: null, candles: [], message: "Unable to load Binance market data." };
    }
    const candles = payload.candles.filter(isNormalizedCandle);
    if (candles.length === 0) {
      return {
        state: "empty",
        symbol: payload.symbol ?? options.symbol,
        timeframe: payload.timeframe ?? options.timeframe,
        candles: [],
        message: "No Binance candle data available.",
      };
    }
    return {
      state: "ready",
      symbol: payload.symbol ?? options.symbol,
      timeframe: payload.timeframe ?? options.timeframe,
      candles,
      message: "Historical Binance candles loaded.",
    };
  } catch {
    return { state: "error", symbol: null, timeframe: null, candles: [], message: "Unable to load Binance market data." };
  }
}
