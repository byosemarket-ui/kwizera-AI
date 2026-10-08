/**
 * Phase 28 — Project timeframe ↔ official FXCM period_id mapping.
 * Official periods: m1,m5,m15,m30,H1,H2,H3,H4,H6,H8,D1,W1,M1
 * Only enable project timeframes with an exact native FXCM period (no approximation).
 */
import type { NormalizedTimeframeId } from "../binance/types.js";

export type FxcmPeriodId =
  | "m1" | "m5" | "m15" | "m30"
  | "H1" | "H2" | "H3" | "H4" | "H6" | "H8"
  | "D1" | "W1" | "M1";

/** Project timeframes that map 1:1 to FXCM native periods. */
export const FXCM_SUPPORTED_PROJECT_TIMEFRAMES = [
  "1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w",
] as const satisfies readonly NormalizedTimeframeId[];

export type FxcmSupportedProjectTimeframe = (typeof FXCM_SUPPORTED_PROJECT_TIMEFRAMES)[number];

const PROJECT_TO_FXCM: Record<FxcmSupportedProjectTimeframe, FxcmPeriodId> = {
  "1m": "m1",
  "5m": "m5",
  "15m": "m15",
  "30m": "m30",
  "1h": "H1",
  "4h": "H4",
  "1d": "D1",
  "1w": "W1",
};

/** Duration of one candle in milliseconds (UTC boundary helpers / gap detection). */
export const FXCM_TIMEFRAME_MS: Record<FxcmSupportedProjectTimeframe, number> = {
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
};

export function isFxcmSupportedProjectTimeframe(value: string): value is FxcmSupportedProjectTimeframe {
  return (FXCM_SUPPORTED_PROJECT_TIMEFRAMES as readonly string[]).includes(value);
}

export function toFxcmPeriodId(timeframe: string): FxcmPeriodId | null {
  if (!isFxcmSupportedProjectTimeframe(timeframe)) return null;
  return PROJECT_TO_FXCM[timeframe];
}

export function fromFxcmPeriodId(period: string): FxcmSupportedProjectTimeframe | null {
  const normalized = String(period ?? "").trim();
  // Official sample uses lowercase h1; accept case-insensitive match for known periods.
  const entry = Object.entries(PROJECT_TO_FXCM).find(
    ([, p]) => p.toLowerCase() === normalized.toLowerCase(),
  );
  return (entry?.[0] as FxcmSupportedProjectTimeframe | undefined) ?? null;
}
