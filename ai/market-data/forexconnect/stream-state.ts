/**
 * ForexConnect Offers waiting-state classification (Phase 37E).
 * Pure helper — kept separate from the live poller for focused unit tests.
 */
import type { ForexConnectLiveStreamState } from "./live-types.js";

/** Prefer sidecar classification while no genuine Offers bid/ask changes have been applied. */
export function resolveFcWaitingStreamState(
  sidecarState: ForexConnectLiveStreamState | string | null | undefined,
  sessionUpdateCount: number,
): ForexConnectLiveStreamState {
  // Defensive: callers normally invoke this only while updateCount is zero.
  if (sessionUpdateCount > 0) return "SUBSCRIBED_WAITING";
  const state = String(sidecarState ?? "").toUpperCase();
  if (state === "MARKET_INACTIVE") return "MARKET_INACTIVE";
  if (state === "NO_RECENT_MARKET_UPDATES") return "NO_RECENT_MARKET_UPDATES";
  if (state === "SUBSCRIBED_WAITING") return "SUBSCRIBED_WAITING";
  if (state === "STALE") return "STALE";
  if (state === "DISCONNECTED") return "DISCONNECTED";
  if (state === "ERROR") return "ERROR";
  if (state === "SERVICE_UNAVAILABLE") return "SERVICE_UNAVAILABLE";
  if (state === "DISABLED") return "DISABLED";
  if (state === "NOT_CONFIGURED") return "NOT_CONFIGURED";
  if (state === "SUBSCRIBING") return "SUBSCRIBING";
  return "SUBSCRIBED_WAITING";
}

/** Honest feed label: LIVE only while a bid/ask change is recent. */
export function resolveFcFeedStreamState(options: {
  priceChangeAgeMs: number | null;
  receiptAgeMs: number | null;
  updateCount: number;
  staleMs?: number;
}): ForexConnectLiveStreamState {
  const staleMs = options.staleMs ?? 15_000;
  if (
    options.updateCount > 0
    && options.priceChangeAgeMs != null
    && options.priceChangeAgeMs <= staleMs
  ) {
    return "LIVE";
  }
  if (options.receiptAgeMs != null && options.receiptAgeMs <= staleMs) {
    return options.updateCount > 0 ? "NO_RECENT_MARKET_UPDATES" : "MARKET_INACTIVE";
  }
  if (options.updateCount > 0 || options.receiptAgeMs != null) {
    return "STALE";
  }
  return "SUBSCRIBED_WAITING";
}
