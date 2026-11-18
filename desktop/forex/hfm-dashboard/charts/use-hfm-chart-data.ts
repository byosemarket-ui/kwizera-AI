import { useEffect, useRef, useState } from "react";
import { useHfmRealtimeStore } from "../hfm-realtime-store";
import {
  fetchHfmChartsCandles,
  fetchHfmChartsQuote,
  fetchHfmLiveCandle,
  setHfmChartsQuoteWatch,
  type HfmChartsHistoryResult,
} from "./api";
import {
  applyBidToFormingCandle,
  isLiveFormingTimeframe,
  seedFormingFromBar,
} from "./live-forming";
import type { HfmChartCandle, HfmChartDataStatus, HfmChartTimeframe } from "./types";

export interface HfmChartQuoteView {
  bid: number | null;
  ask: number | null;
  spread: number | null;
  digits: number | null;
  tickTime: number | null;
  receivedAt: string | null;
  change: number | null;
  changePct: number | null;
}

export interface HfmChartSeriesState {
  symbol: string;
  timeframe: HfmChartTimeframe;
  bars: HfmChartCandle[];
  forming: HfmChartCandle | null;
  status: HfmChartDataStatus;
  historyStatus: HfmChartDataStatus;
  liveStatus: HfmChartDataStatus;
  source: string | null;
  freshness: string | null;
  error: string | null;
  quote: HfmChartQuoteView;
  hasMore: boolean;
  loadingMore: boolean;
  loadOlder: () => void;
  refresh: () => void;
}

function mapFreshnessToStatus(f: string | null | undefined, fallback: HfmChartDataStatus): HfmChartDataStatus {
  switch (f) {
    case "LIVE":
      return "CONNECTED";
    case "STALE":
      return "STALE";
    case "DELAYED":
      return "DELAYED";
    case "DISCONNECTED":
      return "DISCONNECTED";
    case "WAITING_FOR_DATA":
      return "LOADING";
    case "DATA_UNAVAILABLE":
    case "NO_HISTORY":
      return "UNAVAILABLE";
    case "INVALID":
      return "INVALID";
    default:
      return fallback;
  }
}

function mergeForming(bars: HfmChartCandle[], forming: HfmChartCandle | null): HfmChartCandle[] {
  if (!forming) return bars;
  if (bars.length === 0) return [{ ...forming, closed: false }];
  const last = bars[bars.length - 1]!;
  if (forming.time === last.time) {
    return [...bars.slice(0, -1), { ...forming, closed: false }];
  }
  if (forming.time > last.time) {
    return [...bars, { ...forming, closed: false }];
  }
  return bars;
}

function unionForming(seed: HfmChartCandle, live: HfmChartCandle | null): HfmChartCandle {
  if (!live || live.time !== seed.time) return { ...seed, closed: false };
  return {
    ...seed,
    open: seed.open,
    high: Math.max(seed.high, live.high),
    low: Math.min(seed.low, live.low),
    close: live.close,
    tickVolume: Math.max(seed.tickVolume ?? 0, live.tickVolume ?? 0),
    spread: live.spread ?? seed.spread,
    closed: false,
  };
}

export function useHfmChartData(symbol: string, timeframe: HfmChartTimeframe): HfmChartSeriesState {
  const realtime = useHfmRealtimeStore();
  const [history, setHistory] = useState<HfmChartsHistoryResult | null>(null);
  const [forming, setForming] = useState<HfmChartCandle | null>(null);
  const [quote, setQuote] = useState<HfmChartQuoteView>({
    bid: null,
    ask: null,
    spread: null,
    digits: null,
    tickTime: null,
    receivedAt: null,
    change: null,
    changePct: null,
  });
  const [status, setStatus] = useState<HfmChartDataStatus>("LOADING");
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [startPos, setStartPos] = useState(0);
  const genRef = useRef(0);
  const barsRef = useRef<HfmChartCandle[]>([]);
  const formingRef = useRef<HfmChartCandle | null>(null);
  const lastTickKeyRef = useRef<string>("");
  const liveCapable = isLiveFormingTimeframe(timeframe);

  useEffect(() => {
    formingRef.current = forming;
  }, [forming]);

  const load = async (opts?: { refresh?: boolean; append?: boolean; pos?: number }) => {
    const gen = ++genRef.current;
    const pos = opts?.pos ?? 0;
    if (!opts?.append) setStatus("LOADING");
    else setLoadingMore(true);
    try {
      const result = await fetchHfmChartsCandles({
        symbol,
        timeframe,
        limit: 200,
        startPos: pos,
        refresh: Boolean(opts?.refresh || pos > 0),
      });
      if (gen !== genRef.current) return;
      if (!result.available) {
        setHistory(result);
        barsRef.current = [];
        setForming(null);
        formingRef.current = null;
        setStatus(result.errors.length ? "UNAVAILABLE" : "EMPTY");
        setError(result.errors[0] ?? "No HFM historical candles for this symbol/timeframe.");
        return;
      }
      if (opts?.append && history) {
        const older = result.bars;
        const mergedMap = new Map<number, HfmChartCandle>();
        for (const b of [...older, ...barsRef.current]) mergedMap.set(b.time, b);
        const merged = [...mergedMap.values()].sort((a, b) => a.time - b.time);
        barsRef.current = merged;
        setHistory({
          ...result,
          bars: merged,
          count: merged.length,
          available: merged.length > 0,
        });
      } else {
        barsRef.current = result.bars;
        setHistory(result);
        const tip = result.bars[result.bars.length - 1] ?? null;
        const seeded =
          result.currentCandle
            ? { ...result.currentCandle, closed: false as const }
            : tip
              ? seedFormingFromBar(tip)
              : null;
        // Do not let an older REST tip overwrite a newer live forming candle.
        const live = formingRef.current;
        const next =
          seeded && live && live.time === seeded.time
            ? unionForming(seeded, live)
            : live && seeded && live.time > seeded.time
              ? live
              : seeded;
        setForming(next);
        formingRef.current = next;
      }
      setError(null);
      setStatus(mapFreshnessToStatus(result.freshness, "CONNECTED"));
      setStartPos(pos);
    } catch (err) {
      if (gen !== genRef.current) return;
      setStatus("UNAVAILABLE");
      setError(err instanceof Error ? err.message : "HFM candle request failed");
    } finally {
      if (gen === genRef.current) setLoadingMore(false);
    }
  };

  useEffect(() => {
    genRef.current += 1;
    barsRef.current = [];
    formingRef.current = null;
    lastTickKeyRef.current = "";
    setHistory(null);
    setForming(null);
    setStartPos(0);
    void setHfmChartsQuoteWatch([symbol]).catch(() => undefined);
    void load({ refresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe]);

  useEffect(() => {
    let cancelled = false;
    const pullQuote = async () => {
      const q = await fetchHfmChartsQuote(symbol);
      if (cancelled || !q) return;
      const closes = barsRef.current;
      const ref = closes.length >= 2 ? closes[closes.length - 2]!.close : closes[0]?.open ?? null;
      const last = q.bid ?? q.ask;
      let change: number | null = null;
      let changePct: number | null = null;
      if (last != null && ref != null && ref > 0) {
        change = last - ref;
        changePct = (change / ref) * 100;
      }
      setQuote({ ...q, change, changePct });
    };
    void pullQuote();
    const id = window.setInterval(() => void pullQuote(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol, timeframe]);

  // Merge SSE quote for selected symbol → update Bid/Ask AND forming candle (all verified TFs).
  useEffect(() => {
    const sq = realtime.quotes[symbol.toUpperCase()];
    if (!sq || sq.bid == null || sq.ask == null) return;
    setQuote((prev) => ({
      ...prev,
      bid: sq.bid,
      ask: sq.ask,
      spread: sq.spread,
      digits: sq.digits ?? prev.digits,
      tickTime: sq.tickTime,
      receivedAt: sq.receivedAt ?? prev.receivedAt,
    }));
    if (!liveCapable) return;
    if (!(sq.bid > 0) || typeof sq.tickTime !== "number" || !(sq.tickTime > 0)) return;
    const dedupe = `${symbol}|${timeframe}|${sq.tickTime}|${sq.bid}|${sq.ask}`;
    if (dedupe === lastTickKeyRef.current) return;
    lastTickKeyRef.current = dedupe;
    setForming((prev) => {
      const tip = barsRef.current[barsRef.current.length - 1] ?? null;
      const next = applyBidToFormingCandle(prev, sq.bid!, sq.tickTime!, timeframe, {
        anchorTime: prev?.time ?? tip?.time ?? null,
        spread: sq.spread,
      });
      formingRef.current = next;
      return next;
    });
  }, [realtime.quotes, symbol, timeframe, liveCapable]);

  // Poll live-candle API for server-side reconciliation (all verified TFs).
  useEffect(() => {
    if (!liveCapable) return;
    let cancelled = false;
    const tick = async () => {
      const live = await fetchHfmLiveCandle(symbol, timeframe);
      if (cancelled || !live) return;
      setForming((prev) => {
        const next = unionForming(live, prev);
        // Prefer live close/high/low when server is newer tip on same bucket.
        if (prev && prev.time === live.time) {
          const merged = {
            ...live,
            high: Math.max(live.high, prev.high),
            low: Math.min(live.low, prev.low),
            close: prev.close,
            closed: false as const,
          };
          formingRef.current = merged;
          return merged;
        }
        if (prev && prev.time > live.time) {
          formingRef.current = prev;
          return prev;
        }
        formingRef.current = next;
        return next;
      });
    };
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [symbol, timeframe, liveCapable]);

  const feedStatus: HfmChartDataStatus =
    realtime.connectionState === "disconnected" || realtime.freshness === "DISCONNECTED"
      ? "DISCONNECTED"
      : realtime.connectionState === "waiting"
        ? "RECONNECTING"
        : mapFreshnessToStatus(realtime.freshness, status);

  const displayBars = mergeForming(history?.bars ?? [], forming);

  return {
    symbol,
    timeframe,
    bars: displayBars,
    forming,
    status: history?.available ? feedStatus : status,
    historyStatus: history?.available ? "CONNECTED" : status,
    liveStatus: liveCapable && forming ? "CONNECTED" : feedStatus,
    source: history?.source ?? null,
    freshness: history?.freshness ?? realtime.freshness,
    error,
    quote,
    hasMore: Boolean(history?.hasMore),
    loadingMore,
    loadOlder: () => {
      if (loadingMore || !history?.hasMore) return;
      const nextPos = startPos + (history?.count || 200);
      void load({ append: true, pos: nextPos, refresh: true });
    },
    refresh: () => void load({ refresh: true }),
  };
}
