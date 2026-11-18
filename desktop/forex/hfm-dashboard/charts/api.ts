/**
 * HFM Charts REST client — STEP 2 market APIs only (HFM_MT5).
 */
import {
  buildForexAdminHeaders,
  getForexAdminToken,
} from "../../admin-access/forex-admin-token";
import { HfmMwApiError } from "../market-watch/api";
import type { HfmChartCandle, HfmChartTemplate, HfmDrawing } from "./types";

const CANDLES = "/api/forex/providers/mt5-hfm/market/candles";
const TICKS = "/api/forex/providers/mt5-hfm/market/ticks";
const LIVE_CANDLE = "/api/forex/providers/mt5-hfm/market/live-candle";
const QUOTE_WATCH = "/api/forex/providers/mt5-hfm/market/quote-watch";
const QUOTE = "/api/forex/providers/mt5-hfm/quotes";
const DRAWINGS = "/api/forex/providers/mt5-hfm/charts/drawings";
const TEMPLATES = "/api/forex/providers/mt5-hfm/charts/templates";

async function requestJson<T>(
  path: string,
  init?: { method?: string; body?: unknown; signal?: AbortSignal },
): Promise<{ status: number; body: T }> {
  if (!getForexAdminToken()) {
    throw new HfmMwApiError("AUTH_REQUIRED", "Admin API token required for HFM Charts.");
  }
  const method = init?.method ?? "GET";
  const headers = buildForexAdminHeaders(path, {
    includeJsonContentType: init?.body !== undefined,
  });
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers,
      cache: "no-store",
      signal: init?.signal,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    throw new HfmMwApiError(
      "NETWORK",
      err instanceof Error ? err.message : "Network error contacting HFM Charts API",
    );
  }
  let body: T;
  try {
    body = (await res.json()) as T;
  } catch {
    throw new HfmMwApiError("HTTP_ERROR", `Invalid JSON (${res.status})`, res.status);
  }
  if (res.status === 401 || res.status === 403) {
    throw new HfmMwApiError("AUTH_REJECTED", "HFM Charts admin authorization rejected.", res.status);
  }
  return { status: res.status, body };
}

function normalizeBars(raw: unknown[]): HfmChartCandle[] {
  const out: HfmChartCandle[] = [];
  let last = -1;
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const time = typeof r.time === "number" ? r.time : Number(r.time);
    const open = Number(r.open);
    const high = Number(r.high);
    const low = Number(r.low);
    const close = Number(r.close);
    if (![time, open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) continue;
    if (high < Math.max(open, close) || low > Math.min(open, close) || high < low) continue;
    if (time <= last) continue;
    last = time;
    out.push({
      time,
      open,
      high,
      low,
      close,
      tickVolume: typeof r.tickVolume === "number" ? r.tickVolume : null,
      realVolume: typeof r.realVolume === "number" ? r.realVolume : null,
      spread: typeof r.spread === "number" ? r.spread : null,
      closed: r.closed === false ? false : true,
    });
  }
  return out;
}

export interface HfmChartsHistoryResult {
  ok: boolean;
  available: boolean;
  symbol: string;
  timeframe: string;
  bars: HfmChartCandle[];
  count: number;
  hasMore: boolean;
  source: string | null;
  freshness: string | null;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  errors: string[];
  currentCandle: HfmChartCandle | null;
}

export async function fetchHfmChartsCandles(opts: {
  symbol: string;
  timeframe: string;
  limit?: number;
  startPos?: number;
  refresh?: boolean;
  signal?: AbortSignal;
}): Promise<HfmChartsHistoryResult> {
  const { status, body } = await requestJson<Record<string, unknown>>(CANDLES, {
    method: "POST",
    signal: opts.signal,
    body: {
      environment: "demo",
      symbol: opts.symbol,
      timeframe: opts.timeframe,
      limit: opts.limit ?? 200,
      startPos: opts.startPos ?? 0,
      refresh: Boolean(opts.refresh),
    },
  });
  if (body.provider != null && body.provider !== "HFM_MT5") {
    throw new HfmMwApiError("PROVIDER_MISMATCH", `Unexpected provider: ${String(body.provider)}`);
  }
  const rawBars = Array.isArray(body.bars) ? body.bars : [];
  const bars = normalizeBars(rawBars);
  const forming = body.currentCandle && typeof body.currentCandle === "object"
    ? normalizeBars([body.currentCandle])[0] ?? null
    : null;
  if (forming) forming.closed = false;
  return {
    ok: Boolean(body.ok) && status < 500,
    available: Boolean(body.available) && bars.length > 0,
    symbol: String(body.symbol ?? opts.symbol).toUpperCase(),
    timeframe: String(body.timeframe ?? opts.timeframe),
    bars,
    count: bars.length,
    hasMore: Boolean(body.hasMore),
    source: typeof body.source === "string" ? body.source : null,
    freshness: typeof body.freshness === "string" ? body.freshness : null,
    oldestTimestamp: typeof body.oldestTimestamp === "number" ? body.oldestTimestamp : bars[0]?.time ?? null,
    newestTimestamp: typeof body.newestTimestamp === "number" ? body.newestTimestamp : bars[bars.length - 1]?.time ?? null,
    errors: Array.isArray(body.errors) ? body.errors.map(String) : [],
    currentCandle: forming,
  };
}

export async function setHfmChartsQuoteWatch(symbols: string[], signal?: AbortSignal): Promise<boolean> {
  const { body } = await requestJson<Record<string, unknown>>(QUOTE_WATCH, {
    method: "POST",
    signal,
    body: { symbols: symbols.slice(0, 8) },
  });
  return Boolean(body.ok || body.requested);
}

export async function fetchHfmChartsQuote(
  symbol: string,
  signal?: AbortSignal,
): Promise<{ bid: number | null; ask: number | null; spread: number | null; digits: number | null; tickTime: number | null; receivedAt: string | null } | null> {
  const path = `${QUOTE}/${encodeURIComponent(symbol.toUpperCase())}`;
  try {
    const { status, body } = await requestJson<Record<string, unknown>>(path, { signal });
    if (status >= 400) return null;
    const q = (body.quote ?? body) as Record<string, unknown>;
    return {
      bid: typeof q.bid === "number" ? q.bid : null,
      ask: typeof q.ask === "number" ? q.ask : null,
      spread: typeof q.spread === "number" ? q.spread : null,
      digits: typeof q.digits === "number" ? q.digits : null,
      tickTime: typeof q.quoteTimestamp === "number" ? q.quoteTimestamp : typeof q.tickTime === "number" ? q.tickTime : null,
      receivedAt: typeof q.receivedAt === "string" ? q.receivedAt : null,
    };
  } catch {
    return null;
  }
}

export async function fetchHfmLiveCandle(
  symbol: string,
  timeframe: string,
  signal?: AbortSignal,
): Promise<HfmChartCandle | null> {
  const path = `${LIVE_CANDLE}?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;
  try {
    const { status, body } = await requestJson<Record<string, unknown>>(path, { signal });
    if (status >= 400 || !body.currentCandle) return null;
    const bars = normalizeBars([body.currentCandle]);
    if (!bars[0]) return null;
    bars[0].closed = false;
    return bars[0];
  } catch {
    return null;
  }
}

export async function fetchHfmChartDrawings(
  symbol: string,
  timeframe: string,
  signal?: AbortSignal,
): Promise<HfmDrawing[]> {
  const path = `${DRAWINGS}?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`;
  try {
    const { status, body } = await requestJson<{ drawings?: HfmDrawing[] }>(path, { signal });
    if (status >= 400 || !Array.isArray(body.drawings)) return [];
    return body.drawings;
  } catch {
    return [];
  }
}

export async function saveHfmChartDrawings(
  symbol: string,
  timeframe: string,
  drawings: HfmDrawing[],
  signal?: AbortSignal,
): Promise<HfmDrawing[]> {
  const { body } = await requestJson<{ drawings?: HfmDrawing[] }>(DRAWINGS, {
    method: "PUT",
    signal,
    body: { symbol, timeframe, drawings },
  });
  return Array.isArray(body.drawings) ? body.drawings : drawings;
}

export async function clearHfmChartDrawings(
  symbol: string,
  timeframe: string,
  signal?: AbortSignal,
): Promise<void> {
  await requestJson(DRAWINGS, {
    method: "DELETE",
    signal,
    body: { symbol, timeframe },
  });
}

export async function fetchHfmChartTemplates(signal?: AbortSignal): Promise<{
  templates: HfmChartTemplate[];
  defaultTemplateId: string | null;
}> {
  try {
    const { body } = await requestJson<{
      templates?: HfmChartTemplate[];
      defaultTemplateId?: string | null;
    }>(TEMPLATES, { signal });
    return {
      templates: Array.isArray(body.templates) ? body.templates : [],
      defaultTemplateId: body.defaultTemplateId ?? null,
    };
  } catch {
    return { templates: [], defaultTemplateId: null };
  }
}

export async function saveHfmChartTemplate(
  template: HfmChartTemplate,
  signal?: AbortSignal,
): Promise<HfmChartTemplate | null> {
  try {
    const { body } = await requestJson<{ template?: HfmChartTemplate }>(TEMPLATES, {
      method: "POST",
      signal,
      body: { template },
    });
    return body.template ?? null;
  } catch {
    return null;
  }
}

export async function renameHfmChartTemplate(
  id: string,
  name: string,
  signal?: AbortSignal,
): Promise<HfmChartTemplate | null> {
  try {
    const { body } = await requestJson<{ template?: HfmChartTemplate }>(TEMPLATES, {
      method: "PATCH",
      signal,
      body: { id, name },
    });
    return body.template ?? null;
  } catch {
    return null;
  }
}

export async function deleteHfmChartTemplate(id: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const { body } = await requestJson<{ ok?: boolean }>(TEMPLATES, {
      method: "DELETE",
      signal,
      body: { id },
    });
    return Boolean(body.ok);
  } catch {
    return false;
  }
}

export async function setDefaultHfmChartTemplate(
  id: string | null,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const { body } = await requestJson<{ ok?: boolean }>(TEMPLATES, {
      method: "PATCH",
      signal,
      body: { id, setDefault: true },
    });
    return Boolean(body.ok);
  } catch {
    return false;
  }
}

export { TICKS };
