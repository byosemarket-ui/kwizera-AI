/**
 * Stage 1 — Draft spread recommendations from LIVE evidence only.
 * Never invents thresholds. Never auto-approves. Owner remains final authority.
 */
import { MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION } from "./observation-evidence.js";
import type { LiveSpreadObservationRecord } from "./spread-observation-collector.js";
import type { Stage3TrackedInstrument } from "./types.js";
import { documentedPrecision } from "./validate.js";

export interface SpreadRecommendationDraft {
  instrument: Stage3TrackedInstrument;
  units: "absolute_price";
  pricePrecision: number | null;
  validObservationCount: number;
  minRequired: number;
  sufficient: boolean;
  minSpread: number | null;
  maxSpread: number | null;
  meanSpread: number | null;
  medianSpread: number | null;
  p95Spread: number | null;
  observationTimeRange: { fromUtc: string | null; toUtc: string | null };
  providers: string[];
  evidenceQuality: "INSUFFICIENT" | "ADEQUATE_FOR_DRAFT" | "SYNTHETIC_TEST_ONLY";
  /** Draft suggestion only — NEVER an approved policy value. */
  recommendedMaxSpreadAbsolute: number | null;
  recommendationBasis: string | null;
  autoApproved: false;
  mayActivateWithoutOwner: false;
  note: string;
}

function percentileNearestRank(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length < 5) return null; // refuse p95 on tiny samples
  const rank = Math.ceil((p / 100) * sortedAsc.length) - 1;
  const idx = Math.max(0, Math.min(sortedAsc.length - 1, rank));
  return sortedAsc[idx] ?? null;
}

function median(sortedAsc: number[]): number | null {
  if (sortedAsc.length === 0) return null;
  const mid = Math.floor(sortedAsc.length / 2);
  if (sortedAsc.length % 2 === 1) return sortedAsc[mid]!;
  return (sortedAsc[mid - 1]! + sortedAsc[mid]!) / 2;
}

/**
 * Build a draft recommendation from accepted LIVE records.
 * recommendedMaxSpreadAbsolute uses max observed when sufficient samples exist —
 * still requires owner propose→approve+confirm. Never activates.
 */
export function draftSpreadRecommendation(input: {
  instrument: Stage3TrackedInstrument;
  acceptedLive: LiveSpreadObservationRecord[];
  /** When true, label as synthetic test draft (must not ship as production evidence). */
  syntheticTestData?: boolean;
}): SpreadRecommendationDraft {
  const rows = input.acceptedLive.filter((r) => r.instrument === input.instrument);
  const spreads = rows.map((r) => r.spreadAbsolute).filter((n) => Number.isFinite(n) && n > 0);
  const sorted = [...spreads].sort((a, b) => a - b);
  const sufficient = spreads.length >= MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION;
  const times = rows
    .map((r) => r.observedAtUtc)
    .filter((t) => Number.isFinite(Date.parse(t)))
    .sort();
  const providers = [...new Set(rows.map((r) => r.provider))];

  if (input.syntheticTestData) {
    return {
      instrument: input.instrument,
      units: "absolute_price",
      pricePrecision: documentedPrecision(input.instrument),
      validObservationCount: spreads.length,
      minRequired: MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION,
      sufficient: false,
      minSpread: sorted[0] ?? null,
      maxSpread: sorted.length ? sorted[sorted.length - 1]! : null,
      meanSpread: spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length : null,
      medianSpread: median(sorted),
      p95Spread: percentileNearestRank(sorted, 95),
      observationTimeRange: { fromUtc: times[0] ?? null, toUtc: times[times.length - 1] ?? null },
      providers,
      evidenceQuality: "SYNTHETIC_TEST_ONLY",
      recommendedMaxSpreadAbsolute: null,
      recommendationBasis: null,
      autoApproved: false,
      mayActivateWithoutOwner: false,
      note: "SYNTHETIC_TEST_DATA — must not be used as production recommendation or approval.",
    };
  }

  const maxSpread = sorted.length ? sorted[sorted.length - 1]! : null;
  return {
    instrument: input.instrument,
    units: "absolute_price",
    pricePrecision: documentedPrecision(input.instrument),
    validObservationCount: spreads.length,
    minRequired: MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION,
    sufficient,
    minSpread: sorted[0] ?? null,
    maxSpread,
    meanSpread: spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length : null,
    medianSpread: median(sorted),
    p95Spread: percentileNearestRank(sorted, 95),
    observationTimeRange: { fromUtc: times[0] ?? null, toUtc: times[times.length - 1] ?? null },
    providers,
    evidenceQuality: sufficient ? "ADEQUATE_FOR_DRAFT" : "INSUFFICIENT",
    recommendedMaxSpreadAbsolute: sufficient ? maxSpread : null,
    recommendationBasis: sufficient
      ? "Draft = max observed LIVE absolute spread across ≥20 independent samples (owner may choose differently)."
      : null,
    autoApproved: false,
    mayActivateWithoutOwner: false,
    note: sufficient
      ? "Draft recommendation ready for owner review only — propose→approve+confirm required. Not active."
      : `Insufficient LIVE evidence (${spreads.length}/${MIN_LIVE_SPREAD_OBSERVATIONS_FOR_RECOMMENDATION}).`,
  };
}
