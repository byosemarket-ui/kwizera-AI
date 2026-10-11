/**
 * Validated lifecycle transitions for monitor sessions.
 */
import type { ForexMonitorLifecycleState } from "./types.js";

const ALLOWED: Record<ForexMonitorLifecycleState, readonly ForexMonitorLifecycleState[]> = {
  STOPPED: ["STARTING"],
  STARTING: ["WATCHING", "STALE", "ERROR", "STOPPED", "PAUSED"],
  WATCHING: [
    "SETUP_DETECTED",
    "WAITING_FOR_CONFIRMATION",
    "CONFIRMED",
    "INVALIDATED",
    "PAUSED",
    "STALE",
    "ERROR",
    "STOPPED",
  ],
  SETUP_DETECTED: [
    "WAITING_FOR_CONFIRMATION",
    "CONFIRMED",
    "INVALIDATED",
    "WATCHING",
    "PAUSED",
    "STALE",
    "ERROR",
    "STOPPED",
  ],
  WAITING_FOR_CONFIRMATION: [
    "CONFIRMED",
    "INVALIDATED",
    "SETUP_DETECTED",
    "WATCHING",
    "PAUSED",
    "STALE",
    "ERROR",
    "STOPPED",
  ],
  CONFIRMED: ["INVALIDATED", "WATCHING", "PAUSED", "STALE", "ERROR", "STOPPED"],
  INVALIDATED: ["WATCHING", "SETUP_DETECTED", "PAUSED", "STALE", "ERROR", "STOPPED"],
  PAUSED: ["WATCHING", "STOPPED", "ERROR"],
  STALE: ["WATCHING", "PAUSED", "ERROR", "STOPPED"],
  ERROR: ["STARTING", "WATCHING", "STOPPED"],
};

export class ForexMonitorTransitionError extends Error {
  readonly code = "INVALID_TRANSITION";

  constructor(from: ForexMonitorLifecycleState, to: ForexMonitorLifecycleState) {
    super(`Invalid monitor lifecycle transition: ${from} → ${to}`);
    this.name = "ForexMonitorTransitionError";
  }
}

export function canTransition(
  from: ForexMonitorLifecycleState,
  to: ForexMonitorLifecycleState,
): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

/** Throws when transition is not allowed (API layer maps to unauthorized). */
export function assertTransition(
  from: ForexMonitorLifecycleState,
  to: ForexMonitorLifecycleState,
): void {
  if (!canTransition(from, to)) {
    throw new ForexMonitorTransitionError(from, to);
  }
}

export function mapSetupStateToLifecycle(
  setupState: ForexMonitorLifecycleState | "WATCHING",
  freshness: "FRESH" | "STALE" | "INACTIVE" | "UNAVAILABLE" | "UNKNOWN",
  current: ForexMonitorLifecycleState,
): ForexMonitorLifecycleState {
  if (current === "PAUSED" || current === "STOPPED") {
    return current;
  }
  if (freshness === "UNAVAILABLE") {
    return canTransition(current, "ERROR") ? "ERROR" : current;
  }
  if (freshness === "STALE" || freshness === "INACTIVE") {
    if (canTransition(current, "STALE")) return "STALE";
  }
  if (setupState === "WATCHING") {
    return canTransition(current, "WATCHING") ? "WATCHING" : current;
  }
  if (canTransition(current, setupState as ForexMonitorLifecycleState)) {
    return setupState as ForexMonitorLifecycleState;
  }
  return current;
}
