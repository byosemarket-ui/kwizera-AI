/**
 * Per-trade economic feasibility decision for Automated Trading.
 *
 * Single auditable entry point: wraps Dynamic Spread Intelligence so callers
 * evaluate the complete trade (quote, spread cost, SL budget, net ≥3R) rather
 * than a fixed maxSpreadAbsolute ceiling.
 *
 * ACCEPT = economic/technical eligibility only — never authorizes broker submission.
 */
import { evaluateDynamicSpread } from "./engine.js";
import type {
  DynamicSpreadEngineInput,
  DynamicSpreadEvaluationResult,
} from "./types.js";

export const PER_TRADE_ECONOMIC_FEASIBILITY_DECISION_ID =
  "PerTradeEconomicFeasibility" as const;

export type PerTradeEconomicFeasibilityInput = DynamicSpreadEngineInput;

export type PerTradeEconomicFeasibilityResult = DynamicSpreadEvaluationResult & {
  decisionId: typeof PER_TRADE_ECONOMIC_FEASIBILITY_DECISION_ID;
  /**
   * Explicit: fixed maxSpreadAbsolute is never the primary ACCEPT/REJECT rule.
   * legacyMaxSpreadAbsolute remains optional emergency only when supplied.
   */
  primaryEligibilityRule: "PER_TRADE_ECONOMIC_FEASIBILITY";
  fixedCeilingIsPrimaryEligibility: false;
};

/**
 * Decide whether one proposed trade is economically and technically viable.
 * Deterministic for identical validated inputs. REJECT requires a fresh proposal.
 */
export function decidePerTradeEconomicFeasibility(
  input: PerTradeEconomicFeasibilityInput,
): PerTradeEconomicFeasibilityResult {
  const evaluation = evaluateDynamicSpread(input);
  return {
    ...evaluation,
    decisionId: PER_TRADE_ECONOMIC_FEASIBILITY_DECISION_ID,
    primaryEligibilityRule: "PER_TRADE_ECONOMIC_FEASIBILITY",
    fixedCeilingIsPrimaryEligibility: false,
  };
}
