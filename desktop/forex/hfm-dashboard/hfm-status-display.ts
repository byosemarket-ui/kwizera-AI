/**
 * R2-UI-1 — distinguishable HFM status labels for Charts / dashboard panes.
 * Terminal ≠ auth ≠ quote feed ≠ overall market-data readiness.
 * Never paint "Unauthenticated" solely because the terminal probe is down/unknown.
 */
import type { HfmConnectionState, HfmFreshness, HfmSseStatus } from "./types";

export type HfmStatusTone = "ok" | "warn" | "bad" | "neutral";

export interface HfmStatusLabel {
  text: string;
  tone: HfmStatusTone;
}

export function labelTerminalProcess(terminalRunning: boolean | null): HfmStatusLabel {
  if (terminalRunning === true) return { text: "Online", tone: "ok" };
  if (terminalRunning === false) return { text: "Offline", tone: "bad" };
  return { text: "Unknown", tone: "warn" };
}

export function labelMt5AgentAuth(
  authenticated: boolean | null,
  terminalRunning: boolean | null,
): HfmStatusLabel {
  if (authenticated === true) return { text: "Authenticated", tone: "ok" };
  if (authenticated === false && terminalRunning === true) {
    return { text: "Not authenticated", tone: "bad" };
  }
  if (terminalRunning === true) {
    return { text: "Auth unknown", tone: "warn" };
  }
  // Terminal down/unknown — do not claim Unauthenticated.
  return { text: "Auth unknown (terminal not confirmed)", tone: "warn" };
}

export function labelQuoteFeed(freshness: HfmFreshness | null | undefined): HfmStatusLabel {
  switch (freshness) {
    case "LIVE":
      return { text: "LIVE", tone: "ok" };
    case "MARKET_CLOSED":
      return { text: "MARKET_CLOSED", tone: "warn" };
    case "STALE":
      return { text: "STALE", tone: "warn" };
    case "WAITING_FOR_DATA":
      return { text: "WAITING_FOR_DATA", tone: "warn" };
    case "DISCONNECTED":
      return { text: "DISCONNECTED", tone: "bad" };
    case "DATA_UNAVAILABLE":
      return { text: "DATA_UNAVAILABLE", tone: "bad" };
    default:
      return { text: "Unknown", tone: "warn" };
  }
}

export function labelCandleFeed(input: {
  candleBarCount: number;
  quoteFeed: HfmFreshness | null | undefined;
}): HfmStatusLabel {
  if (input.candleBarCount > 0) {
    return { text: `Series available (${input.candleBarCount} bars)`, tone: "ok" };
  }
  if (input.quoteFeed === "LIVE" || input.quoteFeed === "STALE" || input.quoteFeed === "MARKET_CLOSED") {
    return { text: "Missing / not loaded", tone: "warn" };
  }
  if (input.quoteFeed === "DISCONNECTED" || input.quoteFeed === "DATA_UNAVAILABLE") {
    return { text: "Unavailable", tone: "bad" };
  }
  return { text: "Unknown", tone: "warn" };
}

/**
 * Market-data readiness for badge/pill — based on feed + SSE/connection.
 * Does NOT require terminalRunning; terminal is a separate row.
 */
export function labelMarketDataReadiness(input: {
  sseStatus: HfmSseStatus;
  connectionState: HfmConnectionState;
  freshness: HfmFreshness;
}): HfmStatusLabel {
  if (input.sseStatus === "auth_required") {
    return { text: "Auth required", tone: "warn" };
  }
  if (input.sseStatus === "error") {
    return { text: "Feed error", tone: "bad" };
  }
  if (input.freshness === "LIVE") {
    return { text: "Quote feed ready", tone: "ok" };
  }
  if (input.freshness === "STALE" || input.connectionState === "degraded") {
    return { text: "Degraded", tone: "warn" };
  }
  if (input.freshness === "MARKET_CLOSED") {
    return { text: "Market closed", tone: "warn" };
  }
  if (
    input.freshness === "DISCONNECTED"
    || input.connectionState === "disconnected"
    || input.freshness === "DATA_UNAVAILABLE"
  ) {
    return { text: "Feed offline", tone: "bad" };
  }
  if (
    input.sseStatus === "connecting"
    || input.sseStatus === "reconnecting"
    || input.freshness === "WAITING_FOR_DATA"
    || input.connectionState === "waiting"
  ) {
    return { text: "Waiting for data", tone: "warn" };
  }
  return { text: "Unknown", tone: "warn" };
}

export function statusToneClass(tone: HfmStatusTone): string {
  if (tone === "ok") return "hfm-ok";
  if (tone === "bad") return "hfm-bad";
  if (tone === "warn") return "hfm-warn";
  return "hfm-warn";
}
