/**
 * Dynamic Spread Intelligence Engine — barrel.
 * ACCEPT/REJECT eligibility only. Never places broker orders.
 */
export * from "./types.js";
export * from "./rolling-stats.js";
export * from "./spread-cost.js";
export { evaluateDynamicSpread } from "./engine.js";
export {
  decidePerTradeEconomicFeasibility,
  PER_TRADE_ECONOMIC_FEASIBILITY_DECISION_ID,
  type PerTradeEconomicFeasibilityInput,
  type PerTradeEconomicFeasibilityResult,
} from "./decide-trade-feasibility.js";
