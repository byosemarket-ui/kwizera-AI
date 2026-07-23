import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  DecisionPriority,
  DecisionType,
  ReasoningStatus,
  ReasoningStep,
  ReasoningType,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-reasoning-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 2C Reasoning Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const core = createAiCore({ storageRootOverride: storageRoot });
  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    await core.start("step-2c-validation");
    const engine = core.getManager().reasoningEngine;

    results.initialization = {
      passed: Boolean(engine?.isInitialized()),
      detail: engine?.isInitialized()
        ? "Reasoning Engine initialized via AI Core"
        : "Reasoning Engine not initialized",
    };

    results.registry = {
      passed: core.getManager().registry.getEntry("reasoning-engine")?.status === "initialized",
      detail: `reasoning-engine: ${core.getManager().registry.getEntry("reasoning-engine")?.status}`,
    };

    const complete = await engine!.reason({
      taskId: "validation-complete",
      type: ReasoningType.WorkflowPlanning,
      userObjective: "Complete Step 2C validation",
      userRequest: "Validate reasoning process end-to-end",
      inputs: {
        brandProfile: { name: "KWIZERA AI STUDIO" },
        objective: "Complete Step 2C validation",
      },
    });

    results.reasoningProcess = {
      passed: complete.readyForDecision && complete.stepsCompleted.length === 12,
      detail: `Status: ${complete.status}, steps: ${complete.stepsCompleted.length}`,
    };

    results.contextAnalysis = {
      passed:
        complete.contextAnalysis.userObjective.length > 0 &&
        complete.contextAnalysis.completenessScore >= 60,
      detail: `Completeness: ${complete.contextAnalysis.completenessScore}, brand: ${complete.contextAnalysis.brandIdentity ?? "none"}`,
    };

    results.confidenceCalculation = {
      passed: complete.confidence.sufficient && complete.confidence.score >= 45,
      detail: `${complete.confidence.level} (${complete.confidence.score}/100)`,
    };

    const blocked = await engine!.reason({
      taskId: "validation-blocked",
      type: ReasoningType.ProductAnalysis,
      userObjective: "Analyze product",
      userRequest: "Analyze without product name",
      inputs: {},
    });

    results.lowConfidence = {
      passed: !blocked.readyForDecision && blocked.status === ReasoningStatus.AwaitingInput,
      detail: blocked.confidence.explanation,
    };

    results.reasoningHistory = {
      passed:
        engine!.history.getCount() >= 2 &&
        fs.existsSync(engine!.history.getHistoryPath() ?? ""),
      detail: `${engine!.history.getCount()} record(s) at ${engine!.history.getHistoryPath()}`,
    };

    const logDir = engine!.logger.getLogDirectory();
    results.reasoningLogging = {
      passed: Boolean(logDir && fs.existsSync(logDir)),
      detail: logDir ?? "no log directory",
    };

    const errorAnalysis = engine!.analyzeError({
      errorMessage: "Validation failed: missing productName",
      stage: "reasoning",
    });

    results.errorAnalysis = {
      passed: errorAnalysis.recoveryOptions.length >= 3 && Boolean(errorAnalysis.safestOptionId),
      detail: `Root cause: ${errorAnalysis.rootCause.slice(0, 60)}`,
    };

    const decisionResult = await core.getManager().decisionEngine!.decide({
      requestId: "validation-decision-integration",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Validate reasoning before decision",
      statedObjective: "Confirm reasoning-decision pipeline",
      availableData: {
        objective: "Confirm reasoning-decision pipeline",
        brandProfile: { name: "KWIZERA AI STUDIO" },
      },
    });

    results.decisionIntegration = {
      passed:
        Boolean(decisionResult.reasoningResult) &&
        decisionResult.reasoningResult!.stepsCompleted.includes(
          ReasoningStep.SendToDecisionEngine
        ) &&
        decisionResult.approved,
      detail: decisionResult.approved
        ? "Decision approved after reasoning"
        : "Decision blocked",
    };

    const statusReport = engine!.buildStatusReport();
    results.performance = {
      passed: statusReport.performance.totalReasonings >= 2,
      detail: `avg ${statusReport.performance.averageReasoningMs}ms, total ${statusReport.performance.totalReasonings}`,
    };

    results.readiness = {
      passed: statusReport.readinessScore >= 80,
      detail: `Readiness score: ${statusReport.readinessScore}/100`,
    };

    await core.stop("validation complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-2C-VALIDATION-REPORT.md");
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
  status: ReturnType<
    import("../ai/reasoning/reasoning-engine.js").AiReasoningEngine["buildStatusReport"]
  >,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return `# KWIZERA AI STUDIO — Step 2C Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2C — AI Reasoning Engine  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **Reasoning Engine Status** | ${status.reasoningEngineStatus} |
| **Reasoning Accuracy** | ${status.reasoningAccuracy}% |
| **Confidence Quality** | ${status.confidenceQuality} |
| **Average Reasoning Time** | ${status.performance.averageReasoningMs}ms |
| **Total Reasonings (validation run)** | ${status.performance.totalReasonings} |
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

## Reasoning Process (12 Steps)

1. Receive task  
2. Understand user objective  
3. Collect available information  
4. Search Memory (stub — Memory Engine not built)  
5. Search Knowledge (stub — Knowledge Engine not built)  
6. Analyze context  
7. Generate multiple possible approaches  
8. Compare advantages and disadvantages  
9. Calculate confidence score  
10. Recommend the best solution  
11. Explain internal reasoning  
12. Send recommendation to the Decision Engine  

---

## Known Issues

${status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`).join("\n") : "- None identified during validation"}

---

## Components Implemented

- AI Reasoning Engine (\`ai/reasoning/reasoning-engine.ts\`)
- Context Analyzer (\`ai/reasoning/context-analyzer.ts\`)
- Approach Generator & Comparator (\`ai/reasoning/approach-*.ts\`)
- Confidence Calculator (\`ai/reasoning/confidence-calculator.ts\`)
- Risk Evaluator (\`ai/reasoning/risk-evaluator.ts\`)
- Error Analyzer (\`ai/reasoning/error-analyzer.ts\`)
- Reasoning History Store (\`ai/reasoning/reasoning-history-store.ts\`)
- Reasoning Logger (\`ai/reasoning/reasoning-logger.ts\`)

---

## Not Implemented (by design — Step 2C scope)

- User Interface, Product Management, Video, Image, Marketing engines
- Memory Engine, Knowledge Engine (real implementations)
- AI models, AI Workflow Engine execution

---

**KWIZERA AI** — Reasoning Engine ready for Step 2D upon approval.
`;
}

main();
