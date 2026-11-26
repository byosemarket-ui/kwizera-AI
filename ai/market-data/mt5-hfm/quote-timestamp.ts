/**
 * STEP 1B / B1 — HFM quote timestamp normalization.
 * STEP 1B.1 — Market-closed protection: never treat frozen TimeCurrent−TimeGMT
 * drift as a timezone offset; retain last open-session trusted offset with
 * explicit validity for historical tick UTC only.
 *
 * MT5 MqlTick.time / SYMBOL_TIME and TimeCurrent() are broker-server clock values
 * (unix-like seconds in the broker timezone). TimeGMT() is MT5's GMT/UTC clock.
 * Live offset is derived per open-session snapshot: brokerTime - gmtTime.
 * Never hardcode UTC+2.
 */

import type { HfmMarketSessionState } from "./market-session.js";

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

/** Max age for reusing a previously trusted open-session offset on historical ticks. */
export const HFM_TRUSTED_OFFSET_MAX_AGE_SEC = 10 * 24 * 3600;

/** If a new open-session offset differs by more than this, replace and note DST/change. */
export const HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC = 15 * 60;

export interface HfmBrokerClockInput {
  /** MT5 TimeCurrent() — broker server seconds. */
  brokerTime: number | null | undefined;
  /** MT5 TimeGMT() — GMT/UTC seconds. */
  gmtTime: number | null | undefined;
  /** When true, TimeCurrent is frozen vs TimeGMT — do not derive live offset. */
  brokerClockFrozen?: boolean | null;
  /** Session classification for the symbol/feed. */
  marketSessionState?: HfmMarketSessionState | null;
}

export interface HfmBrokerUtcOffsetResult {
  brokerUtcOffsetSec: number | null;
  status: HfmTimestampNormalizationStatus;
  reason: string | null;
  /** How the offset was obtained for this evaluation. */
  trust: "LIVE_OPEN_SESSION" | "TRUSTED_HISTORICAL" | "NONE";
}

export interface HfmTrustedBrokerUtcOffset {
  offsetSec: number;
  /** GMT seconds when this offset was last confirmed during MARKET_OPEN. */
  observedAtGmtSec: number;
  /** Broker TimeCurrent when confirmed. */
  observedAtBrokerSec: number;
  status: HfmTimestampNormalizationStatus;
  source: "open_session_observation";
}

export interface HfmQuoteTimestampNormalizationInput {
  /** Raw broker-domain tick time (seconds). Preserved as quoteTimestamp. */
  quoteTimestampSec: number | null;
  /** Raw broker-domain tick time (milliseconds) when available. */
  quoteTimestampMs: number | null;
  brokerUtcOffsetSec: number | null;
  offsetStatus: HfmTimestampNormalizationStatus;
  offsetReason: string | null;
  offsetTrust?: HfmBrokerUtcOffsetResult["trust"];
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
  /**
   * Backward-compatible B1 field.
   * Formula: rawBrokerTickSec − receivedAtUtcSec
   * (= brokerUtcOffsetSec − tickAgeSec when UTC normalization is trusted).
   * Not pure oscillator skew; do not treat as Core↔MT5 GMT drift alone.
   */
  clockSkewSec: number | null;
  timestampSource: HfmTimestampSource;
  timestampNormalizationStatus: HfmTimestampNormalizationStatus;
  timestampNormalizationReason: string | null;
}

function asFinitePositive(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return v;
}

let trustedOffset: HfmTrustedBrokerUtcOffset | null = null;

/** Test/helpers — reset process-local trusted offset cache. */
export function resetHfmTrustedBrokerUtcOffsetForTests(): void {
  trustedOffset = null;
}

export function getHfmTrustedBrokerUtcOffset(): HfmTrustedBrokerUtcOffset | null {
  return trustedOffset ? { ...trustedOffset } : null;
}

/**
 * Record a live open-session offset. Never call with closed-session drift.
 * Replaces prior trust when delta exceeds replace threshold (DST / server change).
 */
export function noteTrustedOpenSessionBrokerUtcOffset(input: {
  offsetSec: number;
  observedAtGmtSec: number;
  observedAtBrokerSec: number;
  status: HfmTimestampNormalizationStatus;
}): HfmTrustedBrokerUtcOffset {
  const next: HfmTrustedBrokerUtcOffset = {
    offsetSec: input.offsetSec,
    observedAtGmtSec: input.observedAtGmtSec,
    observedAtBrokerSec: input.observedAtBrokerSec,
    status: input.status,
    source: "open_session_observation",
  };
  trustedOffset = next;
  return { ...next };
}

function trustedOffsetStillValid(nowGmtSec: number | null): boolean {
  if (!trustedOffset) return false;
  if (nowGmtSec == null || !Number.isFinite(nowGmtSec)) return false;
  const age = nowGmtSec - trustedOffset.observedAtGmtSec;
  return age >= 0 && age <= HFM_TRUSTED_OFFSET_MAX_AGE_SEC;
}

/**
 * Derive brokerUtcOffsetSec = brokerTime - gmtTime from MT5 snapshot clocks.
 * Positive means broker clock is ahead of GMT (e.g. +7200 for UTC+2).
 *
 * B1.1: when the broker clock is frozen or the session is closed-like, refuse
 * live derivation (prevents weekend drift) and optionally fall back to a
 * previously trusted open-session offset for historical tick normalization only.
 */
export function deriveHfmBrokerUtcOffset(
  input: HfmBrokerClockInput,
): HfmBrokerUtcOffsetResult {
  const brokerTime = asFinitePositive(input.brokerTime);
  const gmtTime = asFinitePositive(input.gmtTime);
  const session = input.marketSessionState ?? null;

  // B1.1 critical guard: when TimeCurrent is frozen vs TimeGMT, brokerTime-gmtTime
  // is closed-session drift — never a timezone. Trading breaks with advancing clocks
  // still allow live derivation.
  if (input.brokerClockFrozen === true) {
    if (trustedOffsetStillValid(gmtTime)) {
      return {
        brokerUtcOffsetSec: trustedOffset!.offsetSec,
        status: "PARTIAL",
        reason: "TRUSTED_OFFSET_FROM_OPEN_SESSION_WHILE_CLOSED",
        trust: "TRUSTED_HISTORICAL",
      };
    }
    return {
      brokerUtcOffsetSec: null,
      status: "UNAVAILABLE",
      reason: "BROKER_CLOCK_FROZEN_OFFSET_UNTRUSTED",
      trust: "NONE",
    };
  }

  if (brokerTime == null && gmtTime == null) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNAVAILABLE",
      reason: "MISSING_BROKER_AND_GMT_TIME",
      trust: "NONE",
    };
  }
  if (brokerTime == null) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNAVAILABLE",
      reason: "MISSING_BROKER_TIME",
      trust: "NONE",
    };
  }
  if (gmtTime == null) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNAVAILABLE",
      reason: "MISSING_GMT_TIME",
      trust: "NONE",
    };
  }

  const offset = brokerTime - gmtTime;
  if (!Number.isFinite(offset)) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNRELIABLE",
      reason: "OFFSET_NOT_FINITE",
      trust: "NONE",
    };
  }
  if (Math.abs(offset) > HFM_MAX_TRUSTED_BROKER_UTC_OFFSET_SEC) {
    return {
      brokerUtcOffsetSec: null,
      status: "UNRELIABLE",
      reason: "OFFSET_ABS_EXCEEDS_14H",
      trust: "NONE",
    };
  }

  const nearQuarterHour =
    Math.abs(offset % HFM_OFFSET_QUARTER_HOUR_SEC) < 1 ||
    Math.abs(Math.abs(offset % HFM_OFFSET_QUARTER_HOUR_SEC) - HFM_OFFSET_QUARTER_HOUR_SEC) < 1;

  const liveStatus: HfmTimestampNormalizationStatus = nearQuarterHour
    ? "NORMALIZED"
    : "PARTIAL";
  const liveReason = nearQuarterHour ? null : "OFFSET_NOT_QUARTER_HOUR_ALIGNED";

  // Only promote to trusted cache when session is open (or unknown-but-advancing).
  if (session == null || session === "MARKET_OPEN" || session === "SESSION_UNKNOWN") {
    const prev = trustedOffset;
    if (
      !prev ||
      Math.abs(prev.offsetSec - offset) >= HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC ||
      gmtTime >= prev.observedAtGmtSec
    ) {
      noteTrustedOpenSessionBrokerUtcOffset({
        offsetSec: offset,
        observedAtGmtSec: gmtTime,
        observedAtBrokerSec: brokerTime,
        status: liveStatus,
      });
    }
  }

  return {
    brokerUtcOffsetSec: offset,
    status: liveStatus,
    reason: liveReason,
    trust: "LIVE_OPEN_SESSION",
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
 * Convert broker-domain tick time to UTC using a derived/trusted offset.
 * Does not invent timestamps when offset or tick time is missing/unreliable.
 *
 * Historical trust rule: when trust is TRUSTED_HISTORICAL, only normalize ticks
 * that are not newer than the trusted observation (+1h grace). Newer ticks after
 * a closed period without a live open-session re-derive stay unnormalized.
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

  // Historical offset: refuse ticks that clearly post-date the trusted open observation.
  if (input.offsetTrust === "TRUSTED_HISTORICAL" && trustedOffset) {
    const grace = 3600;
    if (quoteTimestamp > trustedOffset.observedAtBrokerSec + grace) {
      return {
        ...base,
        brokerUtcOffsetSec: null,
        quoteTimestampUtc: null,
        quoteTimestampUtcMs: null,
        timestampNormalizationStatus: "UNAVAILABLE",
        timestampNormalizationReason: "TICK_NEWER_THAN_TRUSTED_OPEN_OFFSET",
      };
    }
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
