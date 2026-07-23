import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryTier,
  ProjectType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-optimization-test-"));
}

describe("AiMemoryOptimizationEngine", () => {
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
    await core.start("memory-optimization-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const optimization = foundation.getMemoryOptimizationEngine();
    return { core, foundation, projects, products, optimization };
  }

  async function seedData(
    projects: Awaited<ReturnType<typeof startCore>>["projects"],
    products: Awaited<ReturnType<typeof startCore>>["products"]
  ) {
    await projects.createProject({
      projectId: "proj-opt-001",
      projectName: "Optimization Test Project",
      projectType: ProjectType.Product,
      description: "Project for memory optimization tests",
      tags: ["kwizera", "optimization"],
    });

    await products.createProduct({
      productId: "prod-opt-001",
      projectId: "proj-opt-001",
      productName: "KWIZERA Pro",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-OPT-001",
      description: "Product for optimization tests.",
      features: ["AI workflow"],
      specifications: { version: "1.0" },
      materials: ["digital"],
      colors: ["#000"],
      sizes: ["standard"],
      price: 99,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software", "kwizera"],
    });
  }

  it("initializes with memory foundation startup", async () => {
    const { core, optimization } = await startCore();
    expect(optimization.isInitialized()).toBe(true);
    expect(optimization.isStartupComplete()).toBe(true);

    const optimizationDir = path.join(storageRoot, "memory", "optimization");
    expect(fs.existsSync(optimizationDir)).toBe(true);

    await core.stop();
  });

  it("analyzes memory system metrics", async () => {
    const { core, projects, products, optimization } = await startCore();
    await seedData(projects, products);

    const analysis = await optimization.analyzeMemory();
    expect(analysis.totalRecords).toBeGreaterThan(0);
    expect(analysis.indexQualityScore).toBeGreaterThan(0);
    expect(analysis.durationMs).toBeGreaterThanOrEqual(0);

    await core.stop();
  });

  it("classifies memory into tiers", async () => {
    const { core, projects, products, optimization } = await startCore();
    await seedData(projects, products);

    const tiers = optimization.classifyTiers();
    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers.some((t) => t.tier === MemoryTier.Active)).toBe(true);

    const projectTier = optimization.getTier("proj-opt-001");
    expect(projectTier).toBeDefined();

    await core.stop();
  });

  it("detects duplicate records by fingerprint", async () => {
    const { core, projects, products, optimization } = await startCore();
    await seedData(projects, products);

    const duplicates = optimization.detectDuplicates();
    expect(Array.isArray(duplicates)).toBe(true);

    await core.stop();
  });

  it("creates recovery points before optimization", async () => {
    const { core, projects, products, optimization } = await startCore();
    await seedData(projects, products);

    const point = optimization.createRecoveryPoint("test-recovery");
    expect(point.recoveryPointId).toContain("rp-");
    expect(optimization.listRecoveryPoints().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("runs full optimization with integrity verification", async () => {
    const { core, projects, products, optimization } = await startCore();
    await seedData(projects, products);

    const result = await optimization.optimize();
    expect(result.success).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.recoveryPointId).toContain("rp-");

    const integrity = await optimization.verifyIntegrity();
    expect(integrity.valid).toBe(true);
    expect(integrity.recordsIntact).toBe(true);
    expect(integrity.indexesValid).toBe(true);

    await core.stop();
  });

  it("optimizes cache for frequently used memories", async () => {
    const { core, foundation, projects, products, optimization } = await startCore();
    await seedData(projects, products);

    const retrieval = foundation.getRetrievalEngine();
    await retrieval.retrieve("prod-opt-001");
    await retrieval.retrieve("prod-opt-001");
    await retrieval.retrieve("prod-opt-001");

    optimization.classifyTiers();
    const cacheResult = await optimization.optimizeCache();
    expect(cacheResult.priorityIds.length).toBeGreaterThan(0);

    const priorityFile = path.join(storageRoot, "memory", "optimization", "cache-priority.json");
    expect(fs.existsSync(priorityFile)).toBe(true);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, optimization } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `memory-optimization-engine-${date}.jsonl`);

    expect(fs.existsSync(logFile)).toBe(true);
    expect(optimization.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, projects, products, optimization } = await startCore();
    await seedData(projects, products);
    await optimization.optimize();

    const report = optimization.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);
    expect(report.totalOptimizations).toBeGreaterThan(0);

    await core.stop();
  });
});
