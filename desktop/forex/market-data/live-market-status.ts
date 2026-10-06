/**
 * Single interpretation of Binance live-market UI status for Phases 8–10.
 * LIVE requires an active matching subscription and a recent valid event.
 */
import type { LiveKlineSnapshot, LiveTickerSnapshot, MarketConnectionState } from "../../../ai/market-data/binance/types";

export type LiveMarketUiStatus =
  | "CONNECTING"
  | "CONNECTED"
  | "LIVE"
  | "RECONNECTING"
  | "DISCONNECTED"
  | "ERROR"
  | "NO_DATA";

export function tickerMatchesSelection(
  snapshot: LiveTickerSnapshot,
  expectedSymbol: string | null | undefined,
): boolean {
  if (!expectedSymbol) return false;
  const expected = expectedSymbol.replace(/[/_-]/g, "").toUpperCase();
  if (snapshot.subscribedSymbol !== expected) return false;
  if (!snapshot.ticker) return false;
  return snapshot.ticker.symbol === expected;
}

export function resolveTickerUiStatus(
  snapshot: LiveTickerSnapshot,
  expectedSymbol: string | null | undefined,
): LiveMarketUiStatus {
  if (!expectedSymbol) return "NO_DATA";
  const expected = expectedSymbol.replace(/[/_-]/g, "").toUpperCase();
  if (snapshot.subscribedSymbol && snapshot.subscribedSymbol !== expected) {
    return snapshot.connectionState === "RECONNECTING" ? "RECONNECTING" : "CONNECTING";
  }
  if (snapshot.liveMarketData && tickerMatchesSelection(snapshot, expectedSymbol)) return "LIVE";
  switch (snapshot.connectionState as MarketConnectionState) {
    case "CONNECTING":
      return "CONNECTING";
    case "RECONNECTING":
      return "RECONNECTING";
    case "ERROR":
      return "ERROR";
    case "CONNECTED":
      return "CONNECTED";
    default:
      return snapshot.subscribedSymbol ? "DISCONNECTED" : "NO_DATA";
  }
}

export function liveMarketStatusLabel(status: LiveMarketUiStatus): string {
  switch (status) {
    case "LIVE":
      return "LIVE";
    case "CONNECTING":
      return "Connecting to Binance...";
    case "CONNECTED":
      return "Waiting for live Binance data...";
    case "RECONNECTING":
      return "Reconnecting to Binance...";
    case "ERROR":
      return "Unable to load Binance market data.";
    case "NO_DATA":
      return "No Binance market selected.";
    default:
      return "Binance live data unavailable.";
  }
}

export function liveMarketStatusTone(status: LiveMarketUiStatus): "live" | "future" | "offline" {
  if (status === "LIVE") return "live";
  if (status === "CONNECTING" || status === "CONNECTED" || status === "RECONNECTING") return "future";
  return "offline";
}

export function resolveKlineUiStatus(
  snapshot: LiveKlineSnapshot,
  expectedSymbol: string | null | undefined,
  expectedTimeframe: string | null | undefined,
  historyReady: boolean,
): LiveMarketUiStatus {
  if (!expectedSymbol || !expectedTimeframe) return "NO_DATA";
  if (!historyReady) return "CONNECTING";
  const expected = expectedSymbol.replace(/[/_-]/g, "").toUpperCase();
  if (
    snapshot.liveMarketData
    && snapshot.kline?.symbol === expected
    && snapshot.kline.timeframe === expectedTimeframe
    && snapshot.subscribedSymbol === expected
    && snapshot.timeframe === expectedTimeframe
  ) {
    return "LIVE";
  }
  switch (snapshot.connectionState) {
    case "CONNECTING":
      return "CONNECTING";
    case "RECONNECTING":
      return "RECONNECTING";
    case "ERROR":
      return "ERROR";
    case "CONNECTED":
      return "CONNECTED";
    default:
      return "DISCONNECTED";
  }
}

export function formatLastUpdateUtc(eventTimeUtc: number | null | undefined): string {
  if (eventTimeUtc == null || !Number.isFinite(eventTimeUtc) || eventTimeUtc <= 0) return "—";
  return `${new Date(eventTimeUtc).toISOString().replace(".000Z", "Z")} UTC`;
}
