import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  createAiCore,
  MemoryRecoverySource,
  MemoryRecoveryType,
  ProjectType,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-recovery-test-"));
}

describe("AiMemoryRecoveryEngine", () => {
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
    await core.start("memory-recovery-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const backup = foundation.getMemoryBackupEngine();
    const recovery = foundation.getMemoryRecoveryEngine();
    return { core, foundation, projects, products, backup, recovery };
  }

  async function seedData(
    projects: Awaited<ReturnType<typeof startCore>>["projects"],
    products: Awaited<ReturnType<typeof startCore>>["products"]
  ) {
    await projects.createProject({
      projectId: "proj-rec-001",
      projectName: "Recovery Test Project",
      projectType: ProjectType.Product,
      description: "Project for recovery tests",
      tags: ["kwizera", "recovery"],
    });

    await products.createProduct({
      productId: "prod-rec-001",
      projectId: "proj-rec-001",
      productName: "KWIZERA Pro",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-REC-001",
      description: "Product for recovery tests.",
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
    const { core, recovery } = await startCore();
    expect(recovery.isInitialized()).toBe(true);
    expect(recovery.isStartupComplete()).toBe(true);

    const recoveryDir = path.join(storageRoot, "memory", "recovery");
    expect(fs.existsSync(recoveryDir)).toBe(true);

    await core.stop();
  });

  it("validates backup before recovery", async () => {
    const { core, projects, products, backup, recovery } = await startCore();
    await seedData(projects, products);

    const created = await backup.createManualBackup("proj-rec-001");
    const validation = await recovery.validateBeforeRecovery(created.backupId);
    expect(validation.valid).toBe(true);
    expect(validation.backupIntegrity).toBe(true);
    expect(validation.storageAvailable).toBe(true);

    await core.stop();
  });

  it("recovers project memory from backup", async () => {
    const { core, projects, products, backup, recovery } = await startCore();
    await seedData(projects, products);

    const created = await backup.createFullBackup("proj-rec-001");
    const result = await recovery.recoverProject("proj-rec-001", created.backupId);

    expect(result.success).toBe(true);
    expect(result.stepsCompleted).toBe(10);
    expect(result.filesRestored).toBeGreaterThan(0);
    expect(result.postIntegrity.valid).toBe(true);

    await core.stop();
  });

  it("recovers relationship memory partially", async () => {
    const { core, projects, products, backup, recovery } = await startCore();
    await seedData(projects, products);

    const created = await backup.createManualBackup();
    const result = await recovery.recoverRelationships(created.backupId);

    expect(result.success).toBe(true);
    expect(result.request.recoveryType).toBe(MemoryRecoveryType.Relationship);

    await core.stop();
  });

  it("recovers learning history", async () => {
    const { core, projects, products, backup, recovery } = await startCore();
    await seedData(projects, products);

    const created = await backup.createManualBackup();
    const result = await recovery.recoverLearning(created.backupId);

    expect(result.success).toBe(true);
    expect(result.request.recoveryType).toBe(MemoryRecoveryType.Learning);

    await core.stop();
  });

  it("recovers configuration selectively", async () => {
    const { core, projects, products, backup, recovery } = await startCore();
    await seedData(projects, products);

    const configDir = path.join(storageRoot, "config");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "studio.json"), JSON.stringify({ version: "test" }), "utf8");

    const created = await backup.createManualBackup();
    const result = await recovery.recoverConfiguration(created.backupId);

    expect(result.request.recoveryType).toBe(MemoryRecoveryType.Configuration);

    await core.stop();
  });

  it("stores recovery history with integrity result", async () => {
    const { core, projects, products, backup, recovery } = await startCore();
    await seedData(projects, products);

    const created = await backup.createManualBackup();
    await recovery.recover({
      recoveryType: MemoryRecoveryType.Memory,
      source: MemoryRecoverySource.ManualBackup,
      backupId: created.backupId,
      reason: "Test memory recovery",
    });

    const history = recovery.getRecoveryHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].integrityResult).toBe(true);
    expect(history[0].success).toBe(true);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, recovery } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `memory-recovery-engine-${date}.jsonl`);

    expect(fs.existsSync(logFile)).toBe(true);
    expect(recovery.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, projects, products, backup, recovery } = await startCore();
    await seedData(projects, products);

    const created = await backup.createManualBackup();
    await recovery.recover({
      recoveryType: MemoryRecoveryType.Full,
      source: MemoryRecoverySource.FullBackup,
      backupId: created.backupId,
      reason: "Full recovery test",
    });

    const report = recovery.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);
    expect(report.totalRecoveries).toBeGreaterThan(0);

    await core.stop();
  });
});
