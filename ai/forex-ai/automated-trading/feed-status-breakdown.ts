/**
 * Phase 4.13 / 4.14B — Separate feed pipeline statuses.
 * Connected ≠ listener ≠ subscribed ≠ snapshot ≠ heartbeat ≠ genuine price change ≠ LIVE.
 */

export type AtFeedPipelineState =
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED_NO_SUBSCRIPTION"
  | "SUBSCRIBED_NO_SNAPSHOT"
  | "SNAPSHOT_ONLY"
  | "HEARTBEAT_ONLY"
  | "NO_PRICE_CHANGE"
  | "MARKET_CLOSED"
  | "STALE_QUOTE"
  | "LIVE"
  | "FEED_ERROR";

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
  hasSnapshot?: boolean | null;
}

export interface FeedStatusBreakdown {
  brokerConnected: boolean;
  offersListenerActive: boolean | null;
  instrumentSubscribed: boolean | null;
  firstQuoteReceived: boolean;
  freshPriceChangeReceived: boolean;
  marketOpen: boolean | null;
  marketClosed: boolean | null;
  pipelineState: AtFeedPipelineState;
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
    marketClosed = true;
    marketOpen = false;
  }

  const hasBidAsk = finitePositive(input.bid) && finitePositive(input.ask);
  const firstQuoteReceived =
    updateCount > 0
    || hasBidAsk
    || input.lastQuoteAtMs != null
    || input.lastReceiptAtMs != null
    || input.hasSnapshot === true;

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

  let pipelineState: AtFeedPipelineState = "FEED_ERROR";
  if (!input.brokerConnected) pipelineState = "DISCONNECTED";
  else if (input.offersListenerActive === false) pipelineState = "CONNECTED_NO_SUBSCRIPTION";
  else if (subscribed === false) pipelineState = "CONNECTED_NO_SUBSCRIPTION";
  else if (marketClosed === true && updateCount <= 0) pipelineState = "MARKET_CLOSED";
  else if (!firstQuoteReceived) pipelineState = "SUBSCRIBED_NO_SNAPSHOT";
  else if (updateCount <= 0 && hasBidAsk && input.lastReceiptAtMs != null) {
    pipelineState = input.hasSnapshot === false ? "HEARTBEAT_ONLY" : "SNAPSHOT_ONLY";
    if (input.pollChanges === 0 && (input.pollCycles ?? 0) > 0) {
      pipelineState = "NO_PRICE_CHANGE";
    }
  } else if (updateCount <= 0) pipelineState = "NO_PRICE_CHANGE";
  else if (input.quoteFreshReasonCode === "QUOTE_AGE_EXCEEDED" || String(input.streamState ?? "") === "STALE") {
    pipelineState = "STALE_QUOTE";
  } else if (freshPriceChangeReceived || input.quoteFreshReasonCode === "LIVE_FRESH") {
    pipelineState = "LIVE";
  } else if (updateCount > 0) {
    pipelineState = "HEARTBEAT_ONLY";
  } else {
    pipelineState = "NO_PRICE_CHANGE";
  }

  let primaryGap = "NONE";
  if (pipelineState === "DISCONNECTED") primaryGap = "BROKER_DISCONNECTED";
  else if (pipelineState === "CONNECTED_NO_SUBSCRIPTION") primaryGap = "INSTRUMENT_NOT_SUBSCRIBED";
  else if (pipelineState === "MARKET_CLOSED") primaryGap = "MARKET_CLOSED";
  else if (pipelineState === "SUBSCRIBED_NO_SNAPSHOT") primaryGap = "NO_SNAPSHOT";
  else if (pipelineState === "SNAPSHOT_ONLY" || pipelineState === "NO_PRICE_CHANGE" || pipelineState === "HEARTBEAT_ONLY") {
    primaryGap = "NO_GENUINE_PRICE_CHANGE";
  } else if (pipelineState === "STALE_QUOTE") primaryGap = "STALE_QUOTE";
  else if (pipelineState === "LIVE") primaryGap = "NONE";
  else primaryGap = pipelineState;

  return {
    brokerConnected: input.brokerConnected,
    offersListenerActive: input.offersListenerActive,
    instrumentSubscribed: subscribed,
    firstQuoteReceived,
    freshPriceChangeReceived,
    marketOpen,
    marketClosed,
    pipelineState,
    primaryGap,
    streamState: input.streamState,
    tradingStatus: input.tradingStatus,
    quoteFreshReasonCode: input.quoteFreshReasonCode,
    updateCount,
    note:
      "CONNECTED alone is not a live market-data feed. LIVE requires genuine bid/ask price-change events. Snapshots and heartbeats are not ticks.",
  };
}
