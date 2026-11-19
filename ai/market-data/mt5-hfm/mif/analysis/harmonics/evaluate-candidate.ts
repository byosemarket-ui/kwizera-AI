/**
 * Phase 5C Step 2 — evaluate an explicit XABCD candidate (testable without swings).
 */
import type { StructureCandle } from "../../../../../forex-structure/types.js";
import { evaluateHarmonicLifecycle } from "./lifecycle.js";
import { findMatchingPatternTypes } from "./measure-ratios.js";
import { computePrz } from "./prz.js";
import { computeHarmonicDetectionIdentity } from "./stable-identity.js";
import {
  MIF_HARMONIC_PATTERNS_ENGINE_VERSION,
} from "./contracts.js";
import type {
  MifHarmonicDetection,
  MifHarmonicOrientation,
  MifHarmonicPivotRef,
  MifHarmonicPolicy,
} from "./types.js";

export function evaluateHarmonicCandidate(input: {
  pivots: MifHarmonicPivotRef[];
  orientation: MifHarmonicOrientation;
  policy: MifHarmonicPolicy;
  atr: number;
  candles: readonly StructureCandle[];
  allowConfirmed: boolean;
  structureInvalidated?: boolean;
}): MifHarmonicDetection[] {
  const roles = ["X", "A", "B", "C", "D"] as const;
  if (input.pivots.length !== 5) return [];
  for (let i = 0; i < 5; i++) {
    if (input.pivots[i]?.role !== roles[i]) return [];
  }
  // Chronology + alternation
  for (let i = 0; i < 4; i++) {
    const a = input.pivots[i]!;
    const b = input.pivots[i + 1]!;
    if (!(a.timeSec < b.timeSec && a.index < b.index)) return [];
    if (a.kind === b.kind) return [];
  }

  const prices = {
    x: input.pivots[0]!.price,
    a: input.pivots[1]!.price,
    b: input.pivots[2]!.price,
    c: input.pivots[3]!.price,
    d: input.pivots[4]!.price,
  };

  const matches = findMatchingPatternTypes(prices, input.policy);
  const out: MifHarmonicDetection[] = [];

  for (const m of matches) {
    const prz = computePrz({
      prices,
      orientation: input.orientation,
      ratioPolicy: m.ratioPolicy,
      atr: input.atr,
      maxPrzWidthAtr: input.policy.maxPrzWidthAtr,
      minPrzProjections: input.policy.minPrzProjections,
    });
    const life = evaluateHarmonicLifecycle({
      ratiosValid: m.allRequiredRatiosPassed,
      structureInvalidated: input.structureInvalidated === true,
      orientation: input.orientation,
      pivots: input.pivots,
      prz,
      atr: input.atr,
      candles: input.candles,
      allowConfirmed: input.allowConfirmed,
    });
    const detectionIdentity = computeHarmonicDetectionIdentity({
      patternType: m.patternType,
      orientation: input.orientation,
      pivots: input.pivots,
      lifecycle: life.lifecycle,
      policyId: input.policy.policyId,
      policyVersion: input.policy.policyVersion,
      engineVersion: MIF_HARMONIC_PATTERNS_ENGINE_VERSION,
      confirmationCandleOpenTimeSec: life.confirmationCandleOpenTimeSec,
    });
    out.push({
      patternType: m.patternType,
      orientation: input.orientation,
      lifecycle: life.lifecycle,
      pivots: input.pivots,
      ratios: m.ratios,
      allRequiredRatiosPassed: m.allRequiredRatiosPassed,
      prz,
      geometryFit: m.geometryFit,
      detectionIdentity,
    });
  }
  return out;
}
