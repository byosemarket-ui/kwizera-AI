/**
 * Phase 4.18F.2.2 — Classify ForexConnect Offers quote events.
 * Only genuine bid/ask changes are eligible for tick capture.
 */

import type { GenuineTickEventClass } from "./genuine-tick-types.js";
import { isGenuineFcOfferEventSource } from "./live-candle-sync.js";

export interface ClassifyOfferQuoteInput {
  bid: number;
  ask: number;
  previousBid: number | null;
  previousAsk: number | null;
  eventSource?: string | null;
  sessionConnected: boolean;
  /** When session is connected but quote is older than this (ms), mark STALE_UPDATE. */
  receiptAgeMs?: number | null;
  staleThresholdMs?: number;
}

export interface ClassifyOfferQuoteResult {
  eventClass: GenuineTickEventClass;
  accepted: boolean;
  mid: number | null;
  spread: number | null;
  reason: string;
}

function isFinitePositivePair(bid: number, ask: number): boolean {
  return Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0 && ask >= bid;
}

/**
 * Classify a quote update from the live Offers path.
 * Acceptance requires: valid quote + genuine Offers provenance + real bid/ask change.
 */
export function classifyOfferQuoteEvent(input: ClassifyOfferQuoteInput): ClassifyOfferQuoteResult {
  const {
    bid,
    ask,
    previousBid,
    previousAsk,
    eventSource,
    sessionConnected,
    receiptAgeMs = null,
    staleThresholdMs = 120_000,
  } = input;

  if (!sessionConnected) {
    return {
      eventClass: "DISCONNECTED",
      accepted: false,
      mid: null,
      spread: null,
      reason: "session_disconnected",
    };
  }

  if (!isFinitePositivePair(bid, ask)) {
    return {
      eventClass: "INVALID_QUOTE",
      accepted: false,
      mid: null,
      spread: null,
      reason: "invalid_bid_ask",
    };
  }

  const mid = (bid + ask) / 2;
  const spread = ask - bid;

  if (
    receiptAgeMs != null &&
    Number.isFinite(receiptAgeMs) &&
    receiptAgeMs > staleThresholdMs
  ) {
    return {
      eventClass: "STALE_UPDATE",
      accepted: false,
      mid,
      spread,
      reason: "receipt_age_exceeds_threshold",
    };
  }

  if (previousBid == null || previousAsk == null) {
    return {
      eventClass: "INITIAL_SNAPSHOT",
      accepted: false,
      mid,
      spread,
      reason: "first_quote_for_instrument",
    };
  }

  const bidChanged = bid !== previousBid;
  const askChanged = ask !== previousAsk;

  if (!bidChanged && !askChanged) {
    const genuineSource = isGenuineFcOfferEventSource(eventSource);
    return {
      eventClass: genuineSource ? "IDENTICAL_SNAPSHOT" : "HEARTBEAT",
      accepted: false,
      mid,
      spread,
      reason: genuineSource ? "identical_bid_ask" : "non_genuine_or_poll_same_prices",
    };
  }

  if (!isGenuineFcOfferEventSource(eventSource)) {
    return {
      eventClass: "HEARTBEAT",
      accepted: false,
      mid,
      spread,
      reason: "non_genuine_event_source",
    };
  }

  if (bidChanged && askChanged) {
    return {
      eventClass: "BID_ASK_CHANGE",
      accepted: true,
      mid,
      spread,
      reason: "genuine_bid_and_ask_change",
    };
  }
  if (bidChanged) {
    return {
      eventClass: "BID_CHANGE",
      accepted: true,
      mid,
      spread,
      reason: "genuine_bid_change",
    };
  }
  return {
    eventClass: "ASK_CHANGE",
    accepted: true,
    mid,
    spread,
    reason: "genuine_ask_change",
  };
}

export function buildGenuineTickDedupeId(params: {
  instrument: string;
  receiptTimestampMs: number;
  bid: number;
  ask: number;
  eventTimestampMs?: number | null;
}): string {
  const evt = params.eventTimestampMs ?? "na";
  return `${params.instrument}|${params.receiptTimestampMs}|${evt}|${params.bid}|${params.ask}`;
}
