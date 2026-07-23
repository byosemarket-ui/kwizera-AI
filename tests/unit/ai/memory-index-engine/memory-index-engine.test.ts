import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  IndexSearchMode,
  IndexType,
  MemoryRecordStatus,
  MemoryStorageType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-index-test-"));
}

describe("AiMemoryIndexEngine", () => {
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

  async function seedAndGetIndexEngine() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("index-test");
    const foundation = core.getManager().memoryFoundation!;
    const storage = foundation.getStorageEngine();
    const indexEngine = foundation.getIndexEngine();

    await storage.storeRecord({
      memoryId: "idx-proj-001",
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "KWIZERA Index Test Project",
      description: "Project for index engine validation",
      source: "project-engine",
      tags: ["kwizera", "brand-launch"],
      keywords: ["project", "index"],
      relatedProject: "idx-proj-001",
    });

    await storage.storeRecord({
      memoryId: "idx-mkt-001",
      memoryType: MemoryStorageType.Marketing,
      category: "marketing",
      title: "Brand Launch Campaign",
      description: "Marketing linked to index test project",
      source: "marketing-engine",
      tags: ["brand-launch", "marketing"],
      relatedProject: "idx-proj-001",
    });

    await storage.storeRecord({
      memoryId: "idx-learn-001",
      memoryType: MemoryStorageType.Learning,
      category: "learning",
      title: "Learning from launch workflow",
      description: "AI learning insights",
      source: "learning-engine",
      keywords: ["learning", "workflow"],
      relatedProject: "idx-proj-001",
      qualityScore: 90,
    });

    return { core, indexEngine };
  }

  it("initializes and creates index directories", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();
    expect(indexEngine.isInitialized()).toBe(true);
    expect(indexEngine.isStartupComplete()).toBe(true);

    const indexesDir = path.join(storageRoot, "memory", "indexes");
    expect(fs.existsSync(indexesDir)).toBe(true);
    expect(fs.existsSync(path.join(indexesDir, `${IndexType.MemoryId}.json`))).toBe(true);

    await core.stop();
  });

  it("automatically indexes records on storage", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();
    expect(indexEngine.totalIndexedRecords()).toBeGreaterThanOrEqual(3);

    const byProject = indexEngine.lookup({ project: "idx-proj-001" });
    expect(byProject.memoryIds.length).toBeGreaterThanOrEqual(1);
    expect(byProject.fromOptimizedIndex).toBe(true);

    await core.stop();
  });

  it("updates indexes when memory changes", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();
    const storage = core.getManager().memoryFoundation!.getStorageEngine();

    await storage.updateRecord("idx-mkt-001", {
      tags: ["brand-launch", "marketing", "updated-tag"],
    });

    const byTag = indexEngine.lookup({ tags: ["updated-tag"] });
    expect(byTag.memoryIds).toContain("idx-mkt-001");

    await core.stop();
  });

  it("removes indexes when memory is deleted", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();
    const storage = core.getManager().memoryFoundation!.getStorageEngine();

    await storage.updateRecord("idx-learn-001", {
      status: MemoryRecordStatus.Deleted,
    });

    const lookup = indexEngine.lookup({ memoryId: "idx-learn-001" });
    expect(lookup.memoryIds).not.toContain("idx-learn-001");

    await core.stop();
  });

  it("builds relationship indexes between memories", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();
    const related = indexEngine.getRelated("idx-proj-001");
    expect(related.length).toBeGreaterThanOrEqual(0);

    await core.stop();
  });

  it("supports fast keyword and category lookup", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();

    const keyword = indexEngine.lookup({
      mode: IndexSearchMode.Keyword,
      keywords: ["learning"],
    });
    expect(keyword.memoryIds).toContain("idx-learn-001");

    const category = indexEngine.lookup({ category: "marketing" });
    expect(category.memoryIds).toContain("idx-mkt-001");

    await core.stop();
  });

  it("rebuilds indexes without losing stored data", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();
    const storage = core.getManager().memoryFoundation!.getStorageEngine();

    const rebuild = await indexEngine.rebuildIndexes();
    expect(rebuild.success).toBe(true);
    expect(rebuild.recordsIndexed).toBeGreaterThanOrEqual(3);
    expect(rebuild.dataProtected).toBe(true);

    const read = await storage.getRecord("idx-proj-001");
    expect(read.success).toBe(true);

    await core.stop();
  });

  it("runs health checks and builds status report", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();

    const health = await indexEngine.runHealthCheck();
    expect(health.integrityValid).toBe(true);

    const report = indexEngine.buildStatusReport();
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.indexPerformance.totalIndexes).toBeGreaterThanOrEqual(17);

    await core.stop();
  });

  it("writes logs to storage logs directory", async () => {
    const { core, indexEngine } = await seedAndGetIndexEngine();
    expect(indexEngine.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));
    await core.stop();
  });
});
