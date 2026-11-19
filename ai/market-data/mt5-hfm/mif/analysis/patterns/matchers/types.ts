/**
 * Shared matcher candidate shape before lifecycle / identity finalization.
 */
import type { StructureCandle, StructureSwing } from "../../../../../../forex-structure/types.js";
import type {
  MifChartPatternBoundary,
  MifChartPatternBreakoutDirection,
  MifChartPatternPivotRef,
  MifChartPatternPolicy,
  MifChartPatternType,
} from "../types.js";

export interface PatternMatcherContext {
  swings: readonly StructureSwing[];
  candles: readonly StructureCandle[];
  policy: MifChartPatternPolicy;
  atr: number;
  allowConfirmed: boolean;
  qualityGateScore: number;
}

export interface RawPatternCandidate {
  patternType: MifChartPatternType;
  pivots: MifChartPatternPivotRef[];
  neckline: MifChartPatternBoundary | null;
  upperBoundary: MifChartPatternBoundary | null;
  lowerBoundary: MifChartPatternBoundary | null;
  breakBoundary: MifChartPatternBoundary;
  breakoutDirection: MifChartPatternBreakoutDirection;
  afterPivotTimeSec: number;
  midPrice: number;
  geometryValid: boolean;
  structureInvalidated: boolean;
  measurements: Record<string, number | boolean | string | null>;
  geometryFit: number;
  depthOrProminence: number;
  symmetryOrTouches: number;
}

export function swingToPivot(
  role: string,
  s: StructureSwing,
): MifChartPatternPivotRef {
  return {
    role,
    swingId: s.id,
    kind: s.kind,
    price: s.price,
    timeSec: s.time,
    index: s.index,
    status: s.status === "CONFIRMED" ? "CONFIRMED" : "PROVISIONAL",
  };
}
