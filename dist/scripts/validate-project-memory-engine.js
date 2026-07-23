import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, MemoryStorageType, ProjectStatus, ProjectType, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-project-memory-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 3F Project Memory Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-3f-validation");
        const foundation = core.getManager().memoryFoundation;
        const projects = foundation.getProjectMemoryEngine();
        const storage = foundation.getStorageEngine();
        const indexEngine = foundation.getIndexEngine();
        const learning = foundation.getLearningMemoryEngine();
        results.initialization = {
            passed: projects.isInitialized() && projects.isStartupComplete(),
            detail: "Project Memory Engine operational",
        };
        const projectDir = path.join(storageRoot, "memory", "projects");
        results.projectDirectories = {
            passed: fs.existsSync(projectDir),
            detail: projectDir,
        };
        const createStart = Date.now();
        const createResult = await projects.createProject({
            projectId: "step3f-project",
            projectName: "Step 3F Validation Project",
            projectType: ProjectType.Promotional,
            description: "Validates project memory creation, storage, versioning, and recovery for KWIZERA AI STUDIO.",
            targetAudience: "Marketing teams",
            marketingGoal: "Product launch awareness",
            brandInformation: { name: "KWIZERA", colors: ["#1a1a2e"] },
            language: "en",
            tags: ["validation", "kwizera", "brand"],
            keywords: ["promo", "launch"],
        });
        const createMs = Date.now() - createStart;
        results.projectCreation = {
            passed: createResult.success && createResult.checkpointCreated,
            detail: `Created in ${createMs}ms, version ${createResult.version}`,
        };
        const project = await projects.getProject("step3f-project");
        results.projectStorage = {
            passed: project !== null && project.projectName === "Step 3F Validation Project",
            detail: `Quality score ${project?.scores.qualityScore}`,
        };
        const historyFile = path.join(projectDir, "project-history.jsonl");
        results.historyPersistence = {
            passed: fs.existsSync(historyFile) && projects.getProjectHistory("step3f-project").length >= 1,
            detail: historyFile,
        };
        const updateResult = await projects.updateProject("step3f-project", {
            status: ProjectStatus.Processing,
            completionPercentage: 55,
            assets: {
                images: ["assets/logo.png"],
                scripts: ["scripts/promo-v1.txt"],
                generatedVideos: ["drafts/promo-preview.mp4"],
            },
            workflowHistory: {
                workflowHistory: ["wf-step-1", "wf-step-2"],
                aiDecisions: ["dec-001"],
                taskHistory: ["task-render"],
            },
            workflowState: { currentPhase: "render" },
            draftState: { title: "KWIZERA Launch" },
        });
        results.projectVersioning = {
            passed: updateResult.success && updateResult.version >= 2,
            detail: `Version ${updateResult.version}, checkpoint ${updateResult.checkpointCreated}`,
        };
        const comparison = await projects.compareVersions("step3f-project", 1, 2);
        results.versionComparison = {
            passed: comparison.differences.length > 0,
            detail: comparison.differences.join("; "),
        };
        await storage.storeRecord({
            memoryId: "step3f-marketing",
            memoryType: MemoryStorageType.Marketing,
            category: "marketing",
            title: "3F Marketing Campaign",
            description: "Related marketing memory",
            source: "step-3f-validation",
            tags: ["validation", "kwizera"],
            relatedProject: "step3f-project",
        });
        await projects.updateProject("step3f-project", { completionPercentage: 60 });
        const updated = await projects.getProject("step3f-project");
        results.relationships = {
            passed: (updated?.relatedMemories.length ?? 0) >= 1,
            detail: `${updated?.relatedMemories.length ?? 0} linked memory(s)`,
        };
        await projects.updateProject("step3f-project", {
            status: ProjectStatus.Paused,
            completionPercentage: 5,
        });
        const restoreStart = Date.now();
        const restoreResult = await projects.restoreProject("step3f-project");
        const restoreMs = Date.now() - restoreStart;
        results.projectRestoration = {
            passed: restoreResult.success && restoreResult.status === ProjectStatus.Recovered,
            detail: `Restored in ${restoreMs}ms from ${restoreResult.restoredFrom}`,
        };
        const indexed = indexEngine.lookup({ project: "step3f-project" });
        results.indexIntegration = {
            passed: indexed.memoryIds.length >= 2,
            detail: `${indexed.memoryIds.length} indexed record(s)`,
        };
        const searchResults = projects.searchProjects({ tags: ["validation"], name: "3F" });
        results.searchSupport = {
            passed: searchResults.length >= 1,
            detail: `${searchResults.length} project(s) found`,
        };
        await projects.updateProject("step3f-project", {
            status: ProjectStatus.Exported,
            exportRecord: { exportId: "exp-001", format: "mp4", timestamp: new Date().toISOString() },
        });
        results.exportTracking = {
            passed: (await projects.getProject("step3f-project")).exportHistory.length >= 1,
            detail: "Export history recorded",
        };
        const logDir = path.join(storageRoot, "logs");
        const logFiles = fs.existsSync(logDir)
            ? fs.readdirSync(logDir).filter((f) => f.startsWith("project-memory-engine"))
            : [];
        results.logging = {
            passed: logFiles.length > 0,
            detail: logDir,
        };
        const report = projects.buildStatusReport();
        results.performance = {
            passed: createMs < 5000 && restoreMs < 5000,
            detail: `create ${createMs}ms, restore ${restoreMs}ms, avg save ${report.performance.averageSaveMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore >= 85,
            detail: `Readiness ${report.readinessScore}/100, ${report.totalProjects} project(s)`,
        };
        void learning;
        await core.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-3F-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, createMs, restoreMs), "utf8");
        console.log(buildReport(report, results, storageRoot, allPassed, createMs, restoreMs));
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
function buildReport(status, results, storageRoot, allPassed, createMs, restoreMs) {
    return [
        "# KWIZERA AI STUDIO — Phase 3 Step 3F Validation Report",
        "",
        "**Phase:** 3 — Persistent Memory",
        "**Step:** 3F — Project Memory Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Project Memory Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        "",
        "## Project Storage Status",
        "",
        `- ${status.projectStorageStatus}`,
        `- Active: ${status.activeProjects} | Archived: ${status.archivedProjects}`,
        "",
        "## Version Management Status",
        "",
        `- ${status.versionManagementStatus}`,
        "",
        "## Recovery Status",
        "",
        `- ${status.recoveryStatus}`,
        "",
        "## Validation Results",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Performance",
        "",
        `| Metric | Value |`,
        `|--------|-------|`,
        `| Project Creation | ${createMs}ms |`,
        `| Project Restoration | ${restoreMs}ms |`,
        `| Average Save | ${status.performance.averageSaveMs}ms |`,
        `| Average Load | ${status.performance.averageLoadMs}ms |`,
        `| Total Versions | ${status.performance.totalVersions} |`,
        `| Total Checkpoints | ${status.performance.totalCheckpoints} |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 3F Project Memory Engine validation complete. Awaiting user approval before Step 3G.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-project-memory-engine.js.map