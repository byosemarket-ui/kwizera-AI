/**
 * Phase 5D.6 — Momentum Assessment (ROC + Wilder RSI).
 * Analytical only. strengthScore is NOT a win probability.
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
  MIF_MOMENTUM_CONTRACT_ID,
  MIF_MOMENTUM_CONTRACT_VERSION,
  MIF_MOMENTUM_ENGINE_ID,
  MIF_MOMENTUM_ENGINE_VERSION,
  MIF_MOMENTUM_MIN_CLOSED,
  MIF_MOMENTUM_POLICY_ID,
  MIF_MOMENTUM_POLICY_VERSION,
  MIF_MOMENTUM_ROC_PERIOD,
  MIF_MOMENTUM_RSI_PERIOD,
} from "./contracts.js";
import { priorRateOfChange, rateOfChange, wilderRsi } from "./indicators.js";
import type {
  MifMomentumAssessment,
  MifMomentumDirection,
  MifMomentumPhase,
  MifMomentumStatus,
} from "./types.js";

export interface AssessMifMomentumInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | null;
  assessmentTimestamp?: string;
  assessmentId?: string;
  rocPeriod?: number;
  rsiPeriod?: number;
}

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

export function assessMifMomentum(input: AssessMifMomentumInput): MifMomentumAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const rocPeriod = input.rocPeriod ?? MIF_MOMENTUM_ROC_PERIOD;
  const rsiPeriod = input.rsiPeriod ?? MIF_MOMENTUM_RSI_PERIOD;
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
    status: MifMomentumStatus,
    reason: string,
  ): MifMomentumAssessment => {
    const id = idHash({ providerSymbol, timeframe, status, reason });
    return {
      contractId: MIF_MOMENTUM_CONTRACT_ID,
      contractVersion: MIF_MOMENTUM_CONTRACT_VERSION,
      scope: "phase5d6-momentum",
      assessmentId: input.assessmentId ?? `mo:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      policyId: MIF_MOMENTUM_POLICY_ID,
      policyVersion: MIF_MOMENTUM_POLICY_VERSION,
      engineId: MIF_MOMENTUM_ENGINE_ID,
      engineVersion: MIF_MOMENTUM_ENGINE_VERSION,
      assessmentTimestamp,
      status,
      direction: "UNKNOWN",
      phase: "INSUFFICIENT_EVIDENCE",
      strengthScore: null,
      strengthScoreDefinition:
        "mean of normalized |ROC| and RSI extremity; NOT a win probability",
      notWinProbability: true,
      indicators: [],
      conflictingIndicators: false,
      sourceTipOpenTimeSec: null,
      sourceTipCloseTimeSec: null,
      sourceCandleState: "CLOSED",
      qualityRef,
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalMomentumInformationOnly: true,
    };
  };

  if (!providerSymbol || !timeframe) return empty("BLOCKED", "identity required");
  if (!gate.present || gate.qualityStatus === "BLOCKED" || gate.qualityStatus === "MISSING") {
    return empty("BLOCKED", `quality ${gate.qualityStatus}`);
  }

  const closed = (input.candles ?? []).filter((c) => c.candleState === "CLOSED");
  if (closed.length < MIF_MOMENTUM_MIN_CLOSED) {
    return empty(
      "INSUFFICIENT_DATA",
      `need >= ${MIF_MOMENTUM_MIN_CLOSED} closed candles; got ${closed.length}`,
    );
  }

  const closes = closed.map((c) => c.close);
  const roc = rateOfChange(closes, rocPeriod);
  const rsi = wilderRsi(closes, rsiPeriod);
  const priorRoc = priorRateOfChange(closes, rocPeriod);

  const indicators = [
    {
      indicatorId: "ROC" as const,
      definition: `ROC=${rocPeriod}: 100*(close-close[n-${rocPeriod}])/close[n-${rocPeriod}]`,
      period: rocPeriod,
      value: roc.value,
      unit: "percent",
      warmUpComplete: roc.warmUpComplete,
    },
    {
      indicatorId: "RSI" as const,
      definition: `Wilder RSI(${rsiPeriod}) on closed closes`,
      period: rsiPeriod,
      value: rsi.value,
      unit: "index_0_100",
      warmUpComplete: rsi.warmUpComplete,
    },
  ];

  if (roc.value == null || rsi.value == null) {
    return empty("INSUFFICIENT_DATA", "indicator warm-up incomplete");
  }

  let direction: MifMomentumDirection = "FLAT";
  if (roc.value > 0.15 && rsi.value >= 52) direction = "UP";
  else if (roc.value < -0.15 && rsi.value <= 48) direction = "DOWN";
  else if (Math.abs(roc.value) <= 0.05 && rsi.value >= 45 && rsi.value <= 55) {
    direction = "FLAT";
  } else if (roc.value > 0.15) direction = "UP";
  else if (roc.value < -0.15) direction = "DOWN";

  const rocDir = roc.value > 0.15 ? "UP" : roc.value < -0.15 ? "DOWN" : "FLAT";
  const rsiDir = rsi.value >= 55 ? "UP" : rsi.value <= 45 ? "DOWN" : "FLAT";
  const conflictingIndicators =
    (rocDir === "UP" && rsiDir === "DOWN") || (rocDir === "DOWN" && rsiDir === "UP");

  let phase: MifMomentumPhase = "STABLE";
  if (direction === "FLAT") phase = "FLAT";
  else if (priorRoc != null) {
    const accel = roc.value - priorRoc;
    if (direction === "UP") {
      if (rsi.value >= 75 && accel <= 0) phase = "EXHAUSTING";
      else if (accel < -0.05) phase = "WEAKENING";
      else if (accel > 0.05) phase = "EXPANDING";
      else phase = "STABLE";
    } else if (direction === "DOWN") {
      if (rsi.value <= 25 && accel >= 0) phase = "EXHAUSTING";
      else if (accel > 0.05) phase = "WEAKENING";
      else if (accel < -0.05) phase = "EXPANDING";
      else phase = "STABLE";
    }
  }
  if (conflictingIndicators) phase = "WEAKENING";

  const rocNorm = Math.min(1, Math.abs(roc.value) / 5);
  const rsiExt = Math.min(1, Math.abs(rsi.value - 50) / 50);
  const strengthScore = (rocNorm + rsiExt) / 2;

  let status: MifMomentumStatus = "VALID";
  if (gate.qualityStatus === "WARNING") status = "WARNING";
  if (gate.qualityStatus === "DEGRADED") status = "DEGRADED";
  if (conflictingIndicators) status = status === "VALID" ? "WARNING" : status;

  const id = idHash({
    contractId: MIF_MOMENTUM_CONTRACT_ID,
    providerSymbol,
    timeframe,
    rocPeriod,
    rsiPeriod,
    tipClose: closes[closes.length - 1],
    tipTime: closed[closed.length - 1]!.openTimeSec,
    roc: roc.value,
    rsi: rsi.value,
  });

  return {
    contractId: MIF_MOMENTUM_CONTRACT_ID,
    contractVersion: MIF_MOMENTUM_CONTRACT_VERSION,
    scope: "phase5d6-momentum",
    assessmentId: input.assessmentId ?? `mo:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    instrument,
    policyId: MIF_MOMENTUM_POLICY_ID,
    policyVersion: MIF_MOMENTUM_POLICY_VERSION,
    engineId: MIF_MOMENTUM_ENGINE_ID,
    engineVersion: MIF_MOMENTUM_ENGINE_VERSION,
    assessmentTimestamp,
    status,
    direction,
    phase,
    strengthScore,
    strengthScoreDefinition:
      "0.5*(min(1,|ROC|/5)+min(1,|RSI-50|/50)); analytical only; NOT a win probability",
    notWinProbability: true,
    indicators,
    conflictingIndicators,
    sourceTipOpenTimeSec: closed[closed.length - 1]!.openTimeSec,
    sourceTipCloseTimeSec: closed[closed.length - 1]!.closeTimeSec ?? null,
    sourceCandleState: "CLOSED",
    qualityRef,
    diagnosticsSummary: `direction=${direction}; phase=${phase}; roc=${roc.value.toFixed(3)}; rsi=${rsi.value.toFixed(2)}`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalMomentumInformationOnly: true,
  };
}
