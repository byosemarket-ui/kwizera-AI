import { buildMiniTickerUrl, normalizeBinanceMiniTicker, toBinanceSymbol } from "./adapter.js";
import { resolveBinancePublicConfig, type BinancePublicConfig } from "./config.js";
import type { LiveTickerSnapshot, MarketConnectionState, NormalizedLiveTicker } from "./types.js";

export type WebSocketLike = {
  readyState: number;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: { data?: unknown; code?: number }) => void): void;
  removeEventListener?(type: string, listener: (event: { data?: unknown; code?: number }) => void): void;
};

export type WebSocketCtor = new (url: string) => WebSocketLike;

const CONNECT_TIMEOUT_MS = 10000;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 15000;
const STALE_CHECK_MS = 5000;
/** MiniTicker should refresh frequently; after this gap LIVE is cleared. */
const TICKER_STALE_MS = 30_000;

export function idleLiveTickerSnapshot(message = "Disconnected"): LiveTickerSnapshot {
  return {
    connectionState: "DISCONNECTED",
    liveMarketData: false,
    websocketActive: false,
    subscribedSymbol: null,
    ticker: null,
    message,
    errorCode: null,
    websocketHost: null,
    streamType: "miniTicker",
    source: "binance-spot-public",
  };
}

export function liveTickerStatusLabel(snapshot: LiveTickerSnapshot): string {
  if (snapshot.liveMarketData) return "LIVE";
  switch (snapshot.connectionState) {
    case "CONNECTING":
      return "Connecting to Binance...";
    case "RECONNECTING":
      return "Reconnecting to Binance...";
    case "ERROR":
      return "Unable to load Binance market data.";
    case "CONNECTED":
      return "Waiting for live Binance data...";
    default:
      return snapshot.subscribedSymbol ? "Binance live data unavailable." : "Disconnected";
  }
}

export function liveTickerStatusTone(snapshot: LiveTickerSnapshot): "live" | "future" | "offline" {
  if (snapshot.liveMarketData) return "live";
  if (snapshot.connectionState === "CONNECTING" || snapshot.connectionState === "RECONNECTING" || snapshot.connectionState === "CONNECTED") {
    return "future";
  }
  return "offline";
}

export function liveTickerPriceLabel(snapshot: LiveTickerSnapshot): string {
  if (snapshot.liveMarketData && snapshot.ticker) return formatLivePrice(snapshot.ticker.price);
  if (snapshot.connectionState === "CONNECTING") return "Connecting to Binance...";
  if (snapshot.connectionState === "RECONNECTING") return "Reconnecting to Binance...";
  if (snapshot.connectionState === "CONNECTED") return "Waiting for live Binance data...";
  if (snapshot.connectionState === "ERROR") return "Unable to load Binance market data.";
  if (!snapshot.subscribedSymbol) return "Select a Binance Spot symbol from Markets.";
  return "Binance live data unavailable.";
}

export function formatLivePrice(price: number): string {
  if (!Number.isFinite(price) || price <= 0) return "Waiting for live Binance data...";
  if (price >= 1000) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 8 });
}

export interface LiveTickerClient {
  subscribe(symbol: string | null): void;
  getSnapshot(): LiveTickerSnapshot;
  onChange(listener: (snapshot: LiveTickerSnapshot) => void): () => void;
  disconnect(): void;
  getActiveSocketCount(): number;
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

export function createBinanceLiveTickerClient(options: {
  env?: Record<string, string | undefined>;
  webSocketCtor?: WebSocketCtor;
  now?: () => number;
} = {}): LiveTickerClient {
  const config: BinancePublicConfig = resolveBinancePublicConfig(options.env);
  const WebSocketImpl = options.webSocketCtor;
  const now = options.now ?? Date.now;
  const bases = config.websocketFallbackUrls.length > 0 ? config.websocketFallbackUrls : [config.websocketBaseUrl];

  let snapshot = idleLiveTickerSnapshot(
    config.enabled ? "Disconnected" : "Binance live data unavailable.",
  );
  const listeners = new Set<(snapshot: LiveTickerSnapshot) => void>();
  let socket: WebSocketLike | null = null;
  let generation = 0;
  let desiredSymbol: string | null = null;
  let hostIndex = 0;
  let backoffMs = BACKOFF_START_MS;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connectTimer: ReturnType<typeof setTimeout> | null = null;
  let staleTimer: ReturnType<typeof setInterval> | null = null;
  let lastValidAt = 0;
  let intentionalClose = false;
  let activeSockets = 0;

  function emit(): void {
    for (const listener of listeners) listener(snapshot);
  }

  function setSnapshot(next: Partial<LiveTickerSnapshot>): void {
    const ticker = next.ticker === undefined ? snapshot.ticker : next.ticker;
    const websocketActive = next.websocketActive ?? snapshot.websocketActive;
    const subscribedSymbol = next.subscribedSymbol === undefined ? snapshot.subscribedSymbol : next.subscribedSymbol;
    const connectionState = (next.connectionState ?? snapshot.connectionState) as MarketConnectionState;
    const live = Boolean(
      next.liveMarketData === true
      && websocketActive
      && ticker
      && subscribedSymbol
      && ticker.symbol === subscribedSymbol
      && connectionState === "CONNECTED",
    );
    snapshot = {
      ...snapshot,
      ...next,
      ticker,
      websocketActive,
      subscribedSymbol,
      connectionState,
      liveMarketData: live,
      streamType: "miniTicker",
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

  function watchStale(gen: number): void {
    if (staleTimer) clearInterval(staleTimer);
    staleTimer = setInterval(() => {
      if (gen !== generation || !snapshot.liveMarketData) return;
      if (now() - lastValidAt > TICKER_STALE_MS) {
        scheduleReconnect("RECONNECTING", "Reconnecting to Binance...", "BINANCE_STALE");
      }
    }, STALE_CHECK_MS);
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

  function scheduleReconnect(state: MarketConnectionState, message: string, errorCode: string | null): void {
    if (!desiredSymbol || !config.enabled) return;
    clearTimers();
    setSnapshot({
      connectionState: state,
      liveMarketData: false,
      websocketActive: false,
      ticker: null,
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
    if (!desiredSymbol || !config.enabled) return;
    const Ctor = WebSocketImpl ?? (typeof WebSocket !== "undefined" ? WebSocket as unknown as WebSocketCtor : null);
    if (!Ctor) {
      setSnapshot({
        connectionState: "ERROR",
        liveMarketData: false,
        websocketActive: false,
        ticker: null,
        message: "Binance live data unavailable.",
        errorCode: "BINANCE_WS_UNAVAILABLE",
      });
      return;
    }

    const gen = generation;
    const symbol = desiredSymbol;
    const base = bases[hostIndex % bases.length];
    const url = buildMiniTickerUrl(base, symbol);
    clearTimers();
    intentionalClose = true;
    closeSocket();
    intentionalClose = false;
    setSnapshot({
      connectionState: isReconnect ? "RECONNECTING" : "CONNECTING",
      liveMarketData: false,
      websocketActive: false,
      subscribedSymbol: symbol,
      ticker: null,
      message: isReconnect ? "Reconnecting to Binance..." : "Connecting to Binance...",
      errorCode: null,
      websocketHost: hostOf(url),
    });

    let opened = false;
    const next = new Ctor(url);
    socket = next;
    activeSockets += 1;
    const onSettledClose = () => {
      activeSockets = Math.max(0, activeSockets - 1);
    };

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
      watchStale(gen);
      setSnapshot({
        connectionState: "CONNECTED",
        liveMarketData: false,
        websocketActive: true,
        subscribedSymbol: symbol,
        ticker: null,
        message: "Waiting for live Binance data...",
        errorCode: null,
        websocketHost: hostOf(url),
      });
    });

    next.addEventListener("message", (event) => {
      if (gen !== generation || socket !== next) return;
      const ticker = normalizeBinanceMiniTicker(parseSocketData(event.data), symbol, now());
      if (!ticker) return;
      lastValidAt = now();
      setSnapshot({
        connectionState: "CONNECTED",
        liveMarketData: true,
        websocketActive: true,
        subscribedSymbol: symbol,
        ticker,
        message: "Live Binance market data",
        errorCode: null,
        websocketHost: hostOf(url),
      });
    });

    next.addEventListener("error", () => {
      if (gen !== generation) return;
      hostIndex += 1;
    });

    next.addEventListener("close", (event) => {
      onSettledClose();
      if (gen !== generation) return;
      if (intentionalClose) return;
      const code = event.code ?? 0;
      if (code === 1000 && !desiredSymbol) return;
      hostIndex += 1;
      scheduleReconnect("RECONNECTING", "Reconnecting to Binance...", "BINANCE_NETWORK");
    });
  }

  return {
    subscribe(symbol) {
      if (!config.enabled) {
        desiredSymbol = null;
        setSnapshot({
          ...idleLiveTickerSnapshot("Binance live data unavailable."),
          connectionState: "ERROR",
          errorCode: "BINANCE_DISABLED",
        });
        return;
      }
      if (!symbol) {
        generation += 1;
        desiredSymbol = null;
        intentionalClose = true;
        clearTimers();
        closeSocket();
        snapshot = idleLiveTickerSnapshot("Disconnected");
        emit();
        return;
      }
      let compact: string;
      try {
        compact = toBinanceSymbol(symbol);
      } catch {
        generation += 1;
        desiredSymbol = null;
        intentionalClose = true;
        clearTimers();
        closeSocket();
        setSnapshot({
          connectionState: "ERROR",
          liveMarketData: false,
          websocketActive: false,
          subscribedSymbol: null,
          ticker: null,
          message: "Invalid symbol",
          errorCode: "BINANCE_INVALID_SYMBOL",
        });
        return;
      }
      if (desiredSymbol === compact && socket && (snapshot.connectionState === "CONNECTED" || snapshot.connectionState === "CONNECTING")) {
        return;
      }
      generation += 1;
      desiredSymbol = compact;
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
      intentionalClose = true;
      clearTimers();
      closeSocket();
      snapshot = idleLiveTickerSnapshot("Disconnected");
      emit();
    },
    getActiveSocketCount() {
      return activeSockets;
    },
  };
}
