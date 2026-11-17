/**
 * Map dashboard SSE quote ticks into canonical HFM quotes for the Market Watch table.
 * Never invents LIVE prices. Preserves snapshot fields when the tick is incomplete.
 */

import type { HfmCanonicalQuote, HfmQuoteStatus } from "../../../../ai/market-data/mt5-hfm/quote-types";
import type { HfmQuoteState } from "../types";

function freshnessToStatus(freshness: HfmQuoteState["freshness"], status: string | null): HfmQuoteStatus {
  if (status === "LIVE" || status === "STALE" || status === "MARKET_CLOSED" || status === "NO_QUOTE" ||
      status === "INVALID" || status === "INCOMPLETE" || status === "DELAYED" || status === "ERROR" ||
      status === "WAITING_FOR_DATA") {
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
    quoteTimestamp: tick.tickTime ?? prior?.quoteTimestamp ?? null,
    quoteTimestampMs:
      tick.tickTime != null && Number.isFinite(tick.tickTime)
        ? tick.tickTime * 1000
        : prior?.quoteTimestampMs ?? null,
    receivedAt: prior?.receivedAt ?? new Date().toISOString(),
    sequence: prior?.sequence ?? null,
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

export function mergeSseQuotesIntoCanonicalMap(
  snapshot: Record<string, HfmCanonicalQuote>,
  sseQuotes: Record<string, HfmQuoteState>,
): Record<string, HfmCanonicalQuote> {
  const out: Record<string, HfmCanonicalQuote> = { ...snapshot };
  for (const [sym, tick] of Object.entries(sseQuotes)) {
    const key = sym.toUpperCase();
    const prior = out[key] ?? out[sym] ?? null;
    const next = hfmSseQuoteToCanonical(tick, prior);
    if (next) out[key] = next;
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
  activeSubscriptions: number;
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
  };
  for (const row of rows) {
    if (row.subscription && row.subscription.status !== "UNSUBSCRIBED") {
      counts.activeSubscriptions += 1;
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
