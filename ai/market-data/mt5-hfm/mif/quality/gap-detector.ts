/**
 * Phase 5B.2 Step 1 — gap detection with confirmed / possible / unknown-session classes.
 *
 * Uses an internal sorted copy of CLOSED structurally-valid candles for gap math.
 * Never mutates the original input. Never invents a session calendar.
 * Never classifies session-related gaps as CONFIRMED_MISSING without authority evidence.
 */
import {
  resolveTimeframeDurationSec,
  type MifCanonicalCandle,
} from "../canonical/candle.js";
import {
  MIF_QI_CONFIRMED_MISSING,
  MIF_QI_DURATION_UNSUPPORTED,
  MIF_QI_GAP_DETECTION_SKIPPED,
  MIF_QI_POSSIBLE_GAP,
  MIF_QI_TIMEBASE_UNCERTAIN,
  MIF_QI_UNKNOWN_SESSION_GAP,
} from "./codes.js";
import { isClosedHistoricalCandidate } from "./ohlc-validator.js";
import {
  UNKNOWN_SESSION_GAP_MIN_GAP_SEC,
  UNKNOWN_SESSION_GAP_MIN_MISSED_BARS,
} from "./session-uncertainty.js";
import type {
  MifExpectedIntervalAuthority,
  MifGapCounters,
  MifQualityFinding,
} from "./types.js";

export interface GapDetectionResult {
  findings: MifQualityFinding[];
  counters: MifGapCounters;
  /** True when gap math used a sorted copy (original order unchanged). */
  usedSortedCopy: true;
}

interface IndexedCandle {
  index: number;
  candle: MifCanonicalCandle;
}

function emptyCounters(): MifGapCounters {
  return {
    confirmedMissingCount: 0,
    possibleMissingCount: 0,
    unknownSessionGapCount: 0,
    insufficientHistoryCount: 0,
  };
}

/**
 * Count candidate open times strictly between prevOpen and nextOpen for fixed duration.
 * Endpoints are not counted. Protects against off-by-one via integer arithmetic.
 */
export function countCandidateOpensBetween(
  prevOpen: number,
  nextOpen: number,
  stepSec: number,
): number {
  if (!(stepSec > 0) || !Number.isFinite(prevOpen) || !Number.isFinite(nextOpen)) return 0;
  if (nextOpen <= prevOpen) return 0;
  const delta = nextOpen - prevOpen;
  // Expected adjacent: nextOpen === prevOpen + stepSec → 0 missing.
  if (delta <= stepSec) return 0;
  // Number of step boundaries crossed minus 1 (the observed next).
  const steps = Math.round(delta / stepSec);
  return Math.max(0, steps - 1);
}

function classifyGapWithoutAuthority(
  missed: number,
  gapSec: number,
): typeof MIF_QI_POSSIBLE_GAP | typeof MIF_QI_UNKNOWN_SESSION_GAP {
  if (missed >= UNKNOWN_SESSION_GAP_MIN_MISSED_BARS || gapSec >= UNKNOWN_SESSION_GAP_MIN_GAP_SEC) {
    return MIF_QI_UNKNOWN_SESSION_GAP;
  }
  return MIF_QI_POSSIBLE_GAP;
}

export function detectCandleGaps(input: {
  candles: readonly MifCanonicalCandle[];
  timeframe: string;
  providerSymbol: string;
  authority?: MifExpectedIntervalAuthority | null;
}): GapDetectionResult {
  const findings: MifQualityFinding[] = [];
  const counters = emptyCounters();
  const step = resolveTimeframeDurationSec(input.timeframe);

  if (step == null) {
    findings.push({
      code: MIF_QI_DURATION_UNSUPPORTED,
      severity: "warning",
      message: `gap detection unsupported for timeframe ${input.timeframe} without fixed duration / calendar boundaries`,
    });
    findings.push({
      code: MIF_QI_GAP_DETECTION_SKIPPED,
      severity: "info",
      message: "skipped fixed-interval gap scan",
    });
    return { findings, counters, usedSortedCopy: true };
  }

  const closed: IndexedCandle[] = [];
  for (let i = 0; i < input.candles.length; i++) {
    const c = input.candles[i]!;
    if (isClosedHistoricalCandidate(c)) {
      closed.push({ index: i, candle: c });
    }
  }

  // Internal sorted copy — original input untouched.
  const sorted = [...closed].sort((a, b) => a.candle.openTimeSec - b.candle.openTimeSec);

  // Mixed UNKNOWN timebase: still compare numeric opens but flag uncertainty once.
  const hasUnknown = sorted.some((x) => x.candle.timebase === "UNKNOWN");
  if (hasUnknown) {
    findings.push({
      code: MIF_QI_TIMEBASE_UNCERTAIN,
      severity: "warning",
      message: "one or more CLOSED candles use UNKNOWN timebase; gap math uses numeric opens only",
    });
  }

  const authority = input.authority ?? null;
  const gapTrigger = step * 1.5;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const next = sorted[i]!;
    const prevOpen = prev.candle.openTimeSec;
    const nextOpen = next.candle.openTimeSec;
    if (nextOpen === prevOpen) {
      // Duplicates handled elsewhere; do not count as gaps.
      continue;
    }
    const gapSec = nextOpen - prevOpen;
    if (gapSec <= gapTrigger) continue;

    const missed = countCandidateOpensBetween(prevOpen, nextOpen, step);
    if (missed <= 0) continue;

    // Enumerate candidate opens for authority classification.
    const candidates: number[] = [];
    for (let t = prevOpen + step; t < nextOpen; t += step) {
      // Guard float drift: snap to integer seconds.
      const open = Math.round(t);
      if (open > prevOpen && open < nextOpen) candidates.push(open);
      if (candidates.length > missed + 2) break; // safety bound
    }
    // Prefer exact missed count of candidates.
    while (candidates.length > missed) candidates.pop();
    while (candidates.length < missed) {
      const guess = prevOpen + step * (candidates.length + 1);
      if (guess >= nextOpen) break;
      candidates.push(guess);
    }

    let confirmed = 0;
    let unknownAuth = 0;
    let closedSession = 0;
    let usedAuthorityEnumeration = false;
    if (authority) {
      if (typeof authority.listExpectedOpensBetween === "function") {
        const listed = authority.listExpectedOpensBetween(
          input.providerSymbol,
          input.timeframe,
          prevOpen,
          nextOpen,
        );
        if (Array.isArray(listed)) {
          confirmed = listed.length;
          // Enumerated expected opens only. Non-listed candidates are treated as
          // session closures for this authority (not residual unknown gaps).
          closedSession = Math.max(0, missed - confirmed);
          unknownAuth = 0;
          usedAuthorityEnumeration = true;
        }
      }
      if (!usedAuthorityEnumeration) {
        for (const open of candidates) {
          const decision = authority.isExpectedOpen(
            input.providerSymbol,
            input.timeframe,
            open,
          );
          if (decision === true) confirmed += 1;
          else if (decision === "unknown") unknownAuth += 1;
          else closedSession += 1; // false → weekly/session closure, not missing
        }
      }
    }

    if (authority && confirmed > 0) {
      counters.confirmedMissingCount += confirmed;
      findings.push({
        code: MIF_QI_CONFIRMED_MISSING,
        severity: "degraded",
        message: `confirmed missing ${confirmed} expected open(s) between ${prevOpen} and ${nextOpen}`,
        candleIndex: next.index,
        openTimeSec: nextOpen,
        expectedOpenTimeSec: prevOpen + step,
        actualOpenTimeSec: nextOpen,
        expectedDurationSec: step,
        evidence: {
          previousIndex: prev.index,
          gapSec,
          confirmed,
          closedSession,
          authorityId: authority.authorityId,
        },
      });
    }

    if (!authority) {
      // No authority → possible or unknown-session (never confirmed).
      const code = classifyGapWithoutAuthority(missed, gapSec);
      if (code === MIF_QI_UNKNOWN_SESSION_GAP) {
        counters.unknownSessionGapCount += missed;
      } else {
        counters.possibleMissingCount += missed;
      }
      findings.push({
        code,
        severity: "warning",
        message: `gap ${gapSec}s (~${missed} bars) between ${prevOpen} and ${nextOpen}; not confirmed missing without authoritative schedule`,
        candleIndex: next.index,
        openTimeSec: nextOpen,
        expectedOpenTimeSec: prevOpen + step,
        actualOpenTimeSec: nextOpen,
        expectedDurationSec: step,
        evidence: {
          previousIndex: prev.index,
          gapSec,
          classifyCount: missed,
          hasAuthority: false,
        },
      });
      continue;
    }

    // Authority present: only unresolved ("unknown") candidates remain uncertain.
    // Closed-session opens must not be reclassified as POSSIBLE/UNKNOWN gaps.
    if (unknownAuth > 0) {
      const code = classifyGapWithoutAuthority(unknownAuth, gapSec);
      if (code === MIF_QI_UNKNOWN_SESSION_GAP) {
        counters.unknownSessionGapCount += unknownAuth;
      } else {
        counters.possibleMissingCount += unknownAuth;
      }
      findings.push({
        code,
        severity: "warning",
        message:
          `gap ${gapSec}s (~${unknownAuth} bars) between ${prevOpen} and ${nextOpen}; `
          + `authority could not classify these opens (closedSession=${closedSession})`,
        candleIndex: next.index,
        openTimeSec: nextOpen,
        expectedOpenTimeSec: prevOpen + step,
        actualOpenTimeSec: nextOpen,
        expectedDurationSec: step,
        evidence: {
          previousIndex: prev.index,
          gapSec,
          classifyCount: unknownAuth,
          closedSession,
          hasAuthority: true,
          authorityId: authority.authorityId,
        },
      });
    }
  }

  return { findings, counters, usedSortedCopy: true };
}
