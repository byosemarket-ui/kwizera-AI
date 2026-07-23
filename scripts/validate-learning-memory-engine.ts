import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  LearningCategory,
  LearningOutcome,
  LearningSource,
  MemoryStorageType,
  type LearningMemoryStatusReport,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-learning-memory-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 3E Learning Memory Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    const core = createAiCore({ storageRootOverride: storageRoot });
    await core.start("step-3e-validation");

    const foundation = core.getManager().memoryFoundation!;
    const learning = foundation.getLearningMemoryEngine();
    const storage = foundation.getStorageEngine();
    const indexEngine = foundation.getIndexEngine();

    results.initialization = {
      passed: learning.isInitialized() && learning.isStartupComplete(),
      detail: "Learning Memory Engine operational",
    };

    const learningDir = path.join(storageRoot, "memory", "learning");
    results.learningDirectories = {
      passed: fs.existsSync(learningDir),
      detail: learningDir,
    };

    await storage.storeRecord({
      memoryId: "step3e-project",
      memoryType: MemoryStorageType.Project,
      category: "project",
      title: "Step 3E Learning Validation Project",
      description: "Validates learning from completed projects",
      source: "step-3e-validation",
      tags: ["validation", "learning"],
      relatedProject: "step3e-project",
    });

    const learnStart = Date.now();
    const learnResult = await learning.learnFromEvent({
      source: LearningSource.ProjectHistory,
      category: LearningCategory.Project,
      title: "Completed promotional project",
      description:
        "Successfully delivered promotional video with strong user feedback and marketing performance.",
      relatedProject: "step3e-project",
      outcome: LearningOutcome.Success,
      qualityScore: 90,
      patterns: ["promo-workflow", "brand-consistency"],
    });
    const learnMs = Date.now() - learnStart;

    results.learningDetection = {
      passed: learnResult.success && learnResult.stepsCompleted === 9,
      detail: `9-step pipeline in ${learnMs}ms`,
    };

    results.learningStorage = {
      passed: Boolean(learnResult.memoryId) && learning.getLearningHistory().length >= 1,
      detail: `Learning ID: ${learnResult.learningId}`,
    };

    const historyFile = path.join(learningDir, "learning-history.jsonl");
    results.historyPersistence = {
      passed: fs.existsSync(historyFile),
      detail: historyFile,
    };

    const record = learning.getLearningHistory()[0];
    results.relationships = {
      passed: record.relatedMemories.length >= 1,
      detail: `${record.relatedMemories.length} linked memory(s)`,
    };

    const rejected = await learning.learnFromEvent({
      source: LearningSource.Video,
      category: LearningCategory.Video,
      title: "Low quality",
      description: "Bad",
      qualityScore: 15,
      outcome: LearningOutcome.Failure,
    });

    results.qualityFiltering = {
      passed: rejected.rejected && !rejected.success,
      detail: "Low quality rejected without lesson",
    };

    const failureLesson = await learning.learnFromEvent({
      source: LearningSource.WorkflowHistory,
      category: LearningCategory.Workflow,
      title: "Workflow export failure",
      description: "Export failed due to uncompressed assets exceeding size limits.",
      outcome: LearningOutcome.Failure,
      qualityScore: 38,
      lessonLearned: "Compress assets before export",
    });

    results.failureLessons = {
      passed: failureLesson.success,
      detail: "Valuable failure lesson stored",
    };

    await learning.updateUserPreferences({
      videoStyle: "cinematic",
      marketingStyle: "bold",
      colors: ["#16213e", "#0f3460"],
      transitions: "smooth",
      exportSettings: { format: "mp4", quality: "high" },
      preferredWorkflow: "promo-standard",
    });

    const prefs = learning.getUserPreferences();
    results.preferenceLearning = {
      passed: prefs.videoStyle === "cinematic" && prefs.preferredWorkflow === "promo-standard",
      detail: `${Object.keys(prefs).length} preference fields`,
    };

    const correction = await learning.learnFromUserCorrection(
      "Prefer shorter intro sequences in future videos",
      { category: LearningCategory.Video, relatedProject: "step3e-project" }
    );

    results.userCorrections = {
      passed: correction.success && correction.learningValue > 50,
      detail: `Learning value ${correction.learningValue}`,
    };

    const insights = learning.getSelfImprovementInsights();
    results.selfImprovement = {
      passed:
        insights.recommendations.length > 0 &&
        (insights.workedWell.length > 0 || insights.neverRepeat.length > 0),
      detail: `${insights.recommendations.length} recommendation(s)`,
    };

    const recs = await learning.getRecommendationsForProject("step3e-project");
    results.futureRecommendations = {
      passed: recs.length >= 1,
      detail: recs.slice(0, 2).join("; "),
    };

    const indexed = indexEngine.lookup({ project: "step3e-project" });
    results.indexIntegration = {
      passed: indexed.memoryIds.length >= 2,
      detail: `${indexed.memoryIds.length} indexed record(s)`,
    };

    const logDir = path.join(storageRoot, "logs");
    const logFiles = fs.existsSync(logDir)
      ? fs.readdirSync(logDir).filter((f) => f.startsWith("learning-memory-engine"))
      : [];

    results.logging = {
      passed: logFiles.length > 0,
      detail: logDir,
    };

    const report = learning.buildStatusReport();
    results.performance = {
      passed: learnMs < 5000,
      detail: `learn ${learnMs}ms, avg ${report.performance.averageLearningMs}ms`,
    };

    results.readiness = {
      passed: report.readinessScore >= 85,
      detail: `Readiness ${report.readinessScore}/100, accuracy ${report.learningAccuracy}%`,
    };

    await core.stop("validation complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-3E-VALIDATION-REPORT.md");
    fs.writeFileSync(reportPath, buildReport(report, results, storageRoot, allPassed, learnMs), "utf8");

    console.log(buildReport(report, results, storageRoot, allPassed, learnMs));
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
  status: LearningMemoryStatusReport,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean,
  learnMs: number
): string {
  return [
    "# KWIZERA AI STUDIO — Phase 3 Step 3E Validation Report",
    "",
    "**Phase:** 3 — Persistent Memory",
    "**Step:** 3E — Learning Memory Engine",
    `**Date:** ${new Date().toISOString()}`,
    `**Storage root:** \`${storageRoot}\``,
    "**Assistant:** KWIZERA AI",
    "",
    "---",
    "",
    "## Learning Memory Status",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| **Overall** | ${allPassed ? "✅ **PASS**" : "❌ **FAIL**"} |`,
    `| **Engine Status** | ${status.engineStatus} |`,
    `| **Readiness Score** | **${status.readinessScore}/100** |`,
    "",
    "## Learning Accuracy",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Learning Accuracy | ${status.learningAccuracy}% |`,
    `| Total Learning Records | ${status.totalLearningRecords} |`,
    "",
    "## Preference Learning Status",
    "",
    `- **Status:** ${status.preferenceLearningStatus}`,
    `- **Total Preferences:** ${status.totalPreferences}`,
    "",
    "## History Status",
    "",
    `- ${status.historyStatus}`,
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
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Last Learning Event | ${learnMs}ms |`,
    `| Average Learning | ${status.performance.averageLearningMs}ms |`,
    `| Patterns Detected | ${status.performance.patternsDetected} |`,
    "",
    "## Known Issues",
    "",
    ...(status.knownIssues.length > 0
      ? status.knownIssues.map((i) => `- ${i}`)
      : ["- None"]),
    "",
    "---",
    "",
    "**KWIZERA AI** — Step 3E Learning Memory Engine validation complete. Awaiting user approval before Step 3F.",
    "",
  ].join("\n");
}

void main();
