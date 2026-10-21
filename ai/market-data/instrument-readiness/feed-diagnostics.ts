/**
 * Phase 56.3.1 — precise live-feed diagnostics for readiness / FEED_NOT_LIVE root-cause.
 * Never invents LIVE. Never weakens freshness. Never authorizes execution.
 */

export type LiveFeedBlockerId =
  | "no_active_session"
  | "subscribing"
  | "subscribed_waiting_price_change"
  | "seeded_snapshot_no_genuine_event"
  | "heartbeat_only_no_price_change"
  | "quote_stale"
  | "quote_missing"
  | "feed_error"
  | "feed_disconnected"
  | "historical_without_live";

export interface LiveFeedDiagnostics {
  /** True when an in-memory live session exists for this instrument. */
  sessionActive: boolean;
  /** Caller requested subscribeLive on this evaluation (may still be waiting). */
  subscriptionRequested: boolean;
  /** Sidecar Offers origin on last quote — null on seeded snapshots. */
  eventSource: string | null;
  lastPriceChangeAtUtc: string | null;
  lastReceiptAtUtc: string | null;
  priceChangeAgeMs: number | null;
  receiptAgeMs: number | null;
  updateCount: number;
  feedStatus: string | null;
  /** Precise blocker id when not LIVE-ready. */
  blockerId: LiveFeedBlockerId | null;
  /** Human-readable, non-secret explanation. */
  blockerReason: string | null;
}

export function classifyLiveFeedBlocker(input: {
  sessionActive: boolean;
  subscriptionRequested?: boolean;
  feedStatus: string | null;
  hasBidAsk: boolean;
  updateCount: number;
  historicalOnly: boolean;
  eventSource?: string | null;
  priceChangeAgeMs?: number | null;
  receiptAgeMs?: number | null;
}): { blockerId: LiveFeedBlockerId | null; blockerReason: string | null } {
  if (!input.sessionActive) {
    return {
      blockerId: "no_active_session",
      blockerReason:
        "No active ForexConnect live session for this instrument. Discovery alone does not subscribe Offers.",
    };
  }
  if (!input.hasBidAsk) {
    return {
      blockerId: "quote_missing",
      blockerReason: "Bid/Ask missing or invalid for this instrument.",
    };
  }

  const feed = String(input.feedStatus ?? "").toUpperCase();
  if (feed === "LIVE") {
    return { blockerId: null, blockerReason: null };
  }
  if (feed === "ERROR" || feed === "SERVICE_UNAVAILABLE") {
    return {
      blockerId: "feed_error",
      blockerReason: `Live feed error state (${feed || "ERROR"}).`,
    };
  }
  if (feed === "DISCONNECTED" || feed === "DISABLED" || feed === "NOT_CONFIGURED") {
    return {
      blockerId: "feed_disconnected",
      blockerReason: `Provider connection state is ${feed}.`,
    };
  }
  if (feed === "STALE") {
    return {
      blockerId: "quote_stale",
      blockerReason:
        "Last genuine bid/ask change exceeded the freshness window (quote STALE).",
    };
  }
  if (feed === "NO_RECENT_MARKET_UPDATES") {
    return {
      blockerId: "heartbeat_only_no_price_change",
      blockerReason:
        "Offers receipts may be present, but no recent genuine bid/ask price change for this instrument.",
    };
  }
  if (feed === "SUBSCRIBING") {
    return {
      blockerId: "subscribing",
      blockerReason: "Subscription in progress; waiting for Offers confirmation and updates.",
    };
  }
  if (
    input.historicalOnly
    || input.updateCount <= 0
    || !input.eventSource
    || feed === "MARKET_INACTIVE"
  ) {
    return {
      blockerId: "seeded_snapshot_no_genuine_event",
      blockerReason:
        "Seeded or historical Offers snapshot present without a genuine offers-callback/diff price change.",
    };
  }
  if (feed === "SUBSCRIBED_WAITING" || feed === "AUTHENTICATED_IDLE") {
    return {
      blockerId: "subscribed_waiting_price_change",
      blockerReason:
        "Subscribed and waiting for a genuine bid/ask change for this instrument (peers LIVE do not count).",
    };
  }
  return {
    blockerId: "subscribed_waiting_price_change",
    blockerReason: `Feed not LIVE for this instrument (status=${feed || "unknown"}).`,
  };
}

export function buildLiveFeedDiagnostics(input: {
  sessionActive: boolean;
  subscriptionRequested?: boolean;
  feedStatus: string | null;
  hasBidAsk: boolean;
  updateCount: number;
  historicalOnly: boolean;
  eventSource?: string | null;
  priceChangeAgeMs?: number | null;
  receiptAgeMs?: number | null;
  lastPriceChangeAtMs?: number | null;
  lastReceiptAtMs?: number | null;
  nowMs?: number;
}): LiveFeedDiagnostics {
  const classified = classifyLiveFeedBlocker(input);
  const toUtc = (ms: number | null | undefined): string | null =>
    typeof ms === "number" && Number.isFinite(ms) && ms > 0
      ? new Date(ms).toISOString()
      : null;
  return {
    sessionActive: input.sessionActive,
    subscriptionRequested: Boolean(input.subscriptionRequested),
    eventSource: input.eventSource ?? null,
    lastPriceChangeAtUtc: toUtc(input.lastPriceChangeAtMs),
    lastReceiptAtUtc: toUtc(input.lastReceiptAtMs),
    priceChangeAgeMs: input.priceChangeAgeMs ?? null,
    receiptAgeMs: input.receiptAgeMs ?? null,
    updateCount: Math.max(0, Math.floor(Number(input.updateCount ?? 0)) || 0),
    feedStatus: input.feedStatus,
    blockerId: classified.blockerId,
    blockerReason: classified.blockerReason,
  };
}
