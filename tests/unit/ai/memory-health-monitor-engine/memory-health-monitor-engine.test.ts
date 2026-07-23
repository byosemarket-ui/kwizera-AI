import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryHealthScoreLevel,
  MonitoredModule,
  ProjectType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-health-monitor-test-"));
}

describe("AiMemoryHealthMonitorEngine", () => {
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
    await core.start("memory-health-monitor-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const monitor = foundation.getMemoryHealthMonitorEngine();
    return { core, foundation, projects, products, monitor };
  }

  async function seedData(
    projects: Awaited<ReturnType<typeof startCore>>["projects"],
    products: Awaited<ReturnType<typeof startCore>>["products"]
  ) {
    await projects.createProject({
      projectId: "proj-health-001",
      projectName: "Health Test Project",
      projectType: ProjectType.Product,
      description: "Project for health monitor tests",
      tags: ["kwizera"],
    });

    await products.createProduct({
      productId: "prod-health-001",
      projectId: "proj-health-001",
      productName: "KWIZERA Pro",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-HEALTH-001",
      description: "Product for health tests.",
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
      tags: ["software"],
    });
  }

  it("initializes with memory foundation startup", async () => {
    const { core, monitor } = await startCore();
    expect(monitor.isInitialized()).toBe(true);
    expect(monitor.isStartupComplete()).toBe(true);

    const healthDir = path.join(storageRoot, "memory", "health");
    expect(fs.existsSync(healthDir)).toBe(true);

    await core.stop();
  });

  it("runs health check with overall score and module scores", async () => {
    const { core, projects, products, monitor } = await startCore();
    await seedData(projects, products);

    const check = await monitor.runHealthCheck();
    expect(check.overallScore).toBeGreaterThan(0);
    expect(check.moduleScores.length).toBeGreaterThan(10);
    expect(check.checkId).toContain("hc-");
    expect([
      MemoryHealthScoreLevel.Excellent,
      MemoryHealthScoreLevel.Good,
      MemoryHealthScoreLevel.Warning,
    ]).toContain(check.overallLevel);

    await core.stop();
  });

  it("monitors all required memory modules", async () => {
    const { core, monitor } = await startCore();
    const scores = monitor.getModuleScores();
    const modules = scores.map((s) => s.module);

    expect(modules).toContain(MonitoredModule.StorageEngine);
    expect(modules).toContain(MonitoredModule.IndexEngine);
    expect(modules).toContain(MonitoredModule.RetrievalEngine);
    expect(modules).toContain(MonitoredModule.BackupEngine);
    expect(modules).toContain(MonitoredModule.RecoveryEngine);
    expect(modules).toContain(MonitoredModule.RelationshipMemory);

    await core.stop();
  });

  it("performs complete memory audit", async () => {
    const { core, projects, products, monitor } = await startCore();
    await seedData(projects, products);

    const audit = await monitor.runAudit();
    expect(audit.valid).toBe(true);
    expect(audit.memoryConsistency).toBe(true);
    expect(audit.relationshipIntegrity).toBe(true);
    expect(audit.backupIntegrity).toBe(true);

    await core.stop();
  });

  it("stores health history with warnings and recommendations", async () => {
    const { core, monitor } = await startCore();
    await monitor.runHealthCheck();

    const history = monitor.getHealthHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].checkId).toBeDefined();
    expect(history[0].healthScore).toBeGreaterThan(0);

    await core.stop();
  });

  it("provides trend analysis", async () => {
    const { core, monitor } = await startCore();
    await monitor.runHealthCheck();
    await monitor.runHealthCheck();

    const trend = monitor.getTrendAnalysis();
    expect(trend.direction).toBeDefined();
    expect(trend.prediction).toBeTruthy();

    await core.stop();
  });

  it("reports backup and recovery readiness", async () => {
    const { core, monitor } = await startCore();
    const check = monitor.getLastCheck();

    expect(check).not.toBeNull();
    expect(check!.backupReadiness).toBe(true);
    expect(check!.recoveryReadiness).toBe(true);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, monitor } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `memory-health-monitor-engine-${date}.jsonl`);

    expect(fs.existsSync(logFile)).toBe(true);
    expect(monitor.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, projects, products, monitor } = await startCore();
    await seedData(projects, products);

    const report = monitor.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);
    expect(report.totalChecks).toBeGreaterThan(0);
    expect(report.trendAnalysis).toBeDefined();

    await core.stop();
  });
});
