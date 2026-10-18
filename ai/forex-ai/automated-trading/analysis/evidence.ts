/**
 * Phase 53 — Build immutable analysis evidence from ForexConnect candles + Phase 52 verification.
 */
import { createHash } from "node:crypto";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import type { AtAnalysisEvidenceBundle, AtCandleSummary } from "./types.js";

export const AT_DEFAULT_TIMEFRAMES = ["H4", "H1", "m30", "m15"] as const;
export const AT_MIN_CANDLES_PER_TF = 20;

export interface AtRawCandle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function isoFromCandleTime(t: number | string): string | null {
  if (typeof t === "number" && Number.isFinite(t)) {
    const ms = t > 1e12 ? t : t * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof t === "string" && t.trim()) {
    const ms = Date.parse(t);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  return null;
}

export function fingerprintCandles(timeframe: string, candles: AtRawCandle[]): string {
  const h = createHash("sha256");
  h.update(timeframe);
  for (const c of candles) {
    h.update(`${c.time}|${c.open}|${c.high}|${c.low}|${c.close};`);
  }
  return h.digest("hex").slice(0, 24);
}

export function summarizeCandles(timeframe: string, candles: AtRawCandle[]): AtCandleSummary {
  const first = candles[0];
  const last = candles[candles.length - 1];
  return {
    timeframe,
    count: candles.length,
    firstTimeUtc: first ? isoFromCandleTime(first.time) : null,
    lastTimeUtc: last ? isoFromCandleTime(last.time) : null,
    historicalOnly: true,
    ohlcFingerprint: fingerprintCandles(timeframe, candles),
  };
}

export function collectSnapshotPrices(candlesByTf: Record<string, AtRawCandle[]>): number[] {
  const out: number[] = [];
  for (const candles of Object.values(candlesByTf)) {
    for (const c of candles) {
      for (const v of [c.open, c.high, c.low, c.close]) {
        if (typeof v === "number" && Number.isFinite(v)) out.push(v);
      }
    }
  }
  return out;
}

export function buildEvidenceBundle(input: {
  environment: AutomatedTradingEnvironment;
  instrument: string;
  candlesByTf: Record<string, AtRawCandle[]>;
  verification: AutomatedTradingVerificationResult | null;
  nowMs?: number;
}): { ok: true; evidence: AtAnalysisEvidenceBundle } | { ok: false; code: string; message: string; evidence: AtAnalysisEvidenceBundle | null } {
  const nowMs = input.nowMs ?? Date.now();
  const instrument = String(input.instrument ?? "").trim();
  if (!instrument) {
    return { ok: false, code: "INSTRUMENT_NOT_SELECTED", message: "Select a ForexConnect instrument before analysis.", evidence: null };
  }

  const timeframes = Object.keys(input.candlesByTf);
  const warnings: string[] = [];
  const candleSummaries: AtCandleSummary[] = [];
  let sufficientTf = 0;

  for (const tf of timeframes) {
    const candles = input.candlesByTf[tf] ?? [];
    const summary = summarizeCandles(tf, candles);
    candleSummaries.push(summary);
    if (candles.length < AT_MIN_CANDLES_PER_TF) {
      warnings.push(`${tf}: only ${candles.length} candles (need ≥${AT_MIN_CANDLES_PER_TF}).`);
    } else {
      sufficientTf += 1;
    }
  }

  if (sufficientTf === 0) {
    const evidence: AtAnalysisEvidenceBundle = {
      fingerprint: "insufficient",
      environment: input.environment,
      instrument,
      timeframes,
      candles: candleSummaries,
      bid: null,
      ask: null,
      quoteFresh: false,
      feedStatus: input.verification?.market.feedStatus ?? null,
      historicalOnly: true,
      verificationIdentityStatus: input.verification?.identityStatus ?? null,
      warnings,
      builtAtUtc: new Date(nowMs).toISOString(),
    };
    return {
      ok: false,
      code: "DATA_INSUFFICIENT",
      message: "Insufficient OHLC history for OpenAI technical analysis.",
      evidence,
    };
  }

  const market = input.verification?.market;
  const quoteFresh = Boolean(
    market
    && market.feedStatus === "LIVE"
    && market.bid != null
    && market.ask != null,
  );
  if (!quoteFresh) {
    warnings.push("Current Bid/Ask not verified fresh — analysis uses historical OHLC only.");
  }
  warnings.push("Candles are historical ForexConnect get_history OHLC (bid basis) — not live quotes.");

  const fp = createHash("sha256");
  fp.update(input.environment);
  fp.update("|");
  fp.update(instrument);
  fp.update("|");
  for (const s of candleSummaries) {
    fp.update(s.timeframe);
    fp.update(":");
    fp.update(s.ohlcFingerprint);
    fp.update(";");
  }
  if (quoteFresh && market) {
    fp.update(`q:${market.bid}:${market.ask}`);
  }

  const evidence: AtAnalysisEvidenceBundle = {
    fingerprint: fp.digest("hex").slice(0, 32),
    environment: input.environment,
    instrument,
    timeframes,
    candles: candleSummaries,
    bid: quoteFresh ? market!.bid : null,
    ask: quoteFresh ? market!.ask : null,
    quoteFresh,
    feedStatus: market?.feedStatus ?? null,
    historicalOnly: !quoteFresh,
    verificationIdentityStatus: input.verification?.identityStatus ?? null,
    warnings,
    builtAtUtc: new Date(nowMs).toISOString(),
  };

  return { ok: true, evidence };
}

/** Compact payload for the model — never includes secrets. */
export function evidenceForModelPrompt(
  evidence: AtAnalysisEvidenceBundle,
  candlesByTf: Record<string, AtRawCandle[]>,
  maxCandlesPerTf = 80,
): Record<string, unknown> {
  const series: Record<string, unknown> = {};
  for (const tf of evidence.timeframes) {
    const rows = (candlesByTf[tf] ?? []).slice(-maxCandlesPerTf).map((c) => ({
      t: isoFromCandleTime(c.time),
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    }));
    series[tf] = rows;
  }
  return {
    fingerprint: evidence.fingerprint,
    environment: evidence.environment,
    instrument: evidence.instrument,
    historicalOnly: evidence.historicalOnly,
    quote: evidence.quoteFresh
      ? { bid: evidence.bid, ask: evidence.ask, feedStatus: evidence.feedStatus }
      : { status: "UNAVAILABLE_OR_STALE", feedStatus: evidence.feedStatus },
    candleSummaries: evidence.candles,
    series,
    warnings: evidence.warnings,
    note:
      "Use only supplied OHLC and quote fields. Do not invent prices, timestamps, swings, or patterns "
      + "not supported by this evidence. Do not claim news or web research.",
  };
}
