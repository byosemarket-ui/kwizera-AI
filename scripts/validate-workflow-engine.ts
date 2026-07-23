import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAiCore,
  DecisionPriority,
  DecisionType,
  PlanningType,
  WorkflowState,
  WorkflowStep,
  WorkflowType,
} from "../ai/index.js";

function createTempStorageRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-workflow-"));
}

async function main(): Promise<void> {
  const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
  const useTemp = !process.env.KWIZERA_STORAGE_ROOT;

  console.log("KWIZERA AI STUDIO — Step 2E Workflow Engine Validation");
  console.log("Storage root:", storageRoot);
  console.log("---");

  const core = createAiCore({ storageRootOverride: storageRoot });
  const results: Record<string, { passed: boolean; detail: string }> = {};

  try {
    await core.start("step-2e-validation");
    const engine = core.getManager().workflowEngine;
    const planning = core.getManager().planningEngine;

    results.initialization = {
      passed: Boolean(engine?.isInitialized()),
      detail: engine?.isInitialized()
        ? "Workflow Engine initialized via AI Core"
        : "Workflow Engine not initialized",
    };

    results.registry = {
      passed: core.getManager().registry.getEntry("workflow-engine")?.status === "initialized",
      detail: `workflow-engine: ${core.getManager().registry.getEntry("workflow-engine")?.status}`,
    };

    const plan = await planning!.planFromDecision({
      decisionId: "validation-decision",
      requestId: "validation-request",
      planningType: PlanningType.Backup,
      priority: DecisionPriority.Normal,
      objective: "Complete Step 2E validation",
      userRequest: "Validate workflow engine",
      availableData: { brandProfile: { name: "KWIZERA AI STUDIO" } },
      workflowHandoff: {
        workflowId: "workflow-general-validated",
        requiredModules: ["decision-engine"],
        executionPriority: DecisionPriority.Normal,
        objective: "Complete Step 2E validation",
        parameters: {},
        qualityAssessment: { sufficient: true, score: 95, checks: [], recommendations: [] },
      },
    });

    const workflow = await engine!.execute(plan.workflowHandoff!);

    results.workflowCreation = {
      passed: workflow.success && workflow.stepsCompleted.includes(WorkflowStep.ReceiveExecutionPlan),
      detail: `State: ${workflow.state}, steps: ${workflow.stepsCompleted.length}`,
    };

    results.taskScheduling = {
      passed: workflow.taskHistory.length === plan.executionPlan!.taskList.length,
      detail: `${workflow.taskHistory.length} tasks coordinated`,
    };

    results.executionOrder = {
      passed:
        workflow.taskHistory.map((t) => t.taskId).join(",") ===
        plan.executionPlan!.executionOrder.join(","),
      detail: "Tasks executed in plan order",
    };

    results.dependencyChecking = {
      passed: workflow.validation.checks.some((c) => c.name === "plan-dependencies" && c.passed),
      detail: workflow.validation.checks.map((c) => `${c.name}:${c.passed}`).join(", "),
    };

    results.progressTracking = {
      passed:
        workflow.tracking.completedTasks.length === plan.executionPlan!.taskList.length &&
        workflow.tracking.remainingTasks.length === 0,
      detail: `${workflow.tracking.completedTasks.length} completed, ${workflow.tracking.remainingTasks.length} remaining`,
    };

    const failTaskId = plan.executionPlan!.executionOrder[1];
    const recovered = await engine!.execute({
      ...plan.workflowHandoff!,
      simulateTaskFailure: failTaskId,
    });

    results.recovery = {
      passed: recovered.success && recovered.state === WorkflowState.Recovered,
      detail: `Recovery events: ${recovered.recoveryEvents.length}, attempts: ${recovered.tracking.recoveryAttempts}`,
    };

    results.workflowHistory = {
      passed:
        engine!.history.getCount() >= 2 &&
        fs.existsSync(engine!.history.getHistoryPath() ?? ""),
      detail: `${engine!.history.getCount()} record(s) at ${engine!.history.getHistoryPath()}`,
    };

    const logDir = engine!.logger.getLogDirectory();
    results.workflowLogging = {
      passed: Boolean(logDir && fs.existsSync(logDir)),
      detail: logDir ?? "no log directory",
    };

    const decisionResult = await core.getManager().decisionEngine!.decide({
      requestId: "validation-full-pipeline",
      type: DecisionType.General,
      priority: DecisionPriority.Normal,
      userRequest: "Validate full pipeline through workflow",
      statedObjective: "End-to-end pipeline validation",
      availableData: {
        objective: "End-to-end pipeline validation",
        brandProfile: { name: "KWIZERA AI STUDIO" },
      },
    });

    const pipelineWorkflow = await engine!.execute(decisionResult.planningResult!.workflowHandoff!);

    results.fullPipeline = {
      passed: decisionResult.approved && pipelineWorkflow.success,
      detail: pipelineWorkflow.success
        ? `Full pipeline completed (${pipelineWorkflow.workflowType})`
        : "Pipeline blocked",
    };

    const statusReport = engine!.buildStatusReport();
    results.performance = {
      passed: statusReport.performance.totalWorkflows >= 3,
      detail: `avg ${statusReport.performance.averageWorkflowMs}ms, success ${statusReport.performance.successRate}%`,
    };

    results.readiness = {
      passed: statusReport.readinessScore >= 80,
      detail: `Readiness score: ${statusReport.readinessScore}/100`,
    };

    await core.stop("validation complete");

    const allPassed = Object.values(results).every((r) => r.passed);
    const reportPath = path.join(process.cwd(), "STEP-2E-VALIDATION-REPORT.md");
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
    import("../ai/workflow/workflow-engine.js").AiWorkflowEngine["buildStatusReport"]
  >,
  results: Record<string, { passed: boolean; detail: string }>,
  storageRoot: string,
  allPassed: boolean
): string {
  return `# KWIZERA AI STUDIO — Step 2E Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2E — AI Workflow Engine  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **Workflow Engine Status** | ${status.workflowEngineStatus} |
| **Execution Status** | ${status.executionStatus} |
| **Scheduling Quality** | ${status.schedulingQuality} |
| **Recovery Status** | ${status.recoveryStatus} |
| **Average Workflow Time** | ${status.performance.averageWorkflowMs}ms |
| **Success Rate** | ${status.performance.successRate}% |
| **Total Workflows (validation run)** | ${status.performance.totalWorkflows} |
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

## Workflow Execution (13 Steps)

1. Receive Execution Plan  
2. Validate the Plan  
3. Create Workflow Session  
4. Prepare Required Modules  
5. Verify Dependencies  
6. Execute First Task  
7. Verify Task Result  
8. Continue to Next Task  
9. Repeat until all tasks finish  
10. Validate Final Output  
11. Save Workflow History  
12. Notify AI Core  
13. Notify User  

---

## Known Issues

${status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`).join("\n") : "- None identified during validation"}

---

## Components Implemented

- AI Workflow Engine (\`ai/workflow/workflow-engine.ts\`)
- Task Scheduler & Coordinator (\`ai/workflow/task-*.ts\`)
- Workflow Dependency Manager (\`ai/workflow/workflow-dependency-manager.ts\`)
- Progress Tracker & Recovery Manager (\`ai/workflow/progress-tracker.ts\`)
- Output Validator (\`ai/workflow/output-validator.ts\`)
- Workflow History Store (\`ai/workflow/workflow-history-store.ts\`)
- Workflow Logger (\`ai/workflow/workflow-logger.ts\`)

---

## Not Implemented (by design — Step 2E scope)

- User Interface, Product Management, Video, Image, Marketing engines
- Memory Engine, Knowledge Engine (real implementations)
- AI models, parallel execution (future support)

---

**KWIZERA AI** — Workflow Engine ready for Step 2F upon approval.
`;
}

main();
