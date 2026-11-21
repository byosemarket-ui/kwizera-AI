import type { MifFibonacciAssessment } from "../../analysis/fibonacci/types.js";
import type { MifHarmonicAssessment } from "../../analysis/harmonics/types.js";
import type { MifMtfRelationshipsAssessment, MifMtfDirection } from "../../analysis/mtf-relationships/types.js";
import type {
  MifChartPatternAssessment,
  MifChartPatternBreakoutDirection,
  MifChartPatternType,
} from "../../analysis/patterns/types.js";
import type { MifMarketRegimeAssessment, MifRegimeDirection } from "../../analysis/regime/types.js";
import type { MifEvidenceDirection, MifEvidenceLevel, MifUnifiedMarketEvidence } from "../types.js";
import { buildUnifiedEvidence, mapBuySellToDirection } from "./common.js";

const MAX_PATTERN_DETECTIONS = 20;

function mapRegimeAxisDirection(d: MifRegimeDirection | MifMtfDirection): MifEvidenceDirection {
  const u = String(d ?? "").toUpperCase();
  if (u === "UP") return "BULLISH";
  if (u === "DOWN") return "BEARISH";
  return "NEUTRAL";
}

function mapChartBreakoutDirection(d: MifChartPatternBreakoutDirection): MifEvidenceDirection {
  if (d === "BULLISH" || d === "BEARISH") return d;
  return "NEUTRAL";
}

function patternTypeFallbackDirection(patternType: MifChartPatternType): MifEvidenceDirection {
  switch (patternType) {
    case "DOUBLE_TOP":
    case "HEAD_AND_SHOULDERS":
    case "DESCENDING_TRIANGLE":
      return "BEARISH";
    case "DOUBLE_BOTTOM":
    case "INVERSE_HEAD_AND_SHOULDERS":
    case "ASCENDING_TRIANGLE":
      return "BULLISH";
    default:
      return "NEUTRAL";
  }
}

function resolveChartPatternDirection(
  det: MifChartPatternAssessment["detections"][number],
): MifEvidenceDirection {
  const fromConfirm = mapChartBreakoutDirection(det.confirmation.direction);
  if (fromConfirm !== "NEUTRAL") return fromConfirm;
  return patternTypeFallbackDirection(det.patternType);
}

export function adaptFibonacciToEvidence(
  assessment: MifFibonacciAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const direction = mapBuySellToDirection(assessment.orientation ?? null);
  const levels = [
    ...assessment.retracements.map((l, i) => ({
      id: `retracement_${i}_${l.ratio}`,
      kind: "retracement",
      price: l.price,
      side: "MID" as const,
      note: `ratio=${l.ratio}`,
    })),
    ...assessment.extensions.map((l, i) => ({
      id: `extension_${i}_${l.ratio}`,
      kind: "extension",
      price: l.price,
      side: "MID" as const,
      note: `ratio=${l.ratio}`,
    })),
  ];

  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "FIBONACCI",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: [...assessment.warningCodes, ...assessment.blockingCodes].slice(0, 40).map(String),
    limitations: [
      "Fibonacci reference levels — not trade signals",
      ...(assessment.mathematicalReferenceOnly ? ["mathematicalReferenceOnly"] : []),
    ],
    levels,
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      {
        id: "orientation",
        name: "orientation",
        value: assessment.orientation,
        unit: null,
        note: null,
      },
      {
        id: "confirmedSwingCount",
        name: "confirmedSwingCount",
        value: assessment.diagnostics.confirmedSwingCount,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "PATTERN_CONFIDENCE",
      value: null,
      scale: `status=${assessment.status}`,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Fibonacci anchor fit — not a win probability",
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
      kind: "fibonacci",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      status: assessment.status,
      orientation: assessment.orientation,
      levelCount: levels.length,
    },
  });
}

export function adaptChartPatternsToEvidence(
  assessment: MifChartPatternAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence[] {
  return assessment.detections.slice(0, MAX_PATTERN_DETECTIONS).map((det) => {
    const direction = resolveChartPatternDirection(det);
    const levels: MifEvidenceLevel[] = [];
    if (det.neckline) {
      levels.push({
        id: "neckline",
        kind: "neckline",
        price: det.neckline.priceAtEnd,
        side: "MID",
        note: det.neckline.label,
      });
    }
    if (det.upperBoundary) {
      levels.push({
        id: "upperBoundary",
        kind: "upperBoundary",
        price: det.upperBoundary.priceAtEnd,
        side: "HIGH",
        note: det.upperBoundary.label,
      });
    }
    if (det.lowerBoundary) {
      levels.push({
        id: "lowerBoundary",
        kind: "lowerBoundary",
        price: det.lowerBoundary.priceAtEnd,
        side: "LOW",
        note: det.lowerBoundary.label,
      });
    }
    for (const p of det.pivots.slice(0, 12)) {
      levels.push({
        id: `pivot_${p.role}`,
        kind: p.role,
        price: p.price,
        side: p.kind === "HIGH" ? "HIGH" : "LOW",
        note: p.swingId,
      });
    }

    return buildUnifiedEvidence({
      sourceEngine: assessment.engineId,
      engineVersion: assessment.engineVersion,
      evidenceType: "CHART_PATTERN",
      providerSymbol: assessment.providerSymbol,
      timeframe: assessment.timeframe,
      instrument: assessment.instrument,
      direction,
      eventTime: assessment.assessmentTimestamp,
      observedAt: assessment.assessmentTimestamp,
      candleStatus: det.confirmation.candleState,
      warnings: [...assessment.warningCodes, ...assessment.blockingCodes].slice(0, 40).map(String),
      limitations: ["Chart pattern geometry — not execution approval"],
      levels,
      measurements: [
        { id: "patternType", name: "patternType", value: det.patternType, unit: null, note: null },
        { id: "lifecycle", name: "lifecycle", value: det.lifecycle, unit: null, note: null },
        {
          id: "geometryFit",
          name: "geometryFit",
          value: det.confidenceComponents.geometryFit,
          unit: null,
          note: null,
        },
        {
          id: "confirmationMet",
          name: "confirmationMet",
          value: det.confirmation.met,
          unit: null,
          note: null,
        },
      ],
      score: {
        confidenceType: "PATTERN_CONFIDENCE",
        value: det.confidenceComponents.composite,
        scale: "0-1 pattern confidence composite",
        isWinProbability: false,
        isCalibratedPrediction: false,
        calibrationStatus: null,
        reliabilityStatus: null,
        definition: "Explainable pattern-confidence composite — not a win probability",
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
        kind: "chart-pattern",
        assessmentId: assessment.assessmentId,
        detectionIdentity: det.detectionIdentity,
        patternType: det.patternType,
        lifecycle: det.lifecycle,
      },
    });
  });
}

export function adaptHarmonicsToEvidence(
  assessment: MifHarmonicAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence[] {
  return assessment.detections.slice(0, MAX_PATTERN_DETECTIONS).map((det) => {
    const direction = mapBuySellToDirection(det.orientation);
    const levels: MifEvidenceLevel[] = [];
    if (det.prz.low != null) {
      levels.push({
        id: "prz_low",
        kind: "PRZ",
        price: det.prz.low,
        side: "LOW",
        note: "PRZ low",
      });
    }
    if (det.prz.high != null) {
      levels.push({
        id: "prz_high",
        kind: "PRZ",
        price: det.prz.high,
        side: "HIGH",
        note: "PRZ high",
      });
    }

    return buildUnifiedEvidence({
      sourceEngine: assessment.engineId,
      engineVersion: assessment.engineVersion,
      evidenceType: "HARMONIC_PATTERN",
      providerSymbol: assessment.providerSymbol,
      timeframe: assessment.timeframe,
      instrument: assessment.instrument,
      direction,
      eventTime: assessment.assessmentTimestamp,
      observedAt: assessment.assessmentTimestamp,
      candleStatus: null,
      warnings: [...assessment.warningCodes, ...assessment.blockingCodes].slice(0, 40).map(String),
      limitations: ["Harmonic PRZ reference — not a reversal guarantee"],
      levels,
      measurements: [
        { id: "patternType", name: "patternType", value: det.patternType, unit: null, note: null },
        { id: "lifecycle", name: "lifecycle", value: det.lifecycle, unit: null, note: null },
        {
          id: "allRequiredRatiosPassed",
          name: "allRequiredRatiosPassed",
          value: det.allRequiredRatiosPassed,
          unit: null,
          note: null,
        },
        {
          id: "geometryFit",
          name: "geometryFit",
          value: det.geometryFit,
          unit: null,
          note: null,
        },
      ],
      score: {
        confidenceType: "PATTERN_CONFIDENCE",
        value: det.geometryFit,
        scale: "0-1 geometry fit",
        isWinProbability: false,
        isCalibratedPrediction: false,
        calibrationStatus: null,
        reliabilityStatus: null,
        definition: "Harmonic geometry fit — not a win probability",
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
        kind: "harmonic",
        assessmentId: assessment.assessmentId,
        detectionIdentity: det.detectionIdentity,
        patternType: det.patternType,
        orientation: det.orientation,
      },
    });
  });
}

export function adaptRegimeToEvidence(
  assessment: MifMarketRegimeAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const direction = mapRegimeAxisDirection(assessment.direction);
  const levels: MifEvidenceLevel[] = [];
  if (assessment.rangeEvidence.high != null) {
    levels.push({
      id: "range_high",
      kind: "range",
      price: assessment.rangeEvidence.high,
      side: "HIGH",
      note: null,
    });
  }
  if (assessment.rangeEvidence.low != null) {
    levels.push({
      id: "range_low",
      kind: "range",
      price: assessment.rangeEvidence.low,
      side: "LOW",
      note: null,
    });
  }
  if (assessment.breakoutEvidence.boundary != null) {
    levels.push({
      id: "breakout_boundary",
      kind: "breakout",
      price: assessment.breakoutEvidence.boundary,
      side: "ZONE",
      note: assessment.breakoutEvidence.state,
    });
  }

  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "MARKET_REGIME",
    providerSymbol: assessment.providerSymbol,
    timeframe: assessment.timeframe,
    instrument: assessment.instrument,
    direction,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: [...assessment.warningCodes, ...assessment.blockingCodes].slice(0, 40).map(String),
    limitations: ["Regime dimensions are descriptive — not trade approval"],
    levels,
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      { id: "structure", name: "structure", value: assessment.structure, unit: null, note: null },
      { id: "volatility", name: "volatility", value: assessment.volatility, unit: null, note: null },
      {
        id: "compositeLabel",
        name: "compositeLabel",
        value: assessment.compositeLabel,
        unit: null,
        note: null,
      },
      {
        id: "breakoutState",
        name: "breakoutState",
        value: assessment.breakoutEvidence.state,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "ENGINE_SPECIFIC",
      value: assessment.trendEvidence.displacementAtr,
      scale: "displacementAtr",
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "Regime displacement context — not a win probability",
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
      kind: "market-regime",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      direction: assessment.direction,
      structure: assessment.structure,
      compositeLabel: assessment.compositeLabel,
    },
  });
}

export function adaptMtfRelationshipsToEvidence(
  assessment: MifMtfRelationshipsAssessment,
  opts?: { analysisId?: string | null; runId?: string | null; snapshotId?: string | null },
): MifUnifiedMarketEvidence {
  const dirFromRelation =
    assessment.directional.relation === "INSUFFICIENT_DATA"
    || assessment.directional.relation === "UNKNOWN"
    || assessment.directional.relation === "TRANSITION"
      ? "NEUTRAL"
      : mapRegimeAxisDirection(assessment.directional.higherDirection);

  return buildUnifiedEvidence({
    sourceEngine: assessment.engineId,
    engineVersion: assessment.engineVersion,
    evidenceType: "MTF_RELATIONSHIP",
    providerSymbol: assessment.providerSymbol,
    timeframe: null,
    instrument: assessment.instrument,
    direction: dirFromRelation,
    eventTime: assessment.assessmentTimestamp,
    observedAt: assessment.assessmentTimestamp,
    candleStatus: null,
    warnings: [...assessment.warningCodes, ...assessment.blockingCodes].slice(0, 40).map(String),
    limitations: [
      ...(assessment.completeness.coverageIsNotConfidence ? ["coverageIsNotConfidence"] : []),
      "MTF disagreement preserved — not forced alignment",
    ],
    measurements: [
      { id: "status", name: "status", value: assessment.status, unit: null, note: null },
      {
        id: "directionalRelation",
        name: "directionalRelation",
        value: assessment.directional.relation,
        unit: null,
        note: null,
      },
      {
        id: "alignmentScore",
        name: "alignmentScore",
        value: assessment.alignmentScore,
        unit: null,
        note: null,
      },
      {
        id: "coverageRatio",
        name: "coverageRatio",
        value: assessment.completeness.coverageRatio,
        unit: null,
        note: null,
      },
      {
        id: "hasConflict",
        name: "hasConflict",
        value: assessment.conflicts.hasConflict,
        unit: null,
        note: null,
      },
    ],
    score: {
      confidenceType: "ENGINE_SPECIFIC",
      value: assessment.alignmentScore,
      scale: assessment.alignmentScoreDefinition,
      isWinProbability: false,
      isCalibratedPrediction: false,
      calibrationStatus: null,
      reliabilityStatus: null,
      definition: "MTF alignment score — documented components only, not win probability",
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
      kind: "mtf-relationships",
      assessmentId: assessment.assessmentId,
      inputIdentity: assessment.inputIdentity,
      relation: assessment.directional.relation,
      alignmentScore: assessment.alignmentScore,
    },
  });
}