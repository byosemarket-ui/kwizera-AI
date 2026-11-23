/**
 * Phase 06 — assessMifDeepTechnicalIntelligence (HFM_MT5).
 * Orchestrates existing engines. No look-ahead. No fabricated levels/patterns.
 * Does not confirm/invalidate Phase 04 lifecycle alone. Not probability.
 */
import { createHash } from "node:crypto";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifMtfRelationshipsAssessment } from "../mtf-relationships/types.js";
import { computeDeepTechnicalConfluence } from "./compute-technical-confluence.js";
import {
  MIF_DEEP_TECHNICAL_CONTRACT_ID,
  MIF_DEEP_TECHNICAL_CONTRACT_VERSION,
  MIF_DEEP_TECHNICAL_ENGINE_ID,
  MIF_DEEP_TECHNICAL_ENGINE_VERSION,
  MIF_DEEP_TECHNICAL_MODEL_VERSION,
  MIF_DEEP_TECHNICAL_POLICY_ID,
  MIF_DEEP_TECHNICAL_POLICY_VERSION,
} from "./contracts.js";
import { mapCanonicalCandleStatus } from "./map-candle-status.js";
import { mapDeepTechnicalMtfAlignment } from "./map-mtf-alignment.js";
import { mapDeepTechnicalTrendRegime } from "./map-regime-labels.js";
import { resolveDeepTechnicalIntelligencePolicy } from "./policies.js";
import type {
  HfmDeepTechnicalCapabilityMatrix,
  HfmDeepTechnicalEvidenceQuality,
  HfmDeepTechnicalTimeframeBundle,
  HfmDeepTechnicalTimeframeSnapshot,
  HfmDeepTechnicalTrendDirection,
  MifDeepTechnicalIntelligenceAssessment,
  MifDeepTechnicalIntelligencePolicy,
  MifDeepTechnicalStatus,
} from "./types.js";

export interface AssessMifDeepTechnicalIntelligenceInput {
  providerSymbol: string;
  primaryTimeframe: string;
  timeframeBundles: readonly HfmDeepTechnicalTimeframeBundle[];
  mtfRelationships?: MifMtfRelationshipsAssessment | null;
  instrument?: MifCanonicalInstrument | null;
  policy?: Partial<MifDeepTechnicalIntelligencePolicy> | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

function pressureDir(
  side: string | null | undefined,
): HfmDeepTechnicalTrendDirection {
  const s = String(side || "").toUpperCase();
  if (s === "BUYERS_DOMINANT") return "BULLISH";
  if (s === "SELLERS_DOMINANT") return "BEARISH";
  if (s === "BALANCED") return "NEUTRAL";
  if (s === "MIXED") return "MIXED";
  return "UNKNOWN";
}

function momentumDir(
  d: string | null | undefined,
): HfmDeepTechnicalTrendDirection {
  const u = String(d || "").toUpperCase();
  if (u === "UP" || u === "BULLISH") return "BULLISH";
  if (u === "DOWN" || u === "BEARISH") return "BEARISH";
  if (u === "FLAT" || u === "NEUTRAL") return "NEUTRAL";
  return "UNKNOWN";
}

function patternDirFromChart(
  chart: HfmDeepTechnicalTimeframeBundle["chartPatterns"],
): HfmDeepTechnicalTrendDirection {
  if (!chart || chart.status === "INSUFFICIENT_DATA" || chart.status === "BLOCKED") {
    return "UNKNOWN";
  }
  const pats = chart.detections ?? [];
  const confirmed = pats.filter((p) => {
    const life = String(p.lifecycle || "").toUpperCase();
    return life === "CONFIRMED" || life === "FORMING" || life === "CANDIDATE";
  });
  const bulls = confirmed.filter((p) => String(p.direction).toUpperCase() === "BULLISH").length;
  const bears = confirmed.filter((p) => String(p.direction).toUpperCase() === "BEARISH").length;
  if (bulls > 0 && bears > 0 && bulls === bears) return "MIXED";
  if (bulls > bears) return "BULLISH";
  if (bears > bulls) return "BEARISH";
  return "UNKNOWN";
}

function levelsDir(
  sr: HfmDeepTechnicalTimeframeBundle["supportResistance"],
  structureBias: string | null | undefined,
): HfmDeepTechnicalTrendDirection {
  // S/R alone does not imply direction — use structure bias as contextual proxy only when present.
  const b = String(structureBias || "").toUpperCase();
  if (b === "BULLISH") return "BULLISH";
  if (b === "BEARISH") return "BEARISH";
  if (b === "RANGING") return "NEUTRAL";
  if (!sr) return "UNKNOWN";
  return "NEUTRAL";
}

function snapshotFromBundle(
  bundle: HfmDeepTechnicalTimeframeBundle,
): HfmDeepTechnicalTimeframeSnapshot {
  const tip = bundle.tipCandleState
    ?? (bundle.integrity as { tipCandleState?: typeof bundle.tipCandleState } | null | undefined)?.tipCandleState
    ?? null;
  const incomplete =
    bundle.marketStructure?.status === "INSUFFICIENT_DATA"
    || bundle.regime?.status === "INSUFFICIENT_DATA";
  const mapped = mapDeepTechnicalTrendRegime({
    regime: bundle.regime,
    marketStructure: bundle.marketStructure,
    momentum: bundle.momentum,
  });
  const missing: string[] = [];
  if (!bundle.marketStructure) missing.push("marketStructure");
  if (!bundle.regime) missing.push("regime");
  if (!bundle.fibonacci) missing.push("fibonacci");
  if (!bundle.buyerSellerPressure) missing.push("buyerSellerPressure");

  const available = !!(bundle.marketStructure || bundle.regime || bundle.momentum);
  const stale = tip === "STALE";
  const quality = bundle.integrity?.status
    ?? bundle.marketStructure?.status
    ?? bundle.regime?.status
    ?? "MISSING";

  return {
    timeframe: String(bundle.timeframe || "").toUpperCase(),
    available,
    stale,
    tipCandleState: tip ?? null,
    candleStatus: mapCanonicalCandleStatus(tip, { incompleteHistory: !!incomplete && !available }),
    dataQuality: String(quality),
    trendDirection: mapped.direction,
    trendStrength: mapped.strength,
    regimeLabel: mapped.label,
    structureBias: bundle.marketStructure?.bias ?? null,
    structureAssessmentId: bundle.marketStructure?.assessmentId ?? null,
    supportResistanceAssessmentId: bundle.supportResistance?.assessmentId ?? null,
    liquidityAssessmentId: bundle.liquidityReference?.assessmentId ?? null,
    momentumAssessmentId: bundle.momentum?.assessmentId ?? null,
    fibonacciAssessmentId: bundle.fibonacci?.assessmentId ?? null,
    chartPatternAssessmentId: bundle.chartPatterns?.assessmentId ?? null,
    harmonicAssessmentId: bundle.harmonic?.assessmentId ?? null,
    unifiedAssessmentId: bundle.unified?.assessmentId ?? null,
    pressureAssessmentId: bundle.buyerSellerPressure?.assessmentId ?? null,
    pressureDominantSide: bundle.buyerSellerPressure?.dominantSide ?? null,
    pressureDataClassification: bundle.buyerSellerPressure?.dataClassification ?? null,
    candlestickPatternIds: [...(bundle.candlestickPatternIds ?? [])],
    supportingNotes: [
      mapped.label !== "INSUFFICIENT_DATA" ? `regime=${mapped.label}` : "",
      bundle.marketStructure?.bias ? `structure=${bundle.marketStructure.bias}` : "",
    ].filter(Boolean),
    conflictingNotes: [],
    missingInputs: missing,
    limitations: [
      "orchestrator references existing engines — does not recompute structure/fib/patterns",
      "pressure remains INFERRED/PROXY when classified as such by Phase 05",
      "Elliott Wave NOT_IMPLEMENTED",
      "MACD/ADX/Bollinger NOT_IMPLEMENTED in MIF momentum",
    ],
  };
}

function capabilityMatrix(
  primary: HfmDeepTechnicalTimeframeBundle | null,
): HfmDeepTechnicalCapabilityMatrix {
  const has = (x: unknown) => !!x;
  return {
    marketStructure: has(primary?.marketStructure) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    trendRegime: has(primary?.regime) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    supportResistance: has(primary?.supportResistance) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    supplyDemandZones: "PARTIALLY_IMPLEMENTED",
    liquidity: has(primary?.liquidityReference) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    fibonacci: has(primary?.fibonacci) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    candlestickPatterns: (primary?.candlestickPatternIds?.length ?? 0) > 0
      ? "IMPLEMENTED"
      : "PARTIALLY_IMPLEMENTED",
    chartPatterns: has(primary?.chartPatterns) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    harmonicPatterns: has(primary?.harmonic) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    elliottWave: "NOT_IMPLEMENTED",
    momentumRocRsi: has(primary?.momentum) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    momentumMacdAdxBb: "NOT_IMPLEMENTED",
    buyerSellerPressure: has(primary?.buyerSellerPressure) ? "REUSED_AND_VERIFIED" : "INSUFFICIENT_DATA",
    multiTimeframeAlignment: "IMPLEMENTED",
    technicalConfluence: "IMPLEMENTED",
  };
}

/**
 * Compose deep technical intelligence from existing HFM_MT5 assessments.
 */
export function assessMifDeepTechnicalIntelligence(
  input: AssessMifDeepTechnicalIntelligenceInput,
): MifDeepTechnicalIntelligenceAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const primaryTimeframe = String(input.primaryTimeframe || "").trim().toUpperCase();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const policy = resolveDeepTechnicalIntelligencePolicy(input.policy);
  const instrument = input.instrument ?? null;
  const bundles = [...(input.timeframeBundles ?? [])];

  const baseLimitations = [
    "Phase 06 orchestrator — reuses existing MIF engines; no second structure/S-R/Fib/pressure engine",
    "confluence directionalScore is NOT win probability or calibrated probability",
    "does not alone confirm or invalidate Phase 04 lifecycle states",
    "Elliott Wave NOT_IMPLEMENTED",
    "MACD/ADX/Bollinger NOT_IMPLEMENTED",
    "true aggressor-side order flow UNAVAILABLE on HFM MT5 path",
  ];

  const empty = (
    status: MifDeepTechnicalStatus,
    reason: string,
    missing: string[] = [],
  ): MifDeepTechnicalIntelligenceAssessment => {
    const id = idHash({ providerSymbol, primaryTimeframe, status, reason });
    return {
      contractId: MIF_DEEP_TECHNICAL_CONTRACT_ID,
      contractVersion: MIF_DEEP_TECHNICAL_CONTRACT_VERSION,
      scope: "phase06-deep-technical-intelligence",
      assessmentId: input.assessmentId ?? `dti:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      primaryTimeframe,
      instrument,
      policyId: policy.policyId || MIF_DEEP_TECHNICAL_POLICY_ID,
      policyVersion: policy.policyVersion || MIF_DEEP_TECHNICAL_POLICY_VERSION,
      engineId: MIF_DEEP_TECHNICAL_ENGINE_ID,
      engineVersion: MIF_DEEP_TECHNICAL_ENGINE_VERSION,
      modelVersion: MIF_DEEP_TECHNICAL_MODEL_VERSION,
      assessmentTimestamp,
      status,
      provisional: false,
      overallTrendDirection: "UNKNOWN",
      overallTrendStrength: "UNAVAILABLE",
      overallRegimeLabel: "INSUFFICIENT_DATA",
      primarySnapshot: null,
      timeframeSnapshots: [],
      mtf: {
        alignment: "INSUFFICIENT_TIMEFRAME_DATA",
        higherTimeframeBias: "UNKNOWN",
        intermediateTimeframeBias: "UNKNOWN",
        lowerTimeframeBias: "UNKNOWN",
        mtfEngineRelation: null,
        mtfAssessmentId: null,
        framesEvaluated: [],
        framesMissing: [],
        conflictingTimeframes: [],
        notes: [reason],
        doesNotAverageConflictingFrames: true,
      },
      confluence: {
        grade: "INSUFFICIENT_DATA",
        directionalScore: null,
        bullishContribution: 0,
        bearishContribution: 0,
        families: [],
        sharedInputDependencies: [],
        explanation: reason,
        isWinProbability: false,
        isEventProbability: false,
        isCalibratedProbability: false,
        analyticalReferenceOnly: true,
      },
      capabilityMatrix: capabilityMatrix(null),
      evidenceQuality: "INSUFFICIENT_DATA",
      supportingEvidence: [],
      contradictingEvidence: [],
      missingInputs: missing,
      limitations: baseLimitations,
      sourceRefs: {
        mtfAssessmentId: null,
        primaryStructureId: null,
        primaryRegimeId: null,
        primaryPressureId: null,
        primaryUnifiedId: null,
      },
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isWinProbability: false,
      isEventProbability: false,
      isCalibratedProbability: false,
      doesNotConfirmOrInvalidateLifecycleAlone: true,
      elliottWaveStatus: "NOT_IMPLEMENTED",
      macdAdxBollingerStatus: "NOT_IMPLEMENTED",
      analyticalTechnicalInformationOnly: true,
    };
  };

  if (!providerSymbol || !primaryTimeframe) {
    return empty("BLOCKED", "identity required", ["providerSymbol", "primaryTimeframe"]);
  }
  if (!bundles.length) {
    return empty("INSUFFICIENT_DATA", "no_timeframe_bundles", ["timeframeBundles"]);
  }

  const snapshots = bundles.map(snapshotFromBundle);
  const primaryBundle =
    bundles.find((b) => String(b.timeframe).toUpperCase() === primaryTimeframe)
    ?? bundles[0]!;
  const primarySnapshot =
    snapshots.find((s) => s.timeframe === String(primaryBundle.timeframe).toUpperCase())
    ?? snapshots[0]!;

  const mappedTrend = mapDeepTechnicalTrendRegime({
    regime: primaryBundle.regime,
    marketStructure: primaryBundle.marketStructure,
    momentum: primaryBundle.momentum,
  });

  const mtfMapped = mapDeepTechnicalMtfAlignment({
    mtf: input.mtfRelationships,
    minFrames: policy.minMtfFrames,
  });

  const mtfDirection: HfmDeepTechnicalTrendDirection =
    mtfMapped.alignment === "FULL_BULLISH_ALIGNMENT"
    || mtfMapped.alignment === "PARTIAL_BULLISH_ALIGNMENT"
      ? "BULLISH"
      : mtfMapped.alignment === "FULL_BEARISH_ALIGNMENT"
        || mtfMapped.alignment === "PARTIAL_BEARISH_ALIGNMENT"
        ? "BEARISH"
        : mtfMapped.higher !== "UNKNOWN"
          ? mtfMapped.higher
          : "UNKNOWN";

  const displacementCounted =
    !!primaryBundle.priceDisplacement
    && primaryBundle.priceDisplacement.status !== "INSUFFICIENT_DATA"
    && primaryBundle.priceDisplacement.status !== "BLOCKED";

  const confluence = computeDeepTechnicalConfluence({
    policy,
    structureDirection: mappedTrend.direction === "MIXED"
      ? "MIXED"
      : (primaryBundle.marketStructure?.bias === "BULLISH"
        ? "BULLISH"
        : primaryBundle.marketStructure?.bias === "BEARISH"
          ? "BEARISH"
          : primaryBundle.marketStructure?.bias === "RANGING"
            ? "NEUTRAL"
            : mappedTrend.direction),
    structureIds: primaryBundle.marketStructure ? [primaryBundle.marketStructure.assessmentId] : [],
    regimeDirection: mappedTrend.direction,
    regimeIds: primaryBundle.regime ? [primaryBundle.regime.assessmentId] : [],
    mtfDirection,
    mtfIds: mtfMapped.mtfAssessmentId ? [mtfMapped.mtfAssessmentId] : [],
    levelsDirection: levelsDir(
      primaryBundle.supportResistance,
      primaryBundle.marketStructure?.bias,
    ),
    levelsIds: [
      primaryBundle.supportResistance?.assessmentId,
      primaryBundle.liquidityReference?.assessmentId,
    ].filter((x): x is string => !!x),
    patternsDirection: patternDirFromChart(primaryBundle.chartPatterns),
    patternsIds: [
      primaryBundle.chartPatterns?.assessmentId,
      primaryBundle.harmonic?.assessmentId,
      primaryBundle.unified?.assessmentId,
      primaryBundle.fibonacci?.assessmentId,
    ].filter((x): x is string => !!x),
    momentumDirection: momentumDir(primaryBundle.momentum?.direction),
    momentumIds: primaryBundle.momentum ? [primaryBundle.momentum.assessmentId] : [],
    pressureDirection: pressureDir(primaryBundle.buyerSellerPressure?.dominantSide),
    pressureIds: primaryBundle.buyerSellerPressure
      ? [primaryBundle.buyerSellerPressure.assessmentId]
      : [],
    pressureSharesCandleBodyGroup: true,
    displacementCountedInCandleBody: displacementCounted,
  });

  const provisional = primarySnapshot.candleStatus === "FORMING_CANDLE"
    || primaryBundle.buyerSellerPressure?.provisional === true;

  let status: MifDeepTechnicalStatus = "VALID";
  if (provisional) status = "PROVISIONAL";
  if (primarySnapshot.dataQuality === "DEGRADED") status = "DEGRADED";
  if (primarySnapshot.dataQuality === "WARNING" && status === "VALID") status = "WARNING";
  if (
    mappedTrend.label === "INSUFFICIENT_DATA"
    && mtfMapped.alignment === "INSUFFICIENT_TIMEFRAME_DATA"
  ) {
    status = "INSUFFICIENT_DATA";
  }

  const supporting: string[] = [];
  const contradicting: string[] = [];
  for (const f of confluence.families) {
    if (f.counted && f.direction === "BULLISH") {
      supporting.push(`${f.family}:${f.direction}`);
    } else if (f.counted && f.direction === "BEARISH") {
      supporting.push(`${f.family}:${f.direction}`);
    }
    if (f.skipReason) contradicting.push(`${f.family}:skipped:${f.skipReason}`);
  }
  if (mtfMapped.conflictingTimeframes.length) {
    contradicting.push(`mtf_conflict:${mtfMapped.conflictingTimeframes.join(",")}`);
  }
  const pressureClass = primaryBundle.buyerSellerPressure?.dataClassification;
  if (pressureClass && pressureClass !== "DIRECTLY_MEASURED") {
    supporting.push(`pressure_classification=${pressureClass}`);
  }

  let evidenceQuality: HfmDeepTechnicalEvidenceQuality = "MODERATE";
  if (status === "INSUFFICIENT_DATA") evidenceQuality = "INSUFFICIENT_DATA";
  else if (status === "VALID" && confluence.grade === "STRONG") evidenceQuality = "HIGH";
  else if (confluence.grade === "INSUFFICIENT_DATA" || status === "DEGRADED") evidenceQuality = "LOW";

  const missingInputs: string[] = [];
  if (!input.mtfRelationships) missingInputs.push("mtfRelationships");
  for (const s of snapshots) {
    for (const m of s.missingInputs) missingInputs.push(`${s.timeframe}:${m}`);
  }

  const id = idHash({
    contractId: MIF_DEEP_TECHNICAL_CONTRACT_ID,
    providerSymbol,
    primaryTimeframe,
    model: MIF_DEEP_TECHNICAL_MODEL_VERSION,
    snaps: snapshots.map((s) => ({
      tf: s.timeframe,
      struct: s.structureAssessmentId,
      regime: s.regimeLabel,
      pressure: s.pressureAssessmentId,
    })),
    mtf: mtfMapped.mtfAssessmentId,
    confluence: confluence.grade,
  });

  return {
    contractId: MIF_DEEP_TECHNICAL_CONTRACT_ID,
    contractVersion: MIF_DEEP_TECHNICAL_CONTRACT_VERSION,
    scope: "phase06-deep-technical-intelligence",
    assessmentId: input.assessmentId ?? `dti:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    primaryTimeframe,
    instrument,
    policyId: policy.policyId || MIF_DEEP_TECHNICAL_POLICY_ID,
    policyVersion: policy.policyVersion || MIF_DEEP_TECHNICAL_POLICY_VERSION,
    engineId: MIF_DEEP_TECHNICAL_ENGINE_ID,
    engineVersion: MIF_DEEP_TECHNICAL_ENGINE_VERSION,
    modelVersion: MIF_DEEP_TECHNICAL_MODEL_VERSION,
    assessmentTimestamp,
    status,
    provisional,
    overallTrendDirection: mappedTrend.direction,
    overallTrendStrength: mappedTrend.strength,
    overallRegimeLabel: mappedTrend.label,
    primarySnapshot,
    timeframeSnapshots: snapshots,
    mtf: {
      alignment: mtfMapped.alignment,
      higherTimeframeBias: mtfMapped.higher,
      intermediateTimeframeBias: mtfMapped.intermediate,
      lowerTimeframeBias: mtfMapped.lower,
      mtfEngineRelation: mtfMapped.mtfEngineRelation,
      mtfAssessmentId: mtfMapped.mtfAssessmentId,
      framesEvaluated: mtfMapped.framesEvaluated,
      framesMissing: mtfMapped.framesMissing,
      conflictingTimeframes: mtfMapped.conflictingTimeframes,
      notes: mtfMapped.notes,
      doesNotAverageConflictingFrames: true,
    },
    confluence,
    capabilityMatrix: capabilityMatrix(primaryBundle),
    evidenceQuality,
    supportingEvidence: supporting,
    contradictingEvidence: contradicting,
    missingInputs: [...new Set(missingInputs)],
    limitations: baseLimitations,
    sourceRefs: {
      mtfAssessmentId: mtfMapped.mtfAssessmentId,
      primaryStructureId: primaryBundle.marketStructure?.assessmentId ?? null,
      primaryRegimeId: primaryBundle.regime?.assessmentId ?? null,
      primaryPressureId: primaryBundle.buyerSellerPressure?.assessmentId ?? null,
      primaryUnifiedId: primaryBundle.unified?.assessmentId ?? null,
    },
    diagnosticsSummary:
      `status=${status}; trend=${mappedTrend.label}; mtf=${mtfMapped.alignment}; `
      + `confluence=${confluence.grade}; frames=${snapshots.length}`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    isWinProbability: false,
    isEventProbability: false,
    isCalibratedProbability: false,
    doesNotConfirmOrInvalidateLifecycleAlone: true,
    elliottWaveStatus: "NOT_IMPLEMENTED",
    macdAdxBollingerStatus: "NOT_IMPLEMENTED",
    analyticalTechnicalInformationOnly: true,
  };
}
