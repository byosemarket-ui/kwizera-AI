/**
 * STEP 3A — map distinguishable HFM health signals to Market Watch UI status.
 * Node reachability ≠ MT5 connected. Prefer broker/SSE connection state.
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
  if (
    input.connectionState === "connected" &&
    (input.sseStatus === "connected" || input.authenticated === true) &&
    input.freshness !== "DISCONNECTED"
  ) {
    return "CONNECTED";
  }
  if (
    input.connectionState === "disconnected" ||
    input.freshness === "DISCONNECTED" ||
    input.terminalRunning === false
  ) {
    return "DISCONNECTED";
  }
  if (input.sseStatus === "idle" || input.connectionState === "waiting") return "WAITING";
  return "DISCONNECTED";
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
