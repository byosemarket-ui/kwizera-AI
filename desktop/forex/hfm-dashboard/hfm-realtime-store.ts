/**
 * Shared HFM MT5 realtime store — one SSE connection for the dashboard.
 */
import { useSyncExternalStore } from "react";
import { connectHfmMt5Sse } from "./hfm-sse-client";
import {
  emptyHfmRealtimeState,
  type HfmAccountState,
  type HfmCandleBar,
  type HfmCandleTf,
  type HfmEventEnvelope,
  type HfmFreshness,
  type HfmQuoteState,
  type HfmRealtimeState,
  type HfmSseEventType,
} from "./types";
import { isValidOhlcCandle, isValidQuoteTick } from "../../../ai/market-data/mt5-hfm/freshness";

const DEFAULT_SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "USDCAD", "AUDUSD", "NZDUSD", "XAUUSD", "XAGUSD"];

let state: HfmRealtimeState = emptyHfmRealtimeState();
const listeners = new Set<() => void>();
let refCount = 0;
let abort: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let lastEventId: string | null = null;

function emit(): void {
  for (const l of listeners) l();
}

function setState(patch: Partial<HfmRealtimeState>): void {
  state = { ...state, ...patch };
  emit();
}

function asAccount(raw: unknown): HfmAccountState | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  return {
    loginExact: typeof a.loginExact === "string" ? a.loginExact : null,
    loginHint: typeof a.loginHint === "string" ? a.loginHint : null,
    server: typeof a.server === "string" ? a.server : null,
    currency: typeof a.currency === "string" ? a.currency : null,
    balance: num(a.balance),
    equity: num(a.equity),
    freeMargin: num(a.freeMargin),
    usedMargin: num(a.usedMargin),
    marginLevel: num(a.marginLevel),
    leverage: (a.leverage as string | number | null) ?? null,
    openPositionsCount: num(a.openPositionsCount),
    pendingOrdersCount: num(a.pendingOrdersCount),
    connectionStatus: typeof a.connectionStatus === "string" ? a.connectionStatus : null,
    company: typeof a.company === "string" ? a.company : null,
  };
}

function mapQuoteFreshness(q: Record<string, unknown>, fallback: HfmFreshness): HfmFreshness {
  const status = typeof q.status === "string" ? q.status : null;
  const snap = typeof q.snapshotFreshness === "string" ? q.snapshotFreshness : null;
  const fromSnap = snap as HfmFreshness | null;
  if (fromSnap === "LIVE" || fromSnap === "STALE" || fromSnap === "MARKET_CLOSED" || fromSnap === "WAITING_FOR_DATA" || fromSnap === "DISCONNECTED" || fromSnap === "DATA_UNAVAILABLE") {
    return fromSnap;
  }
  switch (status) {
    case "LIVE":
    case "INCOMPLETE":
      return fallback === "MARKET_CLOSED" ? "MARKET_CLOSED" : "LIVE";
    case "STALE":
    case "DELAYED":
      return "STALE";
    case "MARKET_CLOSED":
      return "MARKET_CLOSED";
    case "NO_QUOTE":
    case "WAITING_FOR_DATA":
      return "WAITING_FOR_DATA";
    case "INVALID":
      return "DATA_UNAVAILABLE";
    case "ERROR":
      return "STALE";
    default:
      return fallback;
  }
}

function applyQuote(q: Record<string, unknown>, freshness: HfmFreshness): void {
  // Snapshot may include NO_QUOTE / INVALID rows — never invent prices as LIVE.
  const status = typeof q.status === "string" ? q.status : null;
  if (status === "NO_QUOTE" || status === "INVALID") {
    const symbol = typeof q.symbol === "string" ? q.symbol.toUpperCase() : "";
    if (!symbol) return;
    const prev = state.quotes[symbol];
    if (!prev) return; // Keep UI empty rather than showing fabricated zeros.
    state = {
      ...state,
      quotes: {
        ...state.quotes,
        [symbol]: {
          ...prev,
          freshness: mapQuoteFreshness(q, freshness),
          status,
        },
      },
    };
    return;
  }
  if (!isValidQuoteTick(q)) return;
  const symbol = String(q.symbol).toUpperCase();
  const bid = Number(q.bid);
  const ask = Number(q.ask);
  const mid = (bid + ask) / 2;
  const prev = state.quotes[symbol];
  const next: HfmQuoteState = {
    symbol,
    bid,
    ask,
    last: typeof q.last === "number" ? q.last : null,
    spread: typeof q.spread === "number" ? q.spread : ask - bid,
    digits: typeof q.digits === "number" ? q.digits : null,
    point: typeof q.point === "number" ? q.point : null,
    tickTime: typeof q.tickTime === "number" ? q.tickTime : null,
    tickVolume: typeof q.tickVolume === "number" ? q.tickVolume : null,
    freshness: mapQuoteFreshness(q, freshness),
    status,
    prevMid: prev ? (prev.bid + prev.ask) / 2 : null,
  };
  // Skip identical tick
  if (
    prev &&
    prev.bid === next.bid &&
    prev.ask === next.ask &&
    prev.tickTime === next.tickTime
  ) {
    return;
  }
  void mid;
  state = {
    ...state,
    quotes: { ...state.quotes, [symbol]: next },
  };
}

function mergeCandles(raw: unknown): void {
  if (!raw || typeof raw !== "object") return;
  const root = raw as Record<string, unknown>;
  const next: typeof state.candles = { ...state.candles };
  for (const [sym, tfs] of Object.entries(root)) {
    if (!tfs || typeof tfs !== "object") continue;
    const symKey = sym.toUpperCase();
    const outTfs = { ...(next[symKey] ?? {}) };
    for (const [tf, bars] of Object.entries(tfs as Record<string, unknown>)) {
      if (!Array.isArray(bars)) continue;
      const valid: HfmCandleBar[] = [];
      for (const b of bars) {
        if (!b || typeof b !== "object") continue;
        if (!isValidOhlcCandle(b as never)) continue;
        const row = b as Record<string, unknown>;
        valid.push({
          time: Number(row.time),
          open: Number(row.open),
          high: Number(row.high),
          low: Number(row.low),
          close: Number(row.close),
          tickVolume: typeof row.tickVolume === "number" ? row.tickVolume : undefined,
          realVolume: typeof row.realVolume === "number" ? row.realVolume : undefined,
          spread: typeof row.spread === "number" ? row.spread : undefined,
        });
      }
      if (valid.length) outTfs[tf as HfmCandleTf] = valid;
    }
    next[symKey] = outTfs;
  }
  state = { ...state, candles: next };
}

function applyEnvelope(type: HfmSseEventType, envelope: HfmEventEnvelope): void {
  const seq = envelope.seq;
  if (typeof seq === "number" && state.lastSeq != null && seq < state.lastSeq) {
    // Ignore out-of-order older seq for incremental quote/account noise
    if (type === "quote" || type === "account") return;
  }

  const freshness = envelope.freshness ?? state.freshness;
  const connectionState = envelope.connectionState ?? state.connectionState;
  const now = Date.now();
  const data = envelope.data;

  if (type === "hello") {
    const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    setState({
      freshness,
      connectionState,
      lastEventAt: now,
      subscriberId: typeof d.subscriberId === "string" ? d.subscriberId : state.subscriberId,
      lastError: null,
    });
    return;
  }

  if (type === "heartbeat") {
    setState({
      freshness,
      connectionState,
      lastHeartbeatAt: now,
      lastEventAt: now,
      lastSeq: typeof seq === "number" ? seq : state.lastSeq,
    });
    return;
  }

  if (type === "snapshot") {
    const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const account = asAccount(d.account);
    const quotesArr = Array.isArray(d.quotes) ? d.quotes : [];
    for (const q of quotesArr) {
      if (q && typeof q === "object") applyQuote(q as Record<string, unknown>, freshness);
    }
    setState({
      freshness,
      connectionState,
      lastEventAt: now,
      lastSeq: typeof seq === "number" ? seq : state.lastSeq,
      account: account ?? state.account,
      ageSec: typeof d.ageSec === "number" ? d.ageSec : state.ageSec,
      terminalRunning: typeof d.terminalRunning === "boolean" ? d.terminalRunning : state.terminalRunning,
      authenticated: typeof d.authenticated === "boolean" ? d.authenticated : state.authenticated,
      lastError: null,
    });
    return;
  }

  if (type === "account") {
    const account = asAccount(data);
    if (!account) return;
    setState({
      account,
      freshness,
      connectionState,
      lastEventAt: now,
      lastSeq: typeof seq === "number" ? seq : state.lastSeq,
    });
    return;
  }

  if (type === "quote") {
    if (data && typeof data === "object") {
      applyQuote(data as Record<string, unknown>, freshness);
      setState({
        freshness,
        connectionState,
        lastEventAt: now,
        lastSeq: typeof seq === "number" ? seq : state.lastSeq,
      });
    }
    return;
  }

  if (type === "candles") {
    const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    mergeCandles(d.symbols ?? d);
    setState({
      freshness,
      connectionState,
      lastEventAt: now,
      lastSeq: typeof seq === "number" ? seq : state.lastSeq,
    });
    return;
  }

  if (type === "subscription" || type === "freshness" || type === "recovery") {
    // Lifecycle events update connection/freshness presentation without inventing quotes.
    setState({
      freshness,
      connectionState,
      lastEventAt: now,
      lastSeq: typeof seq === "number" ? seq : state.lastSeq,
    });
    return;
  }

  if (type === "state" || type === "error") {
    const d = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    setState({
      freshness: (typeof d.freshness === "string" ? d.freshness : freshness) as HfmFreshness,
      connectionState,
      lastEventAt: now,
      lastSeq: typeof seq === "number" ? seq : state.lastSeq,
      ageSec: typeof d.ageSec === "number" ? d.ageSec : state.ageSec,
      terminalRunning: typeof d.terminalRunning === "boolean" ? d.terminalRunning : state.terminalRunning,
      terminalConnected:
        typeof d.terminalConnected === "boolean" ? d.terminalConnected : state.terminalConnected,
      authenticated: typeof d.authenticated === "boolean" ? d.authenticated : state.authenticated,
      placesOrders: d.placesOrders === true,
      acceptsForExecution: d.acceptsForExecution === true,
      mutatesBroker: d.mutatesBroker === true,
      lastError: type === "error" ? String(d.code ?? d.message ?? "stream error") : state.lastError,
    });
  }
}

function clearReconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  clearReconnect();
  if (refCount <= 0) return;
  reconnectAttempt += 1;
  const base = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt, 4));
  const jitter = Math.floor(base * 0.2 * Math.random());
  const delay = base + jitter;
  setState({ sseStatus: "reconnecting" });
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    startLoop();
  }, delay);
}

function startLoop(): void {
  clearReconnect();
  if (abort) {
    abort.abort();
    abort = null;
  }
  const controller = new AbortController();
  abort = controller;

  void connectHfmMt5Sse(
    {
      onEvent: (type, envelope) => {
        reconnectAttempt = 0;
        if (typeof envelope.eventId === "string") lastEventId = envelope.eventId;
        applyEnvelope(type, envelope);
      },
      onStatus: (status, detail) => {
        if (status === "connected") {
          setState({ sseStatus: "connected", lastError: null });
          return;
        }
        if (status === "connecting") {
          setState({ sseStatus: "connecting" });
          return;
        }
        if (status === "auth_required") {
          setState({
            sseStatus: "auth_required",
            lastError: detail ?? "Auth required",
            freshness: "WAITING_FOR_DATA",
            connectionState: "waiting",
          });
          return;
        }
        if (status === "reconnecting" || status === "error") {
          setState({
            sseStatus: status === "error" ? "error" : "reconnecting",
            lastError: detail ?? state.lastError,
            // Mark feed degraded — never keep LIVE after disconnect
            freshness:
              state.freshness === "LIVE" || state.freshness === "MARKET_CLOSED"
                ? "STALE"
                : state.freshness,
            connectionState: "degraded",
          });
          if (!controller.signal.aborted) scheduleReconnect();
        }
      },
    },
    {
      symbols: DEFAULT_SYMBOLS,
      includeCandles: true,
      signal: controller.signal,
      lastEventId,
    },
  ).then((id) => {
    if (id) lastEventId = id;
    if (!controller.signal.aborted && refCount > 0) scheduleReconnect();
  });
}

export function retainHfmRealtimeStore(): () => void {
  refCount += 1;
  if (refCount === 1) startLoop();
  return () => {
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      clearReconnect();
      abort?.abort();
      abort = null;
      reconnectAttempt = 0;
      lastEventId = null;
      state = emptyHfmRealtimeState();
      emit();
    }
  };
}

export function getHfmRealtimeSnapshot(): HfmRealtimeState {
  return state;
}

export function subscribeHfmRealtime(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useHfmRealtimeStore(): HfmRealtimeState {
  return useSyncExternalStore(subscribeHfmRealtime, getHfmRealtimeSnapshot, emptyHfmRealtimeState);
}

export function restartHfmRealtimeStore(): void {
  if (refCount <= 0) return;
  reconnectAttempt = 0;
  startLoop();
}
