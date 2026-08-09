import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiLearningCertificationEngine,
  type LearningCertificationReportData,
} from "../ai/learning-certification/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-learncert-"));
}

function writeReport(data: LearningCertificationReportData): string {
  const reportPath = path.join(process.cwd(), "LEARNING-CONTINUOUS-IMPROVEMENT-CERTIFICATION-REPORT.md");
  const yesNo = data.isVersion10Complete ? "YES" : "NO";
  const blockersSection = data.isVersion10Complete
    ? "- none"
    : data.blockers.length
      ? data.blockers.map((b) => `- **${b.area}** (${b.id}): ${b.evidence}`).join("\n")
      : "- (scores/gates incomplete — see Issues Found)";

  const body = `# LEARNING & CONTINUOUS IMPROVEMENT CERTIFICATION REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 10

**Generated at:** ${data.generatedAt}  
**Product Version:** Learning, Online Research & Continuous Improvement 1.0  
**Offline First:** Preserved  
**Validation Bypassed:** NO  
**Version 1.0 Complete:** **${yesNo}**  

---

## 1. Online Research Status

${data.onlineResearchStatus}

## 2. Knowledge Acquisition Status

${data.knowledgeAcquisitionStatus}

## 3. Knowledge Validation Status

${data.knowledgeValidationStatus}

## 4. Knowledge Evolution Status

${data.knowledgeEvolutionStatus}

## 5. Feedback Intelligence Status

${data.feedbackIntelligenceStatus}

## 6. Performance Analytics Status

${data.performanceAnalyticsStatus}

## 7. Autonomous Learning Status

${data.autonomousLearningStatus}

## 8. Workflow Optimization Status

${data.workflowOptimizationStatus}

## 9. Self Optimization Status

${data.selfOptimizationStatus}

## 10. Autonomous Validation Status

${data.autonomousValidationStatus}

## 11. Knowledge Foundation Status

${data.knowledgeFoundationStatus}

## 12. AI Me Learning Capability

${data.aiMeLearningCapability}

## 13. Overall Learning Score

${data.overallLearningScore}

## 14. Overall Intelligence Score

${data.overallIntelligenceScore}

## 15. Production Readiness Score

${data.productionReadinessScore}

## 16. Stability Score

${data.stabilityScore}

## 17. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 18. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 19. Remaining Limitations

${data.remainingLimitations.length ? data.remainingLimitations.map((item) => `- ${item}`).join("\n") : "- none"}

## 20. Is Learning & Continuous Improvement Version 1.0 Complete? (${yesNo})

${
  data.isVersion10Complete
    ? `### CERTIFIED

\`\`\`
${data.certificationStatement}
\`\`\`
`
    : `### NOT CERTIFIED — Remaining blockers

${blockersSection}
`
}

---

## Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

---

**Step 10 verdict:** ${
    data.isVersion10Complete
      ? "Learning & Continuous Improvement Version 1.0 is CERTIFIED for production use."
      : "Learning & Continuous Improvement Version 1.0 is NOT certified until blockers are resolved."
  }
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `learncert-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 10");
  console.log("Learning, Autonomous Intelligence & Continuous Improvement Certification");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiLearningCertificationEngine();
    engine.initialize(storageRoot);

    const run = engine.runCertification();
    issuesFound.push(...run.issuesFound);
    issuesRepaired.push(...run.issuesRepaired);

    results.push({
      name: "subsystemCertification",
      passed: run.subsystems.length === 12 && run.subsystems.every((s) => s.status === "pass"),
      detail: `subsystems=${run.subsystems.length}`,
    });
    results.push({
      name: "endToEndScenarios",
      passed: run.scenarios.length === 5 && run.scenarios.every((s) => s.passed),
      detail: run.scenarios.map((s) => s.scenario).join(","),
    });
    results.push({
      name: "knowledgeFoundation",
      passed: run.knowledgeFoundation.versionHistory && run.knowledgeFoundation.score >= 90,
      detail: `score=${run.knowledgeFoundation.score}`,
    });
    results.push({
      name: "aiMeCertification",
      passed: run.aiMe.canRejectLowQualityKnowledge && run.aiMe.canExplainEveryImprovement && run.aiMe.score >= 90,
      detail: `score=${run.aiMe.score}`,
    });
    results.push({
      name: "systemHealth",
      passed:
        run.health.overallIntelligenceScore >= 90
        && run.health.productionReadinessScore >= 90
        && run.health.stabilityScore >= 90,
      detail: `intel=${run.health.overallIntelligenceScore}; ready=${run.health.productionReadinessScore}; stab=${run.health.stabilityScore}`,
    });
    results.push({
      name: "longTermStability",
      passed: run.longTermStability.rollbackIntegrity && run.longTermStability.versionIntegrity,
      detail: `score=${run.longTermStability.score}`,
    });
    results.push({
      name: "version10Complete",
      passed: run.certified && run.blockers.length === 0,
      detail: run.certified ? "YES" : `NO blockers=${run.blockers.length}`,
    });

    const explained = engine.explain(run.runId);
    const awareness = engine.getAiMeAwareness(run);
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainCertificationResults
        && awareness.learningContinuousImprovementV1Complete
        && explained.certified,
      detail: awareness.summary,
    });

    const autoTests = engine.runAutomaticTests();
    results.push(...autoTests);

    let health = engine.runQualityAssurance();
    issuesRepaired.push(...health.repaired);
    let loops = 0;
    while (health.criticalIssues.length > 0 && loops < 3) {
      engine.runCertification();
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
    console.log("Version 1.0 Complete:", reportData.isVersion10Complete ? "YES" : "NO");
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
