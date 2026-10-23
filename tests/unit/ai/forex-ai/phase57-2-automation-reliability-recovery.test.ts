/**
 * Phase 57.2 — Automation reliability, boot recovery, monitoring vs execution separation.
 * Never enables broker execution.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AtAutomationControlStore,
  resetAtAutomationControlStoreForTests,
  evaluateAutomationStartReadiness,
  decideAutomationBootRecovery,
  toAutomationPublicStatus,
  defaultAutomationControlPersisted,
  type AutomationControlPersisted,
} from "../../../../ai/forex-ai/automated-trading/automation-control/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

function readyOk() {
  return evaluateAutomationStartReadiness({
    masterEnable: false,
    emergencyEntryLock: true,
    placesOrders: false,
    acceptsForExecution: false,
    forexConnectTradingEnabled: false,
    automaticEntryEnabled: false,
    automaticReentryEnabled: false,
    instrumentConfigured: true,
    quoteFresh: true,
    monitorCanStart: true,
  });
}

function basePersisted(
  over: Partial<AutomationControlPersisted> = {},
): AutomationControlPersisted {
  return { ...defaultAutomationControlPersisted(), ...over };
}

describe("Phase 57.2 monitoring vs execution separation", () => {
  it("public status keeps execution forbidden while monitoring ACTIVE", () => {
    const pub = toAutomationPublicStatus(
      basePersisted({
        requestedMode: "ON",
        lifecycle: "MONITORING",
        recoveryStatus: "RECOVERED",
        reasonCode: "RECOVERY_SOFT_RESUMED",
        reasonMessage: "soft",
        monitoringDesired: true,
      }),
    );
    expect(pub.marketMonitoring).toBe("ACTIVE");
    expect(pub.automationRequested).toBe(true);
    expect(pub.brokerExecution).toBe("DISABLED");
    expect(pub.executionReadiness).toBe("BLOCKED");
    expect(pub.executionStatusLabel).toBe("EXECUTION_FORBIDDEN");
    expect(pub.placesOrders).toBe(false);
    expect(pub.acceptsForExecution).toBe(false);
    expect(pub.entryGenerationEnabled).toBe(false);
    expect(pub.recoveryStatus).toBe("RECOVERED");
  });

  it("BLOCKED monitoring still reports EXECUTION_FORBIDDEN distinctly", () => {
    const pub = toAutomationPublicStatus(
      basePersisted({
        requestedMode: "ON",
        lifecycle: "BLOCKED",
        reasonCode: "QUOTE_NOT_FRESH",
        reasonMessage: "stale",
        recoveryStatus: "RECOVERY_BLOCKED",
      }),
    );
    expect(pub.marketMonitoring).toBe("BLOCKED");
    expect(pub.reasonCode).toBe("QUOTE_NOT_FRESH");
    expect(pub.executionStatusLabel).toBe("EXECUTION_FORBIDDEN");
    expect(pub.executionReadiness).toBe("BLOCKED");
  });

  it("START readiness pass never clears EXECUTION_FORBIDDEN flags", () => {
    const r = readyOk();
    expect(r.ok).toBe(true);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.entryGenerationEnabled).toBe(false);
    expect(r.brokerExecution).toBe("DISABLED");
  });
});

describe("Phase 57.2 boot recovery decisions", () => {
  it("soft-resumes MONITORING when readiness.ok after prior MONITORING", () => {
    const d = decideAutomationBootRecovery({
      persisted: basePersisted({
        requestedMode: "ON",
        lifecycle: "MONITORING",
        monitoringDesired: true,
      }),
      readiness: readyOk(),
      monitorEnabled: false,
    });
    expect(d.action).toBe("SOFT_RESUME_MONITORING");
    expect(d.nextLifecycle).toBe("MONITORING");
    expect(d.reasonCode).toBe("RECOVERY_SOFT_RESUMED");
    expect(d.recoveryStatus).toBe("RECOVERED");
    expect(d.entryGenerationEnabled).toBe(false);
    expect(d.placesOrders).toBe(false);
    expect(d.acceptsForExecution).toBe(false);
    expect(d.brokerExecution).toBe("DISABLED");
    expect(d.stopMonitorWorker).toBe(false);
  });

  it("soft-resumes after Phase 57.1 AMBIGUOUS_RECOVERY BLOCKED when readiness passes", () => {
    const d = decideAutomationBootRecovery({
      persisted: basePersisted({
        requestedMode: "ON",
        lifecycle: "BLOCKED",
        reasonCode: "AMBIGUOUS_RECOVERY",
        reasonMessage: "old 57.1 message",
        monitoringDesired: false,
        recoveryStatus: "AMBIGUOUS_RECOVERY",
      }),
      readiness: readyOk(),
      monitorEnabled: true,
    });
    expect(d.action).toBe("SOFT_RESUME_MONITORING");
    expect(d.nextLifecycle).toBe("MONITORING");
  });

  it("fails closed to BLOCKED with concrete reason when quotes stale", () => {
    const readiness = evaluateAutomationStartReadiness({
      masterEnable: false,
      emergencyEntryLock: true,
      placesOrders: false,
      acceptsForExecution: false,
      forexConnectTradingEnabled: false,
      automaticEntryEnabled: false,
      automaticReentryEnabled: false,
      instrumentConfigured: true,
      quoteFresh: false,
      monitorCanStart: true,
    });
    const d = decideAutomationBootRecovery({
      persisted: basePersisted({
        requestedMode: "ON",
        lifecycle: "MONITORING",
        monitoringDesired: true,
      }),
      readiness,
      monitorEnabled: true,
    });
    expect(d.action).toBe("BLOCK_AND_ALIGN_MONITOR_STOP");
    expect(d.nextLifecycle).toBe("BLOCKED");
    expect(d.reasonCode).toBe("QUOTE_NOT_FRESH");
    expect(d.stopMonitorWorker).toBe(true);
    expect(d.recoveryStatus).toBe("RECOVERY_BLOCKED");
  });

  it("fails closed when readiness null (ambiguous)", () => {
    const d = decideAutomationBootRecovery({
      persisted: basePersisted({
        requestedMode: "ON",
        lifecycle: "STARTING",
        monitoringDesired: true,
      }),
      readiness: null,
      monitorEnabled: false,
    });
    expect(d.action).toBe("BLOCK_AND_ALIGN_MONITOR_STOP");
    expect(d.reasonCode).toBe("RECOVERY_REQUIRES_START");
    expect(d.stopMonitorWorker).toBe(true);
  });

  it("STOPPING recovers to OFF without soft-resume", () => {
    const d = decideAutomationBootRecovery({
      persisted: basePersisted({
        requestedMode: "OFF",
        lifecycle: "STOPPING",
        monitoringDesired: false,
      }),
      readiness: readyOk(),
      monitorEnabled: true,
    });
    expect(d.action).toBe("FORCE_OFF_FROM_STOPPING");
    expect(d.nextLifecycle).toBe("OFF");
    expect(d.requestedMode).toBe("OFF");
    expect(d.stopMonitorWorker).toBe(true);
  });

  it("OFF stays OFF and does not invent MONITORING", () => {
    const d = decideAutomationBootRecovery({
      persisted: basePersisted({
        requestedMode: "OFF",
        lifecycle: "OFF",
      }),
      readiness: readyOk(),
      monitorEnabled: false,
    });
    expect(d.action).toBe("KEEP_OFF");
    expect(d.nextLifecycle).toBe("OFF");
  });
});

describe("Phase 57.2 persistence and CAS", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtAutomationControlStoreForTests();
    tmp = mkdtempSync(join(tmpdir(), "kw-auto-57-2-"));
  });

  afterEach(() => {
    resetAtAutomationControlStoreForTests();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("normalizes missing recoveryStatus and never enables placesOrders", () => {
    const dir = join(tmp, "forex-automated-trading");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "automation-control.json"),
      JSON.stringify({
        schemaVersion: "at-automation-control-v1",
        phase: "57.1",
        stateVersion: 3,
        requestedMode: "ON",
        lifecycle: "MONITORING",
        reasonCode: "NONE",
        reasonMessage: null,
        lastChangedAtUtc: new Date().toISOString(),
        lastOperatorHint: "test",
        entryGenerationEnabled: true,
        placesOrders: true,
        acceptsForExecution: true,
        brokerExecution: "LIVE",
        monitoringDesired: true,
        lastMonitoringAtUtc: null,
      }),
      "utf8",
    );
    const store = new AtAutomationControlStore(tmp);
    const g = store.get();
    expect(g.placesOrders).toBe(false);
    expect(g.acceptsForExecution).toBe(false);
    expect(g.entryGenerationEnabled).toBe(false);
    expect(g.brokerExecution).toBe("DISABLED");
    expect(g.recoveryStatus).toBe("IDLE");
    expect(g.stateVersion).toBe(3);
  });

  it("CAS rejects stale writes without losing newer state", async () => {
    const store = new AtAutomationControlStore(tmp);
    const v = store.get().stateVersion;
    const ok = await store.compareAndSet(v, (p) => ({
      ...p,
      lifecycle: "MONITORING",
      requestedMode: "ON",
      monitoringDesired: true,
      recoveryStatus: "RECOVERED",
      reasonCode: "NONE",
      reasonMessage: "ok",
      lastOperatorHint: "a",
    }));
    expect(ok?.stateVersion).toBe(v + 1);
    const stale = await store.compareAndSet(v, (p) => ({
      ...p,
      lifecycle: "OFF",
      reasonCode: "OPERATOR_STOP",
      reasonMessage: "lost",
      lastOperatorHint: "b",
      monitoringDesired: false,
      requestedMode: "OFF",
    }));
    expect(stale).toBeNull();
    expect(store.get().lifecycle).toBe("MONITORING");
    expect(store.get().placesOrders).toBe(false);
  });
});

describe("Phase 57.2 wiring and UI accuracy", () => {
  it("service recover uses decideAutomationBootRecovery soft-resume path", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    const types = read("ai/forex-ai/automated-trading/automation-control/types.ts");
    expect(service).toContain("decideAutomationBootRecovery");
    expect(service).toContain("SOFT_RESUME_MONITORING");
    expect(service).toContain("RECOVERY_SOFT_RESUMED");
    expect(types).toContain("executionStatusLabel");
    expect(types).toContain("EXECUTION_FORBIDDEN");
    expect(service).not.toMatch(/lifecycle:\s*"LIVE"/);
  });

  it("UI separates monitoring BLOCKED from EXECUTION_FORBIDDEN and shows reason code", () => {
    const ui = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(ui).toContain("data-fx-at-execution-status");
    expect(ui).toContain("data-fx-at-recovery-status");
    expect(ui).toContain("data-fx-at-automation-reason-code");
    expect(ui).toContain("EXECUTION_FORBIDDEN");
    expect(ui).toContain("Monitoring:");
    expect(ui).toContain("window.confirm");
  });

  it("boot-recovery module is exported", () => {
    const idx = read("ai/forex-ai/automated-trading/automation-control/index.ts");
    expect(idx).toContain("./boot-recovery.js");
  });
});
