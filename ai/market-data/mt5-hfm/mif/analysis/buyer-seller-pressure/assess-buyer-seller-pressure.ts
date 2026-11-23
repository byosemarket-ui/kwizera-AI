/**
 * Phase 05 — assessMifBuyerSellerPressure (HFM_MT5).
 * Deterministic candle-structure + tick-activity PROXY.
 * CLOSED tip required for non-provisional conclusions. No look-ahead.
 * Does not confirm/invalidate Phase 04 lifecycle alone.
 */
import { createHash } from "node:crypto";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import {
  evaluateMifAnalyticalQualityGate,
  type MifQualityGateSource,
} from "../quality/assessment-quality-gate.js";
import {
  MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID,
  MIF_BUYER_SELLER_PRESSURE_CONTRACT_VERSION,
  MIF_BUYER_SELLER_PRESSURE_ENGINE_ID,
  MIF_BUYER_SELLER_PRESSURE_ENGINE_VERSION,
  MIF_BUYER_SELLER_PRESSURE_MODEL_VERSION,
  MIF_BUYER_SELLER_PRESSURE_POLICY_ID,
  MIF_BUYER_SELLER_PRESSURE_POLICY_VERSION,
} from "./contracts.js";
import { computeBarPressureMetrics, meanTickVolume } from "./metrics.js";
import { resolveBuyerSellerPressurePolicy } from "./policies.js";
import type {
  HfmAbsorptionAssessment,
  HfmDominanceStrength,
  HfmExhaustionAssessment,
  HfmPressureChange,
  HfmPressureDataClassification,
  HfmPressureDominantSide,
  HfmPressureEvidenceQuality,
  HfmPressurePersistence,
  HfmPressureTrend,
  HfmPricePressureRelationship,
  MifBuyerSellerPressureAssessment,
  MifBuyerSellerPressurePolicy,
  MifBuyerSellerPressureStatus,
} from "./types.js";

export interface AssessMifBuyerSellerPressureInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | null;
  policy?: Partial<MifBuyerSellerPressurePolicy> | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
  /** Optional quote mid change vs prior for price-pressure (not required). */
  recentPriceChange?: number | null;
}

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

function sideFromImbalance(
  imb: number,
  domMin: number,
): "BUY" | "SELL" | "BALANCED" {
  if (imb >= domMin) return "BUY";
  if (imb <= -domMin) return "SELL";
  return "BALANCED";
}

/**
 * Dedicated buyer/seller pressure assessment from HFM_MT5 canonical candles.
 */
export function assessMifBuyerSellerPressure(
  input: AssessMifBuyerSellerPressureInput,
): MifBuyerSellerPressureAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const policy = resolveBuyerSellerPressurePolicy(input.policy);
  const instrument = input.instrument ?? null;

  const gate = evaluateMifAnalyticalQualityGate({
    quality: input.quality as MifQualityGateSource | null,
    allowedStatusesForConfirmedAnchors: ["VALID", "WARNING"],
  });
  const qualityRef = {
    sourceKind: gate.sourceKind,
    status: gate.qualityStatus,
    inputIdentity: gate.qualityInputIdentity,
    assessmentId: gate.qualityAssessmentId,
  };

  const calcParams = {
    atrPeriod: policy.atrPeriod,
    persistenceBars: policy.persistenceBars,
    imbalanceDominanceMin: policy.imbalanceDominanceMin,
    imbalanceStrongMin: policy.imbalanceStrongMin,
    sustainedAgreeMin: policy.sustainedAgreeMin,
  };

  const baseLimitations = [
    "INFERRED_FROM_CANDLE_STRUCTURE — not true aggressor-side volume",
    "tickVolume is unsigned activity — not buy/sell volume delta",
    "no Level-2 depth / order book on HFM MT5 path",
    "pressure scores are NOT win probability or event probability",
    "does not alone confirm or invalidate Phase 04 lifecycle states",
  ];

  const empty = (
    status: MifBuyerSellerPressureStatus,
    reason: string,
    missing: string[] = [],
  ): MifBuyerSellerPressureAssessment => {
    const id = idHash({ providerSymbol, timeframe, status, reason });
    return {
      contractId: MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID,
      contractVersion: MIF_BUYER_SELLER_PRESSURE_CONTRACT_VERSION,
      scope: "phase05-buyer-seller-pressure",
      assessmentId: input.assessmentId ?? `bsp:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      policyId: policy.policyId || MIF_BUYER_SELLER_PRESSURE_POLICY_ID,
      policyVersion: policy.policyVersion || MIF_BUYER_SELLER_PRESSURE_POLICY_VERSION,
      engineId: MIF_BUYER_SELLER_PRESSURE_ENGINE_ID,
      engineVersion: MIF_BUYER_SELLER_PRESSURE_ENGINE_VERSION,
      modelVersion: MIF_BUYER_SELLER_PRESSURE_MODEL_VERSION,
      assessmentTimestamp,
      observationStartSec: null,
      observationEndSec: null,
      status,
      provisional: false,
      dataClassification: "INSUFFICIENT_DATA",
      scoreClassification: "INSUFFICIENT_DATA",
      tickActivityClassification: "UNAVAILABLE",
      aggressorSideAvailable: false,
      orderBookAvailable: false,
      buyingPressureScore: null,
      sellingPressureScore: null,
      pressureImbalance: null,
      dominantSide: "INSUFFICIENT_EVIDENCE",
      dominanceStrength: "UNAVAILABLE",
      pressureTrend: "UNAVAILABLE",
      pressureChange: "UNAVAILABLE",
      persistence: "UNAVAILABLE",
      absorptionAssessment: "UNAVAILABLE",
      exhaustionAssessment: "INSUFFICIENT_EVIDENCE",
      pricePressureRelationship: "INSUFFICIENT_DATA",
      evidenceQuality: "INSUFFICIENT_DATA",
      tipMetrics: null,
      persistenceWindow: [],
      supportingEvidence: [],
      contradictingEvidence: [],
      missingInputs: missing,
      limitations: baseLimitations,
      qualityRef,
      calculationParameters: calcParams,
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      isWinProbability: false,
      isEventProbability: false,
      isCalibratedProbability: false,
      doesNotClaimInstitutionalOrderFlow: true,
      doesNotClaimTrueAggressorVolume: true,
      analyticalPressureInformationOnly: true,
      doesNotConfirmOrInvalidateLifecycleAlone: true,
    };
  };

  if (!providerSymbol || !timeframe) {
    return empty("BLOCKED", "identity required", ["providerSymbol", "timeframe"]);
  }
  if (!gate.present || gate.qualityStatus === "BLOCKED" || gate.qualityStatus === "MISSING") {
    return empty("BLOCKED", `quality ${gate.qualityStatus}`, ["quality"]);
  }

  // Provider lock — reject non-HFM candles if tagged.
  const foreign = input.candles.find(
    (c) => c.providerSymbol && c.providerSymbol.toUpperCase() !== providerSymbol,
  );
  if (foreign) {
    return empty("BLOCKED", "symbol_mismatch_in_candles", ["providerSymbol"]);
  }

  const closed = input.candles
    .filter((c) => c.candleState === "CLOSED")
    .slice()
    .sort((a, b) => a.openTimeSec - b.openTimeSec);

  if (closed.length < policy.minClosedCandles) {
    return empty(
      "INSUFFICIENT_DATA",
      `need_min_closed=${policy.minClosedCandles}_have=${closed.length}`,
      ["closedCandles"],
    );
  }

  const tipCandle = input.candles[input.candles.length - 1];
  const tipIsForming = tipCandle?.candleState === "FORMING";
  // Prefer last CLOSED for confirmed; FORMING tip → provisional using last closed as tip metrics source
  const series = tipIsForming ? closed : closed;
  const tipIndex = series.length - 1;
  const tipMetrics = computeBarPressureMetrics({
    candles: series,
    index: tipIndex,
    atrPeriod: policy.atrPeriod,
  });
  if (!tipMetrics) {
    return empty("INSUFFICIENT_DATA", "tip_metrics_unavailable", ["tipCandle"]);
  }

  const windowStart = Math.max(0, series.length - policy.persistenceBars);
  const persistenceWindow = [];
  for (let i = windowStart; i < series.length; i++) {
    const m = computeBarPressureMetrics({
      candles: series,
      index: i,
      atrPeriod: policy.atrPeriod,
    });
    if (m) persistenceWindow.push(m);
  }

  const buy = tipMetrics.buyingPressureScore;
  const sell = tipMetrics.sellingPressureScore;
  const imb = tipMetrics.pressureImbalance;

  const tipSide = sideFromImbalance(imb, policy.imbalanceDominanceMin);
  let dominantSide: HfmPressureDominantSide = "INSUFFICIENT_EVIDENCE";
  let dominanceStrength: HfmDominanceStrength = "UNAVAILABLE";

  if (tipSide === "BALANCED") {
    dominantSide = "BALANCED";
    dominanceStrength = "NONE";
  } else if (tipSide === "BUY") {
    dominantSide = "BUYERS_DOMINANT";
    dominanceStrength =
      Math.abs(imb) >= policy.imbalanceStrongMin ? "STRONG" : "WEAK";
  } else {
    dominantSide = "SELLERS_DOMINANT";
    dominanceStrength =
      Math.abs(imb) >= policy.imbalanceStrongMin ? "STRONG" : "WEAK";
  }

  // Persistence: count bars agreeing with tip side
  const agree = persistenceWindow.filter((b) => {
    const s = sideFromImbalance(b.pressureImbalance, policy.imbalanceDominanceMin);
    return tipSide !== "BALANCED" && s === tipSide;
  }).length;
  const disagree = persistenceWindow.filter((b) => {
    const s = sideFromImbalance(b.pressureImbalance, policy.imbalanceDominanceMin);
    return tipSide !== "BALANCED" && s !== tipSide && s !== "BALANCED";
  }).length;

  let persistence: HfmPressurePersistence = "INSUFFICIENT_HISTORY";
  if (persistenceWindow.length < 3) {
    persistence = "INSUFFICIENT_HISTORY";
  } else if (tipSide === "BALANCED") {
    persistence = "UNAVAILABLE";
  } else if (agree >= policy.sustainedAgreeMin) {
    persistence = "SUSTAINED";
  } else {
    persistence = "TEMPORARY_SPIKE";
  }

  if (disagree >= 2 && agree >= 2) {
    dominantSide = "MIXED";
    dominanceStrength = "WEAK";
  }

  // Trend / change from earlier vs tip imbalance
  const earlier =
    persistenceWindow.length >= 3
      ? persistenceWindow[0]!.pressureImbalance
      : null;
  const mid =
    persistenceWindow.length >= 3
      ? persistenceWindow[Math.floor(persistenceWindow.length / 2)]!.pressureImbalance
      : null;

  let pressureTrend: HfmPressureTrend = "UNAVAILABLE";
  let pressureChange: HfmPressureChange = "UNAVAILABLE";
  if (earlier != null && mid != null) {
    const dTip = imb - earlier;
    const dMid = mid - earlier;
    if (Math.abs(dTip) < 0.05) {
      pressureTrend = "STABLE";
      pressureChange = "STABLE";
    } else if (Math.sign(earlier) !== 0 && Math.sign(imb) !== 0 && Math.sign(earlier) !== Math.sign(imb)) {
      pressureTrend = "REVERSING";
      pressureChange = "RAPID_SHIFT";
    } else if (Math.abs(imb) > Math.abs(earlier) + 0.05) {
      pressureTrend = "STRENGTHENING";
      pressureChange = imb > earlier ? "INCREASING_BUYER" : "INCREASING_SELLER";
    } else if (Math.abs(imb) < Math.abs(earlier) - 0.05) {
      pressureTrend = "WEAKENING";
      pressureChange = "DECREASING_IMBALANCE";
    } else {
      pressureTrend = "STABLE";
      pressureChange = Math.abs(dMid) > 0.2 ? "RAPID_SHIFT" : "STABLE";
    }
  }

  // Exhaustion
  let exhaustionAssessment: HfmExhaustionAssessment = "NO_CLEAR_EXHAUSTION";
  if (earlier == null) {
    exhaustionAssessment = "INSUFFICIENT_EVIDENCE";
  } else if (dominantSide === "BUYERS_DOMINANT" && pressureTrend === "STRENGTHENING") {
    exhaustionAssessment = "BUYING_PRESSURE_STRENGTHENING";
  } else if (dominantSide === "BUYERS_DOMINANT" && pressureTrend === "WEAKENING") {
    exhaustionAssessment =
      Math.abs(imb) < policy.imbalanceDominanceMin + 0.05
        ? "POSSIBLE_BUYER_EXHAUSTION"
        : "BUYING_PRESSURE_WEAKENING";
  } else if (dominantSide === "SELLERS_DOMINANT" && pressureTrend === "STRENGTHENING") {
    exhaustionAssessment = "SELLING_PRESSURE_STRENGTHENING";
  } else if (dominantSide === "SELLERS_DOMINANT" && pressureTrend === "WEAKENING") {
    exhaustionAssessment =
      Math.abs(imb) < policy.imbalanceDominanceMin + 0.05
        ? "POSSIBLE_SELLER_EXHAUSTION"
        : "SELLING_PRESSURE_WEAKENING";
  }

  // Absorption proxy (tick activity + small body)
  const meanTick = meanTickVolume(persistenceWindow);
  let tickActivityClassification: HfmPressureDataClassification = "UNAVAILABLE";
  let absorptionAssessment: HfmAbsorptionAssessment = "UNAVAILABLE";
  if (tipMetrics.tickVolume != null && meanTick != null && meanTick > 0) {
    tickActivityClassification = "INFERRED_FROM_TICK_ACTIVITY";
    const ratio = tipMetrics.tickVolume / meanTick;
    const bodyAtr = tipMetrics.bodyAtr;
    if (
      bodyAtr != null
      && bodyAtr < policy.absorptionMaxBodyAtr
      && ratio >= policy.absorptionMinTickRatio
    ) {
      absorptionAssessment = "POSSIBLE_ABSORPTION";
    } else {
      absorptionAssessment = "NO_ABSORPTION_SIGNAL";
    }
  } else {
    absorptionAssessment = "INSUFFICIENT_EVIDENCE";
  }

  // Price vs pressure
  let pricePressureRelationship: HfmPricePressureRelationship = "INSUFFICIENT_DATA";
  const priceChange =
    input.recentPriceChange
    ?? (series.length >= 2
      ? series[series.length - 1]!.close - series[series.length - 2]!.close
      : null);
  if (priceChange != null && Number.isFinite(priceChange)) {
    const priceUp = priceChange > 0;
    const priceDown = priceChange < 0;
    const buyers = dominantSide === "BUYERS_DOMINANT";
    const sellers = dominantSide === "SELLERS_DOMINANT";
    const smallMove =
      tipMetrics.bodyAtr != null && tipMetrics.bodyAtr < policy.absorptionMaxBodyAtr;
    if (absorptionAssessment === "POSSIBLE_ABSORPTION" || (smallMove && Math.abs(imb) >= policy.imbalanceDominanceMin)) {
      pricePressureRelationship = "PRESSURE_WITHOUT_PRICE_PROGRESS";
    } else if ((priceUp && buyers) || (priceDown && sellers)) {
      pricePressureRelationship = "PRICE_PRESSURE_ALIGNED";
    } else if ((priceUp && sellers) || (priceDown && buyers)) {
      pricePressureRelationship = "PRICE_PRESSURE_DIVERGENCE";
    } else if (dominantSide === "BALANCED" || dominantSide === "MIXED") {
      pricePressureRelationship = "MIXED_EVIDENCE";
    } else if (Math.abs(priceChange) < 1e-9) {
      pricePressureRelationship = "PRICE_MOVEMENT_UNCONFIRMED";
    } else {
      pricePressureRelationship = "MIXED_EVIDENCE";
    }
  }

  const supportingEvidence: string[] = [];
  const contradictingEvidence: string[] = [];
  supportingEvidence.push(
    `tip_close_location=${tipMetrics.closeLocation?.toFixed(3) ?? "null"}`,
    `tip_imbalance=${imb.toFixed(3)}`,
    `persistence=${persistence}`,
  );
  if (absorptionAssessment === "POSSIBLE_ABSORPTION") {
    supportingEvidence.push("elevated_tick_activity_with_limited_body_progress");
  }
  if (disagree >= 1) {
    contradictingEvidence.push(`opposing_bars_in_window=${disagree}`);
  }
  if (pricePressureRelationship === "PRICE_PRESSURE_DIVERGENCE") {
    contradictingEvidence.push("price_direction_conflicts_with_pressure_side");
  }

  let evidenceQuality: HfmPressureEvidenceQuality = "MODERATE";
  if (persistence === "SUSTAINED" && dominanceStrength === "STRONG") {
    evidenceQuality = "HIGH";
  } else if (
    persistence === "TEMPORARY_SPIKE"
    || dominantSide === "MIXED"
    || tipIsForming
  ) {
    evidenceQuality = "LOW";
  }

  const status: MifBuyerSellerPressureStatus = tipIsForming
    ? "PROVISIONAL"
    : gate.qualityStatus === "WARNING"
      ? "WARNING"
      : "VALID";

  const missingInputs: string[] = [];
  if (tickActivityClassification === "UNAVAILABLE") {
    missingInputs.push("tickVolume");
  }
  missingInputs.push("aggressorSide", "orderBookDepth");

  const id = idHash({
    providerSymbol,
    timeframe,
    tip: tipMetrics.openTimeSec,
    buy,
    sell,
    imb,
    model: MIF_BUYER_SELLER_PRESSURE_MODEL_VERSION,
  });

  return {
    contractId: MIF_BUYER_SELLER_PRESSURE_CONTRACT_ID,
    contractVersion: MIF_BUYER_SELLER_PRESSURE_CONTRACT_VERSION,
    scope: "phase05-buyer-seller-pressure",
    assessmentId: input.assessmentId ?? `bsp:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    instrument,
    policyId: policy.policyId || MIF_BUYER_SELLER_PRESSURE_POLICY_ID,
    policyVersion: policy.policyVersion || MIF_BUYER_SELLER_PRESSURE_POLICY_VERSION,
    engineId: MIF_BUYER_SELLER_PRESSURE_ENGINE_ID,
    engineVersion: MIF_BUYER_SELLER_PRESSURE_ENGINE_VERSION,
    modelVersion: MIF_BUYER_SELLER_PRESSURE_MODEL_VERSION,
    assessmentTimestamp,
    observationStartSec: persistenceWindow[0]?.openTimeSec ?? tipMetrics.openTimeSec,
    observationEndSec: tipMetrics.openTimeSec,
    status,
    provisional: tipIsForming,
    dataClassification: "PROXY_ESTIMATE",
    scoreClassification: "INFERRED_FROM_CANDLE_STRUCTURE",
    tickActivityClassification,
    aggressorSideAvailable: false,
    orderBookAvailable: false,
    buyingPressureScore: buy,
    sellingPressureScore: sell,
    pressureImbalance: imb,
    dominantSide,
    dominanceStrength,
    pressureTrend,
    pressureChange,
    persistence,
    absorptionAssessment,
    exhaustionAssessment,
    pricePressureRelationship,
    evidenceQuality,
    tipMetrics,
    persistenceWindow,
    supportingEvidence,
    contradictingEvidence,
    missingInputs,
    limitations: baseLimitations,
    qualityRef,
    calculationParameters: calcParams,
    diagnosticsSummary: tipIsForming
      ? "provisional_forming_tip_using_last_closed_metrics"
      : `dominant=${dominantSide};strength=${dominanceStrength};persist=${persistence}`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    isWinProbability: false,
    isEventProbability: false,
    isCalibratedProbability: false,
    doesNotClaimInstitutionalOrderFlow: true,
    doesNotClaimTrueAggressorVolume: true,
    analyticalPressureInformationOnly: true,
    doesNotConfirmOrInvalidateLifecycleAlone: true,
  };
}
