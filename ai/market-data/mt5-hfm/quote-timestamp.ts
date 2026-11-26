/**
 * STEP 1B / B1 — HFM quote timestamp normalization.
 *
 * MT5 MqlTick.time / SYMBOL_TIME and TimeCurrent() are broker-server clock values
 * (unix-like seconds in the broker timezone). TimeGMT() is MT5's GMT/UTC clock.
 * Offset is derived per snapshot: brokerTime - gmtTime. Never hardcode UTC+2.
 */

export const HFM_TIMESTAMP_SOURCES = [
  "mt5_tick",
  "mt5_symbol_time",
  "unknown",
] as const;
export type HfmTimestampSource = (typeof HFM_TIMESTAMP_SOURCES)[number];

export const HFM_TIMESTAMP_NORMALIZATION_STATUSES = [
  "NORMALIZED",
  "UNAVAILABLE",
  "UNRELIABLE",
  "PARTIAL",
] as const;
export type HfmTimestampNormalizationStatus =
  (typeof HFM_TIMESTAMP_NORMALIZATION_STATUSES)[number];

/** Realistic absolute TZ bound (±14h). Beyond this, clocks are treated as unreliable. */
export const HFM_MAX_TRUSTED_BROKER_UTC_OFFSET_SEC = 14 * 3600;

/**
 * Soft bound: offsets that are not near a 15-minute boundary are unusual for FX
 * brokers. We still normalize but mark PARTIAL so consumers can treat carefully.
 */
export const HFM_OFFSET_QUARTER_HOUR_SEC = 15 * 60;

export interface HfmBrokerClockInput {
  /** MT5 TimeCurrent() — broker server seconds. */
  brokerTime: number | null | undefined;
  /** MT5 TimeGMT() — GMT/UTC seconds. */
  gmtTime: number | null | undefined;
}

export interface HfmBrokerUtcOffsetResult {
  brokerUtcOffsetSec: number | null;
  status: HfmTimestampNormalizationStatus;
  reason: string | null;
}

export interface HfmQuoteTimestampNormalizationInput {
  /** Raw broker-domain tick time (seconds). Preserved as quoteTimestamp. */
  quoteTimestampSec: number | null;
  /** Raw broker-domain tick time (milliseconds) when available. */
  quoteTimestampMs: number | null;
  brokerUtcOffsetSec: number | null;
  offsetStatus: HfmTimestampNormalizationStatus;
  offsetReason: string | null;
  acquisitionMethod?: "SymbolInfoTick" | "SymbolInfoDouble" | "unknown" | null;
  /** Core/agent receipt instant as UTC epoch seconds. */
  receivedAtUtcSec: number | null;
}

export interface HfmQuoteTimestampNormalizationResult {
  quoteTimestamp: number | null;
  quoteTimestampMs: number | null;
  quoteTimestampUtc: number | null;
  quoteTimestampUtcMs: number | null;
  brokerUtcOffsetSec: number | null;
  /** Raw broker tick seconds minus Core receipt UTC seconds (documents aheadness). */
  clockSkewSec: number | null;
  timestampSource: HfmTimestampSource;
  timestampNormalizationStatus: HfmTimestampNormalizationStatus;
  timestampNormalizationReason: string | null;
}

function asFinitePositive(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

/**
 * Derive brokerUtcOffsetSec = brokerTime - gmtTime from MT5 snapshot clocks.
 * Positive means broker clock is ahead of GMT (e.g. +7200 for UTC+2).
 */
export function deriveHfmBrokerUtcOffset(
  input: HfmBrokerClockInput,
): HfmBrokerUtcOffsetResult {
  const brokerTime = asFinitePositive(input.brokerTime);
  const gmtTime = asFinitePositive(input.gmtTime);

  if (brokerTime == null && gmtTime == null) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNAVAILABLE",
      reason: "MISSING_BROKER_AND_GMT_TIME",
    };
  }
  if (brokerTime == null) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNAVAILABLE",
      reason: "MISSING_BROKER_TIME",
    };
  }
  if (gmtTime == null) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNAVAILABLE",
      reason: "MISSING_GMT_TIME",
    };
  }

  const offset = brokerTime - gmtTime;
  if (!Number.isFinite(offset)) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNRELIABLE",
      reason: "OFFSET_NOT_FINITE",
    };
  }
  if (Math.abs(offset) > HFM_MAX_TRUSTED_BROKER_UTC_OFFSET_SEC) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNRELIABLE",
      reason: "OFFSET_ABS_EXCEEDS_14H",
    };
  }

  const nearQuarterHour =
    Math.abs(offset % HFM_OFFSET_QUARTER_HOUR_SEC) < 1 ||
    Math.abs(Math.abs(offset % HFM_OFFSET_QUARTER_HOUR_SEC) - HFM_OFFSET_QUARTER_HOUR_SEC) < 1;

  if (!nearQuarterHour) {
    return {
      brokerUtcOffsetSec: offset,
      status: "PARTIAL",
      reason: "OFFSET_NOT_QUARTER_HOUR_ALIGNED",
    };
  }

  return {
    brokerUtcOffsetSec: offset,
    status: "NORMALIZED",
    reason: null,
  };
}

export function resolveHfmTimestampSource(
  acquisitionMethod: "SymbolInfoTick" | "SymbolInfoDouble" | "unknown" | null | undefined,
): HfmTimestampSource {
  if (acquisitionMethod === "SymbolInfoTick") return "mt5_tick";
  if (acquisitionMethod === "SymbolInfoDouble") return "mt5_symbol_time";
  return "unknown";
}

/**
 * Convert broker-domain tick time to UTC using a derived offset.
 * Does not invent timestamps when offset or tick time is missing/unreliable.
 */
export function normalizeHfmQuoteTimestamps(
  input: HfmQuoteTimestampNormalizationInput,
): HfmQuoteTimestampNormalizationResult {
  const quoteTimestamp = asFinitePositive(input.quoteTimestampSec);
  const quoteTimestampMs =
    typeof input.quoteTimestampMs === "number" &&
    Number.isFinite(input.quoteTimestampMs) &&
    input.quoteTimestampMs > 0
      ? input.quoteTimestampMs
      : null;

  const timestampSource = resolveHfmTimestampSource(input.acquisitionMethod ?? null);

  const clockSkewSec =
    quoteTimestamp != null &&
    input.receivedAtUtcSec != null &&
    Number.isFinite(input.receivedAtUtcSec)
      ? quoteTimestamp - input.receivedAtUtcSec
      : null;

  const base: HfmQuoteTimestampNormalizationResult = {
    quoteTimestamp,
    quoteTimestampMs,
    quoteTimestampUtc: null,
    quoteTimestampUtcMs: null,
    brokerUtcOffsetSec: input.brokerUtcOffsetSec,
    clockSkewSec,
    timestampSource,
    timestampNormalizationStatus: input.offsetStatus,
    timestampNormalizationReason: input.offsetReason,
  };

  if (quoteTimestamp == null) {
    return {
      ...base,
      timestampNormalizationStatus:
        input.offsetStatus === "NORMALIZED" ? "PARTIAL" : input.offsetStatus,
      timestampNormalizationReason:
        input.offsetReason ?? "MISSING_QUOTE_TIMESTAMP",
    };
  }

  if (
    input.brokerUtcOffsetSec == null ||
    !Number.isFinite(input.brokerUtcOffsetSec) ||
    input.offsetStatus === "UNAVAILABLE" ||
    input.offsetStatus === "UNRELIABLE"
  ) {
    return {
      ...base,
      brokerUtcOffsetSec:
        input.offsetStatus === "UNRELIABLE" ? null : input.brokerUtcOffsetSec,
      timestampNormalizationStatus:
        input.offsetStatus === "NORMALIZED" ? "UNAVAILABLE" : input.offsetStatus,
      timestampNormalizationReason:
        input.offsetReason ?? "BROKER_UTC_OFFSET_UNAVAILABLE",
    };
  }

  const quoteTimestampUtc = quoteTimestamp - input.brokerUtcOffsetSec;
  if (!Number.isFinite(quoteTimestampUtc) || quoteTimestampUtc <= 0) {
    return {
      ...base,
      timestampNormalizationStatus: "UNRELIABLE",
      timestampNormalizationReason: "UTC_TICK_NOT_FINITE_OR_NON_POSITIVE",
    };
  }

  const quoteTimestampUtcMs =
    quoteTimestampMs != null
      ? quoteTimestampMs - input.brokerUtcOffsetSec * 1000
      : quoteTimestampUtc * 1000;

  if (
    quoteTimestampUtcMs != null &&
    (!Number.isFinite(quoteTimestampUtcMs) || quoteTimestampUtcMs <= 0)
  ) {
    return {
      ...base,
      quoteTimestampUtc,
      quoteTimestampUtcMs: null,
      timestampNormalizationStatus: "PARTIAL",
      timestampNormalizationReason: "UTC_TICK_MS_UNRELIABLE",
    };
  }

  return {
    ...base,
    quoteTimestampUtc,
    quoteTimestampUtcMs,
    brokerUtcOffsetSec: input.brokerUtcOffsetSec,
    timestampNormalizationStatus: input.offsetStatus,
    timestampNormalizationReason: input.offsetReason,
  };
}
