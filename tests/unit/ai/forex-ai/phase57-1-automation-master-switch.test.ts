/**
 * Phase 57.1 — Automation START/STOP control: persistence, CAS, readiness, safety.
 * Never enables broker execution.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AtAutomationControlStore,
  resetAtAutomationControlStoreForTests,
  evaluateAutomationStartReadiness,
  toAutomationPublicStatus,
  defaultAutomationControlPersisted,
} from "../../../../ai/forex-ai/automated-trading/automation-control/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 57.1 readiness gates", () => {
  it("blocks when masterEnable is true (broker-sense must stay OFF)", () => {
    const r = evaluateAutomationStartReadiness({
      masterEnable: true,
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
    expect(r.ok).toBe(false);
    expect(r.reasonCode).toBe("SAFETY_MASTER_MUST_REMAIN_OFF");
    expect(r.brokerExecution).toBe("DISABLED");
    expect(r.entryGenerationEnabled).toBe(false);
  });

  it("blocks when emergency lock is OFF or quotes stale", () => {
    const lock = evaluateAutomationStartReadiness({
      masterEnable: false,
      emergencyEntryLock: false,
      placesOrders: false,
      acceptsForExecution: false,
      forexConnectTradingEnabled: false,
      automaticEntryEnabled: false,
      automaticReentryEnabled: false,
      instrumentConfigured: true,
      quoteFresh: true,
      monitorCanStart: true,
    });
    expect(lock.reasonCode).toBe("SAFETY_EMERGENCY_LOCK_REQUIRED");

    const stale = evaluateAutomationStartReadiness({
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
    expect(stale.reasonCode).toBe("QUOTE_NOT_FRESH");
  });

  it("passes monitoring readiness without enabling execution flags", () => {
    const r = evaluateAutomationStartReadiness({
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
    expect(r.ok).toBe(true);
    expect(r.placesOrders).toBe(false);
    expect(r.acceptsForExecution).toBe(false);
    expect(r.entryGenerationEnabled).toBe(false);
  });
});

describe("Phase 57.1 durable store CAS and fail-closed defaults", () => {
  let tmp: string;

  beforeEach(() => {
    resetAtAutomationControlStoreForTests();
    tmp = mkdtempSync(join(tmpdir(), "kw-auto-57-1-"));
  });

  afterEach(() => {
    resetAtAutomationControlStoreForTests();
    rmSync(tmp, { recursive: true, force: true });
  });

  it("defaults OFF and never enables placesOrders", () => {
    const store = new AtAutomationControlStore(tmp);
    const g = store.get();
    expect(g.requestedMode).toBe("OFF");
    expect(g.lifecycle).toBe("OFF");
    expect(g.placesOrders).toBe(false);
    expect(g.entryGenerationEnabled).toBe(false);
    expect(g.brokerExecution).toBe("DISABLED");
  });

  it("compare-and-set is idempotent-safe and rejects stale versions", async () => {
    const store = new AtAutomationControlStore(tmp);
    const v1 = store.get().stateVersion;
    const a = await store.compareAndSet(v1, (p) => ({
      ...p,
      requestedMode: "ON",
      lifecycle: "STARTING",
      reasonCode: "NONE",
      reasonMessage: "start",
      lastOperatorHint: "test",
      monitoringDesired: true,
    }));
    expect(a).not.toBeNull();
    expect(a!.stateVersion).toBe(v1 + 1);

    const stale = await store.compareAndSet(v1, (p) => ({
      ...p,
      lifecycle: "MONITORING",
      reasonCode: "NONE",
      reasonMessage: "should not apply",
      lastOperatorHint: "stale",
      monitoringDesired: true,
      requestedMode: "ON",
    }));
    expect(stale).toBeNull();
    expect(store.get().lifecycle).toBe("STARTING");

    const again = await store.compareAndSet(store.get().stateVersion, (p) => ({
      ...p,
      lifecycle: "MONITORING",
      reasonCode: "NONE",
      reasonMessage: "ok",
      lastOperatorHint: "test",
      monitoringDesired: true,
      requestedMode: "ON",
    }));
    expect(again?.lifecycle).toBe("MONITORING");

    // Synthetic process restart: new store instance
    const storeB = new AtAutomationControlStore(tmp);
    expect(storeB.get().lifecycle).toBe("MONITORING");
    expect(storeB.get().placesOrders).toBe(false);
    expect(storeB.get().entryGenerationEnabled).toBe(false);
  });

  it("public status never claims broker execution LIVE", () => {
    const p = defaultAutomationControlPersisted();
    p.requestedMode = "ON";
    p.lifecycle = "MONITORING";
    const pub = toAutomationPublicStatus(p);
    expect(pub.brokerExecution).toBe("DISABLED");
    expect(pub.executionReadiness).toBe("BLOCKED");
    expect(pub.marketMonitoring).toBe("ACTIVE");
    expect(pub.automationRequested).toBe(true);
    expect(pub.entryGenerationEnabled).toBe(false);
  });
});

describe("Phase 57.1 wiring", () => {
  it("API and service expose automation start/stop without order mutation paths", () => {
    const api = read("dev/server/forex-automated-trading-api.ts");
    expect(api).toContain("/automation/status");
    expect(api).toContain("/automation/start");
    expect(api).toContain("/automation/stop");
    expect(api).toContain("brokerExecution: \"DISABLED\"");
    expect(api).toContain("EXECUTION_FORBIDDEN");
    expect(api).toContain("requireForexAdmin");

    const service = read("ai/forex-ai/automated-trading/service.ts");
    expect(service).toContain("startAutomation");
    expect(service).toContain("stopAutomation");
    expect(service).toContain("recoverAutomationControlOnBoot");
    expect(service).toContain("entryGenerationEnabled: false");
  });

  it("UI has START AUTO / STOP AUTO without optimistic broker LIVE claim", () => {
    const ui = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(ui).toContain("data-fx-at-automation-control");
    expect(ui).toContain("START AUTO");
    expect(ui).toContain("STOP AUTO");
    expect(ui).toContain("Broker execution:");
    expect(ui).toContain("DISABLED");
    expect(ui).toContain("window.confirm");
  });
});
