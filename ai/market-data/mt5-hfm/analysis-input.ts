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
    time: number | string;
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
    quoteTimestamp: string | null;
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
    candles: args.candles.candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.tickVolume,
    })),
    quote: quoteRow
      ? {
          bid: quoteRow.bid,
          ask: quoteRow.ask,
          spread,
          quoteTimestamp: quoteRow.providerTimestamp,
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
