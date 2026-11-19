/**
 * Phase 5C Step 3 — conflict preservation and explanation (no majority-vote hide).
 */
import type {
  MifMtfConflictAnalysis,
  MifMtfDirectionalAnalysis,
  MifMtfNormalizedContext,
  MifMtfPatternRelationship,
  MifMtfRegimeRelationship,
} from "./types.js";

export function analyzeConflicts(input: {
  contexts: readonly MifMtfNormalizedContext[];
  directional: MifMtfDirectionalAnalysis;
  patterns: MifMtfPatternRelationship;
  regimes: MifMtfRegimeRelationship;
}): MifMtfConflictAnalysis {
  const agreeing = [...input.directional.supportingTimeframes];
  const disagreeing = [...input.directional.opposingTimeframes];

  const dirConflict =
    input.directional.relation === "CONFLICT"
    || input.directional.relation === "COUNTERTREND_PULLBACK"
    || input.directional.relation === "POTENTIAL_REVERSAL";
  const regimeConflict = input.regimes.status === "CONFLICT";
  const patternConflict = input.patterns.status === "CONFLICT";

  const flags = [dirConflict, regimeConflict, patternConflict].filter(Boolean).length;
  let conflictKind: MifMtfConflictAnalysis["conflictKind"] = "NONE";
  if (flags === 0) {
    conflictKind =
      input.directional.relation === "INSUFFICIENT_DATA" || input.regimes.status === "INSUFFICIENT"
        ? "INSUFFICIENT"
        : "NONE";
  } else if (flags > 1) conflictKind = "MIXED";
  else if (dirConflict) conflictKind = "DIRECTIONAL";
  else if (regimeConflict) conflictKind = "REGIME";
  else conflictKind = "PATTERN";

  const pullbackCompatible = input.directional.relation === "COUNTERTREND_PULLBACK";
  const transitionCompatible =
    input.directional.relation === "POTENTIAL_REVERSAL"
    || input.directional.relation === "TRANSITION"
    || input.regimes.status === "TRANSITION";

  const hasConflict = conflictKind !== "NONE" && conflictKind !== "INSUFFICIENT";

  const parts: string[] = [];
  parts.push(`directional=${input.directional.relation}`);
  parts.push(`regime=${input.regimes.status}`);
  parts.push(`pattern=${input.patterns.status}`);
  if (pullbackCompatible) parts.push("pullback-compatible disagreement");
  if (transitionCompatible) parts.push("transition-compatible disagreement");
  if (!hasConflict && conflictKind === "NONE") {
    parts.push("no material cross-timeframe conflict");
  } else if (hasConflict) {
    parts.push("conflicts preserved for analytical explanation (not majority-voted away)");
  }

  // Include unknown contexts as neither agree nor disagree.
  for (const c of input.contexts) {
    if (!c.available) continue;
    if (c.direction === "UNKNOWN" && !disagreeing.includes(c.timeframe) && !agreeing.includes(c.timeframe)) {
      // leave unclassified
    }
  }

  return {
    hasConflict,
    conflictKind,
    pullbackCompatible,
    transitionCompatible,
    agreeingTimeframes: agreeing,
    disagreeingTimeframes: disagreeing,
    explanation: parts.join("; "),
  };
}
