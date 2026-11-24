/**
 * Phase 08 cost sensitivity — configurable assumptions only (not measured fills).
 */
import type { MifStrategyResearchPolicy } from "./policies.js";
import { defaultGrossCostAssumption } from "./policies.js";
import type {
  HfmCostAssumption,
  HfmCostSensitivityScenario,
  HfmSimulatedTradeInput,
} from "./types.js";

function applyCostToReturn(
  unitReturn: number,
  entryPrice: number,
  assumption: HfmCostAssumption,
): number {
  // Point costs modeled as fraction of entry when entry > 0; commission absolute unit drag.
  const pointDrag =
    entryPrice > 0
      ? (assumption.spreadPoints + assumption.slippagePoints) / entryPrice
      : 0;
  return unitReturn - pointDrag - assumption.commissionPerTrade;
}

export function runCostSensitivity(input: {
  trades: readonly HfmSimulatedTradeInput[];
  baseline: HfmCostAssumption;
  grid: readonly Partial<HfmCostAssumption>[];
  policy: MifStrategyResearchPolicy;
}): {
  baselineNet: number | null;
  baselineExpectancy: number | null;
  scenarios: HfmCostSensitivityScenario[];
} {
  const closed = input.trades.filter((t) => t.status === "CLOSED" && t.unitReturn != null);
  const baselineNet = closed.length
    ? closed.reduce(
        (a, t) => a + applyCostToReturn(t.unitReturn!, t.entryPrice, input.baseline),
        0,
      )
    : null;
  const baselineExpectancy =
    closed.length && baselineNet != null ? baselineNet / closed.length : null;

  const scenarios: HfmCostSensitivityScenario[] = [];
  const limited = input.grid.slice(0, input.policy.maxCostScenarios);
  for (const partial of limited) {
    const assumption: HfmCostAssumption = {
      ...defaultGrossCostAssumption(),
      ...partial,
      source: "CONFIGURABLE_ASSUMPTION",
      label: partial.label ?? `spread=${partial.spreadPoints ?? 0}_slip=${partial.slippagePoints ?? 0}`,
      note:
        partial.note
        ?? "Configurable simulation assumption — not measured HFM execution cost",
    };
    const adjustedNet = closed.length
      ? closed.reduce(
          (a, t) => a + applyCostToReturn(t.unitReturn!, t.entryPrice, assumption),
          0,
        )
      : null;
    const adjustedExpectancy =
      closed.length && adjustedNet != null ? adjustedNet / closed.length : null;
    let materialDegradation: boolean | null = null;
    if (
      baselineExpectancy != null
      && adjustedExpectancy != null
      && Math.abs(baselineExpectancy) > 1e-12
    ) {
      const deg =
        (baselineExpectancy - adjustedExpectancy) / Math.abs(baselineExpectancy);
      materialDegradation = deg >= input.policy.materialDegradationThreshold;
    }
    scenarios.push({
      assumption,
      adjustedNetReturn: adjustedNet,
      adjustedExpectancy,
      materialDegradation,
      note:
        materialDegradation === true
          ? "Material degradation vs gross baseline under this cost assumption"
          : "Assumption-based sensitivity only",
    });
  }

  return { baselineNet, baselineExpectancy, scenarios };
}
