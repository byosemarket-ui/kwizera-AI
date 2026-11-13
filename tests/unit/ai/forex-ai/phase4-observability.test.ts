/**
 * Phase 4 — boot audit, recovery classification, correlation, module health.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildAtCorrelationChain,
  buildAtModuleHealthMatrix,
  classifyAtFailure,
  decideAtRecovery,
  getAtBootAuditStore,
  resetAtBootAuditStoreForTests,
} from "../../../../ai/forex-ai/automated-trading/observability/index.ts";

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-phase4-"));
}

describe("Phase 4 recovery classification", () => {
  it("treats market closed as no-retry-storm", () => {
    const d = decideAtRecovery({ code: "MARKET_CLOSED", quoteFresh: false, quoteReasonCode: "MARKET_CLOSED" });
    expect(d.classification).toBe("MARKET_CLOSED_NO_RETRY_STORM");
    expect(d.retryAllowed).toBe(false);
    expect(d.keepExecutionBlocked).toBe(true);
    expect(d.mutatesBroker).toBe(false);
  });

  it("allows bounded read-only reconnect for provider disconnect", () => {
    const d = decideAtRecovery({
      code: "FC_DISCONNECTED",
      brokerConnected: false,
      retryCount: 0,
      maxRetries: 3,
    });
    expect(d.classification).toBe("RECOVERABLE_PROVIDER");
    expect(d.action).toBe("RECONNECT_READONLY");
    expect(d.retryAllowed).toBe(true);
    expect(d.placesOrders).toBe(false);
  });

  it("never recovers by enabling execution", () => {
    const d = decideAtRecovery({ code: "EXECUTION_MASTER_OFF" });
    expect(d.classification).toBe("SAFETY_LOCK");
    expect(d.action).toBe("KEEP_EXECUTION_BLOCKED");
    expect(d.acceptsForExecution).toBe(false);
  });

  it("requests owner action for billing/credentials", () => {
    const c = classifyAtFailure({ code: "BILLING_BLOCKED" });
    expect(c.classification).toBe("OWNER_ACTION_REQUIRED");
    expect(c.ownerInterventionRequired).toBe(true);
    expect(c.retryAllowed).toBe(false);
  });
});

describe("Phase 4 correlation + health", () => {
  it("links phase2/phase3 ids without inventing missing ones", () => {
    const chain = buildAtCorrelationChain({
      bootId: "boot-1",
      analysisGeneration: 4,
      phase2: {
        analysisId: "a1",
        intakeId: "i1",
        proposalId: "p1",
        riskDecisionId: "r1",
        handoffId: "h1",
        precheckId: "pre1",
        status: "PRECHECK_PASSED",
      },
      phase3: {
        analysisId: "a1",
        payloadId: "pay1",
        handoffId: "h1",
        precheckId: "pre1",
        executionBoundaryDecisionId: "eb1",
        status: "EXECUTION_BLOCKED",
        boundaryStatus: "EXECUTION_BLOCKED",
        boundaryReason: "EXECUTION_DISABLED_BY_OWNER_POLICY",
        instrument: "XAU/USD",
      },
    });
    expect(chain.bootId).toBe("boot-1");
    expect(chain.analysisId).toBe("a1");
    expect(chain.payloadId).toBe("pay1");
    expect(chain.executionBoundaryDecisionId).toBe("eb1");
    expect(chain.boundaryStatus).toBe("EXECUTION_BLOCKED");
    expect(chain.placesOrders).toBe(false);
  });

  it("marks scheduler stopped when System Master OFF", () => {
    const { modules, alerts } = buildAtModuleHealthMatrix({
      systemMasterOwnerState: "OFF",
      brokerConnected: true,
      quoteFresh: false,
      quoteReasonCode: "MARKET_CLOSED",
      monitorEnabled: false,
      workerState: "STOPPED",
    });
    const scheduler = modules.find((m) => m.id === "scheduler");
    expect(scheduler?.state).toBe("STOPPED");
    expect(scheduler?.ready).toBe(false);
    expect(alerts.some((a) => a.code === "EXECUTION_DISABLED_BY_OWNER_POLICY")).toBe(true);
    expect(alerts.some((a) => a.code === "MARKET_CLOSED")).toBe(true);
  });
});

describe("Phase 4 boot audit store", () => {
  let root: string;
  let prev: string | undefined;

  beforeEach(() => {
    root = tmpRoot();
    prev = process.env.KWIZERA_STORAGE_ROOT;
    process.env.KWIZERA_STORAGE_ROOT = root;
    resetAtBootAuditStoreForTests();
  });

  afterEach(() => {
    resetAtBootAuditStoreForTests();
    if (prev === undefined) delete process.env.KWIZERA_STORAGE_ROOT;
    else process.env.KWIZERA_STORAGE_ROOT = prev;
    try {
      fs.rmSync(root, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("persists bootId and completion without enabling execution", async () => {
    const store = getAtBootAuditStore(root);
    const started = store.begin({ systemMasterOwnerState: "OFF" });
    expect(started.bootId).toBeTruthy();
    expect(started.status).toBe("STARTED");
    await store.appendStep(started.bootId, {
      step: "analysis_schedule",
      ok: true,
      code: "STANDBY",
      detail: "System Master OFF — schedule inactive.",
    });
    const done = await store.complete(started.bootId, {
      status: "COMPLETED",
      analysisScheduleResumed: false,
      monitorEnabled: false,
      note: "standby boot",
    });
    expect(done?.status).toBe("COMPLETED");
    expect(done?.analysisScheduleResumed).toBe(false);
    expect(done?.placesOrders).toBe(false);
    expect(done?.mutatesBroker).toBe(false);

    resetAtBootAuditStoreForTests();
    const reloaded = getAtBootAuditStore(root).getLatest();
    expect(reloaded?.bootId).toBe(started.bootId);
    expect(reloaded?.systemMasterOwnerState).toBe("OFF");
  });
});
