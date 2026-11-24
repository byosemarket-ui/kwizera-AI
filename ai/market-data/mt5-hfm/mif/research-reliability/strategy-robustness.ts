import { MIF_RESEARCH_RELIABILITY_POLICY_VERSION } from "./contracts.js";
import type { MifResearchReliabilityPolicy } from "./policies.js";
import type { MifStrategyResearchAssessment } from "../strategy-research/types.js";
import type { HfmStrategyRobustnessReport } from "./types.js";

export function assessStrategyRobustness(input: {
  baseline: MifStrategyResearchAssessment | null | undefined;
  recent: MifStrategyResearchAssessment | null | undefined;
  policy: MifResearchReliabilityPolicy;
  regimeShiftDetected?: boolean;
}): HfmStrategyRobustnessReport {
  const baseline = input.baseline;
  const recent = input.recent;

  if (!baseline || !recent) {
    return {
      status: "NOT_EVALUABLE",
      strategyId: recent?.strategyId ?? baseline?.strategyId ?? "UNKNOWN",
      strategyVersion: recent?.strategyVersion ?? baseline?.strategyVersion ?? "unknown",
      symbol: recent?.providerSymbol ?? baseline?.providerSymbol ?? "UNKNOWN",
      timeframe: recent?.timeframe ?? baseline?.timeframe ?? "UNKNOWN",
      baselineSampleSize: baseline?.performance.winRate.sampleSize ?? 0,
      recentSampleSize: recent?.performance.winRate.sampleSize ?? 0,
      baselineExpectancy: baseline?.performance.expectancy.value ?? null,
      recentExpectancy: recent?.performance.expectancy.value ?? null,
      expectancyChangeFrac: null,
      baselineProfitFactor: baseline?.performance.profitFactor.value ?? null,
      recentProfitFactor: recent?.performance.profitFactor.value ?? null,
      baselineMaxDrawdown: baseline?.performance.maxDrawdown.value ?? null,
      recentMaxDrawdown: recent?.performance.maxDrawdown.value ?? null,
      explanation: "Baseline and recent research assessments both required",
      criteriaVersion: MIF_RESEARCH_RELIABILITY_POLICY_VERSION,
      evidenceKind: "UNAVAILABLE",
    };
  }

  if (
    baseline.dataset.qualityStatus === "INVALID"
    || recent.dataset.qualityStatus === "INVALID"
    || !baseline.dataset.mayProceed
    || !recent.dataset.mayProceed
  ) {
    return {
      status: "DATA_QUALITY_BLOCKED",
      strategyId: recent.strategyId,
      strategyVersion: recent.strategyVersion,
      symbol: recent.providerSymbol,
      timeframe: recent.timeframe,
      baselineSampleSize: baseline.performance.winRate.sampleSize,
      recentSampleSize: recent.performance.winRate.sampleSize,
      baselineExpectancy: baseline.performance.expectancy.value,
      recentExpectancy: recent.performance.expectancy.value,
      expectancyChangeFrac: null,
      baselineProfitFactor: baseline.performance.profitFactor.value,
      recentProfitFactor: recent.performance.profitFactor.value,
      baselineMaxDrawdown: baseline.performance.maxDrawdown.value,
      recentMaxDrawdown: recent.performance.maxDrawdown.value,
      explanation: "Dataset quality blocks robustness comparison",
      criteriaVersion: MIF_RESEARCH_RELIABILITY_POLICY_VERSION,
      evidenceKind: "MEASURED",
    };
  }

  if (input.regimeShiftDetected) {
    return {
      status: "REGIME_SHIFT_DETECTED",
      strategyId: recent.strategyId,
      strategyVersion: recent.strategyVersion,
      symbol: recent.providerSymbol,
      timeframe: recent.timeframe,
      baselineSampleSize: baseline.performance.winRate.sampleSize,
      recentSampleSize: recent.performance.winRate.sampleSize,
      baselineExpectancy: baseline.performance.expectancy.value,
      recentExpectancy: recent.performance.expectancy.value,
      expectancyChangeFrac: null,
      baselineProfitFactor: baseline.performance.profitFactor.value,
      recentProfitFactor: recent.performance.profitFactor.value,
      baselineMaxDrawdown: baseline.performance.maxDrawdown.value,
      recentMaxDrawdown: recent.performance.maxDrawdown.value,
      explanation: "Regime shift flagged — performance comparison may not be representative",
      criteriaVersion: MIF_RESEARCH_RELIABILITY_POLICY_VERSION,
      evidenceKind: "INFERRED",
    };
  }

  const baseN = baseline.performance.winRate.sampleSize;
  const recentN = recent.performance.winRate.sampleSize;
  const baseExp = baseline.performance.expectancy.value;
  const recentExp = recent.performance.expectancy.value;

  if (recentN < input.policy.minSampleDegradation || baseN < input.policy.minSampleDegradation) {
    return {
      status: "INSUFFICIENT_SAMPLE",
      strategyId: recent.strategyId,
      strategyVersion: recent.strategyVersion,
      symbol: recent.providerSymbol,
      timeframe: recent.timeframe,
      baselineSampleSize: baseN,
      recentSampleSize: recentN,
      baselineExpectancy: baseExp,
      recentExpectancy: recentExp,
      expectancyChangeFrac: null,
      baselineProfitFactor: baseline.performance.profitFactor.value,
      recentProfitFactor: recent.performance.profitFactor.value,
      baselineMaxDrawdown: baseline.performance.maxDrawdown.value,
      recentMaxDrawdown: recent.performance.maxDrawdown.value,
      explanation: `Need >= ${input.policy.minSampleDegradation} closed trades in baseline and recent windows`,
      criteriaVersion: MIF_RESEARCH_RELIABILITY_POLICY_VERSION,
      evidenceKind: "MEASURED",
    };
  }

  let changeFrac: number | null = null;
  if (baseExp != null && recentExp != null && Math.abs(baseExp) > 1e-12) {
    changeFrac = (baseExp - recentExp) / Math.abs(baseExp);
  }

  let status: HfmStrategyRobustnessReport["status"] = "STABLE_WITHIN_BASELINE";
  let explanation = "Recent expectancy within baseline band";
  if (changeFrac != null && changeFrac >= input.policy.degradationConfirmFrac) {
    status = "DEGRADATION_CONFIRMED";
    explanation = `Expectancy drop frac ${changeFrac.toFixed(3)} >= confirm ${input.policy.degradationConfirmFrac} with sample ${recentN}`;
  } else if (changeFrac != null && changeFrac >= input.policy.degradationSuspectFrac) {
    status = "DEGRADATION_SUSPECTED";
    explanation = `Expectancy drop frac ${changeFrac.toFixed(3)} >= suspect ${input.policy.degradationSuspectFrac} — not confirmed`;
  }

  return {
    status,
    strategyId: recent.strategyId,
    strategyVersion: recent.strategyVersion,
    symbol: recent.providerSymbol,
    timeframe: recent.timeframe,
    baselineSampleSize: baseN,
    recentSampleSize: recentN,
    baselineExpectancy: baseExp,
    recentExpectancy: recentExp,
    expectancyChangeFrac: changeFrac,
    baselineProfitFactor: baseline.performance.profitFactor.value,
    recentProfitFactor: recent.performance.profitFactor.value,
    baselineMaxDrawdown: baseline.performance.maxDrawdown.value,
    recentMaxDrawdown: recent.performance.maxDrawdown.value,
    explanation,
    criteriaVersion: MIF_RESEARCH_RELIABILITY_POLICY_VERSION,
    evidenceKind: "MEASURED",
  };
}
