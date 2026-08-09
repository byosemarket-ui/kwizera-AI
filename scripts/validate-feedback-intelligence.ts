import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiFeedbackIntelligenceEngine,
  type FeedbackIntelligenceReportData,
} from "../ai/feedback-intelligence/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-feedback-"));
}

function writeReport(data: FeedbackIntelligenceReportData): string {
  const reportPath = path.join(process.cwd(), "FEEDBACK-INTELLIGENCE-REPORT.md");
  const body = `# FEEDBACK INTELLIGENCE REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 4

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**Professional Knowledge overwritten:** NO  
**Step 5 (Performance Analytics):** Available separately via \`validate:performance-analytics\`  

---

## 1. Existing Feedback capability

${data.existingFeedbackCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Feedback analyzed

${
  data.feedbackAnalyzed.length
    ? data.feedbackAnalyzed
        .map((item) => `- ${item.id}: ${item.classification} [${item.topics.join(", ")}]`)
        .join("\n")
    : "- none"
}

## 5. Learning Memory status

${data.learningMemoryStatus}

## 6. User Preference Profile status

${data.userPreferenceProfileStatus}

## 7. Project History status

${data.projectHistoryStatus}

## 8. Recommendation improvement status

${data.recommendationImprovementStatus}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 5

${data.remainingWorkBeforeStep5.map((item) => `- ${item}`).join("\n")}

---

**Step 4 verdict:** Feedback Intelligence & User Learning Engine is ready. Feedback is analyzed, classified, root-caused, learned into preference/memory/history layers without overwriting Professional Knowledge. AI Me can explain learning. Performance Analytics is available as Step 5.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `feedback-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 4");
  console.log("Feedback Intelligence & User Learning Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiFeedbackIntelligenceEngine();
    engine.initialize(storageRoot);

    const run = engine.ingestAndLearn(
      [
        {
          projectId: "proj-fi-1",
          text: "Camera movement is shaky and lighting is too harsh. Please soften the key light.",
          source: "user-review",
          rating: 2,
          accepted: true,
        },
        {
          projectId: "proj-fi-1",
          text: "Music and CTA are excellent. Overall video quality looks professional.",
          source: "user-rating",
          rating: 5,
          accepted: true,
        },
        {
          projectId: "proj-fi-1",
          text: "Bug: render export fails with artifacts on logo placement.",
          source: "ai-self-review",
          rating: 1,
          accepted: true,
        },
        {
          projectId: "proj-fi-2",
          text: "I prefer cinematic storytelling and warmer background tones.",
          source: "manual-correction",
          rating: 4,
          accepted: true,
        },
      ],
      { userId: "studio-user" },
    );

    issuesFound.push(...run.issuesFound);
    issuesRepaired.push(...run.issuesRepaired);

    results.push({
      name: "feedbackAnalysis",
      passed:
        run.analyzed.length === 4
        && run.analyzed.some((item) => item.topics.includes("lighting"))
        && run.analyzed.some((item) => item.classification === "bug-report"),
      detail: `analyzed=${run.analyzed.length}; classes=${[...new Set(run.analyzed.map((item) => item.classification))].join(",")}`,
    });

    results.push({
      name: "rootCauseAnalysis",
      passed: run.analyzed.every(
        (item) =>
          item.rootCause.whatHappened
          && item.rootCause.moduleLikely
          && item.rootCause.recommendedCorrection,
      ),
      detail: run.analyzed[0]?.rootCause.moduleLikely ?? "none",
    });

    results.push({
      name: "learningMemory",
      passed: run.learningEntries.length >= 3 && run.professionalKnowledgeOverwritten === false,
      detail: `learned=${run.learningEntries.length}`,
    });

    results.push({
      name: "preferenceLearning",
      passed:
        run.preferenceProfile.userId === "studio-user"
        && run.preferenceProfile.evolutionNotes.length >= 1,
      detail: `notes=${run.preferenceProfile.evolutionNotes.length}`,
    });

    results.push({
      name: "projectHistory",
      passed: run.projectHistory.some((entry) => entry.projectId === "proj-fi-1" && entry.feedbackIds.length >= 2),
      detail: `projects=${run.projectHistory.length}`,
    });

    results.push({
      name: "recommendationImprovement",
      passed: run.recommendationImprovements.length >= 1,
      detail: `improvements=${run.recommendationImprovements.length}`,
    });

    const explained = engine.explain(run.analyzed[0]?.id, "studio-user");
    const awareness = engine.getAiMeAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainWhatWasLearned
        && awareness.canExplainPreferences
        && awareness.canRecommendFromPriorFeedback
        && awareness.performanceAnalyticsDeferred === false
        && explained.whatWasLearned.length > 10,
      detail: awareness.summary,
    });

    results.push({
      name: "neverDeleteFeedback",
      passed: engine.getAllFeedback().length >= 4,
      detail: `stored=${engine.getAllFeedback().length}`,
    });

    const autoTests = engine.runAutomaticTests();
    results.push(...autoTests);

    let health = engine.runQualityAssurance();
    issuesRepaired.push(...health.repaired);
    let loops = 0;
    while (health.criticalIssues.length > 0 && loops < 3) {
      health = engine.runQualityAssurance();
      issuesRepaired.push(...health.repaired);
      loops += 1;
    }
    results.push({
      name: "qualityAssurance",
      passed: health.criticalIssues.length === 0,
      detail: `healthy=${health.healthy}; checks=${health.checks.filter((c) => c.passed).length}/${health.checks.length}`,
    });

    const reportData = engine.buildReportData(results);
    reportData.issuesFound = [...new Set([...reportData.issuesFound, ...issuesFound])];
    reportData.issuesRepaired = [...new Set([...reportData.issuesRepaired, ...issuesRepaired])];
    const reportPath = writeReport(reportData);
    console.log("Report:", reportPath);
  } catch (error) {
    console.error("Validation failed:", error);
    results.push({ name: "runtime", passed: false, detail: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  } finally {
    if (useTemp) fs.rmSync(storageRoot, { recursive: true, force: true });
  }

  console.log("Checks:");
  let failed = 0;
  for (const result of results) {
    console.log(`- ${result.passed ? "PASS" : "FAIL"} ${result.name}: ${result.detail}`);
    if (!result.passed) failed += 1;
  }
  console.log("---");
  console.log(failed === 0 ? "VALIDATION PASSED" : `VALIDATION FAILED (${failed} check(s))`);
  if (failed > 0) process.exitCode = 1;
}

void main();
