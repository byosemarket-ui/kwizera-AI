/**
 * Engine 3 — HFM candle open-time normalization.
 *
 * MT5 MqlRates.time is broker/server candle-open time (unix-like seconds in the
 * broker clock domain), NOT UTC. UTC is computed only when a trustworthy offset
 * observation applies to that candle:
 *
 *   openTimeUtc = brokerOpenTime - brokerUtcOffsetSec
 *
 * Never invent UTC. Never reverse the sign. Never treat an already-normalized
 * UTC value as broker time (double-normalization guard).
 */
import {
  HFM_MAX_TRUSTED_BROKER_UTC_OFFSET_SEC,
  HFM_OFFSET_QUARTER_HOUR_SEC,
  HFM_TRUSTED_OFFSET_MAX_AGE_SEC,
  HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC,
  type HfmTimestampNormalizationStatus,
  getHfmTrustedBrokerUtcOffset,
  noteTrustedOpenSessionBrokerUtcOffset,
  deriveHfmBrokerUtcOffset,
  type HfmBrokerClockInput,
} from "./quote-timestamp.js";
import {
  ensureHfmOffsetArchiveLoadedSync,
  getHfmOffsetArchiveObservations,
  lookupHfmOffsetArchiveForBrokerCandle,
  noteHfmOffsetArchiveObservation,
} from "./offset-archive.js";

export type HfmCandleTimestampSource =
  | "mt5_copyrates"
  | "mt5_live_forming"
  | "mt5_dump"
  | "unknown";

export type HfmCandleOffsetTrust =
  | "LIVE_OPEN_SESSION"
  | "TRUSTED_HISTORICAL"
  | "NONE";

/** Additive candle time provenance (broker `time` remains the compatibility field). */
export interface HfmCandleTimeProvenance {
  /** Explicit broker/server candle-open seconds (same domain as legacy `time`). */
  brokerOpenTime: number;
  /** Trusted UTC candle-open seconds; null when untrusted/unavailable. */
  openTimeUtc: number | null;
  brokerUtcOffsetSec: number | null;
  timestampNormalizationStatus: HfmTimestampNormalizationStatus;
  timestampNormalizationReason: string | null;
  timestampSource: HfmCandleTimestampSource;
  /** Offset observation GMT seconds when known. */
  offsetObservedAtGmtSec: number | null;
  /** Offset observation broker seconds when known. */
  offsetObservedAtBrokerSec: number | null;
  offsetTrust: HfmCandleOffsetTrust;
  /** Snapshot observation instant (ISO) when available. */
  timestampObservedAt: string | null;
}

export interface HfmCandleOffsetObservation {
  offsetSec: number;
  /** Raw measured delta when distinct from trusted offset (sampling skew). */
  measuredDeltaSec?: number | null;
  observedAtGmtSec: number;
  observedAtBrokerSec: number;
  status: HfmTimestampNormalizationStatus;
  source: "open_session_observation";
}

export interface NormalizeHfmCandleOpenTimeInput {
  /** Broker-domain candle open (seconds). Reject ms-scale values. */
  brokerOpenTime: number | null | undefined;
  /**
   * Optional pre-selected offset evidence. When omitted, the bounded observation
   * history / live trusted offset is consulted.
   */
  brokerUtcOffsetSec?: number | null;
  offsetStatus?: HfmTimestampNormalizationStatus | null;
  offsetReason?: string | null;
  offsetTrust?: HfmCandleOffsetTrust | null;
  offsetObservedAtGmtSec?: number | null;
  offsetObservedAtBrokerSec?: number | null;
  timestampSource?: HfmCandleTimestampSource;
  timestampObservedAt?: string | null;
  /**
   * When true, `brokerOpenTime` is already UTC from a prior NORMALIZED pass —
   * refuse to subtract offset again.
   */
  alreadyNormalizedUtc?: boolean;
  /** Prefer live offset path (forming tip) vs historical selection. */
  preferLiveOffset?: boolean;
}

const OFFSET_HISTORY_MAX = 64;
/** Max broker-time age for applying a live open-session offset to a candle. */
export const HFM_CANDLE_LIVE_OFFSET_MAX_AGE_SEC = 7 * 24 * 3600;
/** Grace: candle may slightly lead the observation clock. */
const CANDLE_OBS_GRACE_SEC = 3600;

let offsetHistory: HfmCandleOffsetObservation[] = [];

export function resetHfmCandleOffsetHistoryForTests(): void {
  offsetHistory = [];
}

export function getHfmCandleOffsetHistory(): HfmCandleOffsetObservation[] {
  return offsetHistory.map((o) => ({ ...o }));
}

/**
 * Record an open-session offset observation for candle historical selection.
 * Also mirrors into Engine 1 quote trusted-offset cache when status is usable.
 */
export function noteHfmCandleOffsetObservation(input: {
  offsetSec: number;
  measuredDeltaSec?: number | null;
  observedAtGmtSec: number;
  observedAtBrokerSec: number;
  status: HfmTimestampNormalizationStatus;
  brokerIdentity?: string | null;
  sessionContext?: string | null;
  reason?: string | null;
}): HfmCandleOffsetObservation {
  ensureHfmOffsetArchiveLoadedSync();
  const next: HfmCandleOffsetObservation = {
    offsetSec: input.offsetSec,
    measuredDeltaSec: input.measuredDeltaSec ?? null,
    observedAtGmtSec: input.observedAtGmtSec,
    observedAtBrokerSec: input.observedAtBrokerSec,
    status: input.status,
    source: "open_session_observation",
  };
  const last = offsetHistory[offsetHistory.length - 1];
  if (
    !last ||
    Math.abs(last.offsetSec - next.offsetSec) >= HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC ||
    next.observedAtGmtSec > last.observedAtGmtSec
  ) {
    offsetHistory.push(next);
    if (offsetHistory.length > OFFSET_HISTORY_MAX) {
      offsetHistory = offsetHistory.slice(-OFFSET_HISTORY_MAX);
    }
  }
  if (input.status === "NORMALIZED" || input.status === "PARTIAL") {
    noteTrustedOpenSessionBrokerUtcOffset({
      offsetSec: input.offsetSec,
      observedAtGmtSec: input.observedAtGmtSec,
      observedAtBrokerSec: input.observedAtBrokerSec,
      status: input.status,
    });
    noteHfmOffsetArchiveObservation({
      offsetSec: input.offsetSec,
      measuredDeltaSec: input.measuredDeltaSec ?? null,
      observedAtGmtSec: input.observedAtGmtSec,
      observedAtBrokerSec: input.observedAtBrokerSec,
      status: input.status,
      brokerIdentity: input.brokerIdentity ?? null,
      sessionContext: input.sessionContext ?? null,
      reason: input.reason ?? null,
    });
  }
  return { ...next };
}

/**
 * Derive offset from snapshot clocks and record observation when live-trustable.
 */
export function ingestHfmSnapshotClocksForCandles(
  input: HfmBrokerClockInput,
): ReturnType<typeof deriveHfmBrokerUtcOffset> {
  const derived = deriveHfmBrokerUtcOffset(input);
  if (
    derived.brokerUtcOffsetSec != null &&
    (derived.trust === "LIVE_OPEN_SESSION" || derived.trust === "TRUSTED_HISTORICAL") &&
    (derived.status === "NORMALIZED" || derived.status === "PARTIAL") &&
    typeof input.brokerTime === "number" &&
    typeof input.gmtTime === "number"
  ) {
    noteHfmCandleOffsetObservation({
      offsetSec: derived.brokerUtcOffsetSec,
      measuredDeltaSec: derived.measuredDeltaSec,
      observedAtGmtSec: input.gmtTime,
      observedAtBrokerSec: input.brokerTime,
      status: derived.status,
      reason: derived.reason,
    });
  }
  return derived;
}

function asBrokerSec(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  // Guard ms-scale accidental inputs (~1e12+).
  if (v > 1e11) return null;
  return Math.trunc(v);
}

function offsetLooksSane(offsetSec: number): boolean {
  return (
    Number.isFinite(offsetSec) &&
    Math.abs(offsetSec) <= HFM_MAX_TRUSTED_BROKER_UTC_OFFSET_SEC
  );
}

function nearQuarterHour(offsetSec: number): boolean {
  const rem = Math.abs(offsetSec % HFM_OFFSET_QUARTER_HOUR_SEC);
  // ≤1 admits one-second sampling skew around an aligned TZ offset.
  return rem <= 1 || Math.abs(rem - HFM_OFFSET_QUARTER_HOUR_SEC) <= 1;
}

/**
 * Select an offset observation applicable to a broker-domain candle open.
 * Consults in-process history first, then the durable offset archive.
 * Returns null when evidence cannot support a trusted conversion.
 */
export function selectOffsetForBrokerCandle(brokerOpenTime: number): {
  offsetSec: number;
  status: HfmTimestampNormalizationStatus;
  reason: string | null;
  trust: HfmCandleOffsetTrust;
  observedAtGmtSec: number;
  observedAtBrokerSec: number;
} | null {
  ensureHfmOffsetArchiveLoadedSync();
  const history = [...offsetHistory];
  const trusted = getHfmTrustedBrokerUtcOffset();
  if (trusted && !history.some((h) => h.observedAtGmtSec === trusted.observedAtGmtSec)) {
    history.push({
      offsetSec: trusted.offsetSec,
      observedAtGmtSec: trusted.observedAtGmtSec,
      observedAtBrokerSec: trusted.observedAtBrokerSec,
      status: trusted.status,
      source: "open_session_observation",
    });
  }

  // Observations that can cover this candle: candle not newer than obs+grace,
  // and not older than max age from observation.
  const candidates = history.filter((o) => {
    if (brokerOpenTime > o.observedAtBrokerSec + CANDLE_OBS_GRACE_SEC) return false;
    const age = o.observedAtBrokerSec - brokerOpenTime;
    return age >= 0 && age <= HFM_TRUSTED_OFFSET_MAX_AGE_SEC;
  });

  if (candidates.length) {
    candidates.sort((a, b) => a.observedAtBrokerSec - b.observedAtBrokerSec);
    const chosen = candidates[0]!;

    // Conflicting offsets among covering candidates → ambiguous (DST / fall-back).
    const conflict = candidates.some(
      (o) => Math.abs(o.offsetSec - chosen.offsetSec) >= HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC,
    );
    if (conflict) {
      return null;
    }

    const status: HfmTimestampNormalizationStatus =
      chosen.status === "NORMALIZED" && nearQuarterHour(chosen.offsetSec)
        ? "NORMALIZED"
        : chosen.status === "UNRELIABLE"
          ? "UNRELIABLE"
          : "PARTIAL";

    return {
      offsetSec: chosen.offsetSec,
      status,
      reason:
        status === "NORMALIZED"
          ? "TRUSTED_HISTORICAL_OFFSET_OBSERVATION"
          : "TRUSTED_HISTORICAL_OFFSET_PARTIAL",
      trust: "TRUSTED_HISTORICAL",
      observedAtGmtSec: chosen.observedAtGmtSec,
      observedAtBrokerSec: chosen.observedAtBrokerSec,
    };
  }

  // Durable archive: covers eras beyond the in-process 64-observation window.
  const archived = lookupHfmOffsetArchiveForBrokerCandle(brokerOpenTime);
  if (archived) {
    return {
      offsetSec: archived.offsetSec,
      status: archived.status,
      reason: archived.reason,
      trust: "TRUSTED_HISTORICAL",
      observedAtGmtSec: archived.observedAtGmtSec,
      observedAtBrokerSec: archived.observedAtBrokerSec,
    };
  }

  return null;
}

/**
 * Normalize one broker candle-open timestamp to UTC when evidence allows.
 */
export function normalizeHfmCandleOpenTime(
  input: NormalizeHfmCandleOpenTimeInput,
): HfmCandleTimeProvenance {
  const source = input.timestampSource ?? "unknown";
  const observedAt = input.timestampObservedAt ?? null;
  const brokerOpenTime = asBrokerSec(input.brokerOpenTime);

  const baseUnavailable = (
    reason: string,
    status: HfmTimestampNormalizationStatus = "UNAVAILABLE",
  ): HfmCandleTimeProvenance => ({
    brokerOpenTime: brokerOpenTime ?? 0,
    openTimeUtc: null,
    brokerUtcOffsetSec: null,
    timestampNormalizationStatus: status,
    timestampNormalizationReason: reason,
    timestampSource: source,
    offsetObservedAtGmtSec: input.offsetObservedAtGmtSec ?? null,
    offsetObservedAtBrokerSec: input.offsetObservedAtBrokerSec ?? null,
    offsetTrust: "NONE",
    timestampObservedAt: observedAt,
  });

  if (brokerOpenTime == null) {
    return baseUnavailable("MISSING_OR_INVALID_BROKER_OPEN_TIME", "UNAVAILABLE");
  }

  if (input.alreadyNormalizedUtc === true) {
    return {
      brokerOpenTime,
      openTimeUtc: null,
      brokerUtcOffsetSec: null,
      timestampNormalizationStatus: "UNAVAILABLE",
      timestampNormalizationReason: "REFUSE_DOUBLE_NORMALIZATION",
      timestampSource: source,
      offsetObservedAtGmtSec: input.offsetObservedAtGmtSec ?? null,
      offsetObservedAtBrokerSec: input.offsetObservedAtBrokerSec ?? null,
      offsetTrust: "NONE",
      timestampObservedAt: observedAt,
    };
  }

  let offsetSec = input.brokerUtcOffsetSec ?? null;
  let status: HfmTimestampNormalizationStatus =
    input.offsetStatus ?? "UNAVAILABLE";
  let reason: string | null = input.offsetReason ?? null;
  let trust: HfmCandleOffsetTrust = input.offsetTrust ?? "NONE";
  let obsGmt = input.offsetObservedAtGmtSec ?? null;
  let obsBroker = input.offsetObservedAtBrokerSec ?? null;

  // Resolve offset from history when caller did not supply one.
  if (offsetSec == null || status === "UNAVAILABLE" || status === "UNRELIABLE") {
    if (input.preferLiveOffset) {
      const trusted = getHfmTrustedBrokerUtcOffset();
      if (
        trusted &&
        offsetLooksSane(trusted.offsetSec) &&
        brokerOpenTime <= trusted.observedAtBrokerSec + CANDLE_OBS_GRACE_SEC &&
        trusted.observedAtBrokerSec - brokerOpenTime <= HFM_CANDLE_LIVE_OFFSET_MAX_AGE_SEC
      ) {
        offsetSec = trusted.offsetSec;
        status = trusted.status;
        reason = "LIVE_TRUSTED_OFFSET_WITHIN_AGE";
        trust = "LIVE_OPEN_SESSION";
        obsGmt = trusted.observedAtGmtSec;
        obsBroker = trusted.observedAtBrokerSec;
      }
    }
    if (offsetSec == null) {
      const selected = selectOffsetForBrokerCandle(brokerOpenTime);
      if (!selected) {
        ensureHfmOffsetArchiveLoadedSync();
        // Distinguish ambiguity (history has conflicting offsets near candle) vs empty.
        const anyNear = offsetHistory.some(
          (o) =>
            Math.abs(o.observedAtBrokerSec - brokerOpenTime) <= HFM_TRUSTED_OFFSET_MAX_AGE_SEC,
        );
        // Archive had covering-but-conflicting observations → lookup returns null;
        // detect via presence of multiple eras near the candle.
        const archNear = getHfmOffsetArchiveObservations().filter(
          (o) =>
            Math.abs(o.observedAtBrokerSec - brokerOpenTime) <= HFM_TRUSTED_OFFSET_MAX_AGE_SEC,
        );
        const archConflict =
          archNear.length >= 2 &&
          archNear.some(
            (o) => Math.abs(o.offsetSec - archNear[0]!.offsetSec) >= HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC,
          );
        return {
          brokerOpenTime,
          openTimeUtc: null,
          brokerUtcOffsetSec: null,
          timestampNormalizationStatus: "UNAVAILABLE",
          timestampNormalizationReason:
            anyNear || archConflict
              ? "OFFSET_TRANSITION_OR_DST_AMBIGUOUS"
              : "HISTORICAL_OFFSET_UNAVAILABLE",
          timestampSource: source,
          offsetObservedAtGmtSec: null,
          offsetObservedAtBrokerSec: null,
          offsetTrust: "NONE",
          timestampObservedAt: observedAt,
        };
      }
      offsetSec = selected.offsetSec;
      status = selected.status;
      reason = selected.reason;
      trust = selected.trust;
      obsGmt = selected.observedAtGmtSec;
      obsBroker = selected.observedAtBrokerSec;
    }
  }

  if (offsetSec == null || !offsetLooksSane(offsetSec)) {
    return {
      brokerOpenTime,
      openTimeUtc: null,
      brokerUtcOffsetSec: null,
      timestampNormalizationStatus: "UNRELIABLE",
      timestampNormalizationReason: reason ?? "OFFSET_ABS_EXCEEDS_14H_OR_INVALID",
      timestampSource: source,
      offsetObservedAtGmtSec: obsGmt,
      offsetObservedAtBrokerSec: obsBroker,
      offsetTrust: "NONE",
      timestampObservedAt: observedAt,
    };
  }

  if (status === "UNAVAILABLE" || status === "UNRELIABLE") {
    return {
      brokerOpenTime,
      openTimeUtc: null,
      brokerUtcOffsetSec: status === "UNRELIABLE" ? null : offsetSec,
      timestampNormalizationStatus: status,
      timestampNormalizationReason: reason ?? "OFFSET_STATUS_NOT_TRUSTED",
      timestampSource: source,
      offsetObservedAtGmtSec: obsGmt,
      offsetObservedAtBrokerSec: obsBroker,
      offsetTrust: "NONE",
      timestampObservedAt: observedAt,
    };
  }

  // Historical safety: refuse live offset when candle is older than live max age
  // relative to the observation used.
  if (
    obsBroker != null &&
    obsBroker - brokerOpenTime > HFM_CANDLE_LIVE_OFFSET_MAX_AGE_SEC &&
    trust === "LIVE_OPEN_SESSION"
  ) {
    return {
      brokerOpenTime,
      openTimeUtc: null,
      brokerUtcOffsetSec: null,
      timestampNormalizationStatus: "UNAVAILABLE",
      timestampNormalizationReason: "LIVE_OFFSET_TOO_OLD_FOR_CANDLE",
      timestampSource: source,
      offsetObservedAtGmtSec: obsGmt,
      offsetObservedAtBrokerSec: obsBroker,
      offsetTrust: "NONE",
      timestampObservedAt: observedAt,
    };
  }

  const openTimeUtc = brokerOpenTime - offsetSec;
  if (!Number.isFinite(openTimeUtc) || openTimeUtc <= 0) {
    return {
      brokerOpenTime,
      openTimeUtc: null,
      brokerUtcOffsetSec: offsetSec,
      timestampNormalizationStatus: "UNRELIABLE",
      timestampNormalizationReason: "UTC_OPEN_NOT_FINITE_OR_NON_POSITIVE",
      timestampSource: source,
      offsetObservedAtGmtSec: obsGmt,
      offsetObservedAtBrokerSec: obsBroker,
      offsetTrust: trust,
      timestampObservedAt: observedAt,
    };
  }

  const finalStatus: HfmTimestampNormalizationStatus = nearQuarterHour(offsetSec)
    ? status === "PARTIAL"
      ? "PARTIAL"
      : "NORMALIZED"
    : "PARTIAL";

  return {
    brokerOpenTime,
    openTimeUtc,
    brokerUtcOffsetSec: offsetSec,
    timestampNormalizationStatus: finalStatus,
    timestampNormalizationReason:
      finalStatus === "PARTIAL"
        ? reason ?? "OFFSET_NOT_QUARTER_HOUR_ALIGNED"
        : reason,
    timestampSource: source,
    offsetObservedAtGmtSec: obsGmt,
    offsetObservedAtBrokerSec: obsBroker,
    offsetTrust: trust,
    timestampObservedAt: observedAt,
  };
}

export function isTrustedCandleUtc(
  status: HfmTimestampNormalizationStatus | null | undefined,
): boolean {
  return status === "NORMALIZED" || status === "PARTIAL";
}

/** Merge provenance onto an OHLC bar without altering OHLC values. */
export function withCandleTimeProvenance<T extends { time: number }>(
  bar: T,
  provenance: HfmCandleTimeProvenance,
): T & HfmCandleTimeProvenance {
  return {
    ...bar,
    ...provenance,
    // Keep legacy `time` as broker-domain open.
    time: bar.time,
    brokerOpenTime: provenance.brokerOpenTime || bar.time,
  };
}

export function enrichBarsWithCandleTimeProvenance<T extends { time: number }>(
  bars: T[],
  opts?: {
    timestampSource?: HfmCandleTimestampSource;
    timestampObservedAt?: string | null;
    preferLiveOffset?: boolean;
    /** Explicit offset evidence from the same snapshot as the series. */
    clock?: HfmBrokerClockInput | null;
  },
): Array<T & HfmCandleTimeProvenance> {
  if (opts?.clock) {
    ingestHfmSnapshotClocksForCandles(opts.clock);
  }
  return bars.map((bar) => {
    const prov = normalizeHfmCandleOpenTime({
      brokerOpenTime: bar.time,
      timestampSource: opts?.timestampSource ?? "mt5_copyrates",
      timestampObservedAt: opts?.timestampObservedAt ?? null,
      preferLiveOffset: opts?.preferLiveOffset ?? false,
    });
    return withCandleTimeProvenance(bar, prov);
  });
}
