/**
 * STEP 1B.2 — Distinct snapshot / tick / receipt freshness for HFM quotes.
 *
 * Never treat raw broker-domain quoteTimestamp as UTC.
 * tickAgeSec requires trusted quoteTimestampUtc from B1/B1.1 normalization.
 */

import type { HfmMarketSessionState } from "./market-session.js";
import type { HfmTimestampNormalizationStatus } from "./quote-timestamp.js";
import {
  DEFAULT_MT5_HFM_FRESHNESS_POLICY,
  type Mt5HfmFreshnessPolicy,
} from "./freshness.js";

export const HFM_QUOTE_FRESHNESS_STATUSES = [
  "FRESH_TICK",
  "DELAYED_TICK",
  "STALE_TICK",
  "TICK_AGE_UNAVAILABLE",
  "QUIET_OPEN_MARKET",
  "MARKET_CLOSED",
  "TRADING_BREAK",
  "FEED_UNAVAILABLE",
  "MT5_DISCONNECTED",
  "SESSION_UNKNOWN",
  "UNTRUSTED_TIMESTAMP",
] as const;
export type HfmQuoteFreshnessStatus = (typeof HFM_QUOTE_FRESHNESS_STATUSES)[number];

export const HFM_DATA_QUALITY_STATUSES = [
  "OK",
  "DEGRADED",
  "STALE",
  "UNAVAILABLE",
  "INVALID",
] as const;
export type HfmDataQualityStatus = (typeof HFM_DATA_QUALITY_STATUSES)[number];

export interface HfmQuoteAgeAssessment {
  /** Age of the latest snapshot/file observation (from hub ageSec or equivalent). */
  snapshotAgeSec: number | null;
  /** Age of the market tick from trusted UTC tick time; null when untrusted/missing. */
  tickAgeSec: number | null;
  /** Age of local receipt timestamp vs now. */
  receiptAgeSec: number | null;
  quoteFreshnessStatus: HfmQuoteFreshnessStatus;
  dataQualityStatus: HfmDataQualityStatus;
  freshnessReason: string;
  /** Whether tickAgeSec was computed from trusted UTC normalization. */
  tickAgeTrusted: boolean;
}

/** Normalization statuses that may yield a usable quoteTimestampUtc for tick age. */
export function isTrustedHfmTimestampNormalization(
  status: HfmTimestampNormalizationStatus | null | undefined,
  quoteTimestampUtc: number | null | undefined,
): boolean {
  if (quoteTimestampUtc == null || !Number.isFinite(quoteTimestampUtc) || quoteTimestampUtc <= 0) {
    return false;
  }
  return status === "NORMALIZED" || status === "PARTIAL";
}

export function parseReceivedAtUtcSec(receivedAt: string | null | undefined): number | null {
  if (!receivedAt || typeof receivedAt !== "string") return null;
  const ms = Date.parse(receivedAt);
  if (!Number.isFinite(ms)) return null;
  return ms / 1000;
}

/**
 * Compute snapshot / tick / receipt ages and a consumer-facing freshness class.
 *
 * Quiet open market: snapshot fresh + tick older than liveMax but market open →
 * QUIET_OPEN_MARKET (not DISCONNECTED). Stale tick still surfaces as STALE_TICK
 * beyond staleMax.
 */
export function assessHfmQuoteAges(input: {
  quoteTimestampUtc: number | null | undefined;
  timestampNormalizationStatus: HfmTimestampNormalizationStatus | null | undefined;
  receivedAt: string | null | undefined;
  /** Hub/agent snapshot file age in seconds when known. */
  snapshotAgeSec?: number | null;
  marketSessionState?: HfmMarketSessionState | null;
  brokerClockFrozen?: boolean | null;
  nowSec?: number;
  policy?: Mt5HfmFreshnessPolicy;
}): HfmQuoteAgeAssessment {
  const policy = input.policy ?? DEFAULT_MT5_HFM_FRESHNESS_POLICY;
  const nowSec = input.nowSec ?? Date.now() / 1000;
  const receivedAtUtcSec = parseReceivedAtUtcSec(input.receivedAt);
  const receiptAgeSec =
    receivedAtUtcSec != null && Number.isFinite(receivedAtUtcSec)
      ? Math.max(0, nowSec - receivedAtUtcSec)
      : null;

  const snapshotAgeSec =
    input.snapshotAgeSec != null && Number.isFinite(input.snapshotAgeSec)
      ? Math.max(0, input.snapshotAgeSec)
      : receiptAgeSec;

  const tickTrusted = isTrustedHfmTimestampNormalization(
    input.timestampNormalizationStatus,
    input.quoteTimestampUtc,
  );
  const tickAgeSec = tickTrusted
    ? Math.max(0, nowSec - (input.quoteTimestampUtc as number))
    : null;

  const session = input.marketSessionState ?? null;

  if (session === "MT5_DISCONNECTED") {
    return {
      snapshotAgeSec,
      tickAgeSec,
      receiptAgeSec,
      quoteFreshnessStatus: "MT5_DISCONNECTED",
      dataQualityStatus: "UNAVAILABLE",
      freshnessReason: "MT5_DISCONNECTED",
      tickAgeTrusted: tickTrusted,
    };
  }
  if (session === "FEED_UNAVAILABLE") {
    return {
      snapshotAgeSec,
      tickAgeSec,
      receiptAgeSec,
      quoteFreshnessStatus: "FEED_UNAVAILABLE",
      dataQualityStatus: "UNAVAILABLE",
      freshnessReason: "FEED_UNAVAILABLE",
      tickAgeTrusted: tickTrusted,
    };
  }
  if (session === "MARKET_CLOSED" || input.brokerClockFrozen === true) {
    return {
      snapshotAgeSec,
      tickAgeSec,
      receiptAgeSec,
      quoteFreshnessStatus: "MARKET_CLOSED",
      dataQualityStatus: tickAgeSec != null && tickAgeSec > policy.staleMaxAgeSec ? "STALE" : "DEGRADED",
      freshnessReason: input.brokerClockFrozen ? "BROKER_CLOCK_FROZEN" : "MARKET_CLOSED",
      tickAgeTrusted: tickTrusted,
    };
  }
  if (session === "TRADING_BREAK") {
    return {
      snapshotAgeSec,
      tickAgeSec,
      receiptAgeSec,
      quoteFreshnessStatus: "TRADING_BREAK",
      dataQualityStatus: "DEGRADED",
      freshnessReason: "TRADING_BREAK",
      tickAgeTrusted: tickTrusted,
    };
  }
  if (session === "SESSION_UNKNOWN" && !tickTrusted) {
    return {
      snapshotAgeSec,
      tickAgeSec,
      receiptAgeSec,
      quoteFreshnessStatus: "SESSION_UNKNOWN",
      dataQualityStatus: "DEGRADED",
      freshnessReason: "SESSION_UNKNOWN_AND_TICK_AGE_UNTRUSTED",
      tickAgeTrusted: false,
    };
  }

  if (!tickTrusted || tickAgeSec == null) {
    return {
      snapshotAgeSec,
      tickAgeSec: null,
      receiptAgeSec,
      quoteFreshnessStatus:
        input.timestampNormalizationStatus === "UNRELIABLE" ||
        input.timestampNormalizationStatus === "UNAVAILABLE"
          ? "UNTRUSTED_TIMESTAMP"
          : "TICK_AGE_UNAVAILABLE",
      dataQualityStatus: "DEGRADED",
      freshnessReason:
        input.timestampNormalizationStatus != null
          ? `TIMESTAMP_${input.timestampNormalizationStatus}`
          : "MISSING_QUOTE_TIMESTAMP_UTC",
      tickAgeTrusted: false,
    };
  }

  if (tickAgeSec <= policy.liveMaxAgeSec) {
    return {
      snapshotAgeSec,
      tickAgeSec,
      receiptAgeSec,
      quoteFreshnessStatus: "FRESH_TICK",
      dataQualityStatus: "OK",
      freshnessReason: "TICK_WITHIN_LIVE_WINDOW",
      tickAgeTrusted: true,
    };
  }

  if (tickAgeSec <= policy.staleMaxAgeSec) {
    const snapshotFresh =
      snapshotAgeSec != null && snapshotAgeSec <= policy.liveMaxAgeSec;
    // Fresh snapshot + aging tick while session open ⇒ quiet market, not disconnect.
    if (snapshotFresh && (session === "MARKET_OPEN" || session == null || session === "SESSION_UNKNOWN")) {
      return {
        snapshotAgeSec,
        tickAgeSec,
        receiptAgeSec,
        quoteFreshnessStatus: "QUIET_OPEN_MARKET",
        dataQualityStatus: "DEGRADED",
        freshnessReason: "FRESH_SNAPSHOT_OLD_TICK_OPEN_SESSION",
        tickAgeTrusted: true,
      };
    }
    return {
      snapshotAgeSec,
      tickAgeSec,
      receiptAgeSec,
      quoteFreshnessStatus: "DELAYED_TICK",
      dataQualityStatus: "DEGRADED",
      freshnessReason: "TICK_BETWEEN_LIVE_AND_STALE",
      tickAgeTrusted: true,
    };
  }

  return {
    snapshotAgeSec,
    tickAgeSec,
    receiptAgeSec,
    quoteFreshnessStatus: "STALE_TICK",
    dataQualityStatus: "STALE",
    freshnessReason: "TICK_EXCEEDS_STALE_WINDOW",
    tickAgeTrusted: true,
  };
}

/**
 * Map tick freshness onto HfmQuoteStatus for LKG read/ingest without treating
 * snapshot-file age alone as proof of a fresh tick.
 */
export function mapQuoteFreshnessToHfmStatus(
  assessment: HfmQuoteAgeAssessment,
): "LIVE" | "DELAYED" | "STALE" | "MARKET_CLOSED" | "ERROR" | "WAITING_FOR_DATA" {
  switch (assessment.quoteFreshnessStatus) {
    case "FRESH_TICK":
      return "LIVE";
    case "QUIET_OPEN_MARKET":
    case "DELAYED_TICK":
      return "DELAYED";
    case "STALE_TICK":
      return "STALE";
    case "MARKET_CLOSED":
    case "TRADING_BREAK":
      return "MARKET_CLOSED";
    case "MT5_DISCONNECTED":
    case "FEED_UNAVAILABLE":
      return "ERROR";
    case "TICK_AGE_UNAVAILABLE":
    case "UNTRUSTED_TIMESTAMP":
    case "SESSION_UNKNOWN":
    default:
      return "WAITING_FOR_DATA";
  }
}
