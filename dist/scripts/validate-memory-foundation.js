import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, MemoryAccessOperation, MemoryCategory, MemoryLifecycleState, PREPARED_MEMORY_CATEGORIES, PROTECTED_DATA_CATEGORIES, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-memory-foundation-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 3A Memory Foundation Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        const initStart = Date.now();
        await core.start("step-3a-validation");
        const initMs = Date.now() - initStart;
        const foundation = core.getManager().memoryFoundation;
        results.initialization = {
            passed: foundation.isInitialized() && foundation.isStartupComplete(),
            detail: foundation.isStartupComplete()
                ? `Memory Foundation ready in ${initMs}ms`
                : "Not initialized",
        };
        results.lifecycle = {
            passed: foundation.getLifecycleState() === MemoryLifecycleState.Ready,
            detail: `Lifecycle: ${foundation.getLifecycleState()}`,
        };
        const modules = foundation.getRegistry().getAllModules();
        results.registry = {
            passed: modules.length === PREPARED_MEMORY_CATEGORIES.length,
            detail: `${modules.length} memory categories prepared in registry`,
        };
        const registryPath = path.join(storageRoot, "memory", "registry", "memory-registry.json");
        results.registryPersistence = {
            passed: fs.existsSync(registryPath) && foundation.getRegistry().verifyChecksum(),
            detail: registryPath,
        };
        results.storage = {
            passed: fs.existsSync(foundation.getMemoryRoot()),
            detail: foundation.getMemoryRoot(),
        };
        const persistence = foundation.buildStatusReport();
        results.persistence = {
            passed: persistence.persistenceStatus.includes("survives") || persistence.storageStatus.includes("verified"),
            detail: persistence.persistenceStatus,
        };
        const integrity = foundation.getLastIntegrityResult();
        results.integrity = {
            passed: Boolean(integrity && integrity.checkedPaths > 0),
            detail: integrity?.verified ? "Integrity verified" : `${integrity?.issues.length ?? 0} issue(s)`,
        };
        const access = await foundation.requestAccess({
            requesterId: "step-3a-validation",
            category: MemoryCategory.Persistent,
            operation: MemoryAccessOperation.Read,
        });
        results.accessCoordination = {
            passed: access.granted,
            detail: access.message,
        };
        const health = await foundation.runHealthCheck();
        results.health = {
            passed: health.score >= 80 && health.availability,
            detail: `Health score ${health.score} (${health.level})`,
        };
        results.logging = {
            passed: Boolean(foundation.logger.getLogDirectory() && fs.existsSync(foundation.logger.getLogDirectory())),
            detail: foundation.logger.getLogDirectory() ?? "none",
        };
        const backupPath = await foundation.createBackup("validation");
        results.backup = {
            passed: fs.existsSync(backupPath),
            detail: backupPath,
        };
        results.protectedCategories = {
            passed: PROTECTED_DATA_CATEGORIES.length >= 10,
            detail: `${PROTECTED_DATA_CATEGORIES.length} protected data categories`,
        };
        const pluginEntry = core.getManager().registry.getEntry("memory-engine");
        results.pluginRegistration = {
            passed: pluginEntry?.status === "initialized",
            detail: `memory-engine slot: ${pluginEntry?.status}`,
        };
        const report = foundation.buildStatusReport();
        results.performance = {
            passed: report.performance.startupMs < 30000,
            detail: `startup ${report.performance.startupMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore >= 85,
            detail: `Readiness ${report.readinessScore}/100`,
        };
        await core.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-3A-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(report, health, results, storageRoot, allPassed), "utf8");
        console.log(buildReport(report, health, results, storageRoot, allPassed));
        console.log("---");
        console.log(`Report written to: ${reportPath}`);
        if (useTemp && fs.existsSync(storageRoot)) {
            fs.rmSync(storageRoot, { recursive: true, force: true });
        }
        process.exit(allPassed ? 0 : 1);
    }
    catch (error) {
        console.error("Validation failed:", error);
        process.exit(1);
    }
}
function buildReport(status, health, results, storageRoot, allPassed) {
    const lines = [
        "# KWIZERA AI STUDIO — Phase 3 Step 3A Validation Report",
        "",
        "**Phase:** 3 — Persistent Memory Foundation",
        "**Step:** 3A — Persistent Memory Foundation",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Memory Foundation Status",
        "",
        `| Field | Value |`,
        `|-------|-------|`,
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Foundation Status** | ${status.foundationStatus} |`,
        `| **Lifecycle** | ${status.lifecycleState} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        "",
        "## Engineering Summary",
        "",
        "| Area | Status | Detail |",
        "|------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Storage Status",
        "",
        `- **Memory Root:** ${status.storageStatus}`,
        `- **Persistence:** ${status.persistenceStatus}`,
        `- **Prepared Categories:** ${status.preparedCategories}`,
        "",
        "## Registry Status",
        "",
        `- ${status.registryStatus}`,
        "",
        "## Integrity Status",
        "",
        `- ${status.integrityStatus}`,
        "",
        "## Performance",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Startup | ${status.performance.startupMs}ms |`,
        `| Health Score | ${health.score}/100 |`,
        `| Read Performance | ${health.readPerformanceMs}ms |`,
        `| Write Performance | ${health.writePerformanceMs}ms |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None — foundation layer only; individual memory modules deferred to Phase 3B+"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 3A Memory Foundation validation complete. Awaiting user approval before Step 3B.",
        "",
    ];
    return lines.join("\n");
}
void main();
//# sourceMappingURL=validate-memory-foundation.js.map