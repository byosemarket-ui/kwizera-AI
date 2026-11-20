/**
 * Phase 5D.7 — assessMifPriceDisplacement.
 * Dedicated engine over HFM_MT5 canonical candles + optional structure boundary.
 * CLOSED tip → confirmed kinds; FORMING tip → provisional FORMING only.
 * Does not claim institutional order flow. No look-ahead.
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
import type { MifMarketStructureAssessment } from "../market-structure/types.js";
import {
  MIF_PRICE_DISPLACEMENT_CONTRACT_ID,
  MIF_PRICE_DISPLACEMENT_CONTRACT_VERSION,
  MIF_PRICE_DISPLACEMENT_ENGINE_ID,
  MIF_PRICE_DISPLACEMENT_ENGINE_VERSION,
  MIF_PRICE_DISPLACEMENT_POLICY_ID,
  MIF_PRICE_DISPLACEMENT_POLICY_VERSION,
} from "./contracts.js";
import { computeDisplacementMetrics, type StructuralBoundaryInput } from "./metrics.js";
import { resolvePriceDisplacementPolicy } from "./policies.js";
import type {
  MifPriceDisplacementAssessment,
  MifPriceDisplacementKind,
  MifPriceDisplacementPolicy,
  MifPriceDisplacementStatus,
} from "./types.js";

export interface AssessMifPriceDisplacementInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | null;
  /** Optional validated structure for structural-break distinction. */
  marketStructure?: MifMarketStructureAssessment | null;
  policy?: Partial<MifPriceDisplacementPolicy> | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

function resolveBoundary(
  ms: MifMarketStructureAssessment | null | undefined,
): StructuralBoundaryInput | null {
  if (!ms?.primaryRef) return null;
  const pref = ms.primaryRef;
  if (!(typeof pref.price === "number") || !Number.isFinite(pref.price)) return null;
  // SWING_HIGH / SELL_SIDE → resistance (break above). SWING_LOW / BUY_SIDE → support.
  let side: StructuralBoundaryInput["side"] = "UNKNOWN";
  if (pref.refType === "SWING_HIGH" || pref.refSide === "SELL_SIDE") {
    side = "RESISTANCE";
  } else if (pref.refType === "SWING_LOW" || pref.refSide === "BUY_SIDE") {
    side = "SUPPORT";
  }
  return {
    price: pref.price,
    side,
    refId: pref.refId ?? null,
  };
}

/**
 * Dedicated price-displacement assessment from HFM_MT5 canonical candles.
 */
export function assessMifPriceDisplacement(
  input: AssessMifPriceDisplacementInput,
): MifPriceDisplacementAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const policy = resolvePriceDisplacementPolicy(input.policy);
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
    atrMethodId: policy.atrMethodId,
    minBodyAtr: policy.minBodyAtr,
    minTrueRangeAtr: policy.minTrueRangeAtr,
    minCloseLocation: policy.minCloseLocation,
    structuralBreakBufferAtr: policy.structuralBreakBufferAtr,
  };

  const empty = (
    status: MifPriceDisplacementStatus,
    kind: MifPriceDisplacementKind,
    reason: string,
  ): MifPriceDisplacementAssessment => {
    const id = idHash({ providerSymbol, timeframe, status, kind, reason });
    return {
      contractId: MIF_PRICE_DISPLACEMENT_CONTRACT_ID,
      contractVersion: MIF_PRICE_DISPLACEMENT_CONTRACT_VERSION,
      scope: "phase5d7-price-displacement",
      assessmentId: input.assessmentId ?? `pd:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      policyId: policy.policyId || MIF_PRICE_DISPLACEMENT_POLICY_ID,
      policyVersion: policy.policyVersion || MIF_PRICE_DISPLACEMENT_POLICY_VERSION,
      engineId: MIF_PRICE_DISPLACEMENT_ENGINE_ID,
      engineVersion: MIF_PRICE_DISPLACEMENT_ENGINE_VERSION,
      assessmentTimestamp,
      status,
      displacementKind: kind,
      confirmed: false,
      provisional: kind === "FORMING",
      structuralDisplacement: false,
      metrics: null,
      qualityRef,
      calculationParameters: calcParams,
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDisplacementInformationOnly: true,
      doesNotClaimInstitutionalOrderFlow: true,
    };
  };

  if (!providerSymbol || !timeframe) {
    return empty("BLOCKED", "INVALID", "identity required");
  }
  if (!gate.present || gate.qualityStatus === "BLOCKED" || gate.qualityStatus === "MISSING") {
    return empty("BLOCKED", "BLOCKED_BY_QUALITY", `quality ${gate.qualityStatus}`);
  }

  const all = input.candles ?? [];
  if (!all.length) {
    return empty("INSUFFICIENT_DATA", "INSUFFICIENT_DATA", "no candles");
  }

  const tip = all[all.length - 1]!;
  const tipIsForming = tip.candleState === "FORMING";
  const tipIsClosed = tip.candleState === "CLOSED";

  if (!tipIsForming && !tipIsClosed) {
    return empty("INSUFFICIENT_DATA", "INVALID", `unsupported tip candleState=${tip.candleState}`);
  }

  // Confirmed path uses CLOSED candles only. FORMING tip uses closed history + forming tip.
  const closed = all.filter((c) => c.candleState === "CLOSED");
  if (closed.length < policy.minClosedCandles && !tipIsForming) {
    return empty(
      "INSUFFICIENT_DATA",
      "INSUFFICIENT_DATA",
      `need >= ${policy.minClosedCandles} closed candles; got ${closed.length}`,
    );
  }
  if (tipIsForming && closed.length < policy.atrPeriod) {
    return empty(
      "INSUFFICIENT_DATA",
      "INSUFFICIENT_DATA",
      `forming tip needs >= ${policy.atrPeriod} prior closed candles for ATR; got ${closed.length}`,
    );
  }

  const series = tipIsForming ? [...closed, tip] : closed;
  const tipIndex = series.length - 1;
  const boundary = resolveBoundary(input.marketStructure);

  const metrics = computeDisplacementMetrics({
    candles: series,
    tipIndex,
    atrPeriod: policy.atrPeriod,
    atrMethodId: policy.atrMethodId,
    minBodyAtr: policy.minBodyAtr,
    minTrueRangeAtr: policy.minTrueRangeAtr,
    minCloseLocation: policy.minCloseLocation,
    structuralBreakBufferAtr: policy.structuralBreakBufferAtr,
    structuralBoundary: boundary,
  });

  if (!metrics || metrics.atr == null) {
    return empty(
      "INSUFFICIENT_DATA",
      "INSUFFICIENT_DATA",
      "ATR warm-up incomplete or metrics unavailable",
    );
  }

  // FORMING tip: never confirmed — provisional observation only.
  if (tipIsForming) {
    const id = idHash({
      providerSymbol,
      timeframe,
      tip: tip.openTimeSec,
      atr: metrics.atr,
      bodyAtr: metrics.bodyAtr,
      kind: "FORMING",
    });
    return {
      contractId: MIF_PRICE_DISPLACEMENT_CONTRACT_ID,
      contractVersion: MIF_PRICE_DISPLACEMENT_CONTRACT_VERSION,
      scope: "phase5d7-price-displacement",
      assessmentId: input.assessmentId ?? `pd:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      engineId: MIF_PRICE_DISPLACEMENT_ENGINE_ID,
      engineVersion: MIF_PRICE_DISPLACEMENT_ENGINE_VERSION,
      assessmentTimestamp,
      status: "PROVISIONAL",
      displacementKind: "FORMING",
      confirmed: false,
      provisional: true,
      structuralDisplacement: false,
      metrics,
      qualityRef,
      calculationParameters: calcParams,
      diagnosticsSummary:
        "FORMING tip — provisional observation only; not confirmed displacement",
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalDisplacementInformationOnly: true,
      doesNotClaimInstitutionalOrderFlow: true,
    };
  }

  let kind: MifPriceDisplacementKind = "NO_DISPLACEMENT";
  if (metrics.strongCandle && metrics.direction === "UP") {
    kind = "BULLISH_DISPLACEMENT";
  } else if (metrics.strongCandle && metrics.direction === "DOWN") {
    kind = "BEARISH_DISPLACEMENT";
  }

  // Structural displacement requires BOTH strong candle AND structural break.
  const structuralDisplacement =
    metrics.strongCandle && metrics.structuralBreak === true;

  const status: MifPriceDisplacementStatus =
    gate.qualityStatus === "WARNING"
      ? "WARNING"
      : gate.qualityStatus === "DEGRADED"
        ? "DEGRADED"
        : "VALID";

  const id = idHash({
    providerSymbol,
    timeframe,
    tip: tip.openTimeSec,
    atr: metrics.atr,
    bodyAtr: metrics.bodyAtr,
    trAtr: metrics.trueRangeAtr,
    loc: metrics.closeLocation,
    kind,
    structuralDisplacement,
    boundary: boundary?.price ?? null,
  });

  return {
    contractId: MIF_PRICE_DISPLACEMENT_CONTRACT_ID,
    contractVersion: MIF_PRICE_DISPLACEMENT_CONTRACT_VERSION,
    scope: "phase5d7-price-displacement",
    assessmentId: input.assessmentId ?? `pd:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    instrument,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    engineId: MIF_PRICE_DISPLACEMENT_ENGINE_ID,
    engineVersion: MIF_PRICE_DISPLACEMENT_ENGINE_VERSION,
    assessmentTimestamp,
    status,
    displacementKind: kind,
    confirmed: kind === "BULLISH_DISPLACEMENT" || kind === "BEARISH_DISPLACEMENT",
    provisional: false,
    structuralDisplacement,
    metrics,
    qualityRef,
    calculationParameters: calcParams,
    diagnosticsSummary: [
      `kind=${kind}`,
      `strongCandle=${metrics.strongCandle}`,
      `structuralBreak=${metrics.structuralBreak}`,
      `structuralDisplacement=${structuralDisplacement}`,
      `bodyAtr=${metrics.bodyAtr?.toFixed(3) ?? "null"}`,
      `trAtr=${metrics.trueRangeAtr?.toFixed(3) ?? "null"}`,
      `closeLoc=${metrics.closeLocation?.toFixed(3) ?? "null"}`,
      `direction=${metrics.direction}`,
      `openTimeSec=${metrics.openTimeSec}`,
    ].join("; "),
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalDisplacementInformationOnly: true,
    doesNotClaimInstitutionalOrderFlow: true,
  };
}
