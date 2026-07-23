import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, KnowledgeAccessOperation, KnowledgeCategory, KnowledgeLifecycleState, KnowledgeSource, KnowledgeVerificationStatus, PREPARED_KNOWLEDGE_CATEGORIES, SUPPORTED_KNOWLEDGE_SOURCES, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-foundation-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4A Knowledge Foundation Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        const initStart = Date.now();
        await core.start("step-4a-validation");
        const initMs = Date.now() - initStart;
        const foundation = core.getManager().knowledgeFoundation;
        results.initialization = {
            passed: foundation.isInitialized() && foundation.isStartupComplete(),
            detail: foundation.isStartupComplete()
                ? `Knowledge Foundation ready in ${initMs}ms`
                : "Not initialized",
        };
        results.lifecycle = {
            passed: foundation.getLifecycleState() === KnowledgeLifecycleState.Ready,
            detail: `Lifecycle: ${foundation.getLifecycleState()}`,
        };
        const modules = foundation.getRegistry().getAllModules();
        results.registry = {
            passed: modules.length === PREPARED_KNOWLEDGE_CATEGORIES.length,
            detail: `${modules.length} knowledge categories prepared in registry`,
        };
        const registryPath = path.join(storageRoot, "knowledge", "registry", "knowledge-registry.json");
        results.registryPersistence = {
            passed: fs.existsSync(registryPath) && foundation.getRegistry().verifyChecksum(),
            detail: registryPath,
        };
        results.storage = {
            passed: fs.existsSync(foundation.getKnowledgeRoot()),
            detail: foundation.getKnowledgeRoot(),
        };
        const status = foundation.buildStatusReport();
        results.persistence = {
            passed: status.persistenceStatus.includes("survives") || status.storageStatus.includes("verified"),
            detail: status.persistenceStatus,
        };
        const integrity = foundation.getLastIntegrityResult();
        results.integrity = {
            passed: Boolean(integrity && integrity.checkedPaths > 0),
            detail: integrity?.verified ? "Integrity verified" : `${integrity?.issues.length ?? 0} issue(s)`,
        };
        const readAccess = await foundation.requestAccess({
            requesterId: "step-4a-validation",
            category: KnowledgeCategory.Product,
            operation: KnowledgeAccessOperation.Read,
        });
        results.accessRead = {
            passed: readAccess.granted,
            detail: readAccess.message,
        };
        const writeAccess = await foundation.requestAccess({
            requesterId: "step-4a-validation",
            category: KnowledgeCategory.Workflow,
            operation: KnowledgeAccessOperation.Write,
        });
        results.accessWrite = {
            passed: writeAccess.granted,
            detail: writeAccess.message,
        };
        const qualityValidation = foundation.validateKnowledge({
            qualityScore: 88,
            confidenceScore: 85,
            verificationStatus: KnowledgeVerificationStatus.Pending,
            source: KnowledgeSource.MemoryEngine,
            sourceRef: "memory-engine",
            versionHistory: [
                {
                    version: 1,
                    timestamp: new Date().toISOString(),
                    changeSummary: "Validation probe",
                    source: KnowledgeSource.MemoryEngine,
                },
            ],
            relationshipLinks: ["project-memory"],
        });
        results.qualityValidation = {
            passed: qualityValidation.valid && qualityValidation.qualityScore >= 75,
            detail: `Quality ${qualityValidation.qualityScore}, confidence ${qualityValidation.confidenceScore}`,
        };
        const moduleValidation = foundation.validateModule("product-knowledge");
        results.moduleQualityValidation = {
            passed: moduleValidation.valid || moduleValidation.issues.length === 0,
            detail: `Module validation for product-knowledge`,
        };
        const health = await foundation.runHealthCheck();
        results.health = {
            passed: health.score >= 80 && health.availability,
            detail: `Health score ${health.score} (${health.level})`,
        };
        const integration = status.integrationStatus;
        results.integration = {
            passed: integration.readyCount >= 8 && integration.memoryEngine,
            detail: `${integration.readyCount}/${integration.totalCount} integrations ready`,
        };
        results.knowledgeSources = {
            passed: SUPPORTED_KNOWLEDGE_SOURCES.length >= 10,
            detail: `${SUPPORTED_KNOWLEDGE_SOURCES.length} knowledge sources supported`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `knowledge-foundation-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const pluginEntry = core.getManager().registry.getEntry("knowledge-engine");
        results.pluginRegistration = {
            passed: pluginEntry?.status === "initialized",
            detail: `knowledge-engine slot: ${pluginEntry?.status}`,
        };
        results.memoryBridge = {
            passed: Boolean(core.getManager().memoryFoundation?.isStartupComplete()),
            detail: "Memory Engine bridge available for knowledge sources",
        };
        results.performance = {
            passed: status.performance.startupMs < 120000,
            detail: `startup ${status.performance.startupMs}ms, read ${status.performance.averageReadMs}ms`,
        };
        results.readiness = {
            passed: status.readinessScore === 100,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        await core.stop("step-4a-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4A-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(status, health, results, storageRoot, allPassed), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${status.readinessScore}/100`);
        console.log("Report written:", reportPath);
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
    return [
        "# KWIZERA AI STUDIO — Phase 4 Step 4A Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4A — Knowledge Foundation",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Knowledge Foundation Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Foundation Status** | ${status.foundationStatus} |`,
        `| **Lifecycle** | ${status.lifecycleState} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        "",
        "## Registry Status",
        "",
        `- ${status.registryStatus}`,
        `- Prepared categories: ${status.preparedCategories}`,
        `- Registered modules: ${status.registeredModules}`,
        "",
        "## Integration Status",
        "",
        `| System | Connected |`,
        `|--------|-----------|`,
        `| AI Core | ${status.integrationStatus.aiCore ? "✅" : "❌"} |`,
        `| Memory Engine | ${status.integrationStatus.memoryEngine ? "✅" : "❌"} |`,
        `| Decision Engine | ${status.integrationStatus.decisionEngine ? "✅" : "❌"} |`,
        `| Reasoning Engine | ${status.integrationStatus.reasoningEngine ? "✅" : "❌"} |`,
        `| Planning Engine | ${status.integrationStatus.planningEngine ? "✅" : "❌"} |`,
        `| Workflow Engine | ${status.integrationStatus.workflowEngine ? "✅" : "❌"} |`,
        `| Communication Bus | ${status.integrationStatus.communicationBus ? "✅" : "❌"} |`,
        `| State Manager | ${status.integrationStatus.stateManager ? "✅" : "❌"} |`,
        `| Recovery Engine | ${status.integrationStatus.recoveryEngine ? "✅" : "❌"} |`,
        `| Health Monitor | ${status.integrationStatus.healthMonitor ? "✅" : "❌"} |`,
        `| **Ready** | **${status.integrationStatus.readyCount}/${status.integrationStatus.totalCount}** |`,
        "",
        "## Validation Status",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Performance",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Startup | ${status.performance.startupMs}ms |`,
        `| Health Score | ${health.score}/100 |`,
        `| Read Performance | ${health.readPerformanceMs}ms |`,
        `| Write Performance | ${health.writePerformanceMs}ms |`,
        `| Validation Avg | ${status.performance.averageValidationMs}ms |`,
        `| Access Requests | ${status.performance.totalAccessRequests} |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None — foundation layer only; individual knowledge modules deferred to Phase 4B+"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 4A Knowledge Foundation validation complete. Awaiting user approval before Step 4B.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-knowledge-foundation.js.map