/**
 * Phase 5D Step 11 — Pattern Completion Opportunity Detector.
 * Reuses Phase 5C geometric + harmonic assessments / evidence notes.
 * Does not re-detect patterns, fabricate PRZ/ratios, or treat Fibonacci as proof.
 * FORMING ≠ CONFIRMED. FAILED/INVALIDATED never create candidates.
 */
import type { MifChartPatternDetection } from "../../analysis/patterns/types.js";
import type { MifHarmonicDetection } from "../../analysis/harmonics/types.js";
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_PATTERN_COMPLETION_DETECTOR_ID,
  MIF_PATTERN_COMPLETION_DETECTOR_VERSION,
} from "./contracts.js";
import {
  collectOptionalMissingWarnings,
  findEvidenceByFamily,
  findEvidenceById,
  isPresentUsable,
  noteValue,
  resolveMtfView,
  resolveRegimeView,
} from "./shared.js";

const STRATEGY_ID = "PATTERN_COMPLETION" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

const GEOMETRIC_TYPES = new Set([
  "DOUBLE_TOP",
  "DOUBLE_BOTTOM",
  "HEAD_AND_SHOULDERS",
  "INVERSE_HEAD_AND_SHOULDERS",
  "ASCENDING_TRIANGLE",
  "DESCENDING_TRIANGLE",
  "SYMMETRICAL_TRIANGLE",
]);

const HARMONIC_TYPES = new Set([
  "GARTLEY",
  "BAT",
  "BUTTERFLY",
  "CRAB",
  "SHARK",
]);

const BULLISH_GEOMETRIC = new Set([
  "DOUBLE_BOTTOM",
  "INVERSE_HEAD_AND_SHOULDERS",
  "ASCENDING_TRIANGLE",
]);

const BEARISH_GEOMETRIC = new Set([
  "DOUBLE_TOP",
  "HEAD_AND_SHOULDERS",
  "DESCENDING_TRIANGLE",
]);

/**
 * Detector completion vocabulary mapped from source lifecycle + optional notes.
 * Source engines use FORMING|CONFIRMED|FAILED|INVALIDATED only.
 * APPROACHING_COMPLETION / COMPLETION_REACHED are note overlays when present.
 */
type CompletionState =
  | "FORMING"
  | "APPROACHING_COMPLETION"
  | "COMPLETION_REACHED"
  | "CONFIRMED"
  | "FAILED"
  | "INVALIDATED"
  | "INSUFFICIENT_EVIDENCE";

type PatternFamily = "GEOMETRIC" | "HARMONIC" | "UNKNOWN";

interface ResolvedPattern {
  family: PatternFamily;
  patternType: string | null;
  patternId: string | null;
  orientation: string | null;
  confirmationDirection: string | null;
  confirmationMet: boolean | null;
  sourceLifecycle: string | null;
  completionState: CompletionState;
  przValid: boolean | null;
  przTouched: boolean | null;
  xabcdValid: boolean | null;
  candleState: string | null;
  symbol: string | null;
  timeframe: string | null;
  evidenceId: string | null;
  detectionIdentity: string | null;
}

function mapCompletionState(
  sourceLifecycle: string | null,
  completionRaw: string | null,
  confirmationMet: boolean | null,
  przTouched: boolean | null,
): CompletionState {
  if (sourceLifecycle === "FAILED" || completionRaw === "FAILED") return "FAILED";
  if (sourceLifecycle === "INVALIDATED" || completionRaw === "INVALIDATED") {
    return "INVALIDATED";
  }
  // Source lifecycle CONFIRMED is authoritative. confirmationMet alone must NOT
  // upgrade FORMING → CONFIRMED (FORMING ≠ CONFIRMED; prevents fabricated notes).
  if (sourceLifecycle === "CONFIRMED" || completionRaw === "CONFIRMED") {
    return "CONFIRMED";
  }

  if (
    completionRaw === "APPROACHING_COMPLETION"
    || completionRaw === "APPROACHING"
  ) {
    return "APPROACHING_COMPLETION";
  }
  if (
    completionRaw === "COMPLETION_REACHED"
    || completionRaw === "REACHED"
    || completionRaw === "COMPLETE"
  ) {
    return "COMPLETION_REACHED";
  }
  // PRZ touch or confirm flag while still FORMING = completion area reached, not confirmed.
  if (
    sourceLifecycle === "FORMING"
    && (przTouched === true || confirmationMet === true)
  ) {
    return "COMPLETION_REACHED";
  }
  if (sourceLifecycle === "FORMING" || completionRaw === "FORMING") return "FORMING";
  // confirmationMet without lifecycle: treat as completion reached, not confirmed.
  if (confirmationMet === true) return "COMPLETION_REACHED";
  return "INSUFFICIENT_EVIDENCE";
}

function parseBool(raw: string | null): boolean | null {
  if (raw === "TRUE" || raw === "YES" || raw === "MET") return true;
  if (raw === "FALSE" || raw === "NO" || raw === "UNMET") return false;
  return null;
}

function parseNotesPattern(
  notes: string | undefined,
  familyHint: PatternFamily,
  evidenceId: string,
  candleState: string | null | undefined,
): ResolvedPattern {
  const patternType =
    noteValue(notes, "patternType")
    ?? noteValue(notes, "pattern")
    ?? noteValue(notes, "type");
  const patternId =
    noteValue(notes, "patternId")
    ?? noteValue(notes, "detectionIdentity")
    ?? noteValue(notes, "id");
  const orientation =
    noteValue(notes, "orientation")
    ?? noteValue(notes, "bias")
    ?? noteValue(notes, "direction");
  const confirmationDirection =
    noteValue(notes, "confirmDir")
    ?? noteValue(notes, "breakoutDirection")
    ?? noteValue(notes, "confirmationDirection");
  const confirmationMet =
    parseBool(noteValue(notes, "confirm") ?? noteValue(notes, "confirmationMet") ?? noteValue(notes, "confirmed"));
  const sourceLifecycle =
    noteValue(notes, "lifecycle")
    ?? noteValue(notes, "state");
  const completionRaw =
    noteValue(notes, "completionState")
    ?? noteValue(notes, "completion");
  const przValid = parseBool(noteValue(notes, "przValid") ?? noteValue(notes, "prz"));
  const przTouched = parseBool(noteValue(notes, "przTouched") ?? noteValue(notes, "przTouch"));
  const xabcdValid = parseBool(noteValue(notes, "xabcdValid") ?? noteValue(notes, "xabcd"));
  const closeState = noteValue(notes, "closeState") ?? (candleState ? candleState.toUpperCase() : null);

  let family = familyHint;
  if (patternType && GEOMETRIC_TYPES.has(patternType)) family = "GEOMETRIC";
  else if (patternType && HARMONIC_TYPES.has(patternType)) family = "HARMONIC";
  else if (noteValue(notes, "family") === "GEOMETRIC") family = "GEOMETRIC";
  else if (noteValue(notes, "family") === "HARMONIC") family = "HARMONIC";

  return {
    family,
    patternType,
    patternId,
    orientation,
    confirmationDirection,
    confirmationMet,
    sourceLifecycle,
    completionState: mapCompletionState(
      sourceLifecycle,
      completionRaw,
      confirmationMet,
      przTouched,
    ),
    przValid,
    przTouched,
    xabcdValid,
    candleState: closeState,
    symbol: noteValue(notes, "symbol") ?? noteValue(notes, "instrument"),
    timeframe: noteValue(notes, "timeframe") ?? noteValue(notes, "tf"),
    evidenceId,
    detectionIdentity: patternId,
  };
}

function fromGeometricDetection(
  d: MifChartPatternDetection,
  evidenceId: string | null,
): ResolvedPattern {
  return {
    family: "GEOMETRIC",
    patternType: d.patternType,
    patternId: d.detectionIdentity,
    orientation: null,
    confirmationDirection: d.confirmation.direction === "NONE" ? null : d.confirmation.direction,
    confirmationMet: d.confirmation.met,
    sourceLifecycle: d.lifecycle,
    completionState: mapCompletionState(
      d.lifecycle,
      null,
      d.confirmation.met,
      null,
    ),
    przValid: null,
    przTouched: null,
    xabcdValid: null,
    candleState: d.confirmation.candleState,
    symbol: null,
    timeframe: null,
    evidenceId,
    detectionIdentity: d.detectionIdentity,
  };
}

function fromHarmonicDetection(
  d: MifHarmonicDetection,
  evidenceId: string | null,
): ResolvedPattern {
  const przOk =
    d.prz.low != null
    && d.prz.high != null
    && d.prz.convergenceOk
    && d.prz.analyticalReferenceOnly === true;
  const xabcdOk =
    d.pivots.length === 5
    && d.pivots.every((p) => p.role === "X" || p.role === "A" || p.role === "B" || p.role === "C" || p.role === "D")
    && d.allRequiredRatiosPassed;

  return {
    family: "HARMONIC",
    patternType: d.patternType,
    patternId: d.detectionIdentity,
    orientation: d.orientation,
    confirmationDirection: null,
    confirmationMet: d.lifecycle === "CONFIRMED",
    sourceLifecycle: d.lifecycle,
    completionState: mapCompletionState(d.lifecycle, null, d.lifecycle === "CONFIRMED", null),
    przValid: przOk,
    przTouched: null,
    xabcdValid: xabcdOk,
    candleState: null,
    symbol: null,
    timeframe: null,
    evidenceId,
    detectionIdentity: d.detectionIdentity,
  };
}

function resolveDirection(p: ResolvedPattern): MifOpportunityDirection | "CONFLICT" | null {
  const dirs: string[] = [];
  if (p.orientation === "BULLISH" || p.orientation === "BUY" || p.orientation === "UP") {
    dirs.push("BUY");
  }
  if (p.orientation === "BEARISH" || p.orientation === "SELL" || p.orientation === "DOWN") {
    dirs.push("SELL");
  }
  if (
    p.confirmationDirection === "BULLISH"
    || p.confirmationDirection === "BUY"
    || p.confirmationDirection === "UP"
  ) {
    dirs.push("BUY");
  }
  if (
    p.confirmationDirection === "BEARISH"
    || p.confirmationDirection === "SELL"
    || p.confirmationDirection === "DOWN"
  ) {
    dirs.push("SELL");
  }
  if (p.patternType && BULLISH_GEOMETRIC.has(p.patternType) && !dirs.includes("SELL")) {
    dirs.push("BUY");
  }
  if (p.patternType && BEARISH_GEOMETRIC.has(p.patternType) && !dirs.includes("BUY")) {
    dirs.push("SELL");
  }
  // SYMMETRICAL_TRIANGLE and ambiguous cases require explicit orientation/confirmation.
  const uniq = [...new Set(dirs)];
  if (uniq.length === 0) return null;
  if (uniq.length > 1) return "CONFLICT";
  return uniq[0] as MifOpportunityDirection;
}

function collectPatterns(context: MifOpportunityDetectionContext): ResolvedPattern[] {
  const out: ResolvedPattern[] = [];

  const geoEv =
    findEvidenceById(context, "pc.geometric")
    ?? findEvidenceByFamily(context, "GEOMETRIC_PATTERN");
  const harEv =
    findEvidenceById(context, "pc.harmonic")
    ?? findEvidenceByFamily(context, "HARMONIC_PATTERN");

  if (context.chartPatterns?.detections?.length) {
    for (const d of context.chartPatterns.detections) {
      out.push(fromGeometricDetection(d, geoEv?.evidenceId ?? "pc.geometric"));
    }
  }
  if (context.harmonic?.detections?.length) {
    for (const d of context.harmonic.detections) {
      out.push(fromHarmonicDetection(d, harEv?.evidenceId ?? "pc.harmonic"));
    }
  }

  if (isPresentUsable(geoEv) && (!context.chartPatterns?.detections?.length)) {
    out.push(parseNotesPattern(geoEv!.notes, "GEOMETRIC", geoEv!.evidenceId, geoEv!.candleState));
  }
  if (isPresentUsable(harEv) && (!context.harmonic?.detections?.length)) {
    out.push(parseNotesPattern(harEv!.notes, "HARMONIC", harEv!.evidenceId, harEv!.candleState));
  }

  return out;
}

function parseConfluence(
  context: MifOpportunityDetectionContext,
): { grade: string | null; evidenceId: string | null; alone: boolean } {
  const fibEv =
    findEvidenceById(context, "pc.fib")
    ?? findEvidenceByFamily(context, "FIBONACCI");
  let grade: string | null = null;
  if (context.unified?.confluence?.grade) {
    grade = context.unified.confluence.grade;
  } else if (isPresentUsable(fibEv)) {
    grade =
      noteValue(fibEv!.notes, "confluence")
      ?? noteValue(fibEv!.notes, "grade")
      ?? noteValue(fibEv!.notes, "strength")
      ?? "UNSCORED";
  }
  return {
    grade,
    evidenceId: fibEv?.evidenceId ?? null,
    alone: isPresentUsable(fibEv) || !!context.unified?.confluence,
  };
}

function evaluatePatternCompletion(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, [
    "pc.geometric",
    "pc.harmonic",
    "pc.fib",
    "pc.mtf",
    "pc.candle",
  ]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["pc.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks pattern-completion evaluation`,
    };
  }

  if (
    context.dataQualityStatus === "BLOCKED"
    || context.dataQualityStatus === "MISSING"
    || context.dataQualityStatus === "INVALID"
  ) {
    return {
      candidate: null,
      warnings,
      diagnostics: `dataQualityStatus=${context.dataQualityStatus} blocks evaluation`,
    };
  }

  const qualityEv =
    findEvidenceById(context, "pc.quality")
    ?? findEvidenceByFamily(context, "DATA_QUALITY");
  if (qualityEv && (qualityEv.qualityStatus === "BLOCKED" || qualityEv.qualityStatus === "MISSING")) {
    return {
      candidate: null,
      warnings,
      diagnostics: "DATA_QUALITY evidence blocked or missing",
    };
  }
  if (qualityEv?.qualityStatus === "DEGRADED") {
    warnings.push("DATA_QUALITY DEGRADED — retained as warning");
  }

  // Fibonacci / unified confluence alone never creates a candidate.
  const patterns = collectPatterns(context);
  const confluence = parseConfluence(context);
  if (patterns.length === 0) {
    if (confluence.alone) {
      return {
        candidate: null,
        warnings: [...warnings, "Fibonacci/unified confluence alone cannot create a pattern candidate"],
        diagnostics: "Fibonacci confluence alone is not pattern completion",
      };
    }
    return {
      candidate: null,
      warnings,
      diagnostics: "no geometric or harmonic pattern evidence — INSUFFICIENT_EVIDENCE",
    };
  }

  // Prefer the strongest actionable pattern; reject failed/invalidated first.
  const failed = patterns.filter(
    (p) => p.completionState === "FAILED" || p.completionState === "INVALIDATED",
  );
  if (failed.length && patterns.every((p) =>
    p.completionState === "FAILED"
    || p.completionState === "INVALIDATED"
    || p.completionState === "INSUFFICIENT_EVIDENCE"
  )) {
    // Fib cannot upgrade failed/invalidated.
    return {
      candidate: null,
      warnings: [
        ...warnings,
        confluence.alone
          ? "FAILED/INVALIDATED pattern cannot be upgraded by Fibonacci confluence"
          : "pattern FAILED or INVALIDATED",
      ],
      diagnostics: `pattern lifecycle ${failed[0]!.completionState} rejects completion candidate`,
    };
  }

  const actionable = patterns.find((p) =>
    p.completionState === "CONFIRMED"
    || p.completionState === "COMPLETION_REACHED"
    || p.completionState === "APPROACHING_COMPLETION"
    || p.completionState === "FORMING"
  ) ?? patterns[0]!;

  // Missing pattern identity.
  if (!actionable.patternType && !actionable.patternId) {
    return {
      candidate: null,
      warnings: [...warnings, "missing pattern identity"],
      diagnostics: "pattern identity required — do not fabricate",
    };
  }

  // Unsupported family / type.
  if (actionable.family === "UNKNOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: "unsupported or unknown pattern family",
    };
  }
  if (
    actionable.patternType
    && actionable.family === "GEOMETRIC"
    && !GEOMETRIC_TYPES.has(actionable.patternType)
  ) {
    return {
      candidate: null,
      warnings,
      diagnostics: `unsupported geometric patternType=${actionable.patternType}`,
    };
  }
  if (
    actionable.patternType
    && actionable.family === "HARMONIC"
    && !HARMONIC_TYPES.has(actionable.patternType)
  ) {
    return {
      candidate: null,
      warnings,
      diagnostics: `unsupported harmonic patternType=${actionable.patternType}`,
    };
  }

  if (
    actionable.completionState === "FAILED"
    || actionable.completionState === "INVALIDATED"
  ) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        confluence.alone
          ? "FAILED/INVALIDATED pattern cannot be upgraded by Fibonacci confluence"
          : `pattern ${actionable.completionState}`,
      ],
      diagnostics: `pattern ${actionable.completionState} — no completion candidate`,
    };
  }

  if (actionable.completionState === "INSUFFICIENT_EVIDENCE") {
    return {
      candidate: null,
      warnings,
      diagnostics: "unknown lifecycle — INSUFFICIENT_EVIDENCE",
    };
  }

  // Harmonic-specific gates.
  if (actionable.family === "HARMONIC") {
    if (actionable.xabcdValid === false) {
      return {
        candidate: null,
        warnings: [...warnings, "missing or invalid XABCD points"],
        diagnostics: "harmonic XABCD identity invalid — ratios not fabricated",
      };
    }
    if (actionable.przValid === false) {
      return {
        candidate: null,
        warnings: [...warnings, "missing or malformed PRZ evidence"],
        diagnostics: "harmonic PRZ invalid — not fabricated",
      };
    }
    // If notes omit xabcd/prz flags entirely, require at least pattern type + lifecycle.
    if (
      actionable.xabcdValid == null
      && actionable.przValid == null
      && !context.harmonic?.detections?.length
      && noteValue(
        findEvidenceById(context, "pc.harmonic")?.notes
          ?? findEvidenceByFamily(context, "HARMONIC_PATTERN")?.notes,
        "requireXabcd",
      ) === "TRUE"
    ) {
      return {
        candidate: null,
        warnings: [...warnings, "XABCD validation required but absent"],
        diagnostics: "missing XABCD validation evidence",
      };
    }
  }

  // Instrument / timeframe mismatch.
  if (
    actionable.symbol
    && context.providerSymbol
    && actionable.symbol !== context.providerSymbol.toUpperCase()
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "instrument mismatch"],
      diagnostics:
        `pattern symbol=${actionable.symbol} != providerSymbol=${context.providerSymbol}`,
    };
  }
  const candleEv =
    findEvidenceById(context, "pc.candle")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  const patternTf = actionable.timeframe;
  const candleTf = candleEv?.timeframe?.toUpperCase() ?? null;
  if (patternTf && candleTf && patternTf !== candleTf) {
    return {
      candidate: null,
      warnings: [...warnings, "timeframe mismatch"],
      diagnostics: `pattern tf=${patternTf} != candle tf=${candleTf}`,
    };
  }

  const direction = resolveDirection(actionable);
  if (direction === "CONFLICT") {
    return {
      candidate: null,
      warnings: [...warnings, "conflicting pattern direction"],
      diagnostics: "orientation conflicts with confirmation direction — not guessed",
    };
  }
  if (!direction) {
    return {
      candidate: null,
      warnings: [...warnings, "missing pattern direction"],
      diagnostics: "pattern direction missing or unsupported",
    };
  }

  // FORMING without approach/completion overlay → no candidate.
  if (actionable.completionState === "FORMING") {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING pattern cannot create a confirmed candidate"],
      diagnostics: "FORMING ≠ CONFIRMED pattern completion",
    };
  }

  // Candle confirmation gates.
  if (
    candleEv?.candleState === "FORMING"
    || noteValue(candleEv?.notes, "closeState") === "FORMING"
    || actionable.candleState === "FORMING"
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING candle cannot confirm pattern completion"],
      diagnostics: "FORMING candle is not CLOSED confirmation",
    };
  }
  if (candleEv?.candleState === "STALE" || actionable.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "STALE candle cannot confirm"],
      diagnostics: "stale candle rejected",
    };
  }
  if (
    candleEv
    && (candleEv.qualityStatus === "INVALID" || candleEv.qualityStatus === "MISSING")
  ) {
    return {
      candidate: null,
      warnings,
      diagnostics: "confirmation candle invalid/missing",
    };
  }

  const closed =
    actionable.candleState === "CLOSED"
    || candleEv?.candleState === "CLOSED"
    || noteValue(candleEv?.notes, "closeState") === "CLOSED"
    || (actionable.completionState === "CONFIRMED" && actionable.confirmationMet === true);

  // APPROACHING / COMPLETION_REACHED without confirmation → NEEDS_CONFIRMATION.
  const needsConfirmByLifecycle =
    actionable.completionState === "APPROACHING_COMPLETION"
    || actionable.completionState === "COMPLETION_REACHED"
    || actionable.przTouched === true
    || actionable.confirmationMet === false
    || !closed;

  // MTF handling.
  if (mtf.status === "INSUFFICIENT_DATA") {
    warnings.push("MTF INSUFFICIENT_DATA retained");
  }
  if (mtf.relation === "UNKNOWN" && mtf.source === "absent") {
    warnings.push("MTF UNKNOWN/absent — optional");
  }

  const mtfEv =
    findEvidenceById(context, "pc.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  const conflictingEvidenceIds: string[] = [];
  const mtfNeedsConfirmation =
    mtf.hasConflict
    || mtf.relation === "CONFLICT"
    || mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "PARTIAL_ALIGNMENT"
    || mtf.relation === "TRANSITION"
    || mtf.status === "INSUFFICIENT_DATA";
  if (mtfNeedsConfirmation && mtfEv) {
    conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`MTF relation=${mtf.relation} status=${mtf.status ?? "n/a"} retained`);
  }
  const htfConflict =
    (direction === "BUY" && mtf.higherDirection === "DOWN")
    || (direction === "SELL" && mtf.higherDirection === "UP");
  if (htfConflict) {
    if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId)) {
      conflictingEvidenceIds.push(mtfEv.evidenceId);
    }
    warnings.push("higher-timeframe direction conflicts with pattern side");
  }

  if (confluence.grade) {
    warnings.push(
      `Fibonacci/unified confluence=${confluence.grade} is supporting only — not proof or win probability`,
    );
  }

  // Unified assessment must not be mutated — we only read.
  if (context.unified) {
    warnings.push("unified chart analysis consumed read-only");
  }

  const status =
    needsConfirmByLifecycle
    || mtfNeedsConfirmation
    || htfConflict
    || actionable.completionState !== "CONFIRMED"
      ? "NEEDS_CONFIRMATION"
      : "DETECTED";

  // Strict: DETECTED only when CONFIRMED + CLOSED + no MTF soft conflicts.
  if (
    actionable.completionState === "CONFIRMED"
    && closed
    && !mtfNeedsConfirmation
    && !htfConflict
  ) {
    // status already DETECTED unless needsConfirmByLifecycle (false when confirmed+closed)
  }

  const supportingEvidenceIds: string[] = [];
  for (const id of [
    qualityEv?.evidenceId,
    actionable.evidenceId,
    confluence.evidenceId,
    candleEv?.evidenceId,
    mtfEv?.evidenceId,
    findEvidenceById(context, "pc.geometric")?.evidenceId,
    findEvidenceById(context, "pc.harmonic")?.evidenceId,
  ]) {
    if (id && isPresentUsable(findEvidenceById(context, id)) && !supportingEvidenceIds.includes(id)) {
      supportingEvidenceIds.push(id);
    }
  }

  const thesis =
    direction === "BUY"
      ? `Potential bullish ${actionable.family.toLowerCase()} pattern completion (${actionable.patternType ?? actionable.patternId})`
      : `Potential bearish ${actionable.family.toLowerCase()} pattern completion (${actionable.patternType ?? actionable.patternId})`;

  const rationale = [
    `Pattern family=${actionable.family} type=${actionable.patternType} id=${actionable.patternId ?? actionable.detectionIdentity} sourceLifecycle=${actionable.sourceLifecycle} completionState=${actionable.completionState}.`,
    `Orientation=${actionable.orientation} confirmDir=${actionable.confirmationDirection} confirmMet=${actionable.confirmationMet}.`,
    actionable.family === "HARMONIC"
      ? `Harmonic xabcdValid=${actionable.xabcdValid} przValid=${actionable.przValid} przTouched=${actionable.przTouched} (ratios/PRZ from source only — not recalculated).`
      : "Geometric boundaries/invalidation retained from source assessment notes.",
    confluence.grade
      ? `Confluence=${confluence.grade} (supporting only).`
      : "No Fibonacci confluence supplied.",
    mtf.source !== "absent" ? `MTF relation=${mtf.relation}.` : "MTF optional evidence not supplied.",
    "FORMING ≠ CONFIRMED. FAILED/INVALIDATED never create candidates. Fib alone never creates a candidate. Not a win probability.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_PATTERN_COMPLETION_DETECTOR_ID,
    detectorVersion: MIF_PATTERN_COMPLETION_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["pc.lifecycle_confirm"],
    invalidationConditions: ["pc.pattern_invalidated"],
    knownLimitations: [
      "Does not re-detect patterns — references Phase 5C geometric/harmonic assessments and evidence notes only.",
      "Does not fabricate PRZ, Fibonacci ratios, XABCD points, or pattern direction.",
      "Fibonacci/unified confluence is supporting evidence only — not proof of reversal.",
      "Analytical candidate only — not executable; not a win probability.",
    ],
    timeframeRoles: ["SETUP_DEVELOPMENT", "LOWER_TIMEFRAME_CONFIRMATION"],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics:
      `pattern-completion candidate direction=${direction} status=${status} state=${actionable.completionState} type=${actionable.patternType}`,
  };
}

export const mifPatternCompletionDetector: MifOpportunityDetector = {
  detectorId: MIF_PATTERN_COMPLETION_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_PATTERN_COMPLETION_DETECTOR_VERSION,
  policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
  availabilityStatus: "ACTIVE",
  supportedTimeframeRoles: [
    "PRIMARY_DIRECTION",
    "INTERMEDIATE_STRUCTURE",
    "SETUP_DEVELOPMENT",
    "OPPORTUNITY_FORMATION",
    "LOWER_TIMEFRAME_CONFIRMATION",
  ],
  supportedSymbols: null,
  notes:
    "Phase 5D Step 11 — pattern completion from Phase 5C geometric/harmonic evidence; CLOSED confirmation; no pattern engine duplication.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluatePatternCompletion,
};
