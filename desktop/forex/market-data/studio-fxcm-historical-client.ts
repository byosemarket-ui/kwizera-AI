/**
 * Phase 28 — browser client for FXCM historical candles (server-side provider only).
 * Never constructs FXCM auth headers or tokens.
 */
import type { Candle, ChartTimeframeId } from "../chart/types";

const PATH = "/api/forex/providers/fxcm/historical";

export type FxcmHistoricalLoadState = "loading" | "ready" | "empty" | "error" | "unavailable";

export interface FxcmHistoricalSeriesResult {
  state: FxcmHistoricalLoadState;
  symbol: string | null;
  providerSymbol: string | null;
  timeframe: ChartTimeframeId;
  candles: Candle[];
  source: "FXCM" | "CACHE" | null;
  mode: "HISTORICAL";
  message: string;
  qualityStatus: string | null;
}

export async function fetchFxcmHistoricalSeries(options: {
  symbol: string;
  timeframe: ChartTimeframeId;
  limit?: number;
  fetchImpl?: typeof fetch;
}): Promise<FxcmHistoricalSeriesResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const q = new URLSearchParams({
    symbol: options.symbol,
    timeframe: options.timeframe,
    limit: String(options.limit ?? 300),
  });
  try {
    const res = await fetchImpl(`${PATH}?${q.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const payload = await res.json() as {
      ok?: boolean;
      providerSymbol?: string;
      symbol?: string;
      timeframe?: string;
      source?: "FXCM" | "CACHE";
      candles?: Array<{
        time: number;
        open: number;
        high: number;
        low: number;
        close: number;
        volume?: number | null;
        closed?: boolean;
      }>;
      quality?: { status?: string };
      error?: { code?: string; message?: string };
      note?: string;
    };

    if (!res.ok || payload.ok === false) {
      const code = payload.error?.code ?? "";
      const unavailable = code === "FXCM_DISABLED" || code === "FXCM_NOT_CONFIGURED";
      return {
        state: unavailable ? "unavailable" : "error",
        symbol: options.symbol,
        providerSymbol: null,
        timeframe: options.timeframe,
        candles: [],
        source: null,
        mode: "HISTORICAL",
        message: payload.error?.message ?? "Unable to load FXCM historical candles.",
        qualityStatus: null,
      };
    }

    const candles: Candle[] = (payload.candles ?? []).map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      // FXCM tickQty is not traded volume — omit rather than invent 0.
      volume: c.volume == null ? undefined : c.volume,
      closed: c.closed !== false,
    }));

    return {
      state: candles.length ? "ready" : "empty",
      symbol: payload.symbol ?? options.symbol,
      providerSymbol: payload.providerSymbol ?? null,
      timeframe: options.timeframe,
      candles,
      source: payload.source ?? "FXCM",
      mode: "HISTORICAL",
      message: candles.length
        ? `HISTORICAL · SOURCE: ${payload.source ?? "FXCM"}`
        : (payload.note ?? "No FXCM historical candles."),
      qualityStatus: payload.quality?.status ?? null,
    };
  } catch {
    return {
      state: "error",
      symbol: options.symbol,
      providerSymbol: null,
      timeframe: options.timeframe,
      candles: [],
      source: null,
      mode: "HISTORICAL",
      message: "Unable to load FXCM historical candles.",
      qualityStatus: null,
    };
  }
}
