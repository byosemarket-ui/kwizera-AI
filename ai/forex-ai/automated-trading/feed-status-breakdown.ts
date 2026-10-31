/**
 * Phase 4.13 — Separate feed pipeline statuses.
 * Connected ≠ listener ≠ subscribed ≠ first quote ≠ fresh price change ≠ market open.
 */

export interface FeedStatusBreakdownInput {
  brokerConnected: boolean;
  offersListenerActive: boolean | null;
  instrumentSubscribed: boolean | null;
  subscriptionSymbols?: string[] | null;
  instrument: string | null;
  updateCount: number | null;
  lastQuoteAtMs: number | null;
  lastPriceChangeAtMs: number | null;
  lastReceiptAtMs: number | null;
  bid: number | null;
  ask: number | null;
  streamState: string | null;
  tradingStatus: string | null;
  quoteFreshReasonCode: string | null;
  pollCycles?: number | null;
  pollChanges?: number | null;
}

export interface FeedStatusBreakdown {
  brokerConnected: boolean;
  offersListenerActive: boolean | null;
  instrumentSubscribed: boolean | null;
  firstQuoteReceived: boolean;
  freshPriceChangeReceived: boolean;
  marketOpen: boolean | null;
  marketClosed: boolean | null;
  /** Human summary of the weakest link (not a fabricated LIVE claim). */
  primaryGap: string;
  streamState: string | null;
  tradingStatus: string | null;
  quoteFreshReasonCode: string | null;
  updateCount: number;
  note: string;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Derive discrete statuses from Offers / live-session evidence.
 * Never invents LIVE or market-open from CONNECTED alone.
 */
export function buildFeedStatusBreakdown(input: FeedStatusBreakdownInput): FeedStatusBreakdown {
  const updateCount =
    typeof input.updateCount === "number" && Number.isFinite(input.updateCount)
      ? Math.max(0, Math.floor(input.updateCount))
      : 0;
  const ts = String(input.tradingStatus ?? "").trim().toUpperCase();
  let marketOpen: boolean | null = null;
  let marketClosed: boolean | null = null;
  if (ts === "O" || ts === "OPEN") {
    marketOpen = true;
    marketClosed = false;
  } else if (ts === "C" || ts === "CLOSED") {
    marketOpen = false;
    marketClosed = true;
  } else if (
    input.quoteFreshReasonCode === "MARKET_CLOSED"
    || input.quoteFreshReasonCode === "MARKET_INACTIVE"
    || String(input.streamState ?? "").toUpperCase() === "MARKET_INACTIVE"
    || String(input.streamState ?? "").toUpperCase() === "MARKET_CLOSED"
  ) {
    // Soft closed inference from feed classifiers — not a calendar invention.
    marketClosed = true;
    marketOpen = false;
  }

  const firstQuoteReceived =
    updateCount > 0
    || finitePositive(input.bid)
    || input.lastQuoteAtMs != null
    || input.lastReceiptAtMs != null;

  const freshPriceChangeReceived =
    updateCount > 0
    && input.lastPriceChangeAtMs != null
    && input.quoteFreshReasonCode === "LIVE_FRESH";

  const subscribed =
    input.instrumentSubscribed != null
      ? input.instrumentSubscribed
      : (input.instrument != null
        && Array.isArray(input.subscriptionSymbols)
        && input.subscriptionSymbols.some(
          (s) => String(s).replace(/\s+/g, "").toUpperCase()
            === String(input.instrument).replace(/\s+/g, "").toUpperCase(),
        ));

  let primaryGap = "NONE";
  if (!input.brokerConnected) primaryGap = "BROKER_DISCONNECTED";
  else if (input.offersListenerActive === false) primaryGap = "OFFERS_LISTENER_INACTIVE";
  else if (subscribed === false) primaryGap = "INSTRUMENT_NOT_SUBSCRIBED";
  else if (marketClosed === true) primaryGap = "MARKET_CLOSED";
  else if (updateCount <= 0) primaryGap = "NO_PRICE_CHANGE_EVENTS";
  else if (!freshPriceChangeReceived) primaryGap = "NO_FRESH_PRICE_CHANGE";
  else primaryGap = "NONE";

  return {
    brokerConnected: input.brokerConnected,
    offersListenerActive: input.offersListenerActive,
    instrumentSubscribed: subscribed,
    firstQuoteReceived,
    freshPriceChangeReceived,
    marketOpen,
    marketClosed,
    primaryGap,
    streamState: input.streamState,
    tradingStatus: input.tradingStatus,
    quoteFreshReasonCode: input.quoteFreshReasonCode,
    updateCount,
    note:
      "CONNECTED alone is not a live market-data feed. LIVE requires genuine bid/ask price-change events.",
  };
}
