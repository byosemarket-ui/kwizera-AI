/**
 * Phase 60.0.6 — distinguish sidecar/session/poller/quote layers.
 * These are not interchangeable; CONNECTED alone is never LIVE quote proof.
 */

export type SidecarHealth = "UNKNOWN" | "REACHABLE" | "UNREACHABLE";
export type SessionLayer = "UNKNOWN" | "DISABLED" | "DISCONNECTED" | "CONNECTED" | "ERROR";
export type PollerLayer =
  | "UNKNOWN"
  | "INACTIVE"
  | "LISTENER_ACTIVE"
  | "SUBSCRIPTION_IDLE"
  | "MARKET_INACTIVE";
export type QuoteLayer =
  | "QUOTE_NOT_RECEIVED"
  | "QUOTE_STALE"
  | "QUOTE_RECEIVED"
  | "QUOTE_INVALID"
  | "UNAVAILABLE";

export interface RuntimeObservabilitySnapshot {
  sidecarHealth: SidecarHealth;
  session: SessionLayer;
  poller: PollerLayer;
  quote: QuoteLayer;
  /** True only when quote layer is QUOTE_RECEIVED — never inferred from session alone. */
  mayLabelMarkLive: boolean;
  note: string;
}

export function classifySessionLayer(sessionStatus: string | null | undefined): SessionLayer {
  const s = String(sessionStatus ?? "").toUpperCase();
  if (!s) return "UNKNOWN";
  if (s === "DISABLED") return "DISABLED";
  if (s === "CONNECTED" || s === "AUTHENTICATED") return "CONNECTED";
  if (s === "ERROR") return "ERROR";
  if (s === "DISCONNECTED" || s === "NOT_CONFIGURED") return "DISCONNECTED";
  return "UNKNOWN";
}

export function classifyPollerLayer(input: {
  streamState?: string | null;
  offersListenerActive?: boolean | null;
  subscriptionCount?: number | null;
}): PollerLayer {
  const stream = String(input.streamState ?? "").toUpperCase();
  if (stream === "MARKET_INACTIVE") return "MARKET_INACTIVE";
  if (stream === "AUTHENTICATED_IDLE" || stream === "SUBSCRIBED_WAITING") return "SUBSCRIPTION_IDLE";
  if (input.offersListenerActive === true || (input.subscriptionCount ?? 0) > 0) {
    return "LISTENER_ACTIVE";
  }
  if (input.offersListenerActive === false) return "INACTIVE";
  return "UNKNOWN";
}

export function classifyQuoteLayer(input: {
  quoteFreshnessLabel?: string | null;
  lastQuoteAt?: string | null;
  lastQuoteAgeMs?: number | null;
  updateCount?: number | null;
  staleMs?: number;
}): QuoteLayer {
  const label = String(input.quoteFreshnessLabel ?? "").toUpperCase();
  if (label === "QUOTE_RECEIVED") return "QUOTE_RECEIVED";
  if (label === "QUOTE_STALE") return "QUOTE_STALE";
  if (label === "QUOTE_INVALID") return "QUOTE_INVALID";
  if (label === "QUOTE_NOT_RECEIVED" || label === "MARKET_INACTIVE" || label === "SUBSCRIPTION_IDLE") {
    return label === "QUOTE_NOT_RECEIVED" ? "QUOTE_NOT_RECEIVED" : "UNAVAILABLE";
  }
  if (label === "SESSION_DISCONNECTED") return "UNAVAILABLE";
  const staleMs = input.staleMs ?? 15_000;
  const updates = typeof input.updateCount === "number" ? input.updateCount : 0;
  if (!input.lastQuoteAt && updates <= 0) return "QUOTE_NOT_RECEIVED";
  if (typeof input.lastQuoteAgeMs === "number" && input.lastQuoteAgeMs > staleMs) return "QUOTE_STALE";
  if (input.lastQuoteAt || updates > 0) return "QUOTE_RECEIVED";
  return "QUOTE_NOT_RECEIVED";
}

export function buildRuntimeObservability(input: {
  sidecarReachable?: boolean | null;
  sessionStatus?: string | null;
  streamState?: string | null;
  offersListenerActive?: boolean | null;
  subscriptionCount?: number | null;
  quoteFreshnessLabel?: string | null;
  lastQuoteAt?: string | null;
  lastQuoteAgeMs?: number | null;
  updateCount?: number | null;
}): RuntimeObservabilitySnapshot {
  const sidecarHealth: SidecarHealth =
    input.sidecarReachable === true
      ? "REACHABLE"
      : input.sidecarReachable === false
        ? "UNREACHABLE"
        : "UNKNOWN";
  const session = classifySessionLayer(input.sessionStatus);
  const poller = classifyPollerLayer(input);
  const quote = classifyQuoteLayer(input);
  const mayLabelMarkLive = quote === "QUOTE_RECEIVED";
  return {
    sidecarHealth,
    session,
    poller,
    quote,
    mayLabelMarkLive,
    note:
      "Sidecar health, session status, Offers poller/listener, and quote reception are separate layers. "
      + "CONNECTED or LISTENER_ACTIVE alone never proves a live mark.",
  };
}

/** Keep last-known payload only when a prior successful snapshot exists. */
export function shouldMarkLastKnownStale(
  hasPriorData: boolean,
  refreshFailed: boolean,
): boolean {
  return Boolean(hasPriorData && refreshFailed);
}
