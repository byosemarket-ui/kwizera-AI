/**
 * Rolling spread statistics for Dynamic Spread Intelligence.
 * Contextual intelligence only — never invents samples or fixed permission thresholds.
 */
import {
  DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES,
  DYNAMIC_SPREAD_OBSERVATION_MAX_AGE_MS,
  type DynamicSpreadHistoricalObservation,
  type DynamicSpreadRollingStats,
} from "./types.js";

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

function percentileNearestRank(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (p <= 0) return sortedAsc[0]!;
  if (p >= 100) return sortedAsc[sortedAsc.length - 1]!;
  const rank = Math.ceil((p / 100) * sortedAsc.length) - 1;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank));
  return sortedAsc[idx]!;
}

function medianOf(sortedAsc: number[]): number | null {
  if (sortedAsc.length === 0) return null;
  const mid = Math.floor(sortedAsc.length / 2);
  if (sortedAsc.length % 2 === 1) return sortedAsc[mid]!;
  return (sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2;
}

function stdevOf(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const varSum = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(varSum);
}

/**
 * Build rolling stats from historical absolute spreads.
 * Filters to finite positive spreads within maxAgeMs of now.
 */
export function computeRollingSpreadStats(input: {
  currentSpread: number | null;
  historical: DynamicSpreadHistoricalObservation[] | null | undefined;
  nowMs?: number;
  minSamples?: number;
  maxAgeMs?: number;
  /** Price precision for abnormal compare (round before > P95). */
  pricePrecision?: number | null;
}): DynamicSpreadRollingStats {
  const nowMs = input.nowMs ?? Date.now();
  const minRequired = input.minSamples ?? DYNAMIC_SPREAD_MIN_ROLLING_SAMPLES;
  const maxAge = input.maxAgeMs ?? DYNAMIC_SPREAD_OBSERVATION_MAX_AGE_MS;
  const hist = Array.isArray(input.historical) ? input.historical : [];

  const usable: { spread: number; atMs: number; atUtc: string }[] = [];
  for (const row of hist) {
    if (!finitePositive(row.spreadAbsolute)) continue;
    const atMs = Date.parse(String(row.observedAtUtc || ""));
    if (!Number.isFinite(atMs)) continue;
    if (nowMs - atMs > maxAge) continue;
    if (atMs > nowMs + 5_000) continue; // reject future-dated
    usable.push({ spread: row.spreadAbsolute, atMs, atUtc: row.observedAtUtc });
  }
  usable.sort((a, b) => a.atMs - b.atMs);

  const values = usable.map((u) => u.spread);
  const sorted = [...values].sort((a, b) => a - b);
  const sufficient = values.length >= minRequired;
  const med = medianOf(sorted);
  const p50 = percentileNearestRank(sorted, 50);
  const p75 = percentileNearestRank(sorted, 75);
  const p90 = percentileNearestRank(sorted, 90);
  const p95 = percentileNearestRank(sorted, 95);
  const vol = stdevOf(values);

  let recentWidening: boolean | null = null;
  let abnormal: boolean | null = null;
  if (!sufficient) {
    recentWidening = null;
    abnormal = null;
  } else if (finitePositive(input.currentSpread) && finitePositive(p95) && finitePositive(med)) {
    const precision = input.pricePrecision;
    const round = (n: number): number => {
      if (precision == null || !Number.isInteger(precision) || precision < 0) return n;
      const f = 10 ** precision;
      return Math.round(n * f) / f;
    };
    const cur = round(input.currentSpread);
    const p95r = round(p95);
    const medR = round(med);
    abnormal = cur > p95r;
    // Recent widening: current above median and above p75.
    const p75r = finitePositive(p75) ? round(p75) : medR;
    recentWidening = cur > medR && cur >= p75r;
  } else {
    recentWidening = false;
    abnormal = false;
  }

  return {
    sampleCount: values.length,
    minRequiredSamples: minRequired,
    sufficient,
    currentSpread: finitePositive(input.currentSpread) ? input.currentSpread : null,
    median: med,
    p50,
    p75,
    p90,
    p95,
    volatility: vol,
    recentWidening,
    abnormal,
    oldestObservationAtUtc: usable[0]?.atUtc ?? null,
    newestObservationAtUtc: usable[usable.length - 1]?.atUtc ?? null,
    note: sufficient
      ? `Rolling window n=${values.length} (min ${minRequired}). Percentiles are contextual — not a fixed owner threshold.`
      : `Insufficient reliable observations: n=${values.length} < min ${minRequired}. Statistics not invented.`,
  };
}
