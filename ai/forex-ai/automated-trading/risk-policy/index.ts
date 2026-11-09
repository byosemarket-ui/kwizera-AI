/**
 * Stage 3/4 — Risk policy configuration, approval & order readiness.
 */
export * from "./types.js";
export * from "./validate.js";
export * from "./margin.js";
export * from "./readiness.js";
export * from "./resolve.js";
export * from "./observation-evidence.js";
export * from "./spread-observation-collector.js";
export * from "./spread-recommendation.js";
export * from "./slippage-evidence.js";
export * from "./stage1-readiness.js";
export * from "./stage1-evidence-store.js";
export * from "./stage1-part3-slippage-demo-plan.js";
// stage1-live-collector intentionally NOT barrel-exported — it pulls ForexConnect
// live-service/client; import it directly from stage1-live-collector.js when needed.
export {
  AtRiskPolicyStore,
  getAtRiskPolicyStore,
  resetAtRiskPolicyStoreForTests,
} from "./store.js";
