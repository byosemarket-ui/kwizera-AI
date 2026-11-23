import type { MifLiquidityReferenceAssessment } from "../../analysis/liquidity-reference/types.js";
import type {
  MifMarketStructureAssessment,
  MifStructureBias,
  MifStructureEventRef,
} from "../../analysis/market-structure/types.js";
import type { MifMomentumAssessment, MifMomentumDirection } from "../../analysis/momentum/types.js";
import type {
  MifPriceDisplacementAssessment,
  MifPriceDisplacementKind,
} from "../../analysis/price-displacement/types.js";
import type { MifBuyerSellerPressureAssessment } from "../../analysis/buyer-seller-pressure/types.js";
import type { MifSupportResistanceAssessment } from "../../analysis/support-resistance/types.js";
import type { MifEvidenceDirection, MifEvidenceLevel, MifUnifiedMarketEvidence } from "../types.js";
import { buildUnifiedEvidence, mapBuySellToDirection } from "./common.js";

const MAX_STRUCTURE_EVENTS = 16;

function mapStructureBiasToDirection(bias: MifStructureBias): MifEvidenceDirection {
  if (bias === "BULLISH" || bias === "BEARISH") return bias;
  return "NEUTRAL";
}

function mapMomentumDirection(d: MifMomentumDirection): MifEvidenceDirection {
  const u = String(d ?? "").toUpperCase();
  if (u === "UP") return "BULLISH";
  if (u === "DOWN") return "BEARISH";
  return "NEUTRAL";
}

function mapDisplacementKindToDirection(kind: MifPriceDisplacementKind): MifEvidenceDirection {
  if (kind === "BULLISH_DISPLACEMENT") return "BULLISH";
  if (kind === "BEARISH_DISPLACEMENT") return "BEARISH";
  return "NEUTRAL";
}

function buildStructureEventEvidence(
  assessment: MifMarketStructureAssessment,
  event: MifStructureEventRef,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const direction = mapBuySellToDirection(event.direction);
  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "STRUCTURE_EVENT",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: [],
    limitations: ["Structure event — analytical only"],
    levels: [
      {
        id: event.eventId,
        kind: event.type,
        price: event.priceLevel,
        side: event.direction === "BULLISH" ? "HIGH" : "LOW",
        note: event.eventKey,
      },
    ],
    measurements: [
      { id: "eventType", name: "eventType", value: event.type, unit: null, note: null },
      { id: "status", name: "status", value: event.status, unit: null, note: null },
      {
        id: "breakCandleIndex",
        name: "breakCandleIndex",
        value: event.breakCandleIndex,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: null,
      scale: `eventStatus=${event.status}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Structure event status — not a win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "structure-event",
      assessmentId: assessment.assessmentId,
      eventId: event.eventId,
      eventKey: event.eventKey,
      type: event.type,
    },
  });
}

export function adaptMarketStructureToEvidence(
  assessment: MifMarketStructureAssessment,
  opts?: {
    analysisId?: string | null;
    runId?: string | null;
    snapshotId?: string | null;
    /** Emit capped STRUCTURE_EVENT items in addition to the aggregate MARKET_STRUCTURE item. */
    includeStructureEvents?: boolean;
  },
): MifUnifiedMarketEvidence[] {
  const direction = mapStructureBiasToDirection(assessment.bias);
  const levels: MifEvidenceLevel[] = [];
  if (assessment.primaryRef) {
    levels.push({
      id: assessment.primaryRef.refId,
      kind: assessment.primaryRef.refType,
      price: assessment.primaryRef.price,
      side: assessment.primaryRef.refSide === "BUY_SIDE" ? "HIGH" : "LOW",
      note: "primaryRef",
    });
  }
  for (const swing of assessment.swings.slice(0, 20)) {
    levels.push({
      id: swing.swingId,
      kind: swing.kind,
      price: swing.price,
      side: swing.kind === "HIGH" ? "HIGH" : "LOW",
      note: swing.classification,
    });
  }

  const aggregate = buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "MARKET_STRUCTURE",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: [],
    limitations: ["Market structure — does not invent prices"],
    levels,
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      { id: "bias", name: "bias", value: assessment.bias, unit: null, note: null },
      {
        id: "confirmedSwingCount",
        name: "confirmedSwingCount",
        value: assessment.confirmedSwingCount,
        unit: null,
        note: null,
      },
      {
        id: "provisionalSwingCount",
        name: "provisionalSwingCount",
        value: assessment.provisionalSwingCount,
        unit: null,
        note: null,
      },
      {
        id: "eventCount",
        name: "eventCount",
        value: assessment.events.length,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: null,
      scale: `bias=${assessment.bias}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Structure bias — not a win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "market-structure",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      bias: assessment.bias,
      eventCount: assessment.events.length,
    },
  });

  const out: MifUnifiedMarketEvidence[] = [aggregate];
  if (opts?.includeStructureEvents === true) {
    for (const event of assessment.events.slice(0, MAX_STRUCTURE_EVENTS)) {
      out.push(buildStructureEventEvidence(assessment, event, opts));
    }
  }
  return out;
}

export function adaptSupportResistanceToEvidence(
  assessment: MifSupportResistanceAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const levels: MifEvidenceLevel[] = assessment.boundaries.map((b) => ({
    id: b.boundaryId,
    kind: b.kind,
    price: b.mid,
    side: b.kind === "RESISTANCE" ? "HIGH" : b.kind === "SUPPORT" ? "LOW" : "MID",
    note: `low=${b.low} high=${b.high} lifecycle=${b.lifecycle}`,
  }));

  const direction =
    assessment.primaryBoundary?.kind === "RESISTANCE"
      ? "BEARISH"
      : assessment.primaryBoundary?.kind === "SUPPORT"
        ? "BULLISH"
        : "NEUTRAL";

  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "SUPPORT_RESISTANCE",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: [],
    limitations: ["Boundary levels from source swings only"],
    levels,
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      {
        id: "boundaryCount",
        name: "boundaryCount",
        value: assessment.boundaries.length,
        unit: null,
        note: null,
      },
      {
        id: "primaryBoundaryId",
        name: "primaryBoundaryId",
        value: assessment.primaryBoundary?.boundaryId ?? null,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: assessment.primaryBoundary?.touchCount ?? null,
      scale: "primary touchCount",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Boundary touch context — not a win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "support-resistance",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      boundaryCount: assessment.boundaries.length,
    },
  });
}

export function adaptLiquidityReferenceToEvidence(
  assessment: MifLiquidityReferenceAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const levels: MifEvidenceLevel[] = assessment.references.map((r) => ({
    id: r.referenceId,
    kind: r.refType,
    price: r.price,
    side: r.refSide === "BUY_SIDE" ? "HIGH" : "LOW",
    note: `${r.lifecycle}:${r.notes}`.slice(0, 120),
  }));

  const direction =
    assessment.primaryReference?.refSide === "BUY_SIDE"
      ? "BULLISH"
      : assessment.primaryReference?.refSide === "SELL_SIDE"
        ? "BEARISH"
        : "NEUTRAL";

  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "LIQUIDITY_REFERENCE",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: assessment.tipObservation?.closeState === "CLOSED"
      ? "CLOSED"
      : assessment.tipObservation?.closeState === "FORMING"
        ? "FORMING"
        : null,
    warnings: [],
    limitations: [
      "Liquidity reference — descriptive only",
      "doesNotClaimRestingOrders",
    ],
    levels,
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      {
        id: "referenceCount",
        name: "referenceCount",
        value: assessment.references.length,
        unit: null,
        note: null,
      },
      {
        id: "tipExcursion",
        name: "tipExcursion",
        value: assessment.tipObservation?.excursion ?? null,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: null,
      scale: `refs=${assessment.references.length}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Liquidity reference lifecycle — not a win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "liquidity-reference",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      referenceCount: assessment.references.length,
    },
  });
}

export function adaptMomentumToEvidence(
  assessment: MifMomentumAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const direction = mapMomentumDirection(assessment.direction);

  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "MOMENTUM",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: assessment.conflictingIndicators ? ["conflictingIndicators"] : [],
    limitations: [assessment.strengthScoreDefinition, "notWinProbability"],
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      { id: "phase", name: "phase", value: assessment.phase, unit: null, note: null },
      {
        id: "strengthScore",
        name: "strengthScore",
        value: assessment.strengthScore,
        unit: null,
        note: null,
      },
      ...assessment.indicators.slice(0, 8).map((ind) => ({
        id: ind.indicatorId,
        name: ind.indicatorId,
        value: ind.value,
        unit: ind.unit,
        note: ind.definition,
      })),
    ],
    score: {
      confidenceType: "ENGINE_SPECIFIC",
      value: assessment.strengthScore,
      scale: assessment.strengthScoreDefinition,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Momentum strength composite — explicitly not a win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "momentum",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      direction: assessment.direction,
      phase: assessment.phase,
    },
  });
}

export function adaptPriceDisplacementToEvidence(
  assessment: MifPriceDisplacementAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const direction = mapDisplacementKindToDirection(assessment.displacementKind);
  const levels: MifEvidenceLevel[] = [];
  const m = assessment.metrics;
  if (m?.structuralBoundaryPrice != null) {
    levels.push({
      id: m.structuralBoundaryRefId ?? "structural_boundary",
      kind: "structural_boundary",
      price: m.structuralBoundaryPrice,
      side: m.structuralBoundarySide === "RESISTANCE" ? "HIGH" : "LOW",
      note: m.structuralBoundarySide,
    });
  }

  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "PRICE_DISPLACEMENT",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: m?.candleState === "CLOSED" || m?.candleState === "FORMING" ? m.candleState : null,
    warnings: assessment.provisional ? ["provisional_tip"] : [],
    limitations: ["Displacement — does not claim institutional order flow"],
    levels,
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      {
        id: "displacementKind",
        name: "displacementKind",
        value: assessment.displacementKind,
        unit: null,
        note: null,
      },
      { id: "confirmed", name: "confirmed", value: assessment.confirmed, unit: null, note: null },
      {
        id: "structuralDisplacement",
        name: "structuralDisplacement",
        value: assessment.structuralDisplacement,
        unit: null,
        note: null,
      },
      {
        id: "bodyAtr",
        name: "bodyAtr",
        value: m?.bodyAtr ?? null,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "STRUCTURE_CONFIDENCE",
      value: m?.bodyAtr ?? null,
      scale: "bodyAtr",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Displacement magnitude — not a win probability",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "price-displacement",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      displacementKind: assessment.displacementKind,
      confirmed: assessment.confirmed,
    },
  });
}

function mapPressureDominantToDirection(
  side: MifBuyerSellerPressureAssessment["dominantSide"],
): MifEvidenceDirection {
  if (side === "BUYERS_DOMINANT") return "BULLISH";
  if (side === "SELLERS_DOMINANT") return "BEARISH";
  return "NEUTRAL";
}

/** Phase 05 — adapt buyer/seller pressure assessment into UMEP (proxy scores; not probability). */
export function adaptBuyerSellerPressureToEvidence(
  assessment: MifBuyerSellerPressureAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "BUYER_SELLER_PRESSURE",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction: mapPressureDominantToDirection(assessment.dominantSide),
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: assessment.provisional ? "FORMING" : "CLOSED",
    warnings: assessment.provisional ? ["provisional_tip"] : [],
    limitations: assessment.limitations,
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      {
        id: "dataClassification",
        name: "dataClassification",
        value: assessment.dataClassification,
        unit: null,
        note: null,
      },
      {
        id: "buyingPressureScore",
        name: "buyingPressureScore",
        value: assessment.buyingPressureScore,
        unit: "0-100_proxy_not_probability",
        note: assessment.scoreClassification,
      },
      {
        id: "sellingPressureScore",
        name: "sellingPressureScore",
        value: assessment.sellingPressureScore,
        unit: "0-100_proxy_not_probability",
        note: assessment.scoreClassification,
      },
      {
        id: "pressureImbalance",
        name: "pressureImbalance",
        value: assessment.pressureImbalance,
        unit: "-1_to_1",
        note: null,
      },
      {
        id: "dominantSide",
        name: "dominantSide",
        value: assessment.dominantSide,
        unit: null,
        note: null,
      },
      {
        id: "dominanceStrength",
        name: "dominanceStrength",
        value: assessment.dominanceStrength,
        unit: null,
        note: null,
      },
      {
        id: "absorptionAssessment",
        name: "absorptionAssessment",
        value: assessment.absorptionAssessment,
        unit: null,
        note: "proxy_only",
      },
      {
        id: "exhaustionAssessment",
        name: "exhaustionAssessment",
        value: assessment.exhaustionAssessment,
        unit: null,
        note: null,
      },
      {
        id: "pricePressureRelationship",
        name: "pricePressureRelationship",
        value: assessment.pricePressureRelationship,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "ENGINE_SPECIFIC",
      value: assessment.buyingPressureScore,
      scale: "0-100_buying_pressure_proxy_not_probability",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition:
        "Candle-structure buying pressure proxy 0–100 — not win probability, not aggressor volume",
    },
    analysisId: opts?.analysisId ?? null,
    runId: opts?.runId ?? null,
    snapshotId: opts?.snapshotId ?? null,
    snapshotIdSourceVerified: opts?.snapshotId != null,
    sourceAssessmentId: assessment.assessmentId,
    sourceInputIdentity: assessment.inputIdentity,
    sourceContractId: assessment.contractId,
    sourceContractVersion: assessment.contractVersion,
    fingerprintSource: {
      kind: "buyer-seller-pressure",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      dominantSide: assessment.dominantSide,
      modelVersion: assessment.modelVersion,
    },
  });
}