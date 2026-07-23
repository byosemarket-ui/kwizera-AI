import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  ProjectType,
  type MemoryOptimizationStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-optimization-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3K Memory Optimization Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3k-validation");

    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const retrieval = foundation.getRetrievalEngine();
    const optimization = foundation.getMemoryOptimizationEngine();

    results.initialization = {
      passed: optimization.isInitialized() && optimization.isStartupComplete(),
      detail: "Memory Optimization Engine operational",
    };

    const optimizationDir = path.join(storageRoot, "memory", "optimization");
    results.optimizationDirectories = {
      passed: fs.existsSync(optimizationDir),
      detail: optimizationDir,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `memory-optimization-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    await projects.createProject({
      projectId: "step3k-project",
      projectName: "Step 3K Optimization Validation",
      projectType: ProjectType.Product,
      description: "Validates memory optimization engine",
      tags: ["validation", "kwizera"],
    });

    await products.createProduct({
      productId: "step3k-product",
      projectId: "step3k-project",
      productName: "KWIZERA Pro Studio",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-PRO-3K",
      description: "Product for memory optimization validation.",
      features: ["AI workflow", "Local-first storage"],
      specifications: { version: "1.0", platform: "Windows" },
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
      tags: ["software", "kwizera", "validation"],
    });

    const analysisStart = Date.now();
    const analysis = await optimization.analyzeMemory();
    const analysisMs = Date.now() - analysisStart;

    results.memoryAnalysis = {
      passed: analysis.totalRecords > 0 && analysis.indexQualityScore > 0,
      detail: `${analysis.totalRecords} records, index quality ${analysis.indexQualityScore}`,
    };

    const tiers = optimization.classifyTiers();
    results.memoryTiers = {
      passed: tiers.length > 0,
      detail: `${tiers.length} tier assignment(s)`,
    };

    const duplicates = optimization.detectDuplicates();
    results.duplicateDetection = {
      passed: Array.isArray(duplicates),
      detail: `${duplicates.length} duplicate group(s) detected`,
    };

    const recoveryPoint = optimization.createRecoveryPoint("step-3k-validation");
    results.recovery = {
      passed: recoveryPoint.recoveryPointId.startsWith("rp-"),
      detail: `Recovery point ${recoveryPoint.recoveryPointId}`,
    };

    await retrieval.retrieve("step3k-product");
    await retrieval.retrieve("step3k-product");
    await retrieval.retrieve("step3k-product");

    const cacheStart = Date.now();
    const cacheResult = await optimization.optimizeCache();
    const cacheMs = Date.now() - cacheStart;

    results.cacheOptimization = {
      passed: cacheResult.warmed > 0,
      detail: `Warmed ${cacheResult.warmed} entries in ${cacheMs}ms`,
    };

    const optimizeStart = Date.now();
    const optimizeResult = await optimization.optimize();
    const optimizeMs = Date.now() - optimizeStart;

    results.optimization = {
      passed: optimizeResult.success,
      detail: `${optimizeResult.steps.length} step(s) in ${optimizeMs}ms`,
    };

    results.indexOptimization = {
      passed: optimizeResult.steps.some((s) => s.strategy === "index" && s.success),
      detail: "Index optimization step completed",
    };

    results.relationshipOptimization = {
      passed: optimizeResult.steps.some((s) => s.strategy === "relationship" && s.success),
      detail: "Relationship optimization step completed",
    };

    const integrity = await optimization.verifyIntegrity();
    results.integrity = {
      passed: integrity.valid,
      detail: integrity.diagnostics.length === 0 ? "All checks passed" : integrity.diagnostics.join("; "),
    };

    const searchStart = Date.now();
    const search = await retrieval.search({ text: "KWIZERA", limit: 5 });
    const searchMs = Date.now() - searchStart;

    results.searchPerformance = {
      passed: search.results.length > 0,
      detail: `${search.results.length} result(s) in ${searchMs}ms`,
    };

    const retrieveStart = Date.now();
    const retrieved = await retrieval.retrieve("step3k-product");
    const retrieveMs = Date.now() - retrieveStart;

    results.retrievalPerformance = {
      passed: retrieved.success,
      detail: `Retrieved in ${retrieveMs}ms`,
    };

    const status = optimization.buildStatusReport();
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

    const reportPath = path.join(process.cwd(), "STEP-3K-VALIDATION-REPORT.md");
    fs.writeFileSync(
      reportPath,
      buildReport(status, results, storageRoot, allPassed, analysisMs, optimizeMs, searchMs, retrieveMs),
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
  status: MemoryOptimizationStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  analysisMs: number,
  optimizeMs: number,
  searchMs: number,
  retrieveMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3K Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3K — Memory Optimization Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Memory Optimization Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Performance Improvement",
    "",
    `- ${status.performanceImprovement}`,
    "",
    "## Storage Efficiency",
    "",
    `- ${status.storageEfficiency}`,
    "",
    "## Integrity Status",
    "",
    `- ${status.integrityStatus}`,
    "",
    "## Recovery Status",
    "",
    `- ${status.recoveryStatus}`,
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
    `| Memory Analysis | ${analysisMs}ms |`,
    `| Full Optimization | ${optimizeMs}ms |`,
    `| Search | ${searchMs}ms |`,
    `| Retrieval | ${retrieveMs}ms |`,
    `| Average Optimization | ${status.performance.averageOptimizationMs}ms |`,
    `| Average Analysis | ${status.performance.averageAnalysisMs}ms |`,
    `| Total Optimizations | ${status.totalOptimizations} |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3K Memory Optimization Engine validation complete. Awaiting user approval before Step 3L.",
    "",
  ].join("\n");
}

void main();
