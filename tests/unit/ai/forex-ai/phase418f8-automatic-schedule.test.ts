/**
 * Phase 4.18F.8 — UTC five-minute wall-clock analysis schedule + boot independence.
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AT_ANALYSIS_DEFAULT_TIMEFRAME,
  AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
  AT_ANALYSIS_SCHEDULE_SLOT_GRACE_MS,
  AtMonitorWorker,
  decideFiveMinuteSlot,
  fiveMinuteBoundarySec,
  nextFiveMinuteBoundaryUtc,
  resetAtMonitorStoreForTests,
  resetAtMonitorWorkerForTests,
  scheduledSlotDedupeKey,
} from "../../../../ai/forex-ai/automated-trading/monitoring/index.ts";
import { decideAutomationBootRecovery } from "../../../../ai/forex-ai/automated-trading/automation-control/boot-recovery.ts";
import { defaultAutomationControlPersisted } from "../../../../ai/forex-ai/automated-trading/automation-control/types.ts";

describe("Phase 4.18F.8 five-minute wall-clock schedule", () => {
  it("exports 5-minute defaults", () => {
    expect(AT_ANALYSIS_SCHEDULE_INTERVAL_MS).toBe(300_000);
    expect(AT_ANALYSIS_DEFAULT_TIMEFRAME).toBe("5m");
    expect(AT_ANALYSIS_SCHEDULE_SLOT_GRACE_MS).toBe(90_000);
  });

  it("floors to UTC :00/:05/…/:55 boundaries", () => {
    expect(fiveMinuteBoundarySec(Date.parse("2024-06-01T12:00:00.000Z"))).toBe(
      Math.floor(Date.parse("2024-06-01T12:00:00.000Z") / 1000),
    );
    expect(fiveMinuteBoundarySec(Date.parse("2024-06-01T12:04:59.999Z"))).toBe(
      Math.floor(Date.parse("2024-06-01T12:00:00.000Z") / 1000),
    );
    expect(fiveMinuteBoundarySec(Date.parse("2024-06-01T12:05:00.000Z"))).toBe(
      Math.floor(Date.parse("2024-06-01T12:05:00.000Z") / 1000),
    );
    expect(nextFiveMinuteBoundaryUtc(Date.parse("2024-06-01T12:03:00.000Z"))).toBe(
      "2024-06-01T12:05:00.000Z",
    );
    expect(nextFiveMinuteBoundaryUtc(Date.parse("2024-06-01T12:05:00.000Z"))).toBe(
      "2024-06-01T12:10:00.000Z",
    );
  });

  it("runs within grace, marks missed after grace, and avoids backlog", () => {
    const slot = fiveMinuteBoundarySec(Date.parse("2024-06-01T12:00:00.000Z"));
    const run = decideFiveMinuteSlot({
      nowMs: Date.parse("2024-06-01T12:00:20.000Z"),
      lastCompletedSlotSec: null,
    });
    expect(run.action).toBe("run");
    if (run.action === "run") {
      expect(run.slotSec).toBe(slot);
      expect(run.delayed).toBe(true);
    }

    const missed = decideFiveMinuteSlot({
      nowMs: Date.parse("2024-06-01T12:00:00.000Z") + AT_ANALYSIS_SCHEDULE_SLOT_GRACE_MS + 1,
      lastCompletedSlotSec: null,
    });
    expect(missed.action).toBe("missed");

    const done = decideFiveMinuteSlot({
      nowMs: Date.parse("2024-06-01T12:02:00.000Z"),
      lastCompletedSlotSec: slot,
    });
    expect(done.action).toBe("done");
  });

  it("dedupes by UTC slot + config epoch", () => {
    const a = scheduledSlotDedupeKey({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "5m",
      slotSec: 1_700_000_000,
      configEpoch: 1,
    });
    const b = scheduledSlotDedupeKey({
      environment: "DEMO",
      instrument: "eur/usd",
      timeframe: "5m",
      slotSec: 1_700_000_000,
      configEpoch: 1,
    });
    const c = scheduledSlotDedupeKey({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "5m",
      slotSec: 1_700_000_300,
      configEpoch: 1,
    });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toContain("slot:");
  });
});

describe("Phase 4.18F.8 automation OFF does not stop analysis worker", () => {
  it("KEEP_OFF and BLOCKED boot recovery leave analysis worker running", () => {
    const off = decideAutomationBootRecovery({
      persisted: {
        ...defaultAutomationControlPersisted(),
        requestedMode: "OFF",
        lifecycle: "OFF",
        monitoringDesired: false,
      },
      readiness: null,
      monitorEnabled: true,
    });
    expect(off.action).toBe("KEEP_OFF");
    expect(off.stopMonitorWorker).toBe(false);

    const blocked = decideAutomationBootRecovery({
      persisted: {
        ...defaultAutomationControlPersisted(),
        requestedMode: "ON",
        lifecycle: "MONITORING",
        monitoringDesired: true,
      },
      readiness: {
        ok: false,
        reasonCode: "QUOTE_NOT_FRESH",
        reasonMessage: "stale",
        placesOrders: false,
        acceptsForExecution: false,
        brokerExecution: "DISABLED",
        entryGenerationEnabled: false,
      },
      monitorEnabled: true,
    });
    expect(blocked.action).toBe("BLOCK_AND_ALIGN_MONITOR_STOP");
    expect(blocked.stopMonitorWorker).toBe(false);
  });
});

describe("Phase 4.18F.8 worker public status exposes automatic schedule fields", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "at-f8-"));
    resetAtMonitorStoreForTests();
    resetAtMonitorWorkerForTests();
  });

  afterEach(() => {
    resetAtMonitorWorkerForTests();
    resetAtMonitorStoreForTests();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("reports requiresDashboardClick=false and five_minute schedule mode", async () => {
    const worker = new AtMonitorWorker({ storageRoot: tmp, autoStart: false });
    const status = worker.getPublicStatus();
    expect(status.requiresDashboardClick).toBe(false);
    expect(status.scheduleMode).toBe("five_minute_wall_utc");
    expect(status.scheduleIntervalMs).toBe(300_000);
    expect(status.placesOrders).toBe(false);
    expect(status.acceptsForExecution).toBe(false);
    expect(status.mutatesBroker).toBe(false);
    expect(status.health.automaticAnalysisStatus).toBe("STOPPED");

    const started = await worker.start({
      environment: "DEMO",
      instrument: "EUR/USD",
      timeframe: "5m",
      currentEnvironment: "DEMO",
      currentEnvironmentEpoch: 1,
    });
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.status.config?.enabled).toBe(true);
      expect(started.status.automaticAnalysisStatus).toBe("ACTIVE");
      expect(started.status.health.nextScheduledAnalysisAtUtc).toMatch(/T\d{2}:\d{2}:00.000Z$/);
    }
    worker.dispose();
  });
});
