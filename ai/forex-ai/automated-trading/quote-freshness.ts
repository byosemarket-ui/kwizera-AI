/**
 * Canonical quote-freshness contract for Phase 52 verification, Phase 53.3 monitoring,
 * and Phase 54 decisions.
 *
 * Rules:
 * - Heartbeat/receipts alone never make quotes fresh.
 * - Historical candles alone never qualify as LIVE quotes.
 * - Cached verification snapshots age forward using verifiedAtUtc + snapshot ages.
 * - Source vs server receipt timestamps are reported distinctly when present.
 */
import { createHash } from "node:crypto";
import { MARKET_QUOTE_STALE_MS } from "./verification-types.js";
import type { AutomatedTradingVerificationResult } from "./verification-types.js";

export { MARKET_QUOTE_STALE_MS };

/** Clock skew tolerance for future-dated timestamps. */
export const AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS = 5_000;

export type AtQuoteFreshnessReasonCode =
  | "LIVE_FRESH"
  | "VERIFICATION_MISSING"
  | "VERIFICATION_TIMESTAMP_INVALID"
  | "VERIFICATION_TIMESTAMP_FUTURE"
  | "INSTRUMENT_MISMATCH"
  | "BID_ASK_MISSING"
  | "BID_ASK_INVALID"
  | "FEED_NOT_LIVE"
  | "NO_QUOTE_UPDATES"
  | "PRICE_CHANGE_AGE_UNKNOWN"
  | "HEARTBEAT_ONLY_NO_PRICE_CHANGE"
  | "QUOTE_AGE_EXCEEDED"
  | "SOURCE_TIMESTAMP_FUTURE"
  | "SOURCE_TIMESTAMP_TOO_OLD";

export interface AtQuoteFreshnessEvaluation {
  fresh: boolean;
  reasonCode: AtQuoteFreshnessReasonCode;
  instrument: string | null;
  feedStatus: string | null;
  bid: number | null;
  ask: number | null;
  sourceTimestampMs: number | null;
  receivedAtMs: number | null;
  verifiedAtUtc: string | null;
  verificationAgeMs: number | null;
  priceChangeAgeMsAtSnapshot: number | null;
  receiptAgeMsAtSnapshot: number | null;
  effectivePriceChangeAgeMs: number | null;
  effectiveReceiptAgeMs: number | null;
  updateCount: number;
  freshnessThresholdMs: number;
  evaluatedAtMs: number;
  evaluatedAtUtc: string;
  /** Stable id for the evaluated verification snapshot (not a secret). */
  snapshotFingerprint: string | null;
}

function snapshotFingerprint(verification: AutomatedTradingVerificationResult): string {
  const m = verification.market;
  const h = createHash("sha256");
  h.update(verification.verifiedAtUtc ?? "");
  h.update("|");
  h.update(String(verification.instrument?.symbol ?? ""));
  h.update("|");
  h.update(String(m?.feedStatus ?? ""));
  h.update("|");
  h.update(`${m?.bid}:${m?.ask}:${m?.priceChangeAgeMs}:${m?.receiptAgeMs}:${m?.updateCount}`);
  return h.digest("hex").slice(0, 16);
}

function emptyEval(
  nowMs: number,
  staleMs: number,
  reasonCode: AtQuoteFreshnessReasonCode,
  partial: Partial<AtQuoteFreshnessEvaluation> = {},
): AtQuoteFreshnessEvaluation {
  return {
    fresh: false,
    reasonCode,
    instrument: null,
    feedStatus: null,
    bid: null,
    ask: null,
    sourceTimestampMs: null,
    receivedAtMs: null,
    verifiedAtUtc: null,
    verificationAgeMs: null,
    priceChangeAgeMsAtSnapshot: null,
    receiptAgeMsAtSnapshot: null,
    effectivePriceChangeAgeMs: null,
    effectiveReceiptAgeMs: null,
    updateCount: 0,
    freshnessThresholdMs: staleMs,
    evaluatedAtMs: nowMs,
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    snapshotFingerprint: null,
    ...partial,
  };
}

/**
 * Evaluate whether a Phase 52 verification snapshot still represents fresh LIVE Bid/Ask.
 * Always pass `nowMs` in tests for determinism.
 */
export function evaluateVerificationQuoteFreshness(
  verification: AutomatedTradingVerificationResult | null | undefined,
  options?: {
    nowMs?: number;
    expectedInstrument?: string | null;
    staleMs?: number;
  },
): AtQuoteFreshnessEvaluation {
  const nowMs = options?.nowMs ?? Date.now();
  const staleMs = options?.staleMs ?? MARKET_QUOTE_STALE_MS;

  if (!verification) {
    return emptyEval(nowMs, staleMs, "VERIFICATION_MISSING");
  }

  const market = verification.market;
  const instrument = verification.instrument?.symbol
    ? String(verification.instrument.symbol).trim()
    : null;
  const expected = options?.expectedInstrument
    ? String(options.expectedInstrument).trim()
    : "";

  const common = {
    instrument,
    feedStatus: market?.feedStatus ? String(market.feedStatus) : null,
    bid: typeof market?.bid === "number" && Number.isFinite(market.bid) ? market.bid : null,
    ask: typeof market?.ask === "number" && Number.isFinite(market.ask) ? market.ask : null,
    sourceTimestampMs:
      typeof market?.sourceTimestampMs === "number" && Number.isFinite(market.sourceTimestampMs)
        ? market.sourceTimestampMs
        : null,
    receivedAtMs:
      typeof market?.receivedAtMs === "number" && Number.isFinite(market.receivedAtMs)
        ? market.receivedAtMs
        : null,
    verifiedAtUtc: verification.verifiedAtUtc ?? null,
    priceChangeAgeMsAtSnapshot:
      typeof market?.priceChangeAgeMs === "number" && Number.isFinite(market.priceChangeAgeMs)
        ? market.priceChangeAgeMs
        : null,
    receiptAgeMsAtSnapshot:
      typeof market?.receiptAgeMs === "number" && Number.isFinite(market.receiptAgeMs)
        ? market.receiptAgeMs
        : null,
    updateCount:
      typeof market?.updateCount === "number" && Number.isFinite(market.updateCount)
        ? Math.max(0, Math.floor(market.updateCount))
        : 0,
    snapshotFingerprint: snapshotFingerprint(verification),
  };

  if (expected && instrument && expected !== instrument) {
    return emptyEval(nowMs, staleMs, "INSTRUMENT_MISMATCH", common);
  }

  const verifiedAtMs = Date.parse(String(verification.verifiedAtUtc ?? ""));
  if (!Number.isFinite(verifiedAtMs) || verifiedAtMs <= 0) {
    return emptyEval(nowMs, staleMs, "VERIFICATION_TIMESTAMP_INVALID", common);
  }
  if (verifiedAtMs > nowMs + AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS) {
    return emptyEval(nowMs, staleMs, "VERIFICATION_TIMESTAMP_FUTURE", {
      ...common,
      verificationAgeMs: verifiedAtMs - nowMs,
    });
  }

  const verificationAgeMs = Math.max(0, nowMs - verifiedAtMs);

  if (common.bid == null || common.ask == null) {
    return emptyEval(nowMs, staleMs, "BID_ASK_MISSING", {
      ...common,
      verificationAgeMs,
    });
  }
  if (!(common.bid > 0) || !(common.ask > 0) || common.ask < common.bid) {
    return emptyEval(nowMs, staleMs, "BID_ASK_INVALID", {
      ...common,
      verificationAgeMs,
    });
  }

  if (String(market?.feedStatus ?? "") !== "LIVE") {
    return emptyEval(nowMs, staleMs, "FEED_NOT_LIVE", {
      ...common,
      verificationAgeMs,
    });
  }

  if (
    common.sourceTimestampMs != null
    && common.sourceTimestampMs > nowMs + AT_QUOTE_FRESHNESS_CLOCK_SKEW_MS
  ) {
    return emptyEval(nowMs, staleMs, "SOURCE_TIMESTAMP_FUTURE", {
      ...common,
      verificationAgeMs,
    });
  }

  // Age-forward snapshot ages so a frozen LIVE verification expires honestly.
  const effectivePriceChangeAgeMs =
    common.priceChangeAgeMsAtSnapshot != null
      ? common.priceChangeAgeMsAtSnapshot + verificationAgeMs
      : null;
  const effectiveReceiptAgeMs =
    common.receiptAgeMsAtSnapshot != null
      ? common.receiptAgeMsAtSnapshot + verificationAgeMs
      : null;

  // Absolute source-age is a fallback only when genuine price-change age is unknown.
  // Broker source timestamps may lag Bid/Ask change clocks; do not override a fresh
  // priceChangeAge with SOURCE_TIMESTAMP_TOO_OLD. Second-based values are ignored
  // (must look like epoch milliseconds).
  if (
    effectivePriceChangeAgeMs == null
    && common.sourceTimestampMs != null
    && common.sourceTimestampMs > 1e12
    && nowMs - common.sourceTimestampMs > staleMs * 4
  ) {
    return emptyEval(nowMs, staleMs, "SOURCE_TIMESTAMP_TOO_OLD", {
      ...common,
      verificationAgeMs,
      effectivePriceChangeAgeMs,
      effectiveReceiptAgeMs,
    });
  }

  if (common.updateCount <= 0) {
    return emptyEval(nowMs, staleMs, "NO_QUOTE_UPDATES", {
      ...common,
      verificationAgeMs,
      effectivePriceChangeAgeMs,
      effectiveReceiptAgeMs,
    });
  }

  if (effectivePriceChangeAgeMs == null) {
    return emptyEval(nowMs, staleMs, "PRICE_CHANGE_AGE_UNKNOWN", {
      ...common,
      verificationAgeMs,
      effectivePriceChangeAgeMs,
      effectiveReceiptAgeMs,
    });
  }

  if (effectivePriceChangeAgeMs > staleMs) {
    // Receipts without a recent Bid/Ask change = heartbeat only.
    if (effectiveReceiptAgeMs != null && effectiveReceiptAgeMs <= staleMs) {
      return emptyEval(nowMs, staleMs, "HEARTBEAT_ONLY_NO_PRICE_CHANGE", {
        ...common,
        verificationAgeMs,
        effectivePriceChangeAgeMs,
        effectiveReceiptAgeMs,
      });
    }
    return emptyEval(nowMs, staleMs, "QUOTE_AGE_EXCEEDED", {
      ...common,
      verificationAgeMs,
      effectivePriceChangeAgeMs,
      effectiveReceiptAgeMs,
    });
  }

  return {
    fresh: true,
    reasonCode: "LIVE_FRESH",
    ...common,
    verificationAgeMs,
    effectivePriceChangeAgeMs,
    effectiveReceiptAgeMs,
    freshnessThresholdMs: staleMs,
    evaluatedAtMs: nowMs,
    evaluatedAtUtc: new Date(nowMs).toISOString(),
  };
}

/**
 * Apply live freshness evaluation onto the readiness gates used by the UI/status API.
 * Does not mutate the stored verification snapshot.
 */
export function withEvaluatedMarketReadiness(
  verification: AutomatedTradingVerificationResult,
  evaluation: AtQuoteFreshnessEvaluation,
): AutomatedTradingVerificationResult {
  const marketDataHealthVerified = evaluation.fresh;
  const readyForFutureAnalysis =
    verification.readiness.environmentVerified
    && verification.readiness.accountIdentityVerified
    && verification.readiness.accountMetadataSufficient
    && verification.readiness.instrumentMetadataVerified
    && marketDataHealthVerified;

  return {
    ...verification,
    readiness: {
      ...verification.readiness,
      marketDataHealthVerified,
      readyForFutureAnalysis,
      readyForTrading: false,
    },
  };
}
