import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, KnowledgeStorageType, KnowledgeStorageValidationCode, KnowledgeVerificationStatus, KNOWLEDGE_STORAGE_TYPE_DEFINITIONS, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-storage-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 4B Knowledge Storage Engine Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const results = {};
    try {
        const core = createAiCore({ storageRootOverride: storageRoot });
        await core.start("step-4b-validation");
        const engine = core.getManager().knowledgeFoundation.getStorageEngine();
        results.initialization = {
            passed: engine.isInitialized() && engine.isStartupComplete(),
            detail: engine.isStartupComplete() ? "Knowledge Storage Engine operational" : "Not ready",
        };
        results.storageInfrastructure = {
            passed: KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.length === 13,
            detail: `${KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.length} knowledge types prepared`,
        };
        const recordsRoot = path.join(storageRoot, "knowledge", "records");
        results.storageDirectories = {
            passed: KNOWLEDGE_STORAGE_TYPE_DEFINITIONS.every((t) => fs.existsSync(path.join(recordsRoot, t.subdirectory))),
            detail: recordsRoot,
        };
        const writeStart = Date.now();
        const stored = await engine.storeRecord({
            knowledgeType: KnowledgeStorageType.Product,
            category: "product",
            title: "Step 4B Validation Knowledge",
            description: "Validation write test for Knowledge Storage Engine with product intelligence data.",
            summary: "Product knowledge validation record",
            source: "step-4b-validation",
            tags: ["validation", "step-4b", "product"],
            keywords: ["storage", "knowledge", "product"],
            relatedMemory: ["project-memory"],
            qualityScore: 88,
            confidenceScore: 85,
            sourceReliability: 90,
            verificationStatus: KnowledgeVerificationStatus.Pending,
        });
        const writeMs = Date.now() - writeStart;
        results.knowledgeStorage = {
            passed: stored.success && Boolean(stored.record),
            detail: stored.success ? `Stored ${stored.record?.knowledgeId} in ${writeMs}ms` : stored.validation?.message ?? "failed",
        };
        results.validation = {
            passed: stored.validation?.valid === true,
            detail: "Write validation passed",
        };
        results.classification = {
            passed: Boolean(stored.record?.classification.topic),
            detail: `Topic: ${stored.record?.classification.topic}, importance: ${stored.record?.classification.importance}`,
        };
        const invalid = await engine.storeRecord({
            knowledgeType: KnowledgeStorageType.Technical,
            category: "",
            title: "",
            description: "",
            source: "",
        });
        results.validationRejection = {
            passed: !invalid.success && invalid.validation?.valid === false,
            detail: `${invalid.validation?.diagnostics.length ?? 0} validation diagnostic(s)`,
        };
        const unverifiedTrusted = await engine.storeRecord({
            knowledgeType: KnowledgeStorageType.Business,
            category: "business",
            title: "Low Quality Trusted Attempt",
            description: "Should reject verified status on low quality",
            source: "step-4b-validation",
            qualityScore: 40,
            confidenceScore: 30,
            verificationStatus: KnowledgeVerificationStatus.Verified,
        });
        results.unverifiedRejection = {
            passed: !unverifiedTrusted.success,
            detail: unverifiedTrusted.validation?.message ?? "rejected low-quality verified",
        };
        const duplicate = await engine.storeRecord({
            knowledgeType: KnowledgeStorageType.Product,
            category: "product",
            title: "Step 4B Validation Knowledge",
            description: "Validation write test for Knowledge Storage Engine with product intelligence data.",
            source: "step-4b-validation",
        });
        results.duplicateDetection = {
            passed: !duplicate.success && duplicate.validation?.code === KnowledgeStorageValidationCode.DuplicateRecord,
            detail: duplicate.validation?.message ?? "duplicate check",
        };
        const knowledgeId = stored.record.knowledgeId;
        const updated = await engine.updateRecord(knowledgeId, {
            description: "Updated validation knowledge record",
            qualityScore: 92,
            confidenceScore: 90,
            verificationStatus: KnowledgeVerificationStatus.Verified,
        });
        results.versionHistory = {
            passed: updated.success && (updated.version ?? 0) >= 2,
            detail: `Version ${updated.version}, ${engine.listVersions(knowledgeId).length} version(s) on disk`,
        };
        const readStart = Date.now();
        const read = await engine.getRecord(knowledgeId);
        const readMs = Date.now() - readStart;
        results.readPerformance = {
            passed: read.success && read.record?.version === updated.version,
            detail: `Read in ${readMs}ms`,
        };
        const rollback = await engine.rollbackToVersion(knowledgeId, 1);
        results.rollback = {
            passed: rollback.success && (rollback.version ?? 0) >= 3,
            detail: `Rolled back to v1, now version ${rollback.version}`,
        };
        const integrity = engine.runIntegrityCheck();
        results.integrity = {
            passed: integrity.verified,
            detail: `${integrity.recordsChecked} record(s) checked`,
        };
        const logDate = new Date().toISOString().slice(0, 10);
        const logFile = path.join(storageRoot, "logs", `knowledge-storage-engine-${logDate}.jsonl`);
        results.logging = {
            passed: fs.existsSync(logFile),
            detail: logFile,
        };
        const report = engine.buildStatusReport();
        results.validationHistory = {
            passed: report.validationHistoryCount > 0,
            detail: `${report.validationHistoryCount} validation history entry(ies)`,
        };
        results.performance = {
            passed: report.performance.averageWriteMs < 30000,
            detail: `write avg ${report.performance.averageWriteMs}ms, read avg ${report.performance.averageReadMs}ms`,
        };
        results.readiness = {
            passed: report.readinessScore === 100,
            detail: `Readiness ${report.readinessScore}/100`,
        };
        await core.stop("step-4b-validation-complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-4B-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed), "utf8");
        console.log("Validation Results:");
        for (const [key, result] of Object.entries(results)) {
            console.log(`  ${result.passed ? "PASS" : "FAIL"} — ${key}: ${result.detail}`);
        }
        console.log("---");
        console.log(allPassed ? "OVERALL: PASS" : "OVERALL: FAIL");
        console.log(`Readiness Score: ${report.readinessScore}/100`);
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
function buildReport(status, results, storageRoot, allPassed) {
    return [
        "# KWIZERA AI STUDIO — Phase 4 Step 4B Validation Report",
        "",
        "**Phase:** 4 — Knowledge Engine",
        "**Step:** 4B — Knowledge Storage Engine",
        `**Date:** ${new Date().toISOString()}`,
        `**Storage root:** \`${storageRoot}\``,
        "**Assistant:** KWIZERA AI",
        "",
        "---",
        "",
        "## Knowledge Storage Status",
        "",
        "| Field | Value |",
        "|-------|-------|",
        `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
        `| **Engine Status** | ${status.engineStatus} |`,
        `| **Readiness Score** | **${status.readinessScore}/100** |`,
        `| **Record Count** | ${status.recordCount} |`,
        `| **Supported Types** | ${status.supportedTypes} |`,
        "",
        "## Validation Status",
        "",
        "| Check | Status | Detail |",
        "|-------|--------|--------|",
        ...Object.entries(results).map(([key, r]) => `| ${key} | ${r.passed ? "✅ PASS" : "❌ FAIL"} | ${r.detail} |`),
        "",
        "## Version Status",
        "",
        `- Version management: ${status.versionManagement.enabled ? "enabled" : "disabled"}`,
        `- Total versions preserved: ${status.versionManagement.totalVersions}`,
        "",
        "## Integrity Status",
        "",
        `- ${status.integrityStatus}`,
        `- Classification: ${status.classificationStatus}`,
        "",
        "## Performance",
        "",
        "| Metric | Value |",
        "|--------|-------|",
        `| Average Write | ${status.performance.averageWriteMs}ms |`,
        `| Average Read | ${status.performance.averageReadMs}ms |`,
        `| Index Size | ${status.performance.indexSize} |`,
        "",
        "## Known Issues",
        "",
        ...(status.knownIssues.length > 0
            ? status.knownIssues.map((i) => `- ${i}`)
            : ["- None"]),
        "",
        "---",
        "",
        "**KWIZERA AI** — Step 4B Knowledge Storage Engine validation complete. Awaiting user approval before Step 4C.",
        "",
    ].join("\n");
}
void main();
//# sourceMappingURL=validate-knowledge-storage-engine.js.map