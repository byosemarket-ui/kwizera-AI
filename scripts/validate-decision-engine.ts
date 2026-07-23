import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  DecisionPriority,
  DecisionStatus,
  DecisionStep,
  DecisionType,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-decision-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 2B Decision Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const core = createAiCore({ storageRootOverride: storageRoot });
  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    await core.start("step-2b-validation");
    const engine = core.getManager().decisionEngine;

    results.initialization = {
      passed: Boolean(engine?.isInitialized()),
      detail: engine?.isInitialized()
        ? "Decision Engine initialized via AI Core"
        : "Decision Engine not initialized",
    };

    results.registry = {
      passed: core.getManager().registry.getEntry("decision-engine")?.status === "initialized",
      detail: `decision-engine: ${core.getManager().registry.getEntry("decision-engine")?.status}`,
    };

    const approved = await engine!.decide({
      requestId: "validation-approved",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Validate decision creation and workflow handoff",
      statedObjective: "Complete Step 2B validation",
      availableData: {
        objective: "Complete Step 2B validation",
        brandProfile: { name: "KWIZERA AI STUDIO" },
      },
    });

    results.decisionCreation = {
      passed: approved.approved && approved.stepsCompleted.length === 12,
      detail: `Status: ${approved.status}, steps: ${approved.stepsCompleted.length}`,
    };

    results.decisionValidation = {
      passed: approved.validation?.passed === true,
      detail: approved.validation?.checks.map((c) => `${c.name}:${c.passed}`).join(", ") ?? "none",
    };

    results.workflowHandoff = {
      passed: Boolean(approved.workflowHandoff?.workflowId),
      detail: approved.workflowHandoff?.workflowId ?? "missing",
    };

    const blocked = await engine!.decide({
      requestId: "validation-blocked",
      type: DecisionType.ProductAnalysis,
      priority: DecisionPriority.High,
      userRequest: "Analyze without product name",
      availableData: {},
    });

    results.missingInformation = {
      passed: !blocked.approved && blocked.status === DecisionStatus.AwaitingInput,
      detail: `Blocked with ${blocked.missingInformation.length} missing item(s)`,
    };

    results.decisionHistory = {
      passed:
        engine!.history.getCount() >= 2 &&
        fs.existsSync(engine!.history.getHistoryPath() ?? ""),
      detail: `${engine!.history.getCount()} record(s) at ${engine!.history.getHistoryPath()}`,
    };

    const logDir = engine!.logger.getLogDirectory();
    results.decisionLogging = {
      passed: Boolean(logDir && fs.existsSync(logDir)),
      detail: logDir ?? "no log directory",
    };

    let criticalMutexPassed = false;
    try {
      engine!.priorityManager.acquire(DecisionPriority.Critical, "mutex-test");
      await engine!.decide({
        requestId: "validation-critical-blocked",
        type: DecisionType.General,
        priority: DecisionPriority.Critical,
        userRequest: "Should be blocked by mutex",
        availableData: { brandProfile: { name: "KWIZERA" } },
      });
      criticalMutexPassed = false;
    } catch (error) {
      criticalMutexPassed =
        error instanceof Error && error.message.includes("critical decision task");
    } finally {
      engine!.priorityManager.release("mutex-test");
    }

    results.priorityMutex = {
      passed: criticalMutexPassed,
      detail: criticalMutexPassed
        ? "Second critical task blocked"
        : "Critical mutex not enforced",
    };

    const statusReport = engine!.buildStatusReport();
    results.performance = {
      passed: statusReport.performance.totalDecisions >= 2,
      detail: `avg ${statusReport.performance.averageDecisionMs}ms, total ${statusReport.performance.totalDecisions}`,
    };

    results.quality = {
      passed: approved.record.qualityScore >= 60,
      detail: `Approved quality score: ${approved.record.qualityScore}`,
    };

    results.readiness = {
      passed: statusReport.readinessScore >= 80,
      detail: `Readiness score: ${statusReport.readinessScore}/100`,
    };

    await core.stop("validation complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-2B-VALIDATION-REPORT.md");
    const markdown = buildMarkdownReport(statusReport, results, storageRoot, allPassed);
    fs.writeFileSync(reportPath, markdown, "utf8");

    console.log(markdown);
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

function buildMarkdownReport(
  status: ReturnType<import("../ai/decision/decision-engine.js").AiDecisionEngine["buildStatusReport"]>,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return `# KWIZERA AI STUDIO — Step 2B Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2B — AI Decision Engine  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **Decision Engine Status** | ${status.decisionEngineStatus} |
| **Decision Accuracy** | ${status.decisionAccuracy}% |
| **Validation Status** | ${status.validationStatus} |
| **Average Decision Time** | ${status.performance.averageDecisionMs}ms |
| **Total Decisions (validation run)** | ${status.performance.totalDecisions} |
| **Readiness Score** | **${status.readinessScore}/100** |
| **Overall** | ${allPassed ? "✅ PASS" : "❌ FAIL"} |

---

## Validation Checks

${Object.entries(results)
  .map(
    ([name, r]) =>
      `- **${name}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`
  )
  .join("\n")}

---

## Decision Process (12 Steps)

1. Receive User Request  
2. Understand User Goal  
3. Analyze Available Data  
4. Search Existing Memory (stub — Memory Engine not built)  
5. Search Knowledge Base (stub — Knowledge Engine not built)  
6. Detect Missing Information  
7. Generate Possible Solutions  
8. Compare Solutions  
9. Score Every Solution  
10. Select the Best Solution  
11. Explain the Decision Internally  
12. Pass the Decision to the AI Workflow Engine  

---

## Known Issues

${status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`).join("\n") : "- None identified during validation"}

---

## Components Implemented

- AI Decision Engine (\`ai/decision/decision-engine.ts\`)
- Decision Priority Manager (\`ai/decision/decision-priority-manager.ts\`)
- Decision Validator (\`ai/decision/decision-validator.ts\`)
- Quality Evaluator (\`ai/decision/quality-evaluator.ts\`)
- Solution Generator & Scorer (\`ai/decision/solution-*.ts\`)
- Decision History Store (\`ai/decision/decision-history-store.ts\`)
- Decision Logger (\`ai/decision/decision-logger.ts\`)
- Memory/Knowledge search stubs (\`ai/decision/providers/\`)

---

## Not Implemented (by design — Step 2B scope)

- User Interface, Product Management, Video, Image, Marketing engines
- Memory Engine, Knowledge Engine (real implementations)
- AI models, AI Workflow Engine execution

---

**KWIZERA AI** — Decision Engine ready for Step 2C upon approval.
`;
}

main();
