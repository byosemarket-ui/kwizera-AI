import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryRecordStatus,
  MemoryStorageType,
  STORAGE_TYPE_DEFINITIONS,
  StorageValidationCode,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-storage-test-"));
}

describe("AiMemoryStorageEngine", () => {
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

  async function startCore() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("memory-storage-test");
    return core;
  }

  it("initializes with Memory Foundation and writes logs", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(engine.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));

    await core.stop();
  });

  it("prepares storage infrastructure for all 12 memory types", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();
    const recordsRoot = path.join(storageRoot, "memory", "records");

    expect(STORAGE_TYPE_DEFINITIONS).toHaveLength(12);
    for (const def of STORAGE_TYPE_DEFINITIONS) {
      expect(fs.existsSync(path.join(recordsRoot, def.subdirectory))).toBe(true);
    }

    expect(engine.buildStatusReport().supportedTypes).toBe(12);
    await core.stop();
  });

  it("stores a memory record with full validation", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    const result = await engine.storeRecord({
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "KWIZERA Launch Campaign",
      description: "Initial project memory for studio launch",
      source: "test-suite",
      tags: ["launch", "studio"],
      keywords: ["kwizera", "campaign"],
      relatedProject: "proj-001",
    });

    expect(result.success).toBe(true);
    expect(result.record?.memoryId).toBeTruthy();
    expect(result.record?.integrityStatus).toBe("verified");
    expect(result.record?.version).toBe(1);
    expect(engine.getRecordCount()).toBe(1);

    await core.stop();
  });

  it("rejects duplicate records", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    const input = {
      memoryType: MemoryStorageType.Learning,
      category: "learning",
      title: "Duplicate Test Record",
      description: "Same content twice",
      source: "duplicate-test",
    };

    const first = await engine.storeRecord(input);
    expect(first.success).toBe(true);

    const second = await engine.storeRecord(input);
    expect(second.success).toBe(false);
    expect(second.validation?.code).toBe(StorageValidationCode.DuplicateRecord);

    await core.stop();
  });

  it("rejects invalid records with diagnostics", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    const result = await engine.storeRecord({
      memoryType: MemoryStorageType.Decision,
      category: "",
      title: "",
      description: "",
      source: "",
    });

    expect(result.success).toBe(false);
    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.diagnostics.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("updates records with version history preserved", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    const stored = await engine.storeRecord({
      memoryType: MemoryStorageType.Workflow,
      category: "workflow",
      title: "Workflow Memory v1",
      description: "Original workflow state",
      source: "workflow-engine",
    });
    const memoryId = stored.record!.memoryId;

    const updated = await engine.updateRecord(memoryId, {
      title: "Workflow Memory v2",
      description: "Updated workflow state",
      qualityScore: 95,
    });

    expect(updated.success).toBe(true);
    expect(updated.version).toBe(2);

    const read = await engine.getRecord(memoryId);
    expect(read.success).toBe(true);
    expect(read.record?.version).toBe(2);
    expect(read.record?.title).toBe("Workflow Memory v2");

    const versionsDir = path.join(read.record!.storageLocation, "versions");
    expect(fs.existsSync(path.join(versionsDir, "v1.json"))).toBe(true);
    expect(fs.existsSync(path.join(versionsDir, "v2.json"))).toBe(true);

    await core.stop();
  });

  it("persists records across application restart", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    const stored = await engine.storeRecord({
      memoryId: "persist-test-001",
      memoryType: MemoryStorageType.Reasoning,
      category: "reasoning",
      title: "Persistent Reasoning Record",
      description: "Must survive restart",
      source: "reasoning-engine",
      status: MemoryRecordStatus.Active,
    });
    expect(stored.success).toBe(true);
    await core.stop("restart-test");
    AiCore.resetInstance();

    const core2 = await startCore();
    const engine2 = core2.getManager().memoryFoundation!.getStorageEngine();
    const read = await engine2.getRecord("persist-test-001");

    expect(read.success).toBe(true);
    expect(read.record?.title).toBe("Persistent Reasoning Record");
    expect(engine2.getRecordCount()).toBe(1);

    await core2.stop();
  });

  it("supports metadata search for future search engine", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    await engine.storeRecord({
      memoryType: MemoryStorageType.Marketing,
      category: "marketing",
      title: "Brand Voice Guidelines",
      description: "Marketing tone and voice for KWIZERA",
      source: "marketing-engine",
      keywords: ["brand", "voice"],
    });

    const results = engine.searchMetadata("brand voice");
    expect(results.length).toBeGreaterThanOrEqual(1);

    await core.stop();
  });

  it("runs integrity checks and builds status report", async () => {
    const core = await startCore();
    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    await engine.storeRecord({
      memoryType: MemoryStorageType.System,
      category: "system",
      title: "System Configuration Memory",
      description: "Core system memory record",
      source: "ai-core",
    });

    const integrity = engine.runIntegrityCheck();
    expect(integrity.recordsChecked).toBe(1);
    expect(integrity.verified).toBe(true);

    const report = engine.buildStatusReport();
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.versionManagement.enabled).toBe(true);
    expect(report.backupReady).toBe(true);

    await core.stop();
  });
});
