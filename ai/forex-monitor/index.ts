export {
  FOREX_MONITOR_SCHEMA_VERSION,
  DEFAULT_FOREX_MONITOR_CONFIG,
  type ForexMonitorLifecycleState,
  type SetupEvalState,
  type FreshnessState,
  type NarrativeStatus,
  type ForexMonitorConfig,
  type SetupRecord,
  type ForexMonitorNarrative,
  type ForexMonitorSession,
  type ForexMonitorEvent,
  type ForexMonitorEventType,
  type SetupEvaluation,
  type StartForexMonitorRequest,
  type EvaluateMonitorTickInput,
  type EvaluateMonitorTickResult,
} from "./types.js";

export {
  DEFAULT_FOREX_MONITOR_LIMITS,
  resolveForexMonitorLimits,
  type ForexMonitorLimits,
} from "./limits.js";

export {
  assessCandleFreshness,
  assessCandleFreshnessDetailed,
  type CandleFreshnessInput,
  type CandleFreshnessResult,
} from "./freshness.js";

export {
  SETUP_RULE_ID,
  SETUP_RULE_VERSION,
  evaluateSetupRules,
  type EvaluateSetupRulesInput,
} from "./setup-rules.js";

export {
  evaluateMonitorTick,
  type EvaluateMonitorDeps,
  type FetchMonitorCandles,
} from "./evaluate.js";

export { ForexMonitorStore } from "./store.js";
export { ForexMonitorNarrativeQueue } from "./narrative-queue.js";

export {
  ForexMonitorManager,
  getForexMonitorManager,
  resetForexMonitorManagerForTests,
  assertTransition,
  canTransition,
  shouldApplyNarrativeResult,
  ForexMonitorTransitionError,
  type ForexMonitorManagerOptions,
  type ForexMonitorRuntimeStats,
} from "./manager.js";
