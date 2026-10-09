/**
 * Phase 30 — browser client for FXCM live candle series (server-side sync only).
 * Never constructs FXCM auth headers or raw stream events.
 */
import type { Candle, ChartTimeframeId } from "../chart/types";

const BASE = "/api/forex/providers/fxcm/candles/live";

export type FxcmLiveCandleLoadState =
  | "loading"
  | "ready"
  | "empty"
  | "error"
  | "unavailable"
  | "connecting"
  | "live"
  | "stale"
  | "reconnecting";

export interface FxcmLiveCandleSeriesResult {
  state: FxcmLiveCandleLoadState;
  symbol: string | null;
  providerSymbol: string | null;
  displaySymbol: string | null;
  timeframe: ChartTimeframeId;
  candles: Candle[];
  forming: Candle | null;
  mode: "HISTORICAL" | "HISTORICAL_PLUS_LIVE" | "LIVE" | null;
  live: boolean;
  streamState: string | null;
  priceBasis: "mid" | null;
  message: string;
  qualityStatus: string | null;
  lastQuoteAt: string | null;
}

function mapCandles(raw: Array<Record<string, unknown>> | undefined): Candle[] {
  return (raw ?? []).map((c) => ({
    time: Number(c.time),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: c.volume == null ? undefined : Number(c.volume),
    closed: Boolean(c.closed),
  }));
}

function stateFromPayload(payload: {
  live?: boolean;
  streamState?: string;
  count?: number;
  ok?: boolean;
}): FxcmLiveCandleLoadState {
  if (payload.live) return "live";
  const s = payload.streamState ?? "";
  if (s === "STALE") return "stale";
  if (s === "RECONNECTING") return "reconnecting";
  if (s === "CONNECTING" || s === "CONNECTED") return "connecting";
  if ((payload.count ?? 0) > 0) return "ready";
  return "empty";
}

export async function subscribeFxcmLiveCandles(options: {
  symbol: string;
  timeframe: ChartTimeframeId;
  fetchImpl?: typeof fetch;
}): Promise<FxcmLiveCandleSeriesResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(`${BASE}/subscribe`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: options.symbol, timeframe: options.timeframe }),
    });
    const payload = await res.json() as Record<string, unknown>;
    if (!res.ok || payload.ok === false) {
      const err = payload.error as { code?: string; message?: string } | undefined;
      const unavailable = err?.code === "FXCM_DISABLED" || err?.code === "FXCM_NOT_CONFIGURED";
      return {
        state: unavailable ? "unavailable" : "error",
        symbol: options.symbol,
        providerSymbol: null,
        displaySymbol: null,
        timeframe: options.timeframe,
        candles: [],
        forming: null,
        mode: null,
        live: false,
        streamState: null,
        priceBasis: null,
        message: err?.message ?? "Unable to subscribe FXCM live candles.",
        qualityStatus: null,
        lastQuoteAt: null,
      };
    }
    return normalizePayload(payload, options.symbol, options.timeframe);
  } catch {
    return {
      state: "error",
      symbol: options.symbol,
      providerSymbol: null,
      displaySymbol: null,
      timeframe: options.timeframe,
      candles: [],
      forming: null,
      mode: null,
      live: false,
      streamState: null,
      priceBasis: null,
      message: "Unable to reach FXCM live candle API.",
      qualityStatus: null,
      lastQuoteAt: null,
    };
  }
}

export async function fetchFxcmLiveCandleSeries(options: {
  symbol: string;
  timeframe: ChartTimeframeId;
  fetchImpl?: typeof fetch;
}): Promise<FxcmLiveCandleSeriesResult | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const q = new URLSearchParams({
    symbol: options.symbol,
    timeframe: options.timeframe,
  });
  try {
    const res = await fetchImpl(`${BASE}?${q.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    if (res.status === 404) return null;
    const payload = await res.json() as Record<string, unknown>;
    if (!res.ok || payload.ok === false) return null;
    return normalizePayload(payload, options.symbol, options.timeframe);
  } catch {
    return null;
  }
}

export async function unsubscribeFxcmLiveCandles(options: {
  symbol: string;
  timeframe: ChartTimeframeId;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    await fetchImpl(`${BASE}/unsubscribe`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: options.symbol, timeframe: options.timeframe }),
    });
  } catch {
    // best-effort
  }
}

function normalizePayload(
  payload: Record<string, unknown>,
  fallbackSymbol: string,
  timeframe: ChartTimeframeId,
): FxcmLiveCandleSeriesResult {
  const candles = mapCandles(payload.candles as Array<Record<string, unknown>> | undefined);
  const formingRaw = payload.forming as Record<string, unknown> | null | undefined;
  const forming = formingRaw
    ? {
      time: Number(formingRaw.time),
      open: Number(formingRaw.open),
      high: Number(formingRaw.high),
      low: Number(formingRaw.low),
      close: Number(formingRaw.close),
      closed: false,
    }
    : null;
  const quality = payload.quality as { status?: string } | undefined;
  return {
    state: stateFromPayload({
      live: Boolean(payload.live),
      streamState: String(payload.streamState ?? ""),
      count: candles.length,
      ok: true,
    }),
    symbol: String(payload.canonicalSymbol ?? payload.symbol ?? fallbackSymbol),
    providerSymbol: String(payload.providerSymbol ?? ""),
    displaySymbol: String(payload.displaySymbol ?? payload.providerSymbol ?? ""),
    timeframe,
    candles,
    forming,
    mode: (payload.mode as FxcmLiveCandleSeriesResult["mode"]) ?? null,
    live: Boolean(payload.live),
    streamState: String(payload.streamState ?? ""),
    priceBasis: "mid",
    message: payload.live
      ? "HISTORICAL + LIVE · SOURCE: FXCM (mid)"
      : `SOURCE: FXCM · ${String(payload.streamState ?? "HISTORICAL")} · mid candles`,
    qualityStatus: quality?.status ?? null,
    lastQuoteAt: payload.lastQuoteAt == null ? null : String(payload.lastQuoteAt),
  };
}
