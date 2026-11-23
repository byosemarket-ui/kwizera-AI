/**
 * Phase 5D.6 — assessMifMarketStructure.
 * Reuses forex-structure swings/classify/events. No look-ahead. No fabrication.
 */
import { createHash } from "node:crypto";
import {
  classifyConfirmedSwings,
  resolveTrendState,
} from "../../../../../forex-structure/classify.js";
import { detectStructureEvents } from "../../../../../forex-structure/events.js";
import { DEFAULT_STRUCTURE_PARAMS, mergeStructureParams } from "../../../../../forex-structure/params.js";
import { detectSwings } from "../../../../../forex-structure/swings.js";
import type { StructureRuleParams } from "../../../../../forex-structure/types.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import { mifCandlesToStructureCandles } from "../adapter/mif-to-structure-candle.js";
import {
  evaluateMifAnalyticalQualityGate,
  type MifQualityGateSource,
} from "../quality/assessment-quality-gate.js";
import {
  MIF_MARKET_STRUCTURE_CONTRACT_ID,
  MIF_MARKET_STRUCTURE_CONTRACT_VERSION,
  MIF_MARKET_STRUCTURE_ENGINE_ID,
  MIF_MARKET_STRUCTURE_ENGINE_VERSION,
  MIF_MARKET_STRUCTURE_POLICY_ID,
  MIF_MARKET_STRUCTURE_POLICY_VERSION,
} from "./contracts.js";
import type {
  MifMarketStructureAssessment,
  MifMarketStructureStatus,
  MifStructureBias,
  MifStructureEventRef,
  MifStructureSwingRef,
} from "./types.js";

export interface AssessMifMarketStructureInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | null;
  structureParams?: Partial<StructureRuleParams>;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function mapBias(trend: string): MifStructureBias {
  switch (trend) {
    case "BULLISH":
      return "BULLISH";
    case "BEARISH":
      return "BEARISH";
    case "RANGE":
      return "RANGING";
    default:
      return "UNKNOWN";
  }
}

function inputIdentity(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

/**
 * Dedicated market-structure assessment from HFM_MT5 canonical candles.
 */
export function assessMifMarketStructure(
  input: AssessMifMarketStructureInput,
): MifMarketStructureAssessment {
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
    status: MifMarketStructureStatus,
    reason: string,
  ): MifMarketStructureAssessment => {
    const id = inputIdentity({
      contractId: MIF_MARKET_STRUCTURE_CONTRACT_ID,
      providerSymbol,
      timeframe,
      status,
      reason,
      candleCount: input.candles?.length ?? 0,
    });
    return {
      contractId: MIF_MARKET_STRUCTURE_CONTRACT_ID,
      contractVersion: MIF_MARKET_STRUCTURE_CONTRACT_VERSION,
      scope: "phase5d6-market-structure",
      assessmentId: input.assessmentId ?? `ms:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      policyId: MIF_MARKET_STRUCTURE_POLICY_ID,
      policyVersion: MIF_MARKET_STRUCTURE_POLICY_VERSION,
      engineId: MIF_MARKET_STRUCTURE_ENGINE_ID,
      engineVersion: MIF_MARKET_STRUCTURE_ENGINE_VERSION,
      assessmentTimestamp,
      status,
      bias: "UNKNOWN",
      confirmedSwingCount: 0,
      provisionalSwingCount: 0,
      swings: [],
      events: [],
      primaryRef: null,
      qualityRef,
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalStructureInformationOnly: true,
    };
  };

  if (!providerSymbol || !timeframe) {
    return empty("BLOCKED", "providerSymbol and timeframe required");
  }
  if (!gate.present || gate.qualityStatus === "BLOCKED" || gate.qualityStatus === "MISSING") {
    return empty("BLOCKED", `quality gate ${gate.qualityStatus}`);
  }

  const adapted = mifCandlesToStructureCandles({
    candles: input.candles,
    providerSymbol,
    timeframe,
  });
  if (adapted.blocking || !adapted.ok) {
    return empty(
      "INSUFFICIENT_DATA",
      adapted.issues[0]?.message ?? "structure candle adapter blocked",
    );
  }

  const swingsRaw = detectSwings(
    adapted.structureCandles,
    adapted.closedCount,
    params,
    false, // never confirm with forming
  );
  const classifications = classifyConfirmedSwings(swingsRaw, params);
  const classById = new Map(classifications.map((c) => [c.swingId, c]));
  const confirmedSwingCount = swingsRaw.filter((s) => s.status === "CONFIRMED").length;
  const trendState = resolveTrendState(confirmedSwingCount, classifications, params);
  const eventsRaw = detectStructureEvents(
    adapted.structureCandles,
    adapted.closedCount,
    swingsRaw,
    trendState,
    params,
    false,
  );

  const swings: MifStructureSwingRef[] = swingsRaw.map((s) => {
    const cls = classById.get(s.id);
    const status =
      s.status === "CONFIRMED"
        ? "CONFIRMED"
        : s.status === "PROVISIONAL"
          ? "PROVISIONAL"
          : "UNCONFIRMED";
    return {
      swingId: s.id,
      kind: s.kind,
      status,
      price: s.price,
      openTimeSec: s.time,
      candleIndex: s.index,
      classification: (cls?.label as MifStructureSwingRef["classification"]) ?? null,
      priorSwingId: cls?.priorSwingId ?? null,
    };
  });

  const events: MifStructureEventRef[] = eventsRaw.map((e) => ({
    eventId: e.id,
    eventKey: e.eventKey,
    type: e.type === "CHOCH" ? "CHOCH" : "BOS",
    direction: e.direction === "BEARISH" ? "BEARISH" : "BULLISH",
    status: e.status === "CONFIRMED" ? "CONFIRMED" : "CANDIDATE",
    priceLevel: e.level,
    priorLevelSwingId: e.levelSwingId ?? null,
    breakOpenTimeSec: e.breakCandleTime,
    breakCandleIndex: e.breakCandleIndex,
  }));

  const confirmed = swings.filter((s) => s.status === "CONFIRMED");
  const provisional = swings.filter((s) => s.status === "PROVISIONAL");

  let primaryRef: MifMarketStructureAssessment["primaryRef"] = null;
  if (confirmed.length) {
    const tip = confirmed[confirmed.length - 1]!;
    primaryRef = {
      refId: tip.swingId,
      refType: tip.kind === "HIGH" ? "SWING_HIGH" : "SWING_LOW",
      refSide: tip.kind === "HIGH" ? "BUY_SIDE" : "SELL_SIDE",
      price: tip.price,
      confirmed: true,
      openTimeSec: tip.openTimeSec,
    };
  }

  let status: MifMarketStructureStatus = "VALID";
  if (confirmed.length < params.minConfirmedSwingsForTrend) {
    status = "INSUFFICIENT_DATA";
  } else if (gate.qualityStatus === "WARNING" || gate.qualityStatus === "DEGRADED") {
    status = gate.qualityStatus === "DEGRADED" ? "DEGRADED" : "WARNING";
  } else if (trendState === "UNKNOWN") {
    status = "WARNING";
  }

  // Structural transition signal when latest event is CHOCH
  let bias = mapBias(trendState);
  const lastEvt = events.length ? events[events.length - 1] : null;
  if (lastEvt?.type === "CHOCH" && lastEvt.status === "CONFIRMED") {
    bias = "TRANSITION";
  }

  const id = inputIdentity({
    contractId: MIF_MARKET_STRUCTURE_CONTRACT_ID,
    contractVersion: MIF_MARKET_STRUCTURE_CONTRACT_VERSION,
    engineId: MIF_MARKET_STRUCTURE_ENGINE_ID,
    engineVersion: MIF_MARKET_STRUCTURE_ENGINE_VERSION,
    policyId: MIF_MARKET_STRUCTURE_POLICY_ID,
    policyVersion: MIF_MARKET_STRUCTURE_POLICY_VERSION,
    providerSymbol,
    timeframe,
    closedCount: adapted.closedCount,
    swingIds: swings.map((s) => s.swingId),
    eventKeys: events.map((e) => e.eventKey),
    bias,
  });

  return {
    contractId: MIF_MARKET_STRUCTURE_CONTRACT_ID,
    contractVersion: MIF_MARKET_STRUCTURE_CONTRACT_VERSION,
    scope: "phase5d6-market-structure",
    assessmentId: input.assessmentId ?? `ms:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    instrument,
    policyId: MIF_MARKET_STRUCTURE_POLICY_ID,
    policyVersion: MIF_MARKET_STRUCTURE_POLICY_VERSION,
    engineId: MIF_MARKET_STRUCTURE_ENGINE_ID,
    engineVersion: MIF_MARKET_STRUCTURE_ENGINE_VERSION,
    assessmentTimestamp,
    status,
    bias,
    confirmedSwingCount: confirmed.length,
    provisionalSwingCount: provisional.length,
    swings,
    events,
    primaryRef,
    qualityRef,
    diagnosticsSummary:
      `bias=${bias}; confirmed=${confirmed.length}; provisional=${provisional.length}; events=${events.length}`
      + `; formingExcluded=${adapted.issues.filter((i) => i.code === "FORMING_EXCLUDED").length}`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalStructureInformationOnly: true,
  };
}
