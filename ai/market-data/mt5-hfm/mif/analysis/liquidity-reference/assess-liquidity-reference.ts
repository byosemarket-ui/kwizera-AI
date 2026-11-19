/**
 * Phase 5D.6 — Liquidity Reference from confirmed swings / equal highs-lows.
 * Price-structure only. Never claims resting stop orders or institutional pools.
 */
import { createHash } from "node:crypto";
import { classifyConfirmedSwings } from "../../../../../forex-structure/classify.js";
import { DEFAULT_STRUCTURE_PARAMS, mergeStructureParams } from "../../../../../forex-structure/params.js";
import { detectSwings } from "../../../../../forex-structure/swings.js";
import type { StructureRuleParams } from "../../../../../forex-structure/types.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import { mifCandlesToStructureCandles } from "../adapter/mif-to-structure-candle.js";
import {
  evaluateMifAnalyticalQualityGate,
  type MifQualityGateSource,
} from "../quality/assessment-quality-gate.js";
import type { MifMarketStructureAssessment } from "../market-structure/types.js";
import {
  MIF_LIQUIDITY_REFERENCE_CONTRACT_ID,
  MIF_LIQUIDITY_REFERENCE_CONTRACT_VERSION,
  MIF_LIQUIDITY_REFERENCE_ENGINE_ID,
  MIF_LIQUIDITY_REFERENCE_ENGINE_VERSION,
  MIF_LIQUIDITY_REFERENCE_POLICY_ID,
  MIF_LIQUIDITY_REFERENCE_POLICY_VERSION,
} from "./contracts.js";
import type {
  MifLiquidityLifecycle,
  MifLiquidityReference,
  MifLiquidityReferenceAssessment,
  MifLiquidityReferenceStatus,
} from "./types.js";

const STALE_BARS = 80;

export interface AssessMifLiquidityReferenceInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | null;
  marketStructure?: MifMarketStructureAssessment | null;
  structureParams?: Partial<StructureRuleParams>;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

function observeTip(
  tip: MifCanonicalCandle | undefined,
  ref: MifLiquidityReference,
): NonNullable<MifLiquidityReferenceAssessment["tipObservation"]> {
  if (!tip) {
    return {
      excursion: "NONE",
      reclaim: "UNKNOWN",
      accepted: false,
      closeState: "UNKNOWN",
      againstReferenceId: ref.referenceId,
    };
  }
  const closeState = tip.candleState === "CLOSED" ? "CLOSED" : tip.candleState === "FORMING" ? "FORMING" : "UNKNOWN";
  const beyond =
    ref.refSide === "BUY_SIDE"
      ? tip.high > ref.price
      : tip.low < ref.price;
  const touch =
    tip.low <= ref.price && tip.high >= ref.price;
  const excursion = beyond ? "BEYOND" : touch ? "TOUCH" : "NONE";
  const reclaimed =
    beyond
    && (
      ref.refSide === "BUY_SIDE"
        ? tip.close < ref.price
        : tip.close > ref.price
    );
  const accepted =
    beyond
    && tip.candleState === "CLOSED"
    && (
      ref.refSide === "BUY_SIDE"
        ? tip.close > ref.price
        : tip.close < ref.price
    );
  return {
    excursion,
    reclaim: reclaimed ? "YES" : beyond ? "NO" : "UNKNOWN",
    accepted,
    closeState,
    againstReferenceId: ref.referenceId,
  };
}

export function assessMifLiquidityReference(
  input: AssessMifLiquidityReferenceInput,
): MifLiquidityReferenceAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const params = mergeStructureParams(input.structureParams ?? DEFAULT_STRUCTURE_PARAMS);
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

  const empty = (
    status: MifLiquidityReferenceStatus,
    reason: string,
  ): MifLiquidityReferenceAssessment => {
    const id = idHash({ providerSymbol, timeframe, status, reason });
    return {
      contractId: MIF_LIQUIDITY_REFERENCE_CONTRACT_ID,
      contractVersion: MIF_LIQUIDITY_REFERENCE_CONTRACT_VERSION,
      scope: "phase5d6-liquidity-reference",
      assessmentId: input.assessmentId ?? `lr:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      policyId: MIF_LIQUIDITY_REFERENCE_POLICY_ID,
      policyVersion: MIF_LIQUIDITY_REFERENCE_POLICY_VERSION,
      engineId: MIF_LIQUIDITY_REFERENCE_ENGINE_ID,
      engineVersion: MIF_LIQUIDITY_REFERENCE_ENGINE_VERSION,
      assessmentTimestamp,
      status,
      references: [],
      primaryReference: null,
      tipObservation: null,
      qualityRef,
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalLiquidityInformationOnly: true,
      doesNotClaimRestingOrders: true,
    };
  };

  if (!providerSymbol || !timeframe) return empty("BLOCKED", "identity required");
  if (!gate.present || gate.qualityStatus === "BLOCKED" || gate.qualityStatus === "MISSING") {
    return empty("BLOCKED", `quality ${gate.qualityStatus}`);
  }

  const adapted = mifCandlesToStructureCandles({
    candles: input.candles,
    providerSymbol,
    timeframe,
  });
  if (adapted.blocking || !adapted.ok) {
    return empty("INSUFFICIENT_DATA", adapted.issues[0]?.message ?? "adapter blocked");
  }

  const swings = detectSwings(
    adapted.structureCandles,
    adapted.closedCount,
    params,
    false,
  );
  const classifications = classifyConfirmedSwings(swings, params);
  const classById = new Map(classifications.map((c) => [c.swingId, c]));
  const tipIndex = adapted.closedCount - 1;
  const tipCandle = input.candles.length
    ? input.candles[input.candles.length - 1]
    : undefined;

  const references: MifLiquidityReference[] = [];
  for (const s of swings) {
    if (s.status !== "CONFIRMED") continue;
    const cls = classById.get(s.id);
    let refType: MifLiquidityReference["refType"] =
      s.kind === "HIGH" ? "SWING_HIGH" : "SWING_LOW";
    if (cls?.label === "EQUAL_HIGH") refType = "EQUAL_HIGH";
    if (cls?.label === "EQUAL_LOW") refType = "EQUAL_LOW";

    const freshnessBars = tipIndex >= 0 ? Math.max(0, tipIndex - s.index) : 0;
    let lifecycle: MifLiquidityLifecycle = freshnessBars > STALE_BARS ? "STALE" : "ACTIVE";

    // Lifecycle vs tip (descriptive price behavior only)
    if (tipCandle && lifecycle === "ACTIVE") {
      const obs = observeTip(tipCandle, {
        referenceId: s.id,
        refType,
        refSide: s.kind === "HIGH" ? "BUY_SIDE" : "SELL_SIDE",
        price: s.price,
        sourceSwingIds: [s.id],
        confirmed: true,
        lifecycle: "ACTIVE",
        detectionOpenTimeSec: s.time,
        freshnessBars,
        notes: "",
      });
      if (obs.accepted) lifecycle = "ACCEPTED_THROUGH";
      else if (obs.excursion === "BEYOND" && obs.reclaim === "YES") lifecycle = "RECLAIMED";
      else if (obs.excursion === "BEYOND") lifecycle = "SWEPT";
    }

    references.push({
      referenceId: s.id,
      refType,
      refSide: s.kind === "HIGH" ? "BUY_SIDE" : "SELL_SIDE",
      price: s.price,
      sourceSwingIds: [s.id],
      confirmed: true,
      lifecycle,
      detectionOpenTimeSec: s.time,
      freshnessBars,
      notes: "price-structure reference only; doesNotClaimRestingOrders=true",
    });
  }

  if (!references.length) {
    return empty("INSUFFICIENT_DATA", "no confirmed swing liquidity references");
  }

  // Prefer recent ACTIVE / RECLAIMED / SWEPT over STALE
  const ranked = [...references].sort((a, b) => {
    const rank = (l: MifLiquidityLifecycle) =>
      l === "ACTIVE" || l === "SWEPT" || l === "RECLAIMED" ? 0 : l === "STALE" ? 2 : 1;
    const d = rank(a.lifecycle) - rank(b.lifecycle);
    if (d !== 0) return d;
    return b.detectionOpenTimeSec - a.detectionOpenTimeSec;
  });
  const primaryReference = ranked[0]!;
  const tipObservation = observeTip(tipCandle, primaryReference);

  let status: MifLiquidityReferenceStatus = "VALID";
  if (gate.qualityStatus === "WARNING") status = "WARNING";
  if (gate.qualityStatus === "DEGRADED") status = "DEGRADED";
  if (primaryReference.lifecycle === "STALE") status = "WARNING";

  const id = idHash({
    contractId: MIF_LIQUIDITY_REFERENCE_CONTRACT_ID,
    providerSymbol,
    timeframe,
    refs: references.map((r) => r.referenceId),
    structureRef: input.marketStructure?.assessmentId ?? null,
  });

  return {
    contractId: MIF_LIQUIDITY_REFERENCE_CONTRACT_ID,
    contractVersion: MIF_LIQUIDITY_REFERENCE_CONTRACT_VERSION,
    scope: "phase5d6-liquidity-reference",
    assessmentId: input.assessmentId ?? `lr:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    instrument,
    policyId: MIF_LIQUIDITY_REFERENCE_POLICY_ID,
    policyVersion: MIF_LIQUIDITY_REFERENCE_POLICY_VERSION,
    engineId: MIF_LIQUIDITY_REFERENCE_ENGINE_ID,
    engineVersion: MIF_LIQUIDITY_REFERENCE_ENGINE_VERSION,
    assessmentTimestamp,
    status,
    references,
    primaryReference,
    tipObservation,
    qualityRef,
    diagnosticsSummary: `refs=${references.length}; primary=${primaryReference.referenceId}; lifecycle=${primaryReference.lifecycle}`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalLiquidityInformationOnly: true,
    doesNotClaimRestingOrders: true,
  };
}
