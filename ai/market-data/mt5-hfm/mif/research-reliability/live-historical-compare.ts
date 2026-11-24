/**
 * Phase 09 live vs historical comparison — semantic-safe (bid/ask ≠ candle close).
 */
import { createHash } from "node:crypto";
import type { MifResearchReliabilityPolicy } from "./policies.js";
import type {
  HfmLiveHistoricalCompareReport,
  HfmLiveHistoricalDivergence,
  HfmQuoteSnapshotInput,
} from "./types.js";

export function compareLiveVsHistorical(input: {
  symbol: string;
  timeframe: string;
  quote: HfmQuoteSnapshotInput | null | undefined;
  lastClosedCandle: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
  } | null | undefined;
  policy: MifResearchReliabilityPolicy;
}): HfmLiveHistoricalCompareReport {
  const symbol = String(input.symbol || "").toUpperCase();
  const timeframe = String(input.timeframe || "").toUpperCase();
  const divergences: HfmLiveHistoricalDivergence[] = [];

  if (!input.quote || input.quote.bid == null || input.quote.ask == null) {
    return {
      status: "INSUFFICIENT_DATA",
      symbol,
      timeframe,
      comparisonWindowStartSec: null,
      comparisonWindowEndSec: null,
      quoteSourceId: null,
      candleSourceId: null,
      note: "Missing live quote for comparison",
      semanticGuard:
        "live_bid_ask_not_automatically_candle_close; forming_candles_excluded",
      divergences: [],
      evidenceKind: "UNAVAILABLE",
    };
  }
  if (!input.lastClosedCandle) {
    return {
      status: "INSUFFICIENT_DATA",
      symbol,
      timeframe,
      comparisonWindowStartSec: null,
      comparisonWindowEndSec: null,
      quoteSourceId: null,
      candleSourceId: null,
      note: "Missing last closed candle — forming candles excluded",
      semanticGuard:
        "live_bid_ask_not_automatically_candle_close; forming_candles_excluded",
      divergences: [],
      evidenceKind: "UNAVAILABLE",
    };
  }

  const mid = (input.quote.bid + input.quote.ask) / 2;
  const close = input.lastClosedCandle.close;
  const quoteTs = input.quote.providerTimestampSec;
  const candleTs = input.lastClosedCandle.time;

  // If quote is clearly from a different period than the closed candle, not comparable.
  if (quoteTs != null && Number.isFinite(quoteTs) && Math.abs(quoteTs - candleTs) > 86400) {
    return {
      status: "NOT_COMPARABLE",
      symbol,
      timeframe,
      comparisonWindowStartSec: Math.min(quoteTs, candleTs),
      comparisonWindowEndSec: Math.max(quoteTs, candleTs),
      quoteSourceId: `quote:${symbol}:${quoteTs}`,
      candleSourceId: `candle:${symbol}:${candleTs}`,
      note: "Quote and closed candle timestamps differ by >1d — not treated as same market state",
      semanticGuard:
        "live_bid_ask_not_automatically_candle_close; forming_candles_excluded",
      divergences: [],
      evidenceKind: "INFERRED",
    };
  }

  // Semantic check: mid should typically lie within candle high/low if same session window.
  const { high, low } = input.lastClosedCandle;
  let status: HfmLiveHistoricalCompareReport["status"] = "CONSISTENT";
  if (!(mid >= low - 1e-9 && mid <= high + 1e-9)) {
    const diff = mid < low ? low - mid : mid - high;
    const tol = Math.max(close, 1) * input.policy.comparePriceToleranceFrac;
    const severity = diff > tol * 5 ? "CRITICAL" : "WARNING";
    divergences.push({
      symbol,
      timeframe,
      timestampSec: candleTs,
      comparedFields: ["quote_mid", "candle_high_low"],
      difference: diff,
      tolerance: tol,
      severity,
      explanation:
        "Live mid outside last closed candle high/low range — may be later market move or data mismatch; bid/ask are not candle close",
      sourceIds: [`quote:${symbol}`, `candle:${symbol}:${candleTs}`],
    });
    status = diff > tol ? "DIVERGENT" : "CONSISTENT_WITH_WARNINGS";
  }

  // Optional close proximity warning (never required equality).
  if (close > 0) {
    const closeDiffFrac = Math.abs(mid - close) / close;
    if (closeDiffFrac > input.policy.comparePriceToleranceFrac * 10) {
      divergences.push({
        symbol,
        timeframe,
        timestampSec: candleTs,
        comparedFields: ["quote_mid", "candle_close"],
        difference: mid - close,
        tolerance: close * input.policy.comparePriceToleranceFrac,
        severity: "INFO",
        explanation:
          "Mid vs close difference noted for diagnostics only — not an integrity failure by itself",
        sourceIds: [`quote:${symbol}`, `candle:${symbol}:${candleTs}`],
      });
      if (status === "CONSISTENT") status = "CONSISTENT_WITH_WARNINGS";
    }
  }

  const quoteSourceId = createHash("sha256")
    .update(`${symbol}|${quoteTs}|${input.quote.bid}|${input.quote.ask}`)
    .digest("hex")
    .slice(0, 16);

  return {
    status,
    symbol,
    timeframe,
    comparisonWindowStartSec: candleTs,
    comparisonWindowEndSec: quoteTs,
    quoteSourceId,
    candleSourceId: `candle:${symbol}:${candleTs}`,
    note:
      status === "CONSISTENT"
        ? "Live mid within closed candle range; semantic comparison only"
        : "See divergences — tolerances not auto-widened",
    semanticGuard:
      "live_bid_ask_not_automatically_candle_close; forming_candles_excluded",
    divergences,
    evidenceKind: "MEASURED",
  };
}
