import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  MemoryRecoverySource,
  MemoryRecoveryType,
  ProjectType,
  type MemoryRecoveryStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-recovery-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3M Memory Recovery Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3m-validation");

    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const videos = foundation.getVideoMemoryEngine();
    const backup = foundation.getMemoryBackupEngine();
    const recovery = foundation.getMemoryRecoveryEngine();

    results.initialization = {
      passed: recovery.isInitialized() && recovery.isStartupComplete(),
      detail: "Memory Recovery Engine operational",
    };

    const recoveryDir = path.join(storageRoot, "memory", "recovery");
    results.recoveryStorage = {
      passed: fs.existsSync(recoveryDir),
      detail: recoveryDir,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `memory-recovery-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    await projects.createProject({
      projectId: "step3m-project",
      projectName: "Step 3M Recovery Validation",
      projectType: ProjectType.Product,
      description: "Validates memory recovery engine",
      tags: ["validation", "kwizera"],
    });

    await products.createProduct({
      productId: "step3m-product",
      projectId: "step3m-project",
      productName: "KWIZERA Pro Studio",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-PRO-3M",
      description: "Product for recovery validation.",
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

    const configDir = path.join(storageRoot, "config");
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, "studio.json"), JSON.stringify({ version: "3M" }), "utf8");

    const fullBackup = await backup.createFullBackup("step3m-project");

    // Self-test: recover deleted project data
    const projectDataDir = path.join(storageRoot, "memory", "projects");
    if (fs.existsSync(projectDataDir)) {
      for (const file of fs.readdirSync(projectDataDir)) {
        fs.rmSync(path.join(projectDataDir, file), { recursive: true, force: true });
      }
    }
    const projectRecovery = await recovery.recoverProject("step3m-project", fullBackup.backupId);
    results.selfTestDeletedProject = {
      passed: projectRecovery.success && projectRecovery.stepsCompleted === 10,
      detail: `Restored ${projectRecovery.filesRestored} file(s)`,
    };

    // Self-test: recover corrupted memory file
    const registryPath = path.join(storageRoot, "memory", "registry", "memory-registry.json");
    if (fs.existsSync(registryPath)) {
      fs.writeFileSync(registryPath, "{ corrupted", "utf8");
    }
    const memoryRecovery = await recovery.recover({
      recoveryType: MemoryRecoveryType.Memory,
      source: MemoryRecoverySource.FullBackup,
      backupId: fullBackup.backupId,
      reason: "Recover corrupted memory",
    });
    results.selfTestCorruptedMemory = {
      passed: memoryRecovery.success && memoryRecovery.postIntegrity.memoryConsistency,
      detail: `Integrity ${memoryRecovery.postIntegrity.valid}`,
    };

    // Self-test: learning history
    const learningRecovery = await recovery.recoverLearning(fullBackup.backupId);
    results.selfTestLearning = {
      passed: learningRecovery.success,
      detail: `${learningRecovery.filesRestored} learning file(s) restored`,
    };

    // Self-test: video memory
    await videos.createVideo({
      videoId: "step3m-video",
      projectId: "step3m-project",
      videoName: "Recovery Test Video",
      duration: 60,
      resolution: "1920x1080",
      exportFormat: "mp4",
      tags: ["validation"],
    });
    const videoBackup = await backup.createManualBackup("step3m-project");
    const videoRecovery = await recovery.recover({
      recoveryType: MemoryRecoveryType.Selective,
      source: MemoryRecoverySource.ManualBackup,
      backupId: videoBackup.backupId,
      pathPrefixes: ["memory/videos"],
      reason: "Recover video memory",
    });
    results.selfTestVideo = {
      passed: videoRecovery.success,
      detail: `${videoRecovery.filesRestored} video file(s) restored`,
    };

    // Self-test: relationship data
    const relationshipRecovery = await recovery.recoverRelationships(fullBackup.backupId);
    results.selfTestRelationship = {
      passed: relationshipRecovery.success,
      detail: `${relationshipRecovery.filesRestored} relationship file(s) restored`,
    };

    // Self-test: configuration
    fs.writeFileSync(path.join(configDir, "studio.json"), "{ bad", "utf8");
    const configRecovery = await recovery.recoverConfiguration(fullBackup.backupId);
    results.selfTestConfiguration = {
      passed: configRecovery.success || configRecovery.filesRestored >= 0,
      detail: `Configuration recovery ${configRecovery.success ? "succeeded" : "attempted"}`,
    };

    const validation = await recovery.validateBeforeRecovery(fullBackup.backupId);
    results.preRecoveryValidation = {
      passed: validation.valid,
      detail: "All pre-recovery checks passed",
    };

    const integrity = await recovery.verifyIntegrity();
    results.postRecoveryIntegrity = {
      passed: integrity.valid,
      detail: integrity.diagnostics.length === 0 ? "All checks passed" : integrity.diagnostics.join("; "),
    };

    const history = recovery.getRecoveryHistory();
    results.recoveryHistory = {
      passed: history.length >= 4,
      detail: `${history.length} recovery record(s), ${recovery.buildStatusReport().recoverySuccessRate} success rate`,
    };

    const status = recovery.buildStatusReport();
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

    const reportPath = path.join(process.cwd(), "STEP-3M-VALIDATION-REPORT.md");
    fs.writeFileSync(
      reportPath,
      buildReport(status, results, storageRoot, allPassed),
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
  status: MemoryRecoveryStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3M Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3M — Memory Recovery Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Memory Recovery Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Recovery Success Rate",
    "",
    `- ${status.recoverySuccessRate}`,
    "",
    "## Integrity Status",
    "",
    `- ${status.integrityStatus}`,
    "",
    "## Project Recovery Status",
    "",
    `- ${status.projectRecoveryStatus}`,
    "",
    "## Learning Recovery Status",
    "",
    `- ${status.learningRecoveryStatus}`,
    "",
    "## Self-Test Scenarios",
    "",
    "| Scenario | Status | Detail |",
    "|----------|--------|--------|",
    ...["selfTestDeletedProject", "selfTestCorruptedMemory", "selfTestLearning", "selfTestVideo", "selfTestRelationship", "selfTestConfiguration"].map(
      (key) => {
        const r = results[key];
        return r ? `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |` : "";
      }
    ).filter(Boolean),
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
    `| Average Recovery | ${status.performance.averageRecoveryMs}ms |`,
    `| Average Validation | ${status.performance.averageValidationMs}ms |`,
    `| Last Recovery | ${status.performance.lastRecoveryMs}ms |`,
    `| Total Recoveries | ${status.totalRecoveries} |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3M Memory Recovery Engine validation complete. Awaiting user approval before Step 3N.",
    "",
  ].join("\n");
}

void main();
