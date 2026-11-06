/**
 * Stage 5 — Automated Per-Order Risk Management Engine (public surface).
 * Proposal preparation only — never places broker orders.
 */
export {
  AT_PER_ORDER_RISK_SCHEMA,
  AT_PER_ORDER_RISK_STAGE,
  AT_PER_ORDER_RISK_PHASE,
  DEFAULT_PER_ORDER_RISK_PERCENT,
  MAX_PER_ORDER_LOSS_PERCENT,
  MINIMUM_REWARD_TO_RISK_RATIO,
  MODELED_VS_REALIZED_NOTE,
  PER_ORDER_RISK_TARGET_PERCENT,
  PER_ORDER_RISK_MAXIMUM_PERCENT,
  RISK_POLICY_ID,
  RISK_POLICY_VERSION,
  type PerOrderRiskDisplayCategory,
  type PerOrderRiskRecord,
  type PerOrderRiskRejection,
  type PerOrderRiskRejectionCode,
  type PerOrderRiskValidationResult,
  type PerOrderRiskLevelProvenance,
} from "./types.js";

export {
  deriveAutomaticOrderLevels,
  proposeStopFromVerifiedAtr,
  type AutoLevelsResult,
} from "./auto-levels.js";

export {
  validateMonetaryRewardToRisk,
  type Monetary3RValidation,
} from "./monetary-3r.js";

export {
  buildPerOrderRiskRecord,
  mapProposalBlockerToRejection,
  resolveDisplayCategory,
  resolveValidationResult,
} from "./build-record.js";

export {
  runAutomatedPerOrderRiskEngine,
  type RunPerOrderRiskEngineInput,
  type RunPerOrderRiskEngineResult,
} from "./engine.js";
