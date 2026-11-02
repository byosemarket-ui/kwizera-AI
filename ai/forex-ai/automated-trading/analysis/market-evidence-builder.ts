/**
 * Phase 4.18E — Complete market evidence bundle for AI + canonical analysis.
 * Separates broker-measured, deterministic-computed, and unavailable fields.
 * Never invents prices, indicators, news, or volume.
 */
import { createHash } from "node:crypto";
import { FOREXCONNECT_MAX_CANDLES } from "../../../market-data/forexconnect/timeframes.js";
import { detectMarketStructure } from "../../../forex-structure/detect.js";
import type { MarketStructureAnalysisResult } from "../../../forex-structure/types.js";
import { auditCandleQuality, type CandleQualityReport } from "../candle-quality.js";
import { evaluateSmaCrossoverStrategy } from "../auto-engine/strategy/evaluate.js";
import { SMA_CROSSOVER_RULES, type StrategyCandle } from "../auto-engine/strategy/rules.js";
import { atrAt } from "../auto-engine/strategy/evaluate.js";
import { normalizeInstrumentId, normalizeCanonicalTimeframe } from "./adapters.js";
import {
  summarizeHistoricalMovement,
  type HistoricalMovementSummary,
} from "./historical-movement.js";
import type { CanonicalQuoteSnapshot, CanonicalTimeframeId } from "./canonical-analysis.types.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import {
  buildTechnicalIntelligence,
  computeMtfAlignment,
  type MtfAlignmentResult,
  type TechnicalIntelligenceBundle,
} from "../technical-intelligence/index.js";

export const MARKET_EVIDENCE_SCHEMA = "kwizera.market-evidence.v1" as const;
/** Phase 4.18F.5 — OpenAI evidence-delivery proof + F.4 MTF + F.3 tech intel. */
export const MARKET_EVIDENCE_VERSION = "4.18F.5" as const;

/** Default history pull — FC SDK practical max (not unlimited). */
export const AT_HISTORY_LOOKBACK_LIMIT = FOREXCONNECT_MAX_CANDLES;

export const AT_MTF_EVIDENCE_TIMEFRAMES = [
  "5m",
  "15m",
  "30m",
  "1h",
  "4h",
  "1d",
] as const satisfies readonly CanonicalTimeframeId[];

export type EvidenceFieldStatus =
  | "BROKER_MEASURED"
  | "DETERMINISTIC_COMPUTED"
  | "UNAVAILABLE"
  | "STALE"
  | "UNVERIFIED";

export interface EvidenceField<T> {
  value: T;
  status: EvidenceFieldStatus;
  asOfUtc: string | null;
  note?: string;
}

export interface PerTimeframeEvidence {
  timeframe: CanonicalTimeframeId | string;
  instrument: string;
  candleQuality: CandleQualityReport | null;
  movement: HistoricalMovementSummary | null;
  structure: {
    trendState: string;
    confirmedSwings: number;
    supportZones: number;
    resistanceZones: number;
    events: number;
    note: string;
    provenance: "DETERMINISTIC_COMPUTED";
  } | null;
  indicators: {
    fastSma: number | null;
    slowSma: number | null;
    atr: number | null;
    atrMethod: "SMA_OF_TR";
    strategyDirection: "BUY" | "SELL" | "NO_TRADE" | null;
    strategyCode: string | null;
    provenance: "DETERMINISTIC_COMPUTED";
    /** Phase 4.18F.3 — expanded suite (null when insufficient). */
    suiteSummary?: {
      rsi14: number | null;
      macd: number | null;
      macdSignal: number | null;
      macdHistogram: number | null;
      bbUpper: number | null;
      bbMiddle: number | null;
      bbLower: number | null;
      adx: number | null;
      plusDi: number | null;
      minusDi: number | null;
      sma50: number | null;
      sma200: number | null;
      ema21: number | null;
      ema50: number | null;
      atrPct: number | null;
      volatilityClass: string | null;
      maCrossover: string | null;
    } | null;
  } | null;
  /** Phase 4.18F.3 — full structure + condition + signal validation for this TF. */
  technicalIntelligence: TechnicalIntelligenceBundle | null;
  deterministicBias: "BULLISH" | "BEARISH" | "NEUTRAL" | "UNKNOWN";
  available: boolean;
  warnings: string[];
}

export interface MarketEvidenceBundle {
  schemaVersion: typeof MARKET_EVIDENCE_SCHEMA;
  evidenceVersion: typeof MARKET_EVIDENCE_VERSION;
  identity: {
    environment: AutomatedTradingEnvironment;
    provider: "FOREXCONNECT";
    instrument: string;
    primaryTimeframe: string;
    analyzedAtUtc: string;
    evidenceFingerprint: string;
  };
  liveQuote: {
    bid: EvidenceField<number | null>;
    ask: EvidenceField<number | null>;
    mid: EvidenceField<number | null>;
    spread: EvidenceField<number | null>;
    quoteFresh: EvidenceField<boolean>;
    freshnessReasonCode: EvidenceField<string | null>;
    effectivePriceChangeAgeMs: EvidenceField<number | null>;
    feedNote: string;
  };
  /**
   * Phase 4.18F.2.2 — rolling genuine-tick movement windows (separate from historical candles).
   * Never overrides deterministic strategy / NO_TRADE. Null windows ⇒ NO_GENUINE_TICKS.
   */
  liveTickMovement: {
    source: "FOREXCONNECT_OFFERS_GENUINE_TICKS";
    latestTick: EvidenceField<{
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      receiptTimestampMs: number;
      eventTimestampMs: number | null;
      eventClass: string;
      source: string;
    } | null>;
    windows: Array<{
      windowId: string;
      genuineTickCount: number;
      direction: string;
      netBidMovement: number | null;
      netAskMovement: number | null;
      midPriceMovement: number | null;
      percentageMovement: number | null;
      currentSpread: number | null;
      averageSpread: number | null;
      freshness: string;
      status: string;
      coverage: string;
      firstReceiptTimestampMs: number | null;
      latestReceiptTimestampMs: number | null;
    }>;
    captureHealth: {
      accepted: number;
      filtered: number;
      persisted: number;
      duplicates: number;
      lastAcceptedAtMs: number | null;
    } | null;
    note: string;
  };
  historical: {
    lookbackLimit: number;
    primary: PerTimeframeEvidence | null;
    byTimeframe: PerTimeframeEvidence[];
  };
  multiTimeframe: {
    primaryTimeframe: string;
    confirmationTimeframes: string[];
    agreement: "AGREE_BULLISH" | "AGREE_BEARISH" | "CONFLICT" | "INSUFFICIENT" | "UNKNOWN";
    notes: string[];
    /** Phase 4.18F.4 — full ladder alignment (authoritative detail). */
    alignment: MtfAlignmentResult | null;
  };
  /**
   * Phase 4.18F.3 — primary-TF technical intelligence (indicators, structure, signal validation).
   * Never forces broker execution; placesOrders remains false.
   */
  technicalIntelligence: TechnicalIntelligenceBundle | null;
  instrumentMeta: {
    symbol: EvidenceField<string>;
    pointSize: EvidenceField<number | null>;
    digits: EvidenceField<number | null>;
    baseUnitSize: EvidenceField<number | null>;
    minQuantity: EvidenceField<number | null>;
    tradingStatus: EvidenceField<string | null>;
    session: EvidenceField<string | null>;
    volume: EvidenceField<null>;
    orderBook: EvidenceField<null>;
    economicCalendar: EvidenceField<null>;
  };
  quality: {
    missing: string[];
    stale: string[];
    invalid: string[];
    warnings: string[];
    completeness: "FULL" | "PARTIAL" | "INSUFFICIENT";
  };
  placesOrders: false;
  acceptsForExecution: false;
}

function field<T>(
  value: T,
  status: EvidenceFieldStatus,
  asOfUtc: string | null,
  note?: string,
): EvidenceField<T> {
  return { value, status, asOfUtc, note };
}

function sma(values: number[], length: number): number | null {
  if (values.length < length) return null;
  let sum = 0;
  for (let i = values.length - length; i < values.length; i++) {
    const v = values[i];
    if (v == null || !Number.isFinite(v)) return null;
    sum += v;
  }
  return sum / length;
}

function closedStrategyCandles(candles: StrategyCandle[]): StrategyCandle[] {
  let rows = candles.filter(
    (c) =>
      c
      && Number.isFinite(c.time)
      && Number.isFinite(c.open)
      && Number.isFinite(c.high)
      && Number.isFinite(c.low)
      && Number.isFinite(c.close),
  );
  if (rows.length && rows[rows.length - 1]!.closed === false) {
    rows = rows.slice(0, -1);
  }
  return rows.map((c) => ({ ...c, closed: true }));
}

function biasFromStrategy(dir: "BUY" | "SELL" | "NO_TRADE" | null): PerTimeframeEvidence["deterministicBias"] {
  if (dir === "BUY") return "BULLISH";
  if (dir === "SELL") return "BEARISH";
  if (dir === "NO_TRADE") return "NEUTRAL";
  return "UNKNOWN";
}

function compactStructure(result: MarketStructureAnalysisResult): PerTimeframeEvidence["structure"] {
  const confirmed = result.swings.filter((s) => s.status === "CONFIRMED").length;
  const support = result.zones.filter((z) => z.kind === "SUPPORT").length;
  const resistance = result.zones.filter((z) => z.kind === "RESISTANCE").length;
  return {
    trendState: result.trendState,
    confirmedSwings: confirmed,
    supportZones: support,
    resistanceZones: resistance,
    events: result.events.length,
    note: result.note,
    provenance: "DETERMINISTIC_COMPUTED",
  };
}

export function buildPerTimeframeEvidence(input: {
  instrument: string;
  timeframe: string;
  candles: StrategyCandle[];
  pointSize: number | null;
  nowMs?: number;
  quoteFresh?: boolean | null;
}): PerTimeframeEvidence {
  const instrument = normalizeInstrumentId(input.instrument);
  const tf = normalizeCanonicalTimeframe(input.timeframe) ?? String(input.timeframe);
  const warnings: string[] = [];
  const stepGuess =
    tf === "1m"
      ? 60
      : tf === "5m"
        ? 300
        : tf === "15m"
          ? 900
          : tf === "30m"
            ? 1800
            : tf === "1h"
              ? 3600
              : tf === "4h"
                ? 14400
                : tf === "1d"
                  ? 86400
                  : tf === "1w"
                    ? 604800
                    : null;

  const quality = auditCandleQuality({
    candles: input.candles,
    instrument,
    timeframe: tf,
    source: "forexconnect-history",
    expectedStepSeconds: stepGuess,
    strategyClosedBarsRequired: SMA_CROSSOVER_RULES.slowSmaLength + 2,
    nowMs: input.nowMs,
  });

  const closed = closedStrategyCandles(input.candles);
  const movement = summarizeHistoricalMovement({
    instrument,
    timeframe: tf,
    candles: closed,
  });

  let structure: PerTimeframeEvidence["structure"] = null;
  try {
    const struct = detectMarketStructure({
      provider: "FOREXCONNECT",
      symbol: instrument,
      timeframe: tf,
      candles: closed.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        closed: true,
      })),
      includeForming: false,
    });
    structure = compactStructure(struct);
  } catch {
    warnings.push("Structure detection failed.");
  }

  let indicators: PerTimeframeEvidence["indicators"] = null;
  let deterministicBias: PerTimeframeEvidence["deterministicBias"] = "UNKNOWN";
  let technicalIntelligence: TechnicalIntelligenceBundle | null = null;
  let strategyDirection: "BUY" | "SELL" | "NO_TRADE" | null = null;
  let strategyCode: string | null = null;
  if (closed.length >= SMA_CROSSOVER_RULES.slowSmaLength + 2) {
    const closes = closed.map((c) => c.close);
    const highs = closed.map((c) => c.high);
    const lows = closed.map((c) => c.low);
    const end = closed.length - 1;
    const fastSma = sma(closes, SMA_CROSSOVER_RULES.fastSmaLength);
    const slowSma = sma(closes, SMA_CROSSOVER_RULES.slowSmaLength);
    const atr = atrAt(highs, lows, closes, SMA_CROSSOVER_RULES.atrLength, end);
    const ev = evaluateSmaCrossoverStrategy({
      candles: closed,
      pointSize: input.pointSize,
    });
    strategyDirection = ev.direction;
    strategyCode = ev.code;
    indicators = {
      fastSma,
      slowSma,
      atr,
      atrMethod: "SMA_OF_TR",
      strategyDirection: ev.direction,
      strategyCode: ev.code,
      provenance: "DETERMINISTIC_COMPUTED",
      suiteSummary: null,
    };
    deterministicBias = biasFromStrategy(ev.ok ? ev.direction : null);
  } else {
    warnings.push("Insufficient closed candles for SMA/ATR indicators.");
  }

  try {
    technicalIntelligence = buildTechnicalIntelligence({
      instrument,
      timeframe: tf,
      candles: closed,
      strategyDirection,
      strategyCode,
      quoteFresh: input.quoteFresh ?? null,
      nowMs: input.nowMs,
    });
    if (indicators && technicalIntelligence) {
      const s = technicalIntelligence.indicators;
      indicators = {
        ...indicators,
        suiteSummary: {
          rsi14: s.rsi.rsi14.value,
          macd: s.macd.macd.value,
          macdSignal: s.macd.signal.value,
          macdHistogram: s.macd.histogram.value,
          bbUpper: s.bollinger.upper.value,
          bbMiddle: s.bollinger.middle.value,
          bbLower: s.bollinger.lower.value,
          adx: s.adx.adx.value,
          plusDi: s.adx.plusDi.value,
          minusDi: s.adx.minusDi.value,
          sma50: s.movingAverages.sma50.value,
          sma200: s.movingAverages.sma200.value,
          ema21: s.movingAverages.ema21.value,
          ema50: s.movingAverages.ema50.value,
          atrPct: s.atr.atrPctOfPrice.value,
          volatilityClass: s.atr.volatilityClass,
          maCrossover: s.movingAverages.crossover,
        },
      };
    }
  } catch {
    warnings.push("Technical intelligence computation failed.");
    technicalIntelligence = null;
  }

  return {
    timeframe: tf,
    instrument,
    candleQuality: quality,
    movement,
    structure,
    indicators,
    technicalIntelligence,
    deterministicBias,
    available: quality.closedBars > 0,
    warnings: [...warnings, ...quality.blockers.slice(0, 5)],
  };
}

function biasFromTf(tf: PerTimeframeEvidence): string {
  const cond = tf.technicalIntelligence?.condition.trend;
  if (cond === "BULLISH" || cond === "BEARISH" || cond === "RANGING" || cond === "MIXED") {
    return cond;
  }
  if (tf.deterministicBias === "BULLISH" || tf.deterministicBias === "BEARISH") {
    return tf.deterministicBias;
  }
  if (tf.deterministicBias === "NEUTRAL") return "NEUTRAL";
  return tf.structure?.trendState === "RANGE" ? "RANGING" : (tf.structure?.trendState ?? "UNKNOWN");
}

function mtfAgreement(
  primary: PerTimeframeEvidence | null,
  all: PerTimeframeEvidence[],
  instrument: string,
  nowMs: number,
): MarketEvidenceBundle["multiTimeframe"] {
  if (!primary) {
    return {
      primaryTimeframe: "unknown",
      confirmationTimeframes: [],
      agreement: "INSUFFICIENT",
      notes: ["Primary timeframe evidence missing."],
      alignment: null,
    };
  }

  const alignment = computeMtfAlignment({
    instrument,
    primaryTimeframe: String(primary.timeframe),
    nowMs,
    timeframes: all.map((tf) => {
      const ti = tf.technicalIntelligence;
      const stale =
        ti?.condition.stale === true
        || tf.warnings.some((w) => /stale/i.test(w));
      const insufficient =
        ti?.condition.insufficient === true
        || (tf.candleQuality?.closedBars != null && tf.candleQuality.closedBars < 21)
        || !tf.indicators;
      return {
        timeframe: String(tf.timeframe),
        bias: biasFromTf(tf),
        sma9: ti?.indicators.movingAverages.sma9.value ?? tf.indicators?.fastSma ?? null,
        sma21: ti?.indicators.movingAverages.sma21.value ?? tf.indicators?.slowSma ?? null,
        atr: ti?.indicators.atr.atr.value ?? tf.indicators?.atr ?? null,
        atrMethod: "SMA_OF_TR",
        structureTrend: ti?.structure.trendState ?? tf.structure?.trendState ?? null,
        closedBars: tf.candleQuality?.closedBars ?? null,
        lastCandleSec: tf.movement?.lastOpenSec ?? null,
        available: tf.available,
        stale,
        insufficient,
        qualityNote: tf.warnings[0] ?? null,
      };
    }),
  });

  const conf = all.filter(
    (o) =>
      o.timeframe !== primary.timeframe
      && (o.deterministicBias === "BULLISH" || o.deterministicBias === "BEARISH"
        || o.technicalIntelligence?.condition.trend === "BULLISH"
        || o.technicalIntelligence?.condition.trend === "BEARISH"),
  );

  return {
    primaryTimeframe: String(primary.timeframe),
    confirmationTimeframes: conf.map((c) => String(c.timeframe)),
    agreement: alignment.legacyAgreement,
    notes: [
      `F.4 alignment=${alignment.classification}`,
      `HTF bias=${alignment.higherTimeframeBias}`,
      `LTF bias=${alignment.lowerTimeframeBias}`,
      ...alignment.explanations.slice(0, 8),
    ],
    alignment,
  };
}

export function buildMarketEvidenceBundle(input: {
  environment: AutomatedTradingEnvironment;
  instrument: string;
  primaryTimeframe: string;
  candlesByTf: Record<string, StrategyCandle[]>;
  quote: CanonicalQuoteSnapshot;
  pointSize?: number | null;
  digits?: number | null;
  baseUnitSize?: number | null;
  minQuantity?: number | null;
  tradingStatus?: string | null;
  nowMs?: number;
  /** Optional precomputed F.2.2 tick movement (keeps historical candles separate). */
  liveTickMovement?: {
    latest: {
      bid: number;
      ask: number;
      mid: number;
      spread: number;
      receiptTimestampMs: number;
      eventTimestampMs: number | null;
      eventClass: string;
      source: string;
    } | null;
    windows: Array<{
      windowId: string;
      genuineTickCount: number;
      direction: string;
      netBidMovement: number | null;
      netAskMovement: number | null;
      midPriceMovement: number | null;
      percentageMovement: number | null;
      currentSpread: number | null;
      averageSpread: number | null;
      freshness: string;
      status: string;
      coverage: string;
      firstReceiptTimestampMs: number | null;
      latestReceiptTimestampMs: number | null;
    }>;
    counters?: {
      accepted: number;
      filtered: number;
      persisted: number;
      duplicates: number;
      lastAcceptedAtMs: number | null;
    } | null;
  } | null;
}): MarketEvidenceBundle {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const instrument = normalizeInstrumentId(input.instrument);
  const primaryTf =
    normalizeCanonicalTimeframe(input.primaryTimeframe) ?? String(input.primaryTimeframe);

  const byTf: PerTimeframeEvidence[] = [];
  for (const [tf, candles] of Object.entries(input.candlesByTf)) {
    // Isolation: skip empty; never cross-stamp instruments
    byTf.push(
      buildPerTimeframeEvidence({
        instrument,
        timeframe: tf,
        candles,
        pointSize: input.pointSize ?? null,
        nowMs,
        quoteFresh: input.quote.quoteFresh,
      }),
    );
  }

  const primary =
    byTf.find((x) => String(x.timeframe) === primaryTf)
    ?? byTf[0]
    ?? null;

  const mtf = mtfAgreement(primary, byTf, instrument, nowMs);

  const bid = input.quote.bid;
  const ask = input.quote.ask;
  const mid =
    bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask)
      ? (bid + ask) / 2
      : null;
  const spread =
    bid != null && ask != null && Number.isFinite(bid) && Number.isFinite(ask)
      ? ask - bid
      : null;

  const missing: string[] = [];
  const stale: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];

  if (!input.quote.quoteFresh) stale.push(`quote:${input.quote.freshnessReasonCode ?? "not_fresh"}`);
  if (bid == null || ask == null) missing.push("bid_ask");
  if (!primary || !primary.available) missing.push("primary_history");
  if (primary?.candleQuality && !primary.candleQuality.strategyReady) {
    invalid.push(...primary.candleQuality.blockers.slice(0, 3));
  }
  for (const tf of byTf) {
    warnings.push(...tf.warnings.map((w) => `${tf.timeframe}:${w}`));
  }
  missing.push("tick_volume", "order_book", "economic_calendar");
  if (input.tradingStatus == null) missing.push("trading_status_detail");

  const liveTick = input.liveTickMovement ?? null;
  if (!liveTick?.latest) {
    missing.push("genuine_live_ticks");
  } else if (liveTick.windows.every((w) => w.genuineTickCount === 0)) {
    warnings.push("live_tick_windows:NO_GENUINE_TICKS");
  }

  let completeness: MarketEvidenceBundle["quality"]["completeness"] = "PARTIAL";
  if (primary?.available && input.quote.quoteFresh && primary.indicators?.atr != null) {
    completeness = byTf.length >= 2 ? "FULL" : "PARTIAL";
  }
  if (!primary?.available || (primary.candleQuality && primary.candleQuality.closedBars < 5)) {
    completeness = "INSUFFICIENT";
  }

  const h = createHash("sha256");
  h.update(instrument);
  h.update("|");
  h.update(primaryTf);
  h.update("|");
  h.update(input.quote.snapshotFingerprint ?? "");
  for (const tf of byTf) {
    h.update(`|${tf.timeframe}:${tf.movement?.lastOpenSec ?? 0}:${tf.candleQuality?.closedBars ?? 0}`);
  }
  if (liveTick?.latest) {
    h.update(`|tick:${liveTick.latest.receiptTimestampMs}:${liveTick.latest.bid}:${liveTick.latest.ask}`);
  }
  const evidenceFingerprint = h.digest("hex").slice(0, 24);

  const latestTickAsOf = liveTick?.latest
    ? new Date(liveTick.latest.receiptTimestampMs).toISOString()
    : null;

  return {
    schemaVersion: MARKET_EVIDENCE_SCHEMA,
    evidenceVersion: MARKET_EVIDENCE_VERSION,
    identity: {
      environment: input.environment,
      provider: "FOREXCONNECT",
      instrument,
      primaryTimeframe: primaryTf,
      analyzedAtUtc: nowIso,
      evidenceFingerprint,
    },
    liveQuote: {
      bid: field(bid, bid != null ? "BROKER_MEASURED" : "UNAVAILABLE", input.quote.evaluatedAtUtc),
      ask: field(ask, ask != null ? "BROKER_MEASURED" : "UNAVAILABLE", input.quote.evaluatedAtUtc),
      mid: field(mid, mid != null ? "DETERMINISTIC_COMPUTED" : "UNAVAILABLE", input.quote.evaluatedAtUtc),
      spread: field(
        spread,
        spread != null ? "DETERMINISTIC_COMPUTED" : "UNAVAILABLE",
        input.quote.evaluatedAtUtc,
      ),
      quoteFresh: field(
        input.quote.quoteFresh,
        input.quote.quoteFresh ? "BROKER_MEASURED" : "STALE",
        input.quote.evaluatedAtUtc,
      ),
      freshnessReasonCode: field(
        input.quote.freshnessReasonCode,
        "BROKER_MEASURED",
        input.quote.evaluatedAtUtc,
      ),
      effectivePriceChangeAgeMs: field(
        input.quote.effectivePriceChangeAgeMs,
        input.quote.effectivePriceChangeAgeMs != null ? "BROKER_MEASURED" : "UNAVAILABLE",
        input.quote.evaluatedAtUtc,
      ),
      feedNote:
        "Heartbeat and session CONNECTED alone never establish LIVE — use quote-freshness authority.",
    },
    liveTickMovement: {
      source: "FOREXCONNECT_OFFERS_GENUINE_TICKS",
      latestTick: field(
        liveTick?.latest ?? null,
        liveTick?.latest ? "BROKER_MEASURED" : "UNAVAILABLE",
        latestTickAsOf,
        liveTick?.latest
          ? "Latest accepted genuine Offers bid/ask change."
          : "No genuine ticks captured yet — not zero market movement.",
      ),
      windows: (liveTick?.windows ?? []).map((w) => ({
        windowId: w.windowId,
        genuineTickCount: w.genuineTickCount,
        direction: w.direction,
        netBidMovement: w.netBidMovement,
        netAskMovement: w.netAskMovement,
        midPriceMovement: w.midPriceMovement,
        percentageMovement: w.percentageMovement,
        currentSpread: w.currentSpread,
        averageSpread: w.averageSpread,
        freshness: w.freshness,
        status: w.status,
        coverage: w.coverage,
        firstReceiptTimestampMs: w.firstReceiptTimestampMs,
        latestReceiptTimestampMs: w.latestReceiptTimestampMs,
      })),
      captureHealth: liveTick?.counters
        ? {
          accepted: liveTick.counters.accepted,
          filtered: liveTick.counters.filtered,
          persisted: liveTick.counters.persisted,
          duplicates: liveTick.counters.duplicates,
          lastAcceptedAtMs: liveTick.counters.lastAcceptedAtMs,
        }
        : null,
      note:
        "Live tick windows are independent of historical candle movement. Zero genuine ticks ⇒ NO_GENUINE_TICKS, never fabricated zero movement. Does not override deterministic NO_TRADE.",
    },
    historical: {
      lookbackLimit: AT_HISTORY_LOOKBACK_LIMIT,
      primary,
      byTimeframe: byTf,
    },
    multiTimeframe: mtf,
    technicalIntelligence: primary?.technicalIntelligence ?? null,
    instrumentMeta: {
      symbol: field(instrument, "BROKER_MEASURED", nowIso),
      pointSize: field(
        input.pointSize ?? null,
        input.pointSize != null ? "BROKER_MEASURED" : "UNAVAILABLE",
        nowIso,
      ),
      digits: field(
        input.digits ?? null,
        input.digits != null ? "BROKER_MEASURED" : "UNAVAILABLE",
        nowIso,
      ),
      baseUnitSize: field(
        input.baseUnitSize ?? null,
        input.baseUnitSize != null ? "BROKER_MEASURED" : "UNAVAILABLE",
        nowIso,
      ),
      minQuantity: field(
        input.minQuantity ?? null,
        input.minQuantity != null ? "BROKER_MEASURED" : "UNAVAILABLE",
        nowIso,
      ),
      tradingStatus: field(
        input.tradingStatus ?? null,
        input.tradingStatus != null ? "BROKER_MEASURED" : "UNAVAILABLE",
        nowIso,
      ),
      session: field(null, "UNAVAILABLE", nowIso, "No separate session calendar wired."),
      volume: field(null, "UNAVAILABLE", nowIso, "FX spot has no centralized exchange volume here."),
      orderBook: field(null, "UNAVAILABLE", nowIso, "Order book not provided."),
      economicCalendar: field(null, "UNAVAILABLE", nowIso, "No economic calendar integration."),
    },
    quality: {
      missing,
      stale,
      invalid,
      warnings: warnings.slice(0, 24),
      completeness,
    },
    placesOrders: false,
    acceptsForExecution: false,
  };
}

/** Compact payload suitable for OpenAI prompts (bounded size). */
export function marketEvidenceForModelPrompt(bundle: MarketEvidenceBundle): Record<string, unknown> {
  return {
    schemaVersion: bundle.schemaVersion,
    evidenceVersion: bundle.evidenceVersion,
    identity: bundle.identity,
    liveQuote: {
      bid: bundle.liveQuote.bid.value,
      ask: bundle.liveQuote.ask.value,
      mid: bundle.liveQuote.mid.value,
      spread: bundle.liveQuote.spread.value,
      quoteFresh: bundle.liveQuote.quoteFresh.value,
      freshnessReasonCode: bundle.liveQuote.freshnessReasonCode.value,
      priceChangeAgeMs: bundle.liveQuote.effectivePriceChangeAgeMs.value,
      feedNote: bundle.liveQuote.feedNote,
    },
    liveTickMovement: {
      source: bundle.liveTickMovement.source,
      latest: bundle.liveTickMovement.latestTick.value,
      windows: bundle.liveTickMovement.windows.slice(0, 5),
      captureHealth: bundle.liveTickMovement.captureHealth,
      note: bundle.liveTickMovement.note,
    },
    primary: bundle.historical.primary
      ? {
        timeframe: bundle.historical.primary.timeframe,
        closedBars: bundle.historical.primary.candleQuality?.closedBars ?? null,
        strategyReady: bundle.historical.primary.candleQuality?.strategyReady ?? null,
        movement: bundle.historical.primary.movement,
        structure: bundle.historical.primary.structure,
        indicators: bundle.historical.primary.indicators,
        deterministicBias: bundle.historical.primary.deterministicBias,
      }
      : null,
    multiTimeframe: {
      primaryTimeframe: bundle.multiTimeframe.primaryTimeframe,
      confirmationTimeframes: bundle.multiTimeframe.confirmationTimeframes,
      agreement: bundle.multiTimeframe.agreement,
      notes: bundle.multiTimeframe.notes,
      alignment: bundle.multiTimeframe.alignment
        ? {
          classification: bundle.multiTimeframe.alignment.classification,
          legacyAgreement: bundle.multiTimeframe.alignment.legacyAgreement,
          higherTimeframeBias: bundle.multiTimeframe.alignment.higherTimeframeBias,
          lowerTimeframeBias: bundle.multiTimeframe.alignment.lowerTimeframeBias,
          agreeingTimeframes: bundle.multiTimeframe.alignment.agreeingTimeframes,
          disagreeingTimeframes: bundle.multiTimeframe.alignment.disagreeingTimeframes,
          unavailableTimeframes: bundle.multiTimeframe.alignment.unavailableTimeframes,
          staleTimeframes: bundle.multiTimeframe.alignment.staleTimeframes,
          insufficientTimeframes: bundle.multiTimeframe.alignment.insufficientTimeframes,
          pairwise: bundle.multiTimeframe.alignment.pairwise,
          matrix: bundle.multiTimeframe.alignment.matrix,
          explanations: bundle.multiTimeframe.alignment.explanations,
        }
        : null,
    },
    timeframeMatrix: bundle.multiTimeframe.alignment?.matrix ?? [],
    otherTimeframes: bundle.historical.byTimeframe
      .filter((t) => t.timeframe !== bundle.identity.primaryTimeframe)
      .map((t) => ({
        timeframe: t.timeframe,
        closedBars: t.candleQuality?.closedBars ?? null,
        deterministicBias: t.deterministicBias,
        trendState: t.structure?.trendState ?? null,
        atr: t.indicators?.atr ?? null,
        fastSma: t.indicators?.fastSma ?? null,
        slowSma: t.indicators?.slowSma ?? null,
        netReturnPct: t.movement?.netReturnPct ?? null,
        signalOutcome: t.technicalIntelligence?.signalValidation.outcome ?? null,
        trend: t.technicalIntelligence?.condition.trend ?? null,
        momentum: t.technicalIntelligence?.condition.momentum ?? null,
        volatility: t.technicalIntelligence?.condition.volatility ?? null,
      })),
    technicalIntelligence: bundle.technicalIntelligence
      ? {
        engineVersion: bundle.technicalIntelligence.indicators.engineVersion,
        movingAverages: {
          sma9: bundle.technicalIntelligence.indicators.movingAverages.sma9.value,
          sma21: bundle.technicalIntelligence.indicators.movingAverages.sma21.value,
          sma50: bundle.technicalIntelligence.indicators.movingAverages.sma50.value,
          sma200: bundle.technicalIntelligence.indicators.movingAverages.sma200.value,
          ema9: bundle.technicalIntelligence.indicators.movingAverages.ema9.value,
          ema21: bundle.technicalIntelligence.indicators.movingAverages.ema21.value,
          ema50: bundle.technicalIntelligence.indicators.movingAverages.ema50.value,
          ema200: bundle.technicalIntelligence.indicators.movingAverages.ema200.value,
          crossover: bundle.technicalIntelligence.indicators.movingAverages.crossover,
          priceVsSma21: bundle.technicalIntelligence.indicators.movingAverages.priceVsSma21,
          quality: bundle.technicalIntelligence.indicators.movingAverages.sma21.quality,
        },
        rsi: {
          value: bundle.technicalIntelligence.indicators.rsi.rsi14.value,
          zone: bundle.technicalIntelligence.indicators.rsi.zone,
          momentum: bundle.technicalIntelligence.indicators.rsi.momentum,
          quality: bundle.technicalIntelligence.indicators.rsi.rsi14.quality,
        },
        macd: {
          macd: bundle.technicalIntelligence.indicators.macd.macd.value,
          signal: bundle.technicalIntelligence.indicators.macd.signal.value,
          histogram: bundle.technicalIntelligence.indicators.macd.histogram.value,
          cross: bundle.technicalIntelligence.indicators.macd.cross,
          quality: bundle.technicalIntelligence.indicators.macd.macd.quality,
        },
        bollinger: {
          upper: bundle.technicalIntelligence.indicators.bollinger.upper.value,
          middle: bundle.technicalIntelligence.indicators.bollinger.middle.value,
          lower: bundle.technicalIntelligence.indicators.bollinger.lower.value,
          bandwidth: bundle.technicalIntelligence.indicators.bollinger.bandwidth.value,
          pricePosition: bundle.technicalIntelligence.indicators.bollinger.pricePosition,
          quality: bundle.technicalIntelligence.indicators.bollinger.middle.quality,
        },
        atr: {
          value: bundle.technicalIntelligence.indicators.atr.atr.value,
          atrPct: bundle.technicalIntelligence.indicators.atr.atrPctOfPrice.value,
          method: "SMA_OF_TR",
          volatilityClass: bundle.technicalIntelligence.indicators.atr.volatilityClass,
          quality: bundle.technicalIntelligence.indicators.atr.atr.quality,
        },
        adx: {
          adx: bundle.technicalIntelligence.indicators.adx.adx.value,
          plusDi: bundle.technicalIntelligence.indicators.adx.plusDi.value,
          minusDi: bundle.technicalIntelligence.indicators.adx.minusDi.value,
          trendStrength: bundle.technicalIntelligence.indicators.adx.trendStrength,
          quality: bundle.technicalIntelligence.indicators.adx.adx.quality,
        },
        structure: bundle.technicalIntelligence.structure,
        condition: {
          trend: bundle.technicalIntelligence.condition.trend,
          momentum: bundle.technicalIntelligence.condition.momentum,
          volatility: bundle.technicalIntelligence.condition.volatility,
          trendEvidence: bundle.technicalIntelligence.condition.trendEvidence,
          momentumEvidence: bundle.technicalIntelligence.condition.momentumEvidence,
          volatilityEvidence: bundle.technicalIntelligence.condition.volatilityEvidence,
          insufficient: bundle.technicalIntelligence.condition.insufficient,
          stale: bundle.technicalIntelligence.condition.stale,
        },
        signalValidation: {
          outcome: bundle.technicalIntelligence.signalValidation.outcome,
          strategyDirection: bundle.technicalIntelligence.signalValidation.strategyDirection,
          indicatorAgreement: bundle.technicalIntelligence.signalValidation.indicatorAgreement,
          structureAgreement: bundle.technicalIntelligence.signalValidation.structureAgreement,
          trendAlignment: bundle.technicalIntelligence.signalValidation.trendAlignment,
          momentumConfirmation: bundle.technicalIntelligence.signalValidation.momentumConfirmation,
          rejectionReasons: bundle.technicalIntelligence.signalValidation.rejectionReasons,
          supportReasons: bundle.technicalIntelligence.signalValidation.supportReasons,
          confidenceType: "ANALYSIS_CONFIDENCE",
          isCalibratedWinProbability: false,
        },
      }
      : null,
    instrumentMeta: {
      pointSize: bundle.instrumentMeta.pointSize.value,
      tradingStatus: bundle.instrumentMeta.tradingStatus.value,
      volume: null,
      orderBook: null,
      economicCalendar: null,
      unavailable: [
        "volume",
        "orderBook",
        "economicCalendar",
        ...(bundle.instrumentMeta.session.status === "UNAVAILABLE" ? ["session"] : []),
      ],
    },
    quality: bundle.quality,
    openaiEvidenceDelivery: {
      schemaPresent: true,
      phase: "4.18F.5",
      evidenceVersion: bundle.evidenceVersion,
      historicalLiveSeparated: true,
      liveTickMovementIncluded: bundle.liveTickMovement?.latestTick?.value != null
        || (bundle.liveTickMovement?.windows?.length ?? 0) > 0,
      movementWindowIds: (bundle.liveTickMovement?.windows ?? []).map((w) => w.windowId),
      mtfMatrixIncluded: Array.isArray(bundle.multiTimeframe.alignment?.matrix)
        && (bundle.multiTimeframe.alignment?.matrix.length ?? 0) > 0,
      alignmentClassification: bundle.multiTimeframe.alignment?.classification ?? null,
      timeframeKeysInRequest: (bundle.multiTimeframe.alignment?.matrix ?? []).map((r) => r.timeframe),
      atrMethodLabel: "SMA_OF_TR",
      technicalIntelligenceIncluded: bundle.technicalIntelligence != null,
      marketStructureIncluded: bundle.technicalIntelligence?.structure != null
        || bundle.historical.primary?.structure != null,
      note: "Serialized for OpenAI request path via marketEvidenceForModelPrompt. Redacted — no secrets.",
    },
    analysisAuthorityNote:
      "OpenAI is advisory. Canonical reconciler is the authority for BUY/SELL candidates. Technical indicators validate — they never override deterministic NO_TRADE. Never invent missing fields. MTF TIMEFRAME_CONFLICT maps to HTF CONFLICT; missing HTF is not a conflict.",
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}
