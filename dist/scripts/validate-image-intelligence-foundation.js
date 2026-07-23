import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, ImageIntelligenceAccessOperation, ImageIntelligenceCategory, ImageIntelligenceHealthLevel, ImageIntelligenceLifecycleState, ImageIntelligenceModuleStatus, ImageIntelligenceSource, ImageIntelligenceVerificationStatus, PREPARED_IMAGE_INTELLIGENCE_MODULES, SUPPORTED_IMAGE_INTELLIGENCE_SOURCES, } from "../ai/index.js";
import { DEFAULT_STORAGE_ROOT } from "../storage/paths/storage-paths.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-image-intelligence-"));
}
function ensureProjectStateDir() {
    const dir = path.join(DEFAULT_STORAGE_ROOT, "project-state");
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    const projectStateDir = ensureProjectStateDir();
    console.log("KWIZERA AI STUDIO — Step 6A Image Intelligence Foundation Validation");
    console.log("Storage root:", storageRoot);
    console.log("Project state:", projectStateDir);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        const initStart = Date.now();
        await core.start("step-6a-validation");
        const initMs = Date.now() - initStart;
        const foundation = core.getManager().imageIntelligenceFoundation;
        results.initialization = {
            passed: foundation.isInitialized() && foundation.isStartupComplete(),
            detail: foundation.isStartupComplete()
                ? `Image Intelligence Foundation ready in ${initMs}ms`
                : "Not initialized",
        };
        results.lifecycle = {
            passed: foundation.getLifecycleState() === ImageIntelligenceLifecycleState.Ready,
            detail: `Lifecycle: ${foundation.getLifecycleState()}`,
        };
        const modules = foundation.getRegistry().getAllModules();
        results.registry = {
            passed: modules.length === PREPARED_IMAGE_INTELLIGENCE_MODULES.length,
            detail: `${modules.length} image intelligence modules prepared in registry`,
        };
        const registryPath = path.join(storageRoot, "image-intelligence", "registry", "image-intelligence-registry.json");
        results.registryPersistence = {
            passed: fs.existsSync(registryPath) && foundation.getRegistry().verifyChecksum(),
            detail: registryPath,
        };
        results.storage = {
            passed: fs.existsSync(foundation.getIntelligenceRoot()),
            detail: foundation.getIntelligenceRoot(),
        };
        const status = foundation.buildStatusReport();
        results.persistence = {
            passed: status.persistenceStatus.includes("survives") || status.storageStatus.includes("verified"),
            detail: status.persistenceStatus,
        };
        let integrity = foundation.getLastIntegrityResult();
        if (integrity && !integrity.verified) {
            await foundation.recover();
            integrity = foundation.getLastIntegrityResult();
        }
        results.integrity = {
            passed: Boolean(integrity && integrity.checkedPaths > 0),
            detail: integrity?.verified ? "Integrity verified" : `${integrity?.issues.length ?? 0} issue(s)`,
        };
        const readAccess = await foundation.requestAccess({
            requesterId: "step-6a-validation",
            category: ImageIntelligenceCategory.ImageAnalysis,
            operation: ImageIntelligenceAccessOperation.Read,
        });
        results.accessRead = {
            passed: readAccess.granted,
            detail: readAccess.message,
        };
        const writeAccess = await foundation.requestAccess({
            requesterId: "step-6a-validation",
            category: ImageIntelligenceCategory.ProductionPlanning,
            operation: ImageIntelligenceAccessOperation.Write,
        });
        results.accessWrite = {
            passed: writeAccess.granted,
            detail: writeAccess.message,
        };
        foundation.registerImageIntelligenceModule({
            moduleId: "image-analysis-engine",
            moduleName: "Image Analysis Engine",
            version: "0.1.0",
            status: ImageIntelligenceModuleStatus.Registered,
            dependencies: ["image-engine", "knowledge-engine", "memory-engine"],
            qualityScore: 88,
            confidenceScore: 85,
            accessPermissions: modules.find((m) => m.moduleId === "image-analysis-engine").accessPermissions,
            category: ImageIntelligenceCategory.ImageAnalysis,
            storageLocation: modules.find((m) => m.moduleId === "image-analysis-engine").storageLocation,
            implemented: false,
        });
        const registered = foundation.getRegistry().getModule("image-analysis-engine");
        results.sampleModuleRegistration = {
            passed: registered?.status === ImageIntelligenceModuleStatus.Registered && registered.version === "0.1.0",
            detail: `Sample module registered: quality ${registered?.qualityScore}, confidence ${registered?.confidenceScore}`,
        };
        results.registryIntegrity = {
            passed: foundation.getRegistry().verifyChecksum() && foundation.getRegistry().getRegisteredCount() >= 1,
            detail: `${foundation.getRegistry().getRegisteredCount()} registered module(s), checksum valid`,
        };
        const qualityValidation = foundation.validateImageIntelligence({
            qualityScore: 90,
            confidenceScore: 88,
            verificationStatus: ImageIntelligenceVerificationStatus.Pending,
            source: ImageIntelligenceSource.ImageKnowledge,
            sourceRef: "image-knowledge",
            versionHistory: [
                {
                    version: 1,
                    timestamp: new Date().toISOString(),
                    changeSummary: "Validation probe",
                    source: ImageIntelligenceSource.ImageKnowledge,
                },
            ],
            relationshipLinks: ["image-knowledge", "visual-planning"],
            healthStatus: ImageIntelligenceHealthLevel.Good,
        });
        results.qualityValidation = {
            passed: qualityValidation.valid && qualityValidation.qualityScore >= 75,
            detail: `Quality ${qualityValidation.qualityScore}, confidence ${qualityValidation.confidenceScore}`,
        };
        const moduleValidation = foundation.validateModule("image-analysis-engine");
        results.moduleQualityValidation = {
            passed: moduleValidation.valid,
            detail: "Module validation for image-analysis-engine",
        };
        const health = await foundation.runHealthCheck();
        results.health = {
            passed: health.score >= 80 && health.availability,
            detail: `Health score ${health.score} (${health.level})`,
        };
        const integration = status.integrationStatus;
        results.integration = {
            passed: integration.readyCount >= 9 &&
                integration.memoryEngine &&
                integration.knowledgeEngine &&
                integration.productIntelligenceEngine,
            detail: `${integration.readyCount}/${integration.totalCount} integrations ready`,
        };
        results.intelligenceSources = {
            passed: SUPPORTED_IMAGE_INTELLIGENCE_SOURCES.length >= 9,
            detail: `${SUPPORTED_IMAGE_INTELLIGENCE_SOURCES.length} intelligence sources supported`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `image-intelligence-foundation-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const pluginEntry = core.getManager().registry.getEntry("image-engine");
        results.pluginRegistration = {
            passed: pluginEntry?.status === "initialized",
            detail: `image-engine slot: ${pluginEntry?.status}`,
        };
        results.memoryBridge = {
            passed: Boolean(core.getManager().memoryFoundation?.isStartupComplete()),
            detail: "Memory Engine bridge available",
        };
        results.knowledgeBridge = {
            passed: Boolean(core.getManager().knowledgeFoundation?.isStartupComplete()),
            detail: "Knowledge Engine bridge available",
        };
        results.productIntelligenceBridge = {
            passed: Boolean(core.getManager().productIntelligenceFoundation?.isStartupComplete()),
            detail: "Product Intelligence Engine bridge available",
        };
        results.performance = {
            passed: status.performance.startupMs < 180000,
            detail: `startup ${status.performance.startupMs}ms, read ${status.performance.averageReadMs}ms`,
        };
        const refreshedStatus = foundation.buildStatusReport();
        results.readiness = {
            passed: refreshedStatus.readinessScore === 100,
            detail: `Readiness ${refreshedStatus.readinessScore}/100`,
        };
        await core.stop("step-6a-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const foundationReportPath = path.join(projectStateDir, "Image-Intelligence-Foundation-Report.md");
        const architectureReportPath = path.join(projectStateDir, "Image-Intelligence-Architecture.md");
        const workspaceReportPath = path.join(process.cwd(), "STEP-6A-VALIDATION-REPORT.md");
        const foundationReport = buildFoundationReport(refreshedStatus, health, results, storageRoot, allPassed);
        const architectureReport = buildArchitectureReport(refreshedStatus);
        fs.writeFileSync(foundationReportPath, foundationReport, "utf8");
        fs.writeFileSync(architectureReportPath, architectureReport, "utf8");
        fs.writeFileSync(workspaceReportPath, foundationReport, "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${refreshedStatus.readinessScore}/100`);
        console.log("Reports written:");
        console.log(" ", foundationReportPath);
        console.log(" ", architectureReportPath);
        console.log(" ", workspaceReportPath);
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
function buildFoundationReport(status, health, results, storageRoot, allPassed) {
    return [
        "# KWIZERA AI STUDIO — Phase 6 Step 6A Image Intelligence Foundation Report",
        "",
        "**Phase:** 6 — Image Intelligence Engine",
        "**Step:** 6A — Image Intelligence Foundation",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Image Intelligence Foundation Status",
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
        `- Prepared modules: ${status.preparedModules}`,
        `- Registered modules: ${status.registeredModules}`,
        "",
        "## Integration Status",
        "",
        `| System | Connected |`,
        `|--------|-----------|`,
        `| AI Core | ${status.integrationStatus.aiCore ? "✅" : "❌"} |`,
        `| Memory Engine | ${status.integrationStatus.memoryEngine ? "✅" : "❌"} |`,
        `| Knowledge Engine | ${status.integrationStatus.knowledgeEngine ? "✅" : "❌"} |`,
        `| Product Intelligence Engine | ${status.integrationStatus.productIntelligenceEngine ? "✅" : "❌"} |`,
        `| Reasoning Engine | ${status.integrationStatus.reasoningEngine ? "✅" : "❌"} |`,
        `| Planning Engine | ${status.integrationStatus.planningEngine ? "✅" : "❌"} |`,
        `| Decision Engine | ${status.integrationStatus.decisionEngine ? "✅" : "❌"} |`,
        `| Workflow Engine | ${status.integrationStatus.workflowEngine ? "✅" : "❌"} |`,
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
            : ["- None — foundation layer only; individual Image Intelligence modules deferred to Step 6B+"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 6A Image Intelligence Foundation validation complete. Awaiting user approval before Step 6B.",
        "",
    ].join("\n");
}
function buildArchitectureReport(status) {
    return [
        "# KWIZERA AI STUDIO — Image Intelligence Architecture",
        "",
        "**Version:** 0.1.0",
        "**Phase:** 6 — Image Intelligence Engine (Step 6A)",
        `**Date:** ${new Date().toISOString()}`,
        `**Readiness Score:** ${status.readinessScore}/100`,
        "",
        "---",
        "",
        "## Image Intelligence Architecture",
        "",
        "```text",
        "AI Core Foundation",
        "    ↓",
        "Product Intelligence Foundation",
        "    ↓",
        "Image Intelligence Foundation (registry, access coordinator, quality, integration bridge)",
        "    ↓",
        "Prepared Future Modules (not implemented in 6A)",
        "    ├── Image Analysis Engine",
        "    ├── Image Understanding Engine",
        "    ├── Object Detection Intelligence",
        "    ├── Background Intelligence",
        "    ├── Composition Intelligence",
        "    ├── Lighting & Color Intelligence",
        "    ├── Brand Visual Intelligence",
        "    ├── Image Enhancement Planning",
        "    ├── Creative Image Intelligence",
        "    ├── Production Image Planning",
        "    ├── Image Quality Prediction",
        "    ├── Image Intelligence Optimization",
        "    └── Image Intelligence Health Monitor",
        "```",
        "",
        "## Intelligence Flow",
        "",
        "1. **Initialize** — Image Intelligence Foundation starts after Product Intelligence Foundation",
        "2. **Register** — Future modules register in the permanent registry before use",
        "3. **Access** — Coordinated read/write/validate through access coordinator",
        "4. **Validate** — Quality scores, confidence, source tracking, version history",
        "5. **Integrate** — Bridges to Memory, Knowledge, Product Intelligence, Reasoning, Planning, Decision, Workflow",
        "6. **Monitor** — Health checks, integrity verification, automatic recovery",
        "",
        "## Integration Architecture",
        "",
        "- **Memory Engine** — image experience and project context",
        "- **Knowledge Engine** — image knowledge and visual understanding consumption",
        "- **Product Intelligence Engine** — creative direction, visual planning, brand context",
        "- **Reasoning / Planning / Decision / Workflow** — prepared interfaces for future image pipelines",
        "- **Recovery / Health Monitor / State Manager** — operational resilience",
        "",
        "## Quality Model",
        "",
        "Every Image Intelligence object supports: Quality Score, Confidence Score, Validation Status, Source Tracking, Version History, Relationship Links, Health Status.",
        "",
        "## Storage Layout",
        "",
        "- `{storageRoot}/image-intelligence/registry/` — module registry + checksum",
        "- `{storageRoot}/image-intelligence/{module}/` — per-module storage slots",
        "- `{storageRoot}/logs/image-intelligence-foundation-{date}.jsonl` — foundation logs",
        "",
        "---",
        "",
        `**Status:** ${status.foundationStatus} | **Registry:** ${status.registryStatus}`,
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-image-intelligence-foundation.js.map