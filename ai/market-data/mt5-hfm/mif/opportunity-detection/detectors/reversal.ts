/**
 * Phase 5D Step 4 — Reversal Detector.
 * Distinguishes structural reversals from ordinary pullbacks; fib/FORMING alone never suffice.
 */
import type { MifChartPatternDetection } from "../../analysis/patterns/types.js";
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_REVERSAL_DETECTOR_ID,
  MIF_REVERSAL_DETECTOR_VERSION,
} from "./contracts.js";
import {
  collectOptionalMissingWarnings,
  findEvidenceByFamily,
  findEvidenceById,
  isPresentUsable,
  resolveMtfView,
  resolveRegimeView,
} from "./shared.js";

const STRATEGY_ID = "REVERSAL" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

const BULLISH_PATTERNS = new Set([
  "DOUBLE_BOTTOM",
  "INVERSE_HEAD_AND_SHOULDERS",
]);
const BEARISH_PATTERNS = new Set([
  "DOUBLE_TOP",
  "HEAD_AND_SHOULDERS",
]);

function noteValue(notes: string | undefined, key: string): string | null {
  if (!notes) return null;
  const m = new RegExp(`(?:^|[;,]\\s*)${key}\\s*=\\s*([A-Za-z0-9_]+)`, "i").exec(notes);
  return m ? m[1]!.toUpperCase() : null;
}

function parseStructureNotes(notes: string | undefined): {
  structuralChange: string | null;
  priorDirection: string | null;
  newBias: string | null;
  failed: boolean;
} {
  const structuralChange = noteValue(notes, "structuralChange");
  const priorDirection = noteValue(notes, "priorDirection");
  const newBias = noteValue(notes, "newBias");
  const failed =
    structuralChange === "FAILED"
    || structuralChange === "INVALIDATED"
    || noteValue(notes, "invalidated") === "TRUE";
  return { structuralChange, priorDirection, newBias, failed };
}

interface PatternSupport {
  confirmedBullish: boolean;
  confirmedBearish: boolean;
  formingOnly: boolean;
  failedOrInvalid: boolean;
  evidenceIds: string[];
}

function resolvePatternSupport(context: MifOpportunityDetectionContext): PatternSupport {
  const result: PatternSupport = {
    confirmedBullish: false,
    confirmedBearish: false,
    formingOnly: false,
    failedOrInvalid: false,
    evidenceIds: [],
  };

  const geoEv =
    findEvidenceById(context, "rv.geometric")
    ?? findEvidenceByFamily(context, "GEOMETRIC_PATTERN");
  const harEv =
    findEvidenceById(context, "rv.harmonic")
    ?? findEvidenceByFamily(context, "HARMONIC_PATTERN");

  if (context.chartPatterns?.detections?.length) {
    for (const d of context.chartPatterns.detections as MifChartPatternDetection[]) {
      if (d.lifecycle === "FAILED" || d.lifecycle === "INVALIDATED") {
        result.failedOrInvalid = true;
        continue;
      }
      if (d.lifecycle === "FORMING") {
        result.formingOnly = true;
        continue;
      }
      if (d.lifecycle === "CONFIRMED") {
        if (BULLISH_PATTERNS.has(d.patternType) || d.confirmation.direction === "BULLISH") {
          result.confirmedBullish = true;
        }
        if (BEARISH_PATTERNS.has(d.patternType) || d.confirmation.direction === "BEARISH") {
          result.confirmedBearish = true;
        }
      }
    }
  }

  if (context.harmonic?.detections?.length) {
    for (const d of context.harmonic.detections) {
      if (d.lifecycle === "FAILED" || d.lifecycle === "INVALIDATED") {
        result.failedOrInvalid = true;
        continue;
      }
      if (d.lifecycle === "FORMING") {
        result.formingOnly = true;
        continue;
      }
      if (d.lifecycle === "CONFIRMED") {
        if (d.orientation === "BULLISH") result.confirmedBullish = true;
        if (d.orientation === "BEARISH") result.confirmedBearish = true;
      }
    }
  }

  for (const e of [geoEv, harEv]) {
    if (!isPresentUsable(e)) continue;
    const lifecycle = noteValue(e!.notes, "lifecycle");
    const patternType = noteValue(e!.notes, "patternType");
    const orientation = noteValue(e!.notes, "orientation") ?? noteValue(e!.notes, "bias");
    result.evidenceIds.push(e!.evidenceId);

    if (lifecycle === "FAILED" || lifecycle === "INVALIDATED") {
      result.failedOrInvalid = true;
      continue;
    }
    if (lifecycle === "FORMING") {
      result.formingOnly = true;
      continue;
    }
    if (lifecycle === "CONFIRMED") {
      if (
        orientation === "BULLISH"
        || (patternType != null && BULLISH_PATTERNS.has(patternType))
      ) {
        result.confirmedBullish = true;
      }
      if (
        orientation === "BEARISH"
        || (patternType != null && BEARISH_PATTERNS.has(patternType))
      ) {
        result.confirmedBearish = true;
      }
    }
  }

  // FORMING-only only if nothing confirmed
  if (result.confirmedBullish || result.confirmedBearish) {
    result.formingOnly = false;
  }

  return result;
}

function evaluateReversal(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, [
    "rv.geometric",
    "rv.harmonic",
    "rv.fib",
  ]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["rv.mtf"]);
  const patterns = resolvePatternSupport(context);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks reversal evaluation`,
    };
  }
  if (mtf.status === "BLOCKED" || mtf.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `MTF status ${mtf.status} blocks reversal`,
    };
  }

  const structureEv =
    findEvidenceById(context, "rv.structure")
    ?? findEvidenceByFamily(context, "MARKET_STRUCTURE");
  if (!isPresentUsable(structureEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "market structure evidence absent or unusable; reversal requires structural context",
    };
  }

  const structure = parseStructureNotes(structureEv!.notes);
  if (structure.failed) {
    return {
      candidate: null,
      warnings: [...warnings, "structure invalidation / failed break observed"],
      diagnostics: "reversal hypothesis invalidated by failed/invalidated structure",
    };
  }

  const hasStructuralChange =
    structure.structuralChange === "CHOCH"
    || structure.structuralChange === "BOS"
    || structure.structuralChange === "WEAKENING"
    || structure.structuralChange === "STRUCTURE_BREAK";

  const fibEv = findEvidenceById(context, "rv.fib") ?? findEvidenceByFamily(context, "FIBONACCI");
  const fibPresent = isPresentUsable(fibEv);

  // Fibonacci alone never establishes reversal.
  if (
    fibPresent
    && !hasStructuralChange
    && !patterns.confirmedBullish
    && !patterns.confirmedBearish
    && mtf.relation !== "POTENTIAL_REVERSAL"
    && mtf.relation !== "TRANSITION"
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "Fibonacci present without reversal confirmation"],
      diagnostics: "Fibonacci proximity alone is not reversal confirmation",
    };
  }

  // FORMING pattern alone is not confirmation.
  if (
    patterns.formingOnly
    && !hasStructuralChange
    && !patterns.confirmedBullish
    && !patterns.confirmedBearish
    && mtf.relation !== "POTENTIAL_REVERSAL"
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING pattern alone is not reversal confirmation"],
      diagnostics: "FORMING pattern is not equivalent to CONFIRMED reversal evidence",
    };
  }

  // FAILED/INVALIDATED pattern cannot serve as active confirmation (already excluded above).
  if (patterns.failedOrInvalid && !patterns.confirmedBullish && !patterns.confirmedBearish) {
    warnings.push("failed/invalidated pattern present — not used as confirmation");
  }

  // Ordinary pullback: countertrend with intact structure → not reversal.
  if (
    mtf.relation === "COUNTERTREND_PULLBACK"
    && !hasStructuralChange
    && !patterns.confirmedBullish
    && !patterns.confirmedBearish
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "COUNTERTREND_PULLBACK without structural change → pullback, not reversal"],
      diagnostics: "ordinary pullback evidence; not classified as reversal",
    };
  }

  // Strong aligned trend without structural change → not reversal.
  if (
    mtf.relation === "ALIGNMENT"
    && regime.structure === "TRENDING"
    && !hasStructuralChange
    && !patterns.confirmedBullish
    && !patterns.confirmedBearish
  ) {
    return {
      candidate: null,
      warnings,
      diagnostics: "aligned trending market without structural change — no reversal",
    };
  }

  // LTF POTENTIAL_REVERSAL without HTF structural/pattern confirmation.
  if (
    mtf.relation === "POTENTIAL_REVERSAL"
    && !hasStructuralChange
    && !patterns.confirmedBullish
    && !patterns.confirmedBearish
    && (regime.structure === "TRENDING" || regime.structure === "UNKNOWN")
  ) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "lower-timeframe POTENTIAL_REVERSAL without meaningful higher-timeframe structural change",
      ],
      diagnostics: "insufficient higher-timeframe structural change for reversal candidate",
    };
  }

  // TRANSITION regime alone is insufficient.
  if (
    regime.structure === "TRANSITION"
    && !hasStructuralChange
    && !patterns.confirmedBullish
    && !patterns.confirmedBearish
    && mtf.relation !== "POTENTIAL_REVERSAL"
    && mtf.relation !== "TRANSITION"
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "TRANSITION regime without structural/pattern confirmation"],
      diagnostics: "TRANSITION regime alone is not reversal confirmation",
    };
  }

  const mtfSupportsReversal =
    mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "TRANSITION"
    || (mtf.relation === "CONFLICT" && !mtf.pullbackCompatible)
    || (mtf.relation === "PARTIAL_ALIGNMENT" && !mtf.pullbackCompatible && hasStructuralChange);

  if (!mtfSupportsReversal && !patterns.confirmedBullish && !patterns.confirmedBearish) {
    return {
      candidate: null,
      warnings,
      diagnostics: `MTF relation ${mtf.relation} does not support reversal without confirmed pattern`,
    };
  }

  if (!hasStructuralChange && !patterns.confirmedBullish && !patterns.confirmedBearish) {
    return {
      candidate: null,
      warnings,
      diagnostics: "no structural change or confirmed reversal pattern — refusing candidate",
    };
  }

  // Direction resolution
  let direction: MifOpportunityDirection = "UNKNOWN";
  if (structure.newBias === "BULLISH" || patterns.confirmedBullish) {
    direction = "BUY";
  } else if (structure.newBias === "BEARISH" || patterns.confirmedBearish) {
    direction = "SELL";
  } else if (structure.priorDirection === "DOWN") {
    direction = "BUY";
  } else if (structure.priorDirection === "UP") {
    direction = "SELL";
  } else if (regime.direction === "DOWN" && (hasStructuralChange || mtf.relation === "POTENTIAL_REVERSAL")) {
    direction = "BUY";
  } else if (regime.direction === "UP" && (hasStructuralChange || mtf.relation === "POTENTIAL_REVERSAL")) {
    direction = "SELL";
  }

  if (direction === "UNKNOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: "reversal direction cannot be resolved from available evidence",
    };
  }

  // Conflicting continuation evidence preserved
  const conflictingEvidenceIds: string[] = [];
  if (mtf.hasConflict || mtf.relation === "CONFLICT" || mtf.relation === "PARTIAL_ALIGNMENT") {
    const mtfEv =
      findEvidenceById(context, "rv.mtf")
      ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
    if (mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`conflicting/partial MTF retained: ${mtf.relation}`);
  }

  const candle =
    findEvidenceById(context, "rv.candle_confirm")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  const candleClosed = isPresentUsable(candle) && candle?.candleState === "CLOSED";
  const patternConfirmed =
    (direction === "BUY" && patterns.confirmedBullish)
    || (direction === "SELL" && patterns.confirmedBearish);

  const stronglyConfirmed =
    candleClosed
    || patternConfirmed
    || (hasStructuralChange
      && (structure.structuralChange === "CHOCH" || structure.structuralChange === "BOS")
      && mtf.relation === "POTENTIAL_REVERSAL");

  // Insufficient confirmation → still may emit NEEDS_CONFIRMATION when hypothesis is coherent.
  const hypothesisSupported =
    hasStructuralChange
    || patternConfirmed
    || (mtf.relation === "POTENTIAL_REVERSAL" && hasStructuralChange);

  if (!hypothesisSupported) {
    return {
      candidate: null,
      warnings,
      diagnostics: "reversal hypothesis not adequately supported",
    };
  }

  const status = stronglyConfirmed ? "DETECTED" : "NEEDS_CONFIRMATION";
  if (!stronglyConfirmed) {
    warnings.push("reversal hypothesis lacks closed structural/pattern confirmation");
  }

  const supportingEvidenceIds = ["rv.regime", "rv.mtf", "rv.structure", "rv.quality"].filter(
    (id) => isPresentUsable(findEvidenceById(context, id)) || id === "rv.quality",
  );
  for (const id of patterns.evidenceIds) {
    if (!supportingEvidenceIds.includes(id)) supportingEvidenceIds.push(id);
  }
  if (structureEv && !supportingEvidenceIds.includes(structureEv.evidenceId)) {
    supportingEvidenceIds.push(structureEv.evidenceId);
  }
  if (fibPresent && fibEv && stronglyConfirmed && !supportingEvidenceIds.includes(fibEv.evidenceId)) {
    supportingEvidenceIds.push(fibEv.evidenceId);
  }
  if (candleClosed && candle && !supportingEvidenceIds.includes(candle.evidenceId)) {
    supportingEvidenceIds.push(candle.evidenceId);
  }

  const thesis =
    direction === "BUY"
      ? "Potential bullish reversal setup"
      : "Potential bearish reversal setup";
  const rationale = [
    `Regime structure=${regime.structure} direction=${regime.direction}.`,
    `MTF relation=${mtf.relation} pullbackCompatible=${mtf.pullbackCompatible}.`,
    hasStructuralChange
      ? `Structural change=${structure.structuralChange}.`
      : "No explicit structural-change code.",
    patternConfirmed ? "Confirmed reversal pattern present." : "No confirmed reversal pattern.",
    "Not classified as ordinary pullback.",
    "Does not claim certainty or win probability.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_REVERSAL_DETECTOR_ID,
    detectorVersion: MIF_REVERSAL_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["rv.structure_confirm"],
    invalidationConditions: ["rv.failed_structure"],
    knownLimitations: [
      "Not a simple candle-color reversal.",
      "Market structure evidence is PARTIAL in current MIF.",
      "Does not imply profitable trade probability.",
      "Analytical candidate only — not executable.",
    ],
    timeframeRoles: [
      "PRIMARY_DIRECTION",
      "INTERMEDIATE_STRUCTURE",
      "LOWER_TIMEFRAME_CONFIRMATION",
    ],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics: `reversal candidate direction=${direction} status=${status} mtf=${mtf.relation}`,
  };
}

export const mifReversalDetector: MifOpportunityDetector = {
  detectorId: MIF_REVERSAL_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_REVERSAL_DETECTOR_VERSION,
  policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
  availabilityStatus: "ACTIVE",
  supportedTimeframeRoles: [
    "PRIMARY_DIRECTION",
    "INTERMEDIATE_STRUCTURE",
    "LOWER_TIMEFRAME_CONFIRMATION",
    "OPTIONAL_ENTRY_REFINEMENT",
  ],
  supportedSymbols: null,
  notes: "Phase 5D Step 4 — reversal; distinguishes pullbacks; analytical only.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateReversal,
};
