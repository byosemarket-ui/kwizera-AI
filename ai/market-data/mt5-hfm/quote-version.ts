/**
 * STEP 1B.3 — Quote version identity + LKG monotonic acceptance.
 *
 * quoteVersionId is deterministic from trustworthy source fields (never random,
 * never response-time based, never prices alone).
 *
 * Hub `sequence` is a snapshot/poll sequence, not a per-symbol tick counter.
 * Trusted ordering prefers quoteTimestampUtc; untrusted cases fall back to
 * sequence only when both sides have it, otherwise preserve existing LKG.
 */

import { isTrustedHfmTimestampNormalization } from "./quote-freshness.js";
import type { HfmCanonicalQuote } from "./quote-types.js";

export type HfmQuoteMonotonicDecision =
  | "ACCEPT_NEWER"
  | "ACCEPT_FIRST"
  | "ACCEPT_SAME_TICK_PRICE_UPDATE"
  | "REJECT_OLDER_TICK"
  | "REJECT_DUPLICATE"
  | "REJECT_UNTRUSTED_DISPLACE"
  | "REJECT_INCOMPARABLE";

export interface HfmQuoteMonotonicResult {
  decision: HfmQuoteMonotonicDecision;
  reason: string;
  comparisonTrusted: boolean;
  incomingVersionId: string | null;
  existingVersionId: string | null;
}

function scaledPrice(price: number | null | undefined, digits: number | null | undefined): string {
  if (price == null || !Number.isFinite(price)) return "na";
  const d =
    typeof digits === "number" && Number.isInteger(digits) && digits >= 0 && digits <= 12
      ? digits
      : 8;
  return String(Math.round(price * 10 ** d));
}

/**
 * Build a stable identity for an accepted quote version.
 * Changes when tick UTC (or broker tick when UTC unavailable), hub sequence,
 * or scaled bid/ask change. Scoped by symbol.
 */
export function buildHfmQuoteVersionId(q: {
  symbol: string;
  quoteTimestampUtc?: number | null;
  quoteTimestampUtcMs?: number | null;
  quoteTimestamp?: number | null;
  quoteTimestampMs?: number | null;
  sequence?: number | null;
  bid?: number | null;
  ask?: number | null;
  digits?: number | null;
  timestampNormalizationStatus?: string | null;
}): string {
  const sym = (q.symbol || "UNKNOWN").toUpperCase();
  const trusted = isTrustedHfmTimestampNormalization(
    q.timestampNormalizationStatus as never,
    q.quoteTimestampUtc,
  );
  const utcMs =
    q.quoteTimestampUtcMs != null && Number.isFinite(q.quoteTimestampUtcMs)
      ? Math.trunc(q.quoteTimestampUtcMs)
      : q.quoteTimestampUtc != null && Number.isFinite(q.quoteTimestampUtc)
        ? Math.trunc(q.quoteTimestampUtc * 1000)
        : null;
  const brokerMs =
    q.quoteTimestampMs != null && Number.isFinite(q.quoteTimestampMs)
      ? Math.trunc(q.quoteTimestampMs)
      : q.quoteTimestamp != null && Number.isFinite(q.quoteTimestamp)
        ? Math.trunc(q.quoteTimestamp * 1000)
        : null;
  const seq = q.sequence != null && Number.isFinite(q.sequence) ? Math.trunc(q.sequence) : "na";
  const norm = q.timestampNormalizationStatus ?? "UNAVAILABLE";
  const timePart = trusted && utcMs != null ? `utcMs=${utcMs}` : `brokerMs=${brokerMs ?? "na"}`;
  return `hfm|${sym}|${timePart}|seq=${seq}|norm=${norm}|b=${scaledPrice(q.bid, q.digits)}|a=${scaledPrice(q.ask, q.digits)}`;
}

function tickKey(q: HfmCanonicalQuote): {
  trusted: boolean;
  utcMs: number | null;
  brokerMs: number | null;
  seq: number | null;
} {
  const trusted = isTrustedHfmTimestampNormalization(
    q.timestampNormalizationStatus,
    q.quoteTimestampUtc,
  );
  const utcMs =
    q.quoteTimestampUtcMs != null && Number.isFinite(q.quoteTimestampUtcMs)
      ? Math.trunc(q.quoteTimestampUtcMs)
      : q.quoteTimestampUtc != null && Number.isFinite(q.quoteTimestampUtc)
        ? Math.trunc(q.quoteTimestampUtc * 1000)
        : null;
  const brokerMs =
    q.quoteTimestampMs != null && Number.isFinite(q.quoteTimestampMs)
      ? Math.trunc(q.quoteTimestampMs)
      : q.quoteTimestamp != null && Number.isFinite(q.quoteTimestamp)
        ? Math.trunc(q.quoteTimestamp * 1000)
        : null;
  const seq = q.sequence != null && Number.isFinite(q.sequence) ? Math.trunc(q.sequence) : null;
  return { trusted, utcMs: trusted ? utcMs : null, brokerMs, seq };
}

function pricesEqual(a: HfmCanonicalQuote, b: HfmCanonicalQuote): boolean {
  return (
    scaledPrice(a.bid, a.digits) === scaledPrice(b.bid, b.digits) &&
    scaledPrice(a.ask, a.digits) === scaledPrice(b.ask, b.digits)
  );
}

/**
 * Decide whether incoming may replace existing LKG for the same symbol.
 * Never compares raw broker time to UTC.
 */
export function compareHfmQuoteMonotonicity(
  existing: HfmCanonicalQuote | null | undefined,
  incoming: HfmCanonicalQuote,
): HfmQuoteMonotonicResult {
  const incomingVersionId = buildHfmQuoteVersionId(incoming);
  if (!existing) {
    return {
      decision: "ACCEPT_FIRST",
      reason: "NO_EXISTING_LKG",
      comparisonTrusted: Boolean(
        isTrustedHfmTimestampNormalization(
          incoming.timestampNormalizationStatus,
          incoming.quoteTimestampUtc,
        ),
      ),
      incomingVersionId,
      existingVersionId: null,
    };
  }

  const existingVersionId = existing.quoteVersionId ?? buildHfmQuoteVersionId(existing);
  if (incomingVersionId === existingVersionId) {
    return {
      decision: "REJECT_DUPLICATE",
      reason: "DUPLICATE_QUOTE_VERSION",
      comparisonTrusted: true,
      incomingVersionId,
      existingVersionId,
    };
  }

  const a = tickKey(existing);
  const b = tickKey(incoming);

  // Trusted UTC ordering when both sides trusted.
  if (a.trusted && b.trusted && a.utcMs != null && b.utcMs != null) {
    if (b.utcMs > a.utcMs) {
      return {
        decision: "ACCEPT_NEWER",
        reason: "TRUSTED_UTC_NEWER",
        comparisonTrusted: true,
        incomingVersionId,
        existingVersionId,
      };
    }
    if (b.utcMs < a.utcMs) {
      return {
        decision: "REJECT_OLDER_TICK",
        reason: "TRUSTED_UTC_OLDER_THAN_LKG",
        comparisonTrusted: true,
        incomingVersionId,
        existingVersionId,
      };
    }
    // Same trusted UTC tick time — price update is a new version of the same tick.
    if (!pricesEqual(existing, incoming)) {
      return {
        decision: "ACCEPT_SAME_TICK_PRICE_UPDATE",
        reason: "SAME_TRUSTED_UTC_PRICE_CHANGED",
        comparisonTrusted: true,
        incomingVersionId,
        existingVersionId,
      };
    }
    return {
      decision: "REJECT_DUPLICATE",
      reason: "SAME_TRUSTED_UTC_SAME_PRICES",
      comparisonTrusted: true,
      incomingVersionId,
      existingVersionId,
    };
  }

  // Untrusted incoming must not displace trusted LKG.
  if (a.trusted && !b.trusted) {
    return {
      decision: "REJECT_UNTRUSTED_DISPLACE",
      reason: "UNTRUSTED_INCOMING_CANNOT_DISPLACE_TRUSTED_LKG",
      comparisonTrusted: false,
      incomingVersionId,
      existingVersionId,
    };
  }

  // Both untrusted (or existing untrusted): use hub snapshot sequence if comparable.
  if (a.seq != null && b.seq != null) {
    if (b.seq > a.seq) {
      return {
        decision: "ACCEPT_NEWER",
        reason: "SNAPSHOT_SEQ_NEWER_UNTRUSTED_TS",
        comparisonTrusted: false,
        incomingVersionId,
        existingVersionId,
      };
    }
    if (b.seq < a.seq) {
      return {
        decision: "REJECT_OLDER_TICK",
        reason: "SNAPSHOT_SEQ_OLDER_THAN_LKG",
        comparisonTrusted: false,
        incomingVersionId,
        existingVersionId,
      };
    }
    if (!pricesEqual(existing, incoming)) {
      return {
        decision: "ACCEPT_SAME_TICK_PRICE_UPDATE",
        reason: "SAME_SEQ_PRICE_CHANGED_UNTRUSTED_TS",
        comparisonTrusted: false,
        incomingVersionId,
        existingVersionId,
      };
    }
    return {
      decision: "REJECT_DUPLICATE",
      reason: "SAME_SEQ_SAME_PRICES",
      comparisonTrusted: false,
      incomingVersionId,
      existingVersionId,
    };
  }

  // Cannot order safely — preserve existing accepted quote.
  return {
    decision: "REJECT_INCOMPARABLE",
    reason: "INCOMPARABLE_PRESERVE_LKG",
    comparisonTrusted: false,
    incomingVersionId,
    existingVersionId,
  };
}

export function isHfmMonotonicAccept(decision: HfmQuoteMonotonicDecision): boolean {
  return (
    decision === "ACCEPT_NEWER" ||
    decision === "ACCEPT_FIRST" ||
    decision === "ACCEPT_SAME_TICK_PRICE_UPDATE"
  );
}
