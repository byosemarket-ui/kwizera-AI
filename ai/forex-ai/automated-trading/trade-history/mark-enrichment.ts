/**
 * Phase 60.0.3 — Enrich open trades with verified Offers mark prices.
 * Reuses pollQuotes() from the shared ForexConnect bridge — no second session/subscription.
 * BUY → bid (sell-to-close), SELL → ask (buy-to-close). Never invents P/L.
 */
import { normalizeCanonicalSymbol } from "../../../market-data/providers/identity.js";
import type { ForexConnectLiveQuote } from "../../../market-data/forexconnect/live-types.js";
import {
  AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS,
  MARKET_QUOTE_STALE_MS,
} from "../quote-freshness.js";
import { safeFiniteNumber as asFinite } from "./safe-number.js";

export type MarkQuoteFreshnessCode =
  | "QUOTE_RECEIVED"
  | "QUOTE_STALE"
  | "QUOTE_NOT_RECEIVED"
  | "QUOTE_INVALID"
  | "INSTRUMENT_MISMATCH"
  | "SIDE_UNKNOWN"
  | "BROKER_CLOSE_ONLY";

export type MarkPriceSide = "bid" | "ask";

export interface EnrichedOpenTradeMark {
  markPrice: number | null;
  markPriceSide: MarkPriceSide | null;
  markPriceSource: string | null;
  markQuoteFreshness: MarkQuoteFreshnessCode;
  markQuoteAgeMs: number | null;
  markOfferId: string | null;
  markBid: number | null;
  markAsk: number | null;
  markSourceTimestampMs: number | null;
  markReceivedAtMs: number | null;
  /** Broker Trades.close when present — not labeled live unless freshness is QUOTE_RECEIVED from Offers. */
  brokerClosePrice: number | null;
  brokerClosePriceSource: string | null;
  /** Floating P/L provenance — broker gross_pl only; never locally invented. */
  floatingPl: number | null;
  floatingPlSource: string | null;
  floatingPlProvenance: "broker-trades-gross_pl" | "unavailable";
}

function asString(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export function resolveTradeSide(side: string | null | undefined): "BUY" | "SELL" | null {
  const raw = String(side ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (raw === "B" || raw === "BUY" || raw.includes("BUY")) return "BUY";
  if (raw === "S" || raw === "SELL" || raw.includes("SELL")) return "SELL";
  return null;
}

/** Close-side mark: BUY valued at bid; SELL valued at ask. */
export function selectMarkSide(side: "BUY" | "SELL"): MarkPriceSide {
  return side === "BUY" ? "bid" : "ask";
}

export function findMatchingOfferQuote(
  quotes: ReadonlyArray<ForexConnectLiveQuote>,
  input: { offerId?: string | null; instrument?: string | null },
): ForexConnectLiveQuote | null {
  const offerId = asString(input.offerId);
  if (offerId) {
    const byOffer = quotes.find((q) => asString(q.offerId) === offerId);
    if (byOffer) return byOffer;
  }
  const instrument = asString(input.instrument);
  if (!instrument) return null;
  const canon = normalizeCanonicalSymbol(instrument);
  if (!canon) return null;
  const bySymbol = quotes.find((q) => {
    const c1 = normalizeCanonicalSymbol(q.canonicalSymbol || "");
    const c2 = normalizeCanonicalSymbol(q.providerSymbol || "");
    return c1 === canon || c2 === canon;
  });
  return bySymbol ?? null;
}

function evaluateOfferFreshness(
  quote: ForexConnectLiveQuote,
  nowMs: number,
  staleMs: number,
): { code: MarkQuoteFreshnessCode; ageMs: number | null } {
  const bid = asFinite(quote.bid);
  const ask = asFinite(quote.ask);
  if (bid == null || ask == null || bid <= 0 || ask <= 0) {
    return { code: "QUOTE_INVALID", ageMs: null };
  }
  if (bid > ask) {
    return { code: "QUOTE_INVALID", ageMs: null };
  }

  const sourceTs = asFinite(quote.sourceTimestampMs);
  const receivedAt = asFinite(quote.receivedAtMs);
  if (sourceTs != null && sourceTs > nowMs + AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS) {
    return { code: "QUOTE_INVALID", ageMs: null };
  }
  if (receivedAt != null && receivedAt > nowMs + AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS) {
    return { code: "QUOTE_INVALID", ageMs: null };
  }

  const anchor = sourceTs ?? receivedAt;
  if (anchor == null) {
    return { code: "QUOTE_NOT_RECEIVED", ageMs: null };
  }
  const ageMs = Math.max(0, nowMs - anchor);
  if (ageMs > staleMs) {
    return { code: "QUOTE_STALE", ageMs };
  }
  return { code: "QUOTE_RECEIVED", ageMs };
}

export function enrichOpenTradeMark(
  trade: Record<string, unknown>,
  quotes: ReadonlyArray<ForexConnectLiveQuote>,
  options?: { nowMs?: number; staleMs?: number },
): EnrichedOpenTradeMark {
  const nowMs = options?.nowMs ?? Date.now();
  const staleMs = options?.staleMs ?? MARKET_QUOTE_STALE_MS;

  const brokerClosePrice = asFinite(trade.currentPrice ?? trade.close ?? trade.closeRate);
  const brokerClosePriceSource = asString(trade.currentPriceSource)
    ?? (brokerClosePrice != null ? "forexconnect-trades.close" : null);

  const floatingPl = asFinite(trade.floatingPl ?? trade.grossPl ?? trade.grossPL);
  const floatingPlSource = asString(trade.floatingPlSource)
    ?? (floatingPl != null ? "forexconnect-trades.gross_pl" : null);

  const side = resolveTradeSide(asString(trade.side));
  if (!side) {
    return {
      markPrice: null,
      markPriceSide: null,
      markPriceSource: null,
      markQuoteFreshness: "SIDE_UNKNOWN",
      markQuoteAgeMs: null,
      markOfferId: null,
      markBid: null,
      markAsk: null,
      markSourceTimestampMs: null,
      markReceivedAtMs: null,
      brokerClosePrice,
      brokerClosePriceSource,
      floatingPl,
      floatingPlSource,
      floatingPlProvenance: floatingPl != null ? "broker-trades-gross_pl" : "unavailable",
    };
  }

  const match = findMatchingOfferQuote(quotes, {
    offerId: asString(trade.offerId),
    instrument: asString(trade.instrument),
  });

  if (!match) {
    return {
      markPrice: null,
      markPriceSide: selectMarkSide(side),
      markPriceSource: null,
      markQuoteFreshness: brokerClosePrice != null ? "BROKER_CLOSE_ONLY" : "QUOTE_NOT_RECEIVED",
      markQuoteAgeMs: null,
      markOfferId: asString(trade.offerId),
      markBid: null,
      markAsk: null,
      markSourceTimestampMs: null,
      markReceivedAtMs: null,
      brokerClosePrice,
      brokerClosePriceSource,
      floatingPl,
      floatingPlSource,
      floatingPlProvenance: floatingPl != null ? "broker-trades-gross_pl" : "unavailable",
    };
  }

  // If trade had offerId and match was by symbol only with different offerId — still OK when
  // offerId was absent on trade. If both present and mismatched, treat as instrument mismatch.
  const tradeOfferId = asString(trade.offerId);
  const quoteOfferId = asString(match.offerId);
  if (tradeOfferId && quoteOfferId && tradeOfferId !== quoteOfferId) {
    const tradeCanon = normalizeCanonicalSymbol(asString(trade.instrument) ?? "");
    const quoteCanon = normalizeCanonicalSymbol(match.canonicalSymbol || match.providerSymbol || "");
    if (tradeCanon && quoteCanon && tradeCanon !== quoteCanon) {
      return {
        markPrice: null,
        markPriceSide: selectMarkSide(side),
        markPriceSource: null,
        markQuoteFreshness: "INSTRUMENT_MISMATCH",
        markQuoteAgeMs: null,
        markOfferId: quoteOfferId,
        markBid: asFinite(match.bid),
        markAsk: asFinite(match.ask),
        markSourceTimestampMs: asFinite(match.sourceTimestampMs),
        markReceivedAtMs: asFinite(match.receivedAtMs),
        brokerClosePrice,
        brokerClosePriceSource,
        floatingPl,
        floatingPlSource,
        floatingPlProvenance: floatingPl != null ? "broker-trades-gross_pl" : "unavailable",
      };
    }
  }

  const freshness = evaluateOfferFreshness(match, nowMs, staleMs);
  const markSide = selectMarkSide(side);
  const bid = asFinite(match.bid);
  const ask = asFinite(match.ask);
  const rawMark = markSide === "bid" ? bid : ask;

  const live =
    freshness.code === "QUOTE_RECEIVED"
    && rawMark != null
    && rawMark > 0;

  return {
    markPrice: live ? rawMark : null,
    markPriceSide: markSide,
    markPriceSource: live ? `forexconnect-offers.${markSide}` : null,
    markQuoteFreshness: freshness.code,
    markQuoteAgeMs: freshness.ageMs,
    markOfferId: quoteOfferId,
    markBid: bid,
    markAsk: ask,
    markSourceTimestampMs: asFinite(match.sourceTimestampMs),
    markReceivedAtMs: asFinite(match.receivedAtMs),
    brokerClosePrice,
    brokerClosePriceSource,
    floatingPl,
    floatingPlSource,
    floatingPlProvenance: floatingPl != null ? "broker-trades-gross_pl" : "unavailable",
  };
}

export function enrichOpenTradesWithMarks(
  trades: unknown[],
  quotes: ReadonlyArray<ForexConnectLiveQuote>,
  options?: { nowMs?: number; staleMs?: number },
): Record<string, unknown>[] {
  return trades.map((raw) => {
    const trade = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const mark = enrichOpenTradeMark(trade, quotes, options);
    // Prefer verified Offers mark for display currentPrice when fresh; else keep broker close
    // but never label stale/missing Offers as live.
    const displayPrice = mark.markPrice ?? null;
    const displaySource = mark.markPriceSource
      ?? (mark.markQuoteFreshness === "BROKER_CLOSE_ONLY" ? mark.brokerClosePriceSource : null);
    return {
      ...trade,
      markPrice: mark.markPrice,
      markPriceSide: mark.markPriceSide,
      markPriceSource: mark.markPriceSource,
      markQuoteFreshness: mark.markQuoteFreshness,
      markQuoteAgeMs: mark.markQuoteAgeMs,
      markOfferId: mark.markOfferId,
      markBid: mark.markBid,
      markAsk: mark.markAsk,
      markSourceTimestampMs: mark.markSourceTimestampMs,
      markReceivedAtMs: mark.markReceivedAtMs,
      brokerClosePrice: mark.brokerClosePrice,
      brokerClosePriceSource: mark.brokerClosePriceSource,
      // currentPrice: verified live mark only — never stale Offers or invented values.
      currentPrice: displayPrice ?? (mark.markQuoteFreshness === "BROKER_CLOSE_ONLY" ? mark.brokerClosePrice : null),
      currentPriceSource:
        displaySource
        ?? (mark.markQuoteFreshness === "BROKER_CLOSE_ONLY" ? mark.brokerClosePriceSource : null),
      floatingPl: mark.floatingPl,
      floatingPlSource: mark.floatingPlSource,
      floatingPlProvenance: mark.floatingPlProvenance,
      // Never invent local floating P/L.
      locallyCalculatedFloatingPl: null,
    };
  });
}
