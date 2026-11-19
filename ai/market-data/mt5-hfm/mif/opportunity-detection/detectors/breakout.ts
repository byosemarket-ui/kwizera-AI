/**
 * Phase 5D Step 5 — Breakout Detector.
 * Distinguishes meaningful CLOSED breaks beyond validated boundaries from wicks / false breakouts.
 * SUPPORT_RESISTANCE remains PARTIAL — boundary identity comes from evidence refs/notes, not a new S/R engine.
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_BREAKOUT_DETECTOR_ID,
  MIF_BREAKOUT_DETECTOR_VERSION,
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

const STRATEGY_ID = "BREAKOUT" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

const BULLISH_BOUNDARIES = new Set(["RESISTANCE", "RANGE_CEILING", "UPPER"]);
const BEARISH_BOUNDARIES = new Set(["SUPPORT", "RANGE_FLOOR", "LOWER"]);

function parseBoundary(notes: string | undefined): {
  kind: string | null;
  quality: string | null;
  invalid: boolean;
  meaningful: boolean;
  fibonacciSource: boolean;
} {
  const kind = noteValue(notes, "boundaryKind") ?? noteValue(notes, "kind");
  const quality = noteValue(notes, "boundaryQuality") ?? noteValue(notes, "quality") ?? "VALID";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || noteValue(notes, "invalid") === "TRUE";
  const meaningful =
    !!kind
    && !invalid
    && quality !== "ARBITRARY"
    && noteValue(notes, "arbitrary") !== "TRUE";
  const fibonacciSource = noteValue(notes, "source") === "FIBONACCI";
  return { kind, quality, invalid, meaningful, fibonacciSource };
}

function parseDisplacement(notes: string | undefined): {
  excursion: string | null;
  side: string | null;
  closeState: string | null;
  accepted: boolean | null;
  returnedInside: boolean;
} {
  const excursion = noteValue(notes, "excursion");
  const side = noteValue(notes, "side");
  const closeState = noteValue(notes, "closeState");
  const acceptedRaw = noteValue(notes, "accepted");
  const accepted = acceptedRaw === "TRUE" ? true : acceptedRaw === "FALSE" ? false : null;
  const returnedInside =
    excursion === "RETURNED_INSIDE"
    || excursion === "FAILED"
    || noteValue(notes, "returnedInside") === "TRUE";
  return { excursion, side, closeState, accepted, returnedInside };
}

function resolveDirection(
  boundaryKind: string | null,
  side: string | null,
): MifOpportunityDirection {
  if (side === "ABOVE") return "BUY";
  if (side === "BELOW") return "SELL";
  if (boundaryKind && BULLISH_BOUNDARIES.has(boundaryKind)) return "BUY";
  if (boundaryKind && BEARISH_BOUNDARIES.has(boundaryKind)) return "SELL";
  return "UNKNOWN";
}

function evaluateBreakout(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, ["bo.vol", "bo.mtf"]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["bo.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks breakout evaluation`,
    };
  }

  const boundaryEv =
    findEvidenceById(context, "bo.boundary")
    ?? findEvidenceByFamily(context, "SUPPORT_RESISTANCE");
  if (!isPresentUsable(boundaryEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "boundary (SUPPORT_RESISTANCE) evidence absent or unusable",
    };
  }
  if (boundaryEv!.candleState === "STALE") {
    warnings.push("boundary tip candle STALE");
  }
  if (boundaryEv!.qualityStatus === "DEGRADED") {
    warnings.push("boundary evidence quality DEGRADED (S/R is PARTIAL in MIF)");
  }

  const boundary = parseBoundary(boundaryEv!.notes);
  if (boundary.invalid || !boundary.meaningful) {
    return {
      candidate: null,
      warnings: [...warnings, "boundary not meaningful or marked invalid/arbitrary"],
      diagnostics: `invalid or non-meaningful boundary kind=${boundary.kind} quality=${boundary.quality}`,
    };
  }
  if (boundary.fibonacciSource) {
    return {
      candidate: null,
      warnings: [...warnings, "Fibonacci-only boundary rejected"],
      diagnostics: "Fibonacci levels alone are not breakout boundaries",
    };
  }

  const displacementEv =
    findEvidenceById(context, "bo.displacement")
    ?? findEvidenceByFamily(context, "PRICE_DISPLACEMENT");
  if (!isPresentUsable(displacementEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "price displacement evidence absent or unusable",
    };
  }
  if (displacementEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "displacement evidence STALE"],
      diagnostics: "stale displacement evidence blocks breakout confirmation",
    };
  }

  const displacement = parseDisplacement(displacementEv!.notes);

  if (displacement.returnedInside || displacement.accepted === false) {
    return {
      candidate: null,
      warnings: [...warnings, "price returned inside boundary / acceptance failed — false breakout risk"],
      diagnostics: "false breakout or rejection — not a confirmed breakout candidate",
    };
  }

  if (displacement.excursion === "WICK_ONLY") {
    return {
      candidate: null,
      warnings: [...warnings, "wick beyond boundary without confirming close"],
      diagnostics: "wick-only excursion is not a confirmed breakout",
    };
  }

  if (displacement.closeState === "FORMING" || displacementEv!.candleState === "FORMING") {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING candle beyond boundary is not CLOSED confirmation"],
      diagnostics: "FORMING candle cannot confirm breakout",
    };
  }

  if (displacement.excursion === "INSIDE" || !displacement.excursion) {
    return {
      candidate: null,
      warnings,
      diagnostics: "price remains inside boundary — no breakout",
    };
  }

  if (displacement.excursion !== "BEYOND" && displacement.excursion !== "ACCEPTED") {
    return {
      candidate: null,
      warnings,
      diagnostics: `unsupported excursion=${displacement.excursion}`,
    };
  }

  const closedBeyond =
    (displacement.closeState === "CLOSED" || displacementEv!.candleState === "CLOSED")
    && (displacement.excursion === "BEYOND" || displacement.excursion === "ACCEPTED");

  if (!closedBeyond) {
    return {
      candidate: null,
      warnings: [...warnings, "missing CLOSED close beyond boundary"],
      diagnostics: "closed-candle confirmation beyond boundary required",
    };
  }

  const direction = resolveDirection(boundary.kind, displacement.side);
  if (direction === "UNKNOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: "breakout direction cannot be resolved from boundary/side evidence",
    };
  }

  const regimeSupports =
    regime.structure === "BREAKOUT"
    || regime.structure === "RANGING"
    || regime.structure === "TRENDING"
    || regime.structure === "TRANSITION";
  if (!regimeSupports) {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime structure ${regime.structure} does not support breakout hypothesis`,
    };
  }

  // TRANSITION alone never establishes breakout — closed beyond already required above.
  if (regime.structure === "TRANSITION" && !context.regime?.breakoutEvidence) {
    warnings.push("TRANSITION regime alone is not breakout confirmation");
  }

  const geoEv = findEvidenceByFamily(context, "GEOMETRIC_PATTERN");
  let patternConfirmed = false;
  if (isPresentUsable(geoEv)) {
    const life = noteValue(geoEv!.notes, "lifecycle");
    const bias = noteValue(geoEv!.notes, "bias") ?? noteValue(geoEv!.notes, "breakoutDirection");
    if (life === "FAILED" || life === "INVALIDATED") {
      warnings.push("failed/invalidated pattern present — not used as breakout confirmation");
    } else if (life === "FORMING") {
      warnings.push("FORMING pattern cannot confirm breakout");
    } else if (life === "CONFIRMED") {
      if ((direction === "BUY" && bias === "BULLISH") || (direction === "SELL" && bias === "BEARISH")) {
        patternConfirmed = true;
      }
    }
  }

  if (context.regime?.breakoutEvidence?.state === "FAILED") {
    return {
      candidate: null,
      warnings: [...warnings, "regime breakoutEvidence state=FAILED"],
      diagnostics: "regime marks breakout as FAILED — no candidate",
    };
  }
  const regimeBreakoutConfirmed = context.regime?.breakoutEvidence?.state === "CONFIRMED";

  const structureEv = findEvidenceByFamily(context, "MARKET_STRUCTURE");
  const mtfEv =
    findEvidenceById(context, "bo.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");

  const conflictingEvidenceIds: string[] = [];
  if (mtf.hasConflict || mtf.relation === "CONFLICT" || mtf.relation === "PARTIAL_ALIGNMENT") {
    if (mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`conflicting/partial MTF retained: ${mtf.relation}`);
  }
  const htfConflict =
    (direction === "BUY" && mtf.higherDirection === "DOWN")
    || (direction === "SELL" && mtf.higherDirection === "UP");
  if (htfConflict) {
    if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId)) {
      conflictingEvidenceIds.push(mtfEv.evidenceId);
    }
    warnings.push("higher-timeframe direction conflicts with breakout side");
  }

  const stronglyConfirmed =
    closedBeyond
    && (
      regimeBreakoutConfirmed
      || patternConfirmed
      || regime.structure === "BREAKOUT"
      || displacement.accepted === true
      || displacement.excursion === "ACCEPTED"
      || (isPresentUsable(structureEv) && noteValue(structureEv!.notes, "break") === "BOS")
    );

  // HTF conflict without regime-confirmed breakout → NEEDS_CONFIRMATION
  const status =
    !stronglyConfirmed || (htfConflict && !regimeBreakoutConfirmed)
      ? "NEEDS_CONFIRMATION"
      : "DETECTED";

  if (!stronglyConfirmed) {
    warnings.push("breakout hypothesis lacks strong acceptance/regime/pattern confirmation");
  }

  const supportingEvidenceIds = ["bo.regime", "bo.boundary", "bo.displacement", "bo.quality"].filter(
    (id) => isPresentUsable(findEvidenceById(context, id)) || id === "bo.quality",
  );
  for (const e of [boundaryEv, displacementEv, structureEv, mtfEv]) {
    if (e && isPresentUsable(e) && !supportingEvidenceIds.includes(e.evidenceId)) {
      supportingEvidenceIds.push(e.evidenceId);
    }
  }

  const thesis =
    direction === "BUY"
      ? "Potential bullish breakout beyond resistance/range ceiling"
      : "Potential bearish breakout beyond support/range floor";
  const rationale = [
    `Boundary kind=${boundary.kind} quality=${boundary.quality} (S/R PARTIAL in MIF).`,
    `Displacement excursion=${displacement.excursion} side=${displacement.side} closeState=${displacement.closeState}.`,
    `Regime structure=${regime.structure} direction=${regime.direction}.`,
    mtf.source !== "absent" ? `MTF relation=${mtf.relation}.` : "MTF optional evidence not supplied.",
    "Wick-only / FORMING / returned-inside never confirm.",
    "Does not claim continuation or win probability.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_BREAKOUT_DETECTOR_ID,
    detectorVersion: MIF_BREAKOUT_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["bo.closed_beyond"],
    invalidationConditions: ["bo.failed_breakout"],
    knownLimitations: [
      "SUPPORT_RESISTANCE evidence is PARTIAL (structure zones / pattern boundaries).",
      "Does not treat a single wick as confirmed breakout.",
      "HFM tick volume is not centralized global FX volume if used later.",
      "Analytical candidate only — not executable.",
    ],
    timeframeRoles: ["INTERMEDIATE_STRUCTURE", "OPPORTUNITY_FORMATION"],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics: `breakout candidate direction=${direction} status=${status} boundary=${boundary.kind}`,
  };
}

export const mifBreakoutDetector: MifOpportunityDetector = {
  detectorId: MIF_BREAKOUT_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_BREAKOUT_DETECTOR_VERSION,
  policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
  availabilityStatus: "ACTIVE",
  supportedTimeframeRoles: [
    "INTERMEDIATE_STRUCTURE",
    "OPPORTUNITY_FORMATION",
    "LOWER_TIMEFRAME_CONFIRMATION",
    "OPTIONAL_ENTRY_REFINEMENT",
  ],
  supportedSymbols: null,
  notes: "Phase 5D Step 5 — breakout; rejects wick-only/false breakouts; analytical only.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateBreakout,
};
