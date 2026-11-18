/**
 * Deterministic HFM Analysis data-quality gate (fail-closed for AI readiness).
 */
import {
  HFM_ANALYSIS_DEFAULT_TF_PACK,
  HFM_ANALYSIS_PROVIDER,
  HFM_ANALYSIS_QUALITY_POLICY,
  TF_SECONDS,
} from "./constants.js";
import type {
  HfmAnalysisDataQualityReport,
  HfmAnalysisNormalizedCandle,
  HfmAnalysisQualityIssue,
  HfmAnalysisQualityStatus,
  HfmAnalysisQuoteContext,
  HfmAnalysisTfDataset,
} from "./types.js";

function issue(
  code: string,
  message: string,
  severity: "error" | "warning",
  extra?: Partial<HfmAnalysisQualityIssue>,
): HfmAnalysisQualityIssue {
  return {
    code,
    message,
    severity,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

export function validateCandleOhlc(
  c: HfmAnalysisNormalizedCandle,
): HfmAnalysisQualityIssue[] {
  const out: HfmAnalysisQualityIssue[] = [];
  const base = { symbol: c.symbol, timeframe: c.timeframe, sourceField: "ohlc" };
  for (const [field, v] of [
    ["open", c.open],
    ["high", c.high],
    ["low", c.low],
    ["close", c.close],
  ] as const) {
    if (typeof v !== "number" || !Number.isFinite(v)) {
      out.push(issue("INVALID_OHLC", `${field} is not finite`, "error", { ...base, sourceField: field }));
    }
  }
  if (out.length) return out;
  if (c.high < c.low) {
    out.push(issue("INVALID_OHLC", "high < low", "error", base));
  }
  if (c.high < c.open || c.high < c.close) {
    out.push(issue("INVALID_OHLC", "high below open/close", "error", base));
  }
  if (c.low > c.open || c.low > c.close) {
    out.push(issue("INVALID_OHLC", "low above open/close", "error", base));
  }
  if (!Number.isFinite(c.timestamp) || c.timestamp <= 0) {
    out.push(issue("INVALID_TIMESTAMP", "candle timestamp invalid", "error", {
      ...base,
      sourceField: "timestamp",
    }));
  }
  return out;
}

export function inspectCandleSeries(
  candles: HfmAnalysisNormalizedCandle[],
  timeframe: string,
  symbol: string,
): { errors: HfmAnalysisQualityIssue[]; warnings: HfmAnalysisQualityIssue[]; missingApprox: number } {
  const errors: HfmAnalysisQualityIssue[] = [];
  const warnings: HfmAnalysisQualityIssue[] = [];
  let last = -1;
  const seen = new Set<number>();
  let missingApprox = 0;
  const step = TF_SECONDS[timeframe.toUpperCase()] ?? null;

  for (const c of candles) {
    errors.push(...validateCandleOhlc(c));
    if (c.symbol.toUpperCase() !== symbol.toUpperCase()) {
      errors.push(issue("SYMBOL_MISMATCH", `candle symbol ${c.symbol} != ${symbol}`, "error", {
        symbol,
        timeframe,
      }));
    }
    if (c.timeframe.toUpperCase() !== timeframe.toUpperCase()) {
      errors.push(issue("TIMEFRAME_MISMATCH", `candle tf ${c.timeframe} != ${timeframe}`, "error", {
        symbol,
        timeframe,
      }));
    }
    if (seen.has(c.timestamp)) {
      errors.push(issue("DUPLICATE_CANDLE", `duplicate timestamp ${c.timestamp}`, "error", {
        symbol,
        timeframe,
        sourceField: "timestamp",
      }));
    }
    seen.add(c.timestamp);
    if (last >= 0 && c.timestamp <= last) {
      errors.push(issue("OUT_OF_ORDER", `timestamp ${c.timestamp} <= ${last}`, "error", {
        symbol,
        timeframe,
        sourceField: "timestamp",
      }));
    }
    if (last >= 0 && step != null) {
      const gap = c.timestamp - last;
      if (gap > step * 1.5) {
        const missed = Math.max(0, Math.round(gap / step) - 1);
        missingApprox += missed;
        warnings.push(
          issue(
            "POSSIBLE_SESSION_GAP",
            `gap ${gap}s (~${missed} bars) between ${last} and ${c.timestamp}`,
            "warning",
            { symbol, timeframe, sourceField: "timestamp" },
          ),
        );
      }
    }
    last = c.timestamp;
  }
  return { errors, warnings, missingApprox };
}

export function validateQuote(
  quote: HfmAnalysisQuoteContext,
  nowSec = Math.floor(Date.now() / 1000),
): { errors: HfmAnalysisQualityIssue[]; warnings: HfmAnalysisQualityIssue[]; quoteStatus: HfmAnalysisQualityStatus } {
  const errors: HfmAnalysisQualityIssue[] = [];
  const warnings: HfmAnalysisQualityIssue[] = [];
  const sym = quote.symbol;

  if (quote.bid == null || !Number.isFinite(quote.bid) || quote.bid <= 0) {
    errors.push(issue("INVALID_BID", "bid missing or non-positive", "error", {
      symbol: sym,
      sourceField: "bid",
    }));
  }
  if (quote.ask == null || !Number.isFinite(quote.ask) || quote.ask <= 0) {
    errors.push(issue("INVALID_ASK", "ask missing or non-positive", "error", {
      symbol: sym,
      sourceField: "ask",
    }));
  }
  if (
    quote.bid != null &&
    quote.ask != null &&
    Number.isFinite(quote.bid) &&
    Number.isFinite(quote.ask) &&
    quote.ask < quote.bid
  ) {
    errors.push(issue("INVALID_SPREAD", "ask < bid", "error", { symbol: sym, sourceField: "spread" }));
  }
  if (
    quote.bid != null &&
    quote.ask != null &&
    quote.spread != null &&
    Number.isFinite(quote.spread)
  ) {
    const expected = quote.ask - quote.bid;
    if (Math.abs(expected - quote.spread) > HFM_ANALYSIS_QUALITY_POLICY.spreadEpsilon) {
      errors.push(issue("SPREAD_MISMATCH", "spread != ask-bid", "error", {
        symbol: sym,
        sourceField: "spread",
      }));
    }
  }

  let quoteStatus: HfmAnalysisQualityStatus = "VALID";
  const brokerTs = quote.brokerTimestamp;
  if (brokerTs != null && Number.isFinite(brokerTs) && brokerTs > 0) {
    const age = nowSec - brokerTs;
    if (age > HFM_ANALYSIS_QUALITY_POLICY.quoteStaleMaxAgeSec) {
      if (quote.freshness === "MARKET_CLOSED") {
        warnings.push(issue("MARKET_CLOSED_QUOTE", "quote age high but market closed", "warning", {
          symbol: sym,
          sourceField: "brokerTimestamp",
        }));
        quoteStatus = "DEGRADED";
      } else {
        errors.push(issue("STALE_QUOTE", `quote age ${age}s exceeds stale window`, "error", {
          symbol: sym,
          sourceField: "brokerTimestamp",
        }));
        quoteStatus = "STALE";
      }
    } else if (age > HFM_ANALYSIS_QUALITY_POLICY.quoteLiveMaxAgeSec) {
      warnings.push(issue("DELAYED_QUOTE", `quote age ${age}s`, "warning", {
        symbol: sym,
        sourceField: "brokerTimestamp",
      }));
      if (quoteStatus === "VALID") quoteStatus = "DEGRADED";
    }
  } else if (!["MARKET_CLOSED", "NO_QUOTE"].includes(quote.freshness)) {
    warnings.push(issue("MISSING_QUOTE_TS", "broker quote timestamp missing", "warning", {
      symbol: sym,
      sourceField: "brokerTimestamp",
    }));
    if (quoteStatus === "VALID") quoteStatus = "DEGRADED";
  }

  if (errors.length) {
    quoteStatus = quoteStatus === "STALE" ? "STALE" : "INVALID";
  }
  return { errors, warnings, quoteStatus };
}

export function evaluateAnalysisDataQuality(input: {
  provider: string;
  symbol: string;
  requiredTimeframes?: readonly string[];
  datasets: Record<string, HfmAnalysisTfDataset>;
  quote: HfmAnalysisQuoteContext;
  nowSec?: number;
}): HfmAnalysisDataQualityReport {
  const errors: HfmAnalysisQualityIssue[] = [];
  const warnings: HfmAnalysisQualityIssue[] = [];
  const required = input.requiredTimeframes ?? HFM_ANALYSIS_DEFAULT_TF_PACK;
  const nowSec = input.nowSec ?? Math.floor(Date.now() / 1000);

  if (input.provider !== HFM_ANALYSIS_PROVIDER) {
    errors.push(issue("PROVIDER_MISMATCH", `provider ${input.provider} != HFM_MT5`, "error", {
      sourceField: "provider",
    }));
  }

  const q = validateQuote(input.quote, nowSec);
  errors.push(...q.errors);
  warnings.push(...q.warnings);

  let incomplete = false;
  let stale = false;

  for (const tf of required) {
    const ds = input.datasets[tf];
    if (!ds) {
      errors.push(issue("MISSING_TIMEFRAME", `required timeframe ${tf} missing`, "error", {
        symbol: input.symbol,
        timeframe: tf,
      }));
      incomplete = true;
      continue;
    }
    if (ds.symbol.toUpperCase() !== input.symbol.toUpperCase()) {
      errors.push(issue("SYMBOL_MISMATCH", `dataset symbol ${ds.symbol} != ${input.symbol}`, "error", {
        symbol: input.symbol,
        timeframe: tf,
      }));
    }
    if (ds.candleCount < HFM_ANALYSIS_QUALITY_POLICY.minCandlesPerTf) {
      errors.push(
        issue(
          "INSUFFICIENT_CANDLES",
          `${tf} has ${ds.candleCount} candles; need >= ${HFM_ANALYSIS_QUALITY_POLICY.minCandlesPerTf}`,
          "error",
          { symbol: input.symbol, timeframe: tf },
        ),
      );
      incomplete = true;
    }
    const series = inspectCandleSeries(ds.historical, tf, input.symbol);
    errors.push(...series.errors);
    warnings.push(...series.warnings);
    if (ds.historical.length > 0) {
      const ratio = series.missingApprox / ds.historical.length;
      if (ratio > HFM_ANALYSIS_QUALITY_POLICY.maxMissingBarRatio) {
        warnings.push(
          issue(
            "HIGH_GAP_RATIO",
            `approx missing bar ratio ${ratio.toFixed(3)}`,
            "warning",
            { symbol: input.symbol, timeframe: tf },
          ),
        );
      }
    }
    if (ds.validationStatus === "unavailable" || ds.validationStatus === "rejected") {
      errors.push(issue("TF_VALIDATION_FAILED", `${tf} validationStatus=${ds.validationStatus}`, "error", {
        symbol: input.symbol,
        timeframe: tf,
      }));
      incomplete = true;
    }
    const tip = ds.current?.timestamp ?? ds.newestTimestamp;
    const step = TF_SECONDS[tf] ?? 3600;
    const mult = HFM_ANALYSIS_QUALITY_POLICY.candleTipGraceTfMultipliers[tf] ?? 2;
    if (tip != null && Number.isFinite(tip)) {
      const age = nowSec - tip;
      if (age > step * mult && ds.freshness !== "MARKET_CLOSED") {
        warnings.push(issue("STALE_TF_TIP", `${tf} tip age ${age}s`, "warning", {
          symbol: input.symbol,
          timeframe: tf,
        }));
        stale = true;
      }
    }
  }

  let status: HfmAnalysisQualityStatus = "VALID";
  if (errors.some((e) => e.code === "STALE_QUOTE") || (stale && errors.length === 0 && incomplete === false)) {
    // Stale tip alone → STALE/DEGRADED; critical quote stale already in errors
  }
  if (errors.length) {
    if (incomplete && errors.every((e) => e.code === "MISSING_TIMEFRAME" || e.code === "INSUFFICIENT_CANDLES")) {
      status = "INCOMPLETE";
    } else if (errors.some((e) => e.code === "STALE_QUOTE")) {
      status = "STALE";
    } else {
      status = "INVALID";
    }
  } else if (stale || q.quoteStatus === "DEGRADED" || warnings.length > 0) {
    status = stale && q.quoteStatus !== "DEGRADED" ? "STALE" : "DEGRADED";
    if (!stale && warnings.length && q.quoteStatus === "VALID") status = "DEGRADED";
  }

  // Fail-closed: only VALID is approved for future AI reasoning.
  const approvedForAiReasoning = status === "VALID";

  return {
    status,
    errors,
    warnings,
    approvedForAiReasoning,
    policyNote:
      "Quote LIVE<=15s STALE<=180s (HFM DEFAULT_MT5_HFM_FRESHNESS_POLICY). Candle tip grace=2×TF. minCandles=30. Gaps classified as POSSIBLE_SESSION_GAP unless ratio excessive. Only VALID is AI-approved.",
  };
}
