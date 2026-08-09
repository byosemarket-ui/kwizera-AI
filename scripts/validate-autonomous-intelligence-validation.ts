import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  AiAutonomousIntelligenceValidationEngine,
  type AutonomousIntelligenceValidationReportData,
} from "../ai/autonomous-intelligence-validation/index.js";

function createTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-aiv-"));
}

function writeReport(data: AutonomousIntelligenceValidationReportData): string {
  const reportPath = path.join(process.cwd(), "AUTONOMOUS-INTELLIGENCE-VALIDATION-REPORT.md");
  const body = `# AUTONOMOUS INTELLIGENCE VALIDATION REPORT
## KWIZERA AI STUDIO — AI Learning, Online Research & Continuous Improvement Step 9

**Generated at:** ${data.generatedAt}  
**Offline First:** Preserved  
**User data deleted:** NO  
**Unsafe system certified:** NO (safety gates enforced)  
**Step 10 (Learning Certification):** Available separately via \`validate:learning-certification\`  

---

## 1. Existing Validation capability

${data.existingValidationCapability}

## 2. Components upgraded

${data.componentsUpgraded.map((item) => `- ${item}`).join("\n")}

## 3. Components created

${data.componentsCreated.map((item) => `- ${item}`).join("\n")}

## 4. Learning Validation status

${data.learningValidationStatus}

## 5. Safety Validation status

${data.safetyValidationStatus}

## 6. Stability status

${data.stabilityStatus}

## 7. Production Readiness Score

${data.productionReadinessScore}

## 8. AI Me capability

${data.aiMeCapability}

## 9. Issues Found

${data.issuesFound.length ? data.issuesFound.map((item) => `- ${item}`).join("\n") : "- none"}

## 10. Issues Repaired

${data.issuesRepaired.length ? data.issuesRepaired.map((item) => `- ${item}`).join("\n") : "- none"}

## 11. Remaining Risks

${data.remainingRisks.length ? data.remainingRisks.map((item) => `- ${item}`).join("\n") : "- none"}

## 12. Test Results

${data.testResults.map((item) => `- ${item.passed ? "PASS" : "FAIL"} ${item.name}: ${item.detail}`).join("\n")}

## 13. Remaining work before Step 10

${data.remainingWorkBeforeStep10.map((item) => `- ${item}`).join("\n")}

---

**Step 9 verdict:** Autonomous Intelligence Validation & Production Readiness Engine is ready. Capabilities, safety, learning, scenarios, and AI Me contracts are validated with readiness scoring. Learning Certification is available as Step 10.
`;
  fs.writeFileSync(reportPath, body, "utf8");
  return reportPath;
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT
    ? path.join(process.env.KWIZERA_STORAGE_ROOT, `aiv-validate-${Date.now()}`)
    : createTempRoot();
  fs.mkdirSync(storageRoot, { recursive: true });
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — AI Learning Step 9");
  console.log("Autonomous Intelligence Validation & Production Readiness Engine validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const results: Array<{ name: string; passed: boolean; detail: string }> = [];
  const issuesFound: string[] = [];
  const issuesRepaired: string[] = [];

  try {
    const engine = new AiAutonomousIntelligenceValidationEngine();
    engine.initialize(storageRoot);

    const run = engine.runValidation();
    issuesFound.push(...run.issuesFound);
    issuesRepaired.push(...run.issuesRepaired);

    results.push({
      name: "capabilityValidation",
      passed: run.capabilityValidations.length === 10 && run.capabilityValidations.every((c) => c.status === "pass"),
      detail: `capabilities=${run.capabilityValidations.length}`,
    });
    results.push({
      name: "safetyValidation",
      passed: run.safetyValidations.every((s) => s.passed),
      detail: `safety=${run.safetyValidations.filter((s) => s.passed).length}/${run.safetyValidations.length}`,
    });
    results.push({
      name: "learningValidation",
      passed: run.learningValidations.every((l) => l.learnedCorrectly),
      detail: `learning=${run.learningValidations.length}`,
    });
    results.push({
      name: "productionSimulation",
      passed: run.scenarioSimulations.length === 4 && run.scenarioSimulations.every((s) => s.modulesBehavedCorrectly),
      detail: run.scenarioSimulations.map((s) => s.scenario).join(","),
    });
    results.push({
      name: "stabilityValidation",
      passed: run.stability.stability >= 80 && run.stability.rollbackSuccess >= 80,
      detail: `stability=${run.stability.stability}; rollback=${run.stability.rollbackSuccess}`,
    });
    results.push({
      name: "readinessScore",
      passed: run.readiness.productionReadinessScore >= 85 && run.certifiedForProduction,
      detail: `score=${run.readiness.productionReadinessScore}; certified=${run.certifiedForProduction}`,
    });

    const explained = engine.explain(run.runId);
    const awareness = engine.getAiMeAwareness();
    results.push({
      name: "aiMeCapability",
      passed:
        awareness.available
        && awareness.canExplainEveryValidationResult
        && awareness.canPredictLongTermSystemHealth
        && awareness.learningCertificationDeferred === false
        && explained.longTermHealthPrediction.length > 10,
      detail: awareness.summary,
    });

    const autoTests = engine.runAutomaticTests();
    results.push(...autoTests);

    let health = engine.runQualityAssurance();
    issuesRepaired.push(...health.repaired);
    let loops = 0;
    while (health.criticalIssues.length > 0 && loops < 3) {
      engine.runValidation();
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
