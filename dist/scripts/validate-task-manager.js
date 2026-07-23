import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAiCore, DecisionPriority, DecisionType, ManagedTaskState, ManagedTaskType, PlanningType, TaskPriority, TaskQueueCategory, WorkflowState, } from "../ai/index.js";
function createTempStorageRoot() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "kwizera-validate-task-manager-"));
}
async function main() {
    const storageRoot = process.env.KWIZERA_STORAGE_ROOT ?? createTempStorageRoot();
    const useTemp = !process.env.KWIZERA_STORAGE_ROOT;
    console.log("KWIZERA AI STUDIO — Step 2F Task Manager Validation");
    console.log("Storage root:", storageRoot);
    console.log("---");
    const core = createAiCore({ storageRootOverride: storageRoot });
    const results = {};
    try {
        await core.start("step-2f-validation");
        const manager = core.getManager().taskManager;
        const planning = core.getManager().planningEngine;
        results.initialization = {
            passed: manager.isInitialized(),
            detail: manager.isInitialized() ? "Task Manager initialized" : "Not initialized",
        };
        results.registry = {
            passed: core.getManager().registry.getEntry("task-manager")?.status === "initialized",
            detail: `task-manager: ${core.getManager().registry.getEntry("task-manager")?.status}`,
        };
        const created = manager.createTask({
            name: "validation task",
            taskType: ManagedTaskType.Backup,
            priority: TaskPriority.High,
            queueCategory: TaskQueueCategory.Maintenance,
            moduleId: "decision-engine",
        });
        results.taskCreation = {
            passed: Boolean(created.id) && created.state === ManagedTaskState.Created,
            detail: `Task ${created.id.slice(0, 8)}... created`,
        };
        manager.queueTask(created.id);
        const queueStatus = manager.getQueueStatus();
        results.queueManagement = {
            passed: queueStatus.totalQueued >= 1,
            detail: `Queued: ${queueStatus.totalQueued}, maintenance: ${queueStatus.maintenance}`,
        };
        const plan = await planning.planFromDecision({
            decisionId: "val-decision",
            requestId: "val-request",
            planningType: PlanningType.Backup,
            priority: DecisionPriority.Normal,
            objective: "Step 2F validation",
            userRequest: "Validate task manager",
            availableData: { brandProfile: { name: "KWIZERA AI STUDIO" } },
            workflowHandoff: {
                workflowId: "workflow-general-validated",
                requiredModules: ["decision-engine"],
                executionPriority: DecisionPriority.Normal,
                objective: "Step 2F validation",
                parameters: {},
                qualityAssessment: { sufficient: true, score: 95, checks: [], recommendations: [] },
            },
        });
        const run = await manager.runWorkflowTask({
            planTask: plan.executionPlan.taskList[0],
            workflowRunId: "wf-val",
            workflowId: plan.workflowHandoff.workflowId,
            taskType: ManagedTaskType.Backup,
            priority: TaskPriority.Critical,
            queueCategory: TaskQueueCategory.Maintenance,
            completedTaskIds: [],
        });
        results.priorityHandling = {
            passed: run.success && run.task.priority === TaskPriority.Critical,
            detail: `Critical task ${run.success ? "completed" : "failed"}`,
        };
        results.dependencyChecking = {
            passed: run.task.progress.errors.length === 0,
            detail: `${run.task.progress.warnings.length} warning(s)`,
        };
        results.progressTracking = {
            passed: run.task.progress.progressPercent === 100,
            detail: `Progress ${run.task.progress.progressPercent}%, elapsed ${run.task.progress.elapsedMs}ms`,
        };
        const recovered = await manager.runWorkflowTask({
            planTask: plan.executionPlan.taskList[1] ?? plan.executionPlan.taskList[0],
            workflowRunId: "wf-recovery",
            workflowId: plan.workflowHandoff.workflowId,
            taskType: ManagedTaskType.Backup,
            priority: TaskPriority.Normal,
            queueCategory: TaskQueueCategory.Recovery,
            completedTaskIds: [plan.executionPlan.taskList[0].id],
            simulateFailure: true,
        });
        results.recovery = {
            passed: recovered.success && recovered.task.state === ManagedTaskState.Recovered,
            detail: `Recovery attempts: ${recovered.task.progress.recoveryAttempts}`,
        };
        results.taskHistory = {
            passed: manager.history.getCount() >= 2 &&
                fs.existsSync(manager.history.getHistoryPath() ?? ""),
            detail: `${manager.history.getCount()} record(s)`,
        };
        results.taskLogging = {
            passed: Boolean(manager.logger.getLogDirectory() && fs.existsSync(manager.logger.getLogDirectory())),
            detail: manager.logger.getLogDirectory() ?? "none",
        };
        const decision = await core.getManager().decisionEngine.decide({
            requestId: "val-full-pipeline",
            type: DecisionType.General,
            priority: DecisionPriority.Normal,
            userRequest: "Full pipeline validation",
            statedObjective: "End-to-end with task manager",
            availableData: {
                objective: "End-to-end with task manager",
                brandProfile: { name: "KWIZERA AI STUDIO" },
            },
        });
        const workflow = await core.getManager().workflowEngine.execute(decision.planningResult.workflowHandoff);
        results.workflowIntegration = {
            passed: workflow.success && workflow.state === WorkflowState.Completed,
            detail: workflow.success ? "Workflow completed via Task Manager" : "Workflow failed",
        };
        const status = manager.buildStatusReport();
        results.performance = {
            passed: status.performance.totalTasks >= 3,
            detail: `avg ${status.performance.averageTaskMs}ms, throughput ${status.performance.throughput}%`,
        };
        results.readiness = {
            passed: status.readinessScore >= 80,
            detail: `Readiness ${status.readinessScore}/100`,
        };
        await core.stop("validation complete");
        const allPassed = Object.values(results).every((r) => r.passed);
        const reportPath = path.join(process.cwd(), "STEP-2F-VALIDATION-REPORT.md");
        fs.writeFileSync(reportPath, buildReport(status, results, storageRoot, allPassed), "utf8");
        console.log(buildReport(status, results, storageRoot, allPassed));
        console.log("---");
        console.log(`Report written to: ${reportPath}`);
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
    return `# KWIZERA AI STUDIO — Step 2F Validation Report

**Phase:** 2 — Core AI Engine  
**Step:** 2F — AI Task Manager  
**Date:** ${new Date().toISOString()}  
**Storage root (validation):** \`${storageRoot}\`

---

## Summary

| Field | Value |
|-------|-------|
| **Task Manager Status** | ${status.taskManagerStatus} |
| **Queue Status** | ${status.queueStatus} |
| **Scheduling Quality** | ${status.schedulingQuality} |
| **Recovery Status** | ${status.recoveryStatus} |
| **Average Task Time** | ${status.performance.averageTaskMs}ms |
| **Throughput** | ${status.performance.throughput}% |
| **Total Tasks (validation run)** | ${status.performance.totalTasks} |
| **Readiness Score** | **${status.readinessScore}/100** |
| **Overall** | ${allPassed ? "✅ PASS" : "❌ FAIL"} |

---

## Validation Checks

${Object.entries(results)
        .map(([name, r]) => `- **${name}**: ${r.passed ? "✅ PASS" : "❌ FAIL"} — ${r.detail}`)
        .join("\n")}

---

## Task Lifecycle

Created → Queued → Waiting → Preparing → Running → Completed / Failed / Recovered / Cancelled / Archived

---

## Known Issues

${status.knownIssues.length > 0 ? status.knownIssues.map((i) => `- ${i}`).join("\n") : "- None identified during validation"}

---

## Components Implemented

- AI Task Manager (\`ai/task-manager/task-manager.ts\`)
- Task Queue Manager (\`ai/task-manager/task-queue-manager.ts\`)
- Task Priority Scheduler (\`ai/task-manager/task-priority-scheduler.ts\`)
- Task Dependency Checker (\`ai/task-manager/task-dependency-checker.ts\`)
- Task Progress Tracker (\`ai/task-manager/task-progress-tracker.ts\`)
- Task Resource Monitor (\`ai/task-manager/task-resource-monitor.ts\`)
- Task Module Executor (\`ai/task-manager/task-module-executor.ts\`)
- Task History Store & Logger

---

## Not Implemented (by design — Step 2F scope)

- User Interface, Product Management, Video, Image, Marketing engines
- Memory Engine, Knowledge Engine (real implementations)
- AI models, parallel execution (future support)

---

**KWIZERA AI** — Task Manager ready for Step 2G upon approval.
`;
}
main();
//# sourceMappingURL=validate-task-manager.js.map