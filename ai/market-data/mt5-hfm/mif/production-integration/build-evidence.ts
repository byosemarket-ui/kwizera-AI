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
import type { MifBuyerSellerPressureAssessment } from "../analysis/buyer-seller-pressure/types.js";
import type { MifDeepTechnicalIntelligenceAssessment } from "../analysis/deep-technical-intelligence/types.js";
import type { MifCandlestickPatternsAssessment } from "../analysis/candlestick-patterns/assess-candlestick-patterns.js";
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
import type {
  MifDetectionEvidenceLevel,
  MifDetectionEvidenceMeasurement,
  MifDetectionEvidenceRef,
} from "../opportunity-detection/types.js";
import {
  classifyRegimeDtiStructureConflict,
  formatConflictNotes,
} from "./engine-conflict.js";

type QualityStatus = MifDetectionEvidenceRef["qualityStatus"];

function meas(
  id: string,
  value: number | string | boolean | null,
  unit: string | null = null,
  note: string | null = null,
): MifDetectionEvidenceMeasurement {
  return { id, name: id, value, unit, note };
}

function lvl(
  id: string,
  kind: string,
  price: number | null,
  side: MifDetectionEvidenceLevel["side"] = null,
  note: string | null = null,
): MifDetectionEvidenceLevel {
  return { id, kind, price, side, note };
}

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

/**
 * Prefer last CLOSED candle for assessment grounding.
 * Live Charts snapshots always append a FORMING tip — labeling every evidence
 * ref as FORMING incorrectly blocks confirmation and misleads AI.
 */
function assessmentCandleState(candles: readonly MifCanonicalCandle[]): MifCandleState | null {
  if (!candles.length) return null;
  for (let i = candles.length - 1; i >= 0; i -= 1) {
    const state = candles[i]!.candleState;
    if (state === "CLOSED") return "CLOSED";
  }
  return candles[candles.length - 1]!.candleState;
}

/** Tip state only — used when an assessment is explicitly provisional on the forming tip. */
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
  measurements?: readonly MifDetectionEvidenceMeasurement[];
  levels?: readonly MifDetectionEvidenceLevel[];
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
    ...(partial.measurements?.length ? { measurements: partial.measurements } : {}),
    ...(partial.levels?.length ? { levels: partial.levels } : {}),
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
  buyerSellerPressure?: MifBuyerSellerPressureAssessment | null;
  deepTechnicalIntelligence?: MifDeepTechnicalIntelligenceAssessment | null;
  candlestickPatterns?: MifCandlestickPatternsAssessment | null;
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
  const closedOrTip = assessmentCandleState(input.primaryCandles) ?? tip;
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
    let candleState: MifCandleState | null = closedOrTip;
    let notes: string | undefined;
    let measurements: MifDetectionEvidenceMeasurement[] = [];
    let levels: MifDetectionEvidenceLevel[] = [];

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
            const fib = input.fibonacci!;
            presence = "PRESENT";
            qualityStatus = fibQ;
            sourceEngine = fib.engineId;
            sourceContractId = fib.contractId;
            sourceContractVersion = fib.contractVersion;
            sourcePolicyVersion = fib.policyVersion;
            sourceAssessmentId = fib.assessmentId;
            sourceInputIdentity = fib.inputIdentity;
            notes = [
              `orientation=${fib.orientation ?? "none"}`,
              `grade=from_assessment`,
              fib.anchorA ? `anchorA=${fib.anchorA.price}@${fib.anchorA.timeSec}` : null,
              fib.anchorB ? `anchorB=${fib.anchorB.price}@${fib.anchorB.timeSec}` : null,
            ].filter(Boolean).join("; ");
            if (fib.anchorA) {
              levels.push(lvl(
                `fib.anchorA.${fib.anchorA.swingId}`,
                "FIBONACCI_ANCHOR",
                fib.anchorA.price,
                fib.anchorA.kind === "HIGH" ? "HIGH" : "LOW",
                `swingId=${fib.anchorA.swingId};status=CONFIRMED`,
              ));
            }
            if (fib.anchorB) {
              levels.push(lvl(
                `fib.anchorB.${fib.anchorB.swingId}`,
                "FIBONACCI_ANCHOR",
                fib.anchorB.price,
                fib.anchorB.kind === "HIGH" ? "HIGH" : "LOW",
                `swingId=${fib.anchorB.swingId};status=CONFIRMED`,
              ));
            }
            for (const r of fib.retracements.slice(0, 8)) {
              levels.push(lvl(
                `fib.ret.${r.ratio}`,
                "FIBONACCI_RETRACEMENT",
                r.price,
                "MID",
                `ratio=${r.ratio};method=swing_anchors`,
              ));
              measurements.push(meas(`fibRetracement_${r.ratio}`, r.price, "price", `ratio=${r.ratio}`));
            }
            for (const e of fib.extensions.slice(0, 4)) {
              levels.push(lvl(
                `fib.ext.${e.ratio}`,
                "FIBONACCI_EXTENSION",
                e.price,
                "MID",
                `ratio=${e.ratio};method=swing_anchors`,
              ));
            }
            measurements.push(
              meas("symbol", fib.providerSymbol, null, null),
              meas("timeframe", fib.timeframe, null, null),
              meas("calculationStatus", fib.status, null, null),
            );
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
            const ms = input.marketStructure!;
            const pref = ms.primaryRef!;
            presence = "PRESENT";
            qualityStatus = structureQ;
            sourceEngine = ms.engineId;
            sourceContractId = ms.contractId;
            sourceContractVersion = ms.contractVersion;
            sourcePolicyVersion = ms.policyVersion;
            sourceAssessmentId = ms.assessmentId;
            sourceInputIdentity = ms.inputIdentity;
            notes = [
              `refId=${pref.refId}`,
              `refType=${pref.refType}`,
              `refSide=${pref.refSide}`,
              `confirmed=TRUE`,
              `swingState=CONFIRMED`,
              `temporalOrder=BEFORE_SWEEP`,
              `bias=${ms.bias}`,
              `price=${pref.price}`,
            ].join("; ");
            levels.push(lvl(
              pref.refId,
              pref.refType || "STRUCTURE_REF",
              pref.price,
              pref.refSide === "BUY_SIDE" ? "HIGH" : pref.refSide === "SELL_SIDE" ? "LOW" : "OTHER",
              `confirmed=TRUE;bias=${ms.bias};engine=${ms.engineId}`,
            ));
            measurements.push(
              meas("symbol", ms.providerSymbol, null, null),
              meas("timeframe", ms.timeframe, null, null),
              meas("bias", ms.bias, null, null),
              meas("structurePrice", pref.price, "price", `refId=${pref.refId}`),
              meas("calculationStatus", ms.status, null, null),
              meas("dataQualityStatus", structureQ, null, null),
            );
            for (const ev of (ms.events ?? []).slice(-4)) {
              measurements.push(meas(
                `event_${ev.type}_${ev.status}`,
                ev.priceLevel ?? null,
                "price",
                `type=${ev.type};status=${ev.status}`,
              ));
            }
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
              `atr=${m?.atr ?? "null"}`,
              `atrPeriod=${m?.atrPeriod ?? pd.calculationParameters.atrPeriod}`,
              `atrMethod=${m?.atrMethodId ?? pd.calculationParameters.atrMethodId}`,
              `atrUnit=price`,
              `closeLoc=${m?.closeLocation ?? "null"}`,
              `closeState=${m?.candleState ?? tip ?? "UNKNOWN"}`,
              `strongCandle=${m?.strongCandle === true ? "TRUE" : "FALSE"}`,
              `structuralBreak=${m?.structuralBreak === true ? "TRUE" : "FALSE"}`,
              `structuralDisplacement=${pd.structuralDisplacement ? "TRUE" : "FALSE"}`,
              `candleOnly=${m?.strongCandle && !pd.structuralDisplacement ? "TRUE" : "FALSE"}`,
              `confirmed=${pd.confirmed ? "TRUE" : "FALSE"}`,
              `provisional=${pd.provisional ? "TRUE" : "FALSE"}`,
              `openTimeSec=${m?.openTimeSec ?? "null"}`,
              `closeTimeSec=${m?.closeTimeSec ?? "null"}`,
              `engine=mif-price-displacement`,
              `contract=${pd.contractId}@${pd.contractVersion}`,
            ].join("; ");
            measurements.push(
              meas("symbol", pd.providerSymbol, null, null),
              meas("timeframe", pd.timeframe, null, null),
              meas("atr", m?.atr ?? null, "price", "ATR absolute (SMA-of-TR); not a ratio"),
              meas("atrPeriod", m?.atrPeriod ?? pd.calculationParameters.atrPeriod, "bars", null),
              meas("atrMethod", m?.atrMethodId ?? pd.calculationParameters.atrMethodId, null, null),
              meas("trAtr", m?.trueRangeAtr ?? null, "atr_ratio", "trueRange/ATR — dimensionless"),
              meas("bodyAtr", m?.bodyAtr ?? null, "atr_ratio", "body/ATR — dimensionless"),
              meas("tipOpenTimeSec", m?.openTimeSec ?? null, "unix_sec", null),
              meas("tipCloseTimeSec", m?.closeTimeSec ?? null, "unix_sec", null),
              meas("candleState", m?.candleState ?? tip ?? "UNKNOWN", null, null),
              meas("calculationStatus", pd.status, null, null),
              meas("dataQualityStatus", qualityStatus, null, null),
              meas("snapshotRef", pd.assessmentId, null, null),
            );
            if (m?.structuralBoundaryPrice != null) {
              levels.push(lvl(
                m.structuralBoundaryRefId ?? "displacement.boundary",
                "DISPLACEMENT_BOUNDARY",
                m.structuralBoundaryPrice,
                m.structuralBoundarySide === "RESISTANCE"
                  ? "HIGH"
                  : m.structuralBoundarySide === "SUPPORT"
                    ? "LOW"
                    : "OTHER",
                `side=${m.structuralBoundarySide}`,
              ));
            }
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
            levels.push(lvl(
              b.boundaryId,
              b.kind,
              b.mid,
              "MID",
              `high=${b.high};low=${b.low};lifecycle=${b.lifecycle};touchCount=${b.touchCount}`,
            ));
            if (bestSupport) {
              levels.push(lvl(
                bestSupport.boundaryId,
                "SUPPORT",
                bestSupport.mid,
                "LOW",
                `touchCount=${bestSupport.touchCount};lifecycle=${bestSupport.lifecycle}`,
              ));
            }
            if (bestResistance) {
              levels.push(lvl(
                bestResistance.boundaryId,
                "RESISTANCE",
                bestResistance.mid,
                "HIGH",
                `touchCount=${bestResistance.touchCount};lifecycle=${bestResistance.lifecycle}`,
              ));
            }
            measurements.push(
              meas("symbol", input.supportResistance!.providerSymbol, null, null),
              meas("timeframe", input.supportResistance!.timeframe, null, null),
              meas("supportMid", bestSupport?.mid ?? null, "price", null),
              meas("resistanceMid", bestResistance?.mid ?? null, "price", null),
              meas("primaryMid", b.mid, "price", `kind=${b.kind}`),
              meas("calculationStatus", input.supportResistance!.status, null, null),
            );
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
            levels.push(lvl(
              r.referenceId,
              r.refType || "LIQUIDITY_REF",
              r.price,
              r.refSide === "BUY_SIDE" ? "HIGH" : r.refSide === "SELL_SIDE" ? "LOW" : "OTHER",
              `lifecycle=${r.lifecycle};doesNotClaimRestingOrders=TRUE`,
            ));
            measurements.push(
              meas("liquidityPrice", r.price, "price", `refId=${r.referenceId}`),
              meas("timeframe", input.liquidityReference!.timeframe, null, null),
            );
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "LIQUIDITY_REFERENCE — dedicated engine produced no usable reference";
          }
          break;
        }
        case "MOMENTUM": {
          if (momEnginePresent) {
            const mom = input.momentum!;
            const roc = mom.indicators.find((i) => i.indicatorId === "ROC");
            const rsi = mom.indicators.find((i) => i.indicatorId === "RSI");
            presence = "PRESENT";
            qualityStatus = momQ;
            sourceEngine = mom.engineId;
            sourceContractId = mom.contractId;
            sourceContractVersion = mom.contractVersion;
            sourcePolicyVersion = mom.policyVersion;
            sourceAssessmentId = mom.assessmentId;
            sourceInputIdentity = mom.inputIdentity;
            candleState = mom.sourceCandleState ?? "CLOSED";
            notes = [
              `direction=${mom.direction}`,
              `phase=${mom.phase}`,
              roc?.value != null ? `roc=${roc.value}` : null,
              rsi?.value != null ? `rsi=${rsi.value}` : null,
              roc ? `rocPeriod=${roc.period}` : null,
              rsi ? `rsiPeriod=${rsi.period}` : null,
              `rocMethod=percent_change`,
              `rsiMethod=Wilder`,
              mom.sourceTipOpenTimeSec != null
                ? `tipOpenTimeSec=${mom.sourceTipOpenTimeSec}`
                : null,
              mom.sourceTipCloseTimeSec != null
                ? `tipCloseTimeSec=${mom.sourceTipCloseTimeSec}`
                : null,
              `candleState=${mom.sourceCandleState ?? "CLOSED"}`,
              `fabricated=FALSE`,
              `notWinProbability=TRUE`,
            ].filter(Boolean).join("; ");
            measurements.push(
              meas("symbol", mom.providerSymbol, null, null),
              meas("timeframe", mom.timeframe, null, null),
              meas("indicator", "ROC14", null, roc?.definition ?? null),
              meas("roc", roc?.value ?? null, roc?.unit ?? "percent", `period=${roc?.period ?? 14};method=percent_change`),
              meas("rocPeriod", roc?.period ?? 14, "bars", null),
              meas("rocMethod", "percent_change", null, null),
              meas("rsi", rsi?.value ?? null, rsi?.unit ?? "index_0_100", `period=${rsi?.period ?? 14};method=Wilder`),
              meas("rsiPeriod", rsi?.period ?? 14, "bars", null),
              meas("rsiMethod", "Wilder", null, null),
              meas("tipOpenTimeSec", mom.sourceTipOpenTimeSec ?? null, "unix_sec", null),
              meas("tipCloseTimeSec", mom.sourceTipCloseTimeSec ?? null, "unix_sec", null),
              meas("candleState", mom.sourceCandleState ?? "CLOSED", null, null),
              meas("direction", mom.direction, null, null),
              meas("phase", mom.phase, null, null),
              meas("calculationStatus", mom.status, null, null),
              meas("dataQualityStatus", momQ, null, null),
              meas("snapshotRef", mom.assessmentId, null, null),
              meas("warmUpComplete", Boolean(roc?.warmUpComplete && rsi?.warmUpComplete), null, null),
            );
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "MOMENTUM — dedicated engine insufficient or absent; not fabricated";
          }
          break;
        }
        case "BUYER_SELLER_PRESSURE": {
          const bsp = input.buyerSellerPressure;
          if (
            bsp
            && (bsp.status === "VALID" || bsp.status === "WARNING" || bsp.status === "PROVISIONAL")
            && bsp.dominantSide !== "INSUFFICIENT_EVIDENCE"
          ) {
            presence = "PRESENT";
            qualityStatus = mapAssessmentStatus(bsp.status);
            sourceEngine = bsp.engineId;
            sourceContractId = bsp.contractId;
            sourceContractVersion = bsp.contractVersion;
            sourcePolicyVersion = bsp.policyVersion;
            sourceAssessmentId = bsp.assessmentId;
            sourceInputIdentity = bsp.inputIdentity;
            candleState = bsp.provisional ? "FORMING" : tip;
            notes = [
              `dominantSide=${bsp.dominantSide}`,
              `dataClassification=${bsp.dataClassification}`,
              `notAggressorVolume=TRUE`,
              `notWinProbability=TRUE`,
              `doesNotConfirmLifecycleAlone=TRUE`,
            ].join("; ");
          } else if (bsp) {
            presence = "ABSENT";
            qualityStatus = mapAssessmentStatus(bsp.status);
            sourceAssessmentId = bsp.assessmentId;
            notes = `BUYER_SELLER_PRESSURE status=${bsp.status} side=${bsp.dominantSide}`;
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "BUYER_SELLER_PRESSURE — Phase 05 assessment absent";
          }
          break;
        }
        case "DEEP_TECHNICAL_INTELLIGENCE": {
          const dti = input.deepTechnicalIntelligence;
          if (
            dti
            && (dti.status === "VALID" || dti.status === "WARNING" || dti.status === "PROVISIONAL" || dti.status === "DEGRADED")
          ) {
            presence = "PRESENT";
            qualityStatus = mapAssessmentStatus(dti.status);
            sourceEngine = dti.engineId;
            sourceContractId = dti.contractId;
            sourceContractVersion = dti.contractVersion;
            sourcePolicyVersion = dti.policyVersion;
            sourceAssessmentId = dti.assessmentId;
            sourceInputIdentity = dti.inputIdentity;
            notes = [
              `mtf=${dti.mtf.alignment}`,
              `regime=${dti.overallRegimeLabel}`,
              `confluence=${dti.confluence.grade}`,
              `notWinProbability=TRUE`,
              `doesNotConfirmLifecycleAlone=TRUE`,
            ].join("; ");
          } else if (dti) {
            presence = "ABSENT";
            qualityStatus = mapAssessmentStatus(dti.status);
            sourceAssessmentId = dti.assessmentId;
            notes = `DEEP_TECHNICAL_INTELLIGENCE status=${dti.status}`;
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "DEEP_TECHNICAL_INTELLIGENCE — Phase 06 assessment absent";
          }
          break;
        }
        case "CANDLESTICK_PATTERN": {
          const csp = input.candlestickPatterns;
          if (csp && (csp.detections?.length ?? 0) > 0) {
            presence = "PRESENT";
            qualityStatus = mapAssessmentStatus(csp.status);
            sourceEngine = csp.engineId;
            sourceContractId = csp.contractId;
            sourceContractVersion = csp.contractVersion;
            sourceAssessmentId = csp.assessmentId;
            sourceInputIdentity = csp.inputIdentity;
            notes = [
              `count=${csp.detections.length}`,
              `patternIds=${csp.patternIds.join(",")}`,
              `notTradeSignal=TRUE`,
            ].join("; ");
          } else if (csp) {
            presence = "ABSENT";
            qualityStatus = mapAssessmentStatus(csp.status);
            sourceAssessmentId = csp.assessmentId;
            notes = `CANDLESTICK_PATTERN status=${csp.status}; detections=0`;
          } else {
            presence = "ABSENT";
            qualityStatus = "MISSING";
            notes = "CANDLESTICK_PATTERN — wrapper assessment absent";
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
        measurements,
        levels,
      }),
    );
  }

  // Phase 05/06 — always project dedicated assessments into UMEP even when
  // strategy catalog optionalEvidence omits these families (delivery gap fix).
  const seenIds = new Set(out.map((r) => r.evidenceId));
  const pushSupplemental = (partial: Parameters<typeof ref>[0]) => {
    if (seenIds.has(partial.evidenceId)) return;
    seenIds.add(partial.evidenceId);
    out.push(ref(partial));
  };

  const bsp = input.buyerSellerPressure;
  if (bsp) {
    const usable =
      (bsp.status === "VALID" || bsp.status === "WARNING" || bsp.status === "PROVISIONAL")
      && bsp.dominantSide !== "INSUFFICIENT_EVIDENCE";
    pushSupplemental({
      evidenceId: "ume.buyer_seller_pressure",
      family: "BUYER_SELLER_PRESSURE",
      presence: usable ? "PRESENT" : "ABSENT",
      qualityStatus: usable ? mapAssessmentStatus(bsp.status) : mapAssessmentStatus(bsp.status),
      sourceEngine: bsp.engineId,
      sourceContractId: bsp.contractId,
      sourceContractVersion: bsp.contractVersion,
      sourcePolicyVersion: bsp.policyVersion,
      sourceAssessmentId: bsp.assessmentId,
      sourceInputIdentity: bsp.inputIdentity,
      timeframe: tf,
      timeframeRole: "INTERMEDIATE_STRUCTURE",
      assessmentTimestamp: ts,
      candleState: bsp.provisional ? (tip ?? "FORMING") : closedOrTip,
      notes: [
        `dominantSide=${bsp.dominantSide}`,
        `dataClassification=${bsp.dataClassification}`,
        `notAggressorVolume=TRUE`,
        `notWinProbability=TRUE`,
        `supplementalProjection=TRUE`,
      ].join("; "),
    });
  }

  const dti = input.deepTechnicalIntelligence;
  const conflictReport = classifyRegimeDtiStructureConflict({
    regime: input.regime ?? null,
    marketStructure: input.marketStructure ?? null,
    deepTechnical: dti ?? null,
  });
  if (dti) {
    const usable =
      dti.status === "VALID"
      || dti.status === "WARNING"
      || dti.status === "PROVISIONAL"
      || dti.status === "DEGRADED";
    pushSupplemental({
      evidenceId: "ume.deep_technical_intelligence",
      family: "DEEP_TECHNICAL_INTELLIGENCE",
      presence: usable ? "PRESENT" : "ABSENT",
      qualityStatus: mapAssessmentStatus(dti.status),
      sourceEngine: dti.engineId,
      sourceContractId: dti.contractId,
      sourceContractVersion: dti.contractVersion,
      sourcePolicyVersion: dti.policyVersion,
      sourceAssessmentId: dti.assessmentId,
      sourceInputIdentity: dti.inputIdentity,
      timeframe: tf,
      timeframeRole: "INTERMEDIATE_STRUCTURE",
      assessmentTimestamp: ts,
      candleState: closedOrTip,
      notes: [
        `mtf=${dti.mtf.alignment}`,
        `regime=${dti.overallRegimeLabel}`,
        `confluence=${dti.confluence.grade}`,
        `conflictKind=${conflictReport.kind}`,
        `notWinProbability=TRUE`,
        `supplementalProjection=TRUE`,
        `presentationOverlay=TRUE`,
      ].join("; "),
      measurements: [
        meas("overallRegimeLabel", dti.overallRegimeLabel, null, "DTI presentation overlay"),
        meas("mtfAlignment", dti.mtf.alignment, null, null),
        meas("confluenceGrade", dti.confluence.grade, null, null),
        meas("conflictKind", conflictReport.kind, null, null),
        meas("timeframe", dti.timeframe, null, null),
        meas("calculationStatus", dti.status, null, null),
      ],
    });
  }

  if (
    conflictReport.kind !== "AGREEMENT"
    && (input.regime || dti || input.marketStructure)
  ) {
    pushSupplemental({
      evidenceId: "ume.engine_conflict.regime_dti_structure",
      family: "DEEP_TECHNICAL_INTELLIGENCE",
      presence: "PRESENT",
      qualityStatus: conflictReport.kind === "INSUFFICIENT_DATA" ? "MISSING" : "WARNING",
      sourceEngine: "mif-engine-conflict",
      sourceContractId: "kwizera.mif.engine-conflict.v1",
      sourceContractVersion: "1.0.0",
      sourcePolicyVersion: null,
      sourceAssessmentId: conflictReport.snapshotRefs[0] ?? null,
      sourceInputIdentity: null,
      timeframe: tf,
      timeframeRole: "INTERMEDIATE_STRUCTURE",
      assessmentTimestamp: ts,
      candleState: closedOrTip,
      notes: formatConflictNotes(conflictReport),
      measurements: [
        meas("conflictKind", conflictReport.kind, null, null),
        meas("resolutionStatus", conflictReport.resolutionStatus, null, null),
        meas("engines", conflictReport.engines.join(",") || "none", null, null),
        ...conflictReport.conclusions.slice(0, 6).map((c) =>
          meas(`conclusion_${c.engine}`, c.conclusion, null, c.timeframe),
        ),
        ...conflictReport.reasons.slice(0, 4).map((r, i) =>
          meas(`reason_${i + 1}`, r, null, null),
        ),
      ],
    });
  }

  const csp = input.candlestickPatterns;
  if (csp) {
    const hasDetections = (csp.detections?.length ?? 0) > 0;
    pushSupplemental({
      evidenceId: "ume.candlestick_patterns",
      family: "CANDLESTICK_PATTERN",
      presence: hasDetections ? "PRESENT" : "ABSENT",
      qualityStatus: mapAssessmentStatus(csp.status),
      sourceEngine: csp.engineId,
      sourceContractId: csp.contractId,
      sourceContractVersion: csp.contractVersion,
      sourcePolicyVersion: null,
      sourceAssessmentId: csp.assessmentId,
      sourceInputIdentity: csp.inputIdentity,
      timeframe: tf,
      timeframeRole: "INTERMEDIATE_STRUCTURE",
      assessmentTimestamp: ts,
      candleState: closedOrTip,
      notes: [
        `count=${csp.detections?.length ?? 0}`,
        `patternIds=${(csp.patternIds ?? []).join(",")}`,
        `notTradeSignal=TRUE`,
        `supplementalProjection=TRUE`,
      ].join("; "),
    });
  }

  // Stable order by evidenceId
  out.sort((a, b) => a.evidenceId.localeCompare(b.evidenceId));
  return out;
}
