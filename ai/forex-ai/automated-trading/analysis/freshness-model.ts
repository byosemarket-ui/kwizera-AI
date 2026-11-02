/**
 * Phase 4.18F.7 — Independent freshness evaluation for quote / ticks / candles / windows / image.
 * Fail-closed. Does not invent prices. Never weakens thresholds without documented rules.
 */

export type FreshnessState = "FRESH" | "STALE" | "UNAVAILABLE" | "UNKNOWN";

export interface EvidenceFreshnessReport {
  schemaVersion: "kwizera.evidence-freshness.v1";
  phase: "4.18F.7";
  evaluatedAtUtc: string;
  quote: FreshnessState;
  genuineTicks: FreshnessState;
  historicalCandles: FreshnessState;
  movementWindows: FreshnessState;
  image: FreshnessState;
  mtf: FreshnessState;
  /**
   * True only when neither a fresh verified quote NOR fresh genuine ticks are available.
   * Fresh ticks must not imply candles are live; stale quote must not be called fresh via candles.
   */
  historicalOnly: boolean;
  /** True when at least one live source (quote or genuine ticks) is FRESH. */
  hasLiveMarketSource: boolean;
  overallQuality: "SUFFICIENT" | "PARTIAL" | "HISTORICAL_ONLY" | "INSUFFICIENT" | "STALE_QUOTE";
  reasons: string[];
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

const DEFAULT_TICK_FRESH_MS = 120_000;
const DEFAULT_CANDLE_STALE_MS = 6 * 60 * 60_000;
const DEFAULT_IMAGE_STALE_MS = 15 * 60_000;

export function evaluateEvidenceFreshness(input: {
  nowMs?: number;
  quoteFresh: boolean | null;
  quoteAgeMs?: number | null;
  tickLastAcceptedAtMs?: number | null;
  tickFreshMaxAgeMs?: number;
  primaryCandleLastOpenSec?: number | null;
  primaryTimeframeMs?: number | null;
  candleStaleMaxAgeMs?: number;
  movementWindowFreshCount?: number;
  movementWindowTotal?: number;
  imageGeneratedAtMs?: number | null;
  imageStaleMaxAgeMs?: number;
  mtfAvailableCount?: number;
  mtfRequiredCount?: number;
  mtfStaleCount?: number;
}): EvidenceFreshnessReport {
  const nowMs = input.nowMs ?? Date.now();
  const reasons: string[] = [];

  let quote: FreshnessState = "UNKNOWN";
  if (input.quoteFresh === true) quote = "FRESH";
  else if (input.quoteFresh === false) {
    quote = "STALE";
    reasons.push("Verified quote is not fresh.");
  } else {
    quote = "UNAVAILABLE";
    reasons.push("Verified quote freshness unavailable.");
  }

  let genuineTicks: FreshnessState = "UNAVAILABLE";
  const tickAt = input.tickLastAcceptedAtMs;
  const tickMax = input.tickFreshMaxAgeMs ?? DEFAULT_TICK_FRESH_MS;
  if (typeof tickAt === "number" && Number.isFinite(tickAt) && tickAt > 0) {
    const age = nowMs - tickAt;
    if (age <= tickMax) genuineTicks = "FRESH";
    else {
      genuineTicks = "STALE";
      reasons.push(`Genuine ticks stale (ageMs=${Math.floor(age)}).`);
    }
  } else {
    reasons.push("No genuine tick acceptance timestamp.");
  }

  let historicalCandles: FreshnessState = "UNAVAILABLE";
  const lastOpen = input.primaryCandleLastOpenSec;
  const tfMs = input.primaryTimeframeMs ?? 900_000;
  const candleMax = input.candleStaleMaxAgeMs ?? Math.max(DEFAULT_CANDLE_STALE_MS, tfMs * 3);
  if (typeof lastOpen === "number" && Number.isFinite(lastOpen) && lastOpen > 0) {
    const candleAgeMs = nowMs - lastOpen * 1000;
    // Candles are historical by nature; FRESH means recent enough closed/open boundary for analysis.
    if (candleAgeMs <= candleMax) historicalCandles = "FRESH";
    else {
      historicalCandles = "STALE";
      reasons.push(`Primary candle series stale (ageMs=${Math.floor(candleAgeMs)}).`);
    }
  } else {
    reasons.push("Primary candle last-open unavailable.");
  }

  let movementWindows: FreshnessState = "UNAVAILABLE";
  const wTotal = input.movementWindowTotal ?? 0;
  const wFresh = input.movementWindowFreshCount ?? 0;
  if (wTotal > 0) {
    movementWindows = wFresh > 0 ? "FRESH" : "STALE";
    if (wFresh === 0) reasons.push("No fresh movement windows.");
  }

  let image: FreshnessState = "UNAVAILABLE";
  const imgAt = input.imageGeneratedAtMs;
  const imgMax = input.imageStaleMaxAgeMs ?? DEFAULT_IMAGE_STALE_MS;
  if (typeof imgAt === "number" && Number.isFinite(imgAt) && imgAt > 0) {
    image = nowMs - imgAt <= imgMax ? "FRESH" : "STALE";
    if (image === "STALE") reasons.push("Chart image stale relative to observation.");
  }

  let mtf: FreshnessState = "UNAVAILABLE";
  const avail = input.mtfAvailableCount ?? 0;
  const req = input.mtfRequiredCount ?? 6;
  const staleTf = input.mtfStaleCount ?? 0;
  if (avail <= 0) mtf = "UNAVAILABLE";
  else if (staleTf > 0 && staleTf >= avail) mtf = "STALE";
  else if (avail < Math.min(3, req)) {
    mtf = "UNAVAILABLE";
    reasons.push(`Insufficient MTF coverage (${avail}/${req}).`);
  } else mtf = "FRESH";

  const hasLiveMarketSource = quote === "FRESH" || genuineTicks === "FRESH";
  // HISTORICAL_ONLY only when no live quote AND no fresh genuine ticks.
  const historicalOnly = !hasLiveMarketSource;

  let overallQuality: EvidenceFreshnessReport["overallQuality"] = "PARTIAL";
  if (historicalCandles === "UNAVAILABLE") overallQuality = "INSUFFICIENT";
  else if (quote === "STALE" && genuineTicks !== "FRESH") overallQuality = "STALE_QUOTE";
  else if (historicalOnly) overallQuality = "HISTORICAL_ONLY";
  else if (
    quote === "FRESH"
    && historicalCandles === "FRESH"
    && (mtf === "FRESH" || mtf === "UNAVAILABLE")
  ) {
    overallQuality = mtf === "FRESH" ? "SUFFICIENT" : "PARTIAL";
  } else overallQuality = "PARTIAL";

  return {
    schemaVersion: "kwizera.evidence-freshness.v1",
    phase: "4.18F.7",
    evaluatedAtUtc: new Date(nowMs).toISOString(),
    quote,
    genuineTicks,
    historicalCandles,
    movementWindows,
    image,
    mtf,
    historicalOnly,
    hasLiveMarketSource,
    overallQuality,
    reasons: reasons.slice(0, 12),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}
