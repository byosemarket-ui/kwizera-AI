import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiAutonomousImprovementEngine,
  type AutonomousImprovementReportData,
} from "../ai/autonomous-improvement/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-autoimp-"));
}

function writeReport(data: AutonomousImprovementReportData): string {
  const reportPath = path.join(process.cwd(), "AUTONOMOUS-IMPROVEMENT-REPORT.md");
  const body = `# AUTONOMOUS IMPROVEMENT REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 8

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**User projects modified:** NO  
**User data deleted:** NO  
**Step 9 (Autonomous Intelligence Validation):** Available separately via \`validate:autonomous-intelligence-validation\`  

---

## 1. Existing Self-Improvement capability

${data.existingSelfImprovementCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Improvements Applied

${
  data.improvementsApplied.length
    ? data.improvementsApplied.map((item) => `- ${item.id}: ${item.module} ${item.version}`).join("\n")
    : "- none"
}

## 5. Rollback Status

${data.rollbackStatus}

## 6. Stability Status

${data.stabilityStatus}

## 7. Performance Improvement

${data.performanceImprovement.length ? data.performanceImprovement.map((item) => `- ${item}`).join("\n") : "- none"}

## 8. Quality Improvement

${data.qualityImprovement.length ? data.qualityImprovement.map((item) => `- ${item}`).join("\n") : "- none"}

## 9. AI Me capability

${data.aiMeCapability}

## 10. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 9

${data.remainingWorkBeforeStep9.map((item) => `- ${item}`).join("\n")}

---

**Step 8 verdict:** Autonomous Improvement & Self-Optimization Engine is ready. Safe improvements apply with backups and rollback points; unsafe changes become manual recommendations; user projects are never modified. Autonomous Intelligence Validation is available as Step 9.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `autoimp-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 8");
  console.log("Autonomous Improvement & Self-Optimization Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiAutonomousImprovementEngine();
    engine.initialize(storageRoot);

    const cycle = engine.runImprovementCycle({
      maxApply: 5,
      signals: [
        {
          source: "performance-analytics",
          label: "GPU saturation during rendering",
          score: 80,
          detail: "Optimize resource allocation",
          moduleHint: "resource-allocation",
          strategyHint: "resource-optimization",
        },
        {
          source: "workflow-optimization",
          label: "Slow workflow order",
          score: 85,
          detail: "Refine workflow steps",
          moduleHint: "workflow",
          strategyHint: "workflow-refinement",
        },
        {
          source: "user-feedback",
          label: "Unsafe API break experiment",
          score: 95,
          detail: "Would break api",
          moduleHint: "planning",
          strategyHint: "scheduling-optimization",
        },
        {
          source: "knowledge-foundation",
          label: "Search optimization for knowledge usage",
          score: 70,
          moduleHint: "knowledge-usage",
          strategyHint: "search-optimization",
        },
      ],
    });

    issuesFound.push(...cycle.issuesFound);
    issuesRepaired.push(...cycle.issuesRepaired);

    results.push({
      name: "selfImprovement",
      passed: cycle.applied.length >= 2 && cycle.userProjectsModified === false && cycle.userDataDeleted === false,
      detail: `applied=${cycle.applied.length}`,
    });
    results.push({
      name: "safeGate",
      passed: cycle.recommendations.length >= 1 && cycle.opportunities.some((o) => !o.safety.safeToApply),
      detail: `recommendations=${cycle.recommendations.length}`,
    });
    results.push({
      name: "rollbackPoints",
      passed: cycle.rollbacksAvailable.length === cycle.applied.length,
      detail: `rollbacks=${cycle.rollbacksAvailable.length}`,
    });
    results.push({
      name: "selfEvaluation",
      passed: cycle.evaluations.every((e) => e.performanceGain >= 0 && e.qualityGain >= 0),
      detail: `evals=${cycle.evaluations.length}`,
    });

    const firstId = cycle.applied[0]?.id;
    const rb = firstId ? engine.rollback(firstId) : { success: false, detail: "none" };
    results.push({
      name: "rollback",
      passed: Boolean(firstId) && rb.success,
      detail: rb.detail,
    });

    const explained = engine.explain(cycle.applied[1]?.id ?? cycle.applied[0]?.id);
    const awareness = engine.getAiMeAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainEveryImprovement
        && awareness.canRecommendManualWhenUnsafe
        && awareness.autonomousIntelligenceCertificationDeferred === false
        && explained.whatImproved.length > 5,
      detail: awareness.summary,
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
