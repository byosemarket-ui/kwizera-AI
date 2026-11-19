/**
 * Phase 5D Step 8 — Liquidity Sweep Opportunity Detector.
 * Excursion beyond a validated swing/structure reference + CLOSED reclaim/rejection.
 * LIQUIDITY_REFERENCE family remains PLANNED — do not fabricate liquidity pools.
 * Distinguishes reclaim (sweep) from acceptance beyond the reference (breakout continuation).
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
  MIF_LIQUIDITY_SWEEP_DETECTOR_VERSION,
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

const STRATEGY_ID = "LIQUIDITY_SWEEP" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

const SELL_SIDE_TYPES = new Set(["SWING_LOW", "EQUAL_LOW", "SUPPORT", "RANGE_FLOOR", "SELL_SIDE"]);
const BUY_SIDE_TYPES = new Set(["SWING_HIGH", "EQUAL_HIGH", "RESISTANCE", "RANGE_CEILING", "BUY_SIDE"]);

function parseReference(notes: string | undefined): {
  refId: string | null;
  refType: string | null;
  refSide: "SELL_SIDE" | "BUY_SIDE" | "UNKNOWN";
  confirmed: boolean;
  arbitrary: boolean;
  invalid: boolean;
  temporalOk: boolean;
} {
  const refId =
    noteValue(notes, "refId")
    ?? noteValue(notes, "referenceId")
    ?? noteValue(notes, "swingId");
  const refType =
    noteValue(notes, "refType")
    ?? noteValue(notes, "swingType")
    ?? noteValue(notes, "type");
  const sideRaw = noteValue(notes, "refSide") ?? noteValue(notes, "side");
  let refSide: "SELL_SIDE" | "BUY_SIDE" | "UNKNOWN" = "UNKNOWN";
  if (sideRaw === "SELL_SIDE" || sideRaw === "SELL") refSide = "SELL_SIDE";
  else if (sideRaw === "BUY_SIDE" || sideRaw === "BUY") refSide = "BUY_SIDE";
  else if (refType && SELL_SIDE_TYPES.has(refType)) refSide = "SELL_SIDE";
  else if (refType && BUY_SIDE_TYPES.has(refType)) refSide = "BUY_SIDE";

  const confirmed =
    noteValue(notes, "confirmed") === "TRUE"
    || noteValue(notes, "swingState") === "CONFIRMED"
    || noteValue(notes, "lifecycle") === "CONFIRMED";
  const quality = noteValue(notes, "refQuality") ?? noteValue(notes, "quality") ?? "VALID";
  const arbitrary =
    noteValue(notes, "arbitrary") === "TRUE"
    || quality === "ARBITRARY";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || noteValue(notes, "invalid") === "TRUE"
    || noteValue(notes, "invalidated") === "TRUE";
  const temporal =
    noteValue(notes, "temporalOrder")
    ?? noteValue(notes, "refEstablished");
  // Absent temporal evidence is allowed; explicit BEFORE/VALID required if present as FAILED/AFTER.
  const temporalOk =
    temporal == null
    || temporal === "VALID"
    || temporal === "BEFORE_SWEEP"
    || temporal === "BEFORE";
  return { refId, refType, refSide, confirmed, arbitrary, invalid, temporalOk };
}

function parseSweepCandle(notes: string | undefined): {
  excursion: string | null;
  reclaim: string | null;
  closeState: string | null;
  accepted: boolean | null;
  reject: string | null;
  sweepPhase: string | null;
} {
  const excursion = noteValue(notes, "excursion");
  const reclaim = noteValue(notes, "reclaim");
  const closeState = noteValue(notes, "closeState");
  const acceptedRaw = noteValue(notes, "accepted");
  const accepted = acceptedRaw === "TRUE" ? true : acceptedRaw === "FALSE" ? false : null;
  const reject =
    noteValue(notes, "reject")
    ?? noteValue(notes, "rejection")
    ?? noteValue(notes, "retestResult");
  const sweepPhase = noteValue(notes, "sweepPhase") ?? noteValue(notes, "phase");
  return { excursion, reclaim, closeState, accepted, reject, sweepPhase };
}

function evaluateLiquiditySweep(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, ["ls.liquidity_ref", "ls.regime"]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["ls.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks liquidity-sweep evaluation`,
    };
  }

  // Optional dedicated liquidity reference — PLANNED; never fabricate from absence.
  const liqRefEv =
    findEvidenceById(context, "ls.liquidity_ref")
    ?? findEvidenceByFamily(context, "LIQUIDITY_REFERENCE");
  if (liqRefEv && !isPresentUsable(liqRefEv)) {
    warnings.push("ls.liquidity_ref present but unusable");
  } else if (liqRefEv && isPresentUsable(liqRefEv)) {
    warnings.push(
      "dedicated LIQUIDITY_REFERENCE present (optional) — still a price-based reference, not proof of resting orders",
    );
  } else {
    warnings.push(
      "LIQUIDITY_REFERENCE family is PLANNED/optional — using MARKET_STRUCTURE swing reference only",
    );
  }

  // --- Structure / swing reference (required) ---
  const structureEv =
    findEvidenceById(context, "ls.structure")
    ?? findEvidenceByFamily(context, "MARKET_STRUCTURE");
  if (!isPresentUsable(structureEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "MARKET_STRUCTURE swing/reference evidence absent or unusable",
    };
  }
  if (structureEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "structure/reference evidence STALE"],
      diagnostics: "stale liquidity reference rejected",
    };
  }
  if (structureEv!.qualityStatus === "DEGRADED") {
    warnings.push("structure reference quality DEGRADED (MARKET_STRUCTURE is PARTIAL)");
  }

  const ref = parseReference(structureEv!.notes);
  if (ref.invalid) {
    return {
      candidate: null,
      warnings: [...warnings, "liquidity/structure reference invalid"],
      diagnostics: "invalid reference rejected",
    };
  }
  if (ref.arbitrary) {
    return {
      candidate: null,
      warnings: [...warnings, "arbitrary high/low without validated reference rejected"],
      diagnostics: "arbitrary reference is not a meaningful liquidity reference",
    };
  }
  if (!ref.refId) {
    return {
      candidate: null,
      warnings: [...warnings, "missing stable reference identity"],
      diagnostics: "reference identity required — do not fabricate liquidity pools",
    };
  }
  if (!ref.confirmed) {
    return {
      candidate: null,
      warnings: [...warnings, "unconfirmed swing/reference — wick-alone is insufficient"],
      diagnostics: "reference must be confirmed before sweep evaluation",
    };
  }
  if (!ref.temporalOk) {
    return {
      candidate: null,
      warnings: [...warnings, "reference temporal order invalid relative to sweep"],
      diagnostics: "reference must exist before the sweep event when temporal order is represented",
    };
  }
  if (ref.refSide === "UNKNOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: "cannot resolve buy-side vs sell-side liquidity reference type",
    };
  }

  // Optional LIQUIDITY_REFERENCE identity continuity when present.
  if (isPresentUsable(liqRefEv)) {
    const liqId = noteValue(liqRefEv!.notes, "refId") ?? noteValue(liqRefEv!.notes, "referenceId");
    if (liqId && liqId !== ref.refId) {
      return {
        candidate: null,
        warnings: [...warnings, `liquidity_ref id mismatch structure=${ref.refId} liq=${liqId}`],
        diagnostics: "optional liquidity_ref does not match structure reference identity",
      };
    }
  }

  // --- Candle: excursion + reclaim (required) ---
  const candleEv =
    findEvidenceById(context, "ls.candle")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  if (!isPresentUsable(candleEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "candle confirmation evidence absent — sweep/reclaim cannot be validated",
    };
  }
  if (candleEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "sweep candle evidence STALE"],
      diagnostics: "stale sweep candle rejected",
    };
  }

  const candle = parseSweepCandle(candleEv!.notes);

  if (candle.closeState === "FORMING" || candleEv!.candleState === "FORMING") {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING candle cannot confirm reclaim"],
      diagnostics: "FORMING candle is not CLOSED reclaim confirmation",
    };
  }

  // Accepted through reference without reclaim = breakout continuation (STEP 5 owns breakouts).
  const acceptedThrough =
    candle.accepted === true
    || candle.sweepPhase === "ACCEPTED"
    || candle.reclaim === "FALSE"
    || noteValue(candleEv!.notes, "acceptedThrough") === "TRUE";

  const reclaimed =
    candle.reclaim === "TRUE"
    || candle.reclaim === "RECLAIMED"
    || candle.sweepPhase === "RECLAIMED"
    || candle.sweepPhase === "CONFIRMED";

  if (acceptedThrough && !reclaimed) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "price accepted beyond reference without reclaim — breakout continuation, not a liquidity sweep",
      ],
      diagnostics: "accepted_through invalidation — not a confirmed sweep",
    };
  }

  if (candle.sweepPhase === "FAILED" || candle.sweepPhase === "INVALIDATED") {
    return {
      candidate: null,
      warnings: [...warnings, "failed/invalidated sweep evidence"],
      diagnostics: "failed sweep does not create a confirmed candidate",
    };
  }

  // Excursion required.
  const excursionBelow =
    candle.excursion === "BELOW"
    || candle.excursion === "BEYOND_LOW"
    || candle.sweepPhase === "EXCURSION_BELOW";
  const excursionAbove =
    candle.excursion === "ABOVE"
    || candle.excursion === "BEYOND_HIGH"
    || candle.sweepPhase === "EXCURSION_ABOVE";

  if (!excursionBelow && !excursionAbove) {
    return {
      candidate: null,
      warnings: [...warnings, "missing excursion beyond liquidity reference"],
      diagnostics: "no validated excursion beyond reference",
    };
  }

  // Reclaim pending / missing → no confirmed candidate.
  if (candle.reclaim === "PENDING" || candle.sweepPhase === "EXCURSION" || candle.sweepPhase === "PENDING") {
    return {
      candidate: null,
      warnings: [...warnings, "sweep in progress — reclaim confirmation incomplete"],
      diagnostics: "reclaim pending — not a confirmed sweep candidate",
    };
  }
  if (!reclaimed) {
    return {
      candidate: null,
      warnings: [...warnings, "excursion without reclaim — insufficient for confirmed sweep"],
      diagnostics: "missing reclaim evidence after excursion",
    };
  }

  const closed =
    candle.closeState === "CLOSED"
    || candleEv!.candleState === "CLOSED";
  if (!closed) {
    return {
      candidate: null,
      warnings,
      diagnostics: "CLOSED candle reclaim/rejection required (wick-only insufficient)",
    };
  }

  // Direction from reference side + excursion orientation.
  let direction: MifOpportunityDirection = "UNKNOWN";
  if (ref.refSide === "SELL_SIDE" && excursionBelow && reclaimed) {
    // Swept sell-side liquidity (below swing low), reclaimed → bullish.
    direction = "BUY";
  } else if (ref.refSide === "BUY_SIDE" && excursionAbove && reclaimed) {
    // Swept buy-side liquidity (above swing high), reclaimed → bearish.
    direction = "SELL";
  } else {
    return {
      candidate: null,
      warnings,
      diagnostics:
        `refSide=${ref.refSide} excursion=${candle.excursion} does not form a coherent sweep`,
    };
  }

  // Rejection direction should align when provided.
  if (direction === "BUY" && candle.reject === "DOWN") {
    warnings.push("reject=DOWN conflicts with bullish sweep reclaim — retained as conflict");
  }
  if (direction === "SELL" && candle.reject === "UP") {
    warnings.push("reject=UP conflicts with bearish sweep reclaim — retained as conflict");
  }

  // Regime alone never confirms; BREAKOUT acceptance already handled above.
  if (regime.structure === "RANGING") {
    warnings.push("RANGING alone does not confirm a liquidity sweep");
  }
  if (regime.structure === "TRANSITION") {
    warnings.push("TRANSITION alone does not confirm a liquidity sweep");
  }
  if (regime.structure === "BREAKOUT" || context.regime?.breakoutEvidence?.state === "CONFIRMED") {
    warnings.push("BREAKOUT regime/evidence conflicts with sweep reclaim hypothesis");
  }

  const mtfEv =
    findEvidenceById(context, "ls.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  const conflictingEvidenceIds: string[] = [];
  if (mtf.hasConflict || mtf.relation === "CONFLICT" || mtf.relation === "PARTIAL_ALIGNMENT") {
    if (mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`conflicting/partial MTF retained: ${mtf.relation}`);
  }
  if (mtf.relation === "POTENTIAL_REVERSAL") {
    // Generic reversal label is not sweep confirmation; retain as conflict if present without aligning.
    if (mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push("MTF POTENTIAL_REVERSAL retained — not treated as sweep confirmation alone");
  }
  const htfConflict =
    (direction === "BUY" && mtf.higherDirection === "DOWN")
    || (direction === "SELL" && mtf.higherDirection === "UP");
  if (htfConflict) {
    if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId)) {
      conflictingEvidenceIds.push(mtfEv.evidenceId);
    }
    warnings.push("higher-timeframe direction conflicts with sweep side");
  }

  const structureBreakAgainst =
    (direction === "BUY" && noteValue(structureEv!.notes, "break") === "BOS" && noteValue(structureEv!.notes, "bias") === "BEARISH")
    || (direction === "SELL" && noteValue(structureEv!.notes, "break") === "BOS" && noteValue(structureEv!.notes, "bias") === "BULLISH");
  if (structureBreakAgainst) {
    conflictingEvidenceIds.push(structureEv!.evidenceId);
    warnings.push("market structure break against sweep direction preserved");
  }

  const regimeConflict =
    regime.structure === "BREAKOUT"
    || context.regime?.breakoutEvidence?.state === "CONFIRMED";

  const strong = reclaimed && closed;

  const mtfNeedsConfirmation =
    htfConflict
    || mtf.hasConflict
    || mtf.relation === "CONFLICT"
    || mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "PARTIAL_ALIGNMENT";

  const status =
    !strong || mtfNeedsConfirmation || regimeConflict || structureBreakAgainst
      ? "NEEDS_CONFIRMATION"
      : "DETECTED";

  const supportingEvidenceIds = ["ls.structure", "ls.candle", "ls.quality"].filter(
    (id) => isPresentUsable(findEvidenceById(context, id)) || id === "ls.quality",
  );
  for (const e of [structureEv, candleEv, liqRefEv, mtfEv, findEvidenceById(context, "ls.regime")]) {
    if (e && isPresentUsable(e) && !supportingEvidenceIds.includes(e.evidenceId)) {
      supportingEvidenceIds.push(e.evidenceId);
    }
  }

  const thesis =
    direction === "BUY"
      ? "Potential bullish liquidity sweep — excursion below sell-side reference with reclaim"
      : "Potential bearish liquidity sweep — excursion above buy-side reference with reclaim";
  const rationale = [
    `Reference refId=${ref.refId} type=${ref.refType} side=${ref.refSide} (price-based; not proof of resting orders).`,
    `Excursion=${candle.excursion}; reclaim=${candle.reclaim}; closeState=${candle.closeState}; accepted=${candle.accepted}.`,
    `Regime structure=${regime.structure} direction=${regime.direction}.`,
    mtf.source !== "absent" ? `MTF relation=${mtf.relation}.` : "MTF optional evidence not supplied.",
    "Wick-only / FORMING / acceptance-through / unconfirmed references never confirm.",
    "Does not claim institutional stop hunts or win probability.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
    detectorVersion: MIF_LIQUIDITY_SWEEP_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["ls.reject_closed"],
    invalidationConditions: ["ls.accepted_through"],
    knownLimitations: [
      "LIQUIDITY_REFERENCE family is PLANNED — references come from MARKET_STRUCTURE swings (PARTIAL).",
      "Price-based liquidity reference is not direct proof of resting stop orders.",
      "Does not duplicate STEP 5 breakout or STEP 4 reversal detectors.",
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
      `liquidity-sweep candidate direction=${direction} status=${status} refId=${ref.refId}`,
  };
}

export const mifLiquiditySweepDetector: MifOpportunityDetector = {
  detectorId: MIF_LIQUIDITY_SWEEP_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_LIQUIDITY_SWEEP_DETECTOR_VERSION,
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
    "Phase 5D Step 8 — liquidity sweep; confirmed swing ref + CLOSED reclaim; no fabricated liquidity pools.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateLiquiditySweep,
};
