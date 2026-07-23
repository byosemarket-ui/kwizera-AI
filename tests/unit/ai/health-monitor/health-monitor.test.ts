import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MONITORED_COMPONENTS,
  SystemHealthLevel,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-health-monitor-test-"));
}

describe("AiSystemHealthMonitor", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(async () => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes and runs health scan on startup", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("health-monitor-test");

    const monitor = core.getManager().systemHealthMonitor!;
    expect(monitor.isInitialized()).toBe(true);
    expect(monitor.getDashboardData()).not.toBeNull();

    await core.stop();
  });

  it("monitors all framework components", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("monitor-components-test");

    const monitor = core.getManager().systemHealthMonitor!;
    expect(monitor.getMonitoredComponentCount()).toBe(MONITORED_COMPONENTS.length);
    expect(MONITORED_COMPONENTS.length).toBeGreaterThanOrEqual(24);

    await core.stop();
  });

  it("calculates system and module health scores", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("health-scores-test");

    const monitor = core.getManager().systemHealthMonitor!;
    const dashboard = await monitor.runHealthScan();

    expect(dashboard.systemScore).toBeGreaterThanOrEqual(60);
    expect(dashboard.moduleHealth.length).toBe(MONITORED_COMPONENTS.length);
    expect(dashboard.applicationHealth).not.toBe(SystemHealthLevel.Failed);

    await core.stop();
  });

  it("measures response times and resource usage", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("performance-test");

    const monitor = core.getManager().systemHealthMonitor!;
    const dashboard = await monitor.runHealthScan();

    expect(dashboard.resourceUsage.memoryUsageMb).toBeGreaterThan(0);
    expect(dashboard.responseTimes).toBeDefined();

    await core.stop();
  });

  it("prepares dashboard data for future UI", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("dashboard-test");

    const monitor = core.getManager().systemHealthMonitor!;
    const dashboard = await monitor.runHealthScan();

    expect(dashboard.lastUpdated).toBeTruthy();
    expect(dashboard.performanceTrends.length).toBeGreaterThan(0);
    expect(Array.isArray(dashboard.alerts)).toBe(true);

    await core.stop();
  });

  it("records health history and writes logs", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("history-test");

    const monitor = core.getManager().systemHealthMonitor!;
    await monitor.runHealthScan();

    expect(monitor.history.getCount()).toBeGreaterThan(0);
    expect(fs.existsSync(monitor.history.getHistoryPath()!)).toBe(true);
    expect(fs.existsSync(monitor.logger.getLogDirectory()!)).toBe(true);

    await core.stop();
  });

  it("integrates with recovery engine for critical issues", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("recovery-integration-test");

    const monitor = core.getManager().systemHealthMonitor!;
    const recovery = core.getManager().recoveryEngine!;
    expect(recovery.isInitialized()).toBe(true);

    const report = monitor.buildStatusReport();
    expect(report.healthMonitorStatus).toBe("operational");

    await core.stop();
  });

  it("builds status report with readiness metrics", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("report-test");

    const monitor = core.getManager().systemHealthMonitor!;
    const report = monitor.buildStatusReport();

    expect(report.readinessScore).toBeGreaterThanOrEqual(70);
    expect(report.performance.totalScans).toBeGreaterThan(0);

    await core.stop();
  });
});
