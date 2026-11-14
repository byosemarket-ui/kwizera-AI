import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  AT_BROKER_EXECUTION_AUDIT_POLICY,
  assertPhase1Transition,
  createPhase1AuthorizationIntent,
  evaluateExecutionAuthorization,
  getAtBrokerExecutionStore,
  getBrokerExecutionPublicStatus,
  isSubmitAdjacentLifecycle,
  resetAtBrokerExecutionStoreForTests,
  OWNER_MAX_LOTS_EXECUTION,
} from "../../../../ai/forex-ai/automated-trading/broker-execution/index.js";

describe("Phase 4.18G.4-P1 Broker Execution Engine foundation", () => {
  const roots: string[] = [];

  afterEach(() => {
    resetAtBrokerExecutionStoreForTests();
    for (const root of roots.splice(0)) {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  });

  function tempRoot(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "at-broker-exec-"));
    roots.push(root);
    return root;
  }

  it("defaults fail-closed with Execution Master OFF and DISABLED stamps", () => {
    const root = tempRoot();
    const store = getAtBrokerExecutionStore(root);
    const f = store.get();
    expect(f.executionMasterEnabled).toBe(false);
    expect(f.armedForSubmission).toBe(false);
    expect(f.lifecycle).toBe("IDLE");
    expect(f.placesOrders).toBe(false);
    expect(f.acceptsForExecution).toBe(false);
    expect(f.mutatesBroker).toBe(false);
    expect(f.brokerExecution).toBe("DISABLED");
    expect(OWNER_MAX_LOTS_EXECUTION).toBeNull();
  });

  it("rejects enabling Execution Master with structured DENY audit + correlationId", () => {
    const root = tempRoot();
    const store = getAtBrokerExecutionStore(root);
    const result = store.requestEnableExecutionMaster("test", "corr-deny-1");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PHASE1_SUBMIT_FORBIDDEN");
    expect(result.correlationId).toBe("corr-deny-1");
    const event = store.listAudit(5).find((e) => e.action === "REQUEST_EXECUTION_MASTER_ON");
    expect(event).toBeTruthy();
    expect(event?.decision).toBe("DENY");
    expect(event?.reasonCode).toBe("PHASE1_SUBMIT_FORBIDDEN");
    expect(event?.correlationId).toBe("corr-deny-1");
    expect(store.get().executionMasterEnabled).toBe(false);
    expect(store.get().armedForSubmission).toBe(false);
  });

  it("blocks submit-adjacent state transitions in Phase 1", () => {
    expect(isSubmitAdjacentLifecycle("SUBMITTING")).toBe(true);
    expect(assertPhase1Transition("IDLE", "SUBMITTING").ok).toBe(false);
    expect(assertPhase1Transition("IDLE", "READY_TO_SUBMIT").ok).toBe(false);
    expect(assertPhase1Transition("IDLE", "AUTHORIZATION_REQUIRED").ok).toBe(true);
  });

  it("audits denied lifecycle transitions with DENY + reasonCode", () => {
    const root = tempRoot();
    const store = getAtBrokerExecutionStore(root);
    const denied = store.transitionLifecycle("SUBMITTING", "test", "probe", "corr-life-deny");
    expect(denied.ok).toBe(false);
    expect(denied.correlationId).toBe("corr-life-deny");
    const event = store.listAudit(5).find((e) => e.action === "LIFECYCLE_TRANSITION_DENIED");
    expect(event?.decision).toBe("DENY");
    expect(event?.reasonCode).toBe("PHASE1_SUBMIT_FORBIDDEN");
    expect(event?.correlationId).toBe("corr-life-deny");
    expect(store.get().lifecycle).toBe("IDLE");
    expect(store.get().mutatesBroker).toBe(false);
  });

  it("authorization matrix always denies submit and never treats System Master as execution auth", () => {
    const root = tempRoot();
    const foundation = getAtBrokerExecutionStore(root).get();
    const denied = evaluateExecutionAuthorization({
      foundation,
      environment: "DEMO",
      emergencyEntryLock: false,
      handoffLifecycle: "HANDOFF_READY",
      handoffId: "h1",
      proposalId: "p1",
      quantityLots: 0.01,
      capitalAllocationPercent: 10,
      individualOrderAllocation: 100,
      systemMasterOn: true,
    });
    expect(denied.mayProceedTowardSubmit).toBe(false);
    expect(denied.phase1SubmitImplemented).toBe(false);
    expect(denied.systemMasterDoesNotAuthorizeExecution).toBe(true);
    expect(denied.handoffReadyIsNotExecutionPermission).toBe(true);
    expect(denied.blockers.map((b) => b.code)).toContain("PHASE1_SUBMIT_FORBIDDEN");
    expect(denied.blockers.map((b) => b.code)).toContain("SYSTEM_MASTER_IS_NOT_EXECUTION_AUTH");
    expect(denied.blockers.map((b) => b.code)).toContain("AUTHORIZATION_MISSING");
  });

  it("GET status polling does not write durable audit (policy)", () => {
    const root = tempRoot();
    expect(AT_BROKER_EXECUTION_AUDIT_POLICY.statusGetWritesAudit).toBe(false);
    const before = getAtBrokerExecutionStore(root).listAudit(80).length;
    for (let i = 0; i < 5; i++) {
      getBrokerExecutionPublicStatus({
        storageRoot: root,
        environment: "DEMO",
        emergencyEntryLock: true,
        handoffLifecycle: "HANDOFF_READY",
        capitalAllocationPercent: null,
        individualOrderAllocation: null,
        systemMasterOn: true,
      });
    }
    const after = getAtBrokerExecutionStore(root).listAudit(80).length;
    expect(after).toBe(before);
    const status = getBrokerExecutionPublicStatus({ storageRoot: root });
    expect(status.auditPolicy.statusGetWritesAudit).toBe(false);
    expect(status.auditPolicy.statusGetDocumentsDenialsOnPayload).toBe(true);
  });

  it("records authorization intents with activatesMutation=false only", () => {
    const root = tempRoot();
    const store = getAtBrokerExecutionStore(root);
    const intent = createPhase1AuthorizationIntent({
      handoffId: "handoff-1",
      proposalId: "prop-1",
      idempotencyKey: "idem-1",
      instrument: "XAU/USD",
      direction: "BUY",
      quantityLots: 0.01,
      environment: "DEMO",
      createdBy: "test",
    });
    expect(intent.activatesMutation).toBe(false);
    const recorded = store.recordAuthorizationIntent(intent, "test", "corr-intent-1");
    expect(recorded.ok).toBe(true);
    if (recorded.ok) expect(recorded.correlationId).toBe("corr-intent-1");
    const f = store.get();
    expect(f.lifecycle).toBe("AUTHORIZATION_REQUIRED");
    expect(f.authorizationIntents[0]?.activatesMutation).toBe(false);
    expect(f.mutatesBroker).toBe(false);
    const event = store.listAudit(5).find((e) => e.action === "AUTHORIZATION_INTENT_RECORDED");
    expect(event?.correlationId).toBe("corr-intent-1");
    expect(event?.decision).toBe("ALLOW");
  });

  it("public status stamps EXECUTION_FORBIDDEN and surfaces capital prerequisite", () => {
    const root = tempRoot();
    const status = getBrokerExecutionPublicStatus({
      storageRoot: root,
      environment: "DEMO",
      emergencyEntryLock: true,
      handoffLifecycle: "BLOCKED",
      capitalAllocationPercent: null,
      individualOrderAllocation: null,
      systemMasterOn: false,
    });
    expect(status.brokerExecution).toBe("DISABLED");
    expect(status.executionStatusLabel).toBe("EXECUTION_FORBIDDEN");
    expect(status.phase1SubmitImplemented).toBe(false);
    expect(status.placesOrders).toBe(false);
    expect(status.prerequisites.capitalAllocationConfigured).toBe(false);
    expect(status.prerequisites.demoMutationGates).toBe("NOT_EVALUATED_PHASE1");
    expect(status.blockers.some((b) => b.code === "EMERGENCY_LOCK")).toBe(true);
  });

  it("returns AUDIT_PERSIST_FAILED when denial audit cannot be persisted", () => {
    const root = tempRoot();
    fs.writeFileSync(path.join(root, "forex-automated-trading"), "not-a-dir");
    const store = getAtBrokerExecutionStore(root);
    const r = store.requestEnableExecutionMaster("probe", "corr-persist-fail");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("AUDIT_PERSIST_FAILED");
    expect(r.correlationId).toBe("corr-persist-fail");
    expect(store.get().executionMasterEnabled).toBe(false);
    expect(store.get().armedForSubmission).toBe(false);
    expect(store.get().mutatesBroker).toBe(false);
    expect(store.get().placesOrders).toBe(false);
    // Not represented as durable history when persist failed (rolled back).
    expect(store.listAudit(20)).toHaveLength(0);
  });

  it("loads legacy audit events without inventing correlationId/decision/reasonCode", () => {
    const root = tempRoot();
    const file = path.join(root, "forex-automated-trading", "broker-execution-foundation.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: "at-broker-execution-foundation-v1",
      phase: "4.18G.4-P1",
      stateVersion: 3,
      executionMasterEnabled: true,
      armedForSubmission: true,
      lifecycle: "IDLE",
      environmentBound: "UNBOUND",
      activeHandoffId: null,
      activeProposalId: null,
      activeAuthorizationId: null,
      blockers: [],
      authorizationIntents: [],
      audit: [{
        id: "legacy-1",
        atUtc: "2026-11-05T00:00:00.000Z",
        actor: "legacy",
        action: "REQUEST_EXECUTION_MASTER_ON",
        detail: "old shape",
        handoffId: null,
        proposalId: null,
        lifecycle: "IDLE",
        placesOrders: false,
        acceptsForExecution: false,
        mutatesBroker: false,
      }],
      updatedAtUtc: "2026-11-05T00:00:00.000Z",
      updatedBy: "legacy",
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      brokerExecution: "DISABLED",
      phaseNote: "legacy",
    }));
    const store = getAtBrokerExecutionStore(root);
    expect(store.get().executionMasterEnabled).toBe(false);
    expect(store.get().armedForSubmission).toBe(false);
    const legacy = store.listAudit(1)[0];
    expect(legacy?.id).toBe("legacy-1");
    expect(legacy?.correlationId).toBeNull();
    expect(legacy?.decision).toBeNull();
    expect(legacy?.reasonCode).toBeNull();
  });

  it("corrupt JSON and poisoned READY_TO_SUBMIT disk remain fail-closed", () => {
    const root = tempRoot();
    const file = path.join(root, "forex-automated-trading", "broker-execution-foundation.json");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "{broken");
    resetAtBrokerExecutionStoreForTests();
    let f = getAtBrokerExecutionStore(root).get();
    expect(f.executionMasterEnabled).toBe(false);
    expect(f.armedForSubmission).toBe(false);

    fs.writeFileSync(file, JSON.stringify({
      executionMasterEnabled: true,
      armedForSubmission: true,
      lifecycle: "READY_TO_SUBMIT",
      placesOrders: true,
      acceptsForExecution: true,
      mutatesBroker: true,
      brokerExecution: "ENABLED",
      audit: [],
      authorizationIntents: [],
      blockers: [],
    }));
    resetAtBrokerExecutionStoreForTests();
    f = getAtBrokerExecutionStore(root).get();
    expect(f.executionMasterEnabled).toBe(false);
    expect(f.armedForSubmission).toBe(false);
    expect(f.lifecycle).toBe("IDLE");
    expect(f.placesOrders).toBe(false);
    expect(f.mutatesBroker).toBe(false);
    expect(evaluateExecutionAuthorization({
      foundation: f,
      environment: "DEMO",
      emergencyEntryLock: false,
      handoffLifecycle: "HANDOFF_READY",
      handoffId: "h",
      proposalId: "p",
      quantityLots: 0.01,
      capitalAllocationPercent: 10,
      individualOrderAllocation: 50,
      systemMasterOn: true,
    }).mayProceedTowardSubmit).toBe(false);
  });
});
