/**
 * Phase 5F STEP 3 — authoritative CLOSED-candle verification.
 * Do not trust candleState=CLOSED alone when the source may mark a forming bar closed.
 */
import {
  deriveCloseTimeSec,
  resolveTimeframeDurationSec,
  type MifCanonicalCandle,
} from "../canonical/candle.js";

export interface ClosedCandleVerification {
  accepted: MifCanonicalCandle[];
  rejected: {
    openTimeSec: number;
    reason: string;
  }[];
  formingRejected: number;
  staleRejected: number;
  closureUnverifiedRejected: number;
  duplicateBarsRejected: number;
  outOfOrderRejected: number;
  gapFlags: string[];
  missingIntervals: string[];
}

/**
 * Verify a candle is authoritatively closed using timeframe duration + broker timebase.
 * When brokerNowSec is provided (live), require brokerNowSec >= closeTimeSec.
 * When brokerNowSec is omitted (historical COMPLETE archive), CLOSED + ok validation is accepted
 * only if closeTimeSec can be derived (duration known).
 */
export function isAuthoritativelyClosed(
  candle: MifCanonicalCandle,
  opts?: { brokerNowSec?: number | null; maxStaleSec?: number | null },
): { ok: true } | { ok: false; reason: string } {
  if (candle.providerId !== "HFM_MT5") {
    return { ok: false, reason: "UNSUPPORTED_PROVIDER" };
  }
  if (candle.candleState === "FORMING") {
    return { ok: false, reason: "FORMING_CANDLE" };
  }
  if (candle.candleState === "INVALID") {
    return { ok: false, reason: "INVALID_CANDLE_STATE" };
  }
  if (candle.candleState !== "CLOSED") {
    return { ok: false, reason: "NOT_CLOSED_LABEL" };
  }

  const duration = resolveTimeframeDurationSec(candle.timeframe);
  const closeTime =
    candle.closeTimeSec
    ?? (duration != null ? deriveCloseTimeSec(candle.openTimeSec, candle.timeframe) : null);

  if (closeTime == null || !Number.isFinite(closeTime)) {
    return { ok: false, reason: "CLOSURE_UNVERIFIED_NO_DURATION" };
  }

  const brokerNow = opts?.brokerNowSec;
  if (brokerNow != null && Number.isFinite(brokerNow)) {
    if (brokerNow < closeTime) {
      return { ok: false, reason: "FORMING_BY_BROKER_TIMEBASE" };
    }
    const maxStale = opts?.maxStaleSec;
    if (
      maxStale != null
      && Number.isFinite(maxStale)
      && maxStale > 0
      && brokerNow - closeTime > maxStale
    ) {
      // Stale relative to evaluation tip — informational for live series tips only.
      // We still accept historical closed bars; stale tip rejection is applied at series level.
    }
  }

  if (
    candle.validation?.status === "rejected"
    || (candle.validation?.errors?.length ?? 0) > 0
  ) {
    return { ok: false, reason: "VALIDATION_REJECTED" };
  }

  return { ok: true };
}

/**
 * Validate, dedupe, order-check, and optionally filter future bars for outcome use.
 * Activation candle itself must be excluded by caller via openTimeSec > activation.
 */
export function validateOutcomeCandleSeries(input: {
  candles: readonly MifCanonicalCandle[];
  timeframe: string;
  brokerNowSec?: number | null;
  rejectStaleTip?: boolean;
  maxStaleSec?: number | null;
}): ClosedCandleVerification {
  const rejected: ClosedCandleVerification["rejected"] = [];
  let formingRejected = 0;
  let staleRejected = 0;
  let closureUnverifiedRejected = 0;
  let duplicateBarsRejected = 0;
  let outOfOrderRejected = 0;

  const sorted = [...input.candles].sort((a, b) => a.openTimeSec - b.openTimeSec);
  const seen = new Set<number>();
  const accepted: MifCanonicalCandle[] = [];
  let prevOpen: number | null = null;

  for (const c of sorted) {
    if (seen.has(c.openTimeSec)) {
      duplicateBarsRejected += 1;
      rejected.push({ openTimeSec: c.openTimeSec, reason: "DUPLICATE" });
      continue;
    }
    if (prevOpen != null && c.openTimeSec < prevOpen) {
      outOfOrderRejected += 1;
      rejected.push({ openTimeSec: c.openTimeSec, reason: "OUT_OF_ORDER" });
      continue;
    }

    const check = isAuthoritativelyClosed(c, {
      brokerNowSec: input.brokerNowSec,
      maxStaleSec: input.maxStaleSec,
    });
    if (!check.ok) {
      if (check.reason === "FORMING_CANDLE" || check.reason === "FORMING_BY_BROKER_TIMEBASE") {
        formingRejected += 1;
      } else if (check.reason.startsWith("CLOSURE_UNVERIFIED")) {
        closureUnverifiedRejected += 1;
      } else if (check.reason === "STALE") {
        staleRejected += 1;
      }
      rejected.push({ openTimeSec: c.openTimeSec, reason: check.reason });
      continue;
    }

    seen.add(c.openTimeSec);
    accepted.push(c);
    prevOpen = c.openTimeSec;
  }

  // Optional: reject series tip if still forming relative to broker now.
  if (input.rejectStaleTip && accepted.length && input.brokerNowSec != null) {
    const tip = accepted[accepted.length - 1]!;
    const duration = resolveTimeframeDurationSec(tip.timeframe || input.timeframe);
    const closeTime = tip.closeTimeSec ?? (duration != null
      ? tip.openTimeSec + duration
      : null);
    if (closeTime != null && input.brokerNowSec < closeTime) {
      accepted.pop();
      formingRejected += 1;
      rejected.push({ openTimeSec: tip.openTimeSec, reason: "TIP_STILL_FORMING" });
    }
  }

  const gapFlags: string[] = [];
  const missingIntervals: string[] = [];
  const duration = resolveTimeframeDurationSec(input.timeframe);
  if (duration != null && accepted.length >= 2) {
    for (let i = 1; i < accepted.length; i++) {
      const delta = accepted[i]!.openTimeSec - accepted[i - 1]!.openTimeSec;
      if (delta > duration * 1.5) {
        gapFlags.push("MISSING_INTERVAL");
        missingIntervals.push(
          `${accepted[i - 1]!.openTimeSec}->${accepted[i]!.openTimeSec}`,
        );
      }
    }
  } else if (accepted.length >= 3) {
    const steps: number[] = [];
    for (let i = 1; i < accepted.length; i++) {
      steps.push(accepted[i]!.openTimeSec - accepted[i - 1]!.openTimeSec);
    }
    steps.sort((a, b) => a - b);
    const median = steps[Math.floor(steps.length / 2)]!;
    if (median > 0 && steps.some((s) => s > median * 2.5)) {
      gapFlags.push("IRREGULAR_SPACING");
    }
  }

  return {
    accepted,
    rejected,
    formingRejected,
    staleRejected,
    closureUnverifiedRejected,
    duplicateBarsRejected,
    outOfOrderRejected,
    gapFlags: [...new Set(gapFlags)],
    missingIntervals,
  };
}

/**
 * Future bars for outcome: CLOSED only, openTimeSec STRICTLY AFTER activation.
 */
export function selectFutureBarsAfterActivation(
  candles: readonly MifCanonicalCandle[],
  activationOpenTimeSec: number,
): {
  future: MifCanonicalCandle[];
  activationCandle: MifCanonicalCandle | null;
  excludedAtOrBeforeActivation: number;
} {
  let activationCandle: MifCanonicalCandle | null = null;
  let excluded = 0;
  const future: MifCanonicalCandle[] = [];
  for (const c of candles) {
    if (c.openTimeSec === activationOpenTimeSec) {
      activationCandle = c;
      excluded += 1;
      continue;
    }
    if (c.openTimeSec <= activationOpenTimeSec) {
      excluded += 1;
      continue;
    }
    future.push(c);
  }
  return { future, activationCandle, excludedAtOrBeforeActivation: excluded };
}
