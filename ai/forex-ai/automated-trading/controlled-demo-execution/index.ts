/**
 * Stage 7 — Controlled DEMO execution (public surface).
 * Readiness + grants + blocked attempts. Never places broker orders.
 */
export * from "./types.js";
export { evaluateTimeInForce, normalizeTimeInForce } from "./tif.js";
export { verifyPostFillProtection } from "./protection.js";
export {
  evaluateControlledDemoReadiness,
  type Stage7ReadinessInput,
} from "./readiness.js";
export {
  issueControlledDemoGrant,
  revokeGrant,
  type IssueGrantInput,
  type IssueGrantResult,
} from "./grant.js";
export {
  ControlledDemoExecutionStore,
  getControlledDemoExecutionStore,
  resetControlledDemoExecutionStoreForTests,
} from "./store.js";
export {
  getControlledDemoPublicStatus,
  runControlledDemoReadiness,
  issueStage7Grant,
  revokeStage7Grant,
  createStage7AttemptRecord,
} from "./coordinator.js";
