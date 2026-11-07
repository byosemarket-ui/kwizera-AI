/**
 * Stage 7.1 — DEMO Execution Readiness Audit (public surface).
 * Read-only. Never places broker orders.
 */
export * from "./types.js";
export { runDemoExecutionReadinessAudit, type Stage71AuditInput } from "./run-audit.js";
export {
  runUnknownResultReconciliationScenarios,
  type ReconciliationScenarioResult,
} from "./reconciliation-scenarios.js";
