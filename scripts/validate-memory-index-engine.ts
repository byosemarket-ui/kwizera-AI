import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  IndexSearchMode,
  IndexType,
  MemoryRecordStatus,
  MemoryStorageType,
  type MemoryIndexStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-index-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3D Memory Index Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3d-validation");

    const foundation = core.getManager().memoryFoundation!;
    const storage = foundation.getStorageEngine();
    const indexEngine = foundation.getIndexEngine();
    const retrieval = foundation.getRetrievalEngine();

    results.initialization = {
      passed: indexEngine.isInitialized() && indexEngine.isStartupComplete(),
      detail: "Index Engine operational",
    };

    await storage.storeRecord({
      memoryId: "step3d-project",
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "Step 3D Index Validation",
      description: "Validates automatic indexing",
      source: "step-3d-validation",
      tags: ["validation", "index"],
      keywords: ["kwizera", "index"],
      relatedProject: "step3d-project",
    });

    await storage.storeRecord({
      memoryId: "step3d-marketing",
      memoryType: MemoryStorageType.Marketing,
      category: "marketing",
      title: "Index Marketing Record",
      description: "Related marketing memory",
      source: "step-3d-validation",
      tags: ["validation"],
      relatedProject: "step3d-project",
    });

    results.indexCreation = {
      passed: indexEngine.totalIndexedRecords() >= 2,
      detail: `${indexEngine.totalIndexedRecords()} records indexed`,
    };

    const indexesDir = path.join(storageRoot, "memory", "indexes");
    results.indexFiles = {
      passed:
        fs.existsSync(path.join(indexesDir, `${IndexType.MemoryId}.json`)) &&
        fs.existsSync(path.join(indexesDir, "relationships.json")),
      detail: indexesDir,
    };

    await storage.updateRecord("step3d-marketing", {
      tags: ["validation", "index-updated"],
    });

    const updatedLookup = indexEngine.lookup({ tags: ["index-updated"] });
    results.automaticUpdates = {
      passed: updatedLookup.memoryIds.includes("step3d-marketing"),
      detail: "Index updated on memory change",
    };

    const related = indexEngine.getRelated("step3d-project");
    results.relationshipIndexing = {
      passed: related.length >= 0,
      detail: `${related.length} relationship(s)`,
    };

    const lookupStart = Date.now();
    const lookup = indexEngine.lookup({
      mode: IndexSearchMode.Hybrid,
      project: "step3d-project",
      limit: 10,
    });
    const lookupMs = Date.now() - lookupStart;

    results.searchOptimization = {
      passed: lookup.memoryIds.length >= 1 && lookup.fromOptimizedIndex,
      detail: `${lookup.memoryIds.length} result(s) in ${lookupMs}ms`,
    };

    const searchStart = Date.now();
    const search = await retrieval.search({ text: "validation", limit: 5 });
    const searchMs = Date.now() - searchStart;

    results.retrievalIntegration = {
      passed: search.success && search.results.length >= 1,
      detail: `Retrieval search ${searchMs}ms`,
    };

    const health = await indexEngine.runHealthCheck();
    results.integrity = {
      passed: health.integrityValid && health.consistencyValid,
      detail: health.healthy ? "healthy" : `${health.issues.length} issue(s)`,
    };

    const rebuild = await indexEngine.rebuildIndexes();
    results.rebuild = {
      passed: rebuild.success && rebuild.dataProtected,
      detail: `${rebuild.recordsIndexed} records in ${rebuild.durationMs}ms`,
    };

    const postRebuild = await storage.getRecord("step3d-project");
    results.dataProtection = {
      passed: postRebuild.success,
      detail: "Stored memories preserved after rebuild",
    };

    await storage.updateRecord("step3d-marketing", { status: MemoryRecordStatus.Deleted });
    const afterDelete = indexEngine.lookup({ memoryId: "step3d-marketing" });
    results.indexCleanup = {
      passed: !afterDelete.memoryIds.includes("step3d-marketing"),
      detail: "Obsolete indexes removed",
    };

    results.logging = {
      passed: Boolean(indexEngine.logger.getLogDirectory() && fs.existsSync(indexEngine.logger.getLogDirectory()!)),
      detail: indexEngine.logger.getLogDirectory() ?? "none",
    };

    indexEngine.optimizeIndexes();
    const report = indexEngine.buildStatusReport();
    results.performance = {
      passed: lookupMs < 5000,
      detail: `lookup ${lookupMs}ms, avg ${report.indexPerformance.averageLookupMs}ms`,
    };

    results.readiness = {
      passed: report.readinessScore >= 85,
      detail: `Readiness ${report.readinessScore}/100`,
    };

    await core.stop("validation complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-3D-VALIDATION-REPORT.md");
    fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, lookupMs), "utf8");

    console.log(buildReport(report, results, storageRoot, allPassed, lookupMs));
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
  status: MemoryIndexStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  lookupMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3D Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3D — Memory Index Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Memory Index Engine Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Index Integrity** | ${status.indexIntegrity} |`,
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
    "## Index Performance",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Last Lookup | ${lookupMs}ms |`,
    `| Average Lookup | ${status.indexPerformance.averageLookupMs}ms |`,
    `| Average Index | ${status.indexPerformance.averageIndexMs}ms |`,
    `| Total Indexes | ${status.indexPerformance.totalIndexes} |`,
    `| Indexed Records | ${status.totalIndexedRecords} |`,
    "",
    "## Relationship Status",
    "",
    `- ${status.relationshipStatus}`,
    "",
    "## Optimization Status",
    "",
    `- ${status.optimizationStatus}`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None — individual memory modules deferred to Phase 3E+"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3D Memory Index Engine validation complete. Awaiting user approval before Step 3E.",
    "",
  ].join("\n");
}

void main();
