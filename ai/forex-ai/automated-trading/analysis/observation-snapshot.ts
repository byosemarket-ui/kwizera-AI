/**
 * Phase 4.18F.7 — Immutable market observation snapshot shared by chart render + OpenAI evidence.
 * Platform Trading Station screenshot is NOT available on the VPS; image source remains SERVER_OHLC_RENDER.
 */
import { createHash, randomUUID } from "node:crypto";
import type { StrategyCandle } from "../auto-engine/strategy/rules.js";
import {
  buildTechnicalIntelligence,
  __indicatorTestUtils,
  type TechnicalIntelligenceBundle,
} from "../technical-intelligence/index.js";
import { AT_MTF_EVIDENCE_TIMEFRAMES } from "./market-evidence-builder.js";
import {
  evaluateEvidenceFreshness,
  type EvidenceFreshnessReport,
} from "./freshness-model.js";

export const AT_OBSERVATION_SNAPSHOT_SCHEMA = "kwizera.at-observation-snapshot.v1" as const;
export const AT_IMAGE_SOURCE_SERVER_OHLC = "SERVER_OHLC_RENDER" as const;

/** Documented feasibility: genuine Trading Station chart capture is not available on VPS. */
export const AT_PLATFORM_SCREENSHOT_AVAILABLE = false as const;
export const AT_PLATFORM_SCREENSHOT_BLOCKER =
  "No supported ForexConnect/Trading Station chart export or headless GUI capture on VPS. Using SERVER_OHLC_RENDER grounded in validated OHLC + indicators.";

export interface AtObservationQuote {
  bid: number | null;
  ask: number | null;
  mid: number | null;
  spread: number | null;
  quoteFresh: boolean;
  freshnessReasonCode: string | null;
  sourceTimestampMs: number | null;
  receivedAtMs: number | null;
}

export interface AtObservationTickSummary {
  lastAcceptedAtMs: number | null;
  accepted: number;
  windowIds: string[];
  freshWindowCount: number;
  totalWindows: number;
}

export interface AtObservationSnapshot {
  schemaVersion: typeof AT_OBSERVATION_SNAPSHOT_SCHEMA;
  phase: "4.18F.7";
  observationId: string;
  instrument: string;
  primaryTimeframe: string;
  observationUtc: string;
  observationMs: number;
  candlesByTf: Record<string, StrategyCandle[]>;
  primaryCandles: StrategyCandle[];
  quote: AtObservationQuote;
  ticks: AtObservationTickSummary;
  technical: TechnicalIntelligenceBundle | null;
  chartSeries: {
    sma9: Array<number | null>;
    sma21: Array<number | null>;
    sma50: Array<number | null>;
    sma200: Array<number | null>;
    ema9: Array<number | null>;
    ema21: Array<number | null>;
    ema50: Array<number | null>;
    ema200: Array<number | null>;
    rsi14: Array<number | null>;
    macd: Array<number | null>;
    macdSignal: Array<number | null>;
    macdHist: Array<number | null>;
    bbUpper: Array<number | null>;
    bbMid: Array<number | null>;
    bbLower: Array<number | null>;
  };
  structureLevels: Array<{ price: number; label: string }>;
  freshness: EvidenceFreshnessReport;
  candleRange: {
    firstOpenSec: number | null;
    lastOpenSec: number | null;
    closedCount: number;
    formingCount: number;
  };
  ohlcFingerprint: string;
  imageSource: typeof AT_IMAGE_SOURCE_SERVER_OHLC;
  platformScreenshotAvailable: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

export interface AtChartImageBinding {
  imageId: string;
  observationId: string;
  imageHash: string;
  instrument: string;
  primaryTimeframe: string;
  imageSource: typeof AT_IMAGE_SOURCE_SERVER_OHLC;
  generatedAtUtc: string;
  observationUtc: string;
  candleFirstOpenSec: number | null;
  candleLastOpenSec: number | null;
  bid: number | null;
  ask: number | null;
  tickLastAcceptedAtMs: number | null;
  evidenceVersion: string;
  byteLength: number;
  width: number;
  height: number;
}

function fingerprintOhlc(candlesByTf: Record<string, StrategyCandle[]>): string {
  const h = createHash("sha256");
  for (const tf of Object.keys(candlesByTf).sort()) {
    h.update(tf);
    for (const c of candlesByTf[tf] ?? []) {
      h.update(`${c.time}|${c.open}|${c.high}|${c.low}|${c.close}|${c.closed ? 1 : 0};`);
    }
  }
  return h.digest("hex").slice(0, 32);
}

function closedSeries(candles: StrategyCandle[]): StrategyCandle[] {
  let rows = candles.filter(
    (c) =>
      Number.isFinite(c.time)
      && Number.isFinite(c.open)
      && Number.isFinite(c.high)
      && Number.isFinite(c.low)
      && Number.isFinite(c.close),
  );
  if (rows.length && rows[rows.length - 1]!.closed === false) rows = rows.slice(0, -1);
  return rows;
}

function buildChartSeries(closed: StrategyCandle[]) {
  const closes = closed.map((c) => c.close);
  const end = closes.length - 1;
  const smaSeries = (period: number) =>
    closes.map((_, i) => __indicatorTestUtils.smaAt(closes, period, i));
  const ema9 = __indicatorTestUtils.emaSeries(closes, 9);
  const ema21 = __indicatorTestUtils.emaSeries(closes, 21);
  const ema50 = __indicatorTestUtils.emaSeries(closes, 50);
  const ema200 = __indicatorTestUtils.emaSeries(closes, 200);
  const rsi14 = __indicatorTestUtils.rsiSeries(closes, 14);
  const ema12 = __indicatorTestUtils.emaSeries(closes, 12);
  const ema26 = __indicatorTestUtils.emaSeries(closes, 26);
  const macd: Array<number | null> = closes.map((_, i) => {
    const a = ema12[i];
    const b = ema26[i];
    return a != null && b != null ? a - b : null;
  });
  const macdFinite = macd.filter((v): v is number => v != null);
  const signalSeed = __indicatorTestUtils.emaSeries(macdFinite, 9);
  let fi = 0;
  const macdSignal: Array<number | null> = macd.map((v) => {
    if (v == null) return null;
    const s = signalSeed[fi++] ?? null;
    return s;
  });
  const macdHist = macd.map((v, i) => {
    const s = macdSignal[i];
    return v != null && s != null ? v - s : null;
  });
  const bbUpper: Array<number | null> = [];
  const bbMid: Array<number | null> = [];
  const bbLower: Array<number | null> = [];
  for (let i = 0; i < closes.length; i++) {
    const bb = __indicatorTestUtils.bollingerAt(closes, 20, 2, i);
    bbUpper.push(bb?.upper ?? null);
    bbMid.push(bb?.mid ?? null);
    bbLower.push(bb?.lower ?? null);
  }
  void end;
  return {
    sma9: smaSeries(9),
    sma21: smaSeries(21),
    sma50: smaSeries(50),
    sma200: smaSeries(200),
    ema9,
    ema21,
    ema50,
    ema200,
    rsi14,
    macd,
    macdSignal,
    macdHist,
    bbUpper,
    bbMid,
    bbLower,
  };
}

export function buildAtObservationSnapshot(input: {
  instrument: string;
  primaryTimeframe: string;
  candlesByTf: Record<string, StrategyCandle[]>;
  quote: AtObservationQuote;
  ticks?: AtObservationTickSummary | null;
  nowMs?: number;
  observationId?: string;
  primaryTimeframeMs?: number;
}): AtObservationSnapshot {
  const nowMs = input.nowMs ?? Date.now();
  const instrument = String(input.instrument ?? "").trim();
  const primaryTimeframe = String(input.primaryTimeframe ?? "").trim() || "15m";
  const primaryCandles = [...(input.candlesByTf[primaryTimeframe] ?? [])];
  const closed = closedSeries(primaryCandles);
  let technical: TechnicalIntelligenceBundle | null = null;
  try {
    technical = buildTechnicalIntelligence({
      instrument,
      timeframe: primaryTimeframe,
      candles: primaryCandles,
      nowMs,
      strategyDirection: null,
      strategyCode: null,
      quoteFresh: input.quote.quoteFresh,
    });
  } catch {
    technical = null;
  }
  const chartSeries = buildChartSeries(closed.length ? closed : primaryCandles.filter((c) =>
    Number.isFinite(c.close)
  ));

  const structureLevels: Array<{ price: number; label: string }> = [];
  if (technical?.structure) {
    if (technical.structure.rangeHigh != null && Number.isFinite(technical.structure.rangeHigh)) {
      structureLevels.push({ price: technical.structure.rangeHigh, label: "RH" });
    }
    if (technical.structure.rangeLow != null && Number.isFinite(technical.structure.rangeLow)) {
      structureLevels.push({ price: technical.structure.rangeLow, label: "RL" });
    }
    for (const z of (technical.structure.zones ?? []).slice(0, 4)) {
      const price = Number(z.mid);
      const label = String(z.kind ?? "Z").slice(0, 4);
      if (Number.isFinite(price)) structureLevels.push({ price, label });
    }
  }

  const ticks = input.ticks ?? {
    lastAcceptedAtMs: null,
    accepted: 0,
    windowIds: [],
    freshWindowCount: 0,
    totalWindows: 0,
  };

  const lastOpen = primaryCandles.length
    ? primaryCandles[primaryCandles.length - 1]!.time
    : null;
  const firstOpen = primaryCandles.length ? primaryCandles[0]!.time : null;
  const formingCount = primaryCandles.filter((c) => c.closed === false).length;
  const closedCount = primaryCandles.length - formingCount;

  const mtfKeys = AT_MTF_EVIDENCE_TIMEFRAMES.filter((tf) => (input.candlesByTf[tf]?.length ?? 0) >= 20);
  const freshness = evaluateEvidenceFreshness({
    nowMs,
    quoteFresh: input.quote.quoteFresh,
    tickLastAcceptedAtMs: ticks.lastAcceptedAtMs,
    primaryCandleLastOpenSec: lastOpen,
    primaryTimeframeMs: input.primaryTimeframeMs ?? 900_000,
    movementWindowFreshCount: ticks.freshWindowCount,
    movementWindowTotal: ticks.totalWindows,
    mtfAvailableCount: mtfKeys.length,
    mtfRequiredCount: AT_MTF_EVIDENCE_TIMEFRAMES.length,
    mtfStaleCount: 0,
  });

  return {
    schemaVersion: AT_OBSERVATION_SNAPSHOT_SCHEMA,
    phase: "4.18F.7",
    observationId: input.observationId ?? randomUUID(),
    instrument,
    primaryTimeframe,
    observationUtc: new Date(nowMs).toISOString(),
    observationMs: nowMs,
    candlesByTf: input.candlesByTf,
    primaryCandles,
    quote: input.quote,
    ticks,
    technical,
    chartSeries,
    structureLevels,
    freshness,
    candleRange: {
      firstOpenSec: firstOpen,
      lastOpenSec: lastOpen,
      closedCount,
      formingCount,
    },
    ohlcFingerprint: fingerprintOhlc(input.candlesByTf),
    imageSource: AT_IMAGE_SOURCE_SERVER_OHLC,
    platformScreenshotAvailable: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

export function validateImageEvidenceBinding(input: {
  snapshot: AtObservationSnapshot;
  binding: AtChartImageBinding;
  imageBytes: Buffer;
}): { ok: true } | { ok: false; code: string; message: string } {
  const { snapshot, binding, imageBytes } = input;
  if (binding.observationId !== snapshot.observationId) {
    return { ok: false, code: "IMAGE_EVIDENCE_MISMATCH", message: "Image observationId does not match snapshot." };
  }
  if (binding.instrument !== snapshot.instrument) {
    return { ok: false, code: "IMAGE_EVIDENCE_MISMATCH", message: "Image instrument mismatch." };
  }
  if (binding.primaryTimeframe !== snapshot.primaryTimeframe) {
    return { ok: false, code: "IMAGE_EVIDENCE_MISMATCH", message: "Image timeframe mismatch." };
  }
  if (binding.candleFirstOpenSec !== snapshot.candleRange.firstOpenSec
    || binding.candleLastOpenSec !== snapshot.candleRange.lastOpenSec) {
    return { ok: false, code: "IMAGE_EVIDENCE_MISMATCH", message: "Image candle range mismatch." };
  }
  const hash = createHash("sha256").update(imageBytes).digest("hex").slice(0, 24);
  if (hash !== binding.imageHash) {
    return { ok: false, code: "IMAGE_EVIDENCE_MISMATCH", message: "Image bytes do not match recorded hash." };
  }
  const ageMs = Date.now() - Date.parse(binding.generatedAtUtc);
  if (Number.isFinite(ageMs) && ageMs > 15 * 60_000) {
    return { ok: false, code: "IMAGE_STALE", message: "Chart image is stale relative to analysis time." };
  }
  if (snapshot.freshness.quote === "STALE" && snapshot.freshness.genuineTicks !== "FRESH") {
    return { ok: false, code: "QUOTE_STALE", message: "Quote stale and no fresh genuine ticks." };
  }
  return { ok: true };
}

export function createChartImageBinding(input: {
  snapshot: AtObservationSnapshot;
  imageHash: string;
  byteLength: number;
  width: number;
  height: number;
  evidenceVersion?: string;
}): AtChartImageBinding {
  return {
    imageId: randomUUID(),
    observationId: input.snapshot.observationId,
    imageHash: input.imageHash,
    instrument: input.snapshot.instrument,
    primaryTimeframe: input.snapshot.primaryTimeframe,
    imageSource: AT_IMAGE_SOURCE_SERVER_OHLC,
    generatedAtUtc: new Date().toISOString(),
    observationUtc: input.snapshot.observationUtc,
    candleFirstOpenSec: input.snapshot.candleRange.firstOpenSec,
    candleLastOpenSec: input.snapshot.candleRange.lastOpenSec,
    bid: input.snapshot.quote.bid,
    ask: input.snapshot.quote.ask,
    tickLastAcceptedAtMs: input.snapshot.ticks.lastAcceptedAtMs,
    evidenceVersion: input.evidenceVersion ?? "4.18F.7",
    byteLength: input.byteLength,
    width: input.width,
    height: input.height,
  };
}
