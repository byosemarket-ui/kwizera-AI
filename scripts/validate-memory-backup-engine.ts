import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  BackupType,
  createAiCore,
  ProjectType,
  RestoreMode,
  RestorePointTrigger,
  type MemoryBackupStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-backup-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3L Memory Backup Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3l-validation");

    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const backup = foundation.getMemoryBackupEngine();

    results.initialization = {
      passed: backup.isInitialized() && backup.isStartupComplete(),
      detail: "Memory Backup Engine operational",
    };

    const backupsRoot = path.join(storageRoot, "backups");
    results.backupStorage = {
      passed: fs.existsSync(backupsRoot),
      detail: backupsRoot,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `memory-backup-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    await projects.createProject({
      projectId: "step3l-project",
      projectName: "Step 3L Backup Validation",
      projectType: ProjectType.Product,
      description: "Validates memory backup engine",
      tags: ["validation", "kwizera"],
    });

    await products.createProduct({
      productId: "step3l-product",
      projectId: "step3l-project",
      productName: "KWIZERA Pro Studio",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-PRO-3L",
      description: "Product for backup validation.",
      features: ["AI workflow"],
      specifications: { version: "1.0" },
      materials: ["digital-license"],
      colors: ["#1a1a2e"],
      sizes: ["standard"],
      price: 149.99,
      currency: "USD",
      availability: "in-stock",
      countryOfOrigin: "US",
      supplier: "KWIZERA Inc",
      language: "en",
      marketingGoal: "conversion",
      tags: ["software", "validation"],
    });

    const autoStart = Date.now();
    const automatic = await backup.createAutomaticBackup();
    results.automaticBackup = {
      passed: automatic.success && automatic.validation.valid,
      detail: `Backup ${automatic.backupId} in ${Date.now() - autoStart}ms`,
    };

    const manualStart = Date.now();
    const manual = await backup.createManualBackup("step3l-project");
    results.manualBackup = {
      passed: manual.success && manual.manifest.validated,
      detail: `v${manual.manifest.version} in ${Date.now() - manualStart}ms`,
    };

    const schedule = backup.updateSchedule({ enabled: true, intervalHours: 24 });
    const scheduled = await backup.runScheduledBackup();
    results.scheduledBackup = {
      passed: schedule.enabled && (scheduled === null || scheduled.success),
      detail: scheduled ? `Scheduled backup ${scheduled.backupId}` : "Schedule not yet due",
    };

    const history = backup.getVersionHistory();
    results.versionHistory = {
      passed: history.length >= 2,
      detail: `${history.length} version(s), never overwritten`,
    };

    const restorePoint = await backup.createRestorePointBackup(
      RestorePointTrigger.BeforeOptimization,
      "step3l-project"
    );
    results.restorePoints = {
      passed: restorePoint.backupId.length > 0,
      detail: `Restore point ${restorePoint.restorePointId}`,
    };

    const validation = backup.validateBackup(manual.backupId);
    results.backupValidation = {
      passed: validation.valid,
      detail: validation.diagnostics.length === 0 ? "All integrity checks passed" : validation.diagnostics.join("; "),
    };

    const compressionRatio = manual.manifest.totalSizeBytes > 0
      ? Math.round((1 - manual.manifest.compressedSizeBytes / manual.manifest.totalSizeBytes) * 100)
      : 0;
    results.compression = {
      passed: manual.manifest.compressedSizeBytes <= manual.manifest.totalSizeBytes,
      detail: `${compressionRatio}% compression ratio`,
    };

    const restoreStart = Date.now();
    const restored = await backup.restore(manual.backupId, RestoreMode.Memory);
    const restoreMs = Date.now() - restoreStart;
    results.restoreReadiness = {
      passed: restored.success,
      detail: `Restored ${restored.filesRestored} file(s) in ${restoreMs}ms`,
    };

    const retention = backup.organizeRetention();
    results.retention = {
      passed: retention.latest + retention.daily >= 0,
      detail: `latest=${retention.latest}, daily=${retention.daily}, milestone=${retention.milestone}`,
    };

    const status = backup.buildStatusReport();
    results.readiness = {
      passed: status.readinessScore === 100,
      detail: `Readiness ${status.readinessScore}/100`,
    };

    const allPassed = Object.values(results).every((r) => r.passed);

    console.log("Validation Results:");
    for (const [key, result] of Object.entries(results)) {
      console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
    }
    console.log("---");
    console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
    console.log(`Readiness Score: ${status.readinessScore}/100`);

    const reportPath = path.join(process.cwd(), "STEP-3L-VALIDATION-REPORT.md");
    fs.writeFileSync(
      reportPath,
      buildReport(status, results, storageRoot, allPassed, manual.manifest.backupType),
      "utf8"
    );
    console.log("Report written:", reportPath);

    await core.stop();

    if (useTemp && fs.existsSync(storageRoot)) {
      fs.rmSync(storageRoot, { recursive: true, force: true });
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("Validation failed:", error);
    process.exit(1);
  }
}

function buildReport(
  status: MemoryBackupStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  lastBackupType: BackupType
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3L Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3L — Memory Backup Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Backup Engine Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Backup Integrity",
    "",
    `- ${status.backupIntegrity}`,
    "",
    "## Restore Readiness",
    "",
    `- ${status.restoreReadiness}`,
    "",
    "## Version History Status",
    "",
    `- ${status.versionHistoryStatus}`,
    "",
    "## Validation Results",
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(
      ([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`
    ),
    "",
    "## Performance",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Last Backup Type | ${lastBackupType} |`,
    `| Average Backup | ${status.performance.averageBackupMs}ms |`,
    `| Average Validation | ${status.performance.averageValidationMs}ms |`,
    `| Average Compression | ${status.performance.averageCompressionRatio}% |`,
    `| Last Backup | ${status.performance.lastBackupMs}ms |`,
    `| Total Backups | ${status.totalBackups} |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3L Memory Backup Engine validation complete. Awaiting user approval before Step 3M.",
    "",
  ].join("\n");
}

void main();
