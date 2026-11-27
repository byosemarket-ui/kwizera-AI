/**
 * Map verified HFM MT5 market data into AI analysis input contracts.
 * Preserves provenance — never silently substitutes ForexConnect/Binance.
 */
import type { HfmMt5CandleResult, HfmMt5QuoteResult } from "./provider.js";

export interface Mt5HfmAnalysisMarketInput {
  provider: "HFM_MT5";
  environment: "demo";
  symbol: string;
  timeframe: string;
  candles: Array<{
    /** Broker-domain candle-open (compatibility). Never treat as UTC by default. */
    time: number | string;
    brokerOpenTime?: number | null;
    openTimeUtc?: number | null;
    brokerUtcOffsetSec?: number | null;
    timestampNormalizationStatus?: string | null;
    timestampNormalizationReason?: string | null;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number | null;
  }>;
  quote: {
    bid: number | null;
    ask: number | null;
    spread: number | null;
    /**
     * Legacy field — may contain broker-domain tick string from providerTimestamp.
     * Prefer quoteTimestampUtc when present. Never treat this as UTC by default.
     */
    quoteTimestamp: string | null;
    /** Trusted UTC tick ISO when available; null when untrusted/missing. */
    quoteTimestampUtc: string | null;
    /** Explicit broker-domain tick string (not UTC). */
    brokerTimestamp: string | null;
    timestampNormalizationStatus: string | null;
    quoteFreshnessStatus: string | null;
    quoteVersionId: string | null;
  } | null;
  dataSource: "HFM_MT5";
  freshness: "FRESH" | "STALE" | "UNAVAILABLE" | "UNKNOWN";
  retrievalTimestamp: string;
  verificationStatus: "verified" | "unavailable" | "stale";
  accountContext: {
    environment: "demo";
    server: string | null;
    loginHint: string | null;
  } | null;
  note: string | null;
}

export function buildMt5HfmAnalysisInput(args: {
  symbol: string;
  timeframe: string;
  candles: HfmMt5CandleResult;
  quotes?: HfmMt5QuoteResult | null;
  account?: { server: string | null; loginHint: string | null } | null;
}): Mt5HfmAnalysisMarketInput {
  const quoteRow = args.quotes?.quotes.find(
    (q) => q.providerSymbol.toUpperCase() === args.symbol.toUpperCase(),
  );
  const spread =
    quoteRow?.bid != null && quoteRow.ask != null ? quoteRow.ask - quoteRow.bid : null;

  let freshness: Mt5HfmAnalysisMarketInput["freshness"] = "UNKNOWN";
  let verification: Mt5HfmAnalysisMarketInput["verificationStatus"] = "unavailable";
  if (!args.candles.available && !args.quotes?.quotesAvailable) {
    freshness = "UNAVAILABLE";
    verification = "unavailable";
  } else if (args.quotes?.stale || quoteRow?.dataQuality === "STALE") {
    freshness = "STALE";
    verification = "stale";
  } else if (args.candles.available || args.quotes?.quotesAvailable) {
    freshness = "FRESH";
    verification = "verified";
  }

  return {
    provider: "HFM_MT5",
    environment: "demo",
    symbol: args.symbol,
    timeframe: args.timeframe,
    candles: args.candles.candles.map((c) => {
      const row = c as {
        time: number | string;
        brokerOpenTime?: number;
        openTimeUtc?: number | null;
        brokerUtcOffsetSec?: number | null;
        timestampNormalizationStatus?: string | null;
        timestampNormalizationReason?: string | null;
        open: number;
        high: number;
        low: number;
        close: number;
        tickVolume: number | null;
      };
      return {
        time: row.time,
        brokerOpenTime: row.brokerOpenTime ?? (typeof row.time === "number" ? row.time : null),
        openTimeUtc: row.openTimeUtc ?? null,
        brokerUtcOffsetSec: row.brokerUtcOffsetSec ?? null,
        timestampNormalizationStatus: row.timestampNormalizationStatus ?? null,
        timestampNormalizationReason: row.timestampNormalizationReason ?? null,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.tickVolume,
      };
    }),
    quote: quoteRow
      ? {
          bid: quoteRow.bid,
          ask: quoteRow.ask,
          spread,
          // Legacy: historically filled from providerTimestamp (broker-domain). Keep but annotate.
          quoteTimestamp: quoteRow.normalizedTimestamp,
          quoteTimestampUtc:
            quoteRow.normalizedTimestamp &&
            quoteRow.dataQuality !== "NO_DATA" &&
            quoteRow.dataQuality !== "DISCONNECTED"
              ? quoteRow.normalizedTimestamp
              : null,
          brokerTimestamp: quoteRow.providerTimestamp,
          timestampNormalizationStatus:
            quoteRow.normalizedTimestamp && quoteRow.providerTimestamp
              ? "NORMALIZED"
              : quoteRow.providerTimestamp
                ? "UNAVAILABLE"
                : null,
          quoteFreshnessStatus:
            quoteRow.dataQuality === "LIVE"
              ? "FRESH_TICK"
              : quoteRow.dataQuality === "STALE"
                ? "STALE_TICK"
                : null,
          quoteVersionId: null,
        }
      : null,
    dataSource: "HFM_MT5",
    freshness,
    retrievalTimestamp: args.candles.retrievedAt ?? args.quotes?.retrievedAt ?? new Date().toISOString(),
    verificationStatus: verification,
    accountContext: args.account
      ? {
          environment: "demo",
          server: args.account.server,
          loginHint: args.account.loginHint,
        }
      : null,
    note:
      verification === "verified"
        ? null
        : args.candles.unavailableReason ?? args.quotes?.unavailableReason ?? "HFM MT5 data not verified",
  };
}
