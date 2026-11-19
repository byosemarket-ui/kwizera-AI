/**
 * Phase 5D Step 6 — Breakout Retest Detector.
 * Requires a prior confirmed breakout linked to the same boundary identity being retested.
 * SUPPORT_RESISTANCE / boundary identity remain PARTIAL (notes-based); no new S/R engine.
 * Independent of STEP 5 BREAKOUT detector — separate strategy and candidate identity.
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_BREAKOUT_RETEST_DETECTOR_ID,
  MIF_BREAKOUT_RETEST_DETECTOR_VERSION,
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

const STRATEGY_ID = "BREAKOUT_RETEST" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

const BULLISH_PRIOR_KINDS = new Set(["RESISTANCE", "RANGE_CEILING", "UPPER"]);
const BEARISH_PRIOR_KINDS = new Set(["SUPPORT", "RANGE_FLOOR", "LOWER"]);

function parsePriorBreakout(notes: string | undefined): {
  state: string | null;
  direction: MifOpportunityDirection;
  boundaryId: string | null;
  boundaryKind: string | null;
  invalidated: boolean;
} {
  const state =
    noteValue(notes, "breakoutState")
    ?? noteValue(notes, "state");
  const dirRaw =
    noteValue(notes, "breakoutDirection")
    ?? noteValue(notes, "direction");
  let direction: MifOpportunityDirection = "UNKNOWN";
  if (dirRaw === "UP" || dirRaw === "BUY" || dirRaw === "BULLISH") direction = "BUY";
  if (dirRaw === "DOWN" || dirRaw === "SELL" || dirRaw === "BEARISH") direction = "SELL";
  const boundaryId = noteValue(notes, "boundaryId");
  const boundaryKind = noteValue(notes, "boundaryKind") ?? noteValue(notes, "kind");
  const invalidated =
    state === "INVALIDATED"
    || state === "FAILED"
    || noteValue(notes, "invalidated") === "TRUE";
  return { state, direction, boundaryId, boundaryKind, invalidated };
}

function parseBoundary(notes: string | undefined): {
  boundaryId: string | null;
  kind: string | null;
  quality: string | null;
  invalid: boolean;
  retestPhase: string | null;
} {
  const boundaryId = noteValue(notes, "boundaryId");
  const kind = noteValue(notes, "boundaryKind") ?? noteValue(notes, "kind");
  const quality = noteValue(notes, "boundaryQuality") ?? noteValue(notes, "quality") ?? "VALID";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || noteValue(notes, "invalid") === "TRUE";
  const retestPhase = noteValue(notes, "retestPhase");
  return { boundaryId, kind, quality, invalid, retestPhase };
}

function parseCandle(notes: string | undefined): {
  retestResult: string | null;
  closeState: string | null;
  accepted: boolean | null;
  side: string | null;
} {
  const retestResult =
    noteValue(notes, "retestResult")
    ?? noteValue(notes, "result");
  const closeState = noteValue(notes, "closeState");
  const acceptedRaw = noteValue(notes, "accepted");
  const accepted = acceptedRaw === "TRUE" ? true : acceptedRaw === "FALSE" ? false : null;
  const side = noteValue(notes, "side");
  return { retestResult, closeState, accepted, side };
}

function resolveDirectionFromPrior(
  priorDirection: MifOpportunityDirection,
  boundaryKind: string | null,
): MifOpportunityDirection {
  if (priorDirection === "BUY" || priorDirection === "SELL") return priorDirection;
  if (boundaryKind && BULLISH_PRIOR_KINDS.has(boundaryKind)) return "BUY";
  if (boundaryKind && BEARISH_PRIOR_KINDS.has(boundaryKind)) return "SELL";
  return "UNKNOWN";
}

function evaluateBreakoutRetest(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, ["brt.mtf"]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["brt.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks breakout-retest evaluation`,
    };
  }

  // --- Prior breakout (required) ---
  const priorEv =
    findEvidenceById(context, "brt.prior_breakout")
    ?? findEvidenceByFamily(context, "MARKET_REGIME");
  if (!isPresentUsable(priorEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "prior breakout evidence absent or unusable — retest requires a confirmed prior breakout",
    };
  }
  if (priorEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "prior breakout evidence STALE"],
      diagnostics: "stale prior breakout evidence rejected",
    };
  }

  const priorFromNotes = parsePriorBreakout(priorEv!.notes);
  const regimeBo = context.regime?.breakoutEvidence ?? null;

  // Prefer explicit evidence notes; enrich from regime assessment when present.
  let priorState = priorFromNotes.state;
  let priorDirection = priorFromNotes.direction;
  let priorBoundaryId = priorFromNotes.boundaryId;
  let priorBoundaryKind = priorFromNotes.boundaryKind;
  let priorInvalidated = priorFromNotes.invalidated;

  if (regimeBo) {
    if (!priorState && regimeBo.state) priorState = String(regimeBo.state).toUpperCase();
    if (priorDirection === "UNKNOWN") {
      if (regimeBo.direction === "UP") priorDirection = "BUY";
      else if (regimeBo.direction === "DOWN") priorDirection = "SELL";
    }
    if (regimeBo.state === "FAILED" || regimeBo.state === "NONE") {
      priorInvalidated = priorInvalidated || regimeBo.state === "FAILED";
    }
  }

  if (priorInvalidated || priorState === "FAILED" || priorState === "INVALIDATED") {
    return {
      candidate: null,
      warnings: [...warnings, "prior breakout invalidated or failed — not a retest setup"],
      diagnostics: `prior breakout state=${priorState ?? "UNKNOWN"} blocks retest`,
    };
  }

  // Unconfirmed / absent prior breakout cannot complete a retest (catalog note).
  // Explicit POTENTIAL/NONE in notes is never upgraded by regime alone.
  if (priorState === "POTENTIAL" || priorState === "NONE") {
    return {
      candidate: null,
      warnings: [...warnings, "unconfirmed prior breakout — retest rejected"],
      diagnostics: `prior breakout state=${priorState} is not CONFIRMED`,
    };
  }
  const regimeConfirmed = regimeBo?.state === "CONFIRMED";
  if (priorState !== "CONFIRMED") {
    if (priorState == null && regimeConfirmed) {
      priorState = "CONFIRMED";
      warnings.push("prior breakout CONFIRMED via regime.breakoutEvidence (notes state absent)");
    } else {
      return {
        candidate: null,
        warnings: [...warnings, "unconfirmed or missing prior breakout — retest rejected"],
        diagnostics: `prior breakout state=${priorState ?? "MISSING"} is not CONFIRMED`,
      };
    }
  }

  priorDirection = resolveDirectionFromPrior(priorDirection, priorBoundaryKind);
  if (priorDirection === "UNKNOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: "prior breakout direction cannot be resolved",
    };
  }

  // Boundary identity is PARTIAL — require an explicit boundaryId for linkage.
  if (!priorBoundaryId) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "prior breakout missing boundaryId — cannot link retest to broken boundary (S/R PARTIAL)",
      ],
      diagnostics: "missing prior boundary identity — no fabricated historical linkage",
    };
  }

  // --- Boundary under retest (required) ---
  const boundaryEv =
    findEvidenceById(context, "brt.boundary")
    ?? findEvidenceByFamily(context, "SUPPORT_RESISTANCE");
  if (!isPresentUsable(boundaryEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "retest boundary (SUPPORT_RESISTANCE) evidence absent or unusable",
    };
  }
  if (boundaryEv!.candleState === "STALE") {
    warnings.push("boundary tip candle STALE");
  }
  if (boundaryEv!.qualityStatus === "DEGRADED") {
    warnings.push("boundary evidence quality DEGRADED (S/R is PARTIAL in MIF)");
  }

  const boundary = parseBoundary(boundaryEv!.notes);
  if (boundary.invalid) {
    return {
      candidate: null,
      warnings: [...warnings, "retest boundary marked invalid"],
      diagnostics: `invalid boundary quality=${boundary.quality}`,
    };
  }
  if (!boundary.boundaryId) {
    return {
      candidate: null,
      warnings: [...warnings, "retest boundary missing boundaryId"],
      diagnostics: "missing retest boundary identity",
    };
  }
  if (boundary.boundaryId !== priorBoundaryId) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        `boundary identity mismatch prior=${priorBoundaryId} retest=${boundary.boundaryId}`,
      ],
      diagnostics: "retest boundary is not the same boundary as the prior breakout",
    };
  }
  // Optional kind continuity check when both sides declare kind.
  if (
    priorBoundaryKind
    && boundary.kind
    && priorBoundaryKind !== boundary.kind
  ) {
    warnings.push(
      `boundary kind differs prior=${priorBoundaryKind} retest=${boundary.kind} — identity still matched by boundaryId`,
    );
  }

  if (boundary.retestPhase === "RECLAIMED" || boundary.retestPhase === "FAILED") {
    return {
      candidate: null,
      warnings: [...warnings, "boundary reclaimed / retest failed against breakout direction"],
      diagnostics: `retestPhase=${boundary.retestPhase} — failed retest, not a candidate`,
    };
  }

  // --- Candle / retest confirmation (required) ---
  const candleEv =
    findEvidenceById(context, "brt.candle")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  if (!isPresentUsable(candleEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "retest candle confirmation evidence absent or unusable",
    };
  }
  if (candleEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "retest candle evidence STALE"],
      diagnostics: "stale retest candle evidence rejected",
    };
  }

  const candle = parseCandle(candleEv!.notes);
  const forming =
    candle.closeState === "FORMING"
    || candleEv!.candleState === "FORMING";

  if (
    candle.retestResult === "FAILED"
    || candle.retestResult === "RECLAIM"
    || candle.accepted === false
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "retest failed or boundary reclaimed on candle evidence"],
      diagnostics: `retestResult=${candle.retestResult} accepted=${candle.accepted} — failed retest`,
    };
  }

  // Simple touch / approaching without rejection or acceptance is not confirmation.
  const touchOnly =
    candle.retestResult === "TOUCH"
    || candle.retestResult === "APPROACHING"
    || boundary.retestPhase === "APPROACHING"
    || (!candle.retestResult && candle.accepted == null);

  if (forming) {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING candle at boundary is not CLOSED retest confirmation"],
      diagnostics: "FORMING candle cannot confirm breakout retest",
    };
  }

  if (touchOnly) {
    return {
      candidate: null,
      warnings: [...warnings, "boundary touch without CLOSED rejection/acceptance"],
      diagnostics: "touch-only retest is not a confirmed retest candidate",
    };
  }

  const closed =
    candle.closeState === "CLOSED"
    || candleEv!.candleState === "CLOSED";
  if (!closed) {
    return {
      candidate: null,
      warnings: [...warnings, "missing CLOSED candle confirmation at retest"],
      diagnostics: "closed-candle retest hold/rejection required",
    };
  }

  const bullishHold =
    priorDirection === "BUY"
    && (
      candle.retestResult === "HOLD"
      || candle.retestResult === "REJECT_UP"
      || candle.retestResult === "ACCEPTED"
      || (candle.accepted === true && (candle.side === "ABOVE" || candle.side == null))
    );
  const bearishHold =
    priorDirection === "SELL"
    && (
      candle.retestResult === "HOLD"
      || candle.retestResult === "REJECT_DOWN"
      || candle.retestResult === "ACCEPTED"
      || (candle.accepted === true && (candle.side === "BELOW" || candle.side == null))
    );

  if (!bullishHold && !bearishHold) {
    return {
      candidate: null,
      warnings,
      diagnostics:
        `retestResult=${candle.retestResult} does not confirm hold/rejection for direction=${priorDirection}`,
    };
  }

  // Regime compatibility: BREAKOUT / TRENDING / TRANSITION (catalog).
  const regimeSupports =
    regime.structure === "BREAKOUT"
    || regime.structure === "TRENDING"
    || regime.structure === "TRANSITION";
  if (!regimeSupports) {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime structure ${regime.structure} does not support breakout-retest hypothesis`,
    };
  }
  if (regime.structure === "TRANSITION") {
    warnings.push("TRANSITION regime alone is not retest confirmation");
  }

  const mtfEv =
    findEvidenceById(context, "brt.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  const conflictingEvidenceIds: string[] = [];
  if (mtf.hasConflict || mtf.relation === "CONFLICT" || mtf.relation === "PARTIAL_ALIGNMENT") {
    if (mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`conflicting/partial MTF retained: ${mtf.relation}`);
  }
  const htfConflict =
    (priorDirection === "BUY" && mtf.higherDirection === "DOWN")
    || (priorDirection === "SELL" && mtf.higherDirection === "UP");
  if (htfConflict) {
    if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId)) {
      conflictingEvidenceIds.push(mtfEv.evidenceId);
    }
    warnings.push("higher-timeframe direction conflicts with breakout-retest side");
  }
  if (mtf.relation === "POTENTIAL_REVERSAL") {
    if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId)) {
      conflictingEvidenceIds.push(mtfEv.evidenceId);
    }
    warnings.push("MTF POTENTIAL_REVERSAL retained as conflicting evidence");
  }

  const structureEv = findEvidenceByFamily(context, "MARKET_STRUCTURE");
  const strongHold =
    candle.accepted === true
    || candle.retestResult === "HOLD"
    || candle.retestResult === "REJECT_UP"
    || candle.retestResult === "REJECT_DOWN"
    || candle.retestResult === "ACCEPTED";

  const mtfNeedsConfirmation =
    htfConflict
    || mtf.hasConflict
    || mtf.relation === "CONFLICT"
    || mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "PARTIAL_ALIGNMENT";

  const status =
    !strongHold || mtfNeedsConfirmation || regime.structure === "TRANSITION"
      ? "NEEDS_CONFIRMATION"
      : "DETECTED";

  if (!strongHold) {
    warnings.push("retest hold evidence present but not strongly confirmed");
  }

  const supportingEvidenceIds = [
    "brt.prior_breakout",
    "brt.boundary",
    "brt.candle",
    "brt.quality",
  ].filter((id) => isPresentUsable(findEvidenceById(context, id)) || id === "brt.quality");
  for (const e of [priorEv, boundaryEv, candleEv, structureEv, mtfEv]) {
    if (e && isPresentUsable(e) && !supportingEvidenceIds.includes(e.evidenceId)) {
      supportingEvidenceIds.push(e.evidenceId);
    }
  }

  const thesis =
    priorDirection === "BUY"
      ? "Potential bullish breakout retest — former resistance holding as support"
      : "Potential bearish breakout retest — former support holding as resistance";
  const rationale = [
    `Prior breakout state=${priorState} direction=${priorDirection} boundaryId=${priorBoundaryId}.`,
    `Retest boundaryId=${boundary.boundaryId} kind=${boundary.kind} phase=${boundary.retestPhase ?? "n/a"} (S/R PARTIAL).`,
    `Candle retestResult=${candle.retestResult} closeState=${candle.closeState} accepted=${candle.accepted}.`,
    `Regime structure=${regime.structure} direction=${regime.direction}.`,
    mtf.source !== "absent" ? `MTF relation=${mtf.relation}.` : "MTF optional evidence not supplied.",
    "Touch-only / FORMING / failed reclaim never confirm. Does not claim continuation.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_BREAKOUT_RETEST_DETECTOR_ID,
    detectorVersion: MIF_BREAKOUT_RETEST_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction: priorDirection,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["brt.retest_hold"],
    invalidationConditions: ["brt.boundary_reclaim"],
    knownLimitations: [
      "SUPPORT_RESISTANCE / boundary identity is PARTIAL (notes-based boundaryId linkage).",
      "Requires explicit prior CONFIRMED breakout linked by boundaryId — no fabricated history.",
      "Independent of STEP 5 BREAKOUT detector candidates.",
      "Analytical candidate only — not executable; not a win probability.",
    ],
    timeframeRoles: ["INTERMEDIATE_STRUCTURE", "OPPORTUNITY_FORMATION"],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics:
      `breakout-retest candidate direction=${priorDirection} status=${status} boundaryId=${boundary.boundaryId}`,
  };
}

export const mifBreakoutRetestDetector: MifOpportunityDetector = {
  detectorId: MIF_BREAKOUT_RETEST_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_BREAKOUT_RETEST_DETECTOR_VERSION,
  policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
  availabilityStatus: "ACTIVE",
  supportedTimeframeRoles: [
    "INTERMEDIATE_STRUCTURE",
    "OPPORTUNITY_FORMATION",
    "LOWER_TIMEFRAME_CONFIRMATION",
    "OPTIONAL_ENTRY_REFINEMENT",
  ],
  supportedSymbols: null,
  notes:
    "Phase 5D Step 6 — breakout retest; requires prior CONFIRMED breakout + same boundaryId; analytical only.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateBreakoutRetest,
};
