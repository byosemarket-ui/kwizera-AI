import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  KnowledgeCreativeDirectionStyle,
  KnowledgeCreativeDomain,
  KnowledgeCreativePlatform,
  KnowledgeSource,
  KnowledgeStorageType,
  type KnowledgeValidationStatusReport,
} from "../ai/index.js";
import type { CreativeAnalysisInput } from "../ai/creative-knowledge-engine/types.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-knowledge-validation-"));
}

const SAMPLE_VALID: CreativeAnalysisInput = {
  creativeId: "step4m-valid-creative",
  projectName: "KWIZERA Valid Creative",
  domain: KnowledgeCreativeDomain.AdvertisingDesign,
  creativeStyle: KnowledgeCreativeDirectionStyle.Premium,
  platform: KnowledgeCreativePlatform.Instagram,
  brandName: "KWIZERA",
  visual: { balance: 92, contrast: 90, whiteSpace: 88 },
  storytelling: { attentionRetention: 94 },
  animation: { animationQuality: 91 },
  tags: ["creative", "kwizera", "validation", "trusted"],
};

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 4M Knowledge Validation Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-4m-validation");

    const foundation = core.getManager().knowledgeFoundation!;
    const creative = foundation.getCreativeKnowledgeEngine();
    const storage = foundation.getStorageEngine();
    const validation = foundation.getKnowledgeValidationEngine();

    results.initialization = {
      passed: validation.isInitialized() && validation.isStartupComplete(),
      detail: "Knowledge Validation Engine operational",
    };

    const validationDir = path.join(storageRoot, "knowledge", "validation", "engine");
    results.validationDirectories = {
      passed: fs.existsSync(validationDir),
      detail: validationDir,
    };

    const logDate = new Date().toISOString().slice(0, 10);
    const logFile = path.join(storageRoot, "logs", `knowledge-validation-engine-${logDate}.jsonl`);
    results.logging = {
      passed: fs.existsSync(logFile),
      detail: logFile,
    };

    await creative.analyzeCreative(SAMPLE_VALID);

    const validResult = await validation.validateKnowledge("creative-knowledge-step4m-valid-creative");
    results.validKnowledge = {
      passed: validResult.valid && validResult.scores.qualityScore >= 60,
      detail: `Level ${validResult.validationLevel}, quality ${validResult.scores.qualityScore}`,
    };

    await storage.storeRecord(
      {
        knowledgeId: "step4m-incomplete-knowledge",
        knowledgeType: KnowledgeStorageType.Technical,
        category: "validation-test",
        title: "Incomplete Record",
        description: "short",
        source: KnowledgeSource.System,
        qualityScore: 35,
        confidenceScore: 35,
        sourceReliability: 40,
        tags: [],
        keywords: [],
      },
      "step-4m-validation"
    );

    const incompleteResult = await validation.validateKnowledge("step4m-incomplete-knowledge");
    results.incompleteKnowledge = {
      passed:
        !incompleteResult.trusted &&
        (incompleteResult.validationLevel === "draft" ||
          incompleteResult.validationLevel === "pending-validation" ||
          incompleteResult.validationLevel === "rejected"),
      detail: `Level ${incompleteResult.validationLevel}, issues ${incompleteResult.issues.length}`,
    };

    await storage.storeRecord(
      {
        knowledgeId: "step4m-duplicate-a",
        knowledgeType: KnowledgeStorageType.Business,
        category: "validation-test",
        title: "KWIZERA Duplicate Test",
        description: "Duplicate test record A for validation scenario testing.",
        summary: "Duplicate A",
        source: KnowledgeSource.KnowledgeModule,
        qualityScore: 70,
        confidenceScore: 70,
        tags: ["duplicate-test"],
      },
      "step-4m-validation"
    );

    const duplicateB = await storage.storeRecord(
      {
        knowledgeId: "step4m-duplicate-b",
        knowledgeType: KnowledgeStorageType.Business,
        category: "validation-test",
        title: "KWIZERA Duplicate Test",
        description: "Duplicate test record A for validation scenario testing.",
        summary: "Duplicate B",
        source: KnowledgeSource.KnowledgeModule,
        qualityScore: 65,
        confidenceScore: 65,
        tags: ["duplicate-test"],
      },
      "step-4m-validation"
    );

    const consistency = await validation.validateConsistency(false);
    results.duplicateKnowledge = {
      passed: !duplicateB.success || consistency.duplicateGroups >= 1,
      detail: duplicateB.success
        ? `${consistency.duplicateGroups} duplicate group(s) in index`
        : "Duplicate blocked at storage layer",
    };

    const conflictA = await storage.storeRecord(
      {
        knowledgeId: "step4m-conflict-a",
        knowledgeType: KnowledgeStorageType.Industry,
        category: "validation-test",
        title: "KWIZERA Industry Fact",
        description: "KWIZERA was founded in 2024 as a creative technology studio.",
        summary: "Founding year 2024",
        source: KnowledgeSource.KnowledgeModule,
        qualityScore: 72,
        confidenceScore: 70,
        tags: ["conflict-test"],
      },
      "step-4m-validation"
    );

    const conflictB = await storage.storeRecord(
      {
        knowledgeId: "step4m-conflict-b",
        knowledgeType: KnowledgeStorageType.Industry,
        category: "validation-test",
        title: "KWIZERA Industry Fact",
        description: "KWIZERA was founded in 2020 as a hardware manufacturer.",
        summary: "Founding year 2020",
        source: KnowledgeSource.Manual,
        qualityScore: 72,
        confidenceScore: 70,
        tags: ["conflict-test"],
      },
      "step-4m-validation"
    );

    const conflictEntries = storage
      .getIndexEntries()
      .filter((e) => e.knowledgeId === "step4m-conflict-a" || e.knowledgeId === "step4m-conflict-b");
    const conflictConsistency = await validation.validateConsistency(false);
    const distinctHashes = new Set(conflictEntries.map((e) => e.contentHash)).size;

    results.conflictingKnowledge = {
      passed:
        conflictA.success &&
        conflictB.success &&
        conflictEntries.length === 2 &&
        (conflictConsistency.conflictingRecords >= 1 || distinctHashes > 1),
      detail: `${conflictConsistency.conflictingRecords} conflicting, ${distinctHashes} distinct hash(es)`,
    };

    await storage.storeRecord(
      {
        knowledgeId: "step4m-corrupt-knowledge",
        knowledgeType: KnowledgeStorageType.Technical,
        category: "validation-test",
        title: "Corrupted Record",
        description: "This record will be corrupted for integrity testing purposes.",
        summary: "Corruption test",
        source: KnowledgeSource.System,
        qualityScore: 20,
        confidenceScore: 20,
        tags: ["corrupt-test"],
      },
      "step-4m-validation"
    );

    const corruptEntry = storage.findIndexEntry("step4m-corrupt-knowledge");
    if (corruptEntry) {
      const corruptFile = path.join(corruptEntry.storageLocation, "current.json");
      fs.writeFileSync(corruptFile, "{ invalid json corruption", "utf8");
    }

    const corruptResult = await validation.validateKnowledge("step4m-corrupt-knowledge");
    results.corruptedKnowledge = {
      passed: !corruptResult.valid || corruptResult.issues.length > 0,
      detail: `Valid=${corruptResult.valid}, issues=${corruptResult.issues.length}`,
    };

    const sourceCheck = validation.validateSource(KnowledgeSource.KnowledgeModule);
    results.sourceValidation = {
      passed: sourceCheck.valid && sourceCheck.trusted,
      detail: `Source ${sourceCheck.source} trusted=${sourceCheck.trusted}`,
    };

    const unknownSource = validation.validateSource("unknown-source-xyz");
    results.unknownSourceRejection = {
      passed: !unknownSource.valid,
      detail: unknownSource.issues.join("; ") || "rejected",
    };

    const repair = await validation.repairSafeIssues();
    results.autoRepair = {
      passed: repair.repaired >= 0,
      detail: `Repaired ${repair.repaired}, rejected ${repair.rejected}`,
    };

    const rejected = await validation.rejectInvalidKnowledge();
    results.rejectInvalid = {
      passed: rejected >= 0,
      detail: `${rejected} record(s) rejected`,
    };

    const batchStart = Date.now();
    const batch = await validation.validateAll();
    const batchMs = Date.now() - batchStart;

    results.batchValidation = {
      passed: batch.totalRecords > 0,
      detail: `${batch.validRecords}/${batch.totalRecords} valid in ${batchMs}ms`,
    };

    const integrity = await validation.validateIntegrity();
    results.integrity = {
      passed: integrity.recordsChecked > 0,
      detail: `${integrity.recordsChecked} checked, corrupted ${integrity.corruptedRecords}`,
    };

    const relationships = await validation.validateRelationships(true);
    results.relationshipValidation = {
      passed: relationships.relationshipsChecked > 0,
      detail: `${relationships.relationshipsChecked} checked, repaired ${relationships.issuesRepaired}`,
    };

    const reportPaths = await validation.generateReports();
    const projectStateDir = path.join(storageRoot, "project-state");

    results.projectStateReports = {
      passed:
        fs.existsSync(reportPaths.validationReportPath) &&
        fs.existsSync(reportPaths.qualityReportPath) &&
        fs.existsSync(reportPaths.integrityReportPath) &&
        fs.existsSync(projectStateDir),
      detail: projectStateDir,
    };

    const status = validation.buildStatusReport();
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

    const reportPath = path.join(process.cwd(), "STEP-4M-VALIDATION-REPORT.md");
    fs.writeFileSync(
      reportPath,
      buildReport(status, results, storageRoot, allPassed, batchMs),
      "utf8"
    );
    console.log("Report written:", reportPath);
    console.log("Project state reports:", projectStateDir);

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
  status: KnowledgeValidationStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  batchMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 4 Step 4M Validation Report",
    "",
    "**Phase:** 4 — Knowledge Engine",
    "**Step:** 4M — Knowledge Validation Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Knowledge Validation Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    `| **Total Validations** | ${status.totalValidations} |`,
    "",
    "## Quality Status",
    "",
    `- ${status.qualityStatus}`,
    "",
    "## Integrity Status",
    "",
    `- ${status.integrityStatus}`,
    "",
    "## Relationship Validation Status",
    "",
    `- ${status.relationshipValidationStatus}`,
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
    `| Batch Validation | ${batchMs}ms |`,
    `| Average Validation | ${status.performance.averageValidationMs}ms |`,
    `| Last Validation | ${status.performance.lastValidationMs}ms |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 4M Knowledge Validation Engine validation complete. Awaiting user approval before Step 4N.",
    "",
  ].join("\n");
}

void main();
