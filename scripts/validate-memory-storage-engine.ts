import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  MemoryStorageType,
  STORAGE_TYPE_DEFINITIONS,
  StorageValidationCode,
  type MemoryStorageStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-storage-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3B Memory Storage Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3b-validation");

    const engine = core.getManager().memoryFoundation!.getStorageEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? "Storage Engine operational" : "Not ready",
    };

    results.storageInfrastructure = {
      passed: STORAGE_TYPE_DEFINITIONS.length === 12,
      detail: `${STORAGE_TYPE_DEFINITIONS.length} memory types prepared`,
    };

    const recordsRoot = path.join(storageRoot, "memory", "records");
    results.storageDirectories = {
      passed: STORAGE_TYPE_DEFINITIONS.every((t) => fs.existsSync(path.join(recordsRoot, t.subdirectory))),
      detail: recordsRoot,
    };

    const writeStart = Date.now();
    const stored = await engine.storeRecord({
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "Step 3B Validation Record",
      description: "Validation write test for Memory Storage Engine",
      source: "step-3b-validation",
      tags: ["validation", "step-3b"],
      keywords: ["storage", "memory"],
      relatedProject: "validation-project",
    });
    const writeMs = Date.now() - writeStart;

    results.writing = {
      passed: stored.success && Boolean(stored.record),
      detail: stored.success ? `Stored ${stored.record?.memoryId} in ${writeMs}ms` : stored.validation?.message ?? "failed",
    };

    results.validation = {
      passed: stored.validation?.valid === true,
      detail: "Write validation passed",
    };

    const invalid = await engine.storeRecord({
      memoryType: MemoryStorageType.Product,
      category: "",
      title: "",
      description: "",
      source: "",
    });
    results.validationRejection = {
      passed: !invalid.success && invalid.validation?.valid === false,
      detail: `${invalid.validation?.diagnostics.length ?? 0} validation diagnostic(s)`,
    };

    const duplicate = await engine.storeRecord({
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "Step 3B Validation Record",
      description: "Validation write test for Memory Storage Engine",
      source: "step-3b-validation",
      tags: ["validation", "step-3b"],
      keywords: ["storage", "memory"],
    });
    results.duplicateDetection = {
      passed: !duplicate.success && duplicate.validation?.code === StorageValidationCode.DuplicateRecord,
      detail: duplicate.validation?.message ?? "duplicate check",
    };

    const memoryId = stored.record!.memoryId;
    const updated = await engine.updateRecord(memoryId, {
      description: "Updated validation record",
      qualityScore: 98,
    });
    results.versionManagement = {
      passed: updated.success && updated.version === 2,
      detail: `Version ${updated.version}`,
    };

    const readStart = Date.now();
    const read = await engine.getRecord(memoryId);
    const readMs = Date.now() - readStart;

    results.reading = {
      passed: read.success && read.record?.version === 2,
      detail: `Read in ${readMs}ms`,
    };

    const integrity = engine.runIntegrityCheck();
    results.integrity = {
      passed: integrity.verified && integrity.recordsChecked >= 1,
      detail: `${integrity.recordsChecked} record(s) checked`,
    };

    results.logging = {
      passed: Boolean(engine.logger.getLogDirectory() && fs.existsSync(engine.logger.getLogDirectory()!)),
      detail: engine.logger.getLogDirectory() ?? "none",
    };

    const search = engine.searchMetadata("validation");
    results.metadataSearch = {
      passed: search.length >= 1,
      detail: `${search.length} result(s)`,
    };

    const report = engine.buildStatusReport();
    results.performance = {
      passed: report.performance.averageWriteMs < 5000,
      detail: `avg write ${report.performance.averageWriteMs}ms, avg read ${report.performance.averageReadMs}ms`,
    };

    results.readiness = {
      passed: report.readinessScore >= 85,
      detail: `Readiness ${report.readinessScore}/100`,
    };

    await core.stop("validation complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-3B-VALIDATION-REPORT.md");
    fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, writeMs, readMs), "utf8");

    console.log(buildReport(report, results, storageRoot, allPassed, writeMs, readMs));
    console.log("---");
    console.log(`Report written to: ${reportPath}`);

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
  status: MemoryStorageStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  writeMs: number,
  readMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3B Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3B — Memory Storage Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Memory Storage Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Storage Status** | ${status.storageStatus} |`,
    `| **Validation Status** | ${status.validationStatus} |`,
    `| **Integrity Status** | ${status.integrityStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Validation Results",
    "",
    "| Check | Status | Detail |",
    "|-------|--------|--------|",
    ...Object.entries(results).map(
      ([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`
    ),
    "",
    "## Write Performance",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Last Write | ${writeMs}ms |`,
    `| Average Write | ${status.performance.averageWriteMs}ms |`,
    `| Last Read | ${readMs}ms |`,
    `| Average Read | ${status.performance.averageReadMs}ms |`,
    `| Records Stored | ${status.recordCount} |`,
    `| Index Size | ${status.performance.indexSize} |`,
    "",
    "## Integrity Status",
    "",
    `- ${status.integrityStatus}`,
    `- Version management: ${status.versionManagement.enabled ? "enabled" : "disabled"} (${status.versionManagement.totalVersions} versions)`,
    `- Backup ready: ${status.backupReady ? "yes" : "no"}`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None — individual memory modules deferred to Phase 3C+"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3B Memory Storage Engine validation complete. Awaiting user approval before Step 3C.",
    "",
  ].join("\n");
}

void main();
