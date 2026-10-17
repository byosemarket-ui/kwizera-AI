/**
 * Phase 50A.1 — Deterministic bullish price projection for multi-image analysis.
 * Scenario path only — not a calibrated forecast or target-hit probability.
 * Never mutates historical candles. Never fabricates targets without validated levels.
 */
import type { LocalSnapshotEvidencePackage } from "../snapshot-local/types.js";
import { DIRECTIONAL_CONFIDENCE_LABEL } from "./bullish-score.js";
import type {
  MultiImageCaptureRef,
  MultiImageDataProvenance,
  MultiImageMtfReasoning,
} from "./types.js";

export const BULLISH_PROJECTION_METHOD = "phase50a1-scenario-path-v1";
export const BULLISH_PROJECTION_TITLE = "BUY Analysis — Potential Price Projection";

export interface ProjectionCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface ProjectionPoint {
  t: number;
  price: number;
}

export interface BullishProjectionChartData {
  timeframe: string;
  historical: ProjectionCandle[];
  projected: ProjectionPoint[] | null;
  targetLine: number | null;
  targetZone: { low: number; high: number } | null;
  invalidationLine: number | null;
  /** Index of last historical candle — boundary between observed and scenario. */
  boundaryIndex: number;
  legend: {
    historical: string;
    projected: string;
    target: string;
    invalidation: string;
  };
  disclaimer: string;
}

export interface BullishPriceProjection {
  available: boolean;
  unavailableReason: string | null;
  method: typeof BULLISH_PROJECTION_METHOD;
  title: typeof BULLISH_PROJECTION_TITLE;
  instrument: string;
  provider: string;
  timeframe: string;
  reference: {
    price: number | null;
    source: string | null;
    timestampUtc: string | null;
  };
  directionalConfidencePercent: number | null;
  directionalConfidenceLabel: string;
  target: {
    kind: "price" | "zone";
    price: number | null;
    zoneLow: number | null;
    zoneHigh: number | null;
    provenance: string;
  } | null;
  projectedMovement: { absolute: number; percent: number } | null;
  forecastHorizon: string | null;
  supportingEvidence: string[];
  invalidation: { price: number | null; condition: string | null } | null;
  dataStatus: string;
  dataQuality: string;
  limitations: string[];
  disclaimer: string;
  targetProbabilityNote: string;
  chart: BullishProjectionChartData | null;
}

export interface ModelBullishProjectionHint {
  targetPrice: number | null;
  targetZoneLow: number | null;
  targetZoneHigh: number | null;
  invalidationPrice: number | null;
  forecastHorizon: string | null;
  evidence: string[];
}

function timeframeSeconds(tf: string): number {
  const m = String(tf).trim().toLowerCase().match(/^(\d+)(m|h|d|w)$/);
  if (!m) return 3600;
  const n = Number(m[1]);
  const u = m[2];
  if (u === "m") return n * 60;
  if (u === "h") return n * 3600;
  if (u === "d") return n * 86400;
  return n * 604800;
}

/** Extract finite price candidates from free text (levels, ranges, prose). */
export function extractPriceCandidates(text: string): number[] {
  if (!text) return [];
  const out: number[] = [];
  const re = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+|\d{3,7})/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const n = Number(String(match[1]).replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

export function priceWithinScale(
  price: number,
  reference: number,
  candles: ProjectionCandle[],
): boolean {
  if (!Number.isFinite(price) || !Number.isFinite(reference) || reference <= 0) return false;
  if (candles.length >= 2) {
    const lows = candles.map((c) => c.l);
    const highs = candles.map((c) => c.h);
    const minL = Math.min(...lows);
    const maxH = Math.max(...highs);
    const pad = Math.max((maxH - minL) * 0.35, reference * 0.02);
    return price >= minL - pad && price <= maxH + pad * 1.5;
  }
  const band = reference * 0.15;
  return price >= reference - band && price <= reference + band * 1.25;
}

function pickPrimaryInstrument(captures: MultiImageCaptureRef[]): {
  instrument: string;
  provider: string;
  timeframe: string;
} {
  const sorted = [...captures].sort((a, b) => timeframeSeconds(b.timeframe) - timeframeSeconds(a.timeframe));
  const primary = sorted[0] ?? captures[0];
  return {
    instrument: primary?.instrument.displaySymbol ?? "UNKNOWN",
    provider: String(primary?.instrument.provider ?? "UNKNOWN"),
    timeframe: primary?.timeframe ?? "1h",
  };
}

function resolveDataStatus(
  analysisTime: MultiImageDataProvenance["analysisTime"],
  captures: MultiImageCaptureRef[],
  hasCandles: boolean,
): string {
  const qf = String(analysisTime.quoteFreshness ?? "").toUpperCase();
  const fh = String(analysisTime.feedHealth ?? "").toUpperCase();
  if (qf === "LIVE" || fh === "LIVE") return "LIVE";
  if (qf === "HISTORICAL_ONLY" || fh === "HISTORICAL_ONLY") return "HISTORICAL_ONLY";
  if (qf === "STALE" || fh === "STALE" || qf === "STALE_DATA") return "STALE";
  const feeds = captures.map((c) => String(c.quote.feedHealth ?? "").toUpperCase());
  if (feeds.some((f) => f === "NO_RECENT_MARKET_UPDATES" || f === "NO_RECENT")) {
    return "NO_RECENT_MARKET_UPDATES";
  }
  if (feeds.some((f) => f === "MARKET_INACTIVE")) return "MARKET_INACTIVE";
  if (feeds.some((f) => f === "STALE")) return "STALE";
  if (!analysisTime.snapshotId && hasCandles) return "HISTORICAL_ONLY";
  if (!analysisTime.snapshotId) return "HISTORICAL_ONLY";
  return qf || fh || "UNAVAILABLE";
}

function resolveReference(input: {
  analysisTime: MultiImageDataProvenance["analysisTime"];
  captures: MultiImageCaptureRef[];
  candles: ProjectionCandle[];
}): { price: number; source: string; timestampUtc: string | null } | null {
  const at = input.analysisTime;
  if (at.lastPrice != null && Number.isFinite(at.lastPrice)) {
    return {
      price: at.lastPrice,
      source: "ANALYSIS_TIME lastPrice",
      timestampUtc: at.observedAtUtc,
    };
  }
  if (at.bid != null && Number.isFinite(at.bid)) {
    return {
      price: at.bid,
      source: "ANALYSIS_TIME bid",
      timestampUtc: at.observedAtUtc,
    };
  }
  const last = input.candles[input.candles.length - 1];
  if (last) {
    return {
      price: last.c,
      source: "ANALYSIS_TIME last closed candle close",
      timestampUtc: new Date(last.t * 1000).toISOString(),
    };
  }
  for (const c of input.captures) {
    const p = c.quote.lastPrice ?? c.quote.bid ?? c.quote.mid;
    if (p != null && Number.isFinite(p)) {
      return {
        price: p,
        source: `CAPTURE_TIME ${c.timeframe} quote (${c.quote.feedHealth})`,
        timestampUtc: c.capturedAtUtc,
      };
    }
  }
  return null;
}

function candlesFromEvidence(evidence: LocalSnapshotEvidencePackage | null): ProjectionCandle[] {
  if (!evidence?.candles?.length) return [];
  return evidence.candles
    .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.o) && Number.isFinite(c.h)
      && Number.isFinite(c.l) && Number.isFinite(c.c))
    .map((c) => ({ t: c.t, o: c.o, h: c.h, l: c.l, c: c.c }));
}

/**
 * Parse optional model bullishProjection block. Returns nulls when absent/invalid.
 * Numeric validation against scale happens later in buildBullishPriceProjection.
 */
export function parseModelBullishProjectionHint(raw: unknown): ModelBullishProjectionHint {
  const empty: ModelBullishProjectionHint = {
    targetPrice: null,
    targetZoneLow: null,
    targetZoneHigh: null,
    invalidationPrice: null,
    forecastHorizon: null,
    evidence: [],
  };
  if (!raw || typeof raw !== "object") return empty;
  const block = (raw as Record<string, unknown>).bullishProjection
    ?? (raw as Record<string, unknown>).priceProjection;
  if (!block || typeof block !== "object") return empty;
  const b = block as Record<string, unknown>;
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim()) {
      const n = Number(v.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };
  const evidence = Array.isArray(b.evidence)
    ? b.evidence.filter((x): x is string => typeof x === "string").slice(0, 8)
    : [];
  return {
    targetPrice: num(b.targetPrice),
    targetZoneLow: num(b.targetZoneLow ?? b.zoneLow),
    targetZoneHigh: num(b.targetZoneHigh ?? b.zoneHigh),
    invalidationPrice: num(b.invalidationPrice),
    forecastHorizon: typeof b.forecastHorizon === "string" ? b.forecastHorizon.slice(0, 120) : null,
    evidence,
  };
}

function collectLevelPrices(
  mtf: MultiImageMtfReasoning,
  texts: string[],
): Array<{ price: number; provenance: string; role: "level" | "text" }> {
  const out: Array<{ price: number; provenance: string; role: "level" | "text" }> = [];
  for (const lvl of mtf.keyLevels) {
    for (const p of extractPriceCandidates(lvl.level)) {
      out.push({
        price: p,
        provenance: `${lvl.provenance}:${lvl.level}`,
        role: "level",
      });
    }
  }
  for (const t of texts) {
    for (const p of extractPriceCandidates(t)) {
      out.push({ price: p, provenance: `text:${t.slice(0, 80)}`, role: "text" });
    }
  }
  return out;
}

function buildScenarioPath(
  historical: ProjectionCandle[],
  referencePrice: number,
  targetPrice: number,
  timeframe: string,
): ProjectionPoint[] {
  const tfSec = timeframeSeconds(timeframe);
  const lastT = historical.length
    ? historical[historical.length - 1]!.t
    : Math.floor(Date.now() / 1000);
  const bars = Math.min(12, Math.max(4, Math.ceil(Math.max(historical.length, 8) * 0.12)));
  const points: ProjectionPoint[] = [{ t: lastT, price: referencePrice }];
  for (let i = 1; i <= bars; i++) {
    const w = i / bars;
    // Mild ease-out scenario — not a statistical model.
    const eased = 1 - (1 - w) * (1 - w);
    points.push({
      t: lastT + i * tfSec,
      price: referencePrice + (targetPrice - referencePrice) * eased,
    });
  }
  return points;
}

export function buildBullishPriceProjection(input: {
  decision: string;
  marketBias: string;
  directionalConfidencePercent: number | null;
  supportsBuyHypothesis: boolean;
  mtf: MultiImageMtfReasoning;
  captures: MultiImageCaptureRef[];
  provenance: MultiImageDataProvenance;
  evidence: LocalSnapshotEvidencePackage | null;
  modelHint: ModelBullishProjectionHint;
  dataQuality: string;
  bullishScenario: string;
  bearishScenario: string;
  invalidationConditions: string[];
  keyEvidence: string[];
}): BullishPriceProjection {
  const id = pickPrimaryInstrument(input.captures);
  const candles = candlesFromEvidence(input.evidence);
  // Freeze a copy — callers must never mutate historical series.
  const historical = candles.map((c) => ({ ...c }));
  const dataStatus = resolveDataStatus(input.provenance.analysisTime, input.captures, historical.length > 0);
  const disclaimer =
    "Projected path is an analytical bullish scenario derived from validated levels — not a known future price, not a broker order, and not a calibrated probability of reaching the target.";
  const targetProbabilityNote =
    `${DIRECTIONAL_CONFIDENCE_LABEL} measures bullish directional conviction only. `
    + "It is not the probability that price will reach the stated target.";

  const baseLimitations: string[] = [];
  if (!input.provenance.analysisTime.snapshotId) {
    baseLimitations.push("No ANALYSIS_TIME immutable snapshot — projection relies on capture quotes and/or linked evidence candles when present.");
  }
  if (historical.length === 0) {
    baseLimitations.push("No structured OHLC series available for this request — chart history unavailable.");
  }
  if (dataStatus === "STALE" || dataStatus === "MARKET_INACTIVE" || dataStatus === "NO_RECENT_MARKET_UPDATES") {
    baseLimitations.push(`Market data status ${dataStatus} — not a live entry signal.`);
  }
  if (dataStatus === "HISTORICAL_ONLY") {
    baseLimitations.push("HISTORICAL_ONLY context — not presented as a live entry opportunity.");
  }

  const empty = (reason: string, partial?: Partial<BullishPriceProjection>): BullishPriceProjection => ({
    available: false,
    unavailableReason: reason,
    method: BULLISH_PROJECTION_METHOD,
    title: BULLISH_PROJECTION_TITLE,
    instrument: id.instrument,
    provider: id.provider,
    timeframe: input.evidence?.candleTimeframe ?? id.timeframe,
    reference: { price: null, source: null, timestampUtc: null },
    directionalConfidencePercent: input.directionalConfidencePercent,
    directionalConfidenceLabel: DIRECTIONAL_CONFIDENCE_LABEL,
    target: null,
    projectedMovement: null,
    forecastHorizon: null,
    supportingEvidence: [],
    invalidation: null,
    dataStatus,
    dataQuality: input.dataQuality,
    limitations: [...baseLimitations, reason],
    disclaimer,
    targetProbabilityNote,
    chart: historical.length
      ? {
        timeframe: input.evidence?.candleTimeframe ?? id.timeframe,
        historical,
        projected: null,
        targetLine: null,
        targetZone: null,
        invalidationLine: null,
        boundaryIndex: historical.length - 1,
        legend: {
          historical: "Actual observed candles",
          projected: "Bullish scenario (not future fact)",
          target: "Potential target",
          invalidation: "Invalidation level",
        },
        disclaimer,
      }
      : null,
    ...partial,
  });

  if (!input.supportsBuyHypothesis && String(input.decision).toUpperCase() !== "BUY") {
    return empty(
      "Bullish price projection is shown only when evidence supports a BUY-side directional hypothesis.",
    );
  }

  const ref = resolveReference({
    analysisTime: input.provenance.analysisTime,
    captures: input.captures,
    candles: historical,
  });
  if (!ref) {
    return empty("No reference price available from analysis-time quote, candles, or capture metadata.");
  }

  const levelPool = collectLevelPrices(input.mtf, [
    input.bullishScenario,
    input.mtf.bullishScenario ?? "",
    ...input.mtf.invalidationConditions,
    ...input.invalidationConditions,
    ...input.keyEvidence,
  ]);

  const validAbove = levelPool
    .filter((l) => l.price > ref.price && priceWithinScale(l.price, ref.price, historical))
    .sort((a, b) => a.price - b.price);

  const validBelow = levelPool
    .filter((l) => l.price < ref.price && priceWithinScale(l.price, ref.price, historical))
    .sort((a, b) => b.price - a.price);

  let targetPrice: number | null = null;
  let zoneLow: number | null = null;
  let zoneHigh: number | null = null;
  let targetProvenance = "";
  let targetKind: "price" | "zone" = "price";

  const hint = input.modelHint;
  if (
    hint.targetZoneLow != null
    && hint.targetZoneHigh != null
    && hint.targetZoneHigh > hint.targetZoneLow
    && hint.targetZoneLow > ref.price
    && priceWithinScale(hint.targetZoneLow, ref.price, historical)
    && priceWithinScale(hint.targetZoneHigh, ref.price, historical)
  ) {
    zoneLow = hint.targetZoneLow;
    zoneHigh = hint.targetZoneHigh;
    targetPrice = (zoneLow + zoneHigh) / 2;
    targetKind = "zone";
    targetProvenance = "MODEL_HINT zone (scale-validated)";
  } else if (
    hint.targetPrice != null
    && hint.targetPrice > ref.price
    && priceWithinScale(hint.targetPrice, ref.price, historical)
  ) {
    targetPrice = hint.targetPrice;
    targetProvenance = "MODEL_HINT targetPrice (scale-validated)";
  } else if (validAbove.length >= 2) {
    zoneLow = validAbove[0]!.price;
    zoneHigh = validAbove[Math.min(1, validAbove.length - 1)]!.price;
    if (zoneHigh <= zoneLow && validAbove.length > 1) {
      zoneHigh = validAbove[validAbove.length - 1]!.price;
    }
    if (zoneHigh > zoneLow) {
      targetKind = "zone";
      targetPrice = (zoneLow + zoneHigh) / 2;
      targetProvenance = `KEY_LEVELS zone from ${validAbove[0]!.provenance}`;
    } else {
      targetPrice = validAbove[0]!.price;
      targetProvenance = validAbove[0]!.provenance;
      zoneLow = null;
      zoneHigh = null;
    }
  } else if (validAbove.length === 1) {
    targetPrice = validAbove[0]!.price;
    targetProvenance = validAbove[0]!.provenance;
  }

  if (targetPrice == null || !(targetPrice > ref.price)) {
    const withRef = empty(
      "No defensible bullish target above the reference price could be validated from structured levels or scale-checked model hints.",
    );
    withRef.reference = {
      price: ref.price,
      source: ref.source,
      timestampUtc: ref.timestampUtc,
    };
    return withRef;
  }

  let invalidationPrice: number | null = null;
  let invalidationCondition: string | null = null;
  if (
    hint.invalidationPrice != null
    && hint.invalidationPrice < ref.price
    && priceWithinScale(hint.invalidationPrice, ref.price, historical)
  ) {
    invalidationPrice = hint.invalidationPrice;
    invalidationCondition = "Model invalidation price (scale-validated).";
  } else if (validBelow.length) {
    invalidationPrice = validBelow[0]!.price;
    invalidationCondition = `Nearest validated support below reference (${validBelow[0]!.provenance}).`;
  } else if (input.invalidationConditions[0] || input.mtf.invalidationConditions[0]) {
    invalidationCondition = input.mtf.invalidationConditions[0]
      ?? input.invalidationConditions[0]
      ?? null;
  }

  const absolute = targetPrice - ref.price;
  const percent = (absolute / ref.price) * 100;
  const tf = input.evidence?.candleTimeframe ?? id.timeframe;
  const projectedBars = Math.min(12, Math.max(4, Math.ceil(Math.max(historical.length, 8) * 0.12)));
  const forecastHorizon = hint.forecastHorizon
    ?? `${projectedBars} × ${tf} scenario bars (method ${BULLISH_PROJECTION_METHOD})`;

  const supportingEvidence = [
    ...hint.evidence,
    targetProvenance ? `Target derived from ${targetProvenance}.` : "",
    ref.source ? `Reference ${ref.price} via ${ref.source}.` : "",
    ...input.keyEvidence.filter((e) => /bullish|higher|support|VISIBLE_IN_IMAGE|CONFIRMED_BY_DATA/i.test(e)).slice(0, 4),
    input.mtf.bullishScenario ?? input.bullishScenario ?? "",
  ].filter(Boolean).slice(0, 10);

  const projected = historical.length
    ? buildScenarioPath(historical, ref.price, targetPrice, tf)
    : null;

  const chart: BullishProjectionChartData | null = historical.length
    ? {
      timeframe: tf,
      historical,
      projected,
      targetLine: targetKind === "price" ? targetPrice : null,
      targetZone: targetKind === "zone" && zoneLow != null && zoneHigh != null
        ? { low: zoneLow, high: zoneHigh }
        : null,
      invalidationLine: invalidationPrice,
      boundaryIndex: historical.length - 1,
      legend: {
        historical: "Actual observed candles",
        projected: "Bullish scenario (not future fact)",
        target: "Potential target / zone",
        invalidation: "Invalidation level",
      },
      disclaimer,
    }
    : null;

  return {
    available: true,
    unavailableReason: null,
    method: BULLISH_PROJECTION_METHOD,
    title: BULLISH_PROJECTION_TITLE,
    instrument: id.instrument,
    provider: id.provider,
    timeframe: tf,
    reference: {
      price: ref.price,
      source: ref.source,
      timestampUtc: ref.timestampUtc,
    },
    directionalConfidencePercent: input.directionalConfidencePercent,
    directionalConfidenceLabel: DIRECTIONAL_CONFIDENCE_LABEL,
    target: {
      kind: targetKind,
      price: targetPrice,
      zoneLow,
      zoneHigh,
      provenance: targetProvenance,
    },
    projectedMovement: {
      absolute: Number(absolute.toFixed(6)),
      percent: Number(percent.toFixed(4)),
    },
    forecastHorizon,
    supportingEvidence,
    invalidation: {
      price: invalidationPrice,
      condition: invalidationCondition,
    },
    dataStatus,
    dataQuality: input.dataQuality,
    limitations: baseLimitations.length
      ? baseLimitations
      : ["Scenario interpolation only — not backtested target-hit probability."],
    disclaimer,
    targetProbabilityNote,
    chart,
  };
}

/** Deep-freeze helper for tests: assert historical candles unchanged after build. */
export function cloneCandles(candles: ProjectionCandle[]): ProjectionCandle[] {
  return candles.map((c) => ({ ...c }));
}
