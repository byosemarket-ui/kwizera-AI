/**
 * Stage 7 — Public coordinator: readiness, grant issue/revoke, blocked attempt create.
 * Never invokes ForexConnect mutation.
 */
import { randomUUID } from "node:crypto";
import {
  AssertNeverCalledMutationPort,
  getDefaultMutationPort,
} from "../demo-submission-adapter/mutation-port.js";
import { issueControlledDemoGrant, revokeGrant, type IssueGrantInput } from "./grant.js";
import { evaluateControlledDemoReadiness, type Stage7ReadinessInput } from "./readiness.js";
import { getControlledDemoExecutionStore } from "./store.js";
import { verifyPostFillProtection } from "./protection.js";
import {
  AT_CONTROLLED_DEMO_PHASE,
  AT_CONTROLLED_DEMO_SCHEMA,
  AT_CONTROLLED_DEMO_STAGE,
  STAGE7_OWNER_MAX_LOTS,
  type Stage7ExecutionAttempt,
  type Stage7PublicStatus,
  type Stage7ReadinessReport,
} from "./types.js";

export function getControlledDemoPublicStatus(input?: {
  storageRoot?: string;
  controlsObserved?: Stage7PublicStatus["controlsObserved"];
}): Stage7PublicStatus {
  const store = getControlledDemoExecutionStore(input?.storageRoot);
  const latest = store.latestReadiness();
  const grant = store.activeGrant();
  const attempt = store.latestAttempt();
  return {
    schemaVersion: AT_CONTROLLED_DEMO_SCHEMA,
    stage: AT_CONTROLLED_DEMO_STAGE,
    phase: AT_CONTROLLED_DEMO_PHASE,
    submissionEnabled: false,
    displayState: attempt?.displayState ?? latest?.displayState ?? "NOT_READY",
    latestReadiness: latest,
    activeGrant: grant,
    latestAttempt: attempt,
    attemptCount: store.attemptCount(),
    grantCount: store.grantCount(),
    auditCount: store.auditCount(),
    ownerMaxLots: STAGE7_OWNER_MAX_LOTS,
    controlsObserved: input?.controlsObserved ?? {
      executionMasterEnabled: false,
      emergencyEntryLock: true,
      tradingEnabled: false,
      automaticEntry: false,
      selectedEnvironment: "DEMO",
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    mutationPortWired: false,
    note:
      "Stage 7 controlled DEMO execution coordinator — readiness + one-time grants only. "
      + "Broker mutation DISABLED. Execution Master must remain OFF until separate owner authorization.",
  };
}

export function runControlledDemoReadiness(
  input: Stage7ReadinessInput & { storageRoot?: string; actor?: string; correlationId?: string },
): Stage7ReadinessReport {
  const store = getControlledDemoExecutionStore(input.storageRoot);
  const unresolved = input.proposal
    ? store.hasUnresolvedAttemptForProposal(input.proposal.proposalId)
    : input.unresolvedAttemptExists;
  const report = evaluateControlledDemoReadiness({
    ...input,
    unresolvedAttemptExists: unresolved,
    activeGrant: input.activeGrant ?? store.activeGrant(input.nowMs),
  });
  store.saveReadiness(report);
  store.appendAudit({
    atUtc: report.evaluatedAtUtc,
    actor: input.actor ?? "system",
    action: "READINESS_EVALUATED",
    detail: `displayState=${report.displayState}; technicalPass=${report.technicalPass}; blockers=${report.blockers.length}`,
    correlationId: input.correlationId ?? null,
    proposalId: report.snapshot?.proposalId ?? null,
    grantId: store.activeGrant()?.grantId ?? null,
    attemptId: null,
    blockerCodes: report.blockers.map((b) => b.code),
  });
  return report;
}

export function issueStage7Grant(input: {
  readiness?: Stage7ReadinessReport | null;
  readinessInput?: Stage7ReadinessInput;
  storageRoot?: string;
  actor: string;
  confirm: boolean;
  confirmed: IssueGrantInput["confirmed"];
  ttlMs?: number;
  correlationId?: string;
  nowMs?: number;
}) {
  const store = getControlledDemoExecutionStore(input.storageRoot);
  const readiness = input.readiness
    ?? (input.readinessInput
      ? runControlledDemoReadiness({ ...input.readinessInput, storageRoot: input.storageRoot, actor: input.actor })
      : store.latestReadiness());
  if (!readiness) {
    return { ok: false as const, code: "READINESS_MISSING", message: "Evaluate readiness before issuing a grant.", grant: null };
  }
  const issued = issueControlledDemoGrant({
    readiness,
    actor: input.actor,
    confirm: input.confirm,
    confirmed: input.confirmed,
    ttlMs: input.ttlMs,
    nowMs: input.nowMs,
  });
  if (!issued.ok) {
    store.appendAudit({
      atUtc: new Date(input.nowMs ?? Date.now()).toISOString(),
      actor: input.actor,
      action: "GRANT_REJECTED",
      detail: `${issued.code}: ${issued.message}`,
      correlationId: input.correlationId ?? null,
      proposalId: input.confirmed.proposalId,
      grantId: null,
      attemptId: null,
      blockerCodes: [issued.code],
    });
    return { ok: false as const, code: issued.code, message: issued.message, grant: null };
  }
  store.setActiveGrant(issued.grant);
  store.appendAudit({
    atUtc: issued.grant.createdAtUtc,
    actor: input.actor,
    action: "GRANT_ISSUED",
    detail: `grantId=${issued.grant.grantId}; activatesMutation=false; expires=${issued.grant.expiresAtUtc}`,
    correlationId: input.correlationId ?? null,
    proposalId: issued.grant.proposalId,
    grantId: issued.grant.grantId,
    attemptId: null,
    blockerCodes: [],
  });
  return { ok: true as const, grant: issued.grant, code: null, message: null };
}

export function revokeStage7Grant(input: {
  storageRoot?: string;
  actor: string;
  correlationId?: string;
  nowMs?: number;
}) {
  const store = getControlledDemoExecutionStore(input.storageRoot);
  const g = store.activeGrant(input.nowMs);
  if (!g) {
    return { ok: false as const, code: "NO_ACTIVE_GRANT", message: "No active grant to revoke." };
  }
  const revoked = revokeGrant(g, input.nowMs);
  store.updateGrant(revoked);
  store.appendAudit({
    atUtc: revoked.revokedAtUtc!,
    actor: input.actor,
    action: "GRANT_REVOKED",
    detail: `grantId=${revoked.grantId}`,
    correlationId: input.correlationId ?? null,
    proposalId: revoked.proposalId,
    grantId: revoked.grantId,
    attemptId: null,
    blockerCodes: [],
  });
  return { ok: true as const, grant: revoked };
}

/**
 * Create a blocked/authorized attempt record for idempotency testing.
 * Never calls mutation port.
 */
export function createStage7AttemptRecord(input: {
  readiness: Stage7ReadinessReport;
  idempotencyKey: string;
  storageRoot?: string;
  actor?: string;
  correlationId?: string;
  mutationPort?: AssertNeverCalledMutationPort;
  nowMs?: number;
}): { ok: boolean; duplicate: boolean; attempt: Stage7ExecutionAttempt; mutationInvoked: false } {
  const store = getControlledDemoExecutionStore(input.storageRoot);
  const port = input.mutationPort ?? new AssertNeverCalledMutationPort();
  void getDefaultMutationPort();
  void port.name; // ensure port present; never invoke

  const nowIso = new Date(input.nowMs ?? Date.now()).toISOString();
  const snap = input.readiness.snapshot;
  const grant = store.activeGrant(input.nowMs);
  const attempt: Stage7ExecutionAttempt = {
    schemaVersion: AT_CONTROLLED_DEMO_SCHEMA,
    stage: AT_CONTROLLED_DEMO_STAGE,
    phase: AT_CONTROLLED_DEMO_PHASE,
    attemptId: randomUUID(),
    idempotencyKey: input.idempotencyKey,
    state: "BLOCKED",
    displayState: input.readiness.displayState,
    proposalSnapshot: snap ?? {
      proposalId: "missing",
      proposalVersion: "missing",
      riskRecordId: null,
      allocationId: null,
      accountIdMasked: null,
      instrument: null,
      direction: null,
      quantity: null,
      entryPrice: null,
      stopLoss: null,
      takeProfit: null,
      timeInForce: null,
      capitalAllocation: null,
      operatingRiskPercent: null,
      modeledMonetaryRisk: null,
      rewardToRisk: null,
    },
    grantId: grant?.grantId ?? null,
    blockers: [
      ...input.readiness.blockers,
    ],
    brokerRequestId: null,
    brokerOrderId: null,
    brokerTradeId: null,
    acknowledgementSource: "NONE",
    verifiedBrokerAcceptance: false,
    protection: null,
    createdAtUtc: nowIso,
    updatedAtUtc: nowIso,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    executionAuthorized: false,
    mutationInvoked: false,
  };

  const up = store.upsertAttempt(attempt);
  store.appendAudit({
    atUtc: nowIso,
    actor: input.actor ?? "system",
    action: up.duplicate ? "ATTEMPT_IDEMPOTENT_REPLAY" : "ATTEMPT_CREATED_BLOCKED",
    detail: `state=${up.attempt.state}; mutationInvoked=false`,
    correlationId: input.correlationId ?? null,
    proposalId: up.attempt.proposalSnapshot.proposalId,
    grantId: up.attempt.grantId,
    attemptId: up.attempt.attemptId,
    blockerCodes: up.attempt.blockers.map((b) => b.code),
  });

  return {
    ok: true,
    duplicate: up.duplicate,
    attempt: up.attempt,
    mutationInvoked: false,
  };
}

export { verifyPostFillProtection, evaluateControlledDemoReadiness };
