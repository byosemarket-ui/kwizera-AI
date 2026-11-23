/**
 * STEP 3A — map distinguishable HFM health signals to Market Watch UI status.
 * R2-UI-1: provider badge reflects feed/SSE readiness — NOT terminal process alone.
 * Terminal Online/Offline remains a separate status row.
 */

import type { HfmConnectionState, HfmFreshness, HfmSseStatus } from "../types";
import type { HfmMwProviderUiStatus } from "./types";

export function mapHfmProviderUiStatus(input: {
  sseStatus: HfmSseStatus;
  connectionState: HfmConnectionState;
  freshness: HfmFreshness;
  terminalRunning: boolean | null;
  authenticated: boolean | null;
}): HfmMwProviderUiStatus {
  if (input.sseStatus === "auth_required") return "AUTH_REQUIRED";
  if (input.sseStatus === "connecting" || input.sseStatus === "reconnecting") return "CONNECTING";
  if (input.sseStatus === "error") return "ERROR";
  if (input.connectionState === "degraded" || input.freshness === "STALE") return "DEGRADED";
  // Live quote feed is authoritative for market-data readiness even if the
  // Wine terminal probe is false/unknown (probe can lag independently).
  if (
    input.freshness === "LIVE"
    && (input.sseStatus === "connected" || input.connectionState === "connected")
  ) {
    return "CONNECTED";
  }
  if (
    input.connectionState === "connected"
    && (input.sseStatus === "connected" || input.authenticated === true)
    && input.freshness !== "DISCONNECTED"
    && input.freshness !== "DATA_UNAVAILABLE"
  ) {
    return "CONNECTED";
  }
  if (
    input.connectionState === "disconnected"
    || input.freshness === "DISCONNECTED"
    || input.freshness === "DATA_UNAVAILABLE"
  ) {
    return "DISCONNECTED";
  }
  if (input.sseStatus === "idle" || input.connectionState === "waiting") return "WAITING";
  // terminalRunning alone must not force DISCONNECTED when feed is unknown/waiting.
  void input.terminalRunning;
  return "WAITING";
}

export function providerUiStatusLabel(status: HfmMwProviderUiStatus): string {
  switch (status) {
    case "CONNECTED":
      return "Connected";
    case "DISCONNECTED":
      return "Disconnected";
    case "CONNECTING":
      return "Connecting";
    case "DEGRADED":
      return "Degraded";
    case "ERROR":
      return "Error";
    case "AUTH_REQUIRED":
      return "Auth required";
    case "WAITING":
      return "Waiting";
    default:
      return String(status);
  }
}

export function providerUiStatusTone(
  status: HfmMwProviderUiStatus,
): "live" | "warn" | "down" | "wait" {
  if (status === "CONNECTED") return "live";
  if (status === "DEGRADED" || status === "CONNECTING" || status === "WAITING" || status === "AUTH_REQUIRED") {
    return "warn";
  }
  if (status === "ERROR" || status === "DISCONNECTED") return "down";
  return "wait";
}
