import type { MifStrategyResearchPolicy } from "./policies.js";
import type {
  HfmResearchReliabilityStatus,
  HfmSimulatedTradeInput,
  HfmWalkForwardSummary,
} from "./types.js";

export function assessResearchReliability(input: {
  trades: readonly HfmSimulatedTradeInput[];
  walkForward: HfmWalkForwardSummary;
  policy: MifStrategyResearchPolicy;
  multipleComparisonsCount: number;
  costSensitivityRan: boolean;
}): {
  status: HfmResearchReliabilityStatus;
  overfittingWarnings: string[];
} {
  const closed = input.trades.filter((t) => t.status === "CLOSED" && t.unitReturn != null);
  const warnings: string[] = [];

  if (input.multipleComparisonsCount > 1) {
    warnings.push(
      `multiple_comparisons=${input.multipleComparisonsCount} increases false-discovery risk`,
    );
  }
  if (!input.costSensitivityRan) {
    warnings.push("cost_sensitivity_not_run");
  }

  if (closed.length < input.policy.minSampleForAvailableMetrics) {
    return {
      status: "INSUFFICIENT_SAMPLE",
      overfittingWarnings: [
        ...warnings,
        `closed_trades=${closed.length} < min=${input.policy.minSampleForAvailableMetrics}`,
      ],
    };
  }

  if (input.walkForward.status === "OUT_OF_SAMPLE_TESTED") {
    return {
      status: "OUT_OF_SAMPLE_TESTED",
      overfittingWarnings: [
        ...warnings,
        "OOS tested — still not live trading proof; RESEARCH_ONLY semantics apply to interpretation",
      ],
    };
  }

  if (input.walkForward.status === "INSUFFICIENT_HISTORY" || input.walkForward.status === "NOT_RUN") {
    warnings.push("walk_forward_incomplete");
    return { status: "PROVISIONAL", overfittingWarnings: warnings };
  }

  return { status: "ROBUSTNESS_UNVERIFIED", overfittingWarnings: warnings };
}

/** Always attach RESEARCH_ONLY interpretive banner. */
export function researchOnlyBanner(): string {
  return "RESEARCH_ONLY — backtest performance is not a guarantee of future performance";
}
