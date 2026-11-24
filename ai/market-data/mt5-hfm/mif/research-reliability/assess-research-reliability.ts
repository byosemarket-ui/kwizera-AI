/**
 * Phase 09 — assessMifResearchReliability (HFM_MT5).
 * Request-driven reliability assessment. No continuous worker. No broker execution.
 */
import { createHash } from "node:crypto";
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import { buildReliabilityAlerts } from "./alerts.js";
import { assessCandleReliability } from "./candle-reliability.js";
import {
  MIF_RESEARCH_RELIABILITY_CONTRACT_ID,
  MIF_RESEARCH_RELIABILITY_CONTRACT_VERSION,
  MIF_RESEARCH_RELIABILITY_ENGINE_ID,
  MIF_RESEARCH_RELIABILITY_ENGINE_VERSION,
  MIF_RESEARCH_RELIABILITY_MODEL_VERSION,
} from "./contracts.js";
import { assessEventReliability } from "./event-reliability.js";
import { compareLiveVsHistorical } from "./live-historical-compare.js";
import { resolveResearchReliabilityPolicy } from "./policies.js";
import { assessQuoteReliability } from "./quote-reliability.js";
import { assessRegimeShift } from "./regime-shift.js";
import { evaluateResearchInputGate } from "./research-gate.js";
import { computeResearchReliabilityScore } from "./score.js";
import { assessStrategyRobustness } from "./strategy-robustness.js";
import type {
  AssessMifResearchReliabilityInput,
  MifResearchReliabilityAssessment,
} from "./types.js";

function idHash(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function assessMifResearchReliability(
  input: AssessMifResearchReliabilityInput,
): MifResearchReliabilityAssessment {
  const policy = resolveResearchReliabilityPolicy();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase() || "UNKNOWN";
  const timeframe = input.timeframe ? String(input.timeframe).trim().toUpperCase() : null;
  const sourceMode = input.sourceMode ?? (input.fixtureBars?.length ? "FIXTURE" : "HISTORICAL_SOURCE");
  const missingInputs: string[] = [];
  const limitations: string[] = [
    "Phase 09 is request-driven — continuous reliability worker DISABLED_BY_POLICY",
    "HTTP 200 alone never means LIVE",
    "Live bid/ask are not automatically equivalent to candle close",
    "Reliability score is evidence completeness, not win/event probability",
    "Phase 05/06: tick volume ≠ signed buy/sell; no true aggressor/order-book unless sourced",
    "Phase 07 calendar gates unchanged — no live calendar activation",
  ];

  const quote = assessQuoteReliability({
    quote: input.quote
      ? { ...input.quote, symbol: input.quote.symbol || providerSymbol }
      : input.quote === null
        ? null
        : undefined,
    previousQuote: input.previousQuote,
    recentSpreads: input.recentSpreads,
    policy,
    validationTimestamp: assessmentTimestamp,
  });

  if (!input.quote) missingInputs.push("quote");

  let candles = null;
  if (input.fixtureBars && input.fixtureBars.length) {
    candles = assessCandleReliability({
      datasetId: input.datasetId ?? `ds_${providerSymbol}_${timeframe ?? "NA"}`,
      symbol: providerSymbol,
      timeframe: timeframe ?? "H1",
      bars: input.fixtureBars,
      sourceMode,
      retrievalTimestamp: assessmentTimestamp,
      expectedTimeframeSeconds: timeframe === "H1" ? 3600 : timeframe === "M15" ? 900 : null,
    });
  } else if (input.recentResearch?.dataset) {
    candles = { dataset: input.recentResearch.dataset, reusedPhase08Validator: true as const };
  } else if (input.baselineResearch?.dataset) {
    candles = { dataset: input.baselineResearch.dataset, reusedPhase08Validator: true as const };
  } else {
    missingInputs.push("candles");
  }

  const compare =
    timeframe && (input.quote || input.quote === null)
      ? compareLiveVsHistorical({
          symbol: providerSymbol,
          timeframe,
          quote: input.quote,
          lastClosedCandle: input.lastClosedCandle,
          policy,
        })
      : null;
  if (!input.lastClosedCandle) missingInputs.push("lastClosedCandle");

  const gateDataset = candles?.dataset ?? input.recentResearch?.dataset ?? null;
  const gate = evaluateResearchInputGate({
    dataset: gateDataset,
    strategyId: input.recentResearch?.strategyId ?? input.baselineResearch?.strategyId ?? null,
    strategyVersion:
      input.recentResearch?.strategyVersion ?? input.baselineResearch?.strategyVersion ?? null,
    sourceMode,
    relatedResearchRunId: input.recentResearch?.researchRunId ?? null,
    validationTimestamp: assessmentTimestamp,
  });

  const regime = assessRegimeShift({
    historicalRegime: input.historicalRegime ?? input.baselineResearch?.regimeBreakdown?.[0]?.regimeLabel,
    currentRegime: input.currentRegime ?? input.recentResearch?.regimeBreakdown?.[0]?.regimeLabel,
    timeframe,
  });

  const robustness = assessStrategyRobustness({
    baseline: input.baselineResearch,
    recent: input.recentResearch,
    policy,
    regimeShiftDetected: regime.status === "REGIME_SHIFT_DETECTED",
  });
  if (!input.baselineResearch || !input.recentResearch) {
    missingInputs.push("baseline_or_recent_research");
  }

  const events = assessEventReliability({
    liveCalendarAllowed: input.liveCalendarAllowed ?? false,
    eventsProvided: Boolean(input.eventsProvided),
    eventSourceMode: input.eventSourceMode,
  });

  const reliabilityScore = computeResearchReliabilityScore({
    quote,
    candles,
    compare,
    gate,
    robustness,
    regime,
    events,
  });

  const alerts = buildReliabilityAlerts({
    quote,
    candles,
    compare,
    gate,
    robustness,
    regime,
    events,
    detectionTimestamp: assessmentTimestamp,
  });

  const inputIdentity = idHash({
    providerSymbol,
    timeframe,
    quoteTs: input.quote?.providerTimestampSec ?? null,
    datasetId: gateDataset?.datasetId ?? null,
    contentHash: gateDataset?.contentHash ?? null,
    baseline: input.baselineResearch?.researchRunId ?? null,
    recent: input.recentResearch?.researchRunId ?? null,
  }).slice(0, 32);

  const assessmentId = `rr9_${idHash({
    inputIdentity,
    assessmentTimestamp,
    engine: MIF_RESEARCH_RELIABILITY_ENGINE_VERSION,
  }).slice(0, 24)}`;

  return {
    contractId: MIF_RESEARCH_RELIABILITY_CONTRACT_ID,
    contractVersion: MIF_RESEARCH_RELIABILITY_CONTRACT_VERSION,
    scope: "phase09-research-reliability",
    assessmentId,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    engineId: MIF_RESEARCH_RELIABILITY_ENGINE_ID,
    engineVersion: MIF_RESEARCH_RELIABILITY_ENGINE_VERSION,
    modelVersion: MIF_RESEARCH_RELIABILITY_MODEL_VERSION,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    assessmentTimestamp,
    quote,
    candles,
    liveHistoricalCompare: compare,
    researchGate: gate,
    strategyRobustness: robustness,
    regimeShift: regime,
    eventReliability: events,
    reliabilityScore,
    alerts,
    limitations,
    missingInputs: [...new Set(missingInputs)],
    capabilityMatrix: {
      liveQuoteValidation: "IMPLEMENTED",
      historicalCandleValidation: "REUSED_AND_VERIFIED",
      liveHistoricalCompare: "IMPLEMENTED",
      researchInputGate: "IMPLEMENTED",
      strategyRobustness: "IMPLEMENTED",
      regimeShift: "IMPLEMENTED",
      eventReliability: "IMPLEMENTED",
      continuousWorker: "DISABLED_BY_POLICY",
      brokerExecution: "DISABLED_BY_POLICY",
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    isWinProbability: false,
    isEventProbability: false,
    isProbabilityCalibration: false,
    continuousReliabilityWorker: "DISABLED_BY_POLICY",
    doesNotConfirmOrInvalidateLifecycleAlone: true,
  };
}
