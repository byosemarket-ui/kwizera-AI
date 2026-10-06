import { PHASE6_CAPABILITIES, type MarketConnectionSnapshot, type MarketConnectionState } from "./types.js";
import type { BinancePublicConfig } from "./config.js";

export function disconnectedSnapshot(
  config: BinancePublicConfig,
  message = "Binance public API is not connected.",
): MarketConnectionSnapshot {
  return {
    state: "DISCONNECTED",
    liveMarketData: false,
    websocketActive: false,
    restReachable: false,
    source: "binance-spot-public",
    environment: config.environment,
    restBaseHost: config.restBaseHost,
    serverTimeUtc: null,
    probedAtUtc: Date.now(),
    message,
    errorCode: null,
    capabilities: { ...PHASE6_CAPABILITIES },
  };
}

export function snapshotForState(
  config: BinancePublicConfig,
  state: MarketConnectionState,
  extra: Partial<MarketConnectionSnapshot> = {},
): MarketConnectionSnapshot {
  return {
    ...disconnectedSnapshot(config),
    ...extra,
    state,
    restReachable: extra.restReachable ?? state === "CONNECTED",
    liveMarketData: false,
    websocketActive: false,
    source: "binance-spot-public",
    capabilities: { ...PHASE6_CAPABILITIES },
  };
}

export function publicConnectionLabel(snapshot: MarketConnectionSnapshot): string {
  switch (snapshot.state) {
    case "CONNECTING":
      return "Checking Binance public API";
    case "RECONNECTING":
      return "Reconnecting to Binance public API";
    case "CONNECTED":
      return snapshot.liveMarketData ? "Live Binance market data" : "Binance public API reachable";
    case "ERROR":
      return "Binance public API error";
    default:
      return "Not connected";
  }
}

export function publicConnectionDetail(snapshot: MarketConnectionSnapshot): string {
  if (snapshot.liveMarketData) {
    return "Live Binance market data is connected.";
  }
  if (snapshot.state === "CONNECTED") {
    return "Binance public API reachable. Live market data is not streaming.";
  }
  if (snapshot.state === "CONNECTING") {
    return "Checking Binance public API…";
  }
  if (snapshot.state === "ERROR") {
    return snapshot.message;
  }
  return "Live market data is not connected.";
}

export function connectionBadgeTone(snapshot: MarketConnectionSnapshot): "live" | "future" | "offline" {
  if (snapshot.liveMarketData) return "live";
  if (snapshot.state === "CONNECTED" || snapshot.state === "CONNECTING" || snapshot.state === "RECONNECTING") {
    return "future";
  }
  return "offline";
}
