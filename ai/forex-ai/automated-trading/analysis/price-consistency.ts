/**
 * Phase 53.3 fix — quote vs OHLC price-scale consistency before OpenAI analysis.
 * Blocks incoherent evidence (e.g. XAU quote ~4169 with candle closes ~0.84).
 * Instrument-agnostic: no hard-coded instrument prices.
 */
import type { AtRawCandle } from "./evidence.js";

export type PriceConsistencyOk = {
  ok: true;
  candleMedianClose: number;
  quoteMid: number | null;
  scaleRatio: number | null;
};

export type PriceConsistencyFail = {
  ok: false;
  code: "PRICE_SCALE_MISMATCH" | "MARKET_EVIDENCE_INCONSISTENT" | "INVALID_OHLC";
  message: string;
  candleMedianClose: number | null;
  quoteMid: number | null;
  scaleRatio: number | null;
};

/** Relative band: candle median close must stay within this factor of quote mid. */
export const AT_PRICE_SCALE_RATIO_MIN = 0.5;
export const AT_PRICE_SCALE_RATIO_MAX = 2.0;

export function medianFinite(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1]! + xs[mid]!) / 2 : xs[mid]!;
}

export function validateCandleOhlcRelationships(
  candles: AtRawCandle[],
): PriceConsistencyFail | { ok: true; invalidCount: number } {
  let invalidCount = 0;
  for (const c of candles) {
    const { open, high, low, close } = c;
    if (![open, high, low, close].every((v) => typeof v === "number" && Number.isFinite(v))) {
      invalidCount += 1;
      continue;
    }
    if (!(high >= low) || high < open || high < close || low > open || low > close) {
      invalidCount += 1;
    }
  }
  if (candles.length > 0 && invalidCount === candles.length) {
    return {
      ok: false,
      code: "INVALID_OHLC",
      message: "All supplied candles failed OHLC relationship validation.",
      candleMedianClose: null,
      quoteMid: null,
      scaleRatio: null,
    };
  }
  return { ok: true, invalidCount };
}

/**
 * When a fresh Bid/Ask is present, require candle closes to share the same price scale.
 * Does not invent prices; does not hard-code instrument levels.
 */
export function assertQuoteCandlePriceScale(input: {
  bid: number | null | undefined;
  ask: number | null | undefined;
  quoteFresh: boolean;
  candles: AtRawCandle[];
}): PriceConsistencyOk | PriceConsistencyFail {
  const ohlc = validateCandleOhlcRelationships(input.candles);
  if (!ohlc.ok) return ohlc;

  const closes = input.candles
    .map((c) => c.close)
    .filter((v) => typeof v === "number" && Number.isFinite(v) && v > 0);
  const candleMedianClose = medianFinite(closes);

  if (!input.quoteFresh) {
    if (candleMedianClose == null) {
      return {
        ok: false,
        code: "MARKET_EVIDENCE_INCONSISTENT",
        message: "No positive finite candle closes available for analysis evidence.",
        candleMedianClose: null,
        quoteMid: null,
        scaleRatio: null,
      };
    }
    return { ok: true, candleMedianClose, quoteMid: null, scaleRatio: null };
  }

  const bid = input.bid;
  const ask = input.ask;
  if (
    typeof bid !== "number"
    || typeof ask !== "number"
    || !Number.isFinite(bid)
    || !Number.isFinite(ask)
    || bid <= 0
    || ask <= 0
  ) {
    return {
      ok: false,
      code: "MARKET_EVIDENCE_INCONSISTENT",
      message: "Fresh quote flag is set but Bid/Ask are missing or non-positive.",
      candleMedianClose,
      quoteMid: null,
      scaleRatio: null,
    };
  }

  const quoteMid = (bid + ask) / 2;
  if (candleMedianClose == null || candleMedianClose <= 0) {
    return {
      ok: false,
      code: "MARKET_EVIDENCE_INCONSISTENT",
      message: "Cannot compare quote to candles — no positive finite candle closes.",
      candleMedianClose: null,
      quoteMid,
      scaleRatio: null,
    };
  }

  const scaleRatio = candleMedianClose / quoteMid;
  if (scaleRatio < AT_PRICE_SCALE_RATIO_MIN || scaleRatio > AT_PRICE_SCALE_RATIO_MAX) {
    return {
      ok: false,
      code: "PRICE_SCALE_MISMATCH",
      message:
        `Candle price scale is incompatible with the live quote `
        + `(candleMedianClose/quoteMid=${scaleRatio.toFixed(4)}; `
        + `allowed ${AT_PRICE_SCALE_RATIO_MIN}–${AT_PRICE_SCALE_RATIO_MAX}). `
        + "Analysis blocked — OpenAI was not called with conflicting prices.",
      candleMedianClose,
      quoteMid,
      scaleRatio,
    };
  }

  return { ok: true, candleMedianClose, quoteMid, scaleRatio };
}

/** Primary-series candles used for chart/evidence binding checks. */
export function primaryCandlesFromMap(
  candlesByTf: Record<string, AtRawCandle[]>,
  primaryTimeframe: string | null,
): AtRawCandle[] {
  if (primaryTimeframe && Array.isArray(candlesByTf[primaryTimeframe])) {
    return candlesByTf[primaryTimeframe]!;
  }
  const first = Object.values(candlesByTf).find((rows) => Array.isArray(rows) && rows.length > 0);
  return first ?? [];
}
