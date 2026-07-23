import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AiCore,
  BackupType,
  createAiCore,
  ProjectType,
  RestoreMode,
  RestorePointTrigger,
} from "@ai";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-memory-backup-test-"));
}

describe("AiMemoryBackupEngine", () => {
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
    await core.start("memory-backup-test");
    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const backup = foundation.getMemoryBackupEngine();
    return { core, foundation, projects, products, backup };
  }

  async function seedData(
    projects: Awaited<ReturnType<typeof startCore>>["projects"],
    products: Awaited<ReturnType<typeof startCore>>["products"]
  ) {
    await projects.createProject({
      projectId: "proj-bak-001",
      projectName: "Backup Test Project",
      projectType: ProjectType.Product,
      description: "Project for backup tests",
      tags: ["kwizera", "backup"],
    });

    await products.createProduct({
      productId: "prod-bak-001",
      projectId: "proj-bak-001",
      productName: "KWIZERA Pro",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-BAK-001",
      description: "Product for backup tests.",
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
    const { core, backup } = await startCore();
    expect(backup.isInitialized()).toBe(true);
    expect(backup.isStartupComplete()).toBe(true);

    const backupsRoot = path.join(storageRoot, "backups");
    expect(fs.existsSync(backupsRoot)).toBe(true);

    await core.stop();
  });

  it("creates validated manual backup with version history", async () => {
    const { core, projects, products, backup } = await startCore();
    await seedData(projects, products);

    const result = await backup.createManualBackup("proj-bak-001");
    expect(result.success).toBe(true);
    expect(result.manifest.validated).toBe(true);
    expect(result.validation.valid).toBe(true);
    expect(fs.existsSync(result.backupPath)).toBe(true);

    const history = backup.getVersionHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history.some((m) => m.backupId === result.backupId)).toBe(true);

    await core.stop();
  });

  it("creates full and incremental backups", async () => {
    const { core, projects, products, backup } = await startCore();
    await seedData(projects, products);

    const full = await backup.createFullBackup("proj-bak-001");
    expect(full.success).toBe(true);
    expect(full.manifest.backupType).toBe(BackupType.Full);

    const incremental = await backup.createIncrementalBackup();
    expect(incremental.success).toBe(true);
    expect(incremental.manifest.backupType).toBe(BackupType.Incremental);

    await core.stop();
  });

  it("validates backup integrity before completion", async () => {
    const { core, projects, products, backup } = await startCore();
    await seedData(projects, products);

    const result = await backup.createManualBackup();
    const validation = backup.validateBackup(result.backupId);
    expect(validation.valid).toBe(true);
    expect(validation.fileIntegrity).toBe(true);
    expect(validation.memoryIntegrity).toBe(true);

    await core.stop();
  });

  it("creates restore points for optimization and updates", async () => {
    const { core, projects, products, backup } = await startCore();
    await seedData(projects, products);

    const point = await backup.createRestorePointBackup(
      RestorePointTrigger.BeforeOptimization,
      "proj-bak-001"
    );
    expect(point.restorePointId).toContain("rp-");
    expect(point.trigger).toBe(RestorePointTrigger.BeforeOptimization);
    expect(backup.listRestorePoints().length).toBeGreaterThan(0);

    await core.stop();
  });

  it("supports scheduled backup configuration", async () => {
    const { core, backup } = await startCore();

    const schedule = backup.updateSchedule({ enabled: true, intervalHours: 12 });
    expect(schedule.intervalHours).toBe(12);
    expect(backup.getSchedule().enabled).toBe(true);

    await core.stop();
  });

  it("restores backup in selective mode", async () => {
    const { core, projects, products, backup } = await startCore();
    await seedData(projects, products);

    const created = await backup.createFullBackup("proj-bak-001");
    const restored = await backup.restore(created.backupId, RestoreMode.Memory);
    expect(restored.success).toBe(true);
    expect(restored.filesRestored).toBeGreaterThan(0);

    await core.stop();
  });

  it("writes logs to storage root logs directory", async () => {
    const { core, backup } = await startCore();
    const logDir = path.join(storageRoot, "logs");
    const date = new Date().toISOString().slice(0, 10);
    const logFile = path.join(logDir, `memory-backup-engine-${date}.jsonl`);

    expect(fs.existsSync(logFile)).toBe(true);
    expect(backup.logger.getLogDirectory()).toBe(logDir);

    await core.stop();
  });

  it("builds status report with readiness score", async () => {
    const { core, projects, products, backup } = await startCore();
    await seedData(projects, products);
    await backup.createManualBackup();

    const report = backup.buildStatusReport();
    expect(report.engineStatus).toBe("operational");
    expect(report.readinessScore).toBe(100);
    expect(report.totalBackups).toBeGreaterThan(0);

    await core.stop();
  });
});
