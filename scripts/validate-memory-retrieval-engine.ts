import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  MemoryStorageType,
  SearchMode,
  type MemoryRetrievalStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-retrieval-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3C Memory Retrieval Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3c-validation");

    const foundation = core.getManager().memoryFoundation!;
    const storage = foundation.getStorageEngine();
    const engine = foundation.getRetrievalEngine();

    results.initialization = {
      passed: engine.isInitialized() && engine.isStartupComplete(),
      detail: engine.isStartupComplete() ? "Retrieval Engine operational" : "Not ready",
    };

    await storage.storeRecord({
      memoryId: "step3c-project",
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "Step 3C Validation Project",
      description: "Project memory for retrieval validation",
      source: "step-3c-validation",
      tags: ["validation", "retrieval"],
      keywords: ["project", "kwizera"],
      relatedProject: "step3c-project",
    });

    await storage.storeRecord({
      memoryId: "step3c-marketing",
      memoryType: MemoryStorageType.Marketing,
      category: "marketing",
      title: "Step 3C Marketing Campaign",
      description: "Marketing memory linked to validation project",
      source: "step-3c-validation",
      tags: ["validation", "marketing"],
      relatedProject: "step3c-project",
    });

    await storage.storeRecord({
      memoryId: "step3c-learning",
      memoryType: MemoryStorageType.Learning,
      category: "learning",
      title: "Step 3C Learning Record",
      description: "Learning insights from validation",
      source: "step-3c-validation",
      keywords: ["learning", "validation"],
      qualityScore: 92,
    });

    const searchStart = Date.now();
    const search = await engine.search({
      mode: SearchMode.Hybrid,
      text: "validation",
      limit: 10,
    });
    const searchMs = Date.now() - searchStart;

    results.searching = {
      passed: search.success && search.results.length >= 3,
      detail: `${search.results.length} results in ${searchMs}ms`,
    };

    results.ranking = {
      passed:
        search.results.length >= 2 &&
        search.results[0].ranking.compositeScore >= search.results[1].ranking.compositeScore,
      detail: `Top score ${search.results[0]?.ranking.compositeScore ?? 0}`,
    };

    const retrieveStart = Date.now();
    const retrieved = await engine.retrieve("step3c-project");
    const retrieveMs = Date.now() - retrieveStart;

    results.retrieval = {
      passed: retrieved.success && retrieved.record?.memoryId === "step3c-project",
      detail: `Retrieved in ${retrieveMs}ms`,
    };

    results.relatedMemoryDetection = {
      passed: retrieved.relatedMemories.length >= 1,
      detail: `${retrieved.relatedMemories.length} related memory(ies)`,
    };

    const cached = await engine.retrieve("step3c-project");
    results.caching = {
      passed: cached.fromCache === true,
      detail: `Cache hit rate ${engine.buildStatusReport().cacheStatus.hitRate}%`,
    };

    results.validation = {
      passed: retrieved.diagnostics.length === 0,
      detail: "Pre-retrieval validation passed",
    };

    const invalid = await engine.retrieve("nonexistent-memory-id");
    results.validationFailure = {
      passed: !invalid.success && invalid.recoverySuggestion !== undefined,
      detail: invalid.recoverySuggestion ?? "no suggestion",
    };

    results.logging = {
      passed: Boolean(engine.logger.getLogDirectory() && fs.existsSync(engine.logger.getLogDirectory()!)),
      detail: engine.logger.getLogDirectory() ?? "none",
    };

    const report = engine.buildStatusReport();
    results.performance = {
      passed: searchMs < 10000 && retrieveMs < 5000,
      detail: `search ${searchMs}ms, retrieve ${retrieveMs}ms`,
    };

    results.readiness = {
      passed: report.readinessScore >= 85,
      detail: `Readiness ${report.readinessScore}/100`,
    };

    await core.stop("validation complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-3C-VALIDATION-REPORT.md");
    fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, searchMs, retrieveMs), "utf8");

    console.log(buildReport(report, results, storageRoot, allPassed, searchMs, retrieveMs));
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
  status: MemoryRetrievalStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  searchMs: number,
  retrieveMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3C Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3C — Memory Retrieval Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Retrieval Engine Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Validation Status** | ${status.validationStatus} |`,
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
    "## Search Performance",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Last Search | ${searchMs}ms |`,
    `| Average Search | ${status.searchPerformance.averageSearchMs}ms |`,
    `| Last Retrieval | ${retrieveMs}ms |`,
    `| Average Retrieval | ${status.searchPerformance.averageRetrievalMs}ms |`,
  "",
    "## Ranking Quality",
    "",
    `- ${status.rankingQuality}`,
    `- Total searches: ${status.totalSearches}`,
    `- Total retrievals: ${status.totalRetrievals}`,
    "",
    "## Cache Status",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Cache Size | ${status.cacheStatus.size} |`,
    `| Hits | ${status.cacheStatus.hits} |`,
    `| Misses | ${status.cacheStatus.misses} |`,
    `| Hit Rate | ${status.cacheStatus.hitRate}% |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None — individual memory modules deferred to Phase 3D+"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3C Memory Retrieval Engine validation complete. Awaiting user approval before Step 3D.",
    "",
  ].join("\n");
}

void main();
