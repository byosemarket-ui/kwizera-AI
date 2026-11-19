/**
 * Phase 5D Step 9 — Supply/Demand Opportunity Detector.
 * Zone reactions from PARTIAL MARKET_STRUCTURE + PRICE_DISPLACEMENT evidence (no dedicated S/D engine).
 * Zone alone never creates a candidate — CLOSED reaction required.
 * Does not invent volume-based institutional footprints or zone generators.
 */
import { MIF_OPPORTUNITY_DETECTION_POLICY_VERSION } from "../contracts.js";
import { buildOpportunityCandidate } from "../build-candidate.js";
import type {
  MifOpportunityDetectionContext,
  MifOpportunityDetector,
  MifOpportunityDirection,
} from "../types.js";
import {
  MIF_SUPPLY_DEMAND_DETECTOR_ID,
  MIF_SUPPLY_DEMAND_DETECTOR_VERSION,
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

const STRATEGY_ID = "SUPPLY_DEMAND" as const;
const STRATEGY_DEFINITION_VERSION = "1.0.0";

type ZoneKind = "DEMAND" | "SUPPLY" | "UNKNOWN";
type ZoneInteraction =
  | "APPROACHING"
  | "TOUCHED"
  | "REACTION_CONFIRMED"
  | "MITIGATED"
  | "INVALIDATED"
  | "UNKNOWN";

function parseZone(notes: string | undefined): {
  zoneId: string | null;
  zoneKind: ZoneKind;
  zoneState: string | null;
  interaction: ZoneInteraction;
  orderValid: boolean | null;
  lowerId: string | null;
  upperId: string | null;
  fibonacciSource: boolean;
  arbitrary: boolean;
  invalid: boolean;
  mitigated: boolean;
} {
  const zoneId = noteValue(notes, "zoneId") ?? noteValue(notes, "id");
  const kindRaw = noteValue(notes, "zoneKind") ?? noteValue(notes, "kind") ?? noteValue(notes, "type");
  let zoneKind: ZoneKind = "UNKNOWN";
  if (kindRaw === "DEMAND" || kindRaw === "BUY") zoneKind = "DEMAND";
  if (kindRaw === "SUPPLY" || kindRaw === "SELL") zoneKind = "SUPPLY";

  const zoneState = noteValue(notes, "zoneState") ?? noteValue(notes, "state");
  const interactionRaw = noteValue(notes, "interaction") ?? noteValue(notes, "zoneInteraction");
  const allowed: ZoneInteraction[] = [
    "APPROACHING",
    "TOUCHED",
    "REACTION_CONFIRMED",
    "MITIGATED",
    "INVALIDATED",
    "UNKNOWN",
  ];
  const interaction = (interactionRaw && allowed.includes(interactionRaw as ZoneInteraction)
    ? interactionRaw
    : "UNKNOWN") as ZoneInteraction;

  const orderRaw = noteValue(notes, "orderValid") ?? noteValue(notes, "boundOrder");
  const orderValid =
    orderRaw === "TRUE" || orderRaw === "VALID"
      ? true
      : orderRaw === "FALSE" || orderRaw === "INVALID"
        ? false
        : null;
  const lowerId = noteValue(notes, "lowerId") ?? noteValue(notes, "lowerBoundId");
  const upperId = noteValue(notes, "upperId") ?? noteValue(notes, "upperBoundId");
  const fibonacciSource = noteValue(notes, "source") === "FIBONACCI";
  const arbitrary = noteValue(notes, "arbitrary") === "TRUE";
  const quality = noteValue(notes, "quality") ?? noteValue(notes, "zoneQuality") ?? "VALID";
  const mitigated =
    zoneState === "MITIGATED"
    || interaction === "MITIGATED"
    || noteValue(notes, "mitigated") === "TRUE";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || zoneState === "INVALIDATED"
    || zoneState === "INVALID"
    || interaction === "INVALIDATED"
    || noteValue(notes, "invalid") === "TRUE"
    || noteValue(notes, "invalidated") === "TRUE";
  return {
    zoneId,
    zoneKind,
    zoneState,
    interaction,
    orderValid,
    lowerId,
    upperId,
    fibonacciSource,
    arbitrary,
    invalid,
    mitigated,
  };
}

function parseDisplacement(notes: string | undefined): {
  origin: string | null;
  direction: string | null;
  quality: string | null;
  invalid: boolean;
} {
  const origin =
    noteValue(notes, "origin")
    ?? noteValue(notes, "displacementOrigin")
    ?? noteValue(notes, "kind");
  const direction =
    noteValue(notes, "direction")
    ?? noteValue(notes, "impulseDirection");
  const quality = noteValue(notes, "quality") ?? "VALID";
  const invalid =
    quality === "INVALID"
    || quality === "MISSING"
    || noteValue(notes, "invalid") === "TRUE";
  return { origin, direction, quality, invalid };
}

function parseReaction(notes: string | undefined): {
  react: string | null;
  closeState: string | null;
  accepted: boolean | null;
  interaction: ZoneInteraction | null;
} {
  const react =
    noteValue(notes, "react")
    ?? noteValue(notes, "reaction")
    ?? noteValue(notes, "reject")
    ?? noteValue(notes, "rejection");
  const closeState = noteValue(notes, "closeState");
  const acceptedRaw = noteValue(notes, "accepted");
  const accepted = acceptedRaw === "TRUE" ? true : acceptedRaw === "FALSE" ? false : null;
  const interactionRaw = noteValue(notes, "interaction");
  const allowed: ZoneInteraction[] = [
    "APPROACHING",
    "TOUCHED",
    "REACTION_CONFIRMED",
    "MITIGATED",
    "INVALIDATED",
    "UNKNOWN",
  ];
  const interaction = (interactionRaw && allowed.includes(interactionRaw as ZoneInteraction)
    ? interactionRaw
    : null) as ZoneInteraction | null;
  return { react, closeState, accepted, interaction };
}

function evaluateSupplyDemand(context: MifOpportunityDetectionContext): {
  candidate: ReturnType<typeof buildOpportunityCandidate> | null;
  warnings?: string[];
  diagnostics?: string;
} {
  const warnings = collectOptionalMissingWarnings(context, ["sd.regime", "sd.boundary", "sd.mtf"]);
  const regime = resolveRegimeView(context);
  const mtf = resolveMtfView(context, ["sd.mtf"]);

  if (regime.status === "BLOCKED" || regime.status === "INSUFFICIENT_DATA") {
    return {
      candidate: null,
      warnings,
      diagnostics: `regime status ${regime.status} blocks supply-demand evaluation`,
    };
  }

  // --- Structure / zone identity (required, PARTIAL) ---
  const structureEv =
    findEvidenceById(context, "sd.structure")
    ?? findEvidenceByFamily(context, "MARKET_STRUCTURE");
  if (!isPresentUsable(structureEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "MARKET_STRUCTURE zone evidence absent or unusable",
    };
  }
  if (structureEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "zone structure evidence STALE"],
      diagnostics: "stale zone structure rejected",
    };
  }
  if (structureEv!.qualityStatus === "DEGRADED") {
    warnings.push("zone structure quality DEGRADED (MARKET_STRUCTURE is PARTIAL for S/D)");
  }

  const zone = parseZone(structureEv!.notes);
  if (zone.invalid) {
    return {
      candidate: null,
      warnings: [...warnings, "zone invalidated"],
      diagnostics: `zoneState=${zone.zoneState} interaction=${zone.interaction} — invalidated`,
    };
  }
  if (zone.mitigated) {
    return {
      candidate: null,
      warnings: [...warnings, "zone fully mitigated / consumed"],
      diagnostics: "mitigated zone — not a reaction opportunity",
    };
  }
  if (zone.fibonacciSource) {
    return {
      candidate: null,
      warnings: [...warnings, "Fibonacci-only zone rejected"],
      diagnostics: "Fibonacci levels are not authoritative Supply/Demand zones",
    };
  }
  if (zone.arbitrary) {
    return {
      candidate: null,
      warnings: [...warnings, "arbitrary unsupported zone identity rejected"],
      diagnostics: "arbitrary zone is not a defensible supply/demand zone",
    };
  }
  if (!zone.zoneId) {
    return {
      candidate: null,
      warnings: [...warnings, "missing zone identity"],
      diagnostics: "zone identity required — do not fabricate supply/demand zones",
    };
  }
  if (zone.zoneKind === "UNKNOWN") {
    return {
      candidate: null,
      warnings,
      diagnostics: "zoneKind must be DEMAND or SUPPLY",
    };
  }
  // Boundaries: require distinct lower/upper ids OR explicit orderValid=TRUE.
  if (!zone.lowerId || !zone.upperId) {
    return {
      candidate: null,
      warnings: [...warnings, "missing zone lower/upper boundary identity"],
      diagnostics: "malformed or missing zone boundaries",
    };
  }
  if (zone.lowerId === zone.upperId) {
    return {
      candidate: null,
      warnings,
      diagnostics: "lower and upper boundary identities must differ",
    };
  }
  if (zone.orderValid === false) {
    return {
      candidate: null,
      warnings: [...warnings, "orderValid=FALSE — upper not above lower"],
      diagnostics: "invalid upper/lower boundary ordering",
    };
  }
  if (zone.orderValid == null) {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "boundary order not established (no orderValid) — refusing to invent measurements",
      ],
      diagnostics: "cannot safely validate zone boundary ordering",
    };
  }

  // Optional S/R boundary continuity.
  const boundaryEv =
    findEvidenceById(context, "sd.boundary")
    ?? findEvidenceByFamily(context, "SUPPORT_RESISTANCE");
  if (isPresentUsable(boundaryEv)) {
    const bZone = noteValue(boundaryEv!.notes, "zoneId");
    if (bZone && bZone !== zone.zoneId) {
      warnings.push(`optional sd.boundary zoneId=${bZone} differs from structure zoneId=${zone.zoneId}`);
    }
  }

  // --- Displacement origin (required, PARTIAL) ---
  const displacementEv =
    findEvidenceById(context, "sd.displacement")
    ?? findEvidenceByFamily(context, "PRICE_DISPLACEMENT");
  if (!isPresentUsable(displacementEv)) {
    return {
      candidate: null,
      warnings,
      diagnostics: "PRICE_DISPLACEMENT origin evidence absent — zone alone is insufficient",
    };
  }
  if (displacementEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "displacement origin evidence STALE"],
      diagnostics: "stale displacement origin rejected",
    };
  }

  const displacement = parseDisplacement(displacementEv!.notes);
  if (displacement.invalid) {
    return {
      candidate: null,
      warnings: [...warnings, "displacement origin invalid"],
      diagnostics: "invalid displacement origin",
    };
  }
  const originOk =
    displacement.origin === "IMPULSE"
    || displacement.origin === "EXPANSION"
    || displacement.origin === "DISPLACEMENT"
    || displacement.origin === "VALID";
  if (!originOk) {
    return {
      candidate: null,
      warnings: [...warnings, "missing documented displacement origin"],
      diagnostics: `displacement origin=${displacement.origin ?? "MISSING"} not established`,
    };
  }
  // Demand zones should originate from bullish displacement; supply from bearish.
  if (zone.zoneKind === "DEMAND" && displacement.direction === "DOWN") {
    warnings.push("demand zone with bearish displacement origin — conflicting origin retained");
  }
  if (zone.zoneKind === "SUPPLY" && displacement.direction === "UP") {
    warnings.push("supply zone with bullish displacement origin — conflicting origin retained");
  }
  if (
    (zone.zoneKind === "DEMAND" && displacement.direction !== "UP" && displacement.direction !== "BUY")
    || (zone.zoneKind === "SUPPLY" && displacement.direction !== "DOWN" && displacement.direction !== "SELL")
  ) {
    // Soft: allow UNKNOWN direction with warning; hard-reject only clear contradiction already warned.
    if (displacement.direction == null) {
      warnings.push("displacement direction absent — zone freshness/origin incompletely documented");
    }
  }

  // Interaction without reaction → no candidate.
  const interaction = zone.interaction;
  if (interaction === "APPROACHING") {
    return {
      candidate: null,
      warnings: [...warnings, "price approaching zone without interaction"],
      diagnostics: "APPROACHING — no reaction candidate",
    };
  }
  if (interaction === "TOUCHED") {
    // Touch without confirmation handled after candle check; if no candle, reject here path continues.
  }
  if (interaction === "UNKNOWN" && zone.zoneState !== "FRESH" && zone.zoneState !== "VALID") {
    // Continue to candle — may still confirm via candle.interaction.
  }

  // Zone alone never creates a candidate — need CLOSED reaction.
  const candleEv =
    findEvidenceById(context, "sd.candle")
    ?? findEvidenceByFamily(context, "CANDLE_CONFIRMATION");
  if (!isPresentUsable(candleEv)) {
    return {
      candidate: null,
      warnings: [...warnings, "zone present without CLOSED reaction confirmation"],
      diagnostics: "demand/supply zone alone does not create a candidate",
    };
  }
  if (candleEv!.candleState === "STALE") {
    return {
      candidate: null,
      warnings: [...warnings, "reaction candle STALE"],
      diagnostics: "stale reaction candle rejected",
    };
  }

  const reaction = parseReaction(candleEv!.notes);
  const effectiveInteraction = reaction.interaction ?? interaction;

  if (reaction.closeState === "FORMING" || candleEv!.candleState === "FORMING") {
    return {
      candidate: null,
      warnings: [...warnings, "FORMING candle cannot confirm zone reaction"],
      diagnostics: "FORMING candle is not CLOSED confirmation",
    };
  }

  // Acceptance through zone ≠ successful reaction (breakout territory).
  if (reaction.accepted === true || effectiveInteraction === "INVALIDATED") {
    return {
      candidate: null,
      warnings: [
        ...warnings,
        "acceptance through zone / invalidation — not a successful supply/demand reaction",
      ],
      diagnostics: "accepted through zone — breakout conflict, not a zone reaction",
    };
  }

  if (effectiveInteraction === "APPROACHING") {
    return {
      candidate: null,
      warnings: [...warnings, "approach without touch"],
      diagnostics: "APPROACHING — no candidate",
    };
  }
  if (effectiveInteraction === "TOUCHED" && !reaction.react) {
    return {
      candidate: null,
      warnings: [...warnings, "touch without confirmation"],
      diagnostics: "TOUCHED without CLOSED reaction — no candidate",
    };
  }

  const closed =
    reaction.closeState === "CLOSED"
    || candleEv!.candleState === "CLOSED";
  if (!closed) {
    return {
      candidate: null,
      warnings,
      diagnostics: "CLOSED candle reaction required at zone",
    };
  }

  const bullishReact =
    reaction.react === "UP"
    || reaction.react === "BUY"
    || reaction.react === "BULLISH"
    || reaction.react === "REJECT_UP";
  const bearishReact =
    reaction.react === "DOWN"
    || reaction.react === "SELL"
    || reaction.react === "BEARISH"
    || reaction.react === "REJECT_DOWN";

  let direction: MifOpportunityDirection = "UNKNOWN";
  if (zone.zoneKind === "DEMAND" && bullishReact) {
    direction = "BUY";
  } else if (zone.zoneKind === "SUPPLY" && bearishReact) {
    direction = "SELL";
  } else {
    return {
      candidate: null,
      warnings,
      diagnostics:
        `zoneKind=${zone.zoneKind} react=${reaction.react} does not form a coherent zone reaction`,
    };
  }

  // Regime BREAKOUT conflict — preserve, do not erase.
  if (regime.structure === "BREAKOUT" || context.regime?.breakoutEvidence?.state === "CONFIRMED") {
    warnings.push("BREAKOUT regime/evidence conflicts with zone-reaction hypothesis");
  }

  const mtfEv =
    findEvidenceById(context, "sd.mtf")
    ?? findEvidenceByFamily(context, "MULTI_TIMEFRAME_RELATIONSHIP");
  const conflictingEvidenceIds: string[] = [];
  if (
    mtf.hasConflict
    || mtf.relation === "CONFLICT"
    || mtf.relation === "PARTIAL_ALIGNMENT"
    || mtf.relation === "POTENTIAL_REVERSAL"
  ) {
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
    warnings.push("higher-timeframe direction conflicts with zone-reaction side");
  }

  const regimeConflict =
    regime.structure === "BREAKOUT"
    || context.regime?.breakoutEvidence?.state === "CONFIRMED";

  const originConflict =
    (zone.zoneKind === "DEMAND" && displacement.direction === "DOWN")
    || (zone.zoneKind === "SUPPLY" && displacement.direction === "UP");
  if (originConflict && displacementEv) {
    conflictingEvidenceIds.push(displacementEv.evidenceId);
  }

  const strong = closed && (bullishReact || bearishReact);

  const mtfNeedsConfirmation =
    htfConflict
    || mtf.hasConflict
    || mtf.relation === "CONFLICT"
    || mtf.relation === "POTENTIAL_REVERSAL"
    || mtf.relation === "PARTIAL_ALIGNMENT";

  const status =
    !strong || mtfNeedsConfirmation || regimeConflict || originConflict
      ? "NEEDS_CONFIRMATION"
      : "DETECTED";

  const supportingEvidenceIds = ["sd.structure", "sd.displacement", "sd.quality"].filter(
    (id) => isPresentUsable(findEvidenceById(context, id)) || id === "sd.quality",
  );
  for (const e of [
    structureEv,
    displacementEv,
    candleEv,
    boundaryEv,
    mtfEv,
    findEvidenceById(context, "sd.regime"),
  ]) {
    if (e && isPresentUsable(e) && !supportingEvidenceIds.includes(e.evidenceId)) {
      supportingEvidenceIds.push(e.evidenceId);
    }
  }

  const thesis =
    direction === "BUY"
      ? "Potential demand-zone bullish reaction with documented displacement origin"
      : "Potential supply-zone bearish reaction with documented displacement origin";
  const rationale = [
    `Zone zoneId=${zone.zoneId} kind=${zone.zoneKind} state=${zone.zoneState ?? "VALID"} interaction=${effectiveInteraction} (PARTIAL structure zones — no dedicated S/D engine).`,
    `Boundaries lowerId=${zone.lowerId} upperId=${zone.upperId} orderValid=${zone.orderValid}.`,
    `Displacement origin=${displacement.origin} direction=${displacement.direction}.`,
    `Reaction react=${reaction.react} closeState=${reaction.closeState} accepted=${reaction.accepted}.`,
    `Regime structure=${regime.structure} direction=${regime.direction}.`,
    mtf.source !== "absent" ? `MTF relation=${mtf.relation}.` : "MTF optional evidence not supplied.",
    "Zone alone / FORMING / Fibonacci / acceptance-through never confirm. No institutional volume claims.",
  ].join(" ");

  const candidate = buildOpportunityCandidate({
    context,
    strategyId: STRATEGY_ID,
    detectorId: MIF_SUPPLY_DEMAND_DETECTOR_ID,
    detectorVersion: MIF_SUPPLY_DEMAND_DETECTOR_VERSION,
    strategyDefinitionVersion: STRATEGY_DEFINITION_VERSION,
    policyVersion: MIF_OPPORTUNITY_DETECTION_POLICY_VERSION,
    direction,
    status,
    thesis,
    rationale,
    supportingEvidenceIds,
    conflictingEvidenceIds,
    requiredConfirmations: ["sd.zone_reaction"],
    invalidationConditions: ["sd.zone_mitigated"],
    knownLimitations: [
      "No dedicated Supply/Demand zone engine — zones from PARTIAL MARKET_STRUCTURE notes.",
      "Does not invent volume-based institutional footprints.",
      "Zone freshness tracking is limited to evidenced zoneState/mitigation notes.",
      "Analytical candidate only — not executable; not a win probability.",
    ],
    timeframeRoles: ["INTERMEDIATE_STRUCTURE", "SETUP_DEVELOPMENT"],
    quality: null,
    regimeAssessmentId: regime.assessmentId,
    mtfAssessmentId: mtf.assessmentId,
  });

  return {
    candidate,
    warnings,
    diagnostics:
      `supply-demand candidate direction=${direction} status=${status} zoneId=${zone.zoneId}`,
  };
}

export const mifSupplyDemandDetector: MifOpportunityDetector = {
  detectorId: MIF_SUPPLY_DEMAND_DETECTOR_ID,
  strategyId: STRATEGY_ID,
  detectorVersion: MIF_SUPPLY_DEMAND_DETECTOR_VERSION,
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
    "Phase 5D Step 9 — supply/demand zone reaction; PARTIAL structure+displacement; CLOSED reaction required.",
  placesOrders: false,
  mutatesBroker: false,
  acceptsForExecution: false,
  doesNotApproveAiReasoning: true,
  evaluate: evaluateSupplyDemand,
};
