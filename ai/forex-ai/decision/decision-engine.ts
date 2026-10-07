/**
 * Central decision posture from deterministic scenario / confirmation / invalidation.
 * Never emits BUY/SELL execution language.
 */
import type { ForexMtfAlignmentResult, ForexMultiTimeframeMarketState } from "../mtf/types.js";
import { buildConfirmationConditions } from "./confirmation.js";
import { buildEntryZone } from "./entry-zone.js";
import { buildInvalidationConditions } from "./invalidation.js";
import { buildRiskContext, buildStopAndTargets } from "./risk.js";
import { selectDecisionScenario } from "./scenario-engine.js";
import type {
  ForexDecisionDeterministicPack,
  ForexDecisionPosture,
} from "./types.js";

export function resolveDecisionPosture(input: {
  dataQuality: string;
  scenarioType: string;
  confirmationAllMet: boolean;
  invalidationTriggered: boolean;
  alignmentOverall: string;
}): ForexDecisionPosture {
  if (
    input.dataQuality === "INSUFFICIENT_DATA"
    || input.scenarioType === "INSUFFICIENT_DATA"
    || input.alignmentOverall === "INSUFFICIENT_DATA"
  ) {
    return "INSUFFICIENT_DATA";
  }

  if (input.dataQuality === "STALE" || input.dataQuality === "DISCONNECTED") {
    return "WAIT";
  }

  if (input.invalidationTriggered) {
    return "INVALIDATED";
  }

  if (input.scenarioType === "CONFLICT" || input.alignmentOverall === "CONFLICTING") {
    return "WAIT";
  }

  if (input.scenarioType === "WAIT") {
    return "WAIT";
  }

  if (
    input.scenarioType === "BREAKOUT_WATCH"
    || input.scenarioType === "BREAKDOWN_WATCH"
    || input.scenarioType === "REVERSAL_WATCH"
    || input.scenarioType === "RANGE_CONSOLIDATION"
  ) {
    return input.confirmationAllMet ? "WATCH" : "WATCH";
  }

  if (!input.confirmationAllMet) {
    return "CONFIRMATION_REQUIRED";
  }

  return "SCENARIO_ACTIVE";
}

export function runDeterministicDecisionEngines(
  mtf: ForexMultiTimeframeMarketState,
  alignment: ForexMtfAlignmentResult,
): ForexDecisionDeterministicPack {
  const scenario = selectDecisionScenario(mtf, alignment);
  const entryZone = buildEntryZone(mtf, scenario);
  const confirmation = buildConfirmationConditions(mtf, alignment, scenario, entryZone);
  const invalidation = buildInvalidationConditions(mtf, alignment, scenario, entryZone);
  const riskContext = buildRiskContext(mtf, alignment, entryZone);
  const { stopLossCandidate, takeProfitCandidates, riskReward } = buildStopAndTargets(
    mtf,
    scenario,
    entryZone,
  );

  const decisionPosture = resolveDecisionPosture({
    dataQuality: mtf.dataQuality,
    scenarioType: scenario.type,
    confirmationAllMet: confirmation.allRequiredMet,
    invalidationTriggered: invalidation.triggered,
    alignmentOverall: alignment.overall,
  });

  // Sync entry zone status with posture
  if (entryZone.status !== "UNAVAILABLE") {
    if (decisionPosture === "INVALIDATED") entryZone.status = "INVALIDATED";
    else if (decisionPosture === "SCENARIO_ACTIVE") entryZone.status = "ACTIVE";
    else if (decisionPosture === "CONFIRMATION_REQUIRED") entryZone.status = "WAITING_CONFIRMATION";
    else entryZone.status = "CANDIDATE";
  }

  const observedFacts: string[] = [
    `symbol=${mtf.symbol}`,
    `dataQuality=${mtf.dataQuality}`,
    `alignment=${alignment.overall}`,
    `higherBias=${alignment.higherBias}`,
    `scenario=${scenario.type}`,
    `decisionPosture=${decisionPosture}`,
    ...mtf.slots.filter((s) => s.compact.usable).map((s) => {
      const c = s.compact;
      return `${c.timeframe}: trend=${c.trend} mom=${c.momentum} rsi=${c.rsi ?? "n/a"}`;
    }),
  ];
  if (entryZone.status === "UNAVAILABLE") {
    observedFacts.push(`entryZone=UNAVAILABLE (${entryZone.unavailableReason})`);
  } else {
    observedFacts.push(
      `entryZone=${entryZone.lowerBound}–${entryZone.upperBound} ref=${entryZone.referencePrice}`,
    );
  }

  const deterministicSummary = [
    `Scenario ${scenario.type} (${scenario.direction}).`,
    `Decision posture ${decisionPosture}.`,
    confirmation.summary,
    invalidation.summary,
    entryZone.status === "UNAVAILABLE"
      ? entryZone.unavailableReason
      : `Entry zone candidate ${entryZone.lowerBound}–${entryZone.upperBound} on ${entryZone.timeframe}.`,
    riskReward.ratio != null
      ? `Risk/reward ratio=${riskReward.ratio.toFixed(3)} (${riskReward.method}).`
      : riskReward.unavailableReason,
  ].filter(Boolean).join(" ");

  return {
    mtf,
    alignment,
    scenario,
    entryZone,
    confirmation,
    invalidation,
    riskContext,
    riskReward,
    stopLossCandidate,
    takeProfitCandidates,
    decisionPosture,
    observedFacts,
    deterministicSummary,
  };
}
