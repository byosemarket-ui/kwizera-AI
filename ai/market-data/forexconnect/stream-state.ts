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
  if (sessionUpdateCount > 0) return "SUBSCRIBED_WAITING";
  const state = String(sidecarState ?? "").toUpperCase();
  if (state === "MARKET_INACTIVE") return "MARKET_INACTIVE";
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
