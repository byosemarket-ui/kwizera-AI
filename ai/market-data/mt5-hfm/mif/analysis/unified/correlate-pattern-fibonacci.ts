/**
 * Phase 5C Step 1C — deterministic pattern boundary ↔ Fibonacci level correlation.
 *
 * Reference timestamp: Fibonacci impulse end (anchorB.timeSec).
 * Sloped boundaries are projected to that timestamp; if projection inputs are missing,
 * the relationship is reported unavailable (never invented).
 * Prices are never rounded.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifFibonacciAssessment, MifFibonacciLevel } from "../fibonacci/types.js";
import type {
  MifChartPatternAssessment,
  MifChartPatternBoundary,
  MifChartPatternDetection,
} from "../patterns/types.js";
import type {
  MifPatternFibRelationship,
  MifPatternReferencePrice,
  MifUnifiedChartAnalysisPolicy,
} from "./types.js";

function boundaryPriceAt(
  boundary: MifChartPatternBoundary,
  timeSec: number,
): number {
  if (boundary.kind === "horizontal" || Math.abs(boundary.slopePerSec) < 1e-18) {
    return boundary.priceAtStart;
  }
  const intercept = boundary.priceAtStart - boundary.slopePerSec * boundary.timeSecStart;
  return intercept + boundary.slopePerSec * timeSec;
}

function extractReferences(
  detection: MifChartPatternDetection,
  referenceTimeSec: number | null,
): MifPatternReferencePrice[] {
  const refs: MifPatternReferencePrice[] = [];
  const pushBoundary = (
    kind: MifPatternReferencePrice["referenceKind"],
    boundary: MifChartPatternBoundary | null,
  ) => {
    if (!boundary) return;
    if (referenceTimeSec == null) {
      refs.push({
        detectionIdentity: detection.detectionIdentity,
        patternType: detection.patternType,
        lifecycle: detection.lifecycle,
        referenceKind: kind,
        price: null,
        evaluatedAtTimeSec: null,
        available: false,
        unavailableReason: "reference timestamp unavailable for boundary projection",
      });
      return;
    }
    if (
      boundary.kind === "sloped"
      && !(Number.isFinite(boundary.slopePerSec) && Number.isFinite(boundary.priceAtStart))
    ) {
      refs.push({
        detectionIdentity: detection.detectionIdentity,
        patternType: detection.patternType,
        lifecycle: detection.lifecycle,
        referenceKind: kind,
        price: null,
        evaluatedAtTimeSec: referenceTimeSec,
        available: false,
        unavailableReason: "sloped boundary projection inputs invalid",
      });
      return;
    }
    const price = boundaryPriceAt(boundary, referenceTimeSec);
    if (!Number.isFinite(price)) {
      refs.push({
        detectionIdentity: detection.detectionIdentity,
        patternType: detection.patternType,
        lifecycle: detection.lifecycle,
        referenceKind: kind,
        price: null,
        evaluatedAtTimeSec: referenceTimeSec,
        available: false,
        unavailableReason: "projected boundary price not finite",
      });
      return;
    }
    refs.push({
      detectionIdentity: detection.detectionIdentity,
      patternType: detection.patternType,
      lifecycle: detection.lifecycle,
      referenceKind: kind,
      price,
      evaluatedAtTimeSec: referenceTimeSec,
      available: true,
      unavailableReason: null,
    });
  };

  pushBoundary("NECKLINE", detection.neckline);
  pushBoundary("UPPER_BOUNDARY", detection.upperBoundary);
  pushBoundary("LOWER_BOUNDARY", detection.lowerBoundary);
  return refs;
}

function confluenceTolerance(
  policy: MifUnifiedChartAnalysisPolicy,
  mid: number,
  atr: number | null,
): number {
  const rel = policy.confluenceTolRel * Math.max(Math.abs(mid), 1);
  const atrPart = atr != null && atr > 0 ? policy.confluenceTolAtrMult * atr : 0;
  return Math.max(rel, atrPart);
}

function relationshipId(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts), "utf8").digest("hex").slice(0, 24);
}

function compareRefToLevels(input: {
  ref: MifPatternReferencePrice;
  levels: readonly MifFibonacciLevel[];
  policy: MifUnifiedChartAnalysisPolicy;
  atr: number | null;
  patternAssessmentIdentity: string;
  fibonacciAssessmentIdentity: string;
}): MifPatternFibRelationship[] {
  const out: MifPatternFibRelationship[] = [];
  if (!input.ref.available || input.ref.price == null) {
    // One placeholder unavailable row per reference (not per fib level).
    out.push({
      relationshipId: relationshipId({
        detection: input.ref.detectionIdentity,
        kind: input.ref.referenceKind,
        unavailable: true,
      }),
      patternReference: input.ref,
      fibonacciRatio: NaN,
      fibonacciLevelKind: "retracement",
      fibonacciPrice: NaN,
      absoluteDistance: null,
      normalizedDistance: null,
      normalizationBasis: "unavailable",
      withinTolerance: false,
      precisionOk: null,
      tickAligned: null,
      patternAssessmentIdentity: input.patternAssessmentIdentity,
      fibonacciAssessmentIdentity: input.fibonacciAssessmentIdentity,
    });
    return out;
  }

  for (const level of input.levels) {
    const mid = (input.ref.price + level.price) / 2;
    const abs = Math.abs(input.ref.price - level.price);
    let normalizedDistance: number | null = null;
    let normalizationBasis: MifPatternFibRelationship["normalizationBasis"] = "unavailable";
    if (input.atr != null && input.atr > 0) {
      normalizedDistance = abs / input.atr;
      normalizationBasis = "atr";
    } else {
      normalizedDistance = abs / Math.max(Math.abs(mid), 1);
      normalizationBasis = "mid_price";
    }
    const tol = confluenceTolerance(input.policy, mid, input.atr);
    out.push({
      relationshipId: relationshipId({
        detection: input.ref.detectionIdentity,
        kind: input.ref.referenceKind,
        ratio: level.ratio,
        levelKind: level.kind,
        fibPrice: level.price,
        patPrice: input.ref.price,
      }),
      patternReference: input.ref,
      fibonacciRatio: level.ratio,
      fibonacciLevelKind: level.kind,
      fibonacciPrice: level.price,
      absoluteDistance: abs,
      normalizedDistance,
      normalizationBasis,
      withinTolerance: abs <= tol,
      precisionOk: level.precisionOk,
      tickAligned: level.tickAligned,
      patternAssessmentIdentity: input.patternAssessmentIdentity,
      fibonacciAssessmentIdentity: input.fibonacciAssessmentIdentity,
    });
  }
  return out;
}

/**
 * Correlate pattern geometry references with Fibonacci levels.
 * Does not mutate source assessments.
 */
export function correlatePatternFibonacci(input: {
  pattern: MifChartPatternAssessment;
  fibonacci: MifFibonacciAssessment;
  policy: MifUnifiedChartAnalysisPolicy;
}): {
  relationships: MifPatternFibRelationship[];
  referenceTimeSec: number | null;
  atrUsed: number | null;
} {
  const referenceTimeSec = input.fibonacci.anchorB?.timeSec ?? null;
  const atrUsed =
    typeof input.pattern.diagnostics.atrValue === "number"
      && Number.isFinite(input.pattern.diagnostics.atrValue)
      && input.pattern.diagnostics.atrValue > 0
      ? input.pattern.diagnostics.atrValue
      : null;

  const levels: MifFibonacciLevel[] = [
    ...input.fibonacci.retracements,
    ...input.fibonacci.extensions,
  ];

  const relationships: MifPatternFibRelationship[] = [];
  for (const detection of input.pattern.detections) {
    const refs = extractReferences(detection, referenceTimeSec);
    for (const ref of refs) {
      relationships.push(
        ...compareRefToLevels({
          ref,
          levels,
          policy: input.policy,
          atr: atrUsed,
          patternAssessmentIdentity: input.pattern.inputIdentity,
          fibonacciAssessmentIdentity: input.fibonacci.inputIdentity,
        }),
      );
    }
  }

  // Deterministic order
  relationships.sort((a, b) => a.relationshipId.localeCompare(b.relationshipId));
  return { relationships, referenceTimeSec, atrUsed };
}
