import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  FRAMEWORK_MODULE_CATALOG,
  ManagedModuleState,
  ModuleHealthStatus,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-module-manager-test-"));
}

describe("AiModuleManager", () => {
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

  it("initializes framework catalog for all supported modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-manager-test");

    const manager = core.getManager().moduleManager!;
    expect(manager.isInitialized()).toBe(true);
    expect(manager.getFrameworkCatalogSize()).toBe(FRAMEWORK_MODULE_CATALOG.length);
    expect(manager.getAllRegistryRecords().length).toBe(FRAMEWORK_MODULE_CATALOG.length);

    const aiCore = manager.getRegistryRecord("ai-core");
    expect(aiCore?.status).toBe(ManagedModuleState.Running);
    expect(aiCore?.healthStatus).toBe(ModuleHealthStatus.Healthy);

    await core.stop();
  });

  it("registers and initializes engines through module manager", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-manager-engines");

    const manager = core.getManager().moduleManager!;
    const reasoning = manager.getRegistryRecord("reasoning-engine");
    const workflow = manager.getRegistryRecord("workflow-engine");

    expect(reasoning?.status).toBe(ManagedModuleState.Running);
    expect(workflow?.status).toBe(ManagedModuleState.Running);
    expect(manager.getRegisteredPluginCount()).toBeGreaterThanOrEqual(7);

    await core.stop();
  });

  it("routes controlled communication between modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-manager-comm");

    const manager = core.getManager().moduleManager!;
    const response = await manager.routeCommunication({
      senderId: "ai-core",
      receiverId: "reasoning-engine",
      action: "health-probe",
    });

    expect(response.success).toBe(true);
    expect(manager.getCommunicationRecords().length).toBe(1);
    expect(manager.getCommunicationRecords()[0].sender).toBe("ai-core");

    await core.stop();
  });

  it("rejects communication from disabled modules", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-manager-disable");

    const manager = core.getManager().moduleManager!;
    manager.disableModule("reasoning-engine");

    await expect(
      manager.routeCommunication({
        senderId: "ai-core",
        receiverId: "reasoning-engine",
        action: "health-probe",
      })
    ).rejects.toThrow();

    await core.stop();
  });

  it("monitors health and writes logs to storage", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-manager-health");

    const manager = core.getManager().moduleManager!;
    await manager.monitorHealth("task-manager");

    const taskRecord = manager.getRegistryRecord("task-manager");
    expect(taskRecord?.healthStatus).toBe(ModuleHealthStatus.Healthy);

    const logDir = manager.logger.getLogDirectory();
    expect(logDir).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(logDir!)).toBe(true);
    expect(manager.logger.getEntries().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("tracks lifecycle history and builds status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-manager-report");

    const manager = core.getManager().moduleManager!;
    const report = manager.buildStatusReport();

    expect(report.moduleManagerStatus).toBe("operational");
    expect(report.registeredModules).toBeGreaterThanOrEqual(8);
    expect(report.readinessScore).toBeGreaterThanOrEqual(80);
    expect(manager.history.getEvents().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("supports enable and disable lifecycle", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("module-manager-lifecycle");

    const manager = core.getManager().moduleManager!;
    manager.disableModule("planning-engine");
    expect(manager.getRegistryRecord("planning-engine")?.status).toBe(
      ManagedModuleState.Disabled
    );

    manager.enableModule("planning-engine");
    expect(manager.getRegistryRecord("planning-engine")?.enabled).toBe(true);

    await core.stop();
  });
});
