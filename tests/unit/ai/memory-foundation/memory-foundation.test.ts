import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryAccessOperation,
  MemoryCategory,
  MemoryLifecycleState,
  PREPARED_MEMORY_CATEGORIES,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-foundation-test-"));
}

describe("AiMemoryFoundation", { timeout: 120_000 }, () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = createTempStorageRoot();
  });

  afterEach(() => {
    AiCore.resetInstance();
    if (fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }
  });

  it("initializes with AI Core and writes logs to storage logs directory", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("memory-foundation-test");

    const foundation = core.getManager().memoryFoundation!;
    expect(foundation.isInitialized()).toBe(true);
    expect(foundation.isStartupComplete()).toBe(true);
    expect(foundation.getLifecycleState()).toBe(MemoryLifecycleState.Ready);

    const logDir = foundation.logger.getLogDirectory();
    expect(logDir).toBe(path.join(storageRoot, "logs"));
    expect(fs.existsSync(logDir!)).toBe(true);

    await core.stop();
  });

  it("creates central memory registry with all prepared categories", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().memoryFoundation!;
    const modules = foundation.getRegistry().getAllModules();

    expect(modules).toHaveLength(PREPARED_MEMORY_CATEGORIES.length);
    const projectModule = modules.find((m) => m.memoryId === "project-memory");
    expect(projectModule?.implemented).toBe(true);
    expect(modules.filter((m) => m.implemented)).toHaveLength(5);
    expect(modules.find((m) => m.memoryId === "video-memory")?.implemented).toBe(true);
    expect(modules.find((m) => m.memoryId === "marketing-memory")?.implemented).toBe(true);
    expect(modules.find((m) => m.memoryId === "product-memory")?.implemented).toBe(true);
    expect(modules.find((m) => m.memoryId === "persistent-memory")?.implemented).toBe(true);
    expect(fs.existsSync(foundation.getMemoryRoot())).toBe(true);

    await core.stop();
  });

  it("persists registry across application restart", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("persist-test");
    const registryPath = path.join(storageRoot, "memory", "registry", "memory-registry.json");
    expect(fs.existsSync(registryPath)).toBe(true);
    await core.stop("persist-test");
    AiCore.resetInstance();

    const core2 = createAiCore({ storageRootOverride: storageRoot });
    await core2.start("persist-test-restart");
    const foundation = core2.getManager().memoryFoundation!;
    expect(foundation.getRegistry().getPreparedCount()).toBe(PREPARED_MEMORY_CATEGORIES.length);
    expect(fs.existsSync(registryPath)).toBe(true);
    await core2.stop();
  });

  it("coordinates centralized memory access", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().memoryFoundation!;
    const result = await foundation.requestAccess({
      requesterId: "reasoning-engine",
      category: MemoryCategory.Reasoning,
      operation: MemoryAccessOperation.Read,
    });

    expect(result.granted).toBe(true);
    expect(result.storagePath).toContain("reasoning");
    expect(foundation.history.getCount()).toBeGreaterThan(0);

    await core.stop();
  });

  it("verifies memory integrity on startup", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().memoryFoundation!;
    const integrity = foundation.getLastIntegrityResult();
    expect(integrity).toBeTruthy();
    expect(integrity!.checkedPaths).toBeGreaterThan(0);

    await core.stop();
  });

  it("runs health checks and builds status report", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().memoryFoundation!;
    const health = await foundation.runHealthCheck();
    expect(health.score).toBeGreaterThanOrEqual(60);
    expect(health.availability).toBe(true);

    const report = foundation.buildStatusReport();
    expect(report.readinessScore).toBeGreaterThanOrEqual(80);
    expect(report.preparedCategories).toBe(12);

    await core.stop();
  });

  it("creates backups and recovers memory state", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const foundation = core.getManager().memoryFoundation!;
    const backupPath = await foundation.createBackup("test");
    expect(fs.existsSync(backupPath)).toBe(true);

    await foundation.recover();
    expect(foundation.getLifecycleState()).toBe(MemoryLifecycleState.Ready);

    await core.stop();
  });

  it("registers as memory-engine plugin in AI Core", async () => {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start();

    const entry = core.getManager().registry.getEntry("memory-engine");
    expect(entry?.status).toBe("initialized");

    await core.stop();
  });
});
