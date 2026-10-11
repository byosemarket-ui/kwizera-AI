/**
 * Pattern + structure setup rules — closed candles only, no look-ahead.
 */
import { createHash } from "node:crypto";
import type { PatternAnalysisResult, CandlestickPatternDetection } from "../forex-patterns/types.js";
import type { MarketStructureAnalysisResult, StructureEvent } from "../forex-structure/types.js";
import type { SetupEvalState, SetupRecord, SetupEvaluation } from "./types.js";

export const SETUP_RULE_ID = "PATTERN_STRUCTURE_V1" as const;
export const SETUP_RULE_VERSION = "1.0.0" as const;

const RECENT_BARS = 12;

function setupIdFor(ruleId: string, direction: string, anchorCandleTime: number): string {
  return createHash("sha256")
    .update(`${ruleId}|${direction}|${anchorCandleTime}`)
    .digest("hex")
    .slice(0, 16);
}

function isDirectionalPattern(p: CandlestickPatternDetection): boolean {
  return p.direction === "BULLISH" || p.direction === "BEARISH";
}

function sortByEndTimeDesc<T extends { candleEndTime?: number; breakCandleTime?: number }>(
  items: T[],
  key: "candleEndTime" | "breakCandleTime",
): T[] {
  return [...items].sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0));
}

function newestConfirmedPattern(result: PatternAnalysisResult): CandlestickPatternDetection | null {
  const closed = sortByEndTimeDesc(
    result.detections.filter((d) => d.status === "CONFIRMED" && isDirectionalPattern(d)),
    "candleEndTime",
  );
  return closed[0] ?? null;
}

function newestCandidatePattern(result: PatternAnalysisResult): CandlestickPatternDetection | null {
  const items = sortByEndTimeDesc(
    result.detections.filter((d) => d.status === "CANDIDATE" && isDirectionalPattern(d)),
    "candleEndTime",
  );
  return items[0] ?? null;
}

function newestConfirmedBos(result: MarketStructureAnalysisResult): StructureEvent | null {
  const items = sortByEndTimeDesc(
    result.events.filter((e) => e.type === "BOS" && e.status === "CONFIRMED"),
    "breakCandleTime",
  );
  return items[0] ?? null;
}

function newestCandidateBos(result: MarketStructureAnalysisResult): StructureEvent | null {
  const items = sortByEndTimeDesc(
    result.events.filter((e) => e.type === "BOS" && e.status === "CANDIDATE"),
    "breakCandleTime",
  );
  return items[0] ?? null;
}

function bosAfter(bos: StructureEvent, sinceMs: number): boolean {
  return bos.breakCandleTime >= sinceMs;
}

function oppositeDirection(dir: "BULLISH" | "BEARISH"): "BULLISH" | "BEARISH" {
  return dir === "BULLISH" ? "BEARISH" : "BULLISH";
}

function buildSetupRecord(params: {
  direction: "BULLISH" | "BEARISH";
  state: SetupEvalState;
  anchorCandleTime: number;
  pattern: CandlestickPatternDetection | null;
  bos: StructureEvent | null;
  provider: string;
  symbol: string;
  timeframe: string;
  detectedAt: string;
  confirmedAt?: string | null;
  invalidatedAt?: string | null;
}): SetupRecord {
  const { direction, anchorCandleTime, pattern, bos } = params;
  const patternRefs = pattern
    ? [`pattern:${pattern.patternId}:${pattern.candleEndTime}`]
    : [];
  const structureRefs = bos
    ? [`event:${bos.type}:${bos.direction}:${bos.breakCandleTime}`]
    : [];

  const candleTimes = [
    ...(pattern?.candleTimes ?? []),
    bos?.breakCandleTime ?? null,
  ].filter((t): t is number => t != null);

  const evidenceLines = [
    ...(pattern?.evidence.slice(0, 2) ?? []),
    ...(bos?.evidence.slice(0, 2) ?? []),
  ];

  const confirmationRequirements = [];
  if (pattern && pattern.status !== "CONFIRMED") {
    confirmationRequirements.push({
      id: "pattern-close",
      description: `Confirm ${pattern.patternName} on closed candle`,
      met: false,
    });
  } else if (pattern) {
    confirmationRequirements.push({
      id: "pattern-close",
      description: `${pattern.patternName} confirmed`,
      met: true,
    });
  }
  if (bos && bos.status !== "CONFIRMED") {
    confirmationRequirements.push({
      id: "bos-close",
      description: `Confirm ${bos.type} ${bos.direction} break`,
      met: false,
    });
  } else if (bos) {
    confirmationRequirements.push({
      id: "bos-close",
      description: `${bos.type} ${bos.direction} confirmed`,
      met: true,
    });
  }

  return {
    setupId: setupIdFor(SETUP_RULE_ID, direction, anchorCandleTime),
    ruleId: SETUP_RULE_ID,
    ruleVersion: SETUP_RULE_VERSION,
    state: params.state,
    direction,
    detectedAt: params.detectedAt,
    confirmedAt: params.confirmedAt ?? null,
    invalidatedAt: params.invalidatedAt ?? null,
    patternRefs,
    structureRefs,
    confirmationRequirements,
    invalidationConditions: [
      {
        id: "opposite-bos",
        description: "Opposite confirmed BOS after setup",
        triggered: false,
      },
      {
        id: "opposite-pattern-bos",
        description: "Opposite confirmed pattern + BOS breaks setup",
        triggered: false,
      },
    ],
    candleTimes,
    evidenceLines,
    provider: params.provider,
    symbol: params.symbol,
    timeframe: params.timeframe,
  };
}

export interface EvaluateSetupRulesInput {
  patternResult: PatternAnalysisResult;
  structureResult: MarketStructureAnalysisResult;
  provider: string;
  symbol: string;
  timeframe: string;
  nowIso?: string;
  priorSetup?: SetupRecord | null;
  lastClosedCandleTime: number | null;
}

export function evaluateSetupRules(input: EvaluateSetupRulesInput): SetupEvaluation {
  const {
    patternResult,
    structureResult,
    provider,
    symbol,
    timeframe,
    nowIso = new Date().toISOString(),
    priorSetup,
    lastClosedCandleTime,
  } = input;

  const confirmedPattern = newestConfirmedPattern(patternResult);
  const candidatePattern = newestCandidatePattern(patternResult);
  const confirmedBos = newestConfirmedBos(structureResult);
  const candidateBos = newestCandidateBos(structureResult);

  const recentCutoff =
    lastClosedCandleTime != null
      ? lastClosedCandleTime - RECENT_BARS * 900
      : 0;

  const recentConfirmedBos =
    confirmedBos && confirmedBos.breakCandleTime >= recentCutoff ? confirmedBos : null;
  const recentCandidateBos =
    candidateBos && candidateBos.breakCandleTime >= recentCutoff ? candidateBos : null;
  const recentConfirmedPattern =
    confirmedPattern && confirmedPattern.candleEndTime >= recentCutoff ? confirmedPattern : null;
  const recentCandidatePattern =
    candidatePattern && candidatePattern.candleEndTime >= recentCutoff ? candidatePattern : null;

  if (priorSetup && priorSetup.state !== "INVALIDATED") {
    const since = Date.parse(priorSetup.detectedAt) || 0;
    const oppBos = confirmedBos
      && confirmedBos.direction === oppositeDirection(priorSetup.direction)
      && bosAfter(confirmedBos, since);
    const oppPattern = confirmedPattern
      && confirmedPattern.direction === oppositeDirection(priorSetup.direction)
      && confirmedPattern.candleEndTime >= since;
    const oppPatternBos =
      oppPattern
      && confirmedBos
      && confirmedBos.direction === confirmedPattern.direction
      && bosAfter(confirmedBos, since);

    if (oppBos || oppPatternBos) {
      const setup = buildSetupRecord({
        direction: priorSetup.direction,
        state: "INVALIDATED",
        anchorCandleTime:
          priorSetup.candleTimes[priorSetup.candleTimes.length - 1]
          ?? lastClosedCandleTime
          ?? 0,
        pattern: confirmedPattern,
        bos: confirmedBos,
        provider,
        symbol,
        timeframe,
        detectedAt: priorSetup.detectedAt,
        invalidatedAt: nowIso,
      });
      setup.invalidationConditions = setup.invalidationConditions.map((c) => ({
        ...c,
        triggered: c.id === (oppBos ? "opposite-bos" : "opposite-pattern-bos"),
      }));
      return {
        state: "INVALIDATED",
        setup,
        transitionReason: oppBos
          ? "Opposite confirmed BOS after setup"
          : "Opposite confirmed pattern + BOS broke setup",
      };
    }
  }

  if (
    recentConfirmedPattern
    && recentConfirmedBos
    && recentConfirmedPattern.direction === recentConfirmedBos.direction
  ) {
    const setup = buildSetupRecord({
      direction: recentConfirmedPattern.direction as "BULLISH" | "BEARISH",
      state: "CONFIRMED",
      anchorCandleTime: recentConfirmedPattern.candleEndTime,
      pattern: recentConfirmedPattern,
      bos: recentConfirmedBos,
      provider,
      symbol,
      timeframe,
      detectedAt: priorSetup?.detectedAt ?? nowIso,
      confirmedAt: nowIso,
    });
    return {
      state: "CONFIRMED",
      setup,
      transitionReason: "Confirmed pattern and confirmed BOS same direction",
    };
  }

  if (recentConfirmedPattern || recentConfirmedBos) {
    const direction = (recentConfirmedPattern?.direction
      ?? recentConfirmedBos?.direction) as "BULLISH" | "BEARISH";
    const anchor = recentConfirmedPattern?.candleEndTime
      ?? recentConfirmedBos!.breakCandleTime;
    const setup = buildSetupRecord({
      direction,
      state: "SETUP_DETECTED",
      anchorCandleTime: anchor,
      pattern: recentConfirmedPattern,
      bos: recentConfirmedBos,
      provider,
      symbol,
      timeframe,
      detectedAt: nowIso,
    });
    return {
      state: "SETUP_DETECTED",
      setup,
      transitionReason: recentConfirmedPattern
        ? "Newest confirmed directional pattern"
        : "Confirmed BOS aligned",
    };
  }

  if (recentCandidatePattern || recentCandidateBos) {
    const direction = (recentCandidatePattern?.direction
      ?? recentCandidateBos?.direction) as "BULLISH" | "BEARISH";
    const anchor = recentCandidatePattern?.candleEndTime
      ?? recentCandidateBos!.breakCandleTime;
    const setup = buildSetupRecord({
      direction,
      state: "WAITING_FOR_CONFIRMATION",
      anchorCandleTime: anchor,
      pattern: recentCandidatePattern,
      bos: recentCandidateBos,
      provider,
      symbol,
      timeframe,
      detectedAt: nowIso,
    });
    return {
      state: "WAITING_FOR_CONFIRMATION",
      setup,
      transitionReason: "Candidate pattern or BOS awaiting close confirmation",
    };
  }

  return {
    state: "WATCHING",
    setup: null,
    transitionReason: "No setup candidate on closed candles",
  };
}
