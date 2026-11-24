/**
 * Phase 08 — assessMifStrategyResearch (HFM_MT5).
 * Unifies dataset validation, metrics, cost sensitivity, regime breakdown,
 * walk-forward summary, and event→price research. No broker execution.
 * Does not enable continuous workers. Does not change Phase 03/04 semantics.
 */
import { createHash } from "node:crypto";
import { MIF_PROVIDER_ID } from "../canonical/types.js";
import { stableSerialize } from "../quality/stable-identity.js";
import { MifStrategyIntelligenceRegistry } from "../strategy-intelligence/registry.js";
import { buildGrossOhlcAssumptions } from "../backtesting/assumptions.js";
import {
  MIF_STRATEGY_RESEARCH_CONTRACT_ID,
  MIF_STRATEGY_RESEARCH_CONTRACT_VERSION,
  MIF_STRATEGY_RESEARCH_ENGINE_ID,
  MIF_STRATEGY_RESEARCH_ENGINE_VERSION,
  MIF_STRATEGY_RESEARCH_MODEL_VERSION,
} from "./contracts.js";
import { runCostSensitivity } from "./cost-sensitivity.js";
import { validateResearchDataset } from "./dataset-validate.js";
import { researchEventPriceWindows } from "./event-price-research.js";
import { computeStrategyResearchPerformance } from "./metrics.js";
import {
  defaultGrossCostAssumption,
  resolveStrategyResearchPolicy,
} from "./policies.js";
import { assessResearchReliability, researchOnlyBanner } from "./reliability.js";
import { buildRegimeBreakdown } from "./regime-breakdown.js";
import type {
  AssessMifStrategyResearchInput,
  HfmSimulatedTradeInput,
  HfmWalkForwardSummary,
  MifStrategyResearchAssessment,
} from "./types.js";

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

function emptyWalkForward(note: string): HfmWalkForwardSummary {
  return {
    available: false,
    development: null,
    validation: null,
    outOfSample: null,
    performanceDegradation: null,
    status: "NOT_RUN",
    note,
  };
}

function attachRegimeLabels(
  trades: readonly HfmSimulatedTradeInput[],
  labels: readonly string[] | undefined,
): HfmSimulatedTradeInput[] {
  if (!labels?.length) return [...trades];
  return trades.map((t, i) => ({
    ...t,
    regimeLabel: t.regimeLabel ?? labels[i] ?? "UNCLASSIFIED",
  }));
}

export function assessMifStrategyResearch(
  input: AssessMifStrategyResearchInput,
): MifStrategyResearchAssessment {
  const runTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const policy = resolveStrategyResearchPolicy();
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase() || "H1";
  const sourceMode = input.sourceMode
    ?? (input.fixtureBars?.length ? "FIXTURE" : "HISTORICAL_SOURCE");

  const registry = new MifStrategyIntelligenceRegistry();
  const strategy = input.strategyVersion
    ? (registry.getStrategyVersion(input.strategyId, input.strategyVersion)
      ?? registry.getStrategy(input.strategyId))
    : registry.getStrategy(input.strategyId);

  const strategyId = strategy?.strategyId ?? String(input.strategyId || "UNKNOWN");
  const strategyVersion =
    input.strategyVersion
    ?? strategy?.definitionVersion
    ?? "unknown";
  const strategyName = strategy?.name ?? strategyId;

  const bars = input.fixtureBars ?? [];
  const dataset = validateResearchDataset({
    datasetId: input.datasetId ?? `fixture:${providerSymbol}:${timeframe}`,
    symbol: providerSymbol,
    timeframe,
    bars,
    sourceMode,
    retrievalTimestamp: runTimestamp,
    providerId: MIF_PROVIDER_ID,
  });

  const trades = attachRegimeLabels(input.simulatedTrades ?? [], input.regimeLabelsByTradeIndex);
  const costAssumption = {
    ...defaultGrossCostAssumption(),
    ...(input.costAssumption ?? {}),
  };
  const costGrid = input.costSensitivityGrid?.length
    ? input.costSensitivityGrid
    : [
        { spreadPoints: 10, slippagePoints: 5, label: "modest_spread_slip" },
        { spreadPoints: 30, slippagePoints: 15, label: "elevated_spread_slip" },
        { spreadPoints: 50, slippagePoints: 25, commissionPerTrade: 0.0001, label: "stressed_costs" },
      ];

  const limitations: string[] = [researchOnlyBanner()];
  const missingInputs: string[] = [];
  const supportingEvidence: string[] = [];
  const contradictingEvidence: string[] = [];

  if (!strategy) {
    missingInputs.push("strategy_definition_not_in_registry");
    limitations.push("Strategy ID not found in Phase 5D catalog — research still proceeds on supplied trades");
  } else {
    supportingEvidence.push(`strategy_registry:${strategyId}@${strategyVersion}`);
  }

  if (!dataset.mayProceed) {
    limitations.push(...dataset.blockReasons);
  }
  limitations.push(...dataset.warnings);

  if (!trades.length) {
    missingInputs.push("simulated_trades");
    limitations.push("No simulated trades supplied — metrics UNAVAILABLE/INSUFFICIENT");
  }

  const performance = computeStrategyResearchPerformance(
    trades,
    policy.minSampleForAvailableMetrics,
  );
  const cost = runCostSensitivity({
    trades,
    baseline: costAssumption,
    grid: costGrid,
    policy,
  });
  const regimeBreakdown = buildRegimeBreakdown({ trades, policy });

  const walkForward: HfmWalkForwardSummary = input.walkForward
    ? {
        ...emptyWalkForward("caller-supplied walk-forward summary"),
        ...input.walkForward,
        available: input.walkForward.available ?? true,
      }
    : emptyWalkForward(
        "Walk-forward not supplied in this assessment — reuse Phase 5F backtesting/walk-forward APIs for full OOS runs",
      );

  const eventSourceMode = input.eventSourceMode ?? (input.events?.length ? sourceMode : "FIXTURE");
  const eventPriceResearch = input.events?.length
    ? researchEventPriceWindows({
        symbol: providerSymbol,
        events: input.events,
        bars,
        sourceMode: eventSourceMode,
      })
    : [];
  if (!input.events?.length) {
    missingInputs.push("economic_events");
    limitations.push("Event→price research skipped — no events supplied (Phase 07 gates unchanged)");
  } else if (eventSourceMode === "FIXTURE") {
    limitations.push("Event→price sourceMode=FIXTURE_ONLY semantics");
  }

  const { status: reliabilityStatus, overfittingWarnings } = assessResearchReliability({
    trades,
    walkForward,
    policy,
    multipleComparisonsCount: input.multipleComparisonsCount ?? 1,
    costSensitivityRan: cost.scenarios.length > 0,
  });

  if (performance.ambiguousTrades > 0) {
    limitations.push(
      `${performance.ambiguousTrades} AMBIGUOUS same-candle outcomes — favorable fill never assumed (${policy.sameCandleAmbiguityPolicy})`,
    );
  }

  for (const s of cost.scenarios) {
    if (s.materialDegradation) {
      contradictingEvidence.push(`cost_sensitivity_degradation:${s.assumption.label}`);
    }
  }

  let status: MifStrategyResearchAssessment["status"] = "COMPLETE";
  if (!dataset.mayProceed) status = "INVALID_DATASET";
  else if (!trades.length && !bars.length) status = "INSUFFICIENT_HISTORY";
  else if (reliabilityStatus === "INSUFFICIENT_SAMPLE") status = "PARTIAL";

  const researchRunId = idHash({
    kind: "phase08-research-run",
    providerSymbol,
    timeframe,
    strategyId,
    strategyVersion,
    datasetId: dataset.datasetId,
    contentHash: dataset.contentHash,
    tradeCount: trades.length,
    runTimestamp,
  }).slice(0, 32);

  const inputIdentity = idHash({
    providerSymbol,
    timeframe,
    strategyId,
    strategyVersion,
    dataset: dataset.contentHash ?? dataset.datasetId,
    sourceMode,
  });

  return {
    contractId: MIF_STRATEGY_RESEARCH_CONTRACT_ID,
    contractVersion: MIF_STRATEGY_RESEARCH_CONTRACT_VERSION,
    scope: "phase08-strategy-research",
    researchRunId: `sr8_${researchRunId}`,
    inputIdentity,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    strategyId,
    strategyVersion,
    strategyName,
    engineId: MIF_STRATEGY_RESEARCH_ENGINE_ID,
    engineVersion: MIF_STRATEGY_RESEARCH_ENGINE_VERSION,
    modelVersion: MIF_STRATEGY_RESEARCH_MODEL_VERSION,
    policyId: policy.policyId,
    policyVersion: policy.policyVersion,
    runTimestamp,
    status,
    reliabilityStatus,
    sourceMode,
    dataset,
    executionAssumptions: buildGrossOhlcAssumptions(),
    costAssumptions: costAssumption,
    costSensitivity: cost.scenarios,
    performance,
    regimeBreakdown,
    walkForward,
    eventPriceResearch,
    reusedBacktestRunId: input.reusedBacktestRunId ?? null,
    supportingEvidence,
    contradictingEvidence,
    missingInputs,
    limitations,
    overfittingWarnings,
    capabilityMatrix: {
      datasetValidation: "IMPLEMENTED",
      historicalSimulation: "REUSED_AND_VERIFIED",
      walkForward: "REUSED_AND_VERIFIED",
      costSensitivity: "IMPLEMENTED",
      regimeBreakdown: regimeBreakdown.length ? "IMPLEMENTED" : "UNAVAILABLE",
      eventPriceResearch: input.events?.length
        ? (eventSourceMode === "FIXTURE" ? "FIXTURE_ONLY" : "IMPLEMENTED")
        : "NOT_IMPLEMENTED",
      continuousWorker: "DISABLED_BY_POLICY",
      brokerExecution: "DISABLED_BY_POLICY",
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    isWinProbability: false,
    isEventProbability: false,
    isProbabilityCalibration: false,
    doesNotConfirmOrInvalidateLifecycleAlone: true,
    continuousResearchWorker: "DISABLED_BY_POLICY",
  };
}
