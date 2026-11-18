/**
 * Phase 5B.1 — Canonical candle contract + shared OHLC / volume helpers.
 *
 * Close-time convention when duration is known: half-open interval
 *   [openTimeSec, closeTimeSec)
 * i.e. closeTimeSec = openTimeSec + durationSec (exclusive end).
 * openTimeSec is never rewritten; timezone is not assumed UTC.
 */
import { timeframeSeconds } from "../../live-candle-engine.js";
import type { MifCanonicalInstrument } from "./instrument.js";
import {
  MIF_MARKET_DATA_CONTRACT_ID,
  MIF_MARKET_DATA_CONTRACT_VERSION,
  MIF_PROVIDER_ID,
  type MifAvailabilityStatus,
  type MifCandleState,
  type MifPriceBasis,
  type MifProviderId,
  type MifSafetyFlags,
  type MifSourceDialect,
  type MifTimebase,
  type MifValidationMeta,
  type MifVolumeType,
} from "./types.js";

/**
 * Explicit duration map for UnifiedCandle CanonicalTimeframeId labels.
 * Only listed values are supported — no guessing.
 */
export const MIF_UNIFIED_TIMEFRAME_DURATION_SEC: Readonly<Record<string, number>> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "30m": 1800,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
  "1w": 604800,
};

export interface MifCanonicalCandle extends MifSafetyFlags {
  contractId: typeof MIF_MARKET_DATA_CONTRACT_ID;
  contractVersion: typeof MIF_MARKET_DATA_CONTRACT_VERSION;
  providerId: MifProviderId;
  providerSymbol: string;
  timeframe: string;
  /** Broker candle open time (unix seconds). Not assumed UTC. */
  openTimeSec: number;
  /**
   * Exclusive end of [openTimeSec, closeTimeSec) when duration is known; otherwise null.
   * Never fabricated for unknown/unsupported timeframes (e.g. MN1).
   */
  closeTimeSec: number | null;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Independent source tick volume — null means missing, never coerced to 0. */
  tickVolume: number | null;
  /** Independent source real volume — null means missing, never coerced to 0. */
  realVolume: number | null;
  /**
   * Ambiguous single-field volume (e.g. UnifiedCandle.volume) when type cannot be recovered.
   * Used only with volumeType === "unknown_collapsed". Never a substitute that clears
   * genuine tickVolume/realVolume from HFM historical/forming sources.
   */
  collapsedVolume: number | null;
  /**
   * Classification of which volume fields are populated / ambiguous.
   * Always also read tickVolume, realVolume, and collapsedVolume.
   */
  volumeType: MifVolumeType;
  spread: number | null;
  candleState: MifCandleState;
  priceBasis: MifPriceBasis;
  timebase: MifTimebase;
  /** null = unknown offset (NOT UTC). */
  timezoneOffsetSec: number | null;
  brokerTimestampSec: number | null;
  receivedAt: string | null;
  availableAt: string | null;
  availabilityStatus: MifAvailabilityStatus;
  sourceDialect: MifSourceDialect;
  sourceProvenance: string;
  sourceMode: string | null;
  sourceDataQuality: string | null;
  validation: MifValidationMeta;
  instrument: MifCanonicalInstrument | null;
  /**
   * Descriptive metadata only: this adapter path does not provide live subscription.
   * Not a security control — live routing is enforced by not wiring MarketDataService live HFM.
   */
  claimsLiveSubscription: false;
}

/** Resolve fixed candle duration in seconds, or null if unsupported/unknown. */
export function resolveTimeframeDurationSec(timeframe: string): number | null {
  const raw = String(timeframe || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  // MT5-style labels via live-candle-engine (MN1 explicitly unsupported → null).
  const mt5 = timeframeSeconds(upper);
  if (mt5 != null) return mt5;
  // Unified CanonicalTimeframeId labels (lowercase in contracts).
  const unified = MIF_UNIFIED_TIMEFRAME_DURATION_SEC[raw.toLowerCase()];
  if (typeof unified === "number" && Number.isFinite(unified)) return unified;
  return null;
}

/**
 * Derive exclusive close bound for [open, close).
 * Returns null when timeframe duration cannot be mapped safely.
 */
export function deriveCloseTimeSec(openTimeSec: number, timeframe: string): number | null {
  const step = resolveTimeframeDurationSec(timeframe);
  if (step == null || !Number.isFinite(openTimeSec) || openTimeSec <= 0) return null;
  return openTimeSec + step;
}

export function classifyVolumeType(
  tickVolume: number | null,
  realVolume: number | null,
): Exclude<MifVolumeType, "unknown_collapsed"> {
  const hasTick = tickVolume != null && Number.isFinite(tickVolume);
  const hasReal = realVolume != null && Number.isFinite(realVolume);
  if (hasTick && hasReal) return "tick_and_real";
  if (hasReal) return "real";
  if (hasTick) return "tick";
  return "none";
}

export function isFiniteOhlc(input: {
  open: number;
  high: number;
  low: number;
  close: number;
  openTimeSec: number;
}): boolean {
  const { open, high, low, close, openTimeSec } = input;
  if (![open, high, low, close, openTimeSec].every((n) => typeof n === "number" && Number.isFinite(n))) {
    return false;
  }
  if (openTimeSec <= 0) return false;
  if (high < low) return false;
  if (high < open || high < close) return false;
  if (low > open || low > close) return false;
  return true;
}

export function baseCanonicalCandle(partial: Omit<
  MifCanonicalCandle,
  | "contractId"
  | "contractVersion"
  | "providerId"
  | "claimsLiveSubscription"
  | "placesOrders"
  | "mutatesBroker"
  | "acceptsForExecution"
> & {
  providerId?: MifProviderId;
}): MifCanonicalCandle {
  return {
    contractId: MIF_MARKET_DATA_CONTRACT_ID,
    contractVersion: MIF_MARKET_DATA_CONTRACT_VERSION,
    providerId: MIF_PROVIDER_ID,
    claimsLiveSubscription: false,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    ...partial,
  };
}
