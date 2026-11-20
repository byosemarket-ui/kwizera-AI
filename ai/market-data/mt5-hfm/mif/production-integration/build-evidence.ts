/**
 * Phase 5D.5/5D.6 — project assessments into strategy evidence refs.
 * Prefers dedicated 5D.6 engines (structure/S-R/liquidity/momentum) over regime projections.
 * Never fabricates institutional liquidity or win probabilities.
 */
import type { MifCanonicalCandle } from "../canonical/candle.js";
import type { MifCandleState } from "../canonical/types.js";
import type { MifFibonacciAssessment } from "../analysis/fibonacci/types.js";
import type { MifHarmonicAssessment } from "../analysis/harmonics/types.js";
import type { MifLiquidityReferenceAssessment } from "../analysis/liquidity-reference/types.js";
import type { MifMarketStructureAssessment } from "../analysis/market-structure/types.js";
import type { MifMomentumAssessment } from "../analysis/momentum/types.js";
import type { MifPriceDisplacementAssessment } from "../analysis/price-displacement/types.js";
import type { MifMtfRelationshipsAssessment } from "../analysis/mtf-relationships/types.js";
import type { MifChartPatternAssessment } from "../analysis/patterns/types.js";
import type { MifMarketRegimeAssessment } from "../analysis/regime/types.js";
import type { MifSupportResistanceAssessment } from "../analysis/support-resistance/types.js";
import type { MifUnifiedChartAnalysisAssessment } from "../analysis/unified/types.js";
import type { MifStep1DataIntegrityAssessment } from "../quality/types.js";
import { getDefaultMifStrategyIntelligenceRegistry } from "../strategy-intelligence/registry.js";
import type {
  MifEvidenceFamily,
  MifEvidencePresence,
  MifStrategyEvidenceRequirement,
} from "../strategy-intelligence/types.js";
import type { MifDetectionEvidenceRef } from "../opportunity-detection/types.js";

type QualityStatus = MifDetectionEvidenceRef["qualityStatus"];

function mapAssessmentStatus(status: string | null | undefined): QualityStatus {
  switch (String(status || "").toUpperCase()) {
    case "VALID":
    case "CONFIRMED":
      return "VALID";
    case "WARNING":
    case "PROVISIONAL":
      return "WARNING";
    case "DEGRADED":
      return "DEGRADED";
    case "BLOCKED":
      return "BLOCKED";
    case "INSUFFICIENT_DATA":
    case "MISSING":
      return "MISSING";
    default:
      return "UNKNOWN";
  }
}

function tipCandleState(candles: readonly MifCanonicalCandle[]): MifCandleState | null {
  if (!candles.length) return null;
  return candles[candles.length - 1]!.candleState;
}

function usableQuality(q: QualityStatus): boolean {
  return q === "VALID" || q === "WARNING" || q === "DEGRADED";
}

function ref(partial: {
  evidenceId: string;
  family: MifEvidenceFamily;
  presence: MifEvidencePresence;
  qualityStatus: QualityStatus;
  sourceEngine: string | null;
  sourceContractId: string | null;
  sourceContractVersion: string | null;
  sourcePolicyVersion: string | null;
  sourceAssessmentId: string | null;
  sourceInputIdentity: string | null;
  timeframe: string | null;
  timeframeRole: MifDetectionEvidenceRef["timeframeRole"];
  assessmentTimestamp: string | null;
  candleState: MifCandleState | null;
  notes?: string;
}): MifDetectionEvidenceRef {
  return {
    evidenceId: partial.evidenceId,
    family: partial.family,
    presence: partial.presence,
    sourceEngine: partial.sourceEngine,
    sourceContractId: partial.sourceContractId,
    sourceContractVersion: partial.sourceContractVersion,
    sourcePolicyVersion: partial.sourcePolicyVersion,
    sourceAssessmentId: partial.sourceAssessmentId,
    sourceInputIdentity: partial.sourceInputIdentity,
    timeframe: partial.timeframe,
    timeframeRole: partial.timeframeRole,
    assessmentTimestamp: partial.assessmentTimestamp,
    qualityStatus: partial.qualityStatus,
    candleState: partial.candleState,
    ...(partial.notes ? { notes: partial.notes } : {}),
  };
}

function collectCatalogRequirements(): MifStrategyEvidenceRequirement[] {
  const reg = getDefaultMifStrategyIntelligenceRegistry();
  const out: MifStrategyEvidenceRequirement[] = [];
  const seen = new Set<string>();
  for (const s of reg.listStrategies()) {
    for (const req of [...s.requiredEvidence, ...s.optionalEvidence]) {
      if (seen.has(req.evidenceId)) continue;
      seen.add(req.evidenceId);
      out.push(req);
    }
  }
  return out;
}

export interface BuildProductionEvidenceInput {
  primaryTimeframe: string;
  assessmentTimestamp: string;
  dataQualityStatus: "VALID" | "WARNING" | "DEGRADED" | "BLOCKED" | "MISSING";
  integrity: MifStep1DataIntegrityAssessment | null;
  regime: MifMarketRegimeAssessment | null;
  fibonacci: MifFibonacciAssessment | null;
  chartPatterns: MifChartPatternAssessment | null;
  harmonic: MifHarmonicAssessment | null;
  /** Retained for call-site symmetry; OD context attaches unified separately. */
  unified?: MifUnifiedChartAnalysisAssessment | null;
  mtf: MifMtfRelationshipsAssessment | null;
  marketStructure?: MifMarketStructureAssessment | null;
  supportResistance?: MifSupportResistanceAssessment | null;
  liquidityReference?: MifLiquidityReferenceAssessment | null;
  momentum?: MifMomentumAssessment | null;
  priceDisplacement?: MifPriceDisplacementAssessment | null;
  primaryCandles: readonly MifCanonicalCandle[];
}

/**
 * Build one evidence ref per catalog evidenceId from available assessments.
 */
export function buildProductionEvidenceRefs(
  input: BuildProductionEvidenceInput,
): MifDetectionEvidenceRef[] {
  void input.unified;
  const tip = tipCandleState(input.primaryCandles);
  const tf = input.primaryTimeframe;
  const ts = input.assessmentTimestamp;
  const reqs = collectCatalogRequirements();
  const out: MifDetectionEvidenceRef[] = [];

  const regimeQ = mapAssessmentStatus(input.regime?.status);
  const mtfQ = mapAssessmentStatus(input.mtf?.status);
  const fibQ = mapAssessmentStatus(input.fibonacci?.status);
  const geoQ = mapAssessmentStatus(input.chartPatterns?.status);
  const harQ = mapAssessmentStatus(input.harmonic?.status);
  const qualityQ = mapAssessmentStatus(input.dataQualityStatus);
  const structureQ = mapAssessmentStatus(input.marketStructure?.status);
  const srQ = mapAssessmentStatus(input.supportResistance?.status);
  const liqQ = mapAssessmentStatus(input.liquidityReference?.status);
  const momQ = mapAssessmentStatus(input.momentum?.status);
  const pdQ = mapAssessmentStatus(
    input.priceDisplacement?.status === "PROVISIONAL"
      ? "WARNING"
      : input.priceDisplacement?.status,
  );

  const structureEnginePresent =
    !!input.marketStructure
    && usableQuality(structureQ)
    && input.marketStructure.primaryRef != null;
  const srEnginePresent =
    !!input.supportResistance
    && usableQuality(srQ)
    && input.supportResistance.primaryBoundary != null;
  const liqEnginePresent =
    !!input.liquidityReference
    && usableQuality(liqQ)
    && input.liquidityReference.primaryReference != null;
  const momEnginePresent =
    !!input.momentum
    && usableQuality(momQ)
    && input.momentum.direction !== "UNKNOWN"
    && input.momentum.phase !== "INSUFFICIENT_EVIDENCE";

  const displacementEnginePresent =
    !!input.priceDisplacement
    && (
      input.priceDisplacement.confirmed
      || input.priceDisplacement.displacementKind === "NO_DISPLACEMENT"
      || input.priceDisplacement.provisional
    )
    && input.priceDisplacement.displacementKind !== "BLOCKED_BY_QUALITY"
    && input.priceDisplacement.displacementKind !== "INVALID"
    && input.priceDisplacement.displacementKind !== "INSUFFICIENT_DATA";

  const regimePresent =
    !!input.regime
    && usableQuality(regimeQ)
    && input.regime.structure !== "UNKNOWN";

  const mtfPresent =
    !!input.mtf
    && usableQuality(mtfQ)
    && input.mtf.directional.relation !== "INSUFFICIENT_DATA"
    && input.mtf.directional.relation !== "UNKNOWN";

  const fibPresent =
    !!input.fibonacci
    && usableQuality(fibQ)
    && ((input.fibonacci.retracements?.length ?? 0) > 0
      || (input.fibonacci.extensions?.length ?? 0) > 0
      || input.fibonacci.orientation != null);

  const geoPresent =
    !!input.chartPatterns
    && usableQuality(geoQ)
    && (input.chartPatterns.detections?.length ?? 0) > 0;

  const harmonicDetectionCount = input.harmonic?.detections?.length ?? 0;
  const harPresent =
    !!input.harmonic && usableQuality(harQ) && harmonicDetectionCount > 0;

  const structurePartialPresent =
    regimePresent
    && (input.regime!.structure === "TRENDING"
      || input.regime!.structure === "RANGING"
      || input.regime!.structure === "BREAKOUT"
      || input.regime!.structure === "TRANSITION");

  /** Regime fallback only when dedicated engine did not produce usable evidence. */
  const displacementRegimeFallback =
    !displacementEnginePresent
    && regimePresent
    && (
      (typeof input.regime!.trendEvidence?.displacementAtr === "number"
        && Number.isFinite(input.regime!.trendEvidence.displacementAtr))
      || (typeof input.regime!.breakoutEvidence?.displacementAtr === "number"
        && Number.isFinite(input.regime!.breakoutEvidence.displacementAtr))
    );

  const volPresent =
    regimePresent
    && input.regime!.volatility !== "UNKNOWN";

  const rangePresent =
    regimePresent
    && input.regime!.structure === "RANGING"
    && input.regime!.rangeEvidence != null
    && (input.regime!.rangeEvidence.high != null || input.regime!.rangeEvidence.low != null);

  const boundaryPresent =
    rangePresent
    || (regimePresent
      && input.regime!.breakoutEvidence?.boundary != null);

  const candleConfirmPresent = tip === "CLOSED";

  for (const req of reqs) {
    const family = req.family;
    let presence: MifEvidencePresence = "ABSENT";
    let qualityStatus: QualityStatus = "MISSING";
    let sourceEngine: string | null = null;
    let sourceContractId: string | null = null;
    let sourceContractVersion: string | null = null;
    let sourcePolicyVersion: string | null = null;
    let sourceAssessmentId: string | null = null;
    let sourceInputIdentity: string | null = null;
    let candleState: MifCandleState | null = tip;
    let notes: string | undefined;

    if (req.availability === "UNSUPPORTED") {
      presence = "UNSUPPORTED";
      qualityStatus = "MISSING";
      notes = "upstream availability UNSUPPORTED — not fabricated";
    } else {
      switch (family) {
        case "DATA_QUALITY": {
          presence = input.integrity || input.dataQualityStatus !== "MISSING" ? "PRESENT" : "ABSENT";
          qualityStatus = qualityQ;
          sourceEngine = input.integrity?.engineId ?? "mif-quality-step1";
          sourceContractId = input.integrity?.contractId ?? null;
          sourceContractVersion = input.integrity?.contractVersion ?? null;
          sourcePolicyVersion = input.integrity?.policyVersion ?? null;
          sourceAssessmentId = input.integrity?.assessmentId ?? null;
          sourceInputIdentity = input.integrity?.inputIdentity ?? null;
          candleState = null;
          notes = `dataQualityStatus=${input.dataQualityStatus}`;
          break;
        }
        case "MARKET_REGIME": {
          if (regimePresent) {
            presence = "PRESENT";
            qualityStatus = regimeQ;
            sourceEngine = input.regime!.engineId;
            sourceContractId = input.regime!.contractId;
            sourceContractVersion = input.regime!.contractVersion;
            sourcePolicyVersion = input.regime!.policyVersion;
            sourceAssessmentId = input.regime!.assessmentId;
            sourceInputIdentity = input.regime!.inputIdentity;
            notes = [
              `direction=${input.regime!.direction}`,
              `structure=${input.regime!.structure}`,
              `volatility=${input.regime!.volatility}`,
            ].join("; ");
          } else if (input.regime) {
            presence = "INVALID";
            qualityStatus = regimeQ;
            sourceAssessmentId = input.regime.assessmentId;
            notes = `regime present but unusable status=${input.regime.status}`;
          }
          break;
        }
        case "MULTI_TIMEFRAME_RELATIONSHIP": {
          if (mtfPresent) {
            presence = "PRESENT";
            qualityStatus = mtfQ;
            sourceEngine = input.mtf!.engineId;
            sourceContractId = input.mtf!.contractId;
            sourceContractVersion = input.mtf!.contractVersion;
            sourcePolicyVersion = input.mtf!.policyVersion;
            sourceAssessmentId = input.mtf!.assessmentId;
            sourceInputIdentity = input.mtf!.inputIdentity;
            notes = [
              `relation=${input.mtf!.directional.relation}`,
              `hasConflict=${input.mtf!.conflicts.hasConflict}`,
              `conflictKind=${input.mtf!.conflicts.conflictKind ?? "none"}`,
              `pullbackCompatible=${input.mtf!.conflicts.pullbackCompatible}`,
            ].join("; ");
          } else if (input.mtf) {
            presence = "ABSENT";
            qualityStatus = mtfQ;
            sourceAssessmentId = input.mtf.assessmentId;
            notes = `relation=${input.mtf.directional.relation}; status=${input.mtf.status}`;
          }
          break;
        }
        case "FIBONACCI": {
          if (fibPresent) {
            presence = "PRESENT";
            qualityStatus = fibQ;
            sourceEngine = input.fibonacci!.engineId;
            sourceContractId = input.fibonacci!.contractId;
            sourceContractVersion = input.fibonacci!.contractVersion;
            sourcePolicyVersion = input.fibonacci!.policyVersion;
            sourceAssessmentId = input.fibonacci!.assessmentId;
            sourceInputIdentity = input.fibonacci!.inputIdentity;
            notes = `orientation=${input.fibonacci!.orientation ?? "none"}; grade=from_assessment`;
          } else if (input.fibonacci) {
            presence = "ABSENT";
            qualityStatus = fibQ;
            sourceAssessmentId = input.fibonacci.assessmentId;
            notes = `fibonacci status=${input.fibonacci.status}; no actionable levels`;
          }
          break;
        }
        case "GEOMETRIC_PATTERN": {
          if (geoPresent) {
            presence = "PRESENT";
            qualityStatus = geoQ;
            sourceEngine = input.chartPatterns!.engineId;
            sourceContractId = input.chartPatterns!.contractId;
            sourceContractVersion = input.chartPatterns!.contractVersion;
            sourcePolicyVersion = input.chartPatterns!.policyVersion;
            sourceAssessmentId = input.chartPatterns!.assessmentId;
            sourceInputIdentity = input.chartPatterns!.inputIdentity;
            const first = input.chartPatterns!.detections[0]!;
            notes = [
              `patternType=${first.patternType}`,
              `lifecycle=${first.lifecycle}`,
              `count=${input.chartPatterns!.detections.length}`,
            ].join("; ");
          } else if (input.chartPatterns) {
            presence = "ABSENT";
            qualityStatus = geoQ;
            sourceAssessmentId = input.chartPatterns.assessmentId;
            notes = `geometric status=${input.chartPatterns.status}; detections=0`;
          }
          break;
        }
        case "HARMONIC_PATTERN": {
          if (harPresent) {
            presence = "PRESENT";
            qualityStatus = harQ;
            sourceEngine = input.harmonic!.engineId;
            sourceContractId = input.harmonic!.contractId;
            sourceContractVersion = input.harmonic!.contractVersion;
            sourcePolicyVersion = input.harmonic!.policyVersion;
            sourceAssessmentId = input.harmonic!.assessmentId;
            sourceInputIdentity = input.harmonic!.inputIdentity;
            notes = `harmonic detections=${harmonicDetectionCount}; status=${input.harmonic!.status}`;
          } else if (input.harmonic) {
            presence = "ABSENT";
            qualityStatus = harQ;
            sourceAssessmentId = input.harmonic.assessmentId;
            notes = `harmonic status=${input.harmonic.status}; detections=0`;
          }
          break;
        }
        case "MARKET_STRUCTURE": {
          if (structureEnginePresent) {
            const pref = input.marketStructure!.primaryRef!;
            presence = "PRESENT";
            qualityStatus = structureQ;
            sourceEngine = input.marketStructure!.engineId;
            sourceContractId = input.marketStructure!.contractId;
            sourceContractVersion = input.marketStructure!.contractVersion;
            sourcePolicyVersion = input.marketStructure!.policyVersion;
            sourceAssessmentId = input.marketStructure!.assessmentId;
            sourceInputIdentity = input.marketStructure!.inputIdentity;
            notes = [
              `refId=${pref.refId}`,
              `refType=${pref.refType}`,
              `refSide=${pref.refSide}`,
              `confirmed=TRUE`,
              `swingState=CONFIRMED`,
              `temporalOrder=BEFORE_SWEEP`,
              `bias=${input.marketStructure!.bias}`,
              `price=${pref.price}`,
            ].join("; ");
          } else if (structurePartialPresent) {
            presence = "PRESENT";
            qualityStatus = regimeQ;
            sourceEngine = input.regime!.engineId;
            sourceContractId = input.regime!.contractId;
            sourceContractVersion = input.regime!.contractVersion;
            sourcePolicyVersion = input.regime!.policyVersion;
            sourceAssessmentId = input.regime!.assessmentId;
            sourceInputIdentity = input.regime!.inputIdentity;
            notes = `PARTIAL projection from regime.structure=${input.regime!.structure}; dedicated structure engine unavailable`;
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "MARKET_STRUCTURE — no dedicated or regime projection available";
          }
          break;
        }
        case "PRICE_DISPLACEMENT": {
          if (displacementEnginePresent && input.priceDisplacement) {
            const pd = input.priceDisplacement;
            const m = pd.metrics;
            presence = "PRESENT";
            qualityStatus = pd.provisional
              ? "WARNING"
              : pd.confirmed
                ? pdQ
                : pd.displacementKind === "NO_DISPLACEMENT"
                  ? pdQ
                  : "DEGRADED";
            sourceEngine = pd.engineId;
            sourceContractId = pd.contractId;
            sourceContractVersion = pd.contractVersion;
            sourcePolicyVersion = pd.policyVersion;
            sourceAssessmentId = pd.assessmentId;
            sourceInputIdentity = pd.inputIdentity;
            candleState = m?.candleState === "CLOSED" || m?.candleState === "FORMING"
              ? m.candleState
              : tip;
            const dir =
              pd.displacementKind === "BULLISH_DISPLACEMENT"
                ? "UP"
                : pd.displacementKind === "BEARISH_DISPLACEMENT"
                  ? "DOWN"
                  : m?.direction === "UP" || m?.direction === "DOWN"
                    ? m.direction
                    : "NONE";
            const expanding =
              m?.trueRangeAtr != null && m.trueRangeAtr >= 1.2;
            const phase = pd.provisional
              ? "FORMING"
              : expanding
                ? "EXPANDING"
                : pd.confirmed
                  ? "EXPANDING"
                  : "STABLE";
            notes = [
              `kind=${pd.displacementKind}`,
              `direction=${dir}`,
              `phase=${phase}`,
              `atrExpand=${expanding ? "TRUE" : "FALSE"}`,
              `expand=${expanding || pd.confirmed ? "TRUE" : "FALSE"}`,
              `magnitude=${m?.bodyAtr ?? "null"}`,
              `trAtr=${m?.trueRangeAtr ?? "null"}`,
              `closeLoc=${m?.closeLocation ?? "null"}`,
              `closeState=${m?.candleState ?? tip ?? "UNKNOWN"}`,
              `strongCandle=${m?.strongCandle === true ? "TRUE" : "FALSE"}`,
              `structuralBreak=${m?.structuralBreak === true ? "TRUE" : "FALSE"}`,
              `structuralDisplacement=${pd.structuralDisplacement ? "TRUE" : "FALSE"}`,
              `candleOnly=${m?.strongCandle && !pd.structuralDisplacement ? "TRUE" : "FALSE"}`,
              `confirmed=${pd.confirmed ? "TRUE" : "FALSE"}`,
              `provisional=${pd.provisional ? "TRUE" : "FALSE"}`,
              `openTimeSec=${m?.openTimeSec ?? "null"}`,
              `engine=mif-price-displacement`,
              `contract=${pd.contractId}@${pd.contractVersion}`,
            ].join("; ");
          } else if (displacementRegimeFallback) {
            // Explicit PARTIAL fallback when dedicated engine unavailable.
            presence = "PRESENT";
            qualityStatus = "DEGRADED";
            sourceEngine = input.regime!.engineId;
            sourceContractId = input.regime!.contractId;
            sourceAssessmentId = input.regime!.assessmentId;
            const atr = input.regime!.trendEvidence?.displacementAtr
              ?? input.regime!.breakoutEvidence?.displacementAtr;
            const dir =
              input.regime!.direction === "UP"
                ? "UP"
                : input.regime!.direction === "DOWN"
                  ? "DOWN"
                  : "UNKNOWN";
            const expanding =
              (typeof atr === "number" && atr >= 1)
              || input.momentum?.phase === "EXPANDING";
            notes = [
              `direction=${dir}`,
              `phase=${expanding ? "EXPANDING" : "STABLE"}`,
              `atrExpand=${expanding ? "TRUE" : "FALSE"}`,
              `expand=${expanding ? "TRUE" : "FALSE"}`,
              `magnitude=${atr ?? "null"}`,
              `closeState=${tip === "CLOSED" ? "CLOSED" : tip ?? "UNKNOWN"}`,
              `PARTIAL from regime displacementAtr — dedicated engine unavailable`,
            ].join("; ");
          } else if (input.priceDisplacement) {
            presence = "ABSENT";
            qualityStatus = pdQ === "UNKNOWN" ? "MISSING" : pdQ;
            sourceAssessmentId = input.priceDisplacement.assessmentId;
            notes = `PRICE_DISPLACEMENT status=${input.priceDisplacement.status} kind=${input.priceDisplacement.displacementKind}`;
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "PRICE_DISPLACEMENT — dedicated engine and regime fallback both unavailable";
          }
          break;
        }
        case "VOLATILITY": {
          if (volPresent) {
            presence = "PRESENT";
            qualityStatus = regimeQ;
            sourceEngine = input.regime!.engineId;
            sourceAssessmentId = input.regime!.assessmentId;
            const expanding =
              input.regime!.volatility === "HIGH" || input.regime!.volatility === "EXTREME";
            notes = [
              `volState=${input.regime!.volatility}`,
              `volatility=${input.regime!.volatility}`,
              `expand=${expanding ? "TRUE" : "FALSE"}`,
              `directional=${input.regime!.direction === "UP" || input.regime!.direction === "DOWN" ? "TRUE" : "FALSE"}`,
              `atrRatio=${input.regime!.volatilityEvidence?.atrRatio ?? "null"}`,
            ].join("; ");
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "volatility UNKNOWN or regime unusable";
          }
          break;
        }
        case "RANGE_STRUCTURE": {
          if (rangePresent) {
            presence = "PRESENT";
            qualityStatus = regimeQ;
            sourceEngine = input.regime!.engineId;
            sourceAssessmentId = input.regime!.assessmentId;
            notes = [
              `rangeHigh=${input.regime!.rangeEvidence.high}`,
              `rangeLow=${input.regime!.rangeEvidence.low}`,
              `high=${input.regime!.rangeEvidence.high}`,
              `low=${input.regime!.rangeEvidence.low}`,
            ].join("; ");
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "RANGE_STRUCTURE absent — regime not ranging with bounds";
          }
          break;
        }
        case "SUPPORT_RESISTANCE": {
          if (srEnginePresent) {
            const b = input.supportResistance!.primaryBoundary!;
            const active = input.supportResistance!.boundaries.filter(
              (x) => x.lifecycle === "ACTIVE",
            );
            const bestSupport = active
              .filter((x) => x.kind === "SUPPORT")
              .sort((a, c) => c.touchCount - a.touchCount)[0] ?? null;
            const bestResistance = active
              .filter((x) => x.kind === "RESISTANCE")
              .sort((a, c) => c.touchCount - a.touchCount)[0] ?? null;
            presence = "PRESENT";
            qualityStatus = srQ;
            sourceEngine = input.supportResistance!.engineId;
            sourceContractId = input.supportResistance!.contractId;
            sourceContractVersion = input.supportResistance!.contractVersion;
            sourcePolicyVersion = input.supportResistance!.policyVersion;
            sourceAssessmentId = input.supportResistance!.assessmentId;
            sourceInputIdentity = input.supportResistance!.inputIdentity;
            notes = [
              `boundaryId=${b.boundaryId}`,
              `kind=${b.kind}`,
              `mid=${b.mid}`,
              `high=${b.high}`,
              `low=${b.low}`,
              bestSupport ? `supportMid=${bestSupport.mid}` : null,
              bestResistance ? `resistanceMid=${bestResistance.mid}` : null,
              `lifecycle=${b.lifecycle}`,
              `touchCount=${b.touchCount}`,
            ].filter(Boolean).join("; ");
          } else if (boundaryPresent) {
            presence = "PRESENT";
            qualityStatus = regimeQ;
            sourceEngine = input.regime!.engineId;
            sourceAssessmentId = input.regime!.assessmentId;
            notes = `PARTIAL boundary from regime range/breakout; boundary=${input.regime!.breakoutEvidence?.boundary ?? "range"}`;
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "SUPPORT_RESISTANCE — no dedicated boundary or regime projection";
          }
          break;
        }
        case "CANDLE_CONFIRMATION": {
          const tipObs = input.liquidityReference?.tipObservation;
          if (candleConfirmPresent) {
            presence = "PRESENT";
            qualityStatus = "VALID";
            candleState = "CLOSED";
            notes = tipObs
              ? [
                  `closeState=CLOSED`,
                  `excursion=${tipObs.excursion}`,
                  `reclaim=${tipObs.reclaim === "YES" ? "TRUE" : tipObs.reclaim === "NO" ? "FALSE" : "UNKNOWN"}`,
                  `accepted=${tipObs.accepted ? "TRUE" : "FALSE"}`,
                  tipObs.accepted ? "reject=FALSE" : "reject=TRUE",
                ].join("; ")
              : "tip candle CLOSED from canonical series; closeState=CLOSED";
          } else if (tip === "FORMING") {
            presence = "PRESENT";
            qualityStatus = "WARNING";
            candleState = "FORMING";
            notes = "tip candle FORMING — closed confirmation not satisfied; closeState=FORMING";
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = `tip candle state=${tip ?? "none"}`;
          }
          break;
        }
        case "LIQUIDITY_REFERENCE": {
          if (liqEnginePresent) {
            const r = input.liquidityReference!.primaryReference!;
            presence = "PRESENT";
            qualityStatus = liqQ;
            sourceEngine = input.liquidityReference!.engineId;
            sourceContractId = input.liquidityReference!.contractId;
            sourceContractVersion = input.liquidityReference!.contractVersion;
            sourcePolicyVersion = input.liquidityReference!.policyVersion;
            sourceAssessmentId = input.liquidityReference!.assessmentId;
            sourceInputIdentity = input.liquidityReference!.inputIdentity;
            notes = [
              `refId=${r.referenceId}`,
              `refType=${r.refType}`,
              `refSide=${r.refSide}`,
              `price=${r.price}`,
              `confirmed=TRUE`,
              `lifecycle=${r.lifecycle}`,
              `doesNotClaimRestingOrders=TRUE`,
            ].join("; ");
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "LIQUIDITY_REFERENCE — dedicated engine produced no usable reference";
          }
          break;
        }
        case "MOMENTUM": {
          if (momEnginePresent) {
            presence = "PRESENT";
            qualityStatus = momQ;
            sourceEngine = input.momentum!.engineId;
            sourceContractId = input.momentum!.contractId;
            sourceContractVersion = input.momentum!.contractVersion;
            sourcePolicyVersion = input.momentum!.policyVersion;
            sourceAssessmentId = input.momentum!.assessmentId;
            sourceInputIdentity = input.momentum!.inputIdentity;
            notes = [
              `direction=${input.momentum!.direction}`,
              `phase=${input.momentum!.phase}`,
              `fabricated=FALSE`,
              `notWinProbability=TRUE`,
            ].join("; ");
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "MOMENTUM — dedicated engine insufficient or absent; not fabricated";
          }
          break;
        }
        default: {
          presence = "ABSENT";
          qualityStatus = "MISSING";
          notes = `family ${family} unmapped — left ABSENT`;
        }
      }
    }

    // Prefer primary unified tip timeframe role INTERMEDIATE for primary TF
    out.push(
      ref({
        evidenceId: req.evidenceId,
        family,
        presence,
        qualityStatus,
        sourceEngine,
        sourceContractId,
        sourceContractVersion,
        sourcePolicyVersion,
        sourceAssessmentId,
        sourceInputIdentity,
        timeframe: tf,
        timeframeRole: "INTERMEDIATE_STRUCTURE",
        assessmentTimestamp: ts,
        candleState,
        notes,
      }),
    );
  }

  // Stable order by evidenceId
  out.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  return out;
}
