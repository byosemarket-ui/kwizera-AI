/**
 * Phase 5D Step 10 — Momentum Expansion Opportunity Detector.
 * Directional expansion from PARTIAL PRICE_DISPLACEMENT + VOLATILITY + MARKET_REGIME.
 * MOMENTUM oscillator family remains PLANNED — never fabricated.
 * Volatility-only / large-candle-only / direction-without-expansion never create candidates.
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
  MIF_MOMENTUM_EXPANSION_DETECTOR_VERSION,
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

const STRATEGY_ID = "MOMENTUM_EXPANSION" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

/** Mapped expansion observation labels (notes → detector vocabulary). */
type ExpansionPhase =
  | "MOMENTUM_BUILDING"
  | "MOMENTUM_EXPANDING"
  | "MOMENTUM_EXHAUSTING"
  | "MOMENTUM_CONFLICTING"
  | "INSUFFICIENT_EVIDENCE";

function mapPhase(raw: string | null): ExpansionPhase {
  if (raw === "EXPANDING" || raw === "EXPANSION" || raw === "MOMENTUM_EXPANDING") {
    return "MOMENTUM_EXPANDING";
  }
  if (raw === "BUILDING" || raw === "MOMENTUM_BUILDING" || raw === "BUILD") {
    return "MOMENTUM_BUILDING";
  }
  if (
    raw === "EXHAUSTING"
    || raw === "EXHAUSTION"
    || raw === "EXHAUSTED"
    || raw === "MOMENTUM_EXHAUSTING"
    || raw === "WEAKENING"
  ) {
    return "MOMENTUM_EXHAUSTING";
  }
  if (raw === "CONFLICTING" || raw === "CONFLICT" || raw === "MOMENTUM_CONFLICTING") {
    return "MOMENTUM_CONFLICTING";
  }
  return "INSUFFICIENT_EVIDENCE";
}

function parseDisplacement(notes: string | undefined): {
  direction: string | null;
  phase: ExpansionPhase;
  atrExpand: boolean | null;
  expand: boolean | null;
  magnitude: string | null;
  closeState: string | null;
  candleOnly: boolean;
  invalid: boolean;
} {
  const direction =
    noteValue(notes, "direction")
    ?? noteValue(notes, "impulseDirection")
    ?? noteValue(notes, "side");
  const phaseRaw =
    noteValue(notes, "phase")
    ?? noteValue(notes, "expansionPhase")
    ?? noteValue(notes, "momentumPhase")
    ?? noteValue(notes, "state");
  const phase = mapPhase(phaseRaw);

  const atrRaw = noteValue(notes, "atrExpand") ?? noteValue(notes, "atrNormExpand");
  const atrExpand =
    atrRaw === "TRUE" || atrRaw === "YES" || atrRaw === "EXPANDING"
      ? true
      : atrRaw === "FALSE" || atrRaw === "NO" || atrRaw === "NONE"
        ? false
        : null;

  const expandRaw = noteValue(notes, "expand") ?? noteValue(notes, "expansion");
  const expand =
    expandRaw === "TRUE" || expandRaw === "YES" || expandRaw === "EXPANDING"
      ? true
      : expandRaw === "FALSE" || expandRaw === "NO"
        ? false
        : null;

  const magnitude =
    noteValue(notes, "magnitude")
    ?? noteValue(notes, "strength")
    ?? noteValue(notes, "atrNorm");

  const closeState = noteValue(notes, "closeState");
  const candleOnly =
    noteValue(notes, "candleOnly") === "TRUE"
    || noteValue(notes, "largeCandleOnly") === "TRUE";
  const quality = noteValue(notes, "quality") ?? "VALID";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || noteValue(notes, "invalid") === "TRUE";

  return {
    direction,
    phase,
    atrExpand,
    expand,
    magnitude,
    closeState,
    candleOnly,
    invalid,
  };
}

function parseVolatility(notes: string | undefined): {
  state: string | null;
  expanding: boolean;
  directional: boolean | null;
  invalid: boolean;
} {
  const state =
    noteValue(notes, "volState")
    ?? noteValue(notes, "state")
    ?? noteValue(notes, "volatility");
  const expanding =
    state === "EXPANDING"
    || state === "HIGH"
    || state === "EXTREME"
    || noteValue(notes, "expand") === "TRUE"
    || noteValue(notes, "volExpand") === "TRUE";
  const dirRaw = noteValue(notes, "directional") ?? noteValue(notes, "hasDirection");
  const directional =
    dirRaw === "TRUE" ? true : dirRaw === "FALSE" ? false : null;
  const quality = noteValue(notes, "quality") ?? "VALID";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || noteValue(notes, "invalid") === "TRUE";
  return { state, expanding, directional, invalid };
}

function parseOptionalMomentum(notes: string | undefined): {
  present: boolean;
  direction: string | null;
  phase: ExpansionPhase;
  fabricated: boolean;
} {
  if (!notes) {
    return {
      present: false,
      direction: null,
      phase: "INSUFFICIENT_EVIDENCE",
      fabricated: false,
    };
  }
  if (noteValue(notes, "fabricated") === "TRUE") {
    return {
      present: true,
      direction: null,
      phase: "INSUFFICIENT_EVIDENCE",
      fabricated: true,
    };
  }
  const direction = noteValue(notes, "direction");
  const phase = mapPhase(
    noteValue(notes, "phase")
      ?? noteValue(notes, "momentumPhase")
      ?? noteValue(notes, "state"),
  );
  return { present: true, direction, phase, fabricated: false };
}

function hasDocumentedExpansion(d: ReturnType<typeof parseDisplacement>): boolean {
  if (d.phase === "MOMENTUM_EXPANDING") return true;
  if (d.atrExpand === true) return true;
  if (d.expand === true) return true;
  if (
    d.magnitude === "EXPANDING"
    || d.magnitude === "STRONG"
    || d.magnitude === "EXPANSION"
  ) {
    // Magnitude alone without expand/phase/atrExpand is not enough — caller checks.
    return false;
  }
  return false;
}

function evaluateMomentumExpansion(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, [
    "me.momentum",
    "me.structure",
    "me.mtf",
    "me.candle",
  ]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["me.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks momentum-expansion evaluation`,
    };
  }

  // Data quality gate
  const qualityEv =
    findEvidenceById(context, "me.quality")
    ?? findEvidenceByFamily(context, "DATA_QUALITY");
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

  // --- Required volatility (context only; never directional by itself) ---
  const volEv =
    findEvidenceById(context, "me.vol")
    ?? findEvidenceByFamily(context, "VOLATILITY");
  if (!isPresentUsable(volEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "VOLATILITY evidence absent or unusable",
    };
  }
  if (volEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "volatility evidence STALE"],
      diagnostics: "stale volatility rejected",
    };
  }
  const vol = parseVolatility(volEv!.notes);
  if (vol.invalid) {
    return {
      candidate: null,
      warnings,
      diagnostics: "volatility evidence invalid",
    };
  }

  // --- Required displacement (directional expansion carrier) ---
  const displacementEv =
    findEvidenceById(context, "me.displacement")
    ?? findEvidenceByFamily(context, "PRICE_DISPLACEMENT");
  if (!isPresentUsable(displacementEv)) {
    // Volatility-only path: no BUY/SELL.
    return {
      candidate: null,
      warnings: [
        ...warnings,
        vol.expanding
          ? "volatility expansion without directional displacement — no candidate"
          : "PRICE_DISPLACEMENT absent",
      ],
      diagnostics: "volatility alone is not directional momentum expansion",
    };
  }
  if (displacementEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "displacement evidence STALE"],
      diagnostics: "stale displacement rejected",
    };
  }
  if (displacementEv!.qualityStatus === "INVALID" || displacementEv!.qualityStatus === "MISSING") {
    return {
      candidate: null,
      warnings,
      diagnostics: "displacement quality invalid/missing",
    };
  }

  const displacement = parseDisplacement(displacementEv!.notes);
  if (displacement.invalid) {
    return {
      candidate: null,
      warnings: [...warnings, "displacement invalid"],
      diagnostics: "invalid price displacement",
    };
  }
  if (displacement.candleOnly) {
    return {
      candidate: null,
      warnings: [...warnings, "large candle alone is insufficient"],
      diagnostics: "candle-only expansion is not momentum expansion",
    };
  }

  // FORMING cannot confirm expansion.
  if (
    displacement.closeState === "FORMING"
    || displacementEv!.candleState === "FORMING"
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING candle cannot confirm momentum expansion"],
      diagnostics: "FORMING displacement is not CLOSED confirmation",
    };
  }

  // Exhaustion ≠ fresh expansion.
  if (displacement.phase === "MOMENTUM_EXHAUSTING") {
    return {
      candidate: null,
      warnings: [...warnings, "momentum exhausting — not fresh expansion"],
      diagnostics: "MOMENTUM_EXHAUSTING rejects expansion candidate",
    };
  }
  if (displacement.phase === "MOMENTUM_CONFLICTING") {
    return {
      candidate: null,
      warnings: [...warnings, "conflicting momentum evidence"],
      diagnostics: "MOMENTUM_CONFLICTING — no expansion candidate",
    };
  }
  if (displacement.phase === "MOMENTUM_BUILDING") {
    return {
      candidate: null,
      warnings: [...warnings, "momentum building without documented expansion"],
      diagnostics: "MOMENTUM_BUILDING — positive momentum without expansion is not a candidate",
    };
  }

  // Direction required.
  const bullish =
    displacement.direction === "UP"
    || displacement.direction === "BUY"
    || displacement.direction === "BULLISH";
  const bearish =
    displacement.direction === "DOWN"
    || displacement.direction === "SELL"
    || displacement.direction === "BEARISH";
  if (!bullish && !bearish) {
    return {
      candidate: null,
      warnings,
      diagnostics: `displacement direction=${displacement.direction ?? "MISSING"} not established`,
    };
  }

  // Expansion must be documented — direction/magnitude alone insufficient.
  const expanding = hasDocumentedExpansion(displacement);
  if (!expanding) {
    // Positive/negative momentum without expansion.
    if (
      displacement.magnitude === "WEAK"
      || displacement.magnitude === "MODERATE"
      || displacement.magnitude === "NONE"
      || displacement.magnitude == null
      || displacement.expand === false
      || displacement.atrExpand === false
      || displacement.phase === "INSUFFICIENT_EVIDENCE"
    ) {
      return {
        candidate: null,
        warnings: [
          ...warnings,
          "directional momentum without documented expansion (atrExpand/expand/phase=EXPANDING)",
        ],
        diagnostics: "momentum without expansion does not create a candidate",
      };
    }
    return {
      candidate: null,
      warnings,
      diagnostics: "expansion not established from displacement notes",
    };
  }

  // Magnitude must be present and not INVALID when expansion is claimed.
  if (
    displacement.magnitude == null
    || displacement.magnitude === "MISSING"
    || displacement.magnitude === "INVALID"
    || displacement.magnitude === "NONE"
  ) {
    return {
      candidate: null,
      warnings: [...warnings, "momentum magnitude missing or invalid"],
      diagnostics: "cannot claim expansion without documented magnitude",
    };
  }

  // CLOSED confirmation required on displacement (or optional candle).
  const closedDisp =
    displacement.closeState === "CLOSED"
    || displacementEv!.candleState === "CLOSED";

  const candleEv =
    findEvidenceById(context, "me.candle")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  if (candleEv?.candleState === "FORMING" || noteValue(candleEv?.notes, "closeState") === "FORMING") {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING confirmation candle rejected"],
      diagnostics: "FORMING candle cannot confirm momentum expansion",
    };
  }
  if (candleEv?.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "confirmation candle STALE"],
      diagnostics: "stale candle rejected",
    };
  }
  if (candleEv && (candleEv.qualityStatus === "INVALID" || candleEv.qualityStatus === "MISSING")) {
    return {
      candidate: null,
      warnings,
      diagnostics: "confirmation candle invalid/missing",
    };
  }

  const closedCandle =
    isPresentUsable(candleEv)
    && (candleEv!.candleState === "CLOSED" || noteValue(candleEv!.notes, "closeState") === "CLOSED");

  if (!closedDisp && !closedCandle) {
    return {
      candidate: null,
      warnings: [...warnings, "CLOSED candle confirmation required for expansion"],
      diagnostics: "CLOSED expansion confirmation not satisfied",
    };
  }

  // Optional PLANNED momentum family — never fabricate; reject fabricated notes.
  const momentumEv = findEvidenceById(context, "me.momentum");
  if (momentumEv) {
    if (momentumEv.presence === "PRESENT") {
      const mom = parseOptionalMomentum(momentumEv.notes);
      if (mom.fabricated) {
        return {
          candidate: null,
          warnings: [...warnings, "fabricated MOMENTUM oscillator notes rejected"],
          diagnostics: "MOMENTUM family is PLANNED — do not fabricate acceleration/oscillator values",
        };
      }
      if (mom.phase === "MOMENTUM_EXHAUSTING" || mom.phase === "MOMENTUM_CONFLICTING") {
        return {
          candidate: null,
          warnings: [...warnings, `optional me.momentum phase=${mom.phase}`],
          diagnostics: "optional MOMENTUM evidence conflicts with expansion thesis",
        };
      }
      if (
        mom.direction
        && ((bullish && (mom.direction === "DOWN" || mom.direction === "SELL"))
          || (bearish && (mom.direction === "UP" || mom.direction === "BUY")))
      ) {
        warnings.push("optional me.momentum direction conflicts with displacement — retained");
      }
    }
  }

  // Volatility-only directional=false with no independent expansion already handled;
  // if vol claims non-directional and displacement somehow weak — keep vol as context only.
  if (vol.directional === false && !expanding) {
    return {
      candidate: null,
      warnings: [...warnings, "non-directional volatility without expansion"],
      diagnostics: "volatility expansion without directional momentum rejected",
    };
  }

  // Regime compatibility (strategy: TRENDING / BREAKOUT / TRANSITION; reject RANGING/UNSTABLE/UNKNOWN).
  if (regime.structure === "RANGING") {
    return {
      candidate: null,
      warnings: [...warnings, "RANGING regime — expansion inside range is not a momentum-expansion opportunity"],
      diagnostics: "RANGING structure rejects MOMENTUM_EXPANSION candidate",
    };
  }
  if (regime.structure === "UNSTABLE" || regime.structure === "UNKNOWN") {
    return {
      candidate: null,
      warnings: [...warnings, `regime structure=${regime.structure} unsupported for expansion`],
      diagnostics: `structure=${regime.structure} blocks momentum expansion`,
    };
  }
  if (
    regime.structure !== "TRENDING"
    && regime.structure !== "BREAKOUT"
    && regime.structure !== "TRANSITION"
  ) {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime structure=${regime.structure} not compatible`,
    };
  }
  if (regime.direction !== "UP" && regime.direction !== "DOWN" && regime.direction !== "UNKNOWN") {
    // NEUTRAL: soft-block unless displacement direction is clear (already is).
    if (regime.direction === "NEUTRAL") {
      warnings.push("regime direction NEUTRAL — expansion relies on displacement direction");
    }
  }

  // Directional coherence with regime when regime is directional.
  let direction: MifOpportunityDirection = bullish ? "BUY" : "SELL";
  if (
    (direction === "BUY" && regime.direction === "DOWN")
    || (direction === "SELL" && regime.direction === "UP")
  ) {
    warnings.push("regime direction conflicts with expansion side");
  }

  // Instrument / timeframe mismatch via optional structure notes.
  const structureEv =
    findEvidenceById(context, "me.structure")
    ?? findEvidenceByFamily(context, "MARKET_STRUCTURE");
  if (isPresentUsable(structureEv)) {
    const sym = noteValue(structureEv!.notes, "symbol") ?? noteValue(structureEv!.notes, "instrument");
    if (sym && context.providerSymbol && sym !== context.providerSymbol.toUpperCase()) {
      return {
        candidate: null,
        warnings: [...warnings, "instrument mismatch"],
        diagnostics: `structure symbol=${sym} != providerSymbol=${context.providerSymbol}`,
      };
    }
    const tf = noteValue(structureEv!.notes, "timeframe") ?? noteValue(structureEv!.notes, "tf");
    if (
      tf
      && displacementEv!.timeframe
      && tf !== displacementEv!.timeframe.toUpperCase()
    ) {
      return {
        candidate: null,
        warnings: [...warnings, "timeframe mismatch"],
        diagnostics: `structure tf=${tf} != displacement tf=${displacementEv!.timeframe}`,
      };
    }
  }

  // MTF conflicts — preserve, do not erase.
  const mtfEv =
    findEvidenceById(context, "me.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  const conflictingEvidenceIds: string[] = [];
  const mtfNeedsConfirmation =
    mtf.hasConflict
    || mtf.relation === "CONFLICT"
    || mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "PARTIAL_ALIGNMENT"
    || mtf.relation === "TRANSITION";
  if (mtfNeedsConfirmation) {
    if (mtfEv) conflictingEvidenceIds.push(mtfEv.evidenceId);
    warnings.push(`MTF relation=${mtf.relation} retained (not erased)`);
  }
  const htfConflict =
    (direction === "BUY" && mtf.higherDirection === "DOWN")
    || (direction === "SELL" && mtf.higherDirection === "UP");
  if (htfConflict) {
    if (mtfEv && !conflictingEvidenceIds.includes(mtfEv.evidenceId)) {
      conflictingEvidenceIds.push(mtfEv.evidenceId);
    }
    warnings.push("higher-timeframe direction conflicts with expansion side");
  }

  const regimeConflict =
    (direction === "BUY" && regime.direction === "DOWN")
    || (direction === "SELL" && regime.direction === "UP");
  if (regimeConflict) {
    const regimeEv = findEvidenceById(context, "me.regime");
    if (regimeEv && !conflictingEvidenceIds.includes(regimeEv.evidenceId)) {
      conflictingEvidenceIds.push(regimeEv.evidenceId);
    }
  }

  // BREAKOUT regime: allow with independent expansion evidence already required;
  // do not claim breakout duplication — mark NEEDS_CONFIRMATION when breakout-confirmed.
  const breakoutConfirmed =
    regime.structure === "BREAKOUT"
    || context.regime?.breakoutEvidence?.state === "CONFIRMED";
  if (breakoutConfirmed) {
    warnings.push(
      "BREAKOUT regime present — momentum expansion retained independently; not a duplicate breakout claim",
    );
  }

  const transitionOrSoft =
    regime.structure === "TRANSITION"
    || mtfNeedsConfirmation
    || htfConflict
    || regimeConflict
    || breakoutConfirmed
    || !closedCandle;

  const status = transitionOrSoft ? "NEEDS_CONFIRMATION" : "DETECTED";

  const supportingEvidenceIds = [
    "me.displacement",
    "me.vol",
    "me.regime",
    "me.quality",
  ].filter((id) => isPresentUsable(findEvidenceById(context, id)));
  for (const e of [
    displacementEv,
    volEv,
    qualityEv,
    candleEv,
    structureEv,
    mtfEv,
    findEvidenceById(context, "me.regime"),
    momentumEv,
  ]) {
    if (e && isPresentUsable(e) && !supportingEvidenceIds.includes(e.evidenceId)) {
      supportingEvidenceIds.push(e.evidenceId);
    }
  }

  const thesis =
    direction === "BUY"
      ? "Potential bullish momentum expansion with ATR-normalized displacement"
      : "Potential bearish momentum expansion with ATR-normalized displacement";
  const rationale = [
    `Displacement phase=${displacement.phase} direction=${displacement.direction} atrExpand=${displacement.atrExpand} expand=${displacement.expand} magnitude=${displacement.magnitude} (PRICE_DISPLACEMENT PARTIAL).`,
    `Volatility state=${vol.state} expanding=${vol.expanding} (context only — not directional alone).`,
    `Regime structure=${regime.structure} direction=${regime.direction} volatility=${regime.volatility}.`,
    mtf.source !== "absent" ? `MTF relation=${mtf.relation}.` : "MTF optional evidence not supplied.",
    "MOMENTUM oscillator family is PLANNED — not fabricated. Large candle / vol-only / direction-without-expansion never confirm. Not a win probability.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
    detectorVersion: MIF_MOMENTUM_EXPANSION_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["me.atr_displace"],
    invalidationConditions: ["me.exhaustion"],
    knownLimitations: [
      "MOMENTUM oscillator family is PLANNED — expansion inferred from PARTIAL displacement + volatility + regime.",
      "Does not invent acceleration, RSI/MACD, or HFM tick volume as global FX volume.",
      "Does not treat expansion magnitude as trade success probability.",
      "Analytical candidate only — not executable.",
    ],
    timeframeRoles: ["OPPORTUNITY_FORMATION", "PRIMARY_DIRECTION"],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics:
      `momentum-expansion candidate direction=${direction} status=${status} phase=${displacement.phase}`,
  };
}

export const mifMomentumExpansionDetector: MifOpportunityDetector = {
  detectorId: MIF_MOMENTUM_EXPANSION_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_MOMENTUM_EXPANSION_DETECTOR_VERSION,
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
    "Phase 5D Step 10 — momentum expansion via PARTIAL displacement+volatility+regime; CLOSED confirmation; MOMENTUM PLANNED.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateMomentumExpansion,
};
