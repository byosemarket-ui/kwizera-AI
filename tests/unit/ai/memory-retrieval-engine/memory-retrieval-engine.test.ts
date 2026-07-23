import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryStorageType,
  SearchMode,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-retrieval-test-"));
}

describe("AiMemoryRetrievalEngine", () => {
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

  async function seedMemories() {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("retrieval-test");
    const storage = core.getManager().memoryFoundation!.getStorageEngine();

    await storage.storeRecord({
      memoryId: "proj-001",
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "KWIZERA Launch Project",
      description: "Main launch project for KWIZERA AI STUDIO",
      source: "project-engine",
      tags: ["launch", "kwizera"],
      keywords: ["project", "studio"],
      relatedProject: "proj-001",
    });

    await storage.storeRecord({
      memoryId: "mkt-001",
      memoryType: MemoryStorageType.Marketing,
      category: "marketing",
      title: "KWIZERA Brand Campaign",
      description: "Marketing campaign for studio launch",
      source: "marketing-engine",
      tags: ["brand", "launch"],
      keywords: ["marketing", "campaign"],
      relatedProject: "proj-001",
    });

    await storage.storeRecord({
      memoryId: "learn-001",
      memoryType: MemoryStorageType.Learning,
      category: "learning",
      title: "Launch Learning Insights",
      description: "AI learning from launch workflow",
      source: "learning-engine",
      tags: ["learning", "launch"],
      keywords: ["insights"],
      relatedProject: "proj-001",
      qualityScore: 95,
    });

    return core;
  }

  it("initializes with Memory Foundation and writes logs", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    expect(engine.isInitialized()).toBe(true);
    expect(engine.isStartupComplete()).toBe(true);
    expect(engine.logger.getLogDirectory()).toBe(path.join(storageRoot, "logs"));

    await core.stop();
  });

  it("searches memories by keyword", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    const result = await engine.search({
      mode: SearchMode.Keyword,
      text: "launch",
      limit: 10,
    });

    expect(result.success).toBe(true);
    expect(result.results.length).toBeGreaterThanOrEqual(2);
    expect(result.results[0].rank).toBe(1);
    expect(result.results[0].ranking.compositeScore).toBeGreaterThan(0);

    await core.stop();
  });

  it("retrieves memory by ID with validation", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    const result = await engine.retrieve("proj-001");

    expect(result.success).toBe(true);
    expect(result.record?.title).toBe("KWIZERA Launch Project");
    expect(result.diagnostics).toHaveLength(0);

    await core.stop();
  });

  it("ranks results by relevance and quality", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    const result = await engine.search({
      mode: SearchMode.Priority,
      text: "KWIZERA",
      limit: 5,
    });

    expect(result.results.length).toBeGreaterThan(0);
    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i - 1].ranking.compositeScore).toBeGreaterThanOrEqual(
        result.results[i].ranking.compositeScore
      );
    }

    await core.stop();
  });

  it("finds related memories for a retrieved record", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    const result = await engine.retrieve("proj-001");

    expect(result.relatedMemories.length).toBeGreaterThan(0);
    expect(result.relatedMemories.every((r) => r.memoryId !== "proj-001")).toBe(true);

    await core.stop();
  });

  it("recommends memories for current task context", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    const result = await engine.search({
      text: "launch",
      project: "proj-001",
      limit: 1,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);

    await core.stop();
  });

  it("uses cache for frequently accessed memories", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    const first = await engine.retrieve("proj-001");
    const second = await engine.retrieve("proj-001");

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(second.fromCache).toBe(true);

    const report = engine.buildStatusReport();
    expect(report.cacheStatus.hits).toBeGreaterThan(0);

    await core.stop();
  });

  it("searches by category and tags", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    const result = await engine.search({
      mode: SearchMode.Category,
      category: "marketing",
      tags: ["brand"],
    });

    expect(result.results.length).toBeGreaterThanOrEqual(1);
    expect(result.results[0].category).toBe("marketing");

    await core.stop();
  });

  it("builds status report with performance metrics", async () => {
    const core = await seedMemories();
    const engine = core.getManager().memoryFoundation!.getRetrievalEngine();

    await engine.search({ text: "kwizera" });
    await engine.retrieve("learn-001");

    const report = engine.buildStatusReport();
    expect(report.readinessScore).toBeGreaterThanOrEqual(85);
    expect(report.totalSearches).toBeGreaterThanOrEqual(1);
    expect(report.totalRetrievals).toBeGreaterThanOrEqual(1);

    await core.stop();
  });
});
