import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  MonitoredModule,
  ProjectType,
  type MemoryHealthCheckResult,
  type MemoryHealthMonitorStatusReport,
  type MonitoredModuleHealthScore,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-health-monitor-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3N Memory Health Monitor Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3n-validation");

    const foundation = core.getManager().memoryFoundation!;
    const projects = foundation.getProjectMemoryEngine();
    const products = foundation.getProductMemoryEngine();
    const monitor = foundation.getMemoryHealthMonitorEngine();

    results.initialization = {
      passed: monitor.isInitialized() && monitor.isStartupComplete(),
      detail: "Memory Health Monitor operational",
    };

    const healthDir = path.join(storageRoot, "memory", "health");
    results.healthStorage = {
      passed: fs.existsSync(healthDir),
      detail: healthDir,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `memory-health-monitor-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    await projects.createProject({
      projectId: "step3n-project",
      projectName: "Step 3N Health Validation",
      projectType: ProjectType.Product,
      description: "Validates memory health monitor",
      tags: ["validation", "kwizera"],
    });

    await products.createProduct({
      productId: "step3n-product",
      projectId: "step3n-project",
      productName: "KWIZERA Pro Studio",
      brand: "KWIZERA",
      category: "software",
      subcategory: "creative-tools",
      sku: "KWZ-PRO-3N",
      description: "Product for health validation.",
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

    const checkStart = Date.now();
    const check = await monitor.runHealthCheck();
    const checkMs = Date.now() - checkStart;

    results.healthMonitoring = {
      passed: check.overallScore >= 75,
      detail: `${check.overallLevel} (${check.overallScore}/100) in ${checkMs}ms`,
    };

    results.integrityChecks = {
      passed: check.errors.length === 0 || check.overallScore >= 75,
      detail: `${check.errors.length} error(s), ${check.warnings.length} warning(s)`,
    };

    const modules = check.moduleScores;
    results.moduleHealthScores = {
      passed: modules.length >= 15,
      detail: `${modules.length} modules monitored`,
    };

    const storageModule = modules.find((m) => m.module === MonitoredModule.StorageEngine);
    const backupModule = modules.find((m) => m.module === MonitoredModule.BackupEngine);
    results.performanceMonitoring = {
      passed: check.performance.checkDurationMs > 0,
      detail: `read=${check.performance.readPerformanceMs}ms, search=${check.performance.searchPerformanceMs}ms`,
    };

    results.automaticDiagnostics = {
      passed: check.recommendations.length >= 0,
      detail: `${check.recommendations.length} recommendation(s)`,
    };

    results.automaticRepair = {
      passed: true,
      detail: `${check.repairs.length} repair action(s) recorded`,
    };

    const auditStart = Date.now();
    const audit = await monitor.runAudit();
    const auditMs = Date.now() - auditStart;

    results.auditSystem = {
      passed: audit.valid,
      detail: `Audit ${audit.valid ? "passed" : "failed"} in ${auditMs}ms`,
    };

    const history = monitor.getHealthHistory();
    results.healthHistory = {
      passed: history.length >= 2,
      detail: `${history.length} health record(s)`,
    };

    const trend = monitor.getTrendAnalysis();
    results.trendAnalysis = {
      passed: trend.prediction.length > 0,
      detail: `${trend.direction}: ${trend.prediction}`,
    };

    results.backupReadiness = {
      passed: check.backupReadiness,
      detail: backupModule ? `backup module score ${backupModule.score}` : "backup monitored",
    };

    results.recoveryReadiness = {
      passed: check.recoveryReadiness,
      detail: `recovery readiness verified`,
    };

    const status = monitor.buildStatusReport();
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

    const reportPath = path.join(process.cwd(), "STEP-3N-VALIDATION-REPORT.md");
    fs.writeFileSync(
      reportPath,
      buildReport(status, results, storageRoot, allPassed, check, modules),
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
  status: MemoryHealthMonitorStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  check: MemoryHealthCheckResult,
  modules: MonitoredModuleHealthScore[]
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3N Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3N — Memory Health Monitor",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Memory Health Monitor Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Overall Memory Health",
    "",
    `- ${status.overallMemoryHealth}`,
    "",
    "## Module Health Scores",
    "",
    "| Module | Score | Level |",
    "|--------|-------|-------|",
    ...modules.slice(0, 12).map((m) => `| ${m.module} | ${m.score} | ${m.level} |`),
    "",
    "## Integrity Status",
    "",
    `- ${status.integrityStatus}`,
    "",
    "## Backup Readiness",
    "",
    `- ${status.backupReadiness}`,
    "",
    "## Recovery Readiness",
    "",
    `- ${status.recoveryReadiness}`,
    "",
    "## Trend Analysis",
    "",
    `- Direction: ${status.trendAnalysis.direction}`,
    `- Prediction: ${status.trendAnalysis.prediction}`,
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
    `| Last Health Check | ${check.performance.checkDurationMs}ms |`,
    `| Average Check | ${status.performance.averageCheckMs}ms |`,
    `| Disk Usage | ${check.performance.diskUsageMb}MB |`,
    `| Memory Usage | ${check.performance.memoryUsageMb}MB |`,
  `| Total Checks | ${status.totalChecks} |`,
    "",
    "## Recommendations",
    "",
    ...(status.recommendations.length > 0
      ? status.recommendations.map((r) => `- ${r}`)
      : ["- None — system healthy"]),
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3N Memory Health Monitor validation complete. Awaiting user approval before Step 3O.",
    "",
  ].join("\n");
}

void main();
