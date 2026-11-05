/**
 * Phase 1 audit policy for Broker Execution Engine.
 *
 * READ-ONLY STATUS POLLING (GET …/broker-engine/status):
 * - Runs evaluateExecutionAuthorization for live blockers.
 * - Does NOT append audit events per poll (unbounded volume risk).
 * - Denial codes remain visible on the status payload; they are not durable audit rows.
 *
 * DURABLE AUDIT (required):
 * - State-changing authorization attempts (e.g. REQUEST_EXECUTION_MASTER_ON).
 * - Denied lifecycle transitions (submit-adjacent / invalid Phase 1 hops).
 * - Authorization intent recording (activatesMutation always false in Phase 1).
 * - Successful Phase 1 lifecycle transitions that stay within allowed states.
 *
 * PERSISTENCE:
 * - Required denial audits must persist; failure returns AUDIT_PERSIST_FAILED.
 * - Audit failure never enables Execution Master, arming, or broker mutation.
 */
export const AT_BROKER_EXECUTION_AUDIT_POLICY = {
  version: "at-broker-execution-audit-policy-v1" as const,
  statusGetWritesAudit: false,
  statusGetDocumentsDenialsOnPayload: true,
  stateChangingAttemptsWriteAudit: true,
  deniedLifecycleTransitionsWriteAudit: true,
  requiredDenialAuditMustPersist: true,
  legacyMissingFieldsRemainNull: true,
} as const;

export type AtBrokerExecutionAuditDecision = "ALLOW" | "DENY";
