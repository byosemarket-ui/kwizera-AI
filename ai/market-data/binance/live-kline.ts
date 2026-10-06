import { buildKlineUrl, normalizeBinanceKlineEvent, toBinanceSymbol } from "./adapter.js";
import { resolveBinancePublicConfig } from "./config.js";
import type { WebSocketCtor, WebSocketLike } from "./live-ticker.js";
import type { LiveKlineSnapshot, MarketConnectionState, NormalizedTimeframeId } from "./types.js";

const CONNECT_TIMEOUT_MS = 10000;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 15000;
const STALE_CHECK_MS = 5000;

export function idleLiveKlineSnapshot(message = "Disconnected"): LiveKlineSnapshot {
  return {
    connectionState: "DISCONNECTED",
    liveMarketData: false,
    websocketActive: false,
    subscribedSymbol: null,
    timeframe: null,
    kline: null,
    message,
    errorCode: null,
    websocketHost: null,
    streamType: "kline",
    source: "binance-spot-public",
  };
}

export function liveKlineStatusLabel(snapshot: LiveKlineSnapshot): string {
  if (snapshot.liveMarketData) return "LIVE";
  switch (snapshot.connectionState) {
    case "CONNECTING":
      return "Connecting to Binance...";
    case "RECONNECTING":
      return "Reconnecting to Binance...";
    case "ERROR":
      return "Unable to load Binance market data.";
    case "CONNECTED":
      return "Connecting to Binance...";
    default:
      return snapshot.subscribedSymbol ? "Binance live data unavailable." : "Disconnected";
  }
}

export interface LiveKlineClient {
  subscribe(symbol: string | null, timeframe: NormalizedTimeframeId | null): void;
  getSnapshot(): LiveKlineSnapshot;
  onChange(listener: (snapshot: LiveKlineSnapshot) => void): () => void;
  disconnect(): void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function parseSocketData(data: unknown): unknown {
  const text = typeof data === "string" ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : String(data ?? "");
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function staleLimitMs(timeframe: NormalizedTimeframeId): number {
  const minutes: Record<NormalizedTimeframeId, number> = {
    "1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60, "4h": 240, "1d": 1440, "1w": 10080,
  };
  const intervalMs = (minutes[timeframe] ?? 60) * 60 * 1000;
  return Math.max(30_000, Math.min(intervalMs, 180_000)) * 2;
}

export function createBinanceLiveKlineClient(options: {
  env?: Record<string, string | undefined>;
  webSocketCtor?: WebSocketCtor;
  now?: () => number;
} = {}): LiveKlineClient {
  const config = resolveBinancePublicConfig(options.env);
  const WebSocketImpl = options.webSocketCtor;
  const now = options.now ?? Date.now;
  const bases = config.websocketFallbackUrls.length > 0 ? config.websocketFallbackUrls : [config.websocketBaseUrl];

  let snapshot = idleLiveKlineSnapshot(config.enabled ? "Disconnected" : "Binance live data unavailable.");
  const listeners = new Set<(snapshot: LiveKlineSnapshot) => void>();
  let socket: WebSocketLike | null = null;
  let generation = 0;
  let desiredSymbol: string | null = null;
  let desiredTimeframe: NormalizedTimeframeId | null = null;
  let hostIndex = 0;
  let backoffMs = BACKOFF_START_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setInterval> | null = null;
  let lastValidAt = 0;
  let intentionalClose = false;

  function emit(): void {
    for (const listener of listeners) listener(snapshot);
  }

  function setSnapshot(next: Partial<LiveKlineSnapshot>): void {
    const kline = next.kline === undefined ? snapshot.kline : next.kline;
    const websocketActive = next.websocketActive ?? snapshot.websocketActive;
    const subscribedSymbol = next.subscribedSymbol === undefined ? snapshot.subscribedSymbol : next.subscribedSymbol;
    const timeframe = next.timeframe === undefined ? snapshot.timeframe : next.timeframe;
    const connectionState = (next.connectionState ?? snapshot.connectionState) as MarketConnectionState;
    const live = Boolean(
      next.liveMarketData === true
      && websocketActive
      && kline
      && subscribedSymbol
      && timeframe
      && kline.symbol === subscribedSymbol
      && kline.timeframe === timeframe
      && connectionState === "CONNECTED",
    );
    snapshot = {
      ...snapshot,
      ...next,
      kline,
      websocketActive,
      subscribedSymbol,
      timeframe,
      connectionState,
      liveMarketData: live,
      streamType: "kline",
      source: "binance-spot-public",
    };
    emit();
  }

  function clearTimers(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (connectTimer) {
      clearTimeout(connectTimer);
      connectTimer = null;
    }
    if (staleTimer) {
      clearInterval(staleTimer);
      staleTimer = null;
    }
  }

  function closeSocket(): void {
    if (!socket) return;
    const current = socket;
    socket = null;
    try {
      current.close(1000, "closed");
    } catch {
      /* ignore */
    }
  }

  function watchStale(timeframe: NormalizedTimeframeId, gen: number): void {
    if (staleTimer) clearInterval(staleTimer);
    staleTimer = setInterval(() => {
      if (gen !== generation || !snapshot.liveMarketData) return;
      if (now() - lastValidAt > staleLimitMs(timeframe)) {
        scheduleReconnect("RECONNECTING", "Reconnecting to Binance...", "BINANCE_STALE");
      }
    }, STALE_CHECK_MS);
  }

  function scheduleReconnect(state: MarketConnectionState, message: string, errorCode: string | null): void {
    if (!desiredSymbol || !desiredTimeframe || !config.enabled) return;
    clearTimers();
    setSnapshot({
      connectionState: state,
      liveMarketData: false,
      websocketActive: false,
      kline: null,
      message,
      errorCode,
    });
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      openSocket(true);
    }, backoffMs);
    backoffMs = Math.min(BACKOFF_MAX_MS, backoffMs * 2);
  }

  function openSocket(isReconnect: boolean): void {
    if (!desiredSymbol || !desiredTimeframe || !config.enabled) return;
    const Ctor = WebSocketImpl ?? (typeof WebSocket !== "undefined" ? WebSocket as unknown as WebSocketCtor : null);
    if (!Ctor) {
      setSnapshot({
        connectionState: "ERROR",
        liveMarketData: false,
        websocketActive: false,
        kline: null,
        message: "Binance live data unavailable.",
        errorCode: "BINANCE_WS_UNAVAILABLE",
      });
      return;
    }
    const gen = generation;
    const symbol = desiredSymbol;
    const timeframe = desiredTimeframe;
    const base = bases[hostIndex % bases.length];
    const url = buildKlineUrl(base, symbol, timeframe);
    clearTimers();
    intentionalClose = true;
    closeSocket();
    intentionalClose = false;
    setSnapshot({
      connectionState: isReconnect ? "RECONNECTING" : "CONNECTING",
      liveMarketData: false,
      websocketActive: false,
      subscribedSymbol: symbol,
      timeframe,
      kline: null,
      message: isReconnect ? "Reconnecting to Binance..." : "Connecting to Binance...",
      errorCode: null,
      websocketHost: hostOf(url),
    });

    let opened = false;
    const next = new Ctor(url);
    socket = next;

    connectTimer = setTimeout(() => {
      if (gen !== generation || opened) return;
      hostIndex += 1;
      intentionalClose = true;
      try {
        next.close(1000, "timeout");
      } catch {
        /* ignore */
      }
      scheduleReconnect("RECONNECTING", "Reconnecting to Binance...", "BINANCE_TIMEOUT");
    }, CONNECT_TIMEOUT_MS);

    next.addEventListener("open", () => {
      if (gen !== generation || socket !== next) return;
      opened = true;
      backoffMs = BACKOFF_START_MS;
      if (connectTimer) {
        clearTimeout(connectTimer);
        connectTimer = null;
      }
      watchStale(timeframe, gen);
      setSnapshot({
        connectionState: "CONNECTED",
        liveMarketData: false,
        websocketActive: true,
        subscribedSymbol: symbol,
        timeframe,
        kline: null,
        message: "Connecting to Binance...",
        errorCode: null,
        websocketHost: hostOf(url),
      });
    });

    next.addEventListener("message", (event) => {
      if (gen !== generation || socket !== next) return;
      const kline = normalizeBinanceKlineEvent(parseSocketData(event.data), symbol, timeframe, now());
      if (!kline) return;
      lastValidAt = now();
      setSnapshot({
        connectionState: "CONNECTED",
        liveMarketData: true,
        websocketActive: true,
        subscribedSymbol: symbol,
        timeframe,
        kline,
        message: "Live Binance data",
        errorCode: null,
        websocketHost: hostOf(url),
      });
    });

    next.addEventListener("error", () => {
      if (gen !== generation) return;
      hostIndex += 1;
    });

    next.addEventListener("close", () => {
      if (gen !== generation) return;
      if (intentionalClose) return;
      hostIndex += 1;
      scheduleReconnect("RECONNECTING", "Reconnecting to Binance...", "BINANCE_NETWORK");
    });
  }

  return {
    subscribe(symbol, timeframe) {
      if (!config.enabled) {
        desiredSymbol = null;
        desiredTimeframe = null;
        setSnapshot({
          ...idleLiveKlineSnapshot("Binance live data unavailable."),
          connectionState: "ERROR",
          errorCode: "BINANCE_DISABLED",
        });
        return;
      }
      if (!symbol || !timeframe) {
        generation += 1;
        desiredSymbol = null;
        desiredTimeframe = null;
        intentionalClose = true;
        clearTimers();
        closeSocket();
        snapshot = idleLiveKlineSnapshot("Disconnected");
        emit();
        return;
      }
      let compact: string;
      try {
        compact = toBinanceSymbol(symbol);
      } catch {
        generation += 1;
        desiredSymbol = null;
        desiredTimeframe = null;
        intentionalClose = true;
        clearTimers();
        closeSocket();
        setSnapshot({
          connectionState: "ERROR",
          liveMarketData: false,
          websocketActive: false,
          subscribedSymbol: null,
          timeframe: null,
          kline: null,
          message: "Unable to load Binance market data.",
          errorCode: "BINANCE_INVALID_SYMBOL",
        });
        return;
      }
      if (
        desiredSymbol === compact
        && desiredTimeframe === timeframe
        && socket
        && (snapshot.connectionState === "CONNECTED" || snapshot.connectionState === "CONNECTING")
      ) {
        return;
      }
      generation += 1;
      desiredSymbol = compact;
      desiredTimeframe = timeframe;
      hostIndex = 0;
      backoffMs = BACKOFF_START_MS;
      lastValidAt = 0;
      openSocket(false);
    },
    getSnapshot() {
      return snapshot;
    },
    onChange(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    disconnect() {
      generation += 1;
      desiredSymbol = null;
      desiredTimeframe = null;
      intentionalClose = true;
      clearTimers();
      closeSocket();
      snapshot = idleLiveKlineSnapshot("Disconnected");
      emit();
    },
  };
}
