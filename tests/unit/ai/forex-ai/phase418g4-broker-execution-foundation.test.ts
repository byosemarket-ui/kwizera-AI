import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
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
    expect(OWNER_MAX_LOTS_EXECUTION).toBe(0.01);
  });

  it("rejects enabling Execution Master in Phase 1 and audits the attempt", () => {
    const root = tempRoot();
    const store = getAtBrokerExecutionStore(root);
    const result = store.requestEnableExecutionMaster("test");
    expect(result.ok).toBe(false);
    expect(result.code).toBe("PHASE1_SUBMIT_FORBIDDEN");
    expect(store.listAudit(5).some((e) => e.action === "REQUEST_EXECUTION_MASTER_ON")).toBe(true);
    expect(store.get().executionMasterEnabled).toBe(false);
    expect(store.get().armedForSubmission).toBe(false);
  });

  it("blocks submit-adjacent state transitions in Phase 1", () => {
    expect(isSubmitAdjacentLifecycle("SUBMITTING")).toBe(true);
    expect(assertPhase1Transition("IDLE", "SUBMITTING").ok).toBe(false);
    expect(assertPhase1Transition("IDLE", "READY_TO_SUBMIT").ok).toBe(false);
    expect(assertPhase1Transition("IDLE", "AUTHORIZATION_REQUIRED").ok).toBe(true);
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
    store.recordAuthorizationIntent(intent, "test");
    const f = store.get();
    expect(f.lifecycle).toBe("AUTHORIZATION_REQUIRED");
    expect(f.authorizationIntents[0]?.activatesMutation).toBe(false);
    expect(f.mutatesBroker).toBe(false);
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
});
