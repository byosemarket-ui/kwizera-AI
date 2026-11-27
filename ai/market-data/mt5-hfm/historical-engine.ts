/**
 * STEP 2 — HFM MT5 historical candle engine (CopyRates via agent).
 * Engine 3 — attaches candle time provenance without altering OHLC.
 */
import { callMt5HfmAgent } from "./agent-client.js";
import { isValidOhlcCandle } from "./freshness.js";
import {
  enrichBarsWithCandleTimeProvenance,
  type HfmCandleTimeProvenance,
} from "./candle-timestamp.js";
import { ensureHfmOffsetArchiveLoadedSync } from "./offset-archive.js";

export const HFM_HISTORY_PROVIDER = "HFM_MT5" as const;

export interface HfmHistoricalBar extends HfmCandleTimeProvenance {
  /** Legacy broker-domain candle-open seconds (compatibility). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number | null;
  realVolume: number | null;
  spread: number | null;
  validationStatus: "ok" | "rejected";
  provenance: "native" | "cached";
}

export interface HfmHistoricalResult {
  provider: typeof HFM_HISTORY_PROVIDER;
  environment: "demo";
  symbol: string;
  timeframe: string;
  available: boolean;
  bars: HfmHistoricalBar[];
  count: number;
  requestedCount: number;
  hasMore: boolean;
  source: string | null;
  freshness: string | null;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
  completeness: string | null;
  errors: string[];
  /** Snapshot clocks from agent/Expert when present (E3-005). */
  brokerTime: number | null;
  gmtTime: number | null;
  retrievedAt: string | null;
  placesOrders: false;
  mutatesBroker: false;
  acceptsForExecution: false;
}

const memCache = new Map<string, { at: number; result: HfmHistoricalResult }>();
const MEM_CACHE_TTL_MS = 60_000;
const MEM_CACHE_MAX = 64;

function cacheKey(symbol: string, timeframe: string, startPos: number): string {
  return `HFM_MT5:${symbol}:${timeframe}:${startPos}`;
}

function pruneCache(): void {
  if (memCache.size <= MEM_CACHE_MAX) return;
  const entries = [...memCache.entries()].sort((a, b) => a[1].at - b[1].at);
  for (const [k] of entries.slice(0, entries.length - MEM_CACHE_MAX)) {
    memCache.delete(k);
  }
}

function asFiniteSec(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v > 1e11) return null;
  return Math.trunc(v);
}

export function validateAndNormalizeBars(
  raw: unknown[],
  opts?: {
    provenance?: "native" | "cached";
    timestampObservedAt?: string | null;
    brokerTime?: number | null;
    gmtTime?: number | null;
  },
): { bars: HfmHistoricalBar[]; rejected: number } {
  const provenance = opts?.provenance ?? "native";
  const bare: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    tickVolume: number | null;
    realVolume: number | null;
    spread: number | null;
    validationStatus: "ok" | "rejected";
    provenance: "native" | "cached";
  }> = [];
  let rejected = 0;
  let lastTime = -1;
  for (const row of raw) {
    if (!row || typeof row !== "object") {
      rejected += 1;
      continue;
    }
    const r = row as Record<string, unknown>;
    // Refuse double-normalization: if a row already carries trusted UTC and claims
    // brokerOpenTime separately, prefer brokerOpenTime / time as broker domain.
    const timeRaw =
      typeof r.brokerOpenTime === "number"
        ? r.brokerOpenTime
        : typeof r.time === "number"
          ? r.time
          : Number(r.time);
    const open = typeof r.open === "number" ? r.open : Number(r.open);
    const high = typeof r.high === "number" ? r.high : Number(r.high);
    const low = typeof r.low === "number" ? r.low : Number(r.low);
    const close = typeof r.close === "number" ? r.close : Number(r.close);
    if (!isValidOhlcCandle({ time: timeRaw, open, high, low, close }) || timeRaw <= lastTime) {
      rejected += 1;
      continue;
    }
    lastTime = timeRaw;
    bare.push({
      time: timeRaw,
      open,
      high,
      low,
      close,
      tickVolume: typeof r.tickVolume === "number" ? r.tickVolume : null,
      realVolume: typeof r.realVolume === "number" ? r.realVolume : null,
      spread: typeof r.spread === "number" ? r.spread : null,
      validationStatus: "ok",
      provenance,
    });
  }

  const enriched = enrichBarsWithCandleTimeProvenance(bare, {
    timestampSource: "mt5_copyrates",
    timestampObservedAt: opts?.timestampObservedAt ?? null,
    preferLiveOffset: false,
    clock:
      opts?.brokerTime != null || opts?.gmtTime != null
        ? { brokerTime: opts.brokerTime ?? null, gmtTime: opts.gmtTime ?? null }
        : null,
  });
  return { bars: enriched as HfmHistoricalBar[], rejected };
}

export async function fetchHfmHistoricalCandles(opts: {
  symbol: string;
  timeframe: string;
  limit?: number;
  startPos?: number;
  refresh?: boolean;
}): Promise<HfmHistoricalResult> {
  ensureHfmOffsetArchiveLoadedSync();
  const symbol = String(opts.symbol || "").trim().toUpperCase();
  const timeframe = String(opts.timeframe || "").trim();
  const limit = Math.min(300, Math.max(1, Number(opts.limit ?? 100) || 100));
  const startPos = Math.min(50000, Math.max(0, Number(opts.startPos ?? 0) || 0));
  const key = cacheKey(symbol, timeframe, startPos);
  if (!opts.refresh) {
    const hit = memCache.get(key);
    if (hit && Date.now() - hit.at < MEM_CACHE_TTL_MS) {
      return { ...hit.result, source: hit.result.source ?? "node_mem_cache", completeness: "cached" };
    }
  }

  const agentRes = await callMt5HfmAgent("demo.candles", {
    symbol,
    timeframe,
    limit,
    startPos,
    forceOndemand: Boolean(opts.refresh || startPos > 0),
  });
  const result = (agentRes.result ?? {}) as Record<string, unknown>;
  const rawBars = Array.isArray(result.candles) ? result.candles : [];
  const brokerTime = asFiniteSec(result.brokerTime);
  const gmtTime = asFiniteSec(result.gmtTime);
  const retrievedAt =
    typeof result.retrievedAt === "string"
      ? result.retrievedAt
      : typeof result.cachedAt === "string"
        ? result.cachedAt
        : null;
  const { bars, rejected } = validateAndNormalizeBars(rawBars, {
    provenance: "native",
    timestampObservedAt: retrievedAt,
    brokerTime,
    gmtTime,
  });
  const available = Boolean(agentRes.ok && result.available === true && bars.length > 0);
  const errors: string[] = [];
  if (!agentRes.ok && agentRes.code) errors.push(String(agentRes.code));
  if (typeof result.unavailableReason === "string" && result.unavailableReason) {
    errors.push(result.unavailableReason);
  }
  if (rejected > 0) errors.push(`REJECTED_BARS:${rejected}`);

  const out: HfmHistoricalResult = {
    provider: HFM_HISTORY_PROVIDER,
    environment: "demo",
    symbol,
    timeframe: typeof result.timeframe === "string" ? result.timeframe : timeframe,
    available,
    bars,
    count: bars.length,
    requestedCount: limit,
    hasMore: Boolean(result.hasMore),
    source: typeof result.source === "string" ? result.source : null,
    freshness: typeof result.freshness === "string" ? result.freshness : null,
    oldestTimestamp: bars.length ? bars[0]!.time : null,
    newestTimestamp: bars.length ? bars[bars.length - 1]!.time : null,
    completeness:
      typeof result.completeness === "string"
        ? result.completeness
        : available
          ? "broker"
          : "unavailable",
    errors,
    brokerTime,
    gmtTime,
    retrievedAt,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
  };
  if (available) {
    memCache.set(key, { at: Date.now(), result: out });
    pruneCache();
  }
  return out;
}

export function resetHfmHistoricalEngineForTests(): void {
  memCache.clear();
}
