/**
 * STEP 2 — Live OHLC aggregation from HFM bid ticks (matches CopyRates FX basis).
 * Does not invent candles on timer alone — requires a valid tick in the interval.
 */
import type { HfmHistoricalBar } from "./historical-engine.js";

export type HfmLivePriceBasis = "bid";

const TF_SECONDS: Record<string, number> = {
  M1: 60,
  M2: 120,
  M3: 180,
  M5: 300,
  M10: 600,
  M15: 900,
  M20: 1200,
  M30: 1800,
  H1: 3600,
  H2: 7200,
  H3: 10800,
  H4: 14400,
  H6: 21600,
  H8: 28800,
  H12: 43200,
  D1: 86400,
  W1: 604800,
};

export interface HfmValidatedTick {
  symbol: string;
  bid: number;
  ask: number;
  last: number | null;
  timeSec: number;
  timeMsc: number | null;
  receiveMs: number;
  volume: number | null;
  flags: number | null;
  acquisition: string;
}

export interface HfmFormingCandle {
  provider: "HFM_MT5";
  symbol: string;
  timeframe: string;
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number;
  closed: false;
  priceBasis: HfmLivePriceBasis;
  lastTickTime: number;
  receiveTimestamp: string;
}

export interface HfmCandleUpdateEvent {
  type: "candle_update" | "candle_finalized";
  candle: HfmFormingCandle | (HfmHistoricalBar & { closed: true; symbol: string; timeframe: string });
}

function bucketStart(timeSec: number, timeframe: string): number | null {
  const tf = timeframe.toUpperCase();
  const sec = TF_SECONDS[tf];
  if (!sec) return null;
  if (tf === "W1") {
    // Align to Monday 00:00 UTC.
    const day = Math.floor(timeSec / 86400);
    const dow = (day + 4) % 7; // 0=Mon in this shift from Unix epoch Thursday
    return (day - dow) * 86400;
  }
  if (tf === "MN1" || tf === "1M") {
    const d = new Date(timeSec * 1000);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
  }
  return Math.floor(timeSec / sec) * sec;
}

export function isValidHfmTick(t: {
  bid?: unknown;
  ask?: unknown;
  timeSec?: unknown;
}): boolean {
  if (typeof t.bid !== "number" || typeof t.ask !== "number" || typeof t.timeSec !== "number") return false;
  if (!Number.isFinite(t.bid) || !Number.isFinite(t.ask) || !Number.isFinite(t.timeSec)) return false;
  if (t.bid <= 0 || t.ask <= 0 || t.ask < t.bid || t.timeSec <= 0) return false;
  return true;
}

/** Deduplicate / order ticks by broker timeMsc then receiveMs. */
export function normalizeTickStream(ticks: HfmValidatedTick[]): HfmValidatedTick[] {
  const sorted = [...ticks].sort((a, b) => {
    const am = a.timeMsc ?? a.timeSec * 1000;
    const bm = b.timeMsc ?? b.timeSec * 1000;
    if (am !== bm) return am - bm;
    return a.receiveMs - b.receiveMs;
  });
  const out: HfmValidatedTick[] = [];
  let lastKey = "";
  for (const t of sorted) {
    if (!isValidHfmTick(t)) continue;
    const key = `${t.symbol}|${t.timeMsc ?? t.timeSec}|${t.bid}|${t.ask}`;
    if (key === lastKey) continue;
    lastKey = key;
    out.push(t);
  }
  return out;
}

export class HfmLiveCandleEngine {
  private readonly forming = new Map<string, HfmFormingCandle>();
  private readonly lastTickKey = new Map<string, string>();

  private key(symbol: string, timeframe: string): string {
    return `${symbol.toUpperCase()}:${timeframe.toUpperCase()}`;
  }

  getForming(symbol: string, timeframe: string): HfmFormingCandle | null {
    return this.forming.get(this.key(symbol, timeframe)) ?? null;
  }

  /** Apply one validated bid tick; may finalize previous bucket. */
  applyTick(
    tick: HfmValidatedTick,
    timeframe: string,
  ): HfmCandleUpdateEvent[] {
    if (!isValidHfmTick(tick)) return [];
    const dedupeKey = `${tick.symbol}|${tick.timeMsc ?? tick.timeSec}|${tick.bid}|${tick.ask}`;
    const prevKey = this.lastTickKey.get(tick.symbol);
    if (prevKey === dedupeKey) return [];
    this.lastTickKey.set(tick.symbol, dedupeKey);

    const start = bucketStart(tick.timeSec, timeframe);
    if (start == null) return [];
    const k = this.key(tick.symbol, timeframe);
    const price = tick.bid;
    const events: HfmCandleUpdateEvent[] = [];
    const current = this.forming.get(k);

    if (current && current.time !== start) {
      events.push({
        type: "candle_finalized",
        candle: {
          time: current.time,
          open: current.open,
          high: current.high,
          low: current.low,
          close: current.close,
          tickVolume: current.tickVolume,
          realVolume: null,
          spread: null,
          validationStatus: "ok",
          provenance: "native",
          closed: true,
          symbol: current.symbol,
          timeframe: current.timeframe,
        },
      });
      this.forming.delete(k);
    }

    let candle = this.forming.get(k);
    if (!candle) {
      candle = {
        provider: "HFM_MT5",
        symbol: tick.symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase(),
        time: start,
        open: price,
        high: price,
        low: price,
        close: price,
        tickVolume: 1,
        closed: false,
        priceBasis: "bid",
        lastTickTime: tick.timeSec,
        receiveTimestamp: new Date(tick.receiveMs).toISOString(),
      };
    } else {
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.tickVolume += 1;
      candle.lastTickTime = tick.timeSec;
      candle.receiveTimestamp = new Date(tick.receiveMs).toISOString();
    }
    this.forming.set(k, candle);
    events.push({ type: "candle_update", candle: { ...candle } });
    return events;
  }

  /**
   * Reconcile forming candle against broker CopyRates last bar.
   * Prefer broker OHLC for closed bars; keep forming if timestamps match.
   */
  reconcileWithHistory(
    symbol: string,
    timeframe: string,
    history: HfmHistoricalBar[],
  ): HfmFormingCandle | null {
    const forming = this.getForming(symbol, timeframe);
    if (!forming || history.length === 0) return forming;
    const last = history[history.length - 1]!;
    if (last.time === forming.time) {
      // Broker bar may include more ticks — take union of ranges, keep live close if newer.
      forming.open = last.open;
      forming.high = Math.max(last.high, forming.high);
      forming.low = Math.min(last.low, forming.low);
      if (forming.lastTickTime <= last.time) {
        forming.close = last.close;
      }
      this.forming.set(this.key(symbol, timeframe), forming);
    }
    return forming;
  }

  clear(symbol?: string, timeframe?: string): void {
    if (!symbol) {
      this.forming.clear();
      this.lastTickKey.clear();
      return;
    }
    if (timeframe) {
      this.forming.delete(this.key(symbol, timeframe));
      return;
    }
    const prefix = `${symbol.toUpperCase()}:`;
    for (const k of [...this.forming.keys()]) {
      if (k.startsWith(prefix)) this.forming.delete(k);
    }
  }
}

let singleton: HfmLiveCandleEngine | null = null;
export function getHfmLiveCandleEngine(): HfmLiveCandleEngine {
  if (!singleton) singleton = new HfmLiveCandleEngine();
  return singleton;
}

export function resetHfmLiveCandleEngineForTests(): void {
  singleton = new HfmLiveCandleEngine();
}
