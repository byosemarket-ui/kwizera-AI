/**
 * Phase 57.4 — Operational vs execution status mapping and split-brain detection.
 * Synthetic only — never places broker orders.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { deriveOperationalStatus } from "../../../../ai/forex-ai/automated-trading/operational-status.js";
import { defaultAutomationControlPersisted } from "../../../../ai/forex-ai/automated-trading/automation-control/index.js";

const root = process.cwd();
function read(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("Phase 57.4 deriveOperationalStatus", () => {
  it("shows MONITORING ACTIVE when worker runs and quotes are fresh while execution stays forbidden", () => {
    const auto = {
      ...defaultAutomationControlPersisted(),
      requestedMode: "ON" as const,
      lifecycle: "MONITORING" as const,
      reasonCode: "NONE" as const,
      recoveryStatus: "RECOVERED" as const,
    };
    const s = deriveOperationalStatus({
      automation: auto,
      monitorEnabled: true,
      workerActive: true,
      quoteFresh: true,
    });
    expect(s.code).toBe("MONITORING_ACTIVE");
    expect(s.label).toBe("MONITORING ACTIVE");
    expect(s.executionStatusLabel).toBe("EXECUTION_FORBIDDEN");
    expect(s.executionReadiness).toBe("BLOCKED");
    expect(s.brokerExecution).toBe("DISABLED");
    expect(s.placesOrders).toBe(false);
    expect(s.acceptsForExecution).toBe(false);
  });

  it("does not report healthy monitoring when persisted MONITORING but worker stopped", () => {
    const auto = {
      ...defaultAutomationControlPersisted(),
      requestedMode: "ON" as const,
      lifecycle: "MONITORING" as const,
      reasonCode: "NONE" as const,
      recoveryStatus: "RECOVERED" as const,
    };
    const s = deriveOperationalStatus({
      automation: auto,
      monitorEnabled: false,
      workerActive: false,
      quoteFresh: true,
    });
    expect(s.code).toBe("WORKER_STOPPED");
    expect(s.label).toBe("WORKER STOPPED");
    expect(s.executionStatusLabel).toBe("EXECUTION_FORBIDDEN");
  });

  it("keeps monitoring blocked reason separate from execution prohibition", () => {
    const auto = {
      ...defaultAutomationControlPersisted(),
      requestedMode: "ON" as const,
      lifecycle: "BLOCKED" as const,
      reasonCode: "QUOTE_NOT_FRESH" as const,
      recoveryStatus: "RECOVERY_BLOCKED" as const,
    };
    const s = deriveOperationalStatus({
      automation: auto,
      monitorEnabled: false,
      workerActive: false,
      quoteFresh: false,
      quoteReasonCode: "QUOTE_AGE_EXCEEDED",
    });
    expect(s.code).toBe("RECOVERY_REQUIRED");
    expect(s.label).toContain("QUOTE_NOT_FRESH");
    expect(s.brokerExecution).toBe("DISABLED");
  });

  it("reports MONITORING OFF when automation is OFF", () => {
    const s = deriveOperationalStatus({
      automation: defaultAutomationControlPersisted(),
      monitorEnabled: false,
      workerActive: false,
      quoteFresh: null,
    });
    expect(s.code).toBe("MONITORING_OFF");
    expect(s.executionStatusLabel).toBe("EXECUTION_FORBIDDEN");
  });

  it("blocks active worker when quotes are stale", () => {
    const auto = {
      ...defaultAutomationControlPersisted(),
      requestedMode: "ON" as const,
      lifecycle: "MONITORING" as const,
      reasonCode: "NONE" as const,
      recoveryStatus: "RECOVERED" as const,
    };
    const s = deriveOperationalStatus({
      automation: auto,
      monitorEnabled: true,
      workerActive: true,
      quoteFresh: false,
      quoteReasonCode: "QUOTE_AGE_EXCEEDED",
    });
    expect(s.code).toBe("MONITORING_BLOCKED");
    expect(s.label).toContain("QUOTE_AGE_EXCEEDED");
  });
});

describe("Phase 57.4 wiring", () => {
  it("status API and UI use operationalStatus for header, not execution moduleStatus alone", () => {
    const service = read("ai/forex-ai/automated-trading/service.ts");
    const api = read("dev/server/forex-automated-trading-api.ts");
    const ui = read("desktop/forex/ForexAutomatedTradingPage.tsx");
    expect(service).toContain("deriveOperationalStatus");
    expect(service).toContain("reconcileAutomationMonitorAlignment");
    expect(service).toContain("operationalStatus");
    expect(api).toContain("reconcileAutomationMonitorAlignment");
    expect(ui).toContain("data-fx-at-operational-badge");
    expect(ui).toContain("operationalStatus");
    expect(ui).toContain("BROKER EXECUTION");
  });
});
