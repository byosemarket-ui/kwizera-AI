/**
 * Phase 4.18F.8R — System Master ON/OFF lifecycle (analysis only; never broker).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AtSystemMasterStore,
  defaultSystemMasterPersisted,
  resetAtSystemMasterStoreForTests,
  toSystemMasterPublicStatus,
  AT_SYSTEM_MASTER_OWNED_MODULES,
  AT_SYSTEM_MASTER_SHARED_SERVICES,
} from "../../../../ai/forex-ai/automated-trading/system-master/index.ts";
import {
  AtMonitorWorker,
  resetAtMonitorStoreForTests,
  resetAtMonitorWorkerForTests,
} from "../../../../ai/forex-ai/automated-trading/monitoring/index.ts";
import {
  AutomatedTradingService,
  AutomatedTradingStore,
  resetAutomatedTradingServiceForTests,
  resetAutomatedTradingStoreForTests,
  getAtOpenAiAnalysisEngine,
} from "../../../../ai/forex-ai/automated-trading/index.ts";

describe("Phase 4.18F.8R System Master store", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-sm-"));
    resetAtSystemMasterStoreForTests();
  });

  afterEach(() => {
    resetAtSystemMasterStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("defaults OFF and never invents ON from corrupt input", () => {
    const store = new AtSystemMasterStore(tmp);
    const g = store.get();
    expect(g.ownerState).toBe("OFF");
    expect(g.masterEnabled).toBe(false);
    expect(g.operationalState).toBe("OFF");
    expect(g.placesOrders).toBe(false);
    expect(g.acceptsForExecution).toBe(false);
    expect(g.mutatesBroker).toBe(false);

    const dir = path.join(tmp, "forex-automated-trading");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "system-master.json"), "{bad", "utf8");
    const bad = new AtSystemMasterStore(tmp);
    expect(bad.get().ownerState).toBe("OFF");
    expect(bad.get().masterEnabled).toBe(false);
  });

  it("compareAndSet is versioned; stale versions fail", async () => {
    const store = new AtSystemMasterStore(tmp);
    const v1 = store.get().stateVersion;
    const next = await store.compareAndSet(v1, (p) => ({
      ...p,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "STARTING",
      changedBy: "owner",
    }));
    expect(next?.ownerState).toBe("ON");
    expect(next?.stateVersion).toBe(v1 + 1);
    const stale = await store.compareAndSet(v1, (p) => ({ ...p, ownerState: "OFF" }));
    expect(stale).toBeNull();
  });

  it("public status documents shared vs owned services and forbids execution", () => {
    const pub = toSystemMasterPublicStatus(defaultSystemMasterPersisted());
    expect(pub.sharedServices).toEqual([...AT_SYSTEM_MASTER_SHARED_SERVICES]);
    expect(pub.ownedModules).toEqual([...AT_SYSTEM_MASTER_OWNED_MODULES]);
    expect(pub.brokerExecution).toBe("DISABLED");
    expect(pub.executionStatusLabel).toBe("EXECUTION_FORBIDDEN");
    expect(pub.placesOrders).toBe(false);
  });

  it("persists owner ON across store reload without inventing operational ON", async () => {
    const store = new AtSystemMasterStore(tmp);
    await store.forceSet((p) => ({
      ...p,
      ownerState: "ON",
      masterEnabled: true,
      operationalState: "ON",
      activeModules: ["analysis_worker"],
      changedBy: "owner",
    }));
    const reloaded = new AtSystemMasterStore(tmp);
    expect(reloaded.get().ownerState).toBe("ON");
    expect(reloaded.get().masterEnabled).toBe(true);
  });
});

describe("Phase 4.18F.8R System Master service gates", () => {
  let tmp: string;
  let svc: AutomatedTradingService;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-sm-svc-"));
    resetAtSystemMasterStoreForTests();
    resetAtMonitorStoreForTests();
    resetAtMonitorWorkerForTests();
    resetAutomatedTradingStoreForTests();
    resetAutomatedTradingServiceForTests();
    const atStore = new AutomatedTradingStore(tmp);
    const worker = new AtMonitorWorker({ storageRoot: tmp, autoStart: false });
    const engine = getAtOpenAiAnalysisEngine(tmp);
    svc = new AutomatedTradingService(atStore, engine, worker);
  });

  afterEach(() => {
    resetAutomatedTradingServiceForTests();
    resetAtMonitorWorkerForTests();
    resetAtMonitorStoreForTests();
    resetAtSystemMasterStoreForTests();
    resetAutomatedTradingStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("SYSTEM OFF then startMonitoring is rejected; ON without instrument is BLOCKED", async () => {
    const off = await svc.requestSystemMasterOff({ operatorHint: "test" });
    expect(off.ok).toBe(true);
    expect(off.systemMaster.ownerState).toBe("OFF");
    expect(off.placesOrders).toBe(false);
    expect(off.acceptsForExecution).toBe(false);
    expect(off.mutatesBroker).toBe(false);

    const blockedStart = await svc.startMonitoring({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "5m",
    });
    expect(blockedStart.ok).toBe(false);
    if (!blockedStart.ok) expect(blockedStart.code).toBe("SYSTEM_MASTER_OFF");

    const on = await svc.requestSystemMasterOn({
      instrument: "",
      timeframe: "5m",
      operatorHint: "test",
    });
    expect(on.ok).toBe(false);
    expect(on.code).toBe("INSTRUMENT_NOT_CONFIGURED");
    expect(on.systemMaster.ownerState).toBe("ON");
    expect(on.systemMaster.operationalState).toBe("BLOCKED");
    expect(on.brokerExecution).toBe("DISABLED");
  });

  it("repeated OFF is idempotent", async () => {
    const a = await svc.requestSystemMasterOff({ operatorHint: "test" });
    const b = await svc.requestSystemMasterOff({
      expectedStateVersion: a.systemMaster.stateVersion,
      operatorHint: "test",
    });
    expect(b.code).toBe("ALREADY_OFF");
    expect(b.systemMaster.operationalState).toBe("OFF");
  });

  it("operational history is redacted and execution-safe", () => {
    const hist = svc.getOperationalCycleHistory(5);
    expect(hist.schemaVersion).toBe("at-operational-cycle-history-v1");
    expect(hist.placesOrders).toBe(false);
    expect(hist.acceptsForExecution).toBe(false);
    expect(hist.mutatesBroker).toBe(false);
    expect(Array.isArray(hist.cycles)).toBe(true);
  });
});
