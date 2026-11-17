/**
 * Map dashboard SSE quote ticks into canonical HFM quotes for the Market Watch table.
 * Never invents LIVE prices. Prefer newer of REST vs SSE by sequence/timestamp.
 */

import type { HfmCanonicalQuote, HfmQuoteStatus } from "../../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmQuoteState } from "../types";

function freshnessToStatus(freshness: HfmQuoteState["freshness"], status: string | null): HfmQuoteStatus {
  if (
    status === "LIVE" ||
    status === "STALE" ||
    status === "MARKET_CLOSED" ||
    status === "NO_QUOTE" ||
    status === "INVALID" ||
    status === "INCOMPLETE" ||
    status === "DELAYED" ||
    status === "ERROR" ||
    status === "WAITING_FOR_DATA"
  ) {
    return status;
  }
  switch (freshness) {
    case "LIVE":
      return "LIVE";
    case "STALE":
      return "STALE";
    case "MARKET_CLOSED":
      return "MARKET_CLOSED";
    case "WAITING_FOR_DATA":
      return "WAITING_FOR_DATA";
    case "DISCONNECTED":
    case "DATA_UNAVAILABLE":
      return "ERROR";
    default:
      return "INCOMPLETE";
  }
}

export type HfmMwQuoteRecencyInput = {
  sequence?: number | null;
  quoteTimestampMs?: number | null;
  quoteTimestamp?: number | null;
  tickTime?: number | null;
  receivedAtMs?: number | null;
  receivedAt?: string | null;
};

function brokerTimestampMs(input: HfmMwQuoteRecencyInput): number | null {
  if (typeof input.quoteTimestampMs === "number" && Number.isFinite(input.quoteTimestampMs)) {
    return input.quoteTimestampMs;
  }
  if (typeof input.tickTime === "number" && Number.isFinite(input.tickTime)) {
    return input.tickTime * 1000;
  }
  if (typeof input.quoteTimestamp === "number" && Number.isFinite(input.quoteTimestamp)) {
    return input.quoteTimestamp * 1000;
  }
  return null;
}

function receivedMs(input: HfmMwQuoteRecencyInput): number | null {
  if (typeof input.receivedAtMs === "number" && Number.isFinite(input.receivedAtMs)) {
    return input.receivedAtMs;
  }
  if (typeof input.receivedAt === "string" && input.receivedAt) {
    const t = Date.parse(input.receivedAt);
    if (Number.isFinite(t)) return t;
  }
  return null;
}

/**
 * Compare two quote sources. Prefer sequence when both expose it; otherwise broker
 * timestamps; otherwise client receive time. Returns >0 if `a` is newer.
 */
export function compareQuoteRecency(a: HfmMwQuoteRecencyInput, b: HfmMwQuoteRecencyInput): number {
  const aSeq = typeof a.sequence === "number" && Number.isFinite(a.sequence) ? a.sequence : null;
  const bSeq = typeof b.sequence === "number" && Number.isFinite(b.sequence) ? b.sequence : null;
  if (aSeq != null && bSeq != null && aSeq !== bSeq) return aSeq - bSeq;

  const aTs = brokerTimestampMs(a);
  const bTs = brokerTimestampMs(b);
  if (aTs != null && bTs != null && aTs !== bTs) return aTs - bTs;

  const aRecv = receivedMs(a);
  const bRecv = receivedMs(b);
  if (aRecv != null && bRecv != null && aRecv !== bRecv) return aRecv - bRecv;

  // Equal / incomplete — treat as tie.
  return 0;
}

/** @deprecated Prefer compareQuoteRecency for cross-source merges. */
export function quoteRecencyScore(input: HfmMwQuoteRecencyInput): number {
  const seq = typeof input.sequence === "number" && Number.isFinite(input.sequence) ? input.sequence : null;
  const ts = brokerTimestampMs(input);
  const recv = receivedMs(input);
  if (seq != null) return seq;
  if (ts != null) return ts;
  if (recv != null) return recv;
  return 0;
}

export function hfmSseQuoteToCanonical(
  tick: HfmQuoteState,
  prior: HfmCanonicalQuote | null,
): HfmCanonicalQuote | null {
  const symbol = tick.symbol?.trim();
  if (!symbol) return prior;
  const bid = Number.isFinite(tick.bid) ? tick.bid : prior?.bid ?? null;
  const ask = Number.isFinite(tick.ask) ? tick.ask : prior?.ask ?? null;
  if (bid == null && ask == null && !prior) return null;

  const point = tick.point ?? prior?.point ?? null;
  const spread =
    bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask)
      ? ask - bid
      : prior?.spread ?? tick.spread ?? null;
  const spreadPoints =
    spread != null && point != null && point > 0 ? spread / point : prior?.spreadPoints ?? null;

  const quoteTimestamp = tick.tickTime ?? prior?.quoteTimestamp ?? null;
  const quoteTimestampMs =
    tick.tickTime != null && Number.isFinite(tick.tickTime)
      ? tick.tickTime * 1000
      : prior?.quoteTimestampMs ?? null;

  return {
    provider: "HFM_MT5",
    environment: "demo",
    server: prior?.server ?? null,
    symbol,
    bid,
    ask,
    last: tick.last ?? prior?.last ?? null,
    spread,
    spreadPoints,
    brokerSpreadPoints: prior?.brokerSpreadPoints ?? null,
    digits: tick.digits ?? prior?.digits ?? null,
    point,
    tickSize: prior?.tickSize ?? null,
    tickVolume: tick.tickVolume ?? prior?.tickVolume ?? null,
    realVolume: prior?.realVolume ?? null,
    tickFlags: prior?.tickFlags ?? null,
    quoteTimestamp,
    quoteTimestampMs,
    receivedAt: new Date(tick.receivedAtMs ?? Date.now()).toISOString(),
    sequence: tick.sequence ?? prior?.sequence ?? null,
    status: freshnessToStatus(tick.freshness, tick.status),
    validation: prior?.validation ?? {
      verdict: "ok",
      errors: [],
      warnings: [],
      catalogMatched: true,
      catalogVersion: null,
    },
    source: prior?.source ?? "HFM_MT5",
    acquisitionMethod: prior?.acquisitionMethod ?? "unknown",
    previousStatus: prior?.status ?? null,
    statusReason: prior?.statusReason ?? null,
    statusChangedAt: prior?.statusChangedAt ?? null,
    mutatesBroker: false,
    placesOrders: false,
    acceptsForExecution: false,
  };
}

/**
 * Merge REST snapshot with SSE ticks. Prefer the newer source per symbol.
 * Older SSE must not freeze over fresher REST (and vice versa).
 */
export function mergeSseQuotesIntoCanonicalMap(
  snapshot: Record<string, HfmCanonicalQuote>,
  sseQuotes: Record<string, HfmQuoteState>,
): Record<string, HfmCanonicalQuote> {
  const out: Record<string, HfmCanonicalQuote> = { ...snapshot };
  for (const [sym, tick] of Object.entries(sseQuotes)) {
    const key = sym.toUpperCase();
    const prior = out[key] ?? out[sym] ?? null;
    const candidate = hfmSseQuoteToCanonical(tick, prior);
    if (!candidate) continue;
    if (!prior) {
      out[key] = candidate;
      continue;
    }
    const cmp = compareQuoteRecency(
      {
        sequence: tick.sequence,
        tickTime: tick.tickTime,
        receivedAtMs: tick.receivedAtMs,
      },
      {
        sequence: prior.sequence,
        quoteTimestampMs: prior.quoteTimestampMs,
        quoteTimestamp: prior.quoteTimestamp,
        receivedAt: prior.receivedAt,
      },
    );
    // Tie or newer SSE: apply SSE (live path). Older SSE must not freeze over fresher REST.
    if (cmp >= 0) {
      out[key] = candidate;
    }
  }
  return out;
}

export type HfmMwQuoteStatusCounts = {
  live: number;
  stale: number;
  marketClosed: number;
  noQuote: number;
  invalid: number;
  delayed: number;
  error: number;
  waiting: number;
  incomplete: number;
  unquoted: number;
  /** ACTIVE subscriptions only (broker feed requested and healthy). */
  activeSubscriptions: number;
  pausedSubscriptions: number;
  pendingSubscriptions: number;
  recoveringSubscriptions: number;
  failedSubscriptions: number;
  /** Any non-UNSUBSCRIBED subscription record. */
  subscribedTotal: number;
};

export function countQuoteAndSubscriptionStatuses(
  rows: Array<{
    quote: HfmCanonicalQuote | null;
    subscription: { status: string } | null;
  }>,
): HfmMwQuoteStatusCounts {
  const counts: HfmMwQuoteStatusCounts = {
    live: 0,
    stale: 0,
    marketClosed: 0,
    noQuote: 0,
    invalid: 0,
    delayed: 0,
    error: 0,
    waiting: 0,
    incomplete: 0,
    unquoted: 0,
    activeSubscriptions: 0,
    pausedSubscriptions: 0,
    pendingSubscriptions: 0,
    recoveringSubscriptions: 0,
    failedSubscriptions: 0,
    subscribedTotal: 0,
  };
  for (const row of rows) {
    const subStatus = row.subscription?.status ?? null;
    if (subStatus && subStatus !== "UNSUBSCRIBED") {
      counts.subscribedTotal += 1;
      if (subStatus === "ACTIVE") counts.activeSubscriptions += 1;
      else if (subStatus === "PAUSED") counts.pausedSubscriptions += 1;
      else if (subStatus === "PENDING") counts.pendingSubscriptions += 1;
      else if (subStatus === "RECOVERING") counts.recoveringSubscriptions += 1;
      else if (subStatus === "FAILED") counts.failedSubscriptions += 1;
      else counts.activeSubscriptions += 1; // unknown non-unsubscribed → treat as active feed intent
    }
    const status = row.quote?.status;
    if (!row.quote || !status) {
      counts.unquoted += 1;
      continue;
    }
    switch (status) {
      case "LIVE":
        counts.live += 1;
        break;
      case "STALE":
        counts.stale += 1;
        break;
      case "MARKET_CLOSED":
        counts.marketClosed += 1;
        break;
      case "NO_QUOTE":
        counts.noQuote += 1;
        break;
      case "INVALID":
        counts.invalid += 1;
        break;
      case "DELAYED":
        counts.delayed += 1;
        break;
      case "ERROR":
        counts.error += 1;
        break;
      case "WAITING_FOR_DATA":
        counts.waiting += 1;
        break;
      case "INCOMPLETE":
        counts.incomplete += 1;
        break;
      default:
        counts.unquoted += 1;
    }
  }
  return counts;
}
