/**
 * STEP 2/3 — Live OHLC aggregation from HFM bid ticks (matches CopyRates FX basis).
 * Does not invent candles on timer alone — requires a valid tick in the interval.
 * Supports verified chart timeframes with broker-aligned buckets from history anchors.
 * Engine 3 — attaches candle time provenance (broker vs UTC) without altering OHLC.
 */
import type { HfmHistoricalBar } from "./historical-engine.js";
import {
  normalizeHfmCandleOpenTime,
  type HfmCandleTimeProvenance,
  withCandleTimeProvenance,
} from "./candle-timestamp.js";

export type HfmLivePriceBasis = "bid";

/**
 * Timeframes with verified CopyRates + live forming aggregation (STEP 3 / 1C.2).
 * All twelve required acquisition TFs. W1 forming requires a CopyRates anchor
 * (broker week open); epoch Monday fallback is intentionally not used.
 */
export const HFM_VERIFIED_LIVE_TFS = [
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

export type HfmVerifiedLiveTf = (typeof HFM_VERIFIED_LIVE_TFS)[number];

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

export interface HfmFormingCandle extends HfmCandleTimeProvenance {
  provider: "HFM_MT5";
  symbol: string;
  timeframe: string;
  /** Broker-domain candle-open seconds (compatibility). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  tickVolume: number;
  closed: false;
  priceBasis: HfmLivePriceBasis;
  /** Broker-domain last tick seconds — NOT UTC. */
  lastTickTime: number;
  receiveTimestamp: string;
}

function attachLiveProvenance<T extends { time: number; receiveTimestamp?: string }>(
  candle: T,
): T & HfmCandleTimeProvenance {
  const prov = normalizeHfmCandleOpenTime({
    brokerOpenTime: candle.time,
    timestampSource: "mt5_live_forming",
    timestampObservedAt: candle.receiveTimestamp ?? null,
    preferLiveOffset: true,
  });
  return withCandleTimeProvenance(candle, prov);
}

export interface HfmCandleUpdateEvent {
  type: "candle_update" | "candle_finalized";
  candle: HfmFormingCandle | (HfmHistoricalBar & { closed: true; symbol: string; timeframe: string });
}

export function timeframeSeconds(timeframe: string): number | null {
  const tf = timeframe.toUpperCase();
  if (tf === "MN1" || tf === "1M") return null;
  return TF_SECONDS[tf] ?? null;
}

export function isVerifiedLiveTimeframe(tf: string): boolean {
  return (HFM_VERIFIED_LIVE_TFS as readonly string[]).includes(tf.toUpperCase());
}

/**
 * Epoch-aligned bucket (fallback). Prefer resolveFormingBucket with a CopyRates anchor
 * for H4/D1 so broker server-time opens are preserved.
 */
export function bucketStart(timeSec: number, timeframe: string): number | null {
  const tf = timeframe.toUpperCase();
  const sec = TF_SECONDS[tf];
  if (!sec) {
    if (tf === "MN1" || tf === "1M") {
      const d = new Date(timeSec * 1000);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000;
    }
    return null;
  }
  if (tf === "W1") {
    const day = Math.floor(timeSec / 86400);
    const dow = (day + 4) % 7;
    return (day - dow) * 86400;
  }
  return Math.floor(timeSec / sec) * sec;
}

/**
 * Resolve forming candle open time using an optional broker CopyRates anchor.
 * When `anchorTime` is the last historical bar open, ticks stay on that bar until
 * `anchorTime + tfSeconds`, then step forward on the same grid (broker-aligned).
 *
 * W1 without a CopyRates anchor returns null — MT5 weekly opens are broker-defined
 * and must not be invented from a UTC Monday heuristic.
 */
export function resolveFormingBucket(
  timeSec: number,
  timeframe: string,
  anchorTime: number | null | undefined,
): number | null {
  const tf = timeframe.toUpperCase();
  const sec = timeframeSeconds(tf);
  if (sec == null) return bucketStart(timeSec, tf);
  if (typeof anchorTime === "number" && Number.isFinite(anchorTime) && anchorTime > 0) {
    if (timeSec < anchorTime) return null;
    const steps = Math.floor((timeSec - anchorTime) / sec);
    return anchorTime + steps * sec;
  }
  if (tf === "W1") return null;
  return bucketStart(timeSec, tf);
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
  /** Broker CopyRates bar-open anchors per symbol:tf (preserve H4/D1 boundaries). */
  private readonly anchors = new Map<string, number>();

  private key(symbol: string, timeframe: string): string {
    return `${symbol.toUpperCase()}:${timeframe.toUpperCase()}`;
  }

  getForming(symbol: string, timeframe: string): HfmFormingCandle | null {
    return this.forming.get(this.key(symbol, timeframe)) ?? null;
  }

  getAnchor(symbol: string, timeframe: string): number | null {
    return this.anchors.get(this.key(symbol, timeframe)) ?? null;
  }

  /**
   * Seed forming candle from the last CopyRates bar (current incomplete bar).
   * Sets the broker-aligned anchor grid for subsequent ticks.
   */
  seedFromHistory(
    symbol: string,
    timeframe: string,
    history: HfmHistoricalBar[],
  ): HfmFormingCandle | null {
    if (!history.length) return this.getForming(symbol, timeframe);
    const last = history[history.length - 1]!;
    const k = this.key(symbol, timeframe);
    this.anchors.set(k, last.time);
    const existing = this.forming.get(k);
    if (existing && existing.time === last.time) {
      existing.open = last.open;
      existing.high = Math.max(last.high, existing.high);
      existing.low = Math.min(last.low, existing.low);
      if (existing.lastTickTime <= last.time) existing.close = last.close;
      this.forming.set(k, existing);
      return existing;
    }
    if (existing && existing.time > last.time) {
      // Live already advanced past history tip — keep live, refresh anchor grid from live.
      this.anchors.set(k, existing.time);
      return existing;
    }
    const seeded = attachLiveProvenance({
      provider: "HFM_MT5" as const,
      symbol: symbol.toUpperCase(),
      timeframe: timeframe.toUpperCase(),
      time: last.time,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      tickVolume: typeof last.tickVolume === "number" ? last.tickVolume : 0,
      closed: false as const,
      priceBasis: "bid" as const,
      lastTickTime: last.time,
      receiveTimestamp: new Date().toISOString(),
    });
    this.forming.set(k, seeded);
    return seeded;
  }

  /** Apply one validated bid tick; may finalize previous bucket. */
  applyTick(
    tick: HfmValidatedTick,
    timeframe: string,
  ): HfmCandleUpdateEvent[] {
    if (!isValidHfmTick(tick)) return [];
    const dedupeKey = `${tick.symbol}|${tick.timeMsc ?? tick.timeSec}|${tick.bid}|${tick.ask}`;
    const tfKey = `${tick.symbol.toUpperCase()}|${timeframe.toUpperCase()}`;
    const prevKey = this.lastTickKey.get(tfKey);
    if (prevKey === dedupeKey) return [];
    this.lastTickKey.set(tfKey, dedupeKey);

    const k = this.key(tick.symbol, timeframe);
    const anchor = this.anchors.get(k) ?? this.forming.get(k)?.time ?? null;
    const start = resolveFormingBucket(tick.timeSec, timeframe, anchor);
    if (start == null) return [];
    const price = tick.bid;
    const events: HfmCandleUpdateEvent[] = [];
    const current = this.forming.get(k);

    if (current && current.time !== start) {
      const finalizedProv = normalizeHfmCandleOpenTime({
        brokerOpenTime: current.time,
        timestampSource: "mt5_live_forming",
        timestampObservedAt: current.receiveTimestamp,
        preferLiveOffset: true,
      });
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
          ...finalizedProv,
          brokerOpenTime: current.time,
        },
      });
      this.forming.delete(k);
      this.anchors.set(k, start);
    } else if (!this.anchors.has(k)) {
      this.anchors.set(k, start);
    }

    let candle = this.forming.get(k);
    if (!candle) {
      candle = attachLiveProvenance({
        provider: "HFM_MT5" as const,
        symbol: tick.symbol.toUpperCase(),
        timeframe: timeframe.toUpperCase(),
        time: start,
        open: price,
        high: price,
        low: price,
        close: price,
        tickVolume: 1,
        closed: false as const,
        priceBasis: "bid" as const,
        lastTickTime: tick.timeSec,
        receiveTimestamp: new Date(tick.receiveMs).toISOString(),
      });
    } else {
      candle.high = Math.max(candle.high, price);
      candle.low = Math.min(candle.low, price);
      candle.close = price;
      candle.tickVolume += 1;
      candle.lastTickTime = tick.timeSec;
      candle.receiveTimestamp = new Date(tick.receiveMs).toISOString();
      Object.assign(
        candle,
        normalizeHfmCandleOpenTime({
          brokerOpenTime: candle.time,
          timestampSource: "mt5_live_forming",
          timestampObservedAt: candle.receiveTimestamp,
          preferLiveOffset: true,
        }),
      );
      candle.brokerOpenTime = candle.time;
    }
    this.forming.set(k, candle);
    events.push({ type: "candle_update", candle: { ...candle } });
    return events;
  }

  /**
   * Apply one tick across all verified live timeframes (bounded SSE in hub).
   */
  applyTickVerifiedTimeframes(tick: HfmValidatedTick): HfmCandleUpdateEvent[] {
    const out: HfmCandleUpdateEvent[] = [];
    for (const tf of HFM_VERIFIED_LIVE_TFS) {
      out.push(...this.applyTick(tick, tf));
    }
    return out;
  }

  /**
   * Reconcile forming candle against broker CopyRates last bar.
   * Prefer broker OHLC for closed bars; keep forming if timestamps match.
   * Seeds forming when missing.
   */
  reconcileWithHistory(
    symbol: string,
    timeframe: string,
    history: HfmHistoricalBar[],
  ): HfmFormingCandle | null {
    if (history.length === 0) return this.getForming(symbol, timeframe);
    const forming = this.getForming(symbol, timeframe);
    if (!forming) return this.seedFromHistory(symbol, timeframe, history);
    const last = history[history.length - 1]!;
    const k = this.key(symbol, timeframe);
    this.anchors.set(k, last.time <= forming.time ? forming.time : last.time);
    if (last.time === forming.time) {
      forming.open = last.open;
      forming.high = Math.max(last.high, forming.high);
      forming.low = Math.min(last.low, forming.low);
      if (forming.lastTickTime <= last.time) {
        forming.close = last.close;
      }
      this.forming.set(k, forming);
    } else if (last.time > forming.time) {
      // History advanced past stale forming — reseeds.
      return this.seedFromHistory(symbol, timeframe, history);
    }
    return forming;
  }

  clear(symbol?: string, timeframe?: string): void {
    if (!symbol) {
      this.forming.clear();
      this.lastTickKey.clear();
      this.anchors.clear();
      return;
    }
    if (timeframe) {
      const k = this.key(symbol, timeframe);
      this.forming.delete(k);
      this.anchors.delete(k);
      return;
    }
    const prefix = `${symbol.toUpperCase()}:`;
    for (const k of [...this.forming.keys()]) {
      if (k.startsWith(prefix)) this.forming.delete(k);
    }
    for (const k of [...this.anchors.keys()]) {
      if (k.startsWith(prefix)) this.anchors.delete(k);
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
